# tix

A Markdown ticket tracker in a shell script.

- Tickets are Markdown files with YAML frontmatter in `./tickets/`
- No server, no database — just files that diff, merge, and grep like code
- Works in any editor: Vim, VS Code, Obsidian
- Dependency tracking, kanban views, auto-archiving
- Versioned with your code in Git

## Tix Web UI

![List view](tix-ui/screenshots/list-dark.png)

A local React + TanStack Start dashboard for browsing, editing, and creating
tickets. Lives in [`tix-ui/`](tix-ui/). Highlights:

- Reactive live updates — a chokidar file watcher pushes changes over
  Server-Sent Events, so edits made by the CLI, your editor, or another
  agent appear instantly.
- Linear-style list and board views with grouping (status / priority /
  type), collapsible sticky group headers, and URL-driven filters.
- Detail view with inline editing (Milkdown markdown editor), a prev/next
  pager (J/K or Alt+←/→), and a chip-based tag input with autocomplete.
- Command palette (⌘K) with cyclical arrow nav and ticket search.

Install and launch:

```bash
./install-tix-ui                          # builds and symlinks `tix-ui`
cd your-project && tix-ui                 # opens the dashboard
```

With [portless](https://www.npmjs.com/package/portless) installed, each project
gets a stable named URL — e.g. `http://my-project-tix.localhost:1355` instead of
a random port. Without portless, falls back to an available port starting at 3000.
Set `PORTLESS=0` to bypass. Override the subdomain with `PORTLESS_NAME=foo tix-ui`
(useful for dated/verbose directory names).

## How It Works

Each ticket is a Markdown file named like `Fix The Login Bug (a1b2).md`. The 4-character hex ID is embedded in the filename.

```yaml
---
id: "a1b2"
title: "Fix the login bug"
status: open
priority: 2
type: bug
assignee: Winston
deps: []
tags: [auth]
created: 2026-03-29T12:00:00Z
---
```

The `id` is quoted so that 4-char hex values like `0e48` aren't parsed as
YAML scientific notation by downstream tools.

The body is freeform Markdown — description, design notes, acceptance criteria.

When a ticket is marked `done` or `closed`, it moves to `archive/YYYY-MM-DD/` automatically.

## Install

One-liner:

```bash
curl -fsSL https://raw.githubusercontent.com/WinstonFassett/tix/main/install.sh | bash
```

Or clone and install manually:

```bash
git clone https://github.com/WinstonFassett/tix.git ~/.tix
~/.tix/setup-deps && ~/.tix/install-tix
```

Both clone to `~/.tix`, download vendored dependencies (yq, jq), and symlink `tix` into your PATH.

## Quick Start

```bash
cd your-project
tix create "Fix the login bug"
tix ls
tix start a1b2
tix done a1b2
```

## Usage

### Tickets

```
tix create <title>          Create a ticket (returns its 4-hex ID)
tix show <id>               Display full ticket details
tix file <id>               Print path to ticket file
tix rename <id> <title>     Rename a ticket
tix delete <id>             Permanently delete a ticket
```

`create` accepts flags: `--description`, `--priority 0-4`, `--type`, `--assignee`, `--tags`, `--folder` (e.g. `backlog`).

### Workflow

```
tix start <id>              Set status to in-progress
tix hold <id>               Set status to on-hold (alias: pause)
tix done <id>               Mark done and archive
tix close <id>              Mark closed (won't-do) and archive
tix reopen <id>             Reopen a ticket
tix status <id> <status>    Set explicit status
```

Valid statuses: `open`, `in-progress`, `review`, `on-hold`, `done`, `closed`.

### Lists

```
tix ls                      Active tickets (open + in-progress)
tix ls --all                Include done/closed
tix ls --deep               Include subfolders
tix ready                   Tickets with all deps resolved
tix blocked                 Tickets with unresolved deps
tix closed                  Recently completed tickets
```

Filter any list with `--status`, `-a <assignee>`, `-T <tag>`.

### Dependencies and Links

```
tix dep <id> <dep-id>       Add a dependency
tix undep <id> <dep-id>     Remove a dependency
tix dep tree                Show full dependency tree
tix dep cycle               Detect cycles
tix link <id1> <id2>        Bidirectional link between tickets
```

### Notes and Acceptance Criteria

```
tix add-note <id> "text"    Add a timestamped note
tix add-ac <id> "criterion" Add an acceptance criterion
tix check <id> <n>          Toggle AC checkbox
```

### Obsidian

```
tix vault open              Open workspace as an Obsidian vault
tix vault init              Set up .obsidian config for tickets
```

## Configuration

| Variable | Purpose |
|----------|---------|
| `TIX_WORKSPACE` | Override workspace root (tickets dir = `$TIX_WORKSPACE/tickets/`) |
| `TICKETS_DIR` | Point directly at a tickets directory |
| `TICKET_WORKSPACE` | Legacy fallback for `TIX_WORKSPACE` |

## Development

```bash
./setup-deps              # Download vendored yq + jq into lib/
bats test/                # Run the test suite (requires bats-core)
```

## See Also

- [tix-ui](tix-ui/) — Web dashboard for browsing tickets (React + TanStack Start)
- [skills/tix](skills/tix/) — Agent skill definition for AI-assisted ticket management

## Uninstall

```bash
~/.tix/uninstall-tix
```
