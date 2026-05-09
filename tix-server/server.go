package main

import (
	"crypto/rand"
	"embed"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

//go:embed ui
var uiFS embed.FS

type Server struct {
	wsPath     string
	ticketsDir string
	port       int
	db         *DB
	hub        *WSHub
	watcher    *Watcher
}

func NewServer(wsPath, ticketsDir, dbPath string, port int) (*Server, error) {
	db, err := OpenDB(dbPath)
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}

	hub := NewWSHub()
	watcher := NewWatcher(ticketsDir, db, hub)

	srv := &Server{
		wsPath:     wsPath,
		ticketsDir: ticketsDir,
		port:       port,
		db:         db,
		hub:        hub,
		watcher:    watcher,
	}
	return srv, nil
}

func (s *Server) Start() error {
	// Hydrate DB from disk on startup.
	s.hydrate()

	// Launch file watcher in background.
	go s.watcher.Start()

	mux := http.NewServeMux()

	// WebSocket
	mux.HandleFunc("/ws", s.hub.ServeWS)

	// REST API
	mux.HandleFunc("/api/config", s.handleConfig)
	mux.HandleFunc("/api/tickets", s.handleTickets)
	mux.HandleFunc("/api/tickets/", s.handleTicket)
	mux.HandleFunc("/api/search", s.handleSearch)
	mux.HandleFunc("/api/events", s.handleEvents)
	mux.HandleFunc("/api/workspaces", s.handleWorkspaces)

	// SPA static assets — serve with fallback to index.html
	sub, err := fs.Sub(uiFS, "ui")
	if err != nil {
		log.Printf("[server] no embedded UI assets; serving API only")
		sub = nil
	}
	mux.HandleFunc("/", s.spaHandler(sub))

	addr := fmt.Sprintf(":%d", s.port)
	return http.ListenAndServe(addr, mux)
}

// hydrate loads all .md files from ticketsDir into the DB on startup.
func (s *Server) hydrate() {
	if _, err := os.Stat(s.ticketsDir); os.IsNotExist(err) {
		return
	}
	n := 0
	_ = filepath.Walk(s.ticketsDir, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}
		if ExtractID(path) == "" {
			return nil
		}
		t, hash, err := ParseTicketFile(path, s.ticketsDir)
		if err != nil || t == nil {
			return nil
		}
		if err := s.db.UpsertTicket(*t, hash); err != nil {
			log.Printf("[hydrate] %s: %v", t.ID, err)
		}
		n++
		return nil
	})
	log.Printf("[hydrate] loaded %d tickets from %s", n, s.ticketsDir)
}

// --- Handlers ---

func (s *Server) handleConfig(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	wsName := os.Getenv("TIX_UI_NAME")
	if wsName == "" {
		wsName = filepath.Base(s.wsPath)
	}
	jsonOK(w, map[string]string{
		"ticketsDir":    s.ticketsDir,
		"workspaceName": wsName,
		"workspacePath": s.wsPath,
	})
}

func (s *Server) handleTickets(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		tickets, err := s.db.GetTickets()
		if err != nil {
			jsonErr(w, err, http.StatusInternalServerError)
			return
		}
		jsonOK(w, tickets)

	case http.MethodPost:
		var body struct {
			Title       string   `json:"title"`
			Description string   `json:"description"`
			Type        string   `json:"type"`
			Priority    *int     `json:"priority"`
			Assignee    string   `json:"assignee"`
			Tags        []string `json:"tags"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			jsonErr(w, err, http.StatusBadRequest)
			return
		}
		if body.Title == "" {
			jsonErr(w, fmt.Errorf("title is required"), http.StatusBadRequest)
			return
		}

		id, err := NextTicketID(s.ticketsDir)
		if err != nil {
			jsonErr(w, err, http.StatusInternalServerError)
			return
		}
		cleanTitle := sanitizeTitle(body.Title)
		filename := cleanTitle + " (" + id + ").md"
		prio := 2
		if body.Priority != nil {
			prio = *body.Priority
		}
		t := Ticket{
			ID:       id,
			Title:    body.Title,
			Status:   "open",
			Type:     coalesce(body.Type, "task"),
			Priority: prio,
			Assignee: body.Assignee,
			Tags:     defaultSlice(body.Tags),
			Deps:     []string{},
			Body:     body.Description,
			Filename: filename,
			Folder:   "",
			Created:  nowISO(),
		}

		if err := os.MkdirAll(s.ticketsDir, 0755); err != nil {
			jsonErr(w, err, http.StatusInternalServerError)
			return
		}

		content, err := ProjectTicketToFile(t, s.ticketsDir)
		if err != nil {
			jsonErr(w, err, http.StatusInternalServerError)
			return
		}
		hash := fileHash(content)
		s.watcher.MarkProjected(filepath.Join(s.ticketsDir, filename), hash)

		if err := s.db.UpsertTicket(t, hash); err != nil {
			jsonErr(w, err, http.StatusInternalServerError)
			return
		}
		s.db.LogEvent("ticket.created", id, t)
		s.hub.BroadcastTicketUpsert(id)
		jsonOK(w, map[string]string{"ok": "true", "id": id})

	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *Server) handleTicket(w http.ResponseWriter, r *http.Request) {
	// Path: /api/tickets/{id}  or /api/tickets/{id}/events
	path := strings.TrimPrefix(r.URL.Path, "/api/tickets/")
	parts := strings.SplitN(path, "/", 2)
	id := parts[0]
	subpath := ""
	if len(parts) > 1 {
		subpath = parts[1]
	}

	if id == "" {
		http.Error(w, "missing ticket id", http.StatusBadRequest)
		return
	}

	if subpath == "events" {
		s.handleTicketEvents(w, r, id)
		return
	}

	switch r.Method {
	case http.MethodGet:
		t, err := s.db.GetTicket(id)
		if err != nil {
			jsonErr(w, err, http.StatusInternalServerError)
			return
		}
		if t == nil {
			jsonErr(w, fmt.Errorf("ticket %s not found", id), http.StatusNotFound)
			return
		}
		jsonOK(w, t)

	case http.MethodPatch:
		existing, err := s.db.GetTicket(id)
		if err != nil || existing == nil {
			jsonErr(w, fmt.Errorf("ticket %s not found", id), http.StatusNotFound)
			return
		}

		var updates map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
			jsonErr(w, err, http.StatusBadRequest)
			return
		}

		oldFilename := existing.Filename
		applyUpdates(existing, updates)
		content, err := ProjectTicketToFile(*existing, s.ticketsDir)
		if err != nil {
			jsonErr(w, err, http.StatusInternalServerError)
			return
		}
		hash := fileHash(content)
		fullPath := filepath.Join(s.ticketsDir, filepath.FromSlash(existing.Filename))
		s.watcher.MarkProjected(fullPath, hash)
		if existing.Filename != oldFilename {
			oldPath := filepath.Join(s.ticketsDir, filepath.FromSlash(oldFilename))
			s.watcher.MarkDeleted(oldPath)
			_ = os.Remove(oldPath)
		}

		if err := s.db.UpsertTicket(*existing, hash); err != nil {
			jsonErr(w, err, http.StatusInternalServerError)
			return
		}
		s.db.LogEvent("ticket.updated", id, updates)
		s.hub.BroadcastTicketUpsert(id)
		jsonOK(w, map[string]bool{"ok": true})

	case http.MethodDelete:
		existing, err := s.db.GetTicket(id)
		if err != nil || existing == nil {
			jsonErr(w, fmt.Errorf("ticket %s not found", id), http.StatusNotFound)
			return
		}

		fullPath := filepath.Join(s.ticketsDir, filepath.FromSlash(existing.Filename))
		s.watcher.MarkDeleted(fullPath)
		_ = os.Remove(fullPath)

		if err := s.db.DeleteTicket(id); err != nil {
			jsonErr(w, err, http.StatusInternalServerError)
			return
		}
		s.db.LogEvent("ticket.deleted", id, map[string]string{"id": id})
		s.hub.BroadcastTicketDelete(id)
		jsonOK(w, map[string]bool{"ok": true})

	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *Server) handleTicketEvents(w http.ResponseWriter, r *http.Request, ticketID string) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	events, err := s.db.GetTicketEvents(ticketID, limit)
	if err != nil {
		jsonErr(w, err, http.StatusInternalServerError)
		return
	}
	jsonOK(w, events)
}

func (s *Server) handleSearch(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	q := r.URL.Query().Get("q")
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	tickets, err := s.db.SearchTickets(q, limit)
	if err != nil {
		jsonErr(w, err, http.StatusInternalServerError)
		return
	}
	jsonOK(w, tickets)
}

func (s *Server) handleEvents(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	before, _ := strconv.ParseInt(r.URL.Query().Get("before"), 10, 64)
	events, err := s.db.GetRecentEvents(limit, before)
	if err != nil {
		jsonErr(w, err, http.StatusInternalServerError)
		return
	}
	jsonOK(w, events)
}

func (s *Server) handleWorkspaces(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	reg := loadRegistry()
	type ws struct {
		Name string `json:"name"`
		Path string `json:"path"`
	}
	out := []ws{}
	for name, path := range reg.Workspaces {
		out = append(out, ws{Name: name, Path: path})
	}
	jsonOK(w, out)
}

// spaHandler serves static assets and falls back to index.html for SPA routing.
func (s *Server) spaHandler(sub fs.FS) http.HandlerFunc {
	if sub == nil {
		return func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, "no UI assets embedded — run 'make build-ui' first", http.StatusNotFound)
		}
	}
	fileServer := http.FileServer(http.FS(sub))
	return func(w http.ResponseWriter, r *http.Request) {
		// Try to serve the file directly.
		path := strings.TrimPrefix(r.URL.Path, "/")
		if path == "" {
			path = "index.html"
		}
		if _, err := fs.Stat(sub, path); err == nil {
			fileServer.ServeHTTP(w, r)
			return
		}
		// SPA fallback: serve index.html for all unknown paths.
		r2 := *r
		r2.URL.Path = "/"
		fileServer.ServeHTTP(w, &r2)
	}
}

// --- Helpers ---

func applyUpdates(t *Ticket, updates map[string]interface{}) {
	if v, ok := updates["title"].(string); ok {
		t.Title = v
		// Sync filename on title change
		cleanTitle := sanitizeTitle(v)
		base := cleanTitle + " (" + t.ID + ").md"
		if t.Folder != "" {
			t.Filename = t.Folder + "/" + base
		} else {
			t.Filename = base
		}
	}
	if v, ok := updates["status"].(string); ok {
		t.Status = v
	}
	if v, ok := updates["type"].(string); ok {
		t.Type = v
	}
	if v, ok := updates["priority"].(float64); ok {
		t.Priority = int(v)
	}
	if v, ok := updates["assignee"].(string); ok {
		t.Assignee = v
	}
	if v, ok := updates["body"].(string); ok {
		t.Body = v
	}
	if v, ok := updates["folder"].(string); ok {
		t.Folder = v
		base := sanitizeTitle(t.Title) + " (" + t.ID + ").md"
		if v != "" {
			t.Filename = v + "/" + base
		} else {
			t.Filename = base
		}
	}
	if arr, ok := updates["tags"].([]interface{}); ok {
		tags := make([]string, 0, len(arr))
		for _, v := range arr {
			if s, ok := v.(string); ok {
				tags = append(tags, s)
			}
		}
		t.Tags = tags
	}
	if arr, ok := updates["deps"].([]interface{}); ok {
		deps := make([]string, 0, len(arr))
		for _, v := range arr {
			if s, ok := v.(string); ok {
				deps = append(deps, s)
			}
		}
		t.Deps = deps
	}
}

func jsonOK(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}

func jsonErr(w http.ResponseWriter, err error, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
}

func generateID() string {
	b := make([]byte, 2)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// sanitizeTitle is now in sanitize.go (SanitizeTitle).
func sanitizeTitle(title string) string { return SanitizeTitle(title) }

func nowISO() string {
	return time.Now().UTC().Format(time.RFC3339)
}
