/**
 * Right-side panel mount: locate the shell's frame grid (compat-stamped
 * `[data-dsh-frame]`, or the rc.6-native parent of the sidebar column) and
 * append one trailing grid track for the git panel. Shell grid writes are
 * mirrored back (the shell owns tracks 1-3, we own the last one).
 * @module dsh-git-panel/client/frame
 */

const PANEL_WIDTH_PX = 320

let frameElement: HTMLElement | null = null

export function getFrame(): HTMLElement | null {
  return frameElement
}

/** Locate the frame grid element the panel column appends into. */
export function findFrame(): HTMLElement | null {
  const stamped = document.querySelector<HTMLElement>('[data-dsh-frame]')
  if (stamped !== null) return stamped
  return document.querySelector<HTMLElement>('[class*="sidebarCol"]')?.parentElement ?? null
}

/** Parse an inline grid-template-columns string into tracks. */
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
 * Wait for the frame to appear (the shell mounts it after the plugin boots).
 * Uses a cheap rAF poll instead of a body-subtree MutationObserver: the
 * observer fires on every DOM mutation during boot and runs two full-tree
 * queries per mutation, measurably slowing the shell's startup.
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
    // Give up after 30s so the poll does not run forever on exotic shells.
    if (performance.now() - startedAt > 30_000) return
    raf = requestAnimationFrame(poll)
  }
  raf = requestAnimationFrame(poll)
  // Backstop: even if rAF is throttled (background tab), stop eventually.
  timer = window.setTimeout(() => cancelAnimationFrame(raf), 31_000)
  return () => {
    cancelAnimationFrame(raf)
    window.clearTimeout(timer)
  }
}

/** A mounted right-side panel column. */
export interface PanelColumn {
  element: HTMLElement
  setWidth(px: number): void
  /** Collapse the grid track to 0 (hidden) or restore the last width. */
  setVisible(visible: boolean): void
  dispose(): void
}

/** Create the panel column and keep the frame grid in sync. */
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
  // NOTE: no overflow:hidden on the column — the resize handle straddles the
  // left edge and would be clipped (and left un-hoverable) by it.
  frame.appendChild(column)

  let shellTracks: string[] = []
  /** Invoked after every grid write so the handle follows the column edge. */
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
      // Our own write; the shell tracks are already mirrored.
      return
    }
    // Unknown state — mirror the first three tracks if they look like the shell's.
    if (tracks.length > 3) {
      shellTracks = tracks.slice(0, 3)
      frame.style.gridTemplateColumns = `${tracks.slice(0, 3).join(' ')} ${width}px`
      onGridApplied?.()
    }
  }

  // Initial sync (the shell's inline style is already applied).
  const initial = frame.style.gridTemplateColumns
  if (initial !== '') {
    const tracks = parseGridTracks(initial)
    if (tracks.length === 3) shellTracks = tracks
  }
  applyGrid()

  // ---- drag-to-resize: handle straddling the column's left edge ----
  // The handle lives on the FRAME, not inside the React container: React 18
  // createRoot clears non-React children of the container on first render,
  // which would detach (and render invisible) a handle appended to the
  // column. The frame is shell-owned and never re-created, only restyled.
  const MIN_WIDTH = 240
  const MAX_WIDTH = 640
  frame.style.position = 'relative'
  // Hover affordance for the grab handle (the panel is plain-DOM, so the
  // rule is injected here rather than in the React stylesheet).
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

  // ---- collapse toggle: arrow button at the panel's left edge ----
  // Always parked just LEFT of the panel's border line: left of the border
  // while visible, at the frame's right edge while collapsed. Visible in
  // both states. Lives on the frame like the drag handle.
  let hiddenState = false
  const toggle = document.createElement('button')
  toggle.type = 'button'
  toggle.setAttribute('aria-label', 'Toggle git panel')
  // Plain chevron arrow; rotated 180° in the collapsed state.
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
    // Snug against the border line: 2px gap, both states.
    toggle.style.left = hiddenState
      ? `${Math.max(0, frameRect.width - 26)}px`
      : `${Math.max(2, column.offsetLeft - 26)}px`
  }

  // Follow the shell's grid animation frame-by-frame instead of guessing its
  // transition duration: while grid-template-columns transitions, re-park the
  // handle and the toggle every animation frame so they track the moving
  // border exactly.
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

  // The column's offsetLeft is only valid after layout; the very first
  // placement (mount) may read 0 and park the toggle off-screen. Re-place
  // once the browser has laid the frame out.
  requestAnimationFrame(() => {
    placeHandle()
    placeToggle()
  })

  let currentWidth = width
  let dragging = false

  const applyWidth = (px: number): void => {
    currentWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(px)))
    frame.style.gridTemplateColumns = `${shellTracks.join(' ')} ${currentWidth}px`
    // The column's left edge moves as the center track shrinks/grows, so the
    // handle must follow every write (grid writes do not go through applyGrid).
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
      /* noop */
    }
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
    // The shell animates grid-template-columns with a slow transition; kill it
    // for the duration of the drag so the panel follows the cursor 1:1.
    frame.style.transition = 'none'
    event.preventDefault()
    console.debug('[dsh-git-panel] drag pointerdown', event.clientX)
  })
  handle.addEventListener('pointermove', (event) => {
    if (!dragging) return
    // The panel column is the last grid track; its right edge is the frame's
    // right edge, so dragging its left edge resizes the track directly.
    const frameRect = frame.getBoundingClientRect()
    applyWidth(frameRect.right - event.clientX)
    console.debug('[dsh-git-panel] drag pointermove', event.clientX, '→', currentWidth)
  })
  const endDrag = (event: PointerEvent): void => {
    const wasDragging = dragging
    dragging = false
    handle.classList.remove('dragging')
    // ALWAYS restore the global cursor: a lost pointer capture (context
    // menu, window blur, element removal) never fires pointerup/pointercancel
    // — only lostpointercapture — and a stuck col-resize cursor over the
    // whole app is worse than a no-op.
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
    frame.style.transition = ''
    if (!wasDragging) return
    try {
      handle.releasePointerCapture(event.pointerId)
    } catch {
      /* noop */
    }
    console.debug('[dsh-git-panel] drag end', event.clientX)
  }
  handle.addEventListener('pointerup', endDrag)
  handle.addEventListener('pointercancel', endDrag)
  // Fires when the browser drops pointer capture (context menu, element
  // removed mid-drag, etc.) — the one path pointerup can't cover.
  handle.addEventListener('lostpointercapture', endDrag)
  handle.addEventListener('dblclick', () => applyWidth(PANEL_WIDTH_PX))

  // Mouse-event fallback for environments where PointerEvent capture
  // misbehaves. Guarded so a pointer sequence never double-drives the width.
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

  // Debug hook: geometry + programmatic resize for diagnosis.
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
      // → when visible (collapse), ← when hidden (expand).
      toggle.style.transform = `translateY(-50%) rotate(${visible ? 0 : 180}deg)`
      placeToggle()
      if (visible) {
        handle.style.display = ''
        column.style.borderLeft = '1px solid var(--dsh-git-panel-border, rgba(128,128,128,0.25))'
        frame.style.gridTemplateColumns = `${shellTracks.join(' ')} ${currentWidth}px`
      } else {
        // The collapsed 0px track parks the column at the frame's right edge;
        // without hiding the handle it would stay interactive there.
        handle.style.display = 'none'
        column.style.borderLeft = 'none'
        frame.style.gridTemplateColumns = `${shellTracks.join(' ')} 0px`
      }
    },
    dispose() {
      // Safety net: never leave the app-wide col-resize cursor behind if the
      // panel is torn down mid-drag.
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
