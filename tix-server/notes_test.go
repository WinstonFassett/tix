package main

import (
	"strings"
	"testing"
)

func TestIsACLine(t *testing.T) {
	cases := []struct {
		in   string
		want bool
	}{
		{"- [ ] do something", true},
		{"- [x] done", true},
		{"- [X] also done", true},
		{"  - [ ] indented", true},
		{"## not an ac", false},
		{"plain text", false},
	}
	for _, c := range cases {
		if got := isACLine(c.in); got != c.want {
			t.Errorf("isACLine(%q) = %v; want %v", c.in, got, c.want)
		}
	}
}

func TestToggleAC(t *testing.T) {
	if got := toggleAC("- [ ] pending"); got != "- [x] pending" {
		t.Errorf("toggle unchecked: %q", got)
	}
	if got := toggleAC("- [x] done"); got != "- [ ] done" {
		t.Errorf("toggle checked: %q", got)
	}
}

func TestAppendAC_NoExistingSection(t *testing.T) {
	content := "---\nid: \"abcd\"\n---\n# Title\n\nBody text.\n"
	out := appendAC(content, "passes all tests")
	if !strings.Contains(out, "## Acceptance Criteria") {
		t.Error("expected AC section to be created")
	}
	if !strings.Contains(out, "- [ ] passes all tests") {
		t.Error("expected AC item to be appended")
	}
}

func TestAppendAC_ExistingSection(t *testing.T) {
	content := "---\nid: \"abcd\"\n---\n# Title\n\n## Acceptance Criteria\n- [ ] first item\n"
	out := appendAC(content, "second item")
	if !strings.Contains(out, "- [ ] first item") {
		t.Error("existing item removed")
	}
	if !strings.Contains(out, "- [ ] second item") {
		t.Error("new item not added")
	}
}

func TestFindACSection_Present(t *testing.T) {
	lines := []string{
		"# Title",
		"",
		"## Acceptance Criteria",
		"- [ ] item one",
		"- [x] item two",
		"",
		"## Notes",
		"some note",
	}
	start, end := findACSection(lines)
	if start != 2 {
		t.Errorf("start = %d; want 2", start)
	}
	if end != 6 {
		t.Errorf("end = %d; want 6", end)
	}
}

func TestFindACSection_Missing(t *testing.T) {
	lines := []string{"# Title", "", "body text"}
	start, end := findACSection(lines)
	if start != -1 || end != -1 {
		t.Errorf("expected (-1,-1) for missing section, got (%d,%d)", start, end)
	}
}
