import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import matter from "gray-matter";
import type { Ticket } from "./ticket-ledger";

import type { createTicketLedger } from "./ticket-ledger";

type Ledger = ReturnType<typeof createTicketLedger>;

const TICKET_PATTERN = /\(([0-9a-f]{4})\)\.md$/i;

// Content-hash loop guard: stores sha256 of files we recently projected.
// Chokidar changes matching a stored hash are skipped (we wrote them).
const projectedHashes = new Map<string, string>();

function sha256(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * Mark a file as recently projected (content-hash based loop guard).
 */
export function markAsProjected(filepath: string, content: string): void {
  projectedHashes.set(filepath, sha256(content));
}

/**
 * Check if a file change should be skipped (we wrote it).
 */
export function isOwnProjection(filepath: string): boolean {
  const stored = projectedHashes.get(filepath);
  if (!stored) return false;
  try {
    const current = sha256(fs.readFileSync(filepath, "utf-8"));
    if (current === stored) return true;
    // Hash mismatch — external edit, clear guard and process
    projectedHashes.delete(filepath);
    return false;
  } catch {
    // File doesn't exist — if we have a stored hash, we deleted it
    projectedHashes.delete(filepath);
    return true;
  }
}

// --- Walk & Parse ---

function walkTickets(
  ticketsDir: string,
  rel = "",
): Array<{ filepath: string; filename: string; folder: string }> {
  const results: Array<{
    filepath: string;
    filename: string;
    folder: string;
  }> = [];
  const dir = rel ? path.join(ticketsDir, rel) : ticketsDir;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      results.push(...walkTickets(ticketsDir, childRel));
    } else if (entry.isFile() && TICKET_PATTERN.test(entry.name)) {
      results.push({
        filepath: path.join(dir, entry.name),
        filename: rel ? `${rel}/${entry.name}` : entry.name,
        folder: rel,
      });
    }
  }
  return results;
}

function parseTicketFile(
  filepath: string,
  filename: string,
  folder: string,
): Ticket & { created: string } {
  const raw = fs.readFileSync(filepath, "utf-8");
  const { data, content } = matter(raw);
  return {
    id: String(data.id || ""),
    title: data.title || "",
    status: data.status || "open",
    type: data.type || "task",
    priority: data.priority ?? 2,
    assignee: data.assignee || "",
    tags: data.tags || [],
    deps: data.deps || [],
    links: data.links || [],
    created: data.created ? String(data.created) : "",
    body: content.trim(),
    folder,
    filename,
  };
}

// --- Hydration ---

/**
 * Hydrate the Sledge ledger from .md files on disk.
 * Uses dedupeKey per file to prevent double-ingestion on restart.
 */
export async function hydrateFromFiles(
  ledger: Ledger,
  ticketsDir: string,
): Promise<number> {
  const files = walkTickets(ticketsDir);
  let count = 0;
  for (const { filepath, filename, folder } of files) {
    const ticket = parseTicketFile(filepath, filename, folder);
    if (ticket.id) {
      await ledger.emit("ticket.created", ticket, {
        dedupeKey: `hydrate:${ticket.id}`,
      });
      count++;
    }
  }
  return count;
}

// --- Projection ---

/**
 * Project a ticket to a .md file on disk.
 * Uses content-hash loop guard to prevent chokidar feedback.
 */
export function projectTicketToFile(ticket: Ticket, ticketsDir: string): string {
  const frontmatter: Record<string, unknown> = {
    id: ticket.id,
    title: ticket.title,
    status: ticket.status,
    deps: ticket.deps,
    links: ticket.links,
    created: ticket.created,
    type: ticket.type,
    priority: ticket.priority,
    assignee: ticket.assignee,
    tags: ticket.tags,
  };

  const targetDir = ticket.folder
    ? path.join(ticketsDir, ticket.folder)
    : ticketsDir;

  fs.mkdirSync(targetDir, { recursive: true });

  const filepath = path.join(ticketsDir, ticket.filename);
  const content = matter.stringify(ticket.body, frontmatter);
  fs.writeFileSync(filepath, content);

  markAsProjected(filepath, content);

  return filepath;
}

// --- File → Ledger sync ---

/**
 * Sync a file change into the ledger.
 * Diffs against current projection — only emits if actually changed.
 */
export async function syncFileToLedger(
  filepath: string,
  ledger: Ledger,
  ticketsDir: string,
): Promise<string | null> {
  if (isOwnProjection(filepath)) return null;

  const ticketId = extractTicketId(filepath);
  if (!ticketId) return null;

  try {
    const relPath = path.relative(ticketsDir, filepath);
    const folder = path.dirname(relPath) === "." ? "" : path.dirname(relPath);
    const parsed = parseTicketFile(filepath, relPath, folder);

    const existing = (await ledger.query("ticketById", {
      id: ticketId,
    })) as Ticket | null;

    if (existing) {
      // Diff — only emit if something actually changed
      const changed = diffTicket(existing, parsed);
      if (!changed) return null;
      await ledger.emit("ticket.updated", { id: ticketId, ...changed });
    } else {
      await ledger.emit("ticket.created", parsed);
    }

    return ticketId;
  } catch {
    return null;
  }
}

/**
 * Remove a ticket from the ledger when its file is deleted.
 */
export async function removeFileFromLedger(
  filepath: string,
  ledger: Ledger,
): Promise<string | null> {
  if (isOwnProjection(filepath)) return null;

  const ticketId = extractTicketId(filepath);
  if (!ticketId) return null;

  try {
    const existing = (await ledger.query("ticketById", {
      id: ticketId,
    })) as Ticket | null;
    if (existing) {
      await ledger.emit("ticket.deleted", { id: ticketId });
    }
    return ticketId;
  } catch {
    return null;
  }
}

// --- Helpers ---

function extractTicketId(filepath: string): string | null {
  const match = path.basename(filepath).match(TICKET_PATTERN);
  return match ? match[1]! : null;
}

/**
 * Returns only the fields that differ between existing and parsed,
 * or null if nothing changed.
 */
function diffTicket(
  existing: Ticket,
  parsed: Ticket,
): Record<string, unknown> | null {
  const changes: Record<string, unknown> = {};
  const fields = [
    "title",
    "status",
    "type",
    "priority",
    "assignee",
    "body",
    "filename",
    "folder",
  ] as const;

  for (const f of fields) {
    if (existing[f] !== parsed[f]) {
      changes[f] = parsed[f];
    }
  }

  // Array fields — compare by JSON
  for (const f of ["tags", "deps", "links"] as const) {
    if (JSON.stringify(existing[f]) !== JSON.stringify(parsed[f])) {
      changes[f] = parsed[f];
    }
  }

  return Object.keys(changes).length > 0 ? changes : null;
}
