# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

`tix` is a minimal, Git-like ticket/issue tracker CLI written entirely in Bash. Tickets are Markdown files with YAML frontmatter stored in `./tickets/` (relative to cwd, like `.git/`). It was recently extracted from `ticket-workspace-template` and renamed from `ticket` to `tix`. The old `ticket` command is a deprecated compat wrapper.

## Commands

```bash
# Run tests (requires bats - https://github.com/bats-core/bats-core)
bats test/              # all tests
bats test/basic_operations.bats   # single test file

# Install globally (symlinks into ~/.local/bin or /usr/local/bin)
./install-tix

# Bootstrap vendored deps (yq, jq) into lib/
./setup-deps
```

## Architecture

- **`tix`** (~2400 lines) — Single monolithic Bash script. All commands dispatched via `main()` case statement at the bottom. Each command is a `cmd_*` function.
- **`lib/yaml_ops.sh`** — YAML read/write using vendored `lib/yq`. Extracts frontmatter with awk, pipes to yq.
- **`lib/display_ops.sh`** — Output formatting (column alignment, dep trees) using awk.
- **`lib/yq`, `lib/jq`** — Vendored binaries (not checked in; downloaded by `setup-deps`).
- **`ticket`** — Deprecated compat wrapper that exec's `tix`.
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

- Portable Bash: macOS + Linux compat (custom `_sed_i`, `_sha256`, `_iso_date` wrappers instead of GNU-specific flags).
- Filenames use Title Case with acronym fixup (API, UI, SQL, etc.) via `sanitize_title_for_filename`.
- Tests use bats with a `test_helper.bash` that creates temp dirs per test and cleans up in teardown.
