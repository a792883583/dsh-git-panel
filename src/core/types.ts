/** git 面板共享的封装/错误类型。 */

/** 带稳定错误码的结构化 git 操作错误。 */
export interface GitError {
  code: string
  message: string
}

/** 一条分支记录（本地或远程）。 */
export interface BranchRow {
  /** 短引用名（例如 `main`、`origin/feature/x`）。 */
  name: string
  /** 短对象 id（7 个字符）。 */
  sha: string
  /** 提交者日期，ISO 字符串。 */
  date: string
  /** 最后一次提交的主题（截断）。 */
  subject: string
  /** 是否为当前检出的分支。 */
  current?: boolean
  /** 领先上游的提交数（仅带上游的本地分支）。 */
  ahead?: number
  /** 落后上游的提交数（仅带上游的本地分支）。 */
  behind?: number
}

/** 完整的分支视图。 */
export interface BranchesView {
  /** 相对工作区的仓库显示名（顶层目录的基名）。 */
  repo: string
  /** 当前分支短名（HEAD 游离时为 ''）。 */
  current: string
  local: BranchRow[]
  remote: BranchRow[]
}

/** 图中的单个提交节点。 */
export interface GraphCommit {
  sha: string
  parents: string[]
  author: string
  date: string
  subject: string
}

/** 分支指针映射：短分支名 -> 完整提交 sha。 */
export interface GraphTips {
  [branch: string]: string
}

/** 图视图的载荷。 */
export interface GraphView {
  repo: string
  current: string
  commits: GraphCommit[]
  tips: GraphTips
}

/** 变更性 git 操作的结果。 */
export interface OpResult {
  ok: boolean
  /** 用于展示的截断命令输出。 */
  output: string
  error?: GitError
}

/** 工作区变更清单：路径以工作区根为基准（含未跟踪）。 */
export interface FileStatusView {
  /** 规范化后的工作区根。 */
  workspace: string
  /** 仓库根（git rev-parse --show-toplevel）。 */
  toplevel: string
  /** 有改动的文件与它们的 porcelain 状态码。 */
  entries: Array<{ path: string; code: string }>
}

/** 工作区文件内容读取结果。 */
export interface WorkspaceFileRead {
  ok: boolean
  /** UTF-8 文本；二进制或失败时为空串。 */
  text: string
  /** 文件字节数。 */
  bytes: number
  /** 是否包含 NUL（按二进制处理）。 */
  binary: boolean
  /** 是否因超出上限被截断。 */
  truncated: boolean
  /** 文件不存在（新增/删除场景）。 */
  missing?: boolean
  error?: GitError
}
