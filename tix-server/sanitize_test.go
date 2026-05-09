package main

import "testing"

func TestSanitizeTitle(t *testing.T) {
	cases := []struct {
		in   string
		want string
	}{
		{"fix login bug", "Fix Login Bug"},
		{"add rest api endpoint", "Add REST API Endpoint"},
		{"improve cli ux", "Improve CLI UX"},
		{"clean up sql queries", "Clean Up SQL Queries"},
		{"fix mcp server sse", "Fix MCP Server SSE"},
		{"  extra   spaces  ", "Extra Spaces"},
		{"title with special!@# chars", "Title With Special Chars"},
		{"a very long title that exceeds the fifty character limit by a lot", "A Very Long Title That Exceeds The Fifty Character"},
		{"", "Untitled-Ticket"},
	}
	for _, c := range cases {
		got := SanitizeTitle(c.in)
		if got != c.want {
			t.Errorf("SanitizeTitle(%q) = %q; want %q", c.in, got, c.want)
		}
	}
}
