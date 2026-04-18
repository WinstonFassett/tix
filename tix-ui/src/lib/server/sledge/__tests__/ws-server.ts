/**
 * Minimal HTTP + WebSocket server that exposes Sledge events via WS.
 * Used for Playwright and direct Node.js testing.
 */
import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import Database from "better-sqlite3";
import { createTicketLedger } from "../ticket-ledger";

export function createTestServer(port = 0) {
  const db = new Database(":memory:");
  const ledger = createTicketLedger(db);

  const wsClients = new Set<WebSocket>();

  // Tail events in background → push to WS clients
  const controller = new AbortController();
  (async () => {
    for await (const item of ledger.tailEvents({
      last: 0,
      signal: controller.signal,
    })) {
      const data = JSON.stringify({
        type: item.event.eventName,
        id: (item.event.payload as Record<string, unknown>).id,
        payload: item.event.payload,
        seq: item.cursor,
      });
      for (const ws of wsClients) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      }
    }
  })().catch(() => {});

  const server = http.createServer(async (req, res) => {
    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url!, `http://localhost`);

    // POST /tickets — create
    if (url.pathname === "/tickets" && req.method === "POST") {
      const body = await readBody(req);
      const ticket = JSON.parse(body);
      await ledger.emit("ticket.created", {
        id: ticket.id,
        title: ticket.title || "",
        status: ticket.status || "open",
        type: ticket.type || "feature",
        priority: ticket.priority ?? 2,
        tags: ticket.tags || [],
        deps: ticket.deps || [],
        assignee: ticket.assignee || "",
        body: ticket.body || "",
        filename: ticket.filename || `${ticket.title || "Untitled"} (${ticket.id}).md`,
        folder: ticket.folder || "",
        created: ticket.created || new Date().toISOString(),
      });
      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, id: ticket.id }));
      return;
    }

    // PATCH /tickets/:id — update
    if (url.pathname.startsWith("/tickets/") && req.method === "PATCH") {
      const id = url.pathname.split("/")[2];
      const body = await readBody(req);
      const updates = JSON.parse(body);
      await ledger.emit("ticket.updated", { id, ...updates });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // GET /tickets — list all
    if (url.pathname === "/tickets" && req.method === "GET") {
      const tickets = await ledger.query("allTickets", {});
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(tickets));
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  const wss = new WebSocketServer({ server });
  wss.on("connection", (ws) => {
    wsClients.add(ws);
    ws.on("close", () => wsClients.delete(ws));
    ws.on("error", () => wsClients.delete(ws));
  });

  return {
    server,
    wss,
    ledger,
    db,
    start: () =>
      new Promise<number>((resolve) => {
        server.listen(port, () => {
          const addr = server.address() as { port: number };
          resolve(addr.port);
        });
      }),
    stop: async () => {
      controller.abort();
      for (const ws of wsClients) ws.close();
      wsClients.clear();
      wss.close();
      server.close();
      await ledger.close();
      db.close();
    },
  };
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
  });
}
