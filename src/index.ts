/**
 * dsh-git-panel — host half: the workspace-gated git service and its
 * /git-panel/* HTTP routes on the shared webserver. The browser half
 * (exports "./client") is served by client-modules from the same package's
 * dsh.client declaration. Host git mutations are UI-triggered operations on
 * the workspace disk tree, never tool calls.
 * @module dsh-git-panel
 */

import { realpath } from 'node:fs/promises'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-subprocess'
import type {} from '@deepseek-ai/dsh-workspace'
import { GitService, subprocessRunner, type WorkspaceGate } from './host/git-service.ts'
import { registerGitPanelRoutes } from './host/routes.ts'

/** Required services: the route registry, the managed subprocess seam, and the workspace registry. */
export const inject = ['webServer', 'subprocess', 'workspaceRegistry']

/** The workspace-membership gate: canonicalize the path and require it to be a registered workspace. */
function createWorkspaceGate(ctx: Context): WorkspaceGate {
  return async (path) => {
    let canonical: string
    try {
      canonical = await realpath(path)
    } catch {
      return { ok: false, error: { code: 'workspace-unknown', message: 'path does not resolve on disk' } }
    }
    if (ctx.workspaceRegistry.list().some((workspace) => workspace.path === canonical)) {
      return { ok: true, canonical }
    }
    return { ok: false, error: { code: 'workspace-unknown', message: 'path is not a registered workspace' } }
  }
}

/** Mount the git service and its routes. */
export function apply(ctx: Context): void {
  const service = new GitService(subprocessRunner(ctx), createWorkspaceGate(ctx))
  ctx.effect(() => registerGitPanelRoutes(ctx, service), 'dsh-git-panel: /git-panel routes')
}

/** Cordis plugin entry — named + default export so the loader always resolves it. */
export default { apply, inject }
