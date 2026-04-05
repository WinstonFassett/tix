/**
 * tix-ui-deno — Single-file Deno server for browsing and managing tix tickets.
 *
 * Run:
 *   deno run --allow-net --allow-read --allow-env --allow-run serve.ts
 *
 * Or via task:
 *   deno task dev
 */

import { Hono } from "hono";
import { parse as parseYaml } from "@std/yaml";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PORT = parseInt(Deno.env.get("PORT") ?? "4567");
const TIX_WORKSPACE = Deno.env.get("TIX_WORKSPACE") ?? Deno.env.get("TICKET_WORKSPACE") ?? Deno.cwd();
const TICKETS_DIR = Deno.env.get("TICKETS_DIR") ?? `${TIX_WORKSPACE}/tickets`;

// Try to find `tix` on PATH or relative to this repo
function findTix(): string {
  // Walk up from CWD looking for the tix script
  let dir = TIX_WORKSPACE;
  for (let i = 0; i < 5; i++) {
    const candidate = `${dir}/tix`;
    try {
      Deno.statSync(candidate);
      return candidate;
    } catch { /* keep looking */ }
    dir = dir.replace(/\/[^/]+$/, "");
  }
  return "tix"; // fall back to PATH
}

const TIX_BIN = findTix();

// ---------------------------------------------------------------------------
// Ticket parsing
// ---------------------------------------------------------------------------

interface Ticket {
  id: string;
  title: string;
  status: string;
  type: string;
  priority: number;
  assignee: string;
  tags: string[];
  deps: string[];
  created: string;
  body: string;
  filename: string;
}

function parseFrontmatter(raw: string): { meta: Record<string, unknown>; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };
  try {
    const meta = parseYaml(match[1]) as Record<string, unknown>;
    return { meta, body: match[2].trim() };
  } catch {
    return { meta: {}, body: raw };
  }
}

async function readTicket(path: string, filename: string): Promise<Ticket | null> {
  try {
    const raw = await Deno.readTextFile(path);
    const { meta, body } = parseFrontmatter(raw);
    return {
      id: String(meta.id ?? ""),
      title: String(meta.title ?? filename.replace(/\.md$/, "")),
      status: String(meta.status ?? "open"),
      type: String(meta.type ?? "task"),
      priority: Number(meta.priority ?? 2),
      assignee: String(meta.assignee ?? ""),
      tags: Array.isArray(meta.tags) ? meta.tags.map(String) : [],
      deps: Array.isArray(meta.deps) ? meta.deps.map(String) : [],
      created: String(meta.created ?? ""),
      body,
      filename,
    };
  } catch {
    return null;
  }
}

async function listTickets(): Promise<Ticket[]> {
  const tickets: Ticket[] = [];

  async function walk(dir: string) {
    try {
      for await (const entry of Deno.readDir(dir)) {
        const fullPath = `${dir}/${entry.name}`;
        if (entry.isDirectory && entry.name !== "archive") {
          await walk(fullPath);
        } else if (entry.isFile && entry.name.endsWith(".md")) {
          const t = await readTicket(fullPath, entry.name);
          if (t) tickets.push(t);
        }
      }
    } catch {
      // directory may not exist yet
    }
  }

  await walk(TICKETS_DIR);
  // Sort by priority (lower number = higher priority), then by created desc
  tickets.sort((a, b) => a.priority - b.priority || b.created.localeCompare(a.created));
  return tickets;
}

// ---------------------------------------------------------------------------
// Ticket writing (update frontmatter in-place)
// ---------------------------------------------------------------------------

function serializeFrontmatter(meta: Record<string, unknown>, body: string): string {
  const lines = ["---"];
  const fieldOrder = ["id", "title", "status", "deps", "links", "created", "type", "priority", "assignee", "tags"];
  const seen = new Set<string>();

  for (const key of fieldOrder) {
    if (key in meta) {
      seen.add(key);
      lines.push(formatYamlField(key, meta[key]));
    }
  }
  // Any extra fields not in the canonical order
  for (const [key, val] of Object.entries(meta)) {
    if (!seen.has(key)) {
      lines.push(formatYamlField(key, val));
    }
  }

  lines.push("---");
  if (body) {
    lines.push(body);
  }
  return lines.join("\n") + "\n";
}

function formatYamlField(key: string, val: unknown): string {
  if (Array.isArray(val)) {
    if (val.length === 0) return `${key}: []`;
    return `${key}:\n${val.map((v) => `  - ${v}`).join("\n")}`;
  }
  if (typeof val === "number") return `${key}: ${val}`;
  return `${key}: ${val}`;
}

async function findTicketFile(id: string): Promise<string | null> {
  async function walk(dir: string): Promise<string | null> {
    try {
      for await (const entry of Deno.readDir(dir)) {
        const fullPath = `${dir}/${entry.name}`;
        if (entry.isDirectory && entry.name !== "archive") {
          const found = await walk(fullPath);
          if (found) return found;
        } else if (entry.isFile && entry.name.endsWith(".md") && entry.name.includes(`(${id})`)) {
          return fullPath;
        }
      }
    } catch { /* */ }
    return null;
  }
  return walk(TICKETS_DIR);
}

async function updateTicket(id: string, updates: Record<string, unknown>): Promise<Ticket | null> {
  const filePath = await findTicketFile(id);
  if (!filePath) return null;

  const raw = await Deno.readTextFile(filePath);
  const { meta, body } = parseFrontmatter(raw);

  // Apply updates (only known fields)
  const allowed = ["status", "type", "priority", "assignee", "tags", "deps", "title"];
  for (const key of allowed) {
    if (key in updates) {
      meta[key] = updates[key];
    }
  }

  await Deno.writeTextFile(filePath, serializeFrontmatter(meta, body));

  const filename = filePath.split("/").pop() ?? "";
  return readTicket(filePath, filename);
}

// ---------------------------------------------------------------------------
// WebSocket live-reload
// ---------------------------------------------------------------------------

const wsClients = new Set<WebSocket>();

function broadcastReload() {
  const msg = JSON.stringify({ type: "reload" });
  for (const ws of wsClients) {
    try {
      ws.send(msg);
    } catch {
      wsClients.delete(ws);
    }
  }
}

// File watcher — debounce to avoid duplicate events
let watcherTimeout: number | undefined;

async function startWatcher() {
  try {
    const watcher = Deno.watchFs(TICKETS_DIR, { recursive: true });
    for await (const _event of watcher) {
      clearTimeout(watcherTimeout);
      watcherTimeout = setTimeout(() => broadcastReload(), 200);
    }
  } catch (err) {
    console.warn(`[watcher] Could not watch ${TICKETS_DIR}:`, err);
  }
}

startWatcher();

// ---------------------------------------------------------------------------
// HTTP Server (Hono)
// ---------------------------------------------------------------------------

const app = new Hono();

// API: list tickets
app.get("/api/tickets", async (c) => {
  const tickets = await listTickets();
  return c.json(tickets);
});

// API: create ticket via tix CLI
app.post("/api/tickets", async (c) => {
  const body = await c.req.json<{ title: string; type?: string; priority?: number; description?: string }>();
  if (!body.title) return c.json({ error: "title is required" }, 400);

  const args = [TIX_BIN, "create", body.title];
  if (body.type) args.push("-t", body.type);
  if (body.priority !== undefined) args.push("-p", String(body.priority));
  if (body.description) args.push("-d", body.description);

  try {
    const cmd = new Deno.Command(args[0], {
      args: args.slice(1),
      cwd: TIX_WORKSPACE,
      stdout: "piped",
      stderr: "piped",
      env: { TIX_WORKSPACE },
    });
    const result = await cmd.output();
    const stdout = new TextDecoder().decode(result.stdout).trim();
    const stderr = new TextDecoder().decode(result.stderr).trim();

    if (!result.success) {
      return c.json({ error: stderr || "tix create failed" }, 500);
    }
    return c.json({ ok: true, output: stdout }, 201);
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

// API: update ticket
app.post("/api/tickets/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const updated = await updateTicket(id, body);
  if (!updated) return c.json({ error: "ticket not found" }, 404);
  return c.json(updated);
});

// WebSocket upgrade
app.get("/ws", (c) => {
  const { response, socket } = Deno.upgradeWebSocket(c.req.raw);
  socket.onopen = () => wsClients.add(socket);
  socket.onclose = () => wsClients.delete(socket);
  return response;
});

// Serve the UI
app.get("/", (c) => {
  return c.html(HTML_PAGE);
});

// ---------------------------------------------------------------------------
// Inline HTML UI
// ---------------------------------------------------------------------------

const HTML_PAGE = /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>tix</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  :root {
    --bg: #0d1117; --bg2: #161b22; --border: #30363d;
    --fg: #e6edf3; --fg2: #8b949e; --accent: #58a6ff;
    --green: #3fb950; --yellow: #d29922; --red: #f85149; --purple: #bc8cff;
  }
  body {
    margin: 0; padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    background: var(--bg); color: var(--fg);
    line-height: 1.5;
  }
  header {
    padding: 16px 24px; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between;
  }
  header h1 { margin: 0; font-size: 18px; font-weight: 600; letter-spacing: -0.01em; }
  header h1 span { color: var(--fg2); font-weight: 400; }
  .container { max-width: 960px; margin: 0 auto; padding: 24px; }

  /* Status badge */
  .badge {
    display: inline-block; padding: 2px 8px; border-radius: 12px;
    font-size: 12px; font-weight: 500; text-transform: capitalize;
  }
  .badge-open { background: #1f352a; color: var(--green); }
  .badge-in-progress { background: #2a1f0a; color: var(--yellow); }
  .badge-done { background: #1a1a2e; color: var(--purple); }
  .badge-closed { background: #1a1a1a; color: var(--fg2); }
  .badge-on-hold { background: #2a1520; color: var(--red); }

  /* Priority indicator */
  .priority { font-weight: 600; }
  .p0 { color: var(--red); }
  .p1 { color: var(--yellow); }
  .p2 { color: var(--fg); }
  .p3 { color: var(--fg2); }
  .p4 { color: var(--fg2); opacity: 0.6; }

  /* Table */
  table { width: 100%; border-collapse: collapse; }
  thead th {
    text-align: left; padding: 8px 12px; font-size: 12px; font-weight: 500;
    color: var(--fg2); text-transform: uppercase; letter-spacing: 0.05em;
    border-bottom: 1px solid var(--border);
  }
  tbody tr { border-bottom: 1px solid var(--border); transition: background 0.1s; }
  tbody tr:hover { background: var(--bg2); }
  td { padding: 10px 12px; font-size: 14px; }
  td.title-cell { font-weight: 500; }
  td.id-cell { font-family: monospace; font-size: 12px; color: var(--fg2); }
  td.type-cell { text-transform: capitalize; color: var(--fg2); font-size: 13px; }

  /* Create form */
  .create-form {
    display: flex; gap: 8px; flex-wrap: wrap; align-items: flex-end;
    margin-bottom: 24px; padding: 16px; background: var(--bg2);
    border: 1px solid var(--border); border-radius: 8px;
  }
  .field { display: flex; flex-direction: column; gap: 4px; }
  .field label { font-size: 11px; font-weight: 500; color: var(--fg2); text-transform: uppercase; letter-spacing: 0.05em; }
  .field input, .field select {
    padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border);
    background: var(--bg); color: var(--fg); font-size: 14px; outline: none;
  }
  .field input:focus, .field select:focus { border-color: var(--accent); }
  .field input[name="title"] { min-width: 280px; }
  button[type="submit"] {
    padding: 6px 16px; border-radius: 6px; border: none;
    background: var(--accent); color: #fff; font-size: 14px; font-weight: 500;
    cursor: pointer; align-self: flex-end;
  }
  button[type="submit"]:hover { opacity: 0.9; }

  /* Connection status */
  .ws-status {
    width: 8px; height: 8px; border-radius: 50%;
    display: inline-block; margin-right: 8px;
  }
  .ws-connected { background: var(--green); }
  .ws-disconnected { background: var(--red); }

  .empty { text-align: center; padding: 48px; color: var(--fg2); }
  .count { font-size: 13px; color: var(--fg2); margin-bottom: 12px; }
</style>
</head>
<body>
<header>
  <h1>tix <span>ui</span></h1>
  <div><span id="ws-dot" class="ws-status ws-disconnected"></span><span id="ws-label" style="font-size:12px;color:var(--fg2)">connecting...</span></div>
</header>
<div class="container">
  <form class="create-form" id="create-form">
    <div class="field">
      <label>Title</label>
      <input name="title" placeholder="New ticket title..." required autocomplete="off">
    </div>
    <div class="field">
      <label>Type</label>
      <select name="type">
        <option value="task">task</option>
        <option value="bug">bug</option>
        <option value="feature">feature</option>
        <option value="epic">epic</option>
        <option value="chore">chore</option>
      </select>
    </div>
    <div class="field">
      <label>Priority</label>
      <select name="priority">
        <option value="0">P0 - Critical</option>
        <option value="1">P1 - High</option>
        <option value="2" selected>P2 - Medium</option>
        <option value="3">P3 - Low</option>
        <option value="4">P4 - Minimal</option>
      </select>
    </div>
    <button type="submit">Create</button>
  </form>

  <div class="count" id="count"></div>
  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Title</th>
        <th>Status</th>
        <th>Type</th>
        <th>Priority</th>
      </tr>
    </thead>
    <tbody id="ticket-body">
    </tbody>
  </table>
  <div class="empty" id="empty" style="display:none;">No tickets found. Create one above or add .md files to the tickets/ directory.</div>
</div>

<script>
const tbody = document.getElementById("ticket-body");
const emptyEl = document.getElementById("empty");
const countEl = document.getElementById("count");
const wsDot = document.getElementById("ws-dot");
const wsLabel = document.getElementById("ws-label");

// --- Fetch & render tickets ---
async function loadTickets() {
  try {
    const res = await fetch("/api/tickets");
    const tickets = await res.json();
    render(tickets);
  } catch (e) {
    console.error("Failed to load tickets:", e);
  }
}

function render(tickets) {
  if (tickets.length === 0) {
    tbody.innerHTML = "";
    emptyEl.style.display = "";
    countEl.textContent = "";
    return;
  }
  emptyEl.style.display = "none";
  countEl.textContent = tickets.length + " ticket" + (tickets.length === 1 ? "" : "s");
  tbody.innerHTML = tickets.map(t => {
    const statusClass = "badge-" + t.status.replace(/\\s+/g, "-");
    const pClass = "p" + t.priority;
    return \`<tr>
      <td class="id-cell">\${esc(t.id)}</td>
      <td class="title-cell">\${esc(t.title)}</td>
      <td><span class="badge \${statusClass}">\${esc(t.status)}</span></td>
      <td class="type-cell">\${esc(t.type)}</td>
      <td class="priority \${pClass}">P\${t.priority}</td>
    </tr>\`;
  }).join("");
}

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

// --- Create ticket ---
document.getElementById("create-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = {
    title: fd.get("title"),
    type: fd.get("type"),
    priority: Number(fd.get("priority")),
  };
  try {
    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      e.target.reset();
      await loadTickets();
    } else {
      const err = await res.json();
      alert("Create failed: " + (err.error || "unknown error"));
    }
  } catch (err) {
    alert("Create failed: " + err);
  }
});

// --- WebSocket live reload ---
function connectWs() {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(proto + "//" + location.host + "/ws");

  ws.onopen = () => {
    wsDot.className = "ws-status ws-connected";
    wsLabel.textContent = "live";
  };

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === "reload") loadTickets();
    } catch {}
  };

  ws.onclose = () => {
    wsDot.className = "ws-status ws-disconnected";
    wsLabel.textContent = "reconnecting...";
    setTimeout(connectWs, 2000);
  };

  ws.onerror = () => ws.close();
}

// Boot
loadTickets();
connectWs();
</script>
</body>
</html>`;

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

console.log(`
  tix-ui-deno
  ───────────
  Tickets dir : ${TICKETS_DIR}
  tix binary  : ${TIX_BIN}
  Server      : http://localhost:${PORT}
`);

Deno.serve({ port: PORT }, app.fetch);
