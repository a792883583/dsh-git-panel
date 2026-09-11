/**
 * 资源地址与工作区路径之间的换算。
 *
 * `dsh-resource://file/session/<sessionId>/<seg>/<seg>...` 的后半段是**相对于
 * 工作区根**的路径（与官方 `@deepseek-ai/dsh-client-ui-sidebar-documentpreview`
 * 的 `parseFileAddress` 同一约定），因此绝对路径 = 会话 cwd + 该相对路径。
 * 这里不引入官方包，只保留这一条最小约定，避免客户端耦合到具体版本的实现。
 *
 * @module dsh-git-panel/client/refs
 */

/** 一个工作区文件引用：会话身份 + 工作区相对路径（正斜杠分隔）。 */
export interface FileRef {
  sessionId: string
  /** 工作区相对路径，正斜杠分隔，未做 URL 解码之外的任何改写。 */
  path: string
}

/** 会话文件地址前缀（`dsh-resource://file/`）。 */
const FILE_PREFIX = 'dsh-resource://file/'

/**
 * 解析一个 `file` 资源地址。
 * @param address - 右侧栏打开的完整资源地址。
 * @returns 会话身份与工作区相对路径；不是会话文件地址时返回 undefined。
 */
export function parseFileAddress(address: string): FileRef | undefined {
  if (typeof address !== 'string' || !address.startsWith(FILE_PREFIX)) return undefined
  const cut = address.search(/[?#]/u)
  const rest = address.slice(FILE_PREFIX.length, cut === -1 ? undefined : cut)
  const segments = rest.split('/')
  const scope = segments.shift()
  if (scope !== 'session') return undefined
  const session = segments.shift()
  if (session === undefined || session === '' || segments.length === 0) return undefined
  try {
    return {
      sessionId: decodeURIComponent(session),
      path: segments.map((segment) => decodeURIComponent(segment)).join('/'),
    }
  } catch {
    return undefined
  }
}

/**
 * 拼接工作区绝对路径。
 * @param cwd - 会话工作目录（绝对路径）。
 * @param relative - 工作区相对路径。
 * @returns 规范化后的绝对路径（统一正斜杠）。
 */
export function workspacePath(cwd: string, relative: string): string {
  const base = cwd.replace(/\\/gu, '/').replace(/\/+$/u, '')
  const parts = `${base}/${relative.replace(/\\/gu, '/')}`.split('/')
  const stack: string[] = []
  for (const part of parts) {
    if (part === '' && stack.length > 0) continue
    if (part === '.') continue
    if (part === '..') {
      if (stack.length > 1) stack.pop()
      continue
    }
    stack.push(part)
  }
  return stack.join('/')
}

/**
 * 取路径的显示名。
 * @param path - 任意路径。
 * @returns 最后一个路径段。
 */
export function basenameOf(path: string): string {
  const normalized = path.replace(/\\/gu, '/').replace(/\/+$/u, '')
  const at = normalized.lastIndexOf('/')
  return at === -1 ? normalized : normalized.slice(at + 1)
}
