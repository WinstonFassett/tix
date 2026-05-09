package main

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

// Disk-only ticket operations for CLI use. The server hydrates these files
// into SQLite; CLI commands operate directly on .md so they don't need a
// running server.

// LoadAllTickets walks ticketsDir and parses every .md file with a valid
// frontmatter into a Ticket. If includeArchive is false, files under
// archive/ are skipped.
func LoadAllTickets(ticketsDir string, includeArchive bool) ([]Ticket, error) {
	var out []Ticket
	if _, err := os.Stat(ticketsDir); os.IsNotExist(err) {
		return out, nil
	}

	err := filepath.WalkDir(ticketsDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			if !includeArchive && d.Name() == "archive" && path != ticketsDir {
				return fs.SkipDir
			}
			return nil
		}
		if !strings.HasSuffix(d.Name(), ".md") {
			return nil
		}
		t, _, perr := ParseTicketFile(path, ticketsDir)
		if perr != nil || t == nil {
			return nil
		}
		out = append(out, *t)
		return nil
	})
	if err != nil {
		return nil, err
	}
	return out, nil
}

// FindTicketFile resolves a ticket ID to its .md file path.
// Searches both active and archive directories.
func FindTicketFile(ticketsDir, id string) (string, error) {
	var found string
	suffix := fmt.Sprintf("(%s).md", id)
	err := filepath.WalkDir(ticketsDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		if strings.HasSuffix(d.Name(), suffix) {
			found = path
			return fs.SkipAll
		}
		return nil
	})
	if err != nil {
		return "", err
	}
	if found == "" {
		return "", fmt.Errorf("ticket %s not found", id)
	}
	return found, nil
}

// NextTicketID generates a fresh 4-char hex ID, retrying on collision with
// existing tickets in ticketsDir. Surfaces error after 100 attempts.
func NextTicketID(ticketsDir string) (string, error) {
	existing := map[string]bool{}
	tickets, _ := LoadAllTickets(ticketsDir, true) // include archive to avoid collisions
	for _, t := range tickets {
		existing[t.ID] = true
	}

	for i := 0; i < 100; i++ {
		id, err := randHex4()
		if err != nil {
			return "", err
		}
		if !existing[id] {
			return id, nil
		}
	}
	return "", fmt.Errorf("could not generate unique ticket ID after 100 attempts")
}

func randHex4() (string, error) {
	b := make([]byte, 2)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// WriteNewTicketFile writes a brand-new ticket .md file using SanitizeTitle
// for the filename. Returns the absolute file path.
func WriteNewTicketFile(ticketsDir string, t Ticket) (string, error) {
	if err := os.MkdirAll(ticketsDir, 0755); err != nil {
		return "", err
	}
	cleanTitle := SanitizeTitle(t.Title)
	filename := fmt.Sprintf("%s (%s).md", cleanTitle, t.ID)
	t.Filename = filename
	if _, err := ProjectTicketToFile(t, ticketsDir); err != nil {
		return "", err
	}
	return filepath.Join(ticketsDir, filename), nil
}
