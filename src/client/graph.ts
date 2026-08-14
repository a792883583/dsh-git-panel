/** Commit DAG layout: assign each commit a lane (GitLens/gitk-style columns). */

import type { GraphCommit } from '../core/types.ts'

export interface LayoutCommit extends GraphCommit {
  /** Row index, 0 = newest (top). */
  row: number
  /** Lane index (0-based). */
  lane: number
}

/**
 * Lay the commits out into rows and lanes. Input is in git log --date-order
 * (newest first). Processed oldest-first: a commit inherits the lane of a
 * child that references it; otherwise it takes a free lane (or a new one).
 */
export function layoutGraph(commits: GraphCommit[]): LayoutCommit[] {
  const order = commits.map((commit, index) => ({ commit, index })).reverse() // oldest first
  const lanes: Array<string | null> = []
  const placed = new Map<string, LayoutCommit>()

  for (const { commit, index } of order) {
    const row = commits.length - 1 - index
    let lane = lanes.findIndex((owner) => owner !== null && commit.parents.includes(owner))
    if (lane === -1) {
      lane = lanes.findIndex((owner) => owner === null)
      if (lane === -1) {
        lanes.push(null)
        lane = lanes.length - 1
      }
    }
    const layout: LayoutCommit = { ...commit, row, lane }
    placed.set(commit.sha, layout)
    lanes[lane] = commit.sha
  }
  return commits.map((commit) => placed.get(commit.sha)!)
}
