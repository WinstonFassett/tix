package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

type DB struct {
	db *sql.DB
}

func OpenDB(path string) (*DB, error) {
	db, err := sql.Open("sqlite", path+"?_journal_mode=WAL&_synchronous=NORMAL&_foreign_keys=on")
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	d := &DB{db: db}
	if err := d.migrate(); err != nil {
		return nil, fmt.Errorf("migrate: %w", err)
	}
	return d, nil
}

func (d *DB) migrate() error {
	_, err := d.db.Exec(`
		CREATE TABLE IF NOT EXISTS tickets (
			id           TEXT PRIMARY KEY,
			title        TEXT NOT NULL,
			status       TEXT NOT NULL DEFAULT 'open',
			type         TEXT NOT NULL DEFAULT 'task',
			priority     INTEGER NOT NULL DEFAULT 2,
			tags         TEXT NOT NULL DEFAULT '[]',
			deps         TEXT NOT NULL DEFAULT '[]',
			assignee     TEXT NOT NULL DEFAULT '',
			body         TEXT NOT NULL DEFAULT '',
			filename     TEXT NOT NULL DEFAULT '',
			folder       TEXT NOT NULL DEFAULT '',
			created      TEXT NOT NULL DEFAULT '',
			content_hash TEXT NOT NULL DEFAULT ''
		);

		CREATE TABLE IF NOT EXISTS events (
			id           INTEGER PRIMARY KEY AUTOINCREMENT,
			ts_ms        INTEGER NOT NULL,
			event_name   TEXT NOT NULL,
			ticket_id    TEXT NOT NULL,
			payload_json TEXT NOT NULL
		);

		CREATE INDEX IF NOT EXISTS events_ticket_id ON events (ticket_id);
		CREATE INDEX IF NOT EXISTS events_ts_ms ON events (ts_ms DESC);
	`)
	return err
}

// --- Ticket CRUD ---

func (d *DB) GetTickets() ([]Ticket, error) {
	rows, err := d.db.Query(`
		SELECT id, title, status, type, priority, tags, deps, assignee, body, filename, folder, created
		FROM tickets ORDER BY created DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanTickets(rows)
}

func (d *DB) GetTicket(id string) (*Ticket, error) {
	row := d.db.QueryRow(`
		SELECT id, title, status, type, priority, tags, deps, assignee, body, filename, folder, created
		FROM tickets WHERE id = ?
	`, id)
	return scanTicket(row)
}

func (d *DB) SearchTickets(query string, limit int) ([]Ticket, error) {
	if limit <= 0 {
		limit = 50
	}
	q := "%" + strings.ToLower(query) + "%"
	rows, err := d.db.Query(`
		SELECT id, title, status, type, priority, tags, deps, assignee, body, filename, folder, created
		FROM tickets
		WHERE LOWER(title) LIKE ? OR LOWER(body) LIKE ? OR LOWER(tags) LIKE ?
		ORDER BY created DESC LIMIT ?
	`, q, q, q, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanTickets(rows)
}

func (d *DB) UpsertTicket(t Ticket, hash string) error {
	tagsJSON, _ := json.Marshal(t.Tags)
	depsJSON, _ := json.Marshal(t.Deps)
	_, err := d.db.Exec(`
		INSERT INTO tickets (id, title, status, type, priority, tags, deps, assignee, body, filename, folder, created, content_hash)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			title=excluded.title, status=excluded.status, type=excluded.type,
			priority=excluded.priority, tags=excluded.tags, deps=excluded.deps,
			assignee=excluded.assignee, body=excluded.body, filename=excluded.filename,
			folder=excluded.folder, created=excluded.created, content_hash=excluded.content_hash
	`,
		t.ID, t.Title, t.Status, t.Type, t.Priority,
		string(tagsJSON), string(depsJSON),
		t.Assignee, t.Body, t.Filename, t.Folder, t.Created, hash,
	)
	return err
}

func (d *DB) DeleteTicket(id string) error {
	_, err := d.db.Exec(`DELETE FROM tickets WHERE id = ?`, id)
	return err
}

func (d *DB) GetContentHash(id string) string {
	var hash string
	_ = d.db.QueryRow(`SELECT content_hash FROM tickets WHERE id = ?`, id).Scan(&hash)
	return hash
}

func (d *DB) UpdateFilename(id, filename string) error {
	_, err := d.db.Exec(`UPDATE tickets SET filename = ? WHERE id = ?`, filename, id)
	return err
}

// --- Activity events ---

type ActivityEvent struct {
	EventID     int64                  `json:"eventId"`
	TsMs        int64                  `json:"tsMs"`
	EventName   string                 `json:"eventName"`
	EntityID    string                 `json:"entityId"`
	EntityTitle string                 `json:"entityTitle"`
	Changes     map[string]interface{} `json:"changes"`
}

func (d *DB) LogEvent(name, ticketID string, payload interface{}) {
	data, _ := json.Marshal(payload)
	_, _ = d.db.Exec(
		`INSERT INTO events (ts_ms, event_name, ticket_id, payload_json) VALUES (?, ?, ?, ?)`,
		time.Now().UnixMilli(), name, ticketID, string(data),
	)
}

func (d *DB) GetRecentEvents(limit int, before int64) ([]ActivityEvent, error) {
	if limit <= 0 {
		limit = 50
	}
	if before <= 0 {
		before = 1<<62 - 1
	}
	rows, err := d.db.Query(`
		SELECT e.id, e.ts_ms, e.event_name, e.ticket_id, e.payload_json, t.title
		FROM events e
		LEFT JOIN tickets t ON t.id = e.ticket_id
		WHERE e.id < ?
		ORDER BY e.id DESC LIMIT ?
	`, before, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanEvents(rows)
}

func (d *DB) GetTicketEvents(ticketID string, limit int) ([]ActivityEvent, error) {
	if limit <= 0 {
		limit = 100
	}
	rows, err := d.db.Query(`
		SELECT e.id, e.ts_ms, e.event_name, e.ticket_id, e.payload_json, t.title
		FROM events e
		LEFT JOIN tickets t ON t.id = e.ticket_id
		WHERE e.ticket_id = ?
		ORDER BY e.id DESC LIMIT ?
	`, ticketID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanEvents(rows)
}

// --- Scan helpers ---

func scanTickets(rows *sql.Rows) ([]Ticket, error) {
	var out []Ticket
	for rows.Next() {
		t, err := scanTicketRow(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	if out == nil {
		out = []Ticket{}
	}
	return out, rows.Err()
}

type scanner interface {
	Scan(dest ...any) error
}

func scanTicket(row *sql.Row) (*Ticket, error) {
	t, err := scanTicketRow(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func scanTicketRow(s scanner) (Ticket, error) {
	var t Ticket
	var tagsJSON, depsJSON string
	err := s.Scan(&t.ID, &t.Title, &t.Status, &t.Type, &t.Priority,
		&tagsJSON, &depsJSON, &t.Assignee, &t.Body, &t.Filename, &t.Folder, &t.Created)
	if err != nil {
		return t, err
	}
	_ = json.Unmarshal([]byte(tagsJSON), &t.Tags)
	_ = json.Unmarshal([]byte(depsJSON), &t.Deps)
	if t.Tags == nil {
		t.Tags = []string{}
	}
	if t.Deps == nil {
		t.Deps = []string{}
	}
	return t, nil
}

func scanEvents(rows *sql.Rows) ([]ActivityEvent, error) {
	var out []ActivityEvent
	for rows.Next() {
		var e ActivityEvent
		var payloadJSON string
		var title sql.NullString
		if err := rows.Scan(&e.EventID, &e.TsMs, &e.EventName, &e.EntityID, &payloadJSON, &title); err != nil {
			return nil, err
		}
		if title.Valid {
			e.EntityTitle = title.String
		}
		var payload map[string]interface{}
		_ = json.Unmarshal([]byte(payloadJSON), &payload)
		if e.EventName == "ticket.updated" {
			changes := map[string]interface{}{}
			for k, v := range payload {
				if k != "id" {
					changes[k] = v
				}
			}
			if len(changes) > 0 {
				e.Changes = changes
			}
		}
		out = append(out, e)
	}
	if out == nil {
		out = []ActivityEvent{}
	}
	return out, rows.Err()
}
