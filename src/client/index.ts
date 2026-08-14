/**
 * dsh-git-panel —— 浏览器端：将 git 面板列挂载到 web shell 的 frame 网格
 *（右侧），绑定到当前活动会话的 cwd，并驱动 /git-panel 宿主路由。所有接线
 * 失败都会记日志而不会抛出——当插件 apply 抛出异常时，shell 会中止整个启动
 * 流程。
 * @module dsh-git-panel/client
 */

import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { createRoot, type Root } from 'react-dom/client'
import { GitPanelApi } from './api.ts'
import { BranchChip } from './BranchChip.tsx'
import { mountPanelColumn, waitForFrame, type PanelColumn } from './frame.ts'
import { initI18n } from './i18n.ts'
import { GitPanel } from './Panel.tsx'

/**
 * 我们使用到的注入式客户端运行时结构。这里在本地声明，而不是导入 SDK 的
 * ClientContext：宿主侧的 SDK 包会用另一种不同的 `sessions` 结构扩展同一个
 * cordis Context，当宿主端与客户端在同一程序中一起编译时，后者会胜出。无论
 * 如何，bundle 在运行时都采用鸭子类型判定。
 */
interface PanelClientContext {
  effect(fn: () => (() => void) | void, name: string): void
  inject(services: string[], fn: (scope: PanelClientContext) => void): void
  sessions: {
    list: {
      getSnapshot(): { current?: string; byId: Record<string, { cwd?: string }> }
      subscribe(fn: () => void): () => void
    }
  }
  slots: {
    inject(name: string, factory: () => unknown): () => void
    register(opts: Record<string, unknown>, component: unknown): unknown
  }
  locale: {
    getLocale(): { active: string }
    subscribe(fn: () => void): () => void
  }
}

/** 必需服务：用于获取项目根目录的 sessions，用于文案的 locale。 */
export const inject = ['sessions', 'locale']

const HIDDEN_KEY = 'dsh-git-panel.hidden'

/** 应用浏览器端。 */
export function apply(ctx: PanelClientContext): void {
  // 获取平台语言（zh/en）以及浏览器语言用于文案；语言接口只订阅一次，
  // 并驱动 useT() hook。
  try {
    initI18n(ctx.locale)
  } catch (error) {
    console.error('dsh-git-panel: i18n init failed (falling back to Chinese)', error)
  }
  // 输入 dock 处的分支 chip，挂载在工作区选择器旁、提示输入框上方（官方
  // conversation.input.dock 槽位，rc.6 中声明）。采用 git-graph 式的注册流程：
  // ctx.inject 会等待服务就绪，register() 接收注入 props 的 FACTORY（shell
  // 会把返回的对象传入组件的 props）。
  ctx.inject(['slots', 'sessions'], (scope: PanelClientContext) => {
    try {
      scope.slots.inject('conversation.input.dock', () =>
        scope.slots.register({
          name: 'conversation.input.dock',
          id: 'git-panel-branch-chip',
          order: 100,
          locale: 'dsh-git-panel',
          inject: () => ({ sessions: scope.sessions }),
        }, BranchChip))
    } catch (error) {
      console.error('dsh-git-panel: branch chip registration failed', error)
    }
  })

  ctx.effect(() => {
    const api = new GitPanelApi()
    let column: PanelColumn | null = null
    let root: Root | null = null
    let currentPath = ''
    let disposeWait: (() => void) | undefined
    let disposeSessions: (() => void) | undefined
    let hidden = false
    try {
      hidden = localStorage.getItem(HIDDEN_KEY) === '1'
    } catch {
      /* 忽略 */
    }

    const render = (): void => {
      if (root === null) return
      // 隐藏状态下：卸载面板树，这样就不会加载任何分支数据。
      if (hidden) {
        root.render(null)
        return
      }
      root.render(ReactPanel(api, currentPath))
    }

    const setHidden = (next: boolean): void => {
      if (hidden === next) return
      hidden = next
      try {
        localStorage.setItem(HIDDEN_KEY, next ? '1' : '0')
      } catch {
        /* 忽略 */
      }
      // 边缘处的切换箭头会自行更新方向与位置。
      column?.setVisible(!next)
      render()
    }

    const bindRoot = (): void => {
      const snapshot = ctx.sessions.list.getSnapshot()
      const sessionId: string | undefined = snapshot.current
      const cwd = sessionId === undefined ? undefined : snapshot.byId[sessionId]?.cwd
      const path = typeof cwd === 'string' && cwd !== '' ? cwd : ''
      if (path === currentPath) return
      currentPath = path
      render()
    }

    disposeWait = waitForFrame((frame) => {
      try {
        column = mountPanelColumn(frame, 320, { onToggle: () => setHidden(!hidden) })
        if (hidden) column.setVisible(false)
        root = createRoot(column.element)
        render()
      } catch (error) {
        console.error('dsh-git-panel: mount failed', error)
      }
    })

    disposeSessions = ctx.sessions.list.subscribe(bindRoot)
    bindRoot()

    return () => {
      disposeSessions?.()
      disposeWait?.()
      try {
        root?.unmount()
      } catch {
        /* 忽略 */
      }
      column?.dispose()
    }
  }, 'dsh-git-panel: mount')
}

/** 本地辅助函数，让 Panel.tsx 不必与 sessions 管道纠缠。 */
import { createElement } from 'react'
function ReactPanel(api: GitPanelApi, path: string): React.ReactElement {
  return createElement(GitPanel, { path, api })
}

/** Cordis 插件入口 —— 同时提供命名与默认导出，确保 loader 总能解析到它。 */
export default { apply, inject }
