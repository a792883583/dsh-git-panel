/**
 * dsh-git-panel — browser half: mounts the git panel column into the web
 * shell's frame grid (right side), binds to the active session's cwd, and
 * drives the /git-panel host routes. Every wiring failure is logged, never
 * thrown — the shell fails the whole boot when a plugin apply throws.
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
 * Structural face of the injected client runtime we use. Declared locally
 * instead of importing the SDK's ClientContext: the host-side SDK packages
 * augment the same cordis Context with a different `sessions` shape, which
 * wins when host and client halves compile in one program. The bundle is
 * duck-typed at runtime either way.
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

/** Required services: sessions for the project root, locale for copy. */
export const inject = ['sessions', 'locale']

const HIDDEN_KEY = 'dsh-git-panel.hidden'

/** Apply the browser half. */
export function apply(ctx: PanelClientContext): void {
  // Pick up the platform locale (zh/en) + browser language for the copy;
  // the language face is subscribed once and drives the useT() hook.
  try {
    initI18n(ctx.locale)
  } catch (error) {
    console.error('dsh-git-panel: i18n init failed (falling back to Chinese)', error)
  }
  // The input-dock branch chip, mounted beside the workspace selector above
  // the composer (official conversation.input.dock slot, declared in rc.6).
  // Git-graph-style registration: ctx.inject waits for the services to be
  // ready, and register() receives a FACTORY for the injected props (the
  // shell passes the returned object into the component's props).
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
      /* noop */
    }

    const render = (): void => {
      if (root === null) return
      // Hidden: unmount the panel tree so no branch data is loaded at all.
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
        /* noop */
      }
      // The edge toggle arrow updates its direction and position internally.
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
        /* noop */
      }
      column?.dispose()
    }
  }, 'dsh-git-panel: mount')
}

/** Local helper to keep Panel.tsx free of the sessions plumbing. */
import { createElement } from 'react'
function ReactPanel(api: GitPanelApi, path: string): React.ReactElement {
  return createElement(GitPanel, { path, api })
}

/** Cordis plugin entry — named + default export so the loader always resolves it. */
export default { apply, inject }
