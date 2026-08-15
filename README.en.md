# dsh-git-panel

[中文](README.md) · [Español](README.es.md)

A Git panel plugin for the DSH Web GUI: branch management (switch / pull / fetch / rename / delete / merge) plus a GitLens-style commit graph.

## Features

- **Branch panel** (right side of the chat):
  - Local branches: current branch highlighted, `↑ahead / ↓behind` against upstream, **double-click to switch** (double-click the current branch to pull)
  - Remote branches: **double-click to check out** (creates a local tracking branch automatically)
  - Right-click menu: **rename / delete / merge into current branch** (remote branches get delete-remote instead)
  - One-click **pull** of the current branch, **fetch all** (`git fetch --all --prune`)
- **Branch chip** (above the input box): shows the current branch; click to open a local-branch list for quick switching
- **Git graph**: commit DAG lanes, three-column header (Lanes / Commit / Branch), the commit column is resizable from both sides (width persisted), click a node for commit details; virtualized rendering — only the visible viewport is drawn, so large repositories scroll smoothly
- **Multilingual**: follows the DSH Web UI language (Chinese / English); Spanish browsers automatically get Spanish copy; defaults to Simplified Chinese
- Follows the current session's working directory: re-binds automatically when switching project sessions
- Light / dark theme follows the DSH Web GUI

## Screenshots

**Branch panel** (local/remote branches, ahead/behind, double-click to switch, right-click menu):

![Branch panel](docs/branches.png)

**Branch chip** (quick branch switching above the input box):

![Branch chip](docs/chip.png)

**Commit graph** (resizable three-column layout, virtualized scrolling):

![Commit graph](docs/graph.png)

## Installation

```sh
# Local development / before the npm release
dsh plugin --profile web add link:/path/to/dsh-git-panel

# After publishing to npm
dsh plugin --profile web add dsh-git-panel
```

Restart `dsh web`, open a project session bound to a git repository, and the Git panel appears on the right side of the chat.

## Development

```sh
npm install
npm run typecheck     # tsc --noEmit
npm run build         # esbuild → lib/index.js (host) + lib/client.js (browser)
npm test              # scripts/test-e2e.sh: end-to-end tests on a scratch repo
```

### Architecture

- **Host half** (`src/index.ts` / `src/host/`): workspace guard + `ctx.subprocess` running real git commands, exposed as `/git-panel/*` JSON routes through `ctx.webServer.register`. Security boundary: git runs only inside registered workspace roots.
- **Browser half** (`src/client/`): locates the shell's frame grid via the `[class*="sidebarCol"]` parent (or `[data-dsh-frame]`), appends the right-side column and mirrors grid tracks; React renders the branch list and graph; `i18n.ts` keeps the zh / en / es copy and switches automatically with the platform and browser languages.
- Build output follows the `window.__ModuleLoader__.load({ id, factory })` closure-factory convention; external modules (react / @deepseek-ai platform modules) come from the loader's module table.

### Routes

| Route | Method | Description |
|---|---|---|
| `/git-panel/branches` | POST | Branch view (current / local / remote + ahead / behind) |
| `/git-panel/graph` | POST | Commit DAG + branch tip mapping |
| `/git-panel/switch` | POST | Switch branch (remote branches get a local tracking branch) |
| `/git-panel/pull` | POST | Pull the current branch |
| `/git-panel/fetch` | POST | Fetch all remotes (prune) |
| `/git-panel/rename` | POST | Rename a branch |
| `/git-panel/delete` | POST | Delete a local branch |
| `/git-panel/delete-remote` | POST | Delete a remote branch |
| `/git-panel/merge` | POST | Merge a branch into the current branch |

## License

MIT
