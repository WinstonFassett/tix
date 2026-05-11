# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

`tix` is a minimal, Git-like ticket/issue tracker CLI written in Go. Tickets are Markdown files with YAML frontmatter stored in `./tickets/` (relative to cwd, like `.git/`). It was originally a Bash script, then extracted from `ticket-workspace-template` and rewritten in Go.

## Commands

```bash
# Build the Go CLI
cd tix-server && go build -o tix .

# Run Go tests
cd tix-server && go test ./...

# Install globally (downloads pre-built binary)
./install.sh

# Run the web UI dev server
cd tix-server && TIX_UI_DEV=1 go run . ui
```

## Architecture

- **`tix-server/`** — Go CLI + embedded web server. Entry point: `main.go`. Commands implemented via Cobra in `cmd_*.go` files. Key files:
  - `cmd_root.go` — root Cobra command, `resolveTicketsDir()`, default `ls` behavior
  - `cmd_create.go`, `cmd_lifecycle.go`, `cmd_ls.go`, `cmd_dep.go`, `cmd_notes.go`, `cmd_query.go` — CLI subcommands
  - `cmd_ui.go` — launches the tix-ui web server
  - `db.go` / `disk.go` — ticket read/write, YAML frontmatter parsing
  - `sync.go` / `watch.go` — file-system watcher and sync logic
  - `server.go` / `ws.go` — embedded HTTP/WebSocket server for `tix ui`
  - `sanitize.go` — Title Case filename normalization with acronym fixup
- **`bin/`** — Pre-built release binaries (darwin/linux × amd64/arm64)
- **`npm/`** — npm wrapper package (`@winstonfassett/tix`); `install.js` downloads the correct binary at `postinstall`
- **`install.sh`** — Shell installer that detects platform and downloads from GitHub Releases
- **`tix-vault`** — Obsidian vault integration wrapper.
- **`tix-ui/`** — React + TanStack Start web dashboard. Data layer is **Sledge** (`@torkbot/sledge`, better-sqlite3 event-sourced SQLite) on server + **TanStack DB** for client-side reactivity. Server functions query the store; .md files are projected as a side-effect. Chokidar SSE endpoint at `tix-ui/server/routes/api/tickets-events.get.ts` syncs external file edits back into the store and pushes granular events to browsers. Built and symlinked by `./install-tix-ui`. Uses portless when available for named `.localhost` URLs (e.g. `project-tix.localhost:1355`). Playwright e2e tests in `tix-ui/e2e/`.
- **`tix-ui/src/lib/server/sledge/`** — Sledge integration:
  - `ticket-ledger.ts` — Event definitions, projectors (events → tickets table), query definitions
  - `singleton.ts` — globalThis-based singleton shared across Vite SSR contexts, exposes `getLedger()` and `getDb()`
  - `sync.ts` — Hydration from .md files and projection back to .md files, content-hash loop guard
  - `sledge-collection.ts` — TanStack DB collection backed by Sledge (client-side reactivity)
  - `__tests__/` — vitest tests (ticket store CRUD, collection sync, live queries, SSE server)
- **`skills/tix/SKILL.md`** — Skill definition for AI agents to use tix.

## Ticket Format

Files named `Title Case (4hex).md` in `tickets/`. Frontmatter fields: `id`, `title`, `status`, `deps`, `links`, `created`, `type`, `priority` (0-4), `assignee`, `tags`. IDs are 4-char hex and **must be quoted** in YAML (`id: "0e48"`) so values like `0e48` don't get parsed as scientific notation. Statuses: `open`, `in-progress`, `review`, `on-hold`, `done`, `closed`. Done/closed tickets auto-archive to `tickets/archive/YYYY-MM-DD/`.

## Environment Variables

- `TIX_WORKSPACE` — Override workspace root (tickets dir = `$TIX_WORKSPACE/tickets/`)
- `TICKET_WORKSPACE` — Legacy fallback for above
- `TICKETS_DIR` — Direct override of tickets directory path
- `PORTLESS` — Set to `0` to bypass portless proxy for tix-ui
- `PORTLESS_PORT` — Override portless proxy port (default 1355)
- `PORTLESS_NAME` — Override portless subdomain for tix-ui (default `$(basename $TIX_WORKSPACE)-tix`)
- `TIX_UI_NAME` — Override the display label shown in tix-ui header/sidebar (default: workspace basename)
- `TIX_UI_DEV` — Set to `1` to run tix-ui in vite dev mode with HMR

## Data Architecture (Sledge + TanStack DB)

tix-ui uses Sledge (`@torkbot/sledge`) as a server-side event-sourced data layer backed by a single better-sqlite3 database. The **database is canonical** at runtime; markdown files are a projection for git/editor compatibility.

**Write path:** UI mutation → server function → `ledger.emit(event)` → projector updates `tickets` table → `projectTicketToFile()` writes .md → content-hash loop guard skips re-ingestion → SSE broadcasts change to browsers.

**External edit path:** CLI/editor writes .md → chokidar detects → diff against existing state → `ledger.emit(event)` if changed → SSE broadcasts → browser React Query refetches.

**Persistence:** Sledge event log + projected state live in a single SQLite DB at `.tix/sledge.db` (gitignored). On restart, state rebuilds from event replay. If DB is empty, hydrates from .md files on disk.

**SSE:** Single EventSource per browser tab, managed in `tix-ui/src/lib/client/ticket-collection.ts`. Server broadcasts via `globalThis.__tixSSEListeners`. No polling, no Sledge `tailEvents` in SSE path (scheduler doesn't tick in Vite SSR).

**Store singleton:** Shared via `globalThis` across Vite's SSR module contexts (Nitro server routes + TanStack Start server functions).

## Key Conventions

- Go CLI targets macOS + Linux (darwin/linux × amd64/arm64).
- Filenames use Title Case with acronym fixup (API, UI, SQL, etc.) via `sanitize.go`.
- Go tests in `tix-server/` use standard `testing` package with `testhelper_test.go` for temp dir setup.
