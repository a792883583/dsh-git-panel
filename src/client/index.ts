/**
 * dsh-git-panel —— 浏览器端：把 Git 面板注册为官方右侧栏的原生 Tab
 *（`sidebar.right.pane.tab` + `sidebar.right.pane.tab.title`），并绑定当前活动
 * 会话的 cwd，驱动 /git-panel 宿主路由。面板的展开、收起、宽度与多标签切换全部
 * 交给官方右侧栏接管，不再改动底层网格布局。
 *
 * 所有接线失败都会记日志而不会抛出——当插件 apply 抛出异常时，shell 会中止整个
 * 启动流程。
 * @module dsh-git-panel/client
 */

import { createElement } from 'react'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { GitPanelApi } from './api.ts'
import { BranchChip } from './BranchChip.tsx'
import { initI18n } from './i18n.ts'
import { GitTabBody } from './GitTab.tsx'

/**
 * 我们使用到的注入式客户端运行时结构。这里在本地声明，而不是导入 SDK 的
 * ClientContext：宿主侧的 SDK 包会用另一种不同的 `sessions` 结构扩展同一个
 * cordis Context，当宿主端与客户端在同一程序中一起编译时，后者会胜出。无论
 * 如何，bundle 在运行时都采用鸭子类型判定。
 */
interface PanelClientContext {
  effect(fn: () => (() => void) | void, name: string): void
  inject(services: string[], fn: (scope: PanelClientContext) => void): void
  sidebarRightTabs?: {
    register(def: unknown): () => void
  }
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

export const inject = ['sessions', 'locale']

const TAB_ID = '@deepseek-ai/dsh-git-panel'

export function apply(ctx: PanelClientContext): void {
  try {
    initI18n(ctx.locale)
  } catch (error) {
    console.error('dsh-git-panel: i18n init failed', error)
  }

  // 1. 输入框上方分支状态 Chip
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

  // 2. 官方右侧栏集成 (适配新版 DSH 0.1.5-alpha.2+ 原生多 Tab 系统)
  //    面板本体不再外挂独立列，也不再需要折叠箭头：完全由官方右侧栏接管。
  const api = new GitPanelApi()
  ctx.inject(['sidebarRightTabs', 'slots'], (scope: any) => {
    try {
      if (scope.sidebarRightTabs) {
        scope.sidebarRightTabs.register({
          id: TAB_ID,
          kind: 'git',
          priority: 'extension',
          title: () => 'Git',
          guide: [{
            order: 12,
            title: () => 'Git 版本控制与提交图谱',
          }],
        })

        scope.slots.inject('sidebar.right.pane.tab', () =>
          scope.slots.register({
            name: 'sidebar.right.pane.tab',
            key: TAB_ID,
            inject: () => ({ api, sessions: ctx.sessions }),
          }, GitTabBody)
        )

        scope.slots.inject('sidebar.right.pane.tab.title', () =>
          scope.slots.register({
            name: 'sidebar.right.pane.tab.title',
            key: TAB_ID,
          }, () => createElement('span', { style: { display: 'flex', alignItems: 'center', gap: 5 } },
            createElement('svg', { viewBox: '0 0 16 16', width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' },
              createElement('circle', { cx: 4, cy: 4, r: 2 }),
              createElement('circle', { cx: 4, cy: 12, r: 2 }),
              createElement('circle', { cx: 12, cy: 8, r: 2 }),
              createElement('path', { d: 'M4 6v4M4 8h5a3 3 0 013 3' })
            ),
            createElement('span', null, 'Git')
          ))
        )
        console.log('dsh-git-panel: registered into native sidebarRightTabs')
      }
    } catch (err) {
      console.warn('dsh-git-panel: sidebarRightTabs register error', err)
    }
  })
}

/** Cordis 插件入口 —— 同时提供命名与默认导出，确保 loader 总能解析到它。 */
export default { apply, inject }
