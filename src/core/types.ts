/** Shared envelope/error types for the git panel. */

/** A structured git operation error with a stable code. */
export interface GitError {
  code: string
  message: string
}

/** One branch row (local or remote). */
export interface BranchRow {
  /** Short ref name (e.g. `main`, `origin/feature/x`). */
  name: string
  /** Short object id (7 chars). */
  sha: string
  /** Committer date as ISO string. */
  date: string
  /** Last commit subject (truncated). */
  subject: string
  /** Whether this is the checked-out branch. */
  current?: boolean
  /** Ahead of upstream (local branches with an upstream only). */
  ahead?: number
  /** Behind upstream (local branches with an upstream only). */
  behind?: number
}

/** The full branch view. */
export interface BranchesView {
  /** Workspace-relative repo display name (basename of the top level). */
  repo: string
  /** Current branch short name ('' when detached HEAD). */
  current: string
  local: BranchRow[]
  remote: BranchRow[]
}

/** One commit node for the graph. */
export interface GraphCommit {
  sha: string
  parents: string[]
  author: string
  date: string
  subject: string
}

/** Branch tip map: short branch name -> full commit sha. */
export interface GraphTips {
  [branch: string]: string
}

/** The graph view payload. */
export interface GraphView {
  repo: string
  current: string
  commits: GraphCommit[]
  tips: GraphTips
}

/** Result of a mutating git operation. */
export interface OpResult {
  ok: boolean
  /** Truncated command output for display. */
  output: string
  error?: GitError
}
