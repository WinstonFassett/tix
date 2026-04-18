import { describe, it, expect, beforeAll, afterAll } from "vitest";
import WebSocket from "ws";
import { createTestServer } from "./ws-server";

describe("WebSocket Server (direct Node.js test)", () => {
  let server: ReturnType<typeof createTestServer>;
  let port: number;
  let baseUrl: string;

  beforeAll(async () => {
    server = createTestServer();
    port = await server.start();
    baseUrl = `http://localhost:${port}`;
  });

  afterAll(async () => {
    await server?.stop();
  });

  it("POST /tickets creates a ticket and GET /tickets returns it", async () => {
    const res = await fetch(`${baseUrl}/tickets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "t001", title: "Test ticket" }),
    });
    expect(res.status).toBe(201);

    const list = await fetch(`${baseUrl}/tickets`);
    const tickets = await list.json();
    expect(tickets.length).toBeGreaterThanOrEqual(1);
    expect(tickets.find((t: any) => t.id === "t001")).toBeTruthy();
  });

  it("WebSocket receives events when tickets are created", async () => {
    const ws = new WebSocket(`ws://localhost:${port}`);

    const events: any[] = [];
    const gotEvent = new Promise<void>((resolve) => {
      ws.on("message", (data) => {
        const parsed = JSON.parse(data.toString());
        events.push(parsed);
        if (parsed.type === "ticket.created" && parsed.id === "ws01") {
          resolve();
        }
      });
    });

    // Wait for connection
    await new Promise<void>((resolve) => ws.on("open", resolve));

    // Create a ticket while WS is connected
    await fetch(`${baseUrl}/tickets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "ws01", title: "WS test" }),
    });

    // Wait for the event (with timeout)
    await Promise.race([
      gotEvent,
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000)),
    ]);

    ws.close();

    expect(events.some((e) => e.type === "ticket.created" && e.id === "ws01")).toBe(true);
  }, 10000);
});
