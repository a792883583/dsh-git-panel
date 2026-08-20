/**
 * 右侧面板挂载：定位 shell 的 frame 网格（带兼容标记的
 * `[data-dsh-frame]`，或 rc.6 原生侧边栏列的父元素），并为 git 面板追加一个
 * 尾部的 grid track。shell 网格的写入会被镜像回来（shell 拥有 track 1-3，
 * 我们拥有最后一条）。
 * @module dsh-git-panel/client/frame
 */

const PANEL_WIDTH_PX = 320

let frameElement: HTMLElement | null = null

export function getFrame(): HTMLElement | null {
  return frameElement
}

/** 定位面板列将要追加进去的 frame 网格元素。 */
export function findFrame(): HTMLElement | null {
  const stamped = document.querySelector<HTMLElement>('[data-dsh-frame]')
  if (stamped !== null) return stamped
  return document.querySelector<HTMLElement>('[class*="sidebarCol"]')?.parentElement ?? null
}

/** 把内联的 grid-template-columns 字符串解析成 tracks。 */
export function parseGridTracks(input: string): string[] {
  const tracks: string[] = []
  let depth = 0
  let current = ''
  for (const char of input) {
    if (char === '(') depth += 1
    if (char === ')') depth = Math.max(0, depth - 1)
    if (char === ' ' && depth === 0) {
      if (current !== '') {
        tracks.push(current)
        current = ''
      }
      continue
    }
    current += char
  }
  if (current !== '') tracks.push(current)
  return tracks
}

/**
 * 等待 frame 出现（shell 会在插件启动之后挂载它）。使用廉价的 rAF 轮询，
 * 而不是 body 子树的 MutationObserver：observer 会在启动期间的每次 DOM 变更
 * 时触发，并且每次变更执行两次整棵树的查询，会明显拖慢 shell 的启动。
 */
export function waitForFrame(onFrame: (frame: HTMLElement) => void): () => void {
  const tryFind = (): boolean => {
    const frame = findFrame()
    if (frame === null) return false
    frameElement = frame
    onFrame(frame)
    return true
  }
  if (tryFind()) return () => {}

  let raf = 0
  let timer = 0
  const startedAt = performance.now()
  const poll = (): void => {
    if (tryFind()) return
    // 30 秒后放弃，以免在异常的 shell 上永远轮询下去。
    if (performance.now() - startedAt > 30_000) return
    raf = requestAnimationFrame(poll)
  }
  raf = requestAnimationFrame(poll)
  // 兜底：即使 rAF 被限流（后台标签页），也要最终停止。
  timer = window.setTimeout(() => cancelAnimationFrame(raf), 31_000)
  return () => {
    cancelAnimationFrame(raf)
    window.clearTimeout(timer)
  }
}

/** 已挂载的右侧面板列。 */
export interface PanelColumn {
  element: HTMLElement
  setWidth(px: number): void
  /** 把 grid track 折叠为 0（隐藏）或恢复上次的宽度。 */
  setVisible(visible: boolean): void
  dispose(): void
}

/** 创建面板列，并让 frame 网格保持同步。 */
export function mountPanelColumn(
  frame: HTMLElement,
  width = PANEL_WIDTH_PX,
  opts: { onToggle?: () => void } = {},
): PanelColumn {
  const column = document.createElement('div')
  column.dataset.gitPanelCol = ''
  column.style.minWidth = '0'
  column.style.display = 'flex'
  column.style.flexDirection = 'column'
  column.style.borderLeft = '1px solid var(--dsh-git-panel-border, rgba(128,128,128,0.25))'
  // 注意：列上不要设置 overflow:hidden —— 缩放手柄横跨左边沿，会被它裁剪掉
  //（且因此无法悬停）。
  frame.appendChild(column)

  let shellTracks: string[] = []
  /** 每次网格写入后都会被调用，让手柄跟随列边沿。 */
  let onGridApplied: (() => void) | undefined

  const applyGrid = (): void => {
    const inline = frame.style.gridTemplateColumns
    if (inline === '') return
    const tracks = parseGridTracks(inline)
    if (tracks.length === 3) {
      shellTracks = tracks
      frame.style.gridTemplateColumns = `${tracks.join(' ')} ${width}px`
      onGridApplied?.()
      return
    }
    if (tracks.length === 4 && shellTracks.length === 3) {
      // 这是我们自己写入的；shell 的 tracks 已经镜像过了。
      return
    }
    // 未知状态——如果前三个 tracks 看起来像是 shell 的，就镜像它们。
    if (tracks.length > 3) {
      shellTracks = tracks.slice(0, 3)
      frame.style.gridTemplateColumns = `${tracks.slice(0, 3).join(' ')} ${width}px`
      onGridApplied?.()
    }
  }

  // 初始同步（shell 的内联样式此时已经应用）。
  const initial = frame.style.gridTemplateColumns
  if (initial !== '') {
    const tracks = parseGridTracks(initial)
    if (tracks.length === 3) shellTracks = tracks
  }
  applyGrid()

  // ---- 拖拽缩放：跨在列左边沿上的手柄 ----
  // 手柄放在 FRAME 上，而不是 React 容器内部：React 18 的 createRoot 在首次
  // 渲染时会清除非 React 子元素，那会把追加到列上的手柄分离（并渲染成不可见）。
  // frame 归 shell 所有、永远不会被重建，只会被重新设置样式。
  const MIN_WIDTH = 240
  const MAX_WIDTH = 640
  frame.style.position = 'relative'
  // 抓取手柄的悬停提示（面板是纯 DOM 实现，因此这条规则在这里注入，
  // 而不是放在 React 样式表中）。
  const handleStyleId = 'dsh-git-panel-handle-css'
  if (document.querySelector(`style[data-plugin="${handleStyleId}"]`) === null) {
    const styleTag = document.createElement('style')
    styleTag.dataset.plugin = handleStyleId
    styleTag.textContent = [
      '[data-git-panel-handle]{position:absolute;top:0;bottom:0;width:14px;cursor:col-resize;z-index:40;touch-action:none}',
    ].join('\n')
    document.head.appendChild(styleTag)
  }
  const handle = document.createElement('div')
  handle.dataset.gitPanelHandle = ''
  frame.appendChild(handle)
  const placeHandle = (): void => {
    handle.style.left = `${column.offsetLeft - 7}px`
  }
  onGridApplied = () => {
    placeHandle()
    placeToggle()
  }
  placeHandle()

  // ---- 折叠切换：位于面板左边缘的箭头按钮 ----
  // 总停靠在面板边框线稍左处：可见时在边框线左侧，折叠后停放在 frame 的右边
  // 缘。两种状态下都可见。和拖拽手柄一样，放在 frame 上。
  let hiddenState = false
  const toggle = document.createElement('button')
  toggle.type = 'button'
  // 供其他插件（如 dsh-chat-toc）定位：目录条停靠在箭头左侧。
  toggle.dataset.gitPanelToggle = ''
  toggle.setAttribute('aria-label', 'Toggle git panel')
  // 普通的 chevron 箭头；折叠状态下旋转 180°。
  toggle.innerHTML =
    '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3l5 5-5 5"/></svg>'
  toggle.style.cssText = [
    'position:absolute',
    'top:50%',
    'transform:translateY(-50%)',
    'z-index:41',
    'width:24px',
    'height:24px',
    'border:none',
    'background:transparent',
    'padding:0',
    'color:inherit',
    'cursor:pointer',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'opacity:0.85',
  ].join(';')
  toggle.addEventListener('mouseenter', () => { toggle.style.opacity = '1' })
  toggle.addEventListener('mouseleave', () => { toggle.style.opacity = '0.85' })
  toggle.addEventListener('click', () => opts.onToggle?.())
  frame.appendChild(toggle)

  const placeToggle = (): void => {
    const frameRect = frame.getBoundingClientRect()
    // 紧贴边框线：两种状态都留 2px 间隙。
    toggle.style.left = hiddenState
      ? `${Math.max(0, frameRect.width - 26)}px`
      : `${Math.max(2, column.offsetLeft - 26)}px`
  }

  // 逐帧跟随 shell 的网格动画，而不是猜测它的过渡时长：当 grid-template-
  // columns 在过渡时，每一动画帧都重新停靠手柄与切换按钮，使它们精确跟随
  // 移动中的边框。
  let followRaf = 0
  const follow = (): void => {
    placeHandle()
    placeToggle()
    followRaf = requestAnimationFrame(follow)
  }
  const onTransitionStart = (event: TransitionEvent): void => {
    if (event.propertyName !== 'grid-template-columns') return
    cancelAnimationFrame(followRaf)
    followRaf = requestAnimationFrame(follow)
  }
  const onTransitionEnd = (event: TransitionEvent): void => {
    if (event.propertyName !== 'grid-template-columns') return
    cancelAnimationFrame(followRaf)
    placeHandle()
    placeToggle()
  }
  frame.addEventListener('transitionstart', onTransitionStart)
  frame.addEventListener('transitionend', onTransitionEnd)
  const resizeListener = (): void => placeToggle()
  window.addEventListener('resize', resizeListener)

  // 列的 offsetLeft 只有在布局之后才有效；首次放置（挂载时）可能读到 0，
  // 从而把切换按钮停靠到屏幕外。等浏览器完成布局后，再放置一次。
  requestAnimationFrame(() => {
    placeHandle()
    placeToggle()
  })

  let currentWidth = width
  let dragging = false

  const applyWidth = (px: number): void => {
    currentWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(px)))
    frame.style.gridTemplateColumns = `${shellTracks.join(' ')} ${currentWidth}px`
    // 中间 track 的宽度会随缩放伸缩，因此列的左边缘随之移动，手柄必须跟随
    // 每次写入（网格写入不会经过 applyGrid）。
    placeHandle()
    placeToggle()
  }

  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return
    dragging = true
    handle.classList.add('dragging')
    try {
      handle.setPointerCapture(event.pointerId)
    } catch {
      /* 忽略 */
    }
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
    // shell 会用慢速过渡来动画 grid-template-columns；在拖拽期间停用它，
    // 让面板以 1:1 的比例跟随光标。
    frame.style.transition = 'none'
    event.preventDefault()
    console.debug('[dsh-git-panel] drag pointerdown', event.clientX)
  })
  handle.addEventListener('pointermove', (event) => {
    if (!dragging) return
    // 面板列是最后一个 grid track；它的右边缘就是 frame 的右边缘，因此拖拽
    // 它的左边缘即可直接缩放这个 track。
    const frameRect = frame.getBoundingClientRect()
    applyWidth(frameRect.right - event.clientX)
    console.debug('[dsh-git-panel] drag pointermove', event.clientX, '→', currentWidth)
  })
  const endDrag = (event: PointerEvent): void => {
    const wasDragging = dragging
    dragging = false
    handle.classList.remove('dragging')
    // 一定要恢复全局光标：pointer capture 丢失（右键菜单、窗口失焦、元素被
    // 移除）时从不会触发 pointerup/pointercancel——只有 lostpointercapture——
    // 而一个卡在整个应用上的 col-resize 光标比一次无效操作更糟。
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
    frame.style.transition = ''
    if (!wasDragging) return
    try {
      handle.releasePointerCapture(event.pointerId)
    } catch {
      /* 忽略 */
    }
    console.debug('[dsh-git-panel] drag end', event.clientX)
  }
  handle.addEventListener('pointerup', endDrag)
  handle.addEventListener('pointercancel', endDrag)
  // 当浏览器丢弃 pointer capture 时触发（右键菜单、拖拽中途被移除元素等）——
  // 这是 pointerup 无法覆盖的路径。
  handle.addEventListener('lostpointercapture', endDrag)
  handle.addEventListener('dblclick', () => applyWidth(PANEL_WIDTH_PX))

  // 为 PointerEvent capture 表现异常的运行环境提供鼠标事件兜底方案。加上
  // 保护，避免一组事件序列重复驱动宽度。
  let mouseDown = false
  handle.addEventListener('mousedown', (event) => {
    if (event.button !== 0 || dragging) return
    mouseDown = true
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
    event.preventDefault()
  })
  window.addEventListener('mousemove', (event) => {
    if (!mouseDown) return
    const frameRect = frame.getBoundingClientRect()
    applyWidth(frameRect.right - event.clientX)
  })
  window.addEventListener('mouseup', () => {
    if (!mouseDown) return
    mouseDown = false
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
  })

  // 调试钩子：几何信息 + 程序化缩放，用于诊断。
  ;(window as unknown as Record<string, unknown>).__gitPanelDebug = {
    column,
    handle,
    frame,
    getWidth: () => currentWidth,
    setWidth: (px: number) => applyWidth(px),
  }

  const styleObserver = new MutationObserver(() => applyGrid())
  styleObserver.observe(frame, { attributes: true, attributeFilter: ['style'] })

  return {
    element: column,
    setWidth(px: number) {
      applyWidth(px)
    },
    setVisible(visible: boolean) {
      hiddenState = !visible
      // → 可见（折叠）、← 隐藏（展开）。
      toggle.style.transform = `translateY(-50%) rotate(${visible ? 0 : 180}deg)`
      placeToggle()
      if (visible) {
        handle.style.display = ''
        column.style.borderLeft = '1px solid var(--dsh-git-panel-border, rgba(128,128,128,0.25))'
        frame.style.gridTemplateColumns = `${shellTracks.join(' ')} ${currentWidth}px`
      } else {
        // 折叠后的 0px track 会把列停靠在 frame 的右边缘；如果不隐藏手柄，
        // 它仍会在这个位置保持可交互。
        handle.style.display = 'none'
        column.style.borderLeft = 'none'
        frame.style.gridTemplateColumns = `${shellTracks.join(' ')} 0px`
      }
    },
    dispose() {
      // 安全网：如果面板在拖拽中途被拆除，绝不要把应用到整个应用的
      // col-resize 光标遗留下来。
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      styleObserver.disconnect()
      cancelAnimationFrame(followRaf)
      window.removeEventListener('resize', resizeListener)
      frame.removeEventListener('transitionstart', onTransitionStart)
      frame.removeEventListener('transitionend', onTransitionEnd)
      toggle.remove()
      handle.remove()
      column.remove()
      frameElement = null
      const inline = frame.style.gridTemplateColumns
      if (inline !== '' && parseGridTracks(inline).length === 4) {
        frame.style.gridTemplateColumns = shellTracks.join(' ')
      }
    },
  }
}
