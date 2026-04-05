package main

import (
	"embed"
	"encoding/json"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"os/exec"
	"strings"
	"sync"

	"github.com/fsnotify/fsnotify"
	"github.com/gorilla/websocket"
)

//go:embed templates/*
var templateFS embed.FS

var tmpl = template.Must(template.ParseFS(templateFS, "templates/*.html"))

// --- WebSocket hub ---

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type wsHub struct {
	mu      sync.Mutex
	clients map[*websocket.Conn]bool
}

var hub = &wsHub{clients: make(map[*websocket.Conn]bool)}

func (h *wsHub) add(c *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.clients[c] = true
}

func (h *wsHub) remove(c *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.clients, c)
	c.Close()
}

func (h *wsHub) broadcast(msg string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for c := range h.clients {
		if err := c.WriteMessage(websocket.TextMessage, []byte(msg)); err != nil {
			c.Close()
			delete(h.clients, c)
		}
	}
}

// --- File watcher ---

func startWatcher() {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		log.Printf("fsnotify: %v (live reload disabled)", err)
		return
	}

	dir := ticketsDir()
	if err := watcher.Add(dir); err != nil {
		log.Printf("watch %s: %v (live reload disabled)", dir, err)
		return
	}
	log.Printf("Watching %s for changes", dir)

	go func() {
		for {
			select {
			case event, ok := <-watcher.Events:
				if !ok {
					return
				}
				if event.Has(fsnotify.Create) || event.Has(fsnotify.Write) ||
					event.Has(fsnotify.Remove) || event.Has(fsnotify.Rename) {
					if strings.HasSuffix(event.Name, ".md") {
						hub.broadcast("reload")
					}
				}
			case err, ok := <-watcher.Errors:
				if !ok {
					return
				}
				log.Printf("watcher error: %v", err)
			}
		}
	}()
}

// --- HTTP handlers ---

func handleIndex(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if err := tmpl.ExecuteTemplate(w, "index.html", nil); err != nil {
		http.Error(w, err.Error(), 500)
	}
}

func handleGetTickets(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", 405)
		return
	}
	tickets, err := loadAllTickets()
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	if tickets == nil {
		tickets = []Ticket{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tickets)
}

// CreateTicketRequest is the payload for POST /api/tickets.
type CreateTicketRequest struct {
	Title    string `json:"title"`
	Type     string `json:"type"`
	Priority string `json:"priority"`
	Status   string `json:"status"`
}

func handleCreateTicket(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", 405)
		return
	}

	var req CreateTicketRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request: "+err.Error(), 400)
		return
	}
	if req.Title == "" {
		http.Error(w, "title is required", 400)
		return
	}

	// Build tix CLI args
	args := []string{"create", req.Title}
	if req.Type != "" {
		args = append(args, "--type", req.Type)
	}
	if req.Priority != "" {
		args = append(args, "--priority", req.Priority)
	}
	if req.Status != "" {
		args = append(args, "--status", req.Status)
	}

	cmd := exec.Command("tix", args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		http.Error(w, fmt.Sprintf("tix create failed: %v\n%s", err, string(output)), 500)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status": "created",
		"output": strings.TrimSpace(string(output)),
	})
}

// UpdateTicketRequest is the payload for POST /api/tickets/:id.
type UpdateTicketRequest struct {
	Status   *string `json:"status,omitempty"`
	Type     *string `json:"type,omitempty"`
	Priority *int    `json:"priority,omitempty"`
	Assignee *string `json:"assignee,omitempty"`
	Body     *string `json:"body,omitempty"`
}

func handleUpdateTicket(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", 405)
		return
	}

	// Extract ID from path: /api/tickets/{id}
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/tickets/"), "/")
	ticketID := parts[0]
	if ticketID == "" {
		http.Error(w, "missing ticket id", 400)
		return
	}

	var req UpdateTicketRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request: "+err.Error(), 400)
		return
	}

	// Find the ticket file
	tickets, err := loadAllTickets()
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}

	var found *Ticket
	for i := range tickets {
		if tickets[i].ID == ticketID {
			found = &tickets[i]
			break
		}
	}
	if found == nil {
		http.Error(w, "ticket not found: "+ticketID, 404)
		return
	}

	// Apply updates
	if req.Status != nil {
		found.Status = *req.Status
	}
	if req.Type != nil {
		found.Type = *req.Type
	}
	if req.Priority != nil {
		found.Priority = *req.Priority
	}
	if req.Assignee != nil {
		found.Assignee = *req.Assignee
	}
	if req.Body != nil {
		found.Body = *req.Body
	}

	if err := writeTicketFile(*found); err != nil {
		http.Error(w, "write failed: "+err.Error(), 500)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(found)
}

func handleWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("ws upgrade: %v", err)
		return
	}
	hub.add(conn)
	defer hub.remove(conn)

	// Keep connection alive; read loop discards client messages
	for {
		if _, _, err := conn.ReadMessage(); err != nil {
			break
		}
	}
}

// setupRoutes registers all HTTP routes on the default mux.
func setupRoutes() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("/", handleIndex)
	mux.HandleFunc("/api/tickets", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			handleGetTickets(w, r)
		case http.MethodPost:
			handleCreateTicket(w, r)
		default:
			http.Error(w, "method not allowed", 405)
		}
	})
	mux.HandleFunc("/api/tickets/", handleUpdateTicket)
	mux.HandleFunc("/ws", handleWS)
	return mux
}
