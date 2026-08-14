/**
 * /git-panel/* 路由层：为查询和变更操作提供 JSON 封装（ok/error）。
 * 工作区门禁由服务层负责；本层负责 HTTP 形态。
 * @module dsh-git-panel/host/routes
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type { GitError } from '../core/types.ts'
import type { GitService } from './git-service.ts'

type Envelope<T> = { ok: true; value: T } | { ok: false; error: GitError }

const BODY_CAP_BYTES = 1 << 20

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const part = chunk as Buffer
    total += part.length
    if (total > BODY_CAP_BYTES) {
      req.destroy()
      return null
    }
    chunks.push(part)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  if (text === '') return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

function json(res: ServerResponse, envelope: Envelope<unknown>, status = 200): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(envelope))
}

/** 从 JSON 对象载荷中提取必需的字符串字段。 */
function field(payload: unknown, key: string): string | null {
  if (typeof payload !== 'object' || payload === null) return null
  const value = (payload as Record<string, unknown>)[key]
  return typeof value === 'string' && value !== '' ? value : null
}

const BAD_REQUEST: GitError = { code: 'internal', message: 'malformed request' }

function route(service: GitService) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = new URL(req.url ?? '/', 'http://dsh')
    const path = url.pathname

    if (req.method !== 'POST') {
      json(res, { ok: false, error: { code: 'internal', message: 'method not allowed' } }, 405)
      return
    }

    const payload = await readJsonBody(req)
    const root = field(payload, 'path')
    if (root === null) {
      json(res, { ok: false, error: BAD_REQUEST }, 400)
      return
    }

    try {
      switch (path) {
        case '/git-panel/current': {
          const value = await service.current(root)
          json(res, { ok: true, value })
          return
        }
        case '/git-panel/branches': {
          const value = await service.branches(root)
          json(res, { ok: true, value })
          return
        }
        case '/git-panel/graph': {
          const value = await service.graph(root)
          json(res, { ok: true, value })
          return
        }
        case '/git-panel/switch': {
          const branch = field(payload, 'branch')
          if (branch === null) { json(res, { ok: false, error: BAD_REQUEST }, 400); return }
          const value = await service.switchBranch(root, branch)
          json(res, value.ok ? { ok: true, value } : { ok: false, error: value.error ?? BAD_REQUEST })
          return
        }
        case '/git-panel/pull': {
          const value = await service.pull(root)
          json(res, value.ok ? { ok: true, value } : { ok: false, error: value.error ?? BAD_REQUEST })
          return
        }
        case '/git-panel/fetch': {
          const value = await service.fetchAll(root)
          json(res, value.ok ? { ok: true, value } : { ok: false, error: value.error ?? BAD_REQUEST })
          return
        }
        case '/git-panel/rename': {
          const branch = field(payload, 'branch')
          const newName = field(payload, 'newName')
          if (branch === null || newName === null) { json(res, { ok: false, error: BAD_REQUEST }, 400); return }
          const value = await service.renameBranch(root, branch, newName)
          json(res, value.ok ? { ok: true, value } : { ok: false, error: value.error ?? BAD_REQUEST })
          return
        }
        case '/git-panel/delete': {
          const branch = field(payload, 'branch')
          if (branch === null) { json(res, { ok: false, error: BAD_REQUEST }, 400); return }
          const value = await service.deleteBranch(root, branch)
          json(res, value.ok ? { ok: true, value } : { ok: false, error: value.error ?? BAD_REQUEST })
          return
        }
        case '/git-panel/delete-remote': {
          const branch = field(payload, 'branch')
          if (branch === null) { json(res, { ok: false, error: BAD_REQUEST }, 400); return }
          const value = await service.deleteRemoteBranch(root, branch)
          json(res, value.ok ? { ok: true, value } : { ok: false, error: value.error ?? BAD_REQUEST })
          return
        }
        case '/git-panel/merge': {
          const branch = field(payload, 'branch')
          if (branch === null) { json(res, { ok: false, error: BAD_REQUEST }, 400); return }
          const value = await service.mergeBranch(root, branch)
          json(res, value.ok ? { ok: true, value } : { ok: false, error: value.error ?? BAD_REQUEST })
          return
        }
        default:
          json(res, { ok: false, error: { code: 'internal', message: `unknown route ${path}` } }, 404)
      }
    } catch (error) {
      const gitError: GitError = (error as { gitError?: GitError }).gitError
        ?? { code: 'internal', message: String(error instanceof Error ? error.message : error) }
      json(res, { ok: false, error: gitError })
    }
  }
}

/** 注册 /git-panel 各路由。 */
export function registerGitPanelRoutes(ctx: Context, service: GitService): () => void {
  return ctx.webServer.register({ kind: 'prefix', path: '/git-panel', handler: route(service) })
}
