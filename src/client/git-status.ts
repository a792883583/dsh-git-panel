/**
 * 工作区 git 变更清单的客户端缓存。
 *
 * 两个消费者共用这一份数据：
 * 1. 文件树装饰（侧边栏 M/U/A 标记）——需要「这个路径有没有改动」的同步答案；
 * 2. 标签类型路由门禁（`canOpen`）——Cordis 的路由判定是同步的，因此必须有
 *    一个同步可读的缓存，网络请求只负责把它刷新。
 *
 * 缓存以「工作区根」为键（会话 cwd），带 TTL 去重，并在内容变化时通知订阅者。
 *
 * @module dsh-git-panel/client/git-status
 */

import type { FileStatusView } from '../core/types.ts'
import { GitPanelApi } from './api.ts'

/** 缓存寿命：这段时间内的重复询问不再发请求。 */
const TTL_MS = 3000

/** 单个工作区的变更快照。 */
interface Snapshot {
  view: FileStatusView
  /** 拉取时刻。 */
  at: number
  /** 工作区相对路径 -> porcelain 状态码。 */
  codes: Map<string, string>
}

/**
 * 把 porcelain 状态码折叠成一个展示字母（对齐 VS Code 的语义）。
 * @param code - `git status --porcelain` 的两字符状态码。
 * @returns `M`/`A`/`D`/`R`/`U`（未跟踪）/`C`（冲突）。
 */
export function statusLetter(code: string): string {
  if (code === '??') return 'U'
  if (code === '!!') return 'U'
  const index = code[0] ?? ' '
  const work = code[1] ?? ' '
  const pair = `${index}${work}`
  if (pair === 'DD' || pair === 'AU' || pair === 'UD' || pair === 'UA' || pair === 'DU' || pair === 'AA' || pair === 'UU') return 'C'
  if (index === 'D' || work === 'D') return 'D'
  if (index === 'R' || work === 'R') return 'R'
  if (index === 'A' || work === 'A' || index === 'C' || work === 'C') return 'A'
  return 'M'
}

/** 每个状态字母的语义色（深浅主题下都保持可读）。 */
export const STATUS_COLORS: Record<string, string> = {
  M: '#e2c08d',
  A: '#73c991',
  U: '#73c991',
  D: '#c74e39',
  R: '#e2c08d',
  C: '#e06c75',
  /** 目录聚合标记：只表示「下面有改动」，因此用中性灰。 */
  '•': '#9198a1',
}

/** 变更清单缓存。 */
export class GitStatusCache {
  private readonly snapshots = new Map<string, Snapshot>()
  private readonly inflight = new Map<string, Promise<void>>()
  private readonly listeners = new Set<() => void>()
  /** 每次内容变化递增，装饰层用它判断是否需要重绘。 */
  private generation = 0

  constructor(private readonly api: GitPanelApi) {}

  /** 内容版本号：快照变化即递增。 */
  get version(): number {
    return this.generation
  }

  /**
   * 观察清单变化。
   * @param listener - 同步失效回调。
   * @returns 退订函数。
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * 同步读取一个文件的状态字母。
   * @param root - 工作区根（会话 cwd）。
   * @param relative - 工作区相对路径。
   * @returns 状态字母；无缓存或该文件无改动时返回 undefined。
   */
  letterOf(root: string, relative: string): string | undefined {
    const snapshot = this.snapshots.get(root)
    if (snapshot === undefined) return undefined
    const code = snapshot.codes.get(relative)
    return code === undefined ? undefined : statusLetter(code)
  }

  /**
   * 同步判断一个文件此刻是否被认为有 git 改动，供路由门禁使用。
   * @param root - 工作区根（会话 cwd）。
   * @param relative - 工作区相对路径。
   * @returns 有改动为 true；没有缓存时保守地返回 false。
   */
  isChanged(root: string, relative: string): boolean {
    return this.letterOf(root, relative) !== undefined
  }

  /**
   * 读取一个工作区的快照（可能为空）。
   * @param root - 工作区根。
   * @returns 最近一次成功拉取的视图。
   */
  viewOf(root: string): FileStatusView | undefined {
    return this.snapshots.get(root)?.view
  }

  /**
   * 已经建立过快照的工作区根。
   * @returns 根路径列表。
   */
  roots(): string[] {
    return [...this.snapshots.keys()]
  }

  /**
   * 确保某个工作区的清单是新鲜的。
   * @param root - 工作区根（会话 cwd）。
   * @param fresh - 忽略 TTL，强制重新拉取。
   * @returns 拉取完成（成功或失败都静默）后的 promise。
   */
  async ensure(root: string, fresh = false): Promise<void> {
    if (root === '') return
    const held = this.snapshots.get(root)
    if (!fresh && held !== undefined && Date.now() - held.at < TTL_MS) return
    const running = this.inflight.get(root)
    if (running !== undefined) return running
    const task = this.pull(root).finally(() => {
      this.inflight.delete(root)
    })
    this.inflight.set(root, task)
    return task
  }

  /** 发一次请求并替换快照。 */
  private async pull(root: string): Promise<void> {
    let envelope
    try {
      envelope = await this.api.fileStatus(root)
    } catch {
      return
    }
    if (!envelope.ok) return
    const view = envelope.value
    const codes = new Map<string, string>()
    for (const entry of view.entries) codes.set(entry.path, entry.code)
    const changed = this.differs(this.snapshots.get(root), view, codes)
    this.snapshots.set(root, { view, at: Date.now(), codes })
    if (changed) {
      this.generation += 1
      for (const listener of [...this.listeners]) {
        try {
          listener()
        } catch (error) {
          console.warn('dsh-git-panel: status listener failed', error)
        }
      }
    }
  }

  /** 快照是否与旧值不同（决定要不要通知）。 */
  private differs(previous: Snapshot | undefined, view: FileStatusView, codes: Map<string, string>): boolean {
    if (previous === undefined) return true
    if (previous.view.entries.length !== view.entries.length) return true
    if (previous.codes.size !== codes.size) return true
    for (const [path, code] of codes) if (previous.codes.get(path) !== code) return true
    return false
  }
}
