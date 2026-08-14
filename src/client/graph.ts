/** 提交 DAG 布局：为每个提交分配一条 lane（GitLens/gitk 风格列）。 */

import type { GraphCommit } from '../core/types.ts'

export interface LayoutCommit extends GraphCommit {
  /** 行索引，0 = 最新（顶部）。 */
  row: number
  /** lane 索引（从 0 开始）。 */
  lane: number
}

/**
 * 将提交布局到行与 lane 中。输入是 git log --date-order（最新在前）的顺序。
 * 处理顺序为最旧到最新：一个提交会继承某个引用它的子提交所在的 lane；否则
 * 它会占用一个空 lane（或新开一个）。
 */
export function layoutGraph(commits: GraphCommit[]): LayoutCommit[] {
  const order = commits.map((commit, index) => ({ commit, index })).reverse() // 最旧在前
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
