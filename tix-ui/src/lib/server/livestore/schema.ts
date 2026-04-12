import { Events, makeSchema, Schema, State } from '@livestore/livestore'

// --- Events ---

export const events = {
  ticketCreated: Events.synced({
    name: 'v1.TicketCreated',
    schema: Schema.Struct({
      id: Schema.String,
      title: Schema.String,
      status: Schema.String,
      type: Schema.String,
      priority: Schema.Number,
      assignee: Schema.String,
      tags: Schema.Array(Schema.String),
      deps: Schema.Array(Schema.String),
      links: Schema.Array(Schema.String),
      created: Schema.String,
      body: Schema.String,
      folder: Schema.String,
      filename: Schema.String,
    }),
  }),

  ticketUpdated: Events.synced({
    name: 'v1.TicketUpdated',
    schema: Schema.Struct({
      id: Schema.String,
      title: Schema.optionalWith(Schema.String, { exact: true }),
      status: Schema.optionalWith(Schema.String, { exact: true }),
      type: Schema.optionalWith(Schema.String, { exact: true }),
      priority: Schema.optionalWith(Schema.Number, { exact: true }),
      assignee: Schema.optionalWith(Schema.String, { exact: true }),
      tags: Schema.optionalWith(Schema.Array(Schema.String), { exact: true }),
      deps: Schema.optionalWith(Schema.Array(Schema.String), { exact: true }),
      links: Schema.optionalWith(Schema.Array(Schema.String), { exact: true }),
      body: Schema.optionalWith(Schema.String, { exact: true }),
      folder: Schema.optionalWith(Schema.String, { exact: true }),
      filename: Schema.optionalWith(Schema.String, { exact: true }),
    }),
  }),

  ticketDeleted: Events.synced({
    name: 'v1.TicketDeleted',
    schema: Schema.Struct({ id: Schema.String }),
  }),
}

// --- Tables ---

export const tables = {
  tickets: State.SQLite.table({
    name: 'tickets',
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      title: State.SQLite.text({ default: '' }),
      status: State.SQLite.text({ default: 'open' }),
      type: State.SQLite.text({ default: 'task' }),
      priority: State.SQLite.integer({ default: 2 }),
      assignee: State.SQLite.text({ default: '' }),
      tags: State.SQLite.text({ default: '[]' }),
      deps: State.SQLite.text({ default: '[]' }),
      links: State.SQLite.text({ default: '[]' }),
      created: State.SQLite.text({ default: '' }),
      body: State.SQLite.text({ default: '' }),
      folder: State.SQLite.text({ default: '' }),
      filename: State.SQLite.text({ default: '' }),
    },
  }),
}

// --- Materializers ---

const materializers = State.SQLite.materializers(events, {
  'v1.TicketCreated': (e) =>
    tables.tickets.insert({
      id: e.id,
      title: e.title,
      status: e.status,
      type: e.type,
      priority: e.priority,
      assignee: e.assignee,
      tags: JSON.stringify(e.tags),
      deps: JSON.stringify(e.deps),
      links: JSON.stringify(e.links),
      created: e.created,
      body: e.body,
      folder: e.folder,
      filename: e.filename,
    }),

  'v1.TicketUpdated': ({ id, ...updates }) => {
    const fields: Record<string, unknown> = {}
    if (updates.title !== undefined) fields.title = updates.title
    if (updates.status !== undefined) fields.status = updates.status
    if (updates.type !== undefined) fields.type = updates.type
    if (updates.priority !== undefined) fields.priority = updates.priority
    if (updates.assignee !== undefined) fields.assignee = updates.assignee
    if (updates.tags !== undefined) fields.tags = JSON.stringify(updates.tags)
    if (updates.deps !== undefined) fields.deps = JSON.stringify(updates.deps)
    if (updates.links !== undefined) fields.links = JSON.stringify(updates.links)
    if (updates.body !== undefined) fields.body = updates.body
    if (updates.folder !== undefined) fields.folder = updates.folder
    if (updates.filename !== undefined) fields.filename = updates.filename
    return tables.tickets.update(fields).where({ id })
  },

  'v1.TicketDeleted': ({ id }) =>
    tables.tickets.delete().where({ id }),
})

// --- Schema ---

const state = State.SQLite.makeState({ tables, materializers })
export const schema = makeSchema({ events, state })
