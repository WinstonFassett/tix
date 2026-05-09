package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// --- marshalFrontmatter ---

func TestMarshalFrontmatter_QuotedID(t *testing.T) {
	ticket := Ticket{ID: "0e48", Title: "Test", Status: "open", Type: "task", Created: "2024-01-01T00:00:00Z"}
	out, err := marshalFrontmatter(ticket)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, `id: "0e48"`) {
		t.Errorf("expected id to be double-quoted, got:\n%s", out)
	}
}

func TestMarshalFrontmatter_TagsFlowStyle(t *testing.T) {
	ticket := Ticket{ID: "abcd", Title: "T", Status: "open", Type: "task", Tags: []string{"foo", "bar"}, Created: "2024-01-01T00:00:00Z"}
	out, err := marshalFrontmatter(ticket)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, "tags: [foo, bar]") {
		t.Errorf("expected flow-style tags, got:\n%s", out)
	}
}

func TestMarshalFrontmatter_EmptyTagsOmitted(t *testing.T) {
	ticket := Ticket{ID: "abcd", Title: "T", Status: "open", Type: "task", Tags: []string{}, Created: "2024-01-01T00:00:00Z"}
	out, err := marshalFrontmatter(ticket)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(out, "tags:") {
		t.Errorf("expected empty tags to be omitted, got:\n%s", out)
	}
}

func TestMarshalFrontmatter_EmptyAssigneeOmitted(t *testing.T) {
	ticket := Ticket{ID: "abcd", Title: "T", Status: "open", Type: "task", Assignee: "", Created: "2024-01-01T00:00:00Z"}
	out, err := marshalFrontmatter(ticket)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(out, "assignee:") {
		t.Errorf("expected empty assignee to be omitted, got:\n%s", out)
	}
}

func TestMarshalFrontmatter_AssigneePresent(t *testing.T) {
	ticket := Ticket{ID: "abcd", Title: "T", Status: "open", Type: "task", Assignee: "alice", Created: "2024-01-01T00:00:00Z"}
	out, err := marshalFrontmatter(ticket)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, "assignee: alice") {
		t.Errorf("expected assignee field, got:\n%s", out)
	}
}

// --- ProjectTicketToFile / ParseTicketFile round-trip ---

func TestRoundTrip_Basic(t *testing.T) {
	dir := t.TempDir()
	original := Ticket{
		ID:       "abcd",
		Title:    "My Ticket",
		Status:   "open",
		Type:     "task",
		Priority: 1,
		Tags:     []string{"backend", "urgent"},
		Deps:     []string{"1234"},
		Links:    []string{},
		Assignee: "bob",
		Body:     "Some body text.",
		Filename: "My Ticket (abcd).md",
		Created:  "2024-06-01T10:00:00Z",
	}
	if _, err := ProjectTicketToFile(original, dir); err != nil {
		t.Fatal(err)
	}
	parsed, _, err := ParseTicketFile(filepath.Join(dir, "My Ticket (abcd).md"), dir)
	if err != nil || parsed == nil {
		t.Fatalf("parse failed: %v", err)
	}
	if parsed.ID != original.ID {
		t.Errorf("ID mismatch: %q vs %q", parsed.ID, original.ID)
	}
	if parsed.Title != original.Title {
		t.Errorf("Title mismatch: %q vs %q", parsed.Title, original.Title)
	}
	if parsed.Assignee != original.Assignee {
		t.Errorf("Assignee mismatch: %q vs %q", parsed.Assignee, original.Assignee)
	}
	if len(parsed.Tags) != 2 || parsed.Tags[0] != "backend" {
		t.Errorf("Tags mismatch: %v", parsed.Tags)
	}
	// Body round-trips with the H1 prepended (it's stored in the file body).
	if parsed.Body != "# My Ticket\nSome body text." {
		t.Errorf("Body mismatch: %q", parsed.Body)
	}
}

func TestRoundTrip_HexLikeID(t *testing.T) {
	dir := t.TempDir()
	ticket := Ticket{
		ID: "0e48", Title: "Hex ID Ticket", Status: "open", Type: "task",
		Tags: []string{}, Deps: []string{}, Links: []string{},
		Filename: "Hex Id Ticket (0e48).md", Created: "2024-01-01T00:00:00Z",
	}
	if _, err := ProjectTicketToFile(ticket, dir); err != nil {
		t.Fatal(err)
	}
	parsed, _, err := ParseTicketFile(filepath.Join(dir, "Hex Id Ticket (0e48).md"), dir)
	if err != nil || parsed == nil {
		t.Fatalf("parse failed: %v", err)
	}
	if parsed.ID != "0e48" {
		t.Errorf("ID round-tripped incorrectly: %q", parsed.ID)
	}
}

// --- H1 update on rename ---

func TestProjectTicketToFile_UpdatesExistingH1(t *testing.T) {
	dir := t.TempDir()
	ticket := Ticket{
		ID: "aaaa", Title: "Original Title", Status: "open", Type: "task",
		Tags: []string{}, Deps: []string{}, Links: []string{},
		Filename: "Original Title (aaaa).md", Created: "2024-01-01T00:00:00Z",
		Body: "# Original Title\n\nSome content.",
	}
	if _, err := ProjectTicketToFile(ticket, dir); err != nil {
		t.Fatal(err)
	}

	// Simulate rename: change title, keep same filename
	ticket.Title = "Renamed Title"
	if _, err := ProjectTicketToFile(ticket, dir); err != nil {
		t.Fatal(err)
	}

	content, err := os.ReadFile(filepath.Join(dir, "Original Title (aaaa).md"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(content), "# Renamed Title") {
		t.Errorf("expected H1 to be updated to 'Renamed Title', got:\n%s", content)
	}
	if strings.Contains(string(content), "# Original Title") {
		t.Errorf("old H1 still present after rename:\n%s", content)
	}
}

func TestProjectTicketToFile_PrependH1WhenMissing(t *testing.T) {
	dir := t.TempDir()
	ticket := Ticket{
		ID: "bbbb", Title: "New Ticket", Status: "open", Type: "task",
		Tags: []string{}, Deps: []string{}, Links: []string{},
		Filename: "New Ticket (bbbb).md", Created: "2024-01-01T00:00:00Z",
		Body: "Just a description, no header.",
	}
	if _, err := ProjectTicketToFile(ticket, dir); err != nil {
		t.Fatal(err)
	}
	content, err := os.ReadFile(filepath.Join(dir, "New Ticket (bbbb).md"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(content), "# New Ticket\n") {
		t.Errorf("expected H1 prepended, got:\n%s", content)
	}
}
