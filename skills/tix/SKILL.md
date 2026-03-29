---
name: tix
description: Manage tasks, bugs, features, and epics with the `tix` CLI. Use for creating, updating, listing, and tracking dependencies of tickets. Provides commands for `create`, `start`, `done`, `close`, `dep`, `ls`, `show`, `edit`, and more.
---

# Tix Skill

## Overview

This skill provides comprehensive access to the `tix` command-line interface for managing a lightweight ticket system. It enables creation, status updates, dependency tracking, listing, and detailed viewing of tickets.

## Commands

The `tix` CLI supports the following commands. For detailed usage and options, refer to the `tix --help` output.

### Ticket Lifecycle

*   **`create [title] [options]`**: Create a new ticket.
    *   Example: `tix create "Implement user authentication" --type feature --priority 0 --assignee winston`
*   **`start <id>`**: Set ticket status to `in-progress`.
*   **`done <id>`**: Set ticket status to `done` (completed work; auto-archives).
*   **`close <id>`**: Set ticket status to `closed` (cancelled/won't-do).
*   **`reopen <id>`**: Set ticket status to `open`.
*   **`status <id> <status>`**: Update status (open|in-progress|done|closed).

### Dependency Management

*   **`dep <id> <dep-id>`**: Add a dependency (ticket `id` depends on `dep-id`).
*   **`dep tree [--full] <id>`**: Show dependency tree.
*   **`dep cycle`**: Find dependency cycles in open tickets.
*   **`undep <id> <dep-id>`**: Remove a dependency.
*   **`link <id> <id> [id...]`**: Link tickets together (symmetric).
*   **`unlink <id> <target-id>`**: Remove a link between tickets.

### Listing and Querying

*   **`ls [--status=X] [-a X] [-T X]`**: List tickets.
*   **`ready [-a X] [-T X]`**: List open/in-progress tickets with resolved dependencies.
*   **`blocked [-a X] [-T X]`**: List open/in-progress tickets with unresolved dependencies.
*   **`closed [--limit=N] [-a X] [-T X]`**: List recently closed tickets.
*   **`query [jq-filter]`**: Output tickets as JSON.

### Viewing and Editing

*   **`show <id>`**: Display ticket details.
*   **`file <id>`**: Show file path for a ticket.
*   **`edit <id>`**: Open ticket in `$EDITOR`.
*   **`open <id>`**: Open ticket in default application.

### Notes and Acceptance Criteria

*   **`add-note <id> [text]`**: Append a timestamped note.
*   **`check <id> <ac-number>`**: Toggle an acceptance criterion checkbox.
*   **`add-ac <id> <text>`**: Add an acceptance criterion.

### Utilities

*   **`archive [--days=N] [--all]`**: Move old done/closed tickets to archive.
*   **`status`**: Show configuration and directory info.

## Detailed Help

For the most up-to-date and complete reference, execute `tix --help` to view the CLI's native help documentation.

## Troubleshooting & Configuration

### Executing `tix` CLI commands

If you encounter "exec host not allowed" errors, it means the agent's `exec` commands are sandboxed and cannot directly access the host's CLI tools (like `tix`). To resolve this, you need to configure the `main` agent (this agent) to disable sandboxing in `/Users/winston/.openclaw/openclaw.json`.

Add or modify the `agents` section as follows:

```json
{
  "agents": {
    "list": [
      {
        "id": "main",
        "sandbox": {
          "mode": "off" // This disables sandboxing for the 'main' agent
        },
        "subagents": {
          "allowAgents": ["coding-agent"]
        }
      }
    ]
  }
}
```

**Note:** After modifying `openclaw.json`, a Gateway restart is required for changes to take effect. Disabling sandboxing grants the agent direct shell access, so ensure you understand the security implications.