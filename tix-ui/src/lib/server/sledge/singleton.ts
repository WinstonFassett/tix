import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import { createTicketLedger } from "./ticket-ledger";
import { hydrateFromFiles } from "./sync";

// globalThis singleton — shared across Vite's SSR module contexts
// (Nitro server routes + TanStack Start server functions).
const _g = globalThis as unknown as {
  __tixLedger?: ReturnType<typeof createTicketLedger> | null;
  __tixLedgerPromise?: Promise<ReturnType<typeof createTicketLedger>> | null;
  __tixDb?: Database.Database | null;
};

function resolveTicketsDir(): string {
  return (
    process.env.TICKETS_DIR ||
    path.join(
      process.env.TIX_WORKSPACE ||
        process.env.TICKET_WORKSPACE ||
        process.cwd(),
      "tickets",
    )
  );
}

function resolveStorageDir(): string {
  const ticketsDir = resolveTicketsDir();
  const tixDir = path.join(path.dirname(ticketsDir), ".tix");
  fs.mkdirSync(tixDir, { recursive: true });
  return tixDir;
}

/**
 * Get or initialize the shared Sledge ticket ledger.
 * First call hydrates from existing .md files on disk if DB is empty.
 */
export async function getLedger(): Promise<
  ReturnType<typeof createTicketLedger>
> {
  if (_g.__tixLedger) return _g.__tixLedger;
  if (_g.__tixLedgerPromise) return _g.__tixLedgerPromise;

  _g.__tixLedgerPromise = (async () => {
    try {
      const storageDir = resolveStorageDir();
      const dbPath = path.join(storageDir, "sledge.db");
      const db = new Database(dbPath);
      db.pragma("journal_mode = WAL");

      _g.__tixDb = db;
      const ledger = createTicketLedger(db);

      // If projection table is empty, hydrate from .md files on disk
      const ticketsDir = resolveTicketsDir();
      const existing = (await ledger.query("allTickets", {})) as unknown[];
      if (existing.length === 0) {
        const count = await hydrateFromFiles(ledger, ticketsDir);
        if (count > 0) {
          console.log(
            `[tix-sledge] Hydrated ${count} tickets from ${ticketsDir}`,
          );
        }
      }

      _g.__tixLedger = ledger;
      return ledger;
    } catch (err) {
      _g.__tixLedgerPromise = null;
      throw err;
    }
  })();

  return _g.__tixLedgerPromise;
}

/**
 * Get the tickets directory path.
 */
export function getTicketsDir(): string {
  return resolveTicketsDir();
}

/**
 * Get the underlying better-sqlite3 database (for direct queries like events).
 * Must be called after getLedger() has initialized.
 */
export function getDb(): Database.Database {
  if (!_g.__tixDb) throw new Error('Ledger not initialized — call getLedger() first')
  return _g.__tixDb
}

/**
 * Shutdown the ledger (for graceful shutdown / tests).
 */
export async function shutdownLedger(): Promise<void> {
  if (_g.__tixLedger) {
    await _g.__tixLedger.close();
    _g.__tixLedger = null;
    _g.__tixLedgerPromise = null;
  }
}
