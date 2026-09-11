/**
 * 侧边栏文件树的 git 状态装饰（VS Code 的 Explorer 观感）。
 *
 * 官方文件树（`@deepseek-ai/dsh-client-ui-sidebar-files`）不属于本插件，不能改它
 * 的渲染；但它给每一行留了稳定的 DOM 契约：
 *
 * - `[data-files-state="tree"][data-files-root="<绝对根>"]`：一棵树；
 * - `li[data-files-entry="file|directory"][data-files-path="<绝对路径>"]`：一行。
 *
 * 于是装饰层只做两件事：读这些属性算出工作区相对路径，然后在行尾补一个状态
 * 字母、并给文件名上色。React 重渲染会覆盖我们的节点，因此每次变更都按
 * 「签名」判定是否需要重画，且只在缺失时重新插入。
 *
 * @module dsh-git-panel/client/decorations
 */

import { STATUS_COLORS, type GitStatusCache } from './git-status.ts'

/** 装饰节点的类名（同时用于样式与幂等判定）。 */
const DECO_CLASS = 'dsh-git-deco'

/** 注入一次样式。 */
let styleReady = false
function ensureStyle(): void {
  if (styleReady || typeof document === 'undefined') return
  styleReady = true
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-git-panel-decorations'
  tag.textContent = STYLE
  document.head.appendChild(tag)
}

/** 绝对路径 -> 工作区相对路径（不在根下时返回 undefined）。 */
function relativeTo(root: string, absolute: string): string | undefined {
  const base = root.replace(/\\/gu, '/').replace(/\/+$/u, '')
  const target = absolute.replace(/\\/gu, '/')
  if (target === base) return ''
  return target.startsWith(`${base}/`) ? target.slice(base.length + 1) : undefined
}

/** 一行此刻应有的装饰签名。 */
function signatureOf(letter: string | undefined): string {
  return letter ?? ''
}

/** 把一行画成它应有的样子（幂等）。 */
function decorateRow(row: Element, letter: string | undefined): void {
  const button = row.querySelector(':scope > button') ?? row.querySelector(':scope > span')
  if (button === null) return
  const name = button.querySelector('span')
  // 标记贴在文件名之后（VS Code 的位置）；没有名字元素时才退回行容器。
  const host = name ?? button
  const existing = row.querySelector(`.${DECO_CLASS}`) as HTMLElement | null
  const signature = signatureOf(letter)
  const attribute = (row as HTMLElement).dataset.dshGitSig ?? ''
  const consistent = letter === undefined ? existing === null : existing !== null && existing.parentElement === host
  if (attribute === signature && consistent) return
  ;(row as HTMLElement).dataset.dshGitSig = signature

  if (letter === undefined) {
    existing?.remove()
    if (name instanceof HTMLElement) name.style.removeProperty('color')
    return
  }
  if (name instanceof HTMLElement) name.style.color = STATUS_COLORS[letter] ?? 'inherit'
  if (existing !== null && existing.parentElement !== host) existing.remove()
  const badge = existing?.parentElement === host ? existing : document.createElement('span')
  badge.className = DECO_CLASS
  badge.textContent = letter
  badge.setAttribute('data-letter', letter)
  badge.style.color = STATUS_COLORS[letter] ?? 'inherit'
  if (badge.parentElement !== host) host.appendChild(badge)
}

/**
 * 安装文件树装饰。
 * @param cache - 变更清单缓存（同步可读）。
 * @param ensure - 请求刷新某个工作区的清单。
 * @returns 卸载函数。
 */
export function installFileTreeDecorations(
  cache: GitStatusCache,
  ensure: (root: string) => void,
): () => void {
  if (typeof document === 'undefined') return () => {}
  ensureStyle()
  let frame = 0
  let stopped = false

  const run = (): void => {
    if (stopped) return
    const trees = document.querySelectorAll('[data-files-state="tree"][data-files-root]')
    for (const tree of trees) {
      const root = tree.getAttribute('data-files-root')
      if (root === null || root === '') continue
      ensure(root)
      const view = cache.viewOf(root)
      if (view === undefined) continue
      // 目录聚合：某个目录下只要有改动，就给目录一个圆点（VS Code 行为）。
      const directories = new Set<string>()
      for (const entry of view.entries) {
        let at = entry.path.lastIndexOf('/')
        while (at > 0) {
          directories.add(entry.path.slice(0, at))
          at = entry.path.lastIndexOf('/', at - 1)
        }
      }
      for (const row of tree.querySelectorAll('li[data-files-entry]')) {
        const absolute = row.getAttribute('data-files-path')
        if (absolute === null) continue
        const relative = relativeTo(root, absolute)
        if (relative === undefined || relative === '') continue
        const kind = row.getAttribute('data-files-entry')
        if (kind === 'file') {
          decorateRow(row, cache.letterOf(root, relative))
          continue
        }
        if (kind === 'directory') {
          decorateRow(row, directories.has(relative) ? dotLetter() : undefined)
        }
      }
    }
  }

  const schedule = (): void => {
    if (stopped || frame !== 0) return
    frame = window.requestAnimationFrame(() => {
      frame = 0
      try {
        run()
      } catch (error) {
        console.warn('dsh-git-panel: decoration pass failed', error)
      }
    })
  }

  const observer = new MutationObserver(schedule)
  observer.observe(document.body, { childList: true, subtree: true })
  const unsubscribe = cache.subscribe(schedule)
  schedule()

  return () => {
    stopped = true
    observer.disconnect()
    unsubscribe()
    if (frame !== 0) window.cancelAnimationFrame(frame)
  }
}

/** 目录用的状态字母：一个更中性的点，而不是文件状态字母。 */
function dotLetter(): string {
  return '•'
}

/** 装饰样式。 */
const STYLE = `
.dsh-git-deco { flex:0 0 auto; margin-left:5px; font-size:10.5px; font-weight:700;
  font-family:var(--dsw-font-family, inherit); opacity:.95; }
.dsh-git-deco[data-letter="•"] { font-size:13px; line-height:1; opacity:.8; }
`
