import { createServerFn } from '@tanstack/react-start'
import { getLedger, getDb } from './sledge/singleton'

export interface ActivityEvent {
  eventId: number
  tsMs: number
  eventName: string
  entityId: string
  entityTitle: string | null
  changes: Record<string, string | number | boolean | string[]> | null
}

type EventRow = {
  event_id: number
  ts_ms: number
  event_name: string
  payload_json: string
  ticket_title: string | null
}

function rowToActivityEvent(row: EventRow): ActivityEvent {
  const payload = JSON.parse(row.payload_json)
  const entityId: string = payload.id ?? ''

  let changes: ActivityEvent['changes'] = null
  if (row.event_name === 'ticket.updated') {
    const { id, ...rest } = payload
    if (Object.keys(rest).length > 0) changes = rest
  }

  return {
    eventId: row.event_id,
    tsMs: row.ts_ms,
    eventName: row.event_name,
    entityId,
    entityTitle: row.ticket_title ?? payload.title ?? null,
    changes,
  }
}

export const getRecentEvents = createServerFn({ method: 'GET' })
  .inputValidator((data: { limit?: number; before?: number }) => data)
  .handler(async ({ data }) => {
    await getLedger()
    const db = getDb()
    const limit = data.limit ?? 50
    const before = data.before ?? Number.MAX_SAFE_INTEGER

    const rows = db.prepare(`
      SELECT
        e.event_id,
        e.ts_ms,
        e.event_name,
        e.payload_json,
        t.title AS ticket_title
      FROM events e
      LEFT JOIN tickets t ON t.id = json_extract(e.payload_json, '$.id')
      WHERE e.event_id < ?
      ORDER BY e.event_id DESC
      LIMIT ?
    `).all(before, limit) as EventRow[]

    return rows.map(rowToActivityEvent)
  })

export const getTicketEvents = createServerFn({ method: 'GET' })
  .inputValidator((data: { ticketId: string; limit?: number }) => data)
  .handler(async ({ data }) => {
    await getLedger()
    const db = getDb()
    const limit = data.limit ?? 100

    const rows = db.prepare(`
      SELECT
        e.event_id,
        e.ts_ms,
        e.event_name,
        e.payload_json,
        t.title AS ticket_title
      FROM events e
      LEFT JOIN tickets t ON t.id = json_extract(e.payload_json, '$.id')
      WHERE json_extract(e.payload_json, '$.id') = ?
      ORDER BY e.event_id DESC
      LIMIT ?
    `).all(data.ticketId, limit) as EventRow[]

    return rows.map(rowToActivityEvent)
  })
