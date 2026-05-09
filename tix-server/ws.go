package main

import (
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type WSHub struct {
	mu      sync.Mutex
	clients map[*websocket.Conn]struct{}
}

func NewWSHub() *WSHub {
	return &WSHub{clients: map[*websocket.Conn]struct{}{}}
}

func (h *WSHub) ServeWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[ws] upgrade error: %v", err)
		return
	}

	// Send hello so client knows connection is live (and can detect reconnects).
	_ = conn.WriteJSON(map[string]string{"event": "hello"})

	h.mu.Lock()
	h.clients[conn] = struct{}{}
	h.mu.Unlock()

	// Drain incoming messages; close on disconnect.
	go func() {
		defer func() {
			h.mu.Lock()
			delete(h.clients, conn)
			h.mu.Unlock()
			conn.Close()
		}()
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				break
			}
		}
	}()
}

func (h *WSHub) Broadcast(msg interface{}) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for conn := range h.clients {
		if err := conn.WriteJSON(msg); err != nil {
			delete(h.clients, conn)
			conn.Close()
		}
	}
}

func (h *WSHub) BroadcastTicketUpsert(id string) {
	h.Broadcast(map[string]string{"event": "ticket-upsert", "id": id})
}

func (h *WSHub) BroadcastTicketDelete(id string) {
	h.Broadcast(map[string]string{"event": "ticket-delete", "id": id})
}
