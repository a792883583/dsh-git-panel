/**
 * git 面板的 React 界面：分支列表（本地/远程，含 ahead/behind，
 * 可切换/拉取/抓取）以及带 lane 的 GitLens 风格提交图谱。
 * @module dsh-git-panel/client/Panel
 */

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { BranchesView, BranchRow, GraphView, OpResult } from '../core/types.ts'
import type { Envelope, GitPanelApi } from './api.ts'
import { layoutGraph, type LayoutCommit } from './graph.ts'
import { useT } from './i18n.ts'

const STYLE = `
.dsh-gp { --bg:#ffffff; --fg:#24292f; --muted:#6e7781; --border:rgba(128,128,128,0.25);
  --accent:#1976d2; --hover:rgba(0,0,0,0.05); --current:#1a7f37; --danger:#cf222e;
  --panel-bg:#f6f8fa; color:var(--fg); background:var(--bg);
  --dsh-gp-lane-0:#1565c0; --dsh-gp-lane-1:#c62828; --dsh-gp-lane-2:#2e7d32; --dsh-gp-lane-3:#6a1b9a;
  --dsh-gp-lane-4:#00838f; --dsh-gp-lane-5:#e65100; --dsh-gp-lane-6:#4527a0; --dsh-gp-lane-7:#558b2f;
  --dsh-gp-lane-8:#ad1457; --dsh-gp-lane-9:#0277bd; --dsh-gp-lane-10:#ef6c00; --dsh-gp-lane-11:#00695c;
  display:flex; flex-direction:column; height:100%; font-size:13px; }
[data-ds-dark-theme] .dsh-gp { --bg:#1f2328; --fg:#d1d9e0; --muted:#9198a1;
  --border:rgba(255,255,255,0.14); --accent:#58a6ff; --hover:rgba(255,255,255,0.07);
  --current:#3fb950; --danger:#f85149; --panel-bg:#161b22;
  --dsh-gp-lane-0:#58a6ff; --dsh-gp-lane-1:#ff7b72; --dsh-gp-lane-2:#3fb950; --dsh-gp-lane-3:#bc8cff;
  --dsh-gp-lane-4:#39c5cf; --dsh-gp-lane-5:#f0883e; --dsh-gp-lane-6:#a371f7; --dsh-gp-lane-7:#7ee787;
  --dsh-gp-lane-8:#ffa198; --dsh-gp-lane-9:#76e3ea; --dsh-gp-lane-10:#e3b341; --dsh-gp-lane-11:#56d364; }
.dsh-gp * { box-sizing:border-box; }
.dsh-gp-head { display:flex; align-items:center; gap:6px; padding:8px 10px;
  border-bottom:1px solid var(--border); font-weight:600; }
.dsh-gp-head .spacer { flex:1; }
.dsh-gp-btn { border:1px solid var(--border); background:transparent; color:var(--fg);
  border-radius:4px; padding:2px 8px; font-size:11px; cursor:pointer; }
.dsh-gp-btn:hover { background:var(--hover); }
.dsh-gp-btn:disabled { opacity:0.5; cursor:default; }
.dsh-gp-tabs { display:flex; border-bottom:1px solid var(--border); }
.dsh-gp-tab { flex:1; text-align:center; padding:6px 0; cursor:pointer; color:var(--muted); }
.dsh-gp-tab.active { color:var(--accent); border-bottom:2px solid var(--accent); font-weight:600; }
.dsh-gp-body { flex:1; overflow:auto; padding:4px 0; }
.dsh-gp-section { padding:8px 10px 4px; color:var(--muted); font-size:12px; font-weight:600;
  text-transform:uppercase; letter-spacing:0.4px; }
.dsh-gp-row { display:flex; align-items:center; gap:6px; padding:7px 10px; cursor:pointer; }
.dsh-gp-row:hover { background:var(--hover); }
.dsh-gp-row .name { font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.dsh-gp-row .meta { color:var(--muted); font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.dsh-gp-row .spacer { flex:1; }
.dsh-gp-badge { font-size:11px; padding:1px 6px; border-radius:8px; background:var(--panel-bg); color:var(--muted); white-space:nowrap; }
.dsh-gp-badge.current { background:var(--current); color:#fff; }
.dsh-gp-badge.ahead { color:var(--current); }
.dsh-gp-badge.behind { color:var(--accent); }
.dsh-gp-msg { margin:6px 10px; padding:6px 8px; border-radius:4px; font-size:11px;
  background:var(--panel-bg); white-space:pre-wrap; word-break:break-all; }
.dsh-gp-msg.err { border:1px solid var(--danger); color:var(--danger); }
.dsh-gp-msg.ok { border:1px solid var(--current); color:var(--current); }
.dsh-gp-menu-backdrop { position:fixed; inset:0; z-index:950; }
.dsh-gp-menu { position:fixed; z-index:951; min-width:170px; padding:4px;
  background:var(--panel-bg); border:1px solid var(--border); border-radius:8px;
  box-shadow:0 8px 24px rgba(0,0,0,0.18); font-size:12px; }
.dsh-gp-menu-item { padding:6px 10px; border-radius:6px; cursor:pointer; color:var(--fg); white-space:nowrap; }
.dsh-gp-menu-item:hover { background:var(--hover); }
.dsh-gp-menu-item.danger { color:var(--danger); }
.dsh-gp-menu-title { padding:4px 10px 8px; color:var(--muted); font-size:11px; }
.dsh-gp-menu-input { width:100%; box-sizing:border-box; padding:5px 8px; margin-bottom:6px;
  font-size:12px; color:var(--fg); background:var(--bg);
  border:1px solid var(--border); border-radius:6px; outline:none; }
.dsh-gp-menu-input:focus { border-color:var(--accent); }
.dsh-gp-menu-actions { display:flex; gap:6px; padding:2px 2px 4px; }
.dsh-gp-menu-actions .dsh-gp-btn { flex:1; }
.dsh-gp-empty { padding:20px 10px; text-align:center; color:var(--muted); }
.dsh-gp-warn { flex:1; display:flex; align-items:center; justify-content:center;
  padding:24px; text-align:center; color:#9a6700; font-size:12px; line-height:1.7; }
[data-ds-dark-theme] .dsh-gp-warn { color:#d4a72c; }
.dsh-gp-detail { border-top:1px solid var(--border); padding:6px 10px; font-size:11px;
  background:var(--panel-bg); max-height:96px; overflow:auto; }
.dsh-gp-col-resize { position:absolute; top:0; height:28px; cursor:col-resize; touch-action:none; z-index:5; }
.dsh-gp-col-resize::after { content:''; position:absolute; left:2.5px; top:6px; bottom:6px;
  width:1px; background:var(--border); opacity:0.7; }
.dsh-gp-col-resize:hover::after, .dsh-gp-col-resize:active::after { background:var(--accent); opacity:1; }
`

let styleInjected = false
function ensureStyle(): void {
  if (styleInjected) return
  styleInjected = true
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-git-panel'
  tag.textContent = STYLE
  document.head.appendChild(tag)
}

/** GitLens 风格的分支行：双击激活，右键打开菜单。 */
const BranchRowView = memo(function BranchRowView(props: {
  row: BranchRow
  isRemote: boolean
  current?: string
  busy: boolean
  onActivate: (branch: string) => void
  onContextMenu: (event: React.MouseEvent, row: BranchRow, isRemote: boolean) => void
}): React.ReactElement {
  const { row, isRemote, current, busy, onActivate, onContextMenu } = props
  const t = useT()
  const isCurrent = !isRemote && row.name === current
  const badges = [
    !isRemote && row.ahead ? <span key="a" className="dsh-gp-badge ahead">↑{row.ahead}</span> : null,
    !isRemote && row.behind ? <span key="b" className="dsh-gp-badge behind">↓{row.behind}</span> : null,
    isCurrent ? <span key="c" className="dsh-gp-badge current">{t('badge.current')}</span> : null,
  ]
  return (
    <div
      className="dsh-gp-row"
      title={isRemote ? t('row.title.checkout') : isCurrent ? t('row.title.pull') : t('row.title.switch')}
      onDoubleClick={() => {
        if (busy) return
        onActivate(row.name)
      }}
      onContextMenu={(event) => {
        event.preventDefault()
        onContextMenu(event, row, isRemote)
      }}
    >
      <span className="name">{row.name}</span>
      {badges}
      <span className="meta">
        {row.date ? row.date.slice(5, 16).replace('T', ' ') : ''} {row.subject}
      </span>
    </div>
  )
})

/** 共享的图谱几何与文本度量（模块级：稳定的引用）。 */
const ROW_HEIGHT = 24
const LANE_WIDTH = 14
const NODE_RADIUS = 4
const PAD_LEFT = 10
const PAD_TOP = 10
const LANE_COLOR_COUNT = 12

/** 在视口上下额外渲染的行数，保证快速滚动时不闪烁。 */
const GRAPH_BUFFER_ROWS = 10

const laneColor = (lane: number): string => `var(--dsh-gp-lane-${lane % LANE_COLOR_COUNT})`

/** 文本的近似渲染宽度（CJK 字符约为 ASCII 字符的 2 倍）。 */
const labelWidth = (text: string): number =>
  [...text].reduce((w, ch) => w + (ch.charCodeAt(0) > 255 ? 12 : 6.5), 0)

const fitByWidth = (text: string, maxWidth: number): string => {
  let w = 0
  for (let i = 0; i < text.length; i += 1) {
    w += text.charCodeAt(i) > 255 ? 12 : 6.5
    if (w > maxWidth) return `${text.slice(0, i)}…`
  }
  return text
}

/**
 * 图谱标签页的 SVG 主体，按其几何信息做 memo：点击某个节点只更新详情条，
 * 因此 300 个提交的 DOM 在点击时不会重建。被截断的文本按每列的宽度缓存，
 * 因此重渲染时不会逐字符重新遍历每个 subject。只渲染可见视口内（±一个缓冲
 * 区）的行；SVG 保持完整高度，这样滚动条始终正确。
 */
const GraphSvg = memo(function GraphSvg(props: {
  layout: LayoutCommit[]
  graph: GraphView
  textX: number
  commitWidth: number
  labelZone: number
  graphWidth: number
  height: number
  onSelect: (commit: LayoutCommit) => void
}): React.ReactElement {
  const { layout, graph, textX, commitWidth, labelZone, graphWidth, height, onSelect } = props
  const rootRef = useRef<SVGSVGElement>(null)  // 可见行的窗口；Infinity = "尚未测量"（渲染全部内容，
  // 直到 layout effect 测量出真实视口）。
  const [viewport, setViewport] = useState({ first: 0, last: Infinity })

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const scroller = root.closest<HTMLElement>('.dsh-gp-body')
    if (!scroller) return
    const measure = (): void => {
      const rect = root.getBoundingClientRect()
      const srect = scroller.getBoundingClientRect()
      // 用 SVG 自身的坐标空间表示的视口顶部/底部。
      // getBoundingClientRect 已经计入了滚动——这里再加 scrollTop 会让窗口
      // 随用户滚动向下漂移，使图谱下方变空白。
      const v0 = srect.top - rect.top
      const v1 = v0 + scroller.clientHeight
      const first = Math.max(0, Math.floor((v0 - PAD_TOP) / ROW_HEIGHT) - GRAPH_BUFFER_ROWS)
      const last = Math.min(layout.length - 1, Math.ceil((v1 - PAD_TOP) / ROW_HEIGHT) + GRAPH_BUFFER_ROWS)
      setViewport((prev) => (prev.first === first && prev.last === last ? prev : { first, last }))
    }
    measure()
    let raf = 0
    const onScroll = (): void => {
      if (raf !== 0) return
      raf = requestAnimationFrame(() => {
        raf = 0
        measure()
      })
    }
    scroller.addEventListener('scroll', onScroll, { passive: true })
    const ro = new ResizeObserver(onScroll)
    ro.observe(scroller)
    return () => {
      scroller.removeEventListener('scroll', onScroll)
      ro.disconnect()
      if (raf !== 0) cancelAnimationFrame(raf)
    }
  }, [layout])

  const bySha = useMemo(() => {
    const map = new Map<string, LayoutCommit>()
    for (const c of layout) map.set(c.sha, c)
    return map
  }, [layout])

  const xOf = (lane: number): number => PAD_LEFT + lane * LANE_WIDTH
  const yOf = (row: number): number => PAD_TOP + row * ROW_HEIGHT

  const tipBranches = useMemo(
    () => Object.entries(graph.tips).filter(([, sha]) => bySha.has(sha)),
    [graph.tips, bySha],
  )
  // 每行一个标签：优先当前分支，然后按名称取第一个。指向同一提交的本地 +
  // 远程分支否则都会堆叠在同一个 y 处。
  const tipLabelByRow = useMemo(() => {
    const byRow = new Map<number, string>()
    const sorted = [...tipBranches].sort(([a], [b]) => {
      const aCur = a === graph.current ? 0 : 1
      const bCur = b === graph.current ? 0 : 1
      return aCur - bCur || a.localeCompare(b)
    })
    for (const [branch, sha] of sorted) {
      const commit = bySha.get(sha)
      if (!commit) continue
      const key = commit.row
      if (!byRow.has(key)) byRow.set(key, branch)
    }
    return byRow
  }, [tipBranches, bySha, graph.current])

  // 缓存截断结果：仅在列宽真正变化时重新计算。
  const subjects = useMemo(
    () => new Map(layout.map((c) => [c.sha, fitByWidth(c.subject, commitWidth - 2)])),
    [layout, commitWidth],
  )
  const tipTexts = useMemo(
    () => new Map([...tipLabelByRow.entries()].map(([row, b]) => [row, fitByWidth(b, labelZone - 6)])),
    [tipLabelByRow, labelZone],
  )

  const isTipCommit = (commit: LayoutCommit): boolean =>
    tipBranches.some(([, sha]) => sha === commit.sha)
  const nodeFill = (commit: LayoutCommit): string => {
    const isCurrentTip = tipBranches.some(([branch, sha]) => sha === commit.sha && branch === graph.current)
    return isCurrentTip ? 'var(--current)' : laneColor(commit.lane)
  }

  const last = Math.min(viewport.last, layout.length - 1)
  const inWindow = (row: number): boolean => row >= viewport.first && row <= last

  const edges: React.ReactElement[] = []
  const nodes: React.ReactElement[] = []
  layout.forEach((commit) => {
    const parents = commit.parents
      .map((parentSha) => bySha.get(parentSha))
      .filter((parent): parent is LayoutCommit => parent !== undefined)
    // 当任一端位于窗口内时就绘制边，这样跨越视口顶部/底部边缘的连线保持连续。
    const drawEdges = inWindow(commit.row) || parents.some((parent) => inWindow(parent.row))
    if (!drawEdges) return
    const x = xOf(commit.lane)
    const y = yOf(commit.row)
    const color = laneColor(commit.lane)
    parents.forEach((parent) => {
      const px = xOf(parent.lane)
      const py = yOf(parent.row)
      if (parent.lane === commit.lane) {
        edges.push(
          <line key={`e-${commit.sha}-${parent.sha}`} x1={x} y1={y} x2={px} y2={py}
            stroke={color} strokeWidth="1.2" opacity="0.85" />,
        )
      } else {
        // GitLens 风格的绕行路径：从子提交 VERTICALLY 离开，在水平方向中途
        // 横扫，再 VERTICALLY 进入父提交。控制点与端点垂直对齐，因此两个
        // 切线都是垂直的。
        const dy = Math.min(12, (py - y) / 2)
        const d = `M ${x} ${y} C ${x} ${y + dy}, ${px} ${py - dy}, ${px} ${py}`
        edges.push(
          <path key={`e-${commit.sha}-${parent.sha}`} d={d} fill="none"
            stroke={color} strokeWidth="1.2" opacity="0.85" />,
        )
      }
    })
    if (!inWindow(commit.row)) return
    nodes.push(
      <g key={`n-${commit.sha}`} onClick={() => onSelect(commit)}>
        <circle cx={x} cy={y} r={NODE_RADIUS + 2} fill="transparent" />
        <circle
          cx={x} cy={y} r={NODE_RADIUS}
          fill={nodeFill(commit)}
          stroke={isTipCommit(commit) ? 'var(--bg)' : 'none'}
          strokeWidth={isTipCommit(commit) ? 1.5 : 0}
        />
        <text x={textX} y={y + 3.5} fontSize="12" fill="var(--fg)" style={{ pointerEvents: 'none' }}>
          {subjects.get(commit.sha) ?? commit.subject}
        </text>
      </g>,
    )
  })

  return (
    <svg ref={rootRef} width={graphWidth} height={height} style={{ display: 'block', cursor: 'default' }}>
      {edges}
      {nodes}
      {[...tipLabelByRow.entries()]
        .filter(([row]) => inWindow(row))
        .map(([row, branch]) => {
          const isCurrent = branch === graph.current
          return (
            <text
              key={`tip-${row}`}
              x={graphWidth - 4}
              y={yOf(row) + 4}
              fontSize="11"
              textAnchor="end"
              fontWeight={isCurrent ? 700 : 400}
              fill={isCurrent ? 'var(--current)' : 'var(--muted)'}
            >
              {tipTexts.get(row) ?? branch}
            </text>
          )
        })}
    </svg>
  )
})

/** 提交图谱标签页（memoized：其 props 只在加载/缩放时变化）。 */
const GraphViewComponent = memo(function GraphViewComponent(props: { graph: GraphView; width: number }): React.ReactElement {
  const { graph, width } = props
  const t = useT()
  const [selected, setSelected] = useState<LayoutCommit | null>(null)
  const layout = useMemo(() => layoutGraph(graph.commits), [graph])
  const onSelect = useCallback((commit: LayoutCommit) => setSelected(commit), [])

  const lanes = Math.max(1, ...layout.map((c) => c.lane + 1))
  // 固定 lane 区域的右边缘；提交列在其后开始（见下方 gapOverride 中用户可调
  // 的间隔）。
  const laneRight = PAD_LEFT + lanes * LANE_WIDTH
  const height = PAD_TOP + layout.length * ROW_HEIGHT + 12

  // 三个彼此独立缩放的列：lane（固定宽度）、提交 subject、分支标签。提交列
  // 与分支列各有自己的整列高可拖拽分隔线，因此缩放其一不会影响另一个。
  // 宽度写入 localStorage；0 表示"按最宽的文本自动调整大小"。
  const readSaved = (key: string): number => {
    try {
      const saved = Number(localStorage.getItem(key))
      return Number.isFinite(saved) && saved >= 40 ? saved : 0
    } catch {
      return 0
    }
  }
  const [commitOverride, setCommitOverride] = useState<number>(() => readSaved('dsh-gp-graph-col-commit'))
  const commitRef = useRef(commitOverride)
  useEffect(() => {
    commitRef.current = commitOverride
  }, [commitOverride])

  // 用户在 lane 区域与提交列之间可调的间隔：左侧的标题分隔线会移动提交列的
  // 左边缘，因此它的宽度改变而右边缘保持不变。默认 14px。
  const [gapOverride, setGapOverride] = useState<number>(() => readSaved('dsh-gp-graph-col-gap'))
  const gapRef = useRef(gapOverride)
  useEffect(() => {
    gapRef.current = gapOverride
  }, [gapOverride])
  const gap = gapOverride > 0 ? gapOverride : 14
  const textX = laneRight + gap

  // 分支列有固定且较宽的宽度（不可缩放）；只有提交列是用户可调的。图谱会随
  // 提交列 GROW——加宽它会让整个图谱变宽，面板随之水平滚动，因此分支列保持
  // 自己的宽度。
  const BRANCH_COL_WIDTH = 240
  const maxSubjectWidth = Math.max(0, ...layout.map((c) => labelWidth(c.subject)))
  const autoCommit = Math.max(60, maxSubjectWidth + 16)
  const commitWidth = commitOverride > 0 ? commitOverride : autoCommit
  const labelZone = BRANCH_COL_WIDTH
  const commitRight = textX + commitWidth
  const graphWidth = Math.max(width - 16, commitRight + labelZone + 8)
  const labelLeft = graphWidth - labelZone

  const startResize = (
    key: string,
    valueRef: React.MutableRefObject<number>,
    set: (v: number) => void,
    start: number,
    min: number,
    max: number,
  ): ((event: React.PointerEvent) => void) => (event) => {
    event.preventDefault()
    event.stopPropagation()
    const startClientX = event.clientX
    const onMove = (ev: PointerEvent): void => {
      set(Math.min(max, Math.max(min, start + (ev.clientX - startClientX))))
    }
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      try {
        localStorage.setItem(key, String(valueRef.current))
      } catch {
        /* 存储不可用——保留内存中的值 */
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }
  const resetResize = (key: string, set: (v: number) => void): (() => void) => () => {
    set(0)
    try {
      localStorage.removeItem(key)
    } catch {
      /* 忽略 */
    }
  }
  // 拖拽标题栏分隔线只会移动提交列；分支列是固定的。上限很宽松：多余的宽度
  // 只是让图谱水平滚动而已。
  const startCommitResize = startResize('dsh-gp-graph-col-commit', commitRef, setCommitOverride, commitWidth, 60, 900)
  // 左侧分隔线移动提交列的 LEFT 边缘：它的宽度变化而右边缘固定。
  const startLeftResize = (event: React.PointerEvent): void => {
    event.preventDefault()
    event.stopPropagation()
    const startClientX = event.clientX
    const startCommitRight = commitRight
    const startGap = gap
    const onMove = (ev: PointerEvent): void => {
      const maxGap = Math.max(4, startCommitRight - laneRight - 60)
      const minGap = Math.max(4, startCommitRight - laneRight - 900)
      const next = Math.min(maxGap, Math.max(minGap, startGap + (ev.clientX - startClientX)))
      setGapOverride(next)
      setCommitOverride(startCommitRight - (laneRight + next))
    }
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      try {
        localStorage.setItem('dsh-gp-graph-col-gap', String(gapRef.current))
        localStorage.setItem('dsh-gp-graph-col-commit', String(commitRef.current))
      } catch {
        /* 存储不可用——保留内存中的值 */
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div style={{ padding: '0 8px', position: 'relative', width: 'max-content' }}>
      {/* 三列表头，标题在各列起点从左到右排布。两条可拖拽分隔线夹着提交列：
          左侧的移动它的左边缘，右侧的移动它的右边缘。 */}
      <div
        style={{
          position: 'relative',
          width: graphWidth,
          height: 28,
          fontSize: 13,
          color: 'var(--muted)',
          userSelect: 'none',
        }}
      >
        <span style={{ position: 'absolute', left: PAD_LEFT, top: 8, fontWeight: 600 }}>{t('graph.col.lanes')}</span>
        {lanes >= 2 ? (
          <div
            className="dsh-gp-col-resize"
            title={t('graph.col.resize')}
            onPointerDown={startLeftResize}
            onDoubleClick={resetResize('dsh-gp-graph-col-gap', setGapOverride)}
            style={{ left: textX - 10, width: 6 }}
          />
        ) : null}
        <span style={{ position: 'absolute', left: textX, top: 8, fontWeight: 600 }}>{t('graph.col.commit')}</span>
        <div
          className="dsh-gp-col-resize"
          title={t('graph.col.resize')}
          onPointerDown={startCommitResize}
          onDoubleClick={resetResize('dsh-gp-graph-col-commit', setCommitOverride)}
          style={{ left: commitRight - 3, width: 6 }}
        />
        <span style={{ position: 'absolute', left: labelLeft, top: 8, fontWeight: 600 }}>{t('graph.col.branch')}</span>
      </div>
      <GraphSvg
        layout={layout}
        graph={graph}
        textX={textX}
        commitWidth={commitWidth}
        labelZone={labelZone}
        graphWidth={graphWidth}
        height={height}
        onSelect={onSelect}
      />
      {selected ? (
        <div className="dsh-gp-detail">
          <div><b>{selected.subject}</b></div>
          <div>{selected.sha} · {selected.author} · {selected.date}</div>
        </div>
      ) : null}
    </div>
  )
})

/** 完整的面板。 */
export function GitPanel(props: { path: string; api: GitPanelApi }): React.ReactElement {
  const { path, api } = props
  const t = useT()
  const [tab, setTab] = useState<'branches' | 'graph'>('branches')
  const [branches, setBranches] = useState<BranchesView | null>(null)
  const [graph, setGraph] = useState<GraphView | null>(null)
  const [loading, setLoading] = useState(false)
  // 对进行中的加载做单调递增保护（见 load()）。
  const loadSeq = useRef(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null)
  const [width, setWidth] = useState(300)
  // 右键上下文菜单。
  const [menu, setMenu] = useState<{
    x: number
    y: number
    row: BranchRow
    isRemote: boolean
    isCurrent: boolean
  } | null>(null)
  const [menuMode, setMenuMode] = useState<'main' | 'rename' | 'confirm-delete'>('main')
  const [renameValue, setRenameValue] = useState('')

  ensureStyle()

  const load = useCallback(async () => {
    if (!path) return
    // 会话切换：在加载新路径前丢弃上一个仓库的数据，这样一次失败的加载永不
    // 会在屏幕上留下过期的分支。序列号保护会丢弃在新路径再次改变之后才返回的
    // 响应（来自旧会话的在途请求绝不能落地）。
    const seq = ++loadSeq.current
    setLoading(true)
    setBranches(null)
    setGraph(null)
    setMessage(null)
    const [b, g] = await Promise.all([api.branches(path), api.graph(path)])
    if (seq !== loadSeq.current) return
    if (b.ok) setBranches(b.value)
    if (g.ok) setGraph(g.value)
    if (!b.ok) setMessage({ text: b.error.message, kind: 'err' })
    else if (!g.ok) setMessage({ text: g.error.message, kind: 'err' })
    setLoading(false)
  }, [path, api])

  useEffect(() => {
    void load()
  }, [load])

  // 输入 dock 的 chip 会在一次成功的分支切换后派发这个事件。
  useEffect(() => {
    const onSwitched = (): void => {
      void load()
    }
    window.addEventListener('dsh-git-panel:switched', onSwitched)
    return () => window.removeEventListener('dsh-git-panel:switched', onSwitched)
  }, [load])

  useEffect(() => {
    const measure = (): void => setWidth(Math.max(240, (document.querySelector('[data-git-panel-col]')?.clientWidth ?? 300) - 16))
    measure()
    const observer = new ResizeObserver(measure)
    const col = document.querySelector('[data-git-panel-col]')
    if (col) observer.observe(col)
    return () => observer.disconnect()
  }, [])

  if (!path) {
    return (
      <div className="dsh-gp">
        <div className="dsh-gp-head">{t('panel.title')}</div>
        <div className="dsh-gp-empty">{t('panel.empty')}</div>
      </div>
    )
  }

  const runOp = useCallback(async (label: string, op: () => Promise<Envelope<OpResult>>): Promise<void> => {
    setBusy(true)
    setMessage(null)
    const result = await op()
    if (result.ok) {
      setMessage({ text: result.value.output || t('op.done', { label }), kind: 'ok' })
      await load()
    } else {
      setMessage({ text: result.error.message, kind: 'err' })
    }
    setBusy(false)
  }, [load])

  const repoName = branches?.repo ?? ''

  // ---- 上下文菜单操作 ----
  // 稳定的引用，使被 memo 化的 BranchRowView 不会因无关状态变化（message、
  // menu、tab…）而重渲染。
  const openMenu = useCallback((event: React.MouseEvent, row: BranchRow, isRemote: boolean): void => {
    setMenu({
      x: Math.min(event.clientX, window.innerWidth - 190),
      y: Math.min(event.clientY, window.innerHeight - 180),
      row,
      isRemote,
      isCurrent: !isRemote && row.name === branches?.current,
    })
    setMenuMode('main')
    setRenameValue(row.name)
  }, [branches?.current])

  const activateLocal = useCallback((branch: string): void => {
    if (branch === branches?.current) {
      void runOp(t('op.pull'), () => api.pull(path))
    } else {
      void runOp(t('op.switch'), () => api.switchBranch(path, branch))
    }
  }, [branches?.current, runOp, api, path])

  const activateRemote = useCallback((branch: string): void => {
    void runOp(t('op.checkout'), () => api.switchBranch(path, branch))
  }, [runOp, api, path])

  const closeMenu = (): void => setMenu(null)

  const confirmRename = async (): Promise<void> => {
    if (!menu) return
    const name = renameValue.trim()
    if (name === '' || name === menu.row.name) {
      closeMenu()
      return
    }
    // 对 git 引用名做基本合理性检查：不允许空格或 git 禁止的字符。
    if (!/^[^\s~^:?*[\\]+$/.test(name) || name.startsWith('-')) {
      setMessage({ text: t('error.invalidName', { name }), kind: 'err' })
      return
    }
    const current = menu.row.name
    closeMenu()
    await runOp(t('op.rename'), () => api.renameBranch(path, current, name))
  }

  const confirmDelete = async (): Promise<void> => {
    if (!menu) return
    const { row, isRemote } = menu
    closeMenu()
    if (isRemote) {
      await runOp(t('op.deleteRemote'), () => api.deleteRemoteBranch(path, row.name))
    } else {
      await runOp(t('op.delete'), () => api.deleteBranch(path, row.name))
    }
  }

  const mergeInto = async (): Promise<void> => {
    if (!menu) return
    const branch = menu.row.name
    closeMenu()
    await runOp(t('op.merge', { branch }), () => api.mergeBranch(path, branch))
  }

  return (
    <div className="dsh-gp">
      <div className="dsh-gp-head">
        <span>{t('panel.title')}</span>
        <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 11 }}>{repoName}</span>
        <span className="spacer" />
        <button className="dsh-gp-btn" disabled={loading || busy} onClick={() => void load()}>↻</button>
      </div>
      <div className="dsh-gp-tabs">
        <div className={`dsh-gp-tab${tab === 'branches' ? ' active' : ''}`} onClick={() => setTab('branches')}>{t('tab.branches')}</div>
        <div className={`dsh-gp-tab${tab === 'graph' ? ' active' : ''}`} onClick={() => setTab('graph')}>{t('tab.graph')}</div>
      </div>
      <div className="dsh-gp-body">
        {loading && !branches && !graph ? <div className="dsh-gp-empty">{t('loading')}</div> : null}
        {!loading && message && !branches && !graph ? (
          <div className="dsh-gp-warn">{message.text}</div>
        ) : null}
        {message && (branches || graph) ? <div className={`dsh-gp-msg ${message.kind}`}>{message.text}</div> : null}

        {tab === 'branches' && branches ? (
          <>
            <div className="dsh-gp-section">{t('section.local')}</div>
            {branches.local.length === 0 ? <div className="dsh-gp-empty">{t('empty.local')}</div> : null}
            {branches.local.map((row) => (
              <BranchRowView
                key={row.name}
                row={row}
                isRemote={false}
                current={branches.current}
                busy={busy}
                onActivate={activateLocal}
                onContextMenu={openMenu}
              />
            ))}
            <div className="dsh-gp-section">{t('section.remote')}</div>
            {branches.remote.length === 0 ? <div className="dsh-gp-empty">{t('empty.remote')}</div> : null}
            {branches.remote.map((row) => (
              <BranchRowView
                key={row.name}
                row={row}
                isRemote
                current={branches.current}
                busy={busy}
                onActivate={activateRemote}
                onContextMenu={openMenu}
              />
            ))}
            <div style={{ padding: 8 }}>
              <button className="dsh-gp-btn" disabled={busy} onClick={() => void runOp(t('fetch.all'), () => api.fetchAll(path))}>
                {t('fetch.all')}
              </button>
            </div>
          </>
        ) : null}

        {tab === 'graph' && graph ? (
          <GraphViewComponent graph={graph} width={width} />
        ) : null}
      </div>

      {menu ? (
        <>
          <div className="dsh-gp-menu-backdrop" onClick={closeMenu}
            onContextMenu={(event) => { event.preventDefault(); closeMenu() }} />
          <div className="dsh-gp-menu" style={{ left: menu.x, top: menu.y }}>
            {menuMode === 'rename' ? (
              <>
                <div className="dsh-gp-menu-title">{t('menu.title.rename', { name: menu.row.name })}</div>
                <input
                  className="dsh-gp-menu-input"
                  value={renameValue}
                  autoFocus
                  onChange={(event) => setRenameValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void confirmRename()
                    if (event.key === 'Escape') setMenuMode('main')
                  }}
                />
                <div className="dsh-gp-menu-actions">
                  <button className="dsh-gp-btn" onClick={() => void confirmRename()}>{t('menu.confirm')}</button>
                  <button className="dsh-gp-btn" onClick={() => setMenuMode('main')}>{t('menu.cancel')}</button>
                </div>
              </>
            ) : menuMode === 'confirm-delete' ? (
              <>
                <div className="dsh-gp-menu-title">
                  {menu.isRemote
                    ? t('menu.title.deleteRemote', { name: menu.row.name })
                    : t('menu.title.delete', { name: menu.row.name })}
                </div>
                <div className="dsh-gp-menu-actions">
                  <button className="dsh-gp-btn" style={{ color: 'var(--danger)' }}
                    onClick={() => void confirmDelete()}>{t('menu.delete')}</button>
                  <button className="dsh-gp-btn" onClick={() => setMenuMode('main')}>{t('menu.cancel')}</button>
                </div>
              </>
            ) : (
              <>
                <div className="dsh-gp-menu-item" onClick={() => setMenuMode('rename')}>{t('menu.rename')}</div>
                {!menu.isCurrent && !menu.isRemote ? (
                  <div className="dsh-gp-menu-item danger" onClick={() => setMenuMode('confirm-delete')}>{t('menu.delete')}</div>
                ) : null}
                {menu.isRemote ? (
                  <div className="dsh-gp-menu-item danger" onClick={() => setMenuMode('confirm-delete')}>{t('menu.deleteRemote')}</div>
                ) : null}
                {!menu.isCurrent ? (
                  <div className="dsh-gp-menu-item" onClick={() => void mergeInto()}>{t('menu.merge')}</div>
                ) : null}
              </>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}
