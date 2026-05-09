# tix-server

Go-based single-binary server for tix web UI. Eliminates Node 24+ requirement and native addon compilation.

## Architecture

- **Single binary** with embedded React SPA (via `go:embed`)
- **Pure Go SQLite** via modernc.org/sqlite (no C compilation)
- **File watching** via go-fsnotify for live updates
- **WebSocket** for real-time sync across tabs
- **Workspace registry** for quick switching between projects

## Build

```bash
cd tix-server
make build          # Full build: React SPA → embed → Go binary
make build-ui       # Build React SPA only
make build-go       # Compile Go binary only
make cross          # Cross-compile for macOS arm64/x64, Linux x64/arm64
make install        # Install to ~/.local/bin
make clean          # Remove build artifacts
```

## Usage

```bash
# Start server for current directory
tix-server

# Start with custom port
tix-server --port 3000

# Register a workspace
tix-server add my-project /path/to/project

# List workspaces
tix-server ls

# Open UI for a workspace (auto-detects from cwd)
tix-server open

# Open UI for specific workspace
tix-server open my-project

# Remove workspace
tix-server rm my-project
```

## API Endpoints

- `GET /api/config` — Workspace config (ticketsDir, workspaceName, workspacePath)
- `GET /api/tickets` — List all tickets
- `POST /api/tickets` — Create ticket
- `GET /api/tickets/{id}` — Get ticket
- `PATCH /api/tickets/{id}` — Update ticket
- `DELETE /api/tickets/{id}` — Delete ticket
- `GET /api/tickets/{id}/events` — Ticket event log
- `GET /api/search?q=...` — Search tickets
- `GET /api/events` — Recent events
- `GET /api/workspaces` — Registered workspaces
- `WS /ws` — WebSocket for real-time updates

## Binary Size

Current: ~15MB (includes embedded React SPA)

Cross-compile sizes vary by platform but are comparable.

## Comparison to Node version

| | Node version | Go version |
|--|--------------|------------|
| Runtime | Node 24+ required | None (single binary) |
| SQLite | better-sqlite3 (C addon) | modernc.org/sqlite (pure Go) |
| Build | npm run build + Node runtime | go build |
| Distribution | npm install + Node | Download binary |
| Binary size | N/A (requires Node) | ~15MB |

## Development

```bash
cd tix-server
make dev    # Run against this repo's tickets dir (port 4152, no browser)
```

## Dependencies

- `modernc.org/sqlite` — Pure Go SQLite
- `github.com/fsnotify/fsnotify` — File watching
- `github.com/gorilla/websocket` — WebSocket
- `gopkg.in/yaml.v3` — YAML parsing for ticket files
