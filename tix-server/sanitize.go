package main

import (
	"regexp"
	"strings"
	"unicode"
)

// Acronyms preserved in uppercase after Title Case conversion.
// Source: bash sanitize_title_for_filename in tix:246, plus the prior Go
// server's expanded list, plus a few more common to this codebase.
var acronyms = []string{
	"API", "UI", "CRUD", "SQL", "HTTP", "HTTPS", "REST", "JSON", "XML",
	"CSS", "HTML", "URL", "MCP", "CLI", "SSE", "WS", "SPA", "SSR",
	"ID", "DB", "CI", "CD", "PR", "MR", "SSH", "AWS", "GCP", "JWT",
	"DX", "UX",
}

var (
	nonFilenameChars = regexp.MustCompile(`[^a-zA-Z0-9 -]`)
	collapseSpaces   = regexp.MustCompile(`  +`)
)

// SanitizeTitle converts a raw ticket title into a filename-safe Title Case
// form, then re-uppercases known acronyms (so "add rest api" becomes
// "Add REST API" not "Add Rest Api"). Mirrors bash sanitize_title_for_filename.
func SanitizeTitle(title string) string {
	clean := nonFilenameChars.ReplaceAllString(title, "")
	clean = collapseSpaces.ReplaceAllString(clean, " ")
	clean = strings.TrimSpace(clean)

	clean = titleCase(clean)

	if clean == "" {
		clean = "Untitled-Ticket"
	}

	if len(clean) > 50 {
		clean = strings.TrimRight(clean[:50], " ")
	}

	clean = applyAcronyms(clean)
	return clean
}

func titleCase(s string) string {
	words := strings.Fields(s)
	for i, w := range words {
		runes := []rune(strings.ToLower(w))
		if len(runes) > 0 {
			runes[0] = unicode.ToUpper(runes[0])
		}
		words[i] = string(runes)
	}
	return strings.Join(words, " ")
}

func applyAcronyms(s string) string {
	words := strings.Split(s, " ")
	for i, w := range words {
		upper := strings.ToUpper(w)
		for _, a := range acronyms {
			if upper == a {
				words[i] = a
				break
			}
		}
	}
	return strings.Join(words, " ")
}
