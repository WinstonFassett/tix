package main

import (
	"crypto/sha256"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"gopkg.in/yaml.v3"
)

var ticketPattern = regexp.MustCompile(`\(([0-9a-f]{4})\)\.md$`)

// Ticket mirrors the tix-ui Ticket type.
type Ticket struct {
	ID       string   `json:"id" yaml:"id"`
	Title    string   `json:"title" yaml:"title"`
	Status   string   `json:"status" yaml:"status"`
	Type     string   `json:"type" yaml:"type"`
	Priority int      `json:"priority" yaml:"priority"`
	Tags     []string `json:"tags" yaml:"tags"`
	Deps     []string `json:"deps" yaml:"deps"`
	Links    []string `json:"links" yaml:"links"`
	Assignee string   `json:"assignee" yaml:"assignee"`
	Body     string   `json:"body" yaml:"-"`
	Filename string   `json:"filename" yaml:"-"`
	Folder   string   `json:"folder" yaml:"-"`
	Created  string   `json:"created" yaml:"created"`
}

// frontmatter is the raw YAML shape in .md files.
type frontmatter struct {
	ID       string   `yaml:"id"`
	Title    string   `yaml:"title"`
	Status   string   `yaml:"status"`
	Type     string   `yaml:"type"`
	Priority int      `yaml:"priority"`
	Tags     []string `yaml:"tags"`
	Deps     []string `yaml:"deps"`
	Links    []string `yaml:"links"`
	Assignee string   `yaml:"assignee"`
	Created  string   `yaml:"created"`
}

// ParseTicketFile parses a .md file into a Ticket.
// Returns nil if the file is not a valid ticket.
func ParseTicketFile(path, ticketsDir string) (*Ticket, string, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return nil, "", err
	}
	raw := string(content)
	hash := fileHash(raw)

	fm, body, err := parseFrontmatter(raw)
	if err != nil || fm.ID == "" {
		return nil, hash, nil
	}

	rel, err := filepath.Rel(ticketsDir, path)
	if err != nil {
		rel = filepath.Base(path)
	}
	folder := ""
	dir := filepath.Dir(rel)
	if dir != "." {
		folder = filepath.ToSlash(dir)
	}

	t := &Ticket{
		ID:       fm.ID,
		Title:    fm.Title,
		Status:   coalesce(fm.Status, "open"),
		Type:     coalesce(fm.Type, "task"),
		Priority: fm.Priority,
		Tags:     defaultSlice(fm.Tags),
		Deps:     defaultSlice(fm.Deps),
		Links:    defaultSlice(fm.Links),
		Assignee: fm.Assignee,
		Body:     strings.TrimSpace(body),
		Filename: filepath.ToSlash(rel),
		Folder:   folder,
		Created:  fm.Created,
	}
	return t, hash, nil
}

// ProjectTicketToFile writes a Ticket back to its .md file.
// Returns the file content (for hash computation).
func ProjectTicketToFile(t Ticket, ticketsDir string) (string, error) {
	fm := frontmatter{
		ID:       t.ID,
		Title:    t.Title,
		Status:   t.Status,
		Type:     t.Type,
		Priority: t.Priority,
		Tags:     t.Tags,
		Deps:     t.Deps,
		Links:    t.Links,
		Assignee: t.Assignee,
		Created:  t.Created,
	}

	fmBytes, err := yaml.Marshal(fm)
	if err != nil {
		return "", fmt.Errorf("marshal frontmatter: %w", err)
	}

	body := t.Body
	if !strings.HasPrefix(body, "# ") {
		body = "# " + t.Title + "\n" + body
	}

	content := "---\n" + string(fmBytes) + "---\n" + body + "\n"
	path := filepath.Join(ticketsDir, filepath.FromSlash(t.Filename))

	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return "", err
	}
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		return "", err
	}
	return content, nil
}

func ExtractID(path string) string {
	m := ticketPattern.FindStringSubmatch(filepath.Base(path))
	if len(m) < 2 {
		return ""
	}
	return m[1]
}

func fileHash(content string) string {
	h := sha256.Sum256([]byte(content))
	return fmt.Sprintf("%x", h)
}

func parseFrontmatter(content string) (frontmatter, string, error) {
	var fm frontmatter
	if !strings.HasPrefix(content, "---") {
		return fm, content, nil
	}
	rest := content[3:]
	// Find closing ---
	idx := strings.Index(rest, "\n---")
	if idx < 0 {
		return fm, content, nil
	}
	yamlPart := rest[:idx]
	body := rest[idx+4:]
	if strings.HasPrefix(body, "\n") {
		body = body[1:]
	}
	if err := yaml.Unmarshal([]byte(yamlPart), &fm); err != nil {
		return fm, body, err
	}
	return fm, body, nil
}

func coalesce(s, def string) string {
	if s == "" {
		return def
	}
	return s
}

func defaultSlice(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}
