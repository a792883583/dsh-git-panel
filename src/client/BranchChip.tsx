/**
 * The input-dock branch chip: shows the current branch above the input box;
 * clicking opens a dropdown of local branches for one-click switching.
 * Mounted via the official `conversation.input.dock` slot (rc.6 declares it),
 * so it renders beside the workspace selector above the composer.
 * @module dsh-git-panel/client/BranchChip
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { BranchesView } from '../core/types.ts'
import { GitPanelApi } from './api.ts'
import { useT } from './i18n.ts'

const CHIP_STYLE = `
.dsh-gpc { --gpc-fg:#24292f; --gpc-border:rgba(128,128,128,0.35); --gpc-hover:rgba(0,0,0,0.06);
  --gpc-bg:#ffffff; --gpc-muted:#6e7781; --gpc-accent:#1976d2; --gpc-danger:#cf222e;
  --gpc-pop-bg:#ffffff; position:relative; display:flex; justify-content:flex-start;
  width:100%; max-width:var(--dsh-composer-card-max-width, 800px); margin:0 auto; }
[data-ds-dark-theme] .dsh-gpc { --gpc-fg:#d1d9e0; --gpc-border:rgba(255,255,255,0.22);
  --gpc-hover:rgba(255,255,255,0.08); --gpc-bg:#21262d; --gpc-muted:#9198a1;
  --gpc-accent:#58a6ff; --gpc-danger:#f85149; --gpc-pop-bg:#1f2328; }
.dsh-gpc-chip { display:inline-flex; align-items:center; gap:5px; max-width:220px;
  padding:3px 10px; font-size:12px; color:var(--gpc-fg); background:var(--gpc-bg);
  border:1px solid var(--gpc-border); border-radius:999px; cursor:pointer;
  white-space:nowrap; overflow:hidden; }
.dsh-gpc-chip:hover { background:var(--gpc-hover); }
.dsh-gpc-chip:disabled { cursor:default; opacity:0.65; }
.dsh-gpc-chip .label { overflow:hidden; text-overflow:ellipsis; }
.dsh-gpc-spin { width:10px; height:10px; flex:none; border:1.5px solid var(--gpc-muted);
  border-top-color:transparent; border-radius:50%;
  animation:dsh-gpc-spin 0.7s linear infinite; }
@keyframes dsh-gpc-spin { to { transform:rotate(360deg) } }
.dsh-gpc-backdrop { position:fixed; inset:0; z-index:900; }
.dsh-gpc-pop { position:absolute; top:calc(100% + 6px); left:0; min-width:240px; max-width:320px;
  max-height:340px; overflow:auto; z-index:901; background:var(--gpc-pop-bg);
  border:1px solid var(--gpc-border); border-radius:8px; box-shadow:0 8px 24px rgba(0,0,0,0.18);
  padding:4px; }
.dsh-gpc-pop .head { padding:4px 8px; font-size:11px; color:var(--gpc-muted); font-weight:600; }
.dsh-gpc-row { display:flex; align-items:center; gap:6px; padding:5px 8px; font-size:12px;
  color:var(--gpc-fg); border-radius:6px; cursor:pointer; }
.dsh-gpc-row:hover { background:var(--gpc-hover); }
.dsh-gpc-row .check { color:var(--gpc-accent); width:14px; flex:none; }
.dsh-gpc-row .name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; }
.dsh-gpc-row.current { font-weight:600; }
.dsh-gpc-err { padding:4px 8px; font-size:11px; color:var(--gpc-danger); }
.dsh-gpc-empty { padding:8px; font-size:11px; color:var(--gpc-muted); }
`

let chipStyleInjected = false
function ensureChipStyle(): void {
  if (chipStyleInjected) return
  chipStyleInjected = true
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-git-panel-chip-css'
  tag.textContent = CHIP_STYLE
  document.head.appendChild(tag)
}

/** The sessions service face the chip needs (structural; see client/index.ts). */
interface ChipSessions {
  list: {
    getSnapshot(): { current?: string; byId: Record<string, { cwd?: string }> }
  }
}

interface BranchChipProps {
  /** Current session id (the dock slot's runtime share). */
  sessionId?: string
  /** The injected sessions service. */
  sessions?: ChipSessions
}

/** The input-dock branch selector chip. Renders null outside git workspaces. */
export function BranchChip(props: BranchChipProps): React.ReactElement | null {
  const { sessionId, sessions } = props
  const t = useT()
  const [api] = useState(() => new GitPanelApi())
  const [current, setCurrent] = useState<string | null>(null)
  const [view, setView] = useState<BranchesView | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const retries = useRef(0)
  // Monotonic guard for in-flight fetches: a response resolving after the
  // session changed must not label the wrong repo or fill the dropdown.
  const fetchSeq = useRef(0)
  // Dynamic popover direction: opens upward when there is not enough room
  // below the chip (the composer sits near the bottom of the viewport).
  // Re-measured after content loads (view/error/loading settle) so the flip
  // decision uses the REAL popover height, not the loading stub.
  const [openUp, setOpenUp] = useState(false)
  const chipRef = useRef<HTMLButtonElement | null>(null)
  const popRef = useRef<HTMLDivElement | null>(null)

  const updateDirection = useCallback(() => {
    const chip = chipRef.current
    if (chip === null) return
    const chipRect = chip.getBoundingClientRect()
    const spaceBelow = window.innerHeight - chipRect.bottom
    const spaceAbove = chipRect.top
    const height = popRef.current?.getBoundingClientRect().height ?? 240
    const opensUp = spaceBelow < height + 10
    setOpenUp(opensUp)
    const pop = popRef.current
    if (pop === null) return
    // Clamp to the ACTUAL available space in the chosen direction so the
    // list can never extend past the viewport, regardless of timing.
    const max = opensUp ? Math.max(160, spaceAbove - 12) : Math.max(120, spaceBelow - 12)
    pop.style.maxHeight = `${Math.min(max, 340)}px`
    console.debug('[dsh-git-panel] chip popover', {
      spaceBelow: Math.round(spaceBelow), spaceAbove: Math.round(spaceAbove),
      height: Math.round(height), opensUp, maxHeight: pop.style.maxHeight,
    })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    updateDirection()
    window.addEventListener('resize', updateDirection)
    return () => window.removeEventListener('resize', updateDirection)
  }, [open, view, error, loading, updateDirection])

  ensureChipStyle()

  const cwd = useMemo(() => {
    if (!sessionId || !sessions) return ''
    return sessions.list.getSnapshot().byId[sessionId]?.cwd ?? ''
  }, [sessionId, sessions])

  useEffect(() => {
    console.debug('[dsh-git-panel] chip mount', { sessionId, hasSessions: !!sessions, cwd })
  }, [sessionId, sessions, cwd])

  // Label: light current-branch probe only. The full branch list is fetched
  // when the dropdown opens — keeps the boot and session switches cheap.
  const refetchCurrent = useCallback(async () => {
    if (!cwd) {
      setCurrent(null)
      return
    }
    const seq = ++fetchSeq.current
    const result = await api.current(cwd)
    console.debug('[dsh-git-panel] chip current', { cwd, ok: result.ok })
    if (seq !== fetchSeq.current) return
    if (result.ok) {
      retries.current = 0
      setCurrent(result.value.current || null)
      setError(null)
    } else {
      // Keep the last known branch label; retry a hidden chip once so a
      // transient failure does not leave the selector permanently invisible.
      setError(result.error.message)
      if (current === null && retries.current < 1) {
        retries.current += 1
        window.setTimeout(() => void refetchCurrent(), 1500)
      }
    }
  }, [cwd, api, current])

  // Initial load + session change (cheap probe only).
  useEffect(() => {
    void refetchCurrent()
  }, [refetchCurrent])

  // Full branch list, fetched fresh every time the popover opens.
  const refetchList = useCallback(async () => {
    if (!cwd) {
      setView(null)
      return
    }
    const seq = ++fetchSeq.current
    setLoading(true)
    const result = await api.branches(cwd)
    if (seq !== fetchSeq.current) return
    setLoading(false)
    console.debug('[dsh-git-panel] chip branches', { cwd, ok: result.ok })
    if (result.ok) {
      setView(result.value)
      setError(null)
    } else {
      setError(result.error.message)
    }
  }, [cwd, api])

  useEffect(() => {
    if (open) void refetchList()
  }, [open, refetchList])

  // Not a git workspace (no session, no repo): hide the chip entirely.
  if (current === null && !loading) return null

  const switchTo = async (branch: string): Promise<void> => {
    if (busy || branch === current) {
      setOpen(false)
      return
    }
    setBusy(true)
    setError(null)
    const result = await api.switchBranch(cwd, branch)
    setBusy(false)
    if (result.ok) {
      setOpen(false)
      await refetchCurrent()
      // Let the right-side panel refresh its branch list too.
      window.dispatchEvent(new CustomEvent('dsh-git-panel:switched'))
    } else {
      setError(result.error.message)
    }
  }

  return (
    <div className="dsh-gpc">
      <button ref={chipRef} type="button" className="dsh-gpc-chip" title={t('chip.title')}
        aria-expanded={open} disabled={loading}
        onClick={() => {
          if (loading) return
          setOpen((v) => !v)
        }}>
        <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor"
          strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="4" cy="4" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="4" r="1.6" />
          <path d="M4 5.6v4.8a2.4 2.4 0 0 0 2.4 2.4H12" />
        </svg>
        <span className="label">{current}</span>
        {loading ? (
          <span className="dsh-gpc-spin" aria-label={t('aria.loading')} />
        ) : (
          <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor"
            strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 6l4 4 4-4" />
          </svg>
        )}
      </button>

      {open ? (
        <>
          <div className="dsh-gpc-backdrop" onClick={() => setOpen(false)} />
          <div ref={popRef} className="dsh-gpc-pop" role="listbox"
            style={openUp ? { bottom: 'calc(100% + 6px)', top: 'auto' } : { top: 'calc(100% + 6px)', bottom: 'auto' }}>
            <div className="head">{t('chip.head')}</div>
            {error && view === null ? <div className="dsh-gpc-err">{error}</div> : null}
            {loading && view === null ? <div className="dsh-gpc-empty">{t('loading')}</div> : null}
            {!loading && error && view !== null ? <div className="dsh-gpc-err">{error}</div> : null}
            {!loading && !error && view !== null && view.local.length === 0 ? <div className="dsh-gpc-empty">{t('empty.local')}</div> : null}
            {view?.local.map((branch) => (
              <div key={branch.name} role="option" aria-selected={branch.name === current}
                className={`dsh-gpc-row${branch.name === current ? ' current' : ''}`}
                onClick={() => void switchTo(branch.name)}>
                <span className="check">{branch.name === current ? '✓' : ''}</span>
                <span className="name">{branch.name}</span>
                {branch.ahead || branch.behind ? (
                  <span style={{ color: 'var(--gpc-muted)', fontSize: 11 }}>
                    {branch.ahead ? `↑${branch.ahead}` : ''}{branch.behind ? `↓${branch.behind}` : ''}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}
