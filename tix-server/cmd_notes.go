package main

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/spf13/cobra"
)

func init() {
	rootCmd.AddCommand(addNoteCmd, checkCmd, addAcCmd, removeAcCmd)
}

var addNoteCmd = &cobra.Command{
	Use:   "add-note <id> [text...]",
	Short: "Append a timestamped note to a ticket (text or stdin)",
	Args:  cobra.MinimumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		dir, err := resolveTicketsDir()
		if err != nil {
			return err
		}
		path, err := FindTicketFile(dir, args[0])
		if err != nil {
			return err
		}
		var note string
		if len(args) > 1 {
			note = strings.Join(args[1:], " ")
		} else {
			b, err := io.ReadAll(os.Stdin)
			if err != nil {
				return err
			}
			note = strings.TrimRight(string(b), "\n")
			if note == "" {
				return fmt.Errorf("no note provided (pass as args or pipe to stdin)")
			}
		}

		content, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		text := string(content)
		needsHeader := !strings.Contains(text, "\n## Notes")
		if !strings.HasSuffix(text, "\n") {
			text += "\n"
		}
		if needsHeader {
			text += "\n## Notes\n"
		}
		ts := time.Now().UTC().Format("2006-01-02T15:04:05Z")
		text += fmt.Sprintf("\n**%s**\n\n%s\n", ts, note)
		if err := os.WriteFile(path, []byte(text), 0644); err != nil {
			return err
		}
		fmt.Printf("Note added to %s\n", args[0])
		return nil
	},
}

var checkCmd = &cobra.Command{
	Use:   "check <id> <ac-number>",
	Short: "Toggle an acceptance criterion checkbox (1-indexed)",
	Args:  cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		var n int
		if _, err := fmt.Sscanf(args[1], "%d", &n); err != nil || n < 1 {
			return fmt.Errorf("ac-number must be a positive integer")
		}
		return modifyACSection(args[0], func(lines []string) ([]string, error) {
			out, count := lines[:0], 0
			for _, line := range lines {
				if isACLine(line) {
					count++
					if count == n {
						line = toggleAC(line)
					}
				}
				out = append(out, line)
			}
			if count < n {
				return nil, fmt.Errorf("ac #%d not found (only %d AC items)", n, count)
			}
			return out, nil
		})
	},
}

var addAcCmd = &cobra.Command{
	Use:   "add-ac <id> <text...>",
	Short: "Add an acceptance criterion checkbox to a ticket",
	Args:  cobra.MinimumNArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		text := strings.Join(args[1:], " ")
		text = strings.ReplaceAll(text, "\n", " ")
		text = strings.TrimSpace(text)
		if text == "" {
			return fmt.Errorf("ac text required")
		}
		dir, err := resolveTicketsDir()
		if err != nil {
			return err
		}
		path, err := FindTicketFile(dir, args[0])
		if err != nil {
			return err
		}
		content, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		newText := appendAC(string(content), text)
		if err := os.WriteFile(path, []byte(newText), 0644); err != nil {
			return err
		}
		fmt.Printf("Added AC to %s: %s\n", args[0], text)
		return nil
	},
}

var removeAcCmd = &cobra.Command{
	Use:   "remove-ac <id> <ac-number>",
	Short: "Remove an acceptance criterion (1-indexed)",
	Args:  cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		var n int
		if _, err := fmt.Sscanf(args[1], "%d", &n); err != nil || n < 1 {
			return fmt.Errorf("ac-number must be a positive integer")
		}
		return modifyACSection(args[0], func(lines []string) ([]string, error) {
			out, count := []string{}, 0
			for _, line := range lines {
				if isACLine(line) {
					count++
					if count == n {
						continue
					}
				}
				out = append(out, line)
			}
			if count < n {
				return nil, fmt.Errorf("ac #%d not found (only %d AC items)", n, count)
			}
			return out, nil
		})
	},
}

// --- helpers ---

var acLineRe = regexp.MustCompile(`^- \[[ xX]\]`)

func isACLine(s string) bool {
	return acLineRe.MatchString(strings.TrimLeft(s, " \t"))
}

func toggleAC(s string) string {
	if strings.Contains(s, "- [ ]") {
		return strings.Replace(s, "- [ ]", "- [x]", 1)
	}
	// Handle both lowercase and uppercase X
	if strings.Contains(s, "- [x]") || strings.Contains(s, "- [X]") {
		return strings.ReplaceAll(strings.Replace(s, "- [x]", "- [ ]", 1), "- [X]", "- [ ]")
	}
	return s
}

func modifyACSection(id string, fn func([]string) ([]string, error)) error {
	dir, err := resolveTicketsDir()
	if err != nil {
		return err
	}
	path, err := FindTicketFile(dir, id)
	if err != nil {
		return err
	}
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	var lines []string
	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 64*1024), 1024*1024)
	for scanner.Scan() {
		lines = append(lines, scanner.Text())
	}
	f.Close()

	// Slice out the AC section, apply fn, splice back.
	startIdx, endIdx := findACSection(lines)
	if startIdx < 0 {
		return fmt.Errorf("no '## Acceptance Criteria' section in ticket %s", id)
	}
	section := lines[startIdx+1 : endIdx]
	newSection, err := fn(section)
	if err != nil {
		return err
	}
	out := make([]string, 0, len(lines)-len(section)+len(newSection))
	out = append(out, lines[:startIdx+1]...)
	out = append(out, newSection...)
	out = append(out, lines[endIdx:]...)

	return os.WriteFile(path, []byte(strings.Join(out, "\n")+"\n"), 0644)
}

func findACSection(lines []string) (start, end int) {
	start = -1
	for i, line := range lines {
		if strings.HasPrefix(line, "## Acceptance Criteria") {
			start = i
			break
		}
	}
	if start < 0 {
		return -1, -1
	}
	for i := start + 1; i < len(lines); i++ {
		if strings.HasPrefix(lines[i], "## ") {
			return start, i
		}
	}
	return start, len(lines)
}

func appendAC(content, text string) string {
	lines := strings.Split(content, "\n")
	startIdx, endIdx := findACSection(lines)
	newAC := "- [ ] " + text
	if startIdx < 0 {
		// No AC section — append.
		if !strings.HasSuffix(content, "\n") {
			content += "\n"
		}
		return content + "\n## Acceptance Criteria\n" + newAC + "\n"
	}
	out := make([]string, 0, len(lines)+1)
	out = append(out, lines[:endIdx]...)
	// Trim trailing blank lines inside the AC section before appending.
	for len(out) > startIdx+1 && strings.TrimSpace(out[len(out)-1]) == "" {
		out = out[:len(out)-1]
	}
	out = append(out, newAC)
	out = append(out, lines[endIdx:]...)
	return strings.Join(out, "\n")
}
