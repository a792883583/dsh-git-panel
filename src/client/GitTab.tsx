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
import { GitPanelApi } from './api.ts'
import { GitPanel } from './Panel.tsx'
import type { GitStatusCache } from './git-status.ts'

/** sessions 服务的最小结构面孔（鸭子类型，避免依赖宿主 SDK 类型）。 */
export interface TabSessions {
  list: {
    getSnapshot(): { current?: string; byId: Record<string, { cwd?: string }> }
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
  /** 官方注入的标签钩子。 */
  useTabInfo?: () => TabInfo
}

/** 从会话快照读取当前工作区路径。 */
function readPath(sessions: TabSessions | undefined): string {
  if (!sessions) return ''
  const snapshot = sessions.list.getSnapshot()
  const sessionId = snapshot.current
  const cwd = sessionId === undefined ? undefined : snapshot.byId[sessionId]?.cwd
  return typeof cwd === 'string' ? cwd : ''
}

/** 由会话身份与工作区相对路径拼出文件资源地址。 */
function addressOf(sessionId: string, relative: string): string {
  const encoded = relative.split('/').map((segment) => encodeURIComponent(segment)).join('/')
  return `dsh-resource://file/session/${encodeURIComponent(sessionId)}/${encoded}`
}

/** 官方右侧栏中的 Git 面板。 */
export function GitTabBody(props: GitTabBodyProps): React.ReactElement {
  const { sessions, statusCache } = props
  const [api] = useState<GitPanelApi>(() => props.api ?? new GitPanelApi())
  const [path, setPath] = useState<string>(() => props.path ?? readPath(sessions))
  const info = props.useTabInfo?.()

  useEffect(() => {
    if (!sessions) return undefined
    const update = (): void => setPath(readPath(sessions))
    update()
    return sessions.list.subscribe(update)
  }, [sessions])

  /** 在右侧栏以 Git 对比视图打开某个变更文件。 */
  const openDiff = useCallback((relative: string): boolean => {
    const snapshot = sessions?.list.getSnapshot()
    const sessionId = snapshot?.current
    if (sessionId === undefined || relative === '') return false
    try {
      info?.tab.actions.openResource(addressOf(sessionId, relative), { kind: 'git-diff' })
      return true
    } catch (error) {
      console.warn('dsh-git-panel: open diff failed', error)
      return false
    }
  }, [info, sessions])

  /** 面板刷新时同步刷新装饰缓存。 */
  const refreshStatus = useCallback((): void => {
    if (statusCache !== undefined && path !== '') void statusCache.ensure(path, true)
  }, [statusCache, path])

  return createElement(GitPanel, { path, api, onOpenDiff: openDiff, onRefreshStatus: refreshStatus })
}
