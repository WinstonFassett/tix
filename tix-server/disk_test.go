package main

import (
	"os"
	"path/filepath"
	"testing"
)

func makeTicket(dir, id, title string) (string, error) {
	t := Ticket{
		ID: id, Title: title, Status: "open", Type: "task",
		Tags: []string{}, Deps: []string{}, Links: []string{},
		Filename: SanitizeTitle(title) + " (" + id + ").md",
		Created:  "2024-01-01T00:00:00Z",
	}
	return WriteNewTicketFile(dir, t)
}

func TestFindTicketFile(t *testing.T) {
	dir := t.TempDir()
	if _, err := makeTicket(dir, "abcd", "My Bug"); err != nil {
		t.Fatal(err)
	}
	path, err := FindTicketFile(dir, "abcd")
	if err != nil {
		t.Fatal(err)
	}
	if filepath.Base(path) != "My Bug (abcd).md" {
		t.Errorf("unexpected path: %s", path)
	}
}

func TestFindTicketFile_NotFound(t *testing.T) {
	dir := t.TempDir()
	_, err := FindTicketFile(dir, "0000")
	if err == nil {
		t.Fatal("expected error for missing ticket")
	}
}

func TestSaveTicket_RenameUpdatesFilename(t *testing.T) {
	dir := t.TempDir()
	curPath, err := makeTicket(dir, "cafe", "Old Name")
	if err != nil {
		t.Fatal(err)
	}
	ticket, _, err := LoadTicket(dir, "cafe")
	if err != nil {
		t.Fatal(err)
	}
	ticket.Title = "New Name"
	newPath, err := SaveTicket(dir, *ticket, curPath)
	if err != nil {
		t.Fatalf("SaveTicket: %v", err)
	}
	if filepath.Base(newPath) != "New Name (cafe).md" {
		t.Errorf("unexpected new path: %s", newPath)
	}
	if _, err := os.Stat(newPath); err != nil {
		t.Errorf("new file not found: %v", err)
	}
	if _, err := os.Stat(curPath); err == nil {
		t.Error("old file still exists after rename")
	}
}

func TestSaveTicket_CaseOnlyRename(t *testing.T) {
	dir := t.TempDir()
	// Create ticket with title that will get acronym-fixup on next save.
	// We manually create with "Cli" in the name to simulate the macOS bug.
	curPath := filepath.Join(dir, "Test Cli Tool (1234).md")
	ticket := Ticket{
		ID: "1234", Title: "Test CLI Tool", Status: "open", Type: "task",
		Tags: []string{}, Deps: []string{}, Links: []string{},
		Filename: "Test Cli Tool (1234).md", Created: "2024-01-01T00:00:00Z",
	}
	if _, err := ProjectTicketToFile(ticket, dir); err != nil {
		t.Fatal(err)
	}
	// Rename to the acronym-fixed form — same inode on case-insensitive FS.
	ticket.Title = "Test CLI Tool"
	_, err := SaveTicket(dir, ticket, curPath)
	if err != nil {
		t.Errorf("case-only rename should not error on case-insensitive FS: %v", err)
	}
}

func TestLoadAllTickets_SkipsArchive(t *testing.T) {
	dir := t.TempDir()
	if _, err := makeTicket(dir, "aaaa", "Active"); err != nil {
		t.Fatal(err)
	}
	archDir := filepath.Join(dir, "archive", "2024-01-01")
	if err := os.MkdirAll(archDir, 0755); err != nil {
		t.Fatal(err)
	}
	if _, err := makeTicket(archDir, "bbbb", "Archived"); err != nil {
		t.Fatal(err)
	}

	active, err := LoadAllTickets(dir, false)
	if err != nil {
		t.Fatal(err)
	}
	if len(active) != 1 || active[0].ID != "aaaa" {
		t.Errorf("expected 1 active ticket, got %d: %v", len(active), active)
	}

	all, err := LoadAllTickets(dir, true)
	if err != nil {
		t.Fatal(err)
	}
	if len(all) != 2 {
		t.Errorf("expected 2 tickets with archive, got %d", len(all))
	}
}

func TestArchiveTicket(t *testing.T) {
	dir := t.TempDir()
	path, err := makeTicket(dir, "cccc", "To Archive")
	if err != nil {
		t.Fatal(err)
	}
	dst, err := ArchiveTicket(dir, path)
	if err != nil {
		t.Fatalf("ArchiveTicket: %v", err)
	}
	if _, err := os.Stat(dst); err != nil {
		t.Errorf("archived file not found at %s: %v", dst, err)
	}
	if _, err := os.Stat(path); err == nil {
		t.Error("original file still exists after archive")
	}
}

func TestNormalizeStatus(t *testing.T) {
	cases := []struct {
		in   string
		want string
		ok   bool
	}{
		{"open", "open", true},
		{"in-progress", "in-progress", true},
		{"in_progress", "in-progress", true},
		{"review", "review", true},
		{"pr", "review", true},
		{"hold", "on-hold", true},
		{"done", "done", true},
		{"completed", "done", true},
		{"closed", "closed", true},
		{"wontfix", "closed", true},
		{"bogus", "", false},
	}
	for _, c := range cases {
		got, ok := NormalizeStatus(c.in)
		if ok != c.ok || got != c.want {
			t.Errorf("NormalizeStatus(%q) = %q,%v; want %q,%v", c.in, got, ok, c.want, c.ok)
		}
	}
}
