import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestServer } from "./sse-server";

describe("SSE Server (direct Node.js test)", () => {
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

  it("SSE /events receives events when tickets are created", async () => {
    // Connect to SSE
    const controller = new AbortController();
    const response = await fetch(`${baseUrl}/events`, {
      signal: controller.signal,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/event-stream");

    // Read SSE stream
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    // Create a ticket while SSE is connected
    await fetch(`${baseUrl}/tickets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "sse1", title: "SSE test" }),
    });

    // Read chunks until we get the event
    let collected = "";
    const startTime = Date.now();
    while (Date.now() - startTime < 3000) {
      const { value, done } = await Promise.race([
        reader.read(),
        new Promise<{ value: undefined; done: true }>((r) =>
          setTimeout(() => r({ value: undefined, done: true }), 3000),
        ),
      ]);
      if (done || !value) break;
      collected += decoder.decode(value, { stream: true });
      if (collected.includes("ticket.created") && collected.includes("sse1")) {
        break;
      }
    }

    controller.abort();

    expect(collected).toContain("ticket.created");
    expect(collected).toContain("sse1");
  }, 10000);
});
