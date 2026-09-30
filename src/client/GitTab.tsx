/**
 * 官方右侧栏 Git Tab 的内容体：订阅会话列表，跟随当前会话的工作区目录切换。
 *
 * 为什么需要这一层：`sidebar.right.pane.tab` 的 inject 工厂不保证在每次会话切换时
 * 重新求值，而 Git 面板必须始终指向当前活动会话的 cwd。这里主动订阅 sessions
 * 列表，把「当前会话 → 工作区路径」的映射变成 React 状态，切换会话时自动重渲染。
 *
 * 同时它把官方注入的 `useTabInfo` 变成一条「在右侧栏打开这个文件的 Git 对比」
 * 通道交给面板本体——面板只负责点，不关心地址怎么拼。
 *
 * @module dsh-git-panel/client/GitTab
 */

import { createElement, useCallback, useEffect, useState } from 'react'
import { setActiveSessionId } from './active-session.ts'
import { GitPanelApi } from './api.ts'
import { GitPanel } from './Panel.tsx'
import type { GitStatusCache } from './git-status.ts'

/** sessions 服务的最小结构面孔（鸭子类型，避免依赖宿主 SDK 类型）。
 *
 * ⚠️ 官方 `SessionListState`（`dsh-api-session-controller/lib/types/client/sessions/service`）只有：
 *   · `ids: SessionId[]`                        —— 宿主列表顺序
 *   · `byId: Record<SessionId, SessionSummary>` —— 含可选 `cwd`
 * **没有 `current` 字段**：该服务的注释写明 "view selection remains outside the
 * Controller"。当前会话身份必须由**插槽标准 props** 提供（见 GitTabBodyProps.sessionId）。
 */
export interface TabSessions {
  list: {
    getSnapshot(): { current?: string; ids?: string[]; byId: Record<string, { cwd?: string }> }
    subscribe(fn: () => void): () => void
  }
}

/** 官方右侧栏 `useTabInfo()` 的最小面孔。 */
export interface TabInfo {
  tab: {
    id: string
    contentId: string
    actions: {
      openResource(address: string, options?: Record<string, unknown>): void
    }
  }
}

/** Git Tab 内容体 props：api 由注册处注入，sessions 用于跟随当前会话。 */
export interface GitTabBodyProps {
  api?: GitPanelApi
  sessions?: TabSessions
  statusCache?: GitStatusCache
  /** 注入工厂给出的初始路径（可选，订阅后会以实时快照为准）。 */
  path?: string
  /**
   * **当前会话身份**，由官方插槽标准 props 下发。
   *
   * `sidebar.right.pane.tab` 的 scope 是 `'session'`，因此官方会把
   * `SessionStandardProps.sessionId` 一并传给内容体（官方契约原话：
   * "everything a body needs at runtime arrives in its props"）。
   *
   * ⚠️ 这是取得当前工作区的**唯一正确来源**。此前改用会话列表快照的
   * `snapshot.current`，但官方 `SessionListState` 里并没有该字段，导致 path 恒为空、
   * 面板永远显示「打开项目会话后显示 Git 面板」。
   */
  sessionId?: string
  /** 官方注入的标签钩子。 */
  useTabInfo?: () => TabInfo
}

/**
 * 由会话 id 取工作区根目录（cwd）。
 *
 * @param sessions - sessions 服务
 * @param sessionId - 会话身份（来自插槽标准 props）
 * @returns 该会话的 cwd；未知时返回空串
 */
function cwdOfSession(sessions: TabSessions | undefined, sessionId: string | undefined): string {
  if (!sessions || sessionId === undefined || sessionId === '') return ''
  try {
    const cwd = sessions.list.getSnapshot().byId[sessionId]?.cwd
    return typeof cwd === 'string' ? cwd : ''
  } catch {
    return ''
  }
}

/** 由会话身份与工作区相对路径拼出文件资源地址。 */
function addressOf(sessionId: string, relative: string): string {
  const encoded = relative.split('/').map((segment) => encodeURIComponent(segment)).join('/')
  return `dsh-resource://file/session/${encodeURIComponent(sessionId)}/${encoded}`
}

/** 官方右侧栏中的 Git 面板。 */
export function GitTabBody(props: GitTabBodyProps): React.ReactElement {
  const { sessions, statusCache, sessionId } = props
  const [api] = useState<GitPanelApi>(() => props.api ?? new GitPanelApi())
  const [path, setPath] = useState<string>(() => props.path ?? cwdOfSession(sessions, sessionId))
  const info = props.useTabInfo?.()

  // 跟随「当前会话」：sessionId 来自插槽标准 props，会话切换时它变化 → 重算工作区；
  // 同时订阅会话列表快照，cwd 后续才加载出来时也能补上。
  useEffect(() => {
    // 共享给后台轮询（它不在插槽内，拿不到标准 props）。
    setActiveSessionId(sessionId)
    if (!sessions) return undefined
    const update = (): void => setPath(cwdOfSession(sessions, sessionId))
    update()
    return sessions.list.subscribe(update)
  }, [sessions, sessionId])

  /** 在右侧栏以 Git 对比视图打开某个变更文件。 */
  const openDiff = useCallback((relative: string): boolean => {
    if (sessionId === undefined || sessionId === '' || relative === '') return false
    try {
      info?.tab.actions.openResource(addressOf(sessionId, relative), { kind: 'git-diff' })
      return true
    } catch (error) {
      console.warn('dsh-git-panel: open diff failed', error)
      return false
    }
  }, [info, sessionId])

  /** 面板刷新时同步刷新装饰缓存。 */
  const refreshStatus = useCallback((): void => {
    if (statusCache !== undefined && path !== '') void statusCache.ensure(path, true)
  }, [statusCache, path])

  return createElement(GitPanel, { path, api, onOpenDiff: openDiff, onRefreshStatus: refreshStatus })
}
