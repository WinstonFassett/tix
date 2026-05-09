package main

import (
	"log"
	"path/filepath"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
)

// Watcher watches a tickets directory and syncs changes to the DB.
// It uses a content-hash loop guard to skip files we just projected.
type Watcher struct {
	ticketsDir string
	db         *DB
	hub        *WSHub

	mu          sync.Mutex
	ownHashes   map[string]string // filepath → hash we wrote
	ownDeletes  map[string]struct{}

	pendingMu      sync.Mutex
	pendingDeletes map[string]*time.Timer
}

func NewWatcher(ticketsDir string, db *DB, hub *WSHub) *Watcher {
	return &Watcher{
		ticketsDir:     ticketsDir,
		db:             db,
		hub:            hub,
		ownHashes:      map[string]string{},
		ownDeletes:     map[string]struct{}{},
		pendingDeletes: map[string]*time.Timer{},
	}
}

// MarkProjected records the hash of a file we just wrote so the next
// change event from fsnotify is skipped (loop guard).
func (w *Watcher) MarkProjected(path, hash string) {
	w.mu.Lock()
	w.ownHashes[path] = hash
	w.mu.Unlock()
}

// MarkDeleted records that we deleted a file ourselves.
func (w *Watcher) MarkDeleted(path string) {
	w.mu.Lock()
	w.ownDeletes[path] = struct{}{}
	w.mu.Unlock()
}

func (w *Watcher) isOwnWrite(path string) bool {
	w.mu.Lock()
	defer w.mu.Unlock()
	if _, ok := w.ownDeletes[path]; ok {
		delete(w.ownDeletes, path)
		return true
	}
	storedHash, ok := w.ownHashes[path]
	if !ok {
		return false
	}
	dbHash := w.db.GetContentHash(ExtractID(path))
	if dbHash == storedHash {
		delete(w.ownHashes, path)
		return true
	}
	return false
}

// Start launches the fsnotify watcher. Blocks until the watcher fails.
func (w *Watcher) Start() {
	fw, err := fsnotify.NewWatcher()
	if err != nil {
		log.Printf("[watcher] cannot create watcher: %v", err)
		return
	}
	defer fw.Close()

	if err := fw.Add(w.ticketsDir); err != nil {
		log.Printf("[watcher] cannot watch %s: %v", w.ticketsDir, err)
		return
	}

	// Also watch archive subdirs that already exist.
	// New subdirs are NOT auto-added (fsnotify v1 limitation on some platforms).
	// For the prototype this is acceptable.

	debounce := map[string]*time.Timer{}
	var dmu sync.Mutex

	fire := func(path string, isDelete bool) {
		dmu.Lock()
		if t, ok := debounce[path]; ok {
			t.Stop()
		}
		debounce[path] = time.AfterFunc(60*time.Millisecond, func() {
			dmu.Lock()
			delete(debounce, path)
			dmu.Unlock()
			if isDelete {
				w.handleDelete(path)
			} else {
				w.handleUpsert(path)
			}
		})
		dmu.Unlock()
	}

	for {
		select {
		case event, ok := <-fw.Events:
			if !ok {
				return
			}
			path := filepath.Clean(event.Name)
			if ExtractID(path) == "" {
				// Watch new subdirs so archive moves are caught.
				if event.Has(fsnotify.Create) {
					_ = fw.Add(path)
				}
				continue
			}
			if event.Has(fsnotify.Remove) || event.Has(fsnotify.Rename) {
				fire(path, true)
			} else if event.Has(fsnotify.Create) || event.Has(fsnotify.Write) {
				fire(path, false)
			}
		case err, ok := <-fw.Errors:
			if !ok {
				return
			}
			log.Printf("[watcher] error: %v", err)
		}
	}
}

func (w *Watcher) handleUpsert(path string) {
	if w.isOwnWrite(path) {
		return
	}
	t, hash, err := ParseTicketFile(path, w.ticketsDir)
	if err != nil || t == nil {
		return
	}
	if err := w.db.UpsertTicket(*t, hash); err != nil {
		log.Printf("[watcher] upsert %s: %v", t.ID, err)
		return
	}
	w.db.LogEvent("ticket.updated", t.ID, t)
	w.hub.BroadcastTicketUpsert(t.ID)
}

func (w *Watcher) handleDelete(path string) {
	if w.isOwnWrite(path) {
		return
	}
	id := ExtractID(path)
	if id == "" {
		return
	}
	// Debounce deletes — renames generate a delete+create pair quickly.
	w.pendingMu.Lock()
	if t, ok := w.pendingDeletes[id]; ok {
		t.Stop()
	}
	w.pendingDeletes[id] = time.AfterFunc(200*time.Millisecond, func() {
		w.pendingMu.Lock()
		delete(w.pendingDeletes, id)
		w.pendingMu.Unlock()
		if err := w.db.DeleteTicket(id); err != nil {
			log.Printf("[watcher] delete %s: %v", id, err)
			return
		}
		w.db.LogEvent("ticket.deleted", id, map[string]string{"id": id})
		w.hub.BroadcastTicketDelete(id)
	})
	w.pendingMu.Unlock()
}
