import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { createTestServer } from "./ws-server";

describe("Sledge WebSocket via Playwright", () => {
  let server: ReturnType<typeof createTestServer>;
  let port: number;
  let browser: Browser;
  let page: Page;
  let baseUrl: string;

  beforeAll(async () => {
    server = createTestServer();
    port = await server.start();
    baseUrl = `http://localhost:${port}`;
    browser = await chromium.launch();
    page = await browser.newPage();
  }, 15000);

  afterAll(async () => {
    await page?.close();
    await browser?.close();
    await server?.stop();
  });

  it("browser receives WebSocket events when tickets are created via API", async () => {
    const html = `
      <html><body>
      <div id="events"></div>
      <script>
        window.__events = [];
        const ws = new WebSocket("ws://localhost:${port}");
        ws.addEventListener("message", (e) => {
          const data = JSON.parse(e.data);
          window.__events.push({
            type: data.type,
            id: data.id,
          });
          document.getElementById("events").textContent = JSON.stringify(window.__events);
        });
      </script>
      </body></html>
    `;
    await page.setContent(html);

    // Wait for WS connection to be established
    await page.waitForTimeout(300);

    // Create tickets via API from Node.js side
    await fetch(`${baseUrl}/tickets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "pw01", title: "Playwright test 1" }),
    });
    await fetch(`${baseUrl}/tickets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "pw02", title: "Playwright test 2" }),
    });

    // Wait for events to arrive in browser
    await page.waitForFunction(
      () => (window as any).__events?.length >= 2,
      { timeout: 5000 },
    );

    const events = await page.evaluate(() => (window as any).__events);

    expect(events).toHaveLength(2);
    expect(events[0].type).toBe("ticket.created");
    expect(events[0].id).toBe("pw01");
    expect(events[1].type).toBe("ticket.created");
    expect(events[1].id).toBe("pw02");
  }, 15000);

  it("browser receives update events via WebSocket", async () => {
    await page.evaluate(() => {
      (window as any).__events = [];
    });

    await fetch(`${baseUrl}/tickets/pw01`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });

    await page.waitForFunction(
      () => (window as any).__events?.length >= 1,
      { timeout: 5000 },
    );

    const events = await page.evaluate(() => (window as any).__events);
    expect(events[0].type).toBe("ticket.updated");
    expect(events[0].id).toBe("pw01");
  }, 10000);
});
