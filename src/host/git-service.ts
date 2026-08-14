/**
 * Host git service: workspace-gated git operations run through the managed
 * subprocess seam. The browser may only run git on registered workspace
 * roots (the workspace gate is the security boundary of the /git-panel
 * routes).
 * @module dsh-git-panel/host/git-service
 */

import { realpath } from 'node:fs/promises'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-subprocess'
import type { SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess'
import type { BranchesView, BranchRow, GitError, GraphCommit, GraphTips, GraphView, OpResult } from '../core/types.ts'

/** One finished git invocation. */
export interface GitRunResult {
  exitCode: number | null
  stdout: string
  stderr: string
}

/** The spawn seam git runs through (production: the subprocess service). */
export interface GitRunner {
  run(argv: readonly string[], cwd: string): Promise<GitRunResult>
}

/** Collected-output cap for one git command. */
const OUTPUT_CAP_BYTES = 1 << 20

/** Workspace-membership verdict. */
export type WorkspaceVerdict = { ok: true; canonical: string } | { ok: false; error: GitError }

/** Canonicalize a path and require it to equal a registered workspace root. */
export type WorkspaceGate = (path: string) => Promise<WorkspaceVerdict>

/** Production runner over `ctx.subprocess`. */
export function subprocessRunner(ctx: Context): GitRunner {
  return {
    async run(argv, cwd) {
      const spec: SubprocessSpawnSpec = {
        argv: ['git', ...argv],
        cwd,
        stdio: {
          stdin: 'ignore',
          stdout: { maxBytes: OUTPUT_CAP_BYTES },
          stderr: { maxBytes: OUTPUT_CAP_BYTES },
        },
        graceMs: 30_000,
      }
      const handle = ctx.subprocess.spawn(spec)
      const outcome = await handle.done
      const stdout = handle.collected.stdout?.readFrom(0).text ?? ''
      const stderr = handle.collected.stderr?.readFrom(0).text ?? ''
      return { exitCode: outcome.exitCode, stdout, stderr }
    },
  }
}

/**
 * Record/field separators for git --format output. NUL is the conventional
 * choice but Node forbids NUL in spawn argv — the subprocess service rejects
 * it the same way — so records use \x1e and fields \x1f (never produced by
 * git in practice). git appends a newline after every record, so each split
 * record except the first starts with "\n" — stripped in splitRecords.
 */
const REC = '\u001e'
const FIELD = '\u001f'
/** Escape control characters that would corrupt the output (except the separators). */
function sanitize(text: string): string {
  return text.replace(/[\u0000-\u001d\u007f]/g, ' ')
}

/** Split a git --format stream into records, dropping the per-record newline. */
function splitRecords(text: string): string[] {
  return text
    .split(REC)
    .map((record) => (record.startsWith('\n') ? record.slice(1) : record))
    .filter((record) => record !== '')
}

/** The workspace-gated git service. */
export class GitService {
  constructor(
    private readonly runner: GitRunner,
    private readonly gate: WorkspaceGate,
  ) {}

  private async requireWorkspace(path: string): Promise<string> {
    const verdict = await this.gate(path)
    if (!verdict.ok) throw Object.assign(new Error(verdict.error.message), { gitError: verdict.error })
    return verdict.canonical
  }

  /** Resolve the repo display name (basename of the top-level directory). */
  private async repoName(canonical: string): Promise<string> {
    const run = await this.runner.run(['rev-parse', '--show-toplevel'], canonical)
    if (run.exitCode !== 0) return canonical.split(/[\\/]/).pop() ?? canonical
    return run.stdout.trim().split(/[\\/]/).pop() ?? canonical
  }

  /** The current branch short name ('' when detached). */
  async currentBranch(canonical: string): Promise<string> {
    const run = await this.runner.run(['symbolic-ref', '--quiet', '--short', 'HEAD'], canonical)
    return run.exitCode === 0 ? run.stdout.trim() : ''
  }

  /** Lightweight current-branch probe (one or two git calls) for the chip label. */
  async current(path: string): Promise<{ repo: string; current: string }> {
    const canonical = await this.requireWorkspace(path)
    const [repo, current] = await Promise.all([
      this.repoName(canonical),
      this.currentBranch(canonical),
    ])
    return { repo, current }
  }

  /** Branch list with ahead/behind vs upstream. */
  async branches(path: string): Promise<BranchesView> {
    const canonical = await this.requireWorkspace(path)
    const [repo, current] = await Promise.all([
      this.repoName(canonical),
      this.currentBranch(canonical),
    ])

    // One pass over local + remote refs. Full ref names are stripped below
    // (refname:short would erase the heads/remotes distinction).
    const run = await this.runner.run(
      ['for-each-ref', '--format=' + `%(refname)${FIELD}%(objectname:short)${FIELD}%(committerdate:iso8601)${FIELD}%(subject)${FIELD}%(upstream:short)${REC}`, 'refs/heads', 'refs/remotes'],
      canonical,
    )
    if (run.exitCode !== 0) {
      throw Object.assign(
        new Error(run.stderr.trim() || 'not a git repository'),
        { gitError: { code: 'not-a-repo', message: run.stderr.trim() || 'not a git repository' } },
      )
    }
    const local: BranchRow[] = []
    const remote: BranchRow[] = []
    const withUpstream: Array<[BranchRow, string]> = []

    for (const record of splitRecords(run.stdout)) {
      const [ref, sha, date, subject, upstream] = record.split(FIELD)
      if (!ref || !sha) continue
      const isRemote = ref.startsWith('refs/remotes/')
      const name = isRemote ? ref.slice('refs/remotes/'.length) : ref.slice('refs/heads/'.length)
      const row: BranchRow = {
        name: sanitize(name),
        sha: sanitize(sha),
        date: sanitize(date),
        subject: sanitize(subject ?? '').slice(0, 80),
        current: !isRemote && name === current,
      }
      if (isRemote) {
        remote.push(row)
      } else {
        local.push(row)
        if (upstream) withUpstream.push([row, upstream])
      }
    }

    // ahead/behind vs upstream, one git call per tracked local branch.
    await Promise.all(withUpstream.map(async ([row, upstream]) => {
      const count = await this.runner.run(['rev-list', '--left-right', '--count', `${row.name}...${upstream}`], canonical)
      if (count.exitCode !== 0) return
      const [a, b] = count.stdout.trim().split(/\s+/).map(Number)
      row.ahead = Number.isFinite(a) ? a : 0
      row.behind = Number.isFinite(b) ? b : 0
    }))

    const sortRows = (rows: BranchRow[]): BranchRow[] => {
      rows.sort((x, y) => (x.name === current ? -1 : y.name === current ? 1 : x.name.localeCompare(y.name)))
      return rows
    }

    return { repo, current, local: sortRows(local), remote: sortRows(remote) }
  }

  /** Switch to an existing branch (or create a local tracking branch for a remote). */
  async switchBranch(path: string, branch: string): Promise<OpResult> {
    const canonical = await this.requireWorkspace(path)
    const argv: string[] = branch.startsWith('origin/')
      ? ['switch', '-c', branch.slice('origin/'.length), '--track', branch]
      : ['switch', branch]
    const run = await this.runner.run(argv, canonical)
    if (run.exitCode !== 0) {
      return { ok: false, output: run.stdout, error: { code: 'switch-failed', message: run.stderr.trim() || `git switch ${branch} failed` } }
    }
    return { ok: true, output: run.stdout.trim() }
  }

  /** Pull the current branch (uses its upstream). */
  async pull(path: string): Promise<OpResult> {
    const canonical = await this.requireWorkspace(path)
    const run = await this.runner.run(['pull'], canonical)
    if (run.exitCode !== 0) {
      return { ok: false, output: run.stdout, error: { code: 'pull-failed', message: run.stderr.trim() || 'git pull failed' } }
    }
    return { ok: true, output: run.stdout.trim() }
  }

  /** Fetch all remotes with prune. */
  async fetchAll(path: string): Promise<OpResult> {
    const canonical = await this.requireWorkspace(path)
    const run = await this.runner.run(['fetch', '--all', '--prune'], canonical)
    if (run.exitCode !== 0) {
      return { ok: false, output: run.stdout, error: { code: 'fetch-failed', message: run.stderr.trim() || 'git fetch failed' } }
    }
    return { ok: true, output: run.stdout.trim() }
  }

  /** Rename a local branch (git branch -m). */
  async renameBranch(path: string, from: string, to: string): Promise<OpResult> {
    const canonical = await this.requireWorkspace(path)
    const run = await this.runner.run(['branch', '-m', from, to], canonical)
    if (run.exitCode !== 0) {
      return { ok: false, output: run.stdout, error: { code: 'rename-failed', message: run.stderr.trim() || 'git branch -m failed' } }
    }
    return { ok: true, output: run.stdout.trim() }
  }

  /** Force-delete a local branch (git branch -D). */
  async deleteBranch(path: string, branch: string): Promise<OpResult> {
    const canonical = await this.requireWorkspace(path)
    const run = await this.runner.run(['branch', '-D', branch], canonical)
    if (run.exitCode !== 0) {
      return { ok: false, output: run.stdout, error: { code: 'delete-failed', message: run.stderr.trim() || 'git branch -D failed' } }
    }
    return { ok: true, output: run.stdout.trim() }
  }

  /** Delete a remote branch (git push <remote> --delete <name>). */
  async deleteRemoteBranch(path: string, branch: string): Promise<OpResult> {
    const canonical = await this.requireWorkspace(path)
    const slash = branch.indexOf('/')
    if (slash <= 0 || slash === branch.length - 1) {
      return { ok: false, output: '', error: { code: 'bad-branch', message: `invalid remote branch: ${branch}` } }
    }
    const remote = branch.slice(0, slash)
    const name = branch.slice(slash + 1)
    const run = await this.runner.run(['push', remote, '--delete', name], canonical)
    if (run.exitCode !== 0) {
      return { ok: false, output: run.stdout, error: { code: 'delete-failed', message: run.stderr.trim() || 'git push --delete failed' } }
    }
    return { ok: true, output: run.stdout.trim() }
  }

  /** Merge a branch into the current branch (git merge --no-edit). */
  async mergeBranch(path: string, branch: string): Promise<OpResult> {
    const canonical = await this.requireWorkspace(path)
    const run = await this.runner.run(['merge', '--no-edit', branch], canonical)
    if (run.exitCode !== 0) {
      return { ok: false, output: run.stdout, error: { code: 'merge-failed', message: run.stderr.trim() || 'git merge failed' } }
    }
    return { ok: true, output: run.stdout.trim() }
  }

  /** Commit DAG for the graph view (all refs, date order, capped). */
  async graph(path: string): Promise<GraphView> {
    const canonical = await this.requireWorkspace(path)
    const [repo, current, logRun, tipRun] = await Promise.all([
      this.repoName(canonical),
      this.currentBranch(canonical),
      this.runner.run(
        ['log', '--all', '--date-order', '--max-count=300',
          '--pretty=format:' + `%H${FIELD}%P${FIELD}%an${FIELD}%ai${FIELD}%s${REC}`],
        canonical,
      ),
      this.runner.run(
        ['for-each-ref', '--format=' + `%(refname:short)${FIELD}%(objectname)${REC}`, 'refs/heads', 'refs/remotes'],
        canonical,
      ),
    ])

    const commits: GraphCommit[] = []
    const seen = new Set<string>()
    if (logRun.exitCode !== 0) {
      throw Object.assign(
        new Error(logRun.stderr.trim() || 'not a git repository'),
        { gitError: { code: 'not-a-repo', message: logRun.stderr.trim() || 'not a git repository' } },
      )
    }
    for (const record of splitRecords(logRun.stdout)) {
      const [sha, parents, author, date, subject] = record.split(FIELD)
      if (!sha || seen.has(sha)) continue
      seen.add(sha)
      commits.push({
        sha,
        parents: parents ? parents.split(' ') : [],
        author: sanitize(author ?? ''),
        date: sanitize(date ?? ''),
        subject: sanitize(subject ?? '').slice(0, 100),
      })
    }

    const tips: GraphTips = {}
    for (const record of splitRecords(tipRun.stdout)) {
      const [name, sha] = record.split(FIELD)
      if (name && sha) tips[name] = sha
    }

    return { repo, current, commits, tips }
  }
}
