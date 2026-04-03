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
- **`skills/tix/SKILL.md`** — Skill definition for AI agents to use tix.

## Ticket Format

Files named `Title Case (4hex).md` in `tickets/`. Frontmatter fields: `id`, `title`, `status`, `deps`, `links`, `created`, `type`, `priority` (0-4), `assignee`, `tags`. IDs are 4-char hex. Statuses: `open`, `in-progress`, `on-hold`, `done`, `closed`. Done/closed tickets auto-archive to `tickets/archive/YYYY-MM-DD/`.

## Environment Variables

- `TIX_WORKSPACE` — Override workspace root (tickets dir = `$TIX_WORKSPACE/tickets/`)
- `TICKET_WORKSPACE` — Legacy fallback for above
- `TICKETS_DIR` — Direct override of tickets directory path

## Key Conventions

- Portable Bash: macOS + Linux compat (custom `_sed_i`, `_sha256`, `_iso_date` wrappers instead of GNU-specific flags).
- Filenames use Title Case with acronym fixup (API, UI, SQL, etc.) via `sanitize_title_for_filename`.
- Tests use bats with a `test_helper.bash` that creates temp dirs per test and cleans up in teardown.
