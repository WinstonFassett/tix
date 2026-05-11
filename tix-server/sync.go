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

var ticketPattern = regexp.MustCompile(`\(([^)/]+)\)\.md$`)

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

// frontmatter is the raw YAML shape parsed from .md files.
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

// marshalFrontmatter serializes ticket fields to YAML with:
//   - id always double-quoted (prevents hex values like 0e48 parsing as floats)
//   - tags/deps/links as flow sequences [a, b] when non-empty, omitted when empty
//   - assignee omitted when empty
func marshalFrontmatter(t Ticket) (string, error) {
	doc := &yaml.Node{Kind: yaml.MappingNode}

	scalar := func(val string) *yaml.Node {
		return &yaml.Node{Kind: yaml.ScalarNode, Value: val}
	}
	quoted := func(val string) *yaml.Node {
		return &yaml.Node{Kind: yaml.ScalarNode, Value: val, Tag: "!!str", Style: yaml.DoubleQuotedStyle}
	}
	flow := func(vals []string) *yaml.Node {
		n := &yaml.Node{Kind: yaml.SequenceNode, Style: yaml.FlowStyle}
		for _, v := range vals {
			n.Content = append(n.Content, scalar(v))
		}
		return n
	}
	add := func(key string, val *yaml.Node) {
		doc.Content = append(doc.Content, scalar(key), val)
	}

	add("id", quoted(t.ID))
	add("title", scalar(t.Title))
	add("status", scalar(t.Status))
	add("type", scalar(t.Type))
	add("priority", &yaml.Node{Kind: yaml.ScalarNode, Value: fmt.Sprintf("%d", t.Priority)})
	if len(t.Tags) > 0 {
		add("tags", flow(t.Tags))
	}
	if len(t.Deps) > 0 {
		add("deps", flow(t.Deps))
	}
	if len(t.Links) > 0 {
		add("links", flow(t.Links))
	}
	if t.Assignee != "" {
		add("assignee", scalar(t.Assignee))
	}
	add("created", scalar(t.Created))

	out, err := yaml.Marshal(&yaml.Node{Kind: yaml.DocumentNode, Content: []*yaml.Node{doc}})
	if err != nil {
		return "", err
	}
	// yaml.Marshal adds a trailing newline; strip the leading "---\n" that
	// DocumentNode emits so our caller can wrap it consistently.
	s := string(out)
	s = strings.TrimPrefix(s, "---\n")
	s = strings.TrimSuffix(s, "...\n")
	return s, nil
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
	fmStr, err := marshalFrontmatter(t)
	if err != nil {
		return "", fmt.Errorf("marshal frontmatter: %w", err)
	}

	body := t.Body
	if strings.HasPrefix(body, "# ") && !strings.HasPrefix(body, "## ") {
		newline := strings.Index(body, "\n")
		if newline < 0 {
			body = "# " + t.Title
		} else {
			body = "# " + t.Title + body[newline:]
		}
	} else {
		body = "# " + t.Title + "\n" + body
	}

	content := "---\n" + fmStr + "---\n" + body + "\n"
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
