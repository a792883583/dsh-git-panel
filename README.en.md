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
- **Write bar** (top of the panel, under the tabs):
  - **Commit**: type a message and press Enter → `git add -A && git commit -m`
  - **Push**: one-click `git push` of the current branch
  - **Stash / pop**: `git stash push` (optional message) / `git stash pop`
  - **Status**: shows the number of changed files (`git status --porcelain`)
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
dsh plugin --profile web add dsh-git-panel
```

Restart `dsh web`, open a project session bound to a git repository, and the Git panel appears on the right side of the chat.

> For local development, install via a link instead: `dsh plugin --profile web add link:/path/to/dsh-git-panel`. After editing source, run `npm run build` and refresh the page to see changes.

## License

MIT
