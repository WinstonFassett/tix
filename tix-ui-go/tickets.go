package main

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"gopkg.in/yaml.v3"
)

var (
	idPattern         = regexp.MustCompile(`^[0-9a-f]{4}$`)
	filenameIDPattern = regexp.MustCompile(`\(([0-9a-f]{4})\)\.md$`)
)

// Ticket represents a parsed ticket markdown file.
type Ticket struct {
	ID       string   `json:"id"       yaml:"id"`
	Title    string   `json:"title"    yaml:"title"`
	Status   string   `json:"status"   yaml:"status"`
	Type     string   `json:"type"     yaml:"type"`
	Priority int      `json:"priority" yaml:"priority"`
	Assignee string   `json:"assignee" yaml:"assignee"`
	Tags     []string `json:"tags"     yaml:"tags"`
	Deps     []string `json:"deps"     yaml:"deps"`
	Created  string   `json:"created"  yaml:"created"`
	Body     string   `json:"body"     yaml:"-"`
	Filename string   `json:"filename" yaml:"-"`
}

// ticketsDir resolves the tickets directory path.
// Priority: TICKETS_DIR > TIX_WORKSPACE/tickets > TICKET_WORKSPACE/tickets > ./tickets
func ticketsDir() string {
	if d := os.Getenv("TICKETS_DIR"); d != "" {
		return d
	}
	if w := os.Getenv("TIX_WORKSPACE"); w != "" {
		return filepath.Join(w, "tickets")
	}
	if w := os.Getenv("TICKET_WORKSPACE"); w != "" {
		return filepath.Join(w, "tickets")
	}
	return "tickets"
}

// parseFrontmatter extracts YAML frontmatter and body from markdown content.
func parseFrontmatter(content string) (map[string]interface{}, string, error) {
	scanner := bufio.NewScanner(strings.NewReader(content))
	var inFrontmatter bool
	var fmLines []string
	var bodyLines []string
	fmDone := false

	for scanner.Scan() {
		line := scanner.Text()
		if !inFrontmatter && !fmDone && strings.TrimSpace(line) == "---" {
			inFrontmatter = true
			continue
		}
		if inFrontmatter && strings.TrimSpace(line) == "---" {
			inFrontmatter = false
			fmDone = true
			continue
		}
		if inFrontmatter {
			fmLines = append(fmLines, line)
		} else if fmDone {
			bodyLines = append(bodyLines, line)
		}
	}

	fmYAML := strings.Join(fmLines, "\n")
	body := strings.TrimSpace(strings.Join(bodyLines, "\n"))

	var fm map[string]interface{}
	if err := yaml.Unmarshal([]byte(fmYAML), &fm); err != nil {
		return nil, "", fmt.Errorf("parsing frontmatter: %w", err)
	}
	return fm, body, nil
}

// parseTicketFile reads and parses a single ticket markdown file.
func parseTicketFile(path string) (Ticket, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return Ticket{}, err
	}

	fm, body, err := parseFrontmatter(string(data))
	if err != nil {
		return Ticket{}, fmt.Errorf("%s: %w", path, err)
	}

	t := Ticket{
		Body:     body,
		Filename: filepath.Base(path),
	}

	switch v := fm["id"].(type) {
	case string:
		t.ID = v
	case int:
		// YAML parses all-digit hex IDs (e.g. "6264") as integers.
		// Format back; use filename as authoritative source if available.
		t.ID = fmt.Sprintf("%d", v)
	}
	// Fallback: extract 4-char hex ID from filename pattern "Title (XXXX).md"
	if t.ID == "" || !idPattern.MatchString(t.ID) {
		if m := filenameIDPattern.FindStringSubmatch(t.Filename); m != nil {
			t.ID = m[1]
		}
	}
	if v, ok := fm["title"].(string); ok {
		t.Title = v
	}
	if v, ok := fm["status"].(string); ok {
		t.Status = v
	}
	if v, ok := fm["type"].(string); ok {
		t.Type = v
	}
	if v, ok := fm["priority"].(int); ok {
		t.Priority = v
	}
	if v, ok := fm["assignee"].(string); ok {
		t.Assignee = v
	}
	if v, ok := fm["created"].(string); ok {
		t.Created = v
	}
	if tags, ok := fm["tags"].([]interface{}); ok {
		for _, tag := range tags {
			if s, ok := tag.(string); ok {
				t.Tags = append(t.Tags, s)
			}
		}
	}
	if deps, ok := fm["deps"].([]interface{}); ok {
		for _, dep := range deps {
			if s, ok := dep.(string); ok {
				t.Deps = append(t.Deps, s)
			}
		}
	}

	return t, nil
}

// loadAllTickets reads all .md files from the tickets directory.
func loadAllTickets() ([]Ticket, error) {
	dir := ticketsDir()
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("reading tickets dir %q: %w", dir, err)
	}

	var tickets []Ticket
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".md") {
			continue
		}
		t, err := parseTicketFile(filepath.Join(dir, e.Name()))
		if err != nil {
			fmt.Fprintf(os.Stderr, "warning: skipping %s: %v\n", e.Name(), err)
			continue
		}
		tickets = append(tickets, t)
	}
	return tickets, nil
}

// writeTicketFile writes a ticket back to disk as markdown with YAML frontmatter.
func writeTicketFile(t Ticket) error {
	dir := ticketsDir()

	fm := map[string]interface{}{
		"id":       t.ID,
		"title":    t.Title,
		"status":   t.Status,
		"type":     t.Type,
		"priority": t.Priority,
		"assignee": t.Assignee,
		"tags":     t.Tags,
		"deps":     t.Deps,
		"created":  t.Created,
	}

	fmBytes, err := yaml.Marshal(fm)
	if err != nil {
		return fmt.Errorf("marshaling frontmatter: %w", err)
	}

	content := fmt.Sprintf("---\n%s---\n%s\n", string(fmBytes), t.Body)

	path := filepath.Join(dir, t.Filename)
	return os.WriteFile(path, []byte(content), 0644)
}
