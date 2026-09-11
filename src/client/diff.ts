/**
 * 行级差异计算：把「HEAD 版本」与「工作区版本」对齐成可并排渲染的行。
 *
 * 算法是经典的 LCS 编辑脚本，再按 VS Code 的习惯把相邻的删除/新增段配对成
 * 同一行（左删右增），因此左右两栏行号严格对齐、没有错位。为控制内存，先裁掉
 * 公共前后缀；中段规模超过上限时退化为「顺序配对」，仍然给出可读的对照。
 *
 * @module dsh-git-panel/client/diff
 */

/** 并排渲染的一行。 */
export interface DiffRow {
  kind: 'equal' | 'change' | 'del' | 'ins'
  /** 左栏（HEAD）内容；为空表示该行在左栏不存在。 */
  left?: { num: number; text: string }
  /** 右栏（工作区）内容；为空表示该行在右栏不存在。 */
  right?: { num: number; text: string }
}

/** 编辑脚本的一步：保留、删除、插入。 */
interface Op {
  kind: 'equal' | 'del' | 'ins'
  /** 左栏（before）行下标。 */
  left?: number
  /** 右栏（after）行下标。 */
  right?: number
}

/** LCS 动态规划的规模上限（n*m），超过则退化为顺序配对。 */
const LCS_CELL_CAP = 4_000_000

/**
 * 拆行：统一换行符。
 * @param text - 任意文本。
 * @returns 行数组；空文本得到空数组。
 */
export function splitLines(text: string): string[] {
  if (text === '') return []
  return text.replace(/\r\n?/gu, '\n').split('\n')
}

/**
 * 计算两个文本的行级差异。
 * @param before - 基准文本（HEAD）。
 * @param after - 对照文本（工作区）。
 * @returns 对齐后的行；左右两栏各自连续编号。
 */
export function diffRows(before: string, after: string): DiffRow[] {
  const left = splitLines(before)
  const right = splitLines(after)

  // 1. 公共前缀：直接判等，省掉绝大部分 DP 规模。
  let head = 0
  while (head < left.length && head < right.length && left[head] === right[head]) head += 1
  // 2. 公共后缀。
  let tail = 0
  while (
    tail < left.length - head
    && tail < right.length - head
    && left[left.length - 1 - tail] === right[right.length - 1 - tail]
  ) tail += 1

  const rows: DiffRow[] = []
  for (let index = 0; index < head; index += 1) {
    rows.push({
      kind: 'equal',
      left: { num: index + 1, text: left[index] ?? '' },
      right: { num: index + 1, text: right[index] ?? '' },
    })
  }

  const leftMiddle = left.slice(head, left.length - tail)
  const rightMiddle = right.slice(head, right.length - tail)
  rows.push(...middleRows(leftMiddle, rightMiddle, head))

  for (let index = 0; index < tail; index += 1) {
    const leftNum = left.length - tail + index + 1
    const rightNum = right.length - tail + index + 1
    rows.push({
      kind: 'equal',
      left: { num: leftNum, text: left[leftNum - 1] ?? '' },
      right: { num: rightNum, text: right[rightNum - 1] ?? '' },
    })
  }
  return rows
}

/** 中段的差异行（`offset` 是左栏已消费的公共前缀行数）。 */
function middleRows(left: string[], right: string[], offset: number): DiffRow[] {
  if (left.length === 0 && right.length === 0) return []
  if (left.length === 0) {
    return right.map((text, index) => ({ kind: 'ins' as const, right: { num: offset + index + 1, text } }))
  }
  if (right.length === 0) {
    return left.map((text, index) => ({ kind: 'del' as const, left: { num: offset + index + 1, text } }))
  }
  const script = left.length * right.length <= LCS_CELL_CAP
    ? lcsScript(left, right)
    : pairedScript(left, right)

  // 把「连续删除 + 连续新增」配对到同一行，形成 VS Code 风格的对照。
  const rows: DiffRow[] = []
  let index = 0
  while (index < script.length) {
    const step = script[index]
    if (step === undefined) break
    if (step.kind === 'equal') {
      const leftLine = step.left ?? 0
      const rightLine = step.right ?? 0
      rows.push({
        kind: 'equal',
        left: { num: offset + leftLine + 1, text: left[leftLine] ?? '' },
        right: { num: offset + rightLine + 1, text: right[rightLine] ?? '' },
      })
      index += 1
      continue
    }
    const dels: Op[] = []
    const inss: Op[] = []
    while (index < script.length && script[index]?.kind === 'del') {
      dels.push(script[index] as Op)
      index += 1
    }
    while (index < script.length && script[index]?.kind === 'ins') {
      inss.push(script[index] as Op)
      index += 1
    }
    const span = Math.max(dels.length, inss.length)
    for (let at = 0; at < span; at += 1) {
      const del = dels[at]
      const ins = inss[at]
      const leftLine = del?.left
      const rightLine = ins?.right
      rows.push({
        kind: leftLine !== undefined && rightLine !== undefined ? 'change' : leftLine !== undefined ? 'del' : 'ins',
        ...(leftLine === undefined ? {} : { left: { num: offset + leftLine + 1, text: left[leftLine] ?? '' } }),
        ...(rightLine === undefined ? {} : { right: { num: offset + rightLine + 1, text: right[rightLine] ?? '' } }),
      })
    }
  }
  return rows
}

/** LCS 动态规划（中段规模受控时使用）。 */
function lcsScript(left: string[], right: string[]): Op[] {
  const rows = left.length
  const columns = right.length
  const width = columns + 1
  const table = new Int32Array((rows + 1) * width)
  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = columns - 1; j >= 0; j -= 1) {
      table[i * width + j] = left[i] === right[j]
        ? (table[(i + 1) * width + j + 1] ?? 0) + 1
        : Math.max(table[(i + 1) * width + j] ?? 0, table[i * width + j + 1] ?? 0)
    }
  }
  const script: Op[] = []
  let i = 0
  let j = 0
  while (i < rows && j < columns) {
    if (left[i] === right[j]) {
      script.push({ kind: 'equal', left: i, right: j })
      i += 1
      j += 1
    } else if ((table[(i + 1) * width + j] ?? 0) >= (table[i * width + j + 1] ?? 0)) {
      script.push({ kind: 'del', left: i })
      i += 1
    } else {
      script.push({ kind: 'ins', right: j })
      j += 1
    }
  }
  while (i < rows) {
    script.push({ kind: 'del', left: i })
    i += 1
  }
  while (j < columns) {
    script.push({ kind: 'ins', right: j })
    j += 1
  }
  return script
}

/**
 * 超大中段的退化脚本：逐行对齐地判等，其余先删后增。
 * 大文件下这仍然给出正确的增删统计与可读的左右对照。
 */
function pairedScript(left: string[], right: string[]): Op[] {
  const script: Op[] = []
  let i = 0
  let j = 0
  while (i < left.length || j < right.length) {
    if (i < left.length && j < right.length && left[i] === right[j]) {
      script.push({ kind: 'equal', left: i, right: j })
      i += 1
      j += 1
      continue
    }
    if (i < left.length) {
      script.push({ kind: 'del', left: i })
      i += 1
    }
    if (j < right.length) {
      script.push({ kind: 'ins', right: j })
      j += 1
    }
  }
  return script
}

/**
 * 统计增删行数。
 * @param rows - 已对齐的差异行。
 * @returns 新增与删除的行数。
 */
export function diffStat(rows: readonly DiffRow[]): { added: number; removed: number } {
  let added = 0
  let removed = 0
  for (const row of rows) {
    if (row.kind === 'equal') continue
    if (row.right !== undefined) added += 1
    if (row.left !== undefined) removed += 1
  }
  return { added, removed }
}
