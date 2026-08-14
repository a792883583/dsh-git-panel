/** /git-panel 路由的类型化传输层。 */
import type { BranchesView, GraphView, OpResult } from '../core/types.ts'

export interface GitError {
  code: string
  message: string
}

export type Envelope<T> = { ok: true; value: T } | { ok: false; error: GitError }

async function post<T>(path: string, payload: unknown): Promise<Envelope<T>> {
  let response: Response
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    return { ok: false, error: { code: 'internal', message: 'git route unavailable' } }
  }
  try {
    return (await response.json()) as Envelope<T>
  } catch {
    return { ok: false, error: { code: 'internal', message: `bad response (HTTP ${response.status})` } }
  }
}

/** 浏览器端的 git 面板 API。 */
export class GitPanelApi {
  /** 轻量接口：仅获取当前分支（用于 chip 标签）。 */
  current(path: string) {
    return post<{ repo: string; current: string }>('/git-panel/current', { path })
  }

  branches(path: string) {
    return post<BranchesView>('/git-panel/branches', { path })
  }

  graph(path: string) {
    return post<GraphView>('/git-panel/graph', { path })
  }

  switchBranch(path: string, branch: string) {
    return post<OpResult>('/git-panel/switch', { path, branch })
  }

  pull(path: string) {
    return post<OpResult>('/git-panel/pull', { path })
  }

  fetchAll(path: string) {
    return post<OpResult>('/git-panel/fetch', { path })
  }

  renameBranch(path: string, branch: string, newName: string) {
    return post<OpResult>('/git-panel/rename', { path, branch, newName })
  }

  deleteBranch(path: string, branch: string) {
    return post<OpResult>('/git-panel/delete', { path, branch })
  }

  deleteRemoteBranch(path: string, branch: string) {
    return post<OpResult>('/git-panel/delete-remote', { path, branch })
  }

  mergeBranch(path: string, branch: string) {
    return post<OpResult>('/git-panel/merge', { path, branch })
  }
}
