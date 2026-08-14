/**
 * dsh-git-panel — 宿主侧部分：以工作区为边界约束的 git 服务及其
 * 在共享 webserver 上的 /git-panel/* HTTP 路由。浏览器侧部分
 * （导出 "./client"）由同包的 dsh.client 声明通过 client-modules 提供。
 * 宿主侧的 git 变更是由 UI 触发、作用于工作区磁盘目录树的操作，绝不属于
 * 工具调用。
 * @module dsh-git-panel
 */

import { realpath } from 'node:fs/promises'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-subprocess'
import type {} from '@deepseek-ai/dsh-workspace'
import { GitService, subprocessRunner, type WorkspaceGate } from './host/git-service.ts'
import { registerGitPanelRoutes } from './host/routes.ts'

/** 所需服务：路由注册表、托管子进程接缝和 workspace 注册表。 */
export const inject = ['webServer', 'subprocess', 'workspaceRegistry']

/** 工作区归属门禁：规范化路径并要求它是已注册的 workspace。 */
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

/** 挂载 git 服务及其路由。 */
export function apply(ctx: Context): void {
  const service = new GitService(subprocessRunner(ctx), createWorkspaceGate(ctx))
  ctx.effect(() => registerGitPanelRoutes(ctx, service), 'dsh-git-panel: /git-panel routes')
}

/** Cordis 插件入口——命名导出与默认导出并存，确保加载器总能解析到。 */
export default { apply, inject }
