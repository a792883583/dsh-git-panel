# dsh-git-panel

[中文](README.md) · [Español](README.es.md)

A Git panel plugin for the DSH Web GUI: branch management (switch / pull / fetch / rename / delete / merge) plus a GitLens-style commit graph.

## Features

- **Branch panel** (right side of the chat):
  - **Two-row card layout**: branch names take the full top row without being truncated, while commit timestamps and messages sit on a dedicated second row
  - **Instant search & filter**: quick search box at the top of the branch list to filter branches and commit messages in real time
  - Local branches: current branch highlighted, `↑ahead / ↓behind` against upstream, **double-click to switch** (double-click the current branch to pull)
  - Remote branches: **double-click to check out** (creates a local tracking branch automatically)
  - Right-click menu: **copy branch name / rename / delete / merge into current branch** (remote branches get delete-remote instead)
  - One-click **pull** of the current branch, **fetch all** (`git fetch --all --prune`)
- **Branch chip** (above the input box): shows the current branch; click to open a local-branch list for quick switching
- **Git graph**: commit DAG lanes, three-column header (Lanes / Commit / Branch), the commit column is resizable from both sides (width persisted), click a node for commit details; virtualized rendering — only the visible viewport is drawn, so large repositories scroll smoothly
- **Write bar** (top of the panel, under the tabs):
  - **Commit**: type a message and press Enter → `git add -A && git commit -m`
  - **Push**: one-click `git push` of the current branch
  - **Stash / pop**: `git stash push` (optional message) / `git stash pop`
  - **Status**: shows the number of changed files (`git status --porcelain`)
- **Changes + syntax-colored Diff**: uncommitted changed files are listed under the write bar (status code + path); click any file to view its full diff against HEAD with line-by-line coloring (green + for additions, red - for deletions, blue @@ for hunks) — review changes clearly before committing
- **One-click Chat Context Injection**:
  - **Send Changes to Chat**: click "💬 Send changes to chat input" in the changes header to generate a structured prompt listing modified files, allowing the AI agent to summarize or compose commit messages
  - **Per-file Quick Actions**: each staged/unstaged file provides "📋 Copy relative path", "💬 Ask Agent about this file", and one-click "↩️ Discard Changes" with safety confirmation
  - **Send Diff to Chat**: click "💬 Send diff to chat input" in the diff header to insert the selected file's unified diff directly into the prompt box for detailed code review
- **Graph commit actions**: click a commit node in the graph to **cherry-pick it onto the current branch** or **revert it** (`git revert --no-edit`)
- **Multilingual**: follows the DSH Web UI language (Chinese / English); Spanish browsers automatically get Spanish copy; defaults to Simplified Chinese
- **Native right-sidebar tab**: the Git panel is a first-class tab beside the built-in "Files" tab — expand, collapse, width dragging, and tab switching are all owned by the official sidebar, with no page-layout rewriting
- Follows the current session's working directory: re-binds automatically when switching project sessions
- Light / dark theme follows the DSH Web GUI

## Screenshots

**Native tab in the right sidebar** — Git sits beside the built-in "Files" tab, and the sidebar owns expand/collapse, width drag, and tab switching:

![Git tab in the right sidebar](docs/sidebar-tab.png)

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

Restart `dsh web`, open a project session bound to a git repository, then open the right sidebar (top-right) and pick the **Git** tab.

> Requires DSH `>=0.1.5-alpha.1` (the release that introduced the right-sidebar multi-tab framework `@deepseek-ai/dsh-client-ui-sidebar-right`).

> For local development, install via a link instead: `dsh plugin --profile web add link:/path/to/dsh-git-panel`. After editing source, run `npm run build` and refresh the page to see changes.

## Feedback

Found a bug or have a feature request? Open an issue on [GitHub Issues](https://github.com/a792883583/dsh-git-panel/issues) — your feedback helps us make the plugin better.

## License

MIT
