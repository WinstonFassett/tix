package main

import (
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"strings"

	"github.com/spf13/cobra"
)

func init() {
	rootCmd.AddCommand(readyCmd, blockedCmd, closedCmd, queryCmd, showCmd, fileCmd)
}

var readyCmd = &cobra.Command{
	Use:   "ready",
	Short: "List open/in-progress tickets with all dependencies resolved",
	RunE:  runReady,
}

var blockedCmd = &cobra.Command{
	Use:   "blocked",
	Short: "List open/in-progress tickets with at least one unresolved dependency",
	RunE:  runBlocked,
}

var closedCmd = &cobra.Command{
	Use:   "closed",
	Short: "List recently closed/done tickets",
	RunE:  runClosed,
}

var queryCmd = &cobra.Command{
	Use:   "query",
	Short: "Output all tickets as JSON",
	RunE: func(cmd *cobra.Command, args []string) error {
		dir, err := resolveTicketsDir()
		if err != nil {
			return err
		}
		tickets, err := LoadAllTickets(dir, false)
		if err != nil {
			return err
		}
		enc := json.NewEncoder(os.Stdout)
		enc.SetIndent("", "  ")
		return enc.Encode(tickets)
	},
}

var fileCmd = &cobra.Command{
	Use:   "file <id>",
	Short: "Print the .md file path for a ticket",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		dir, err := resolveTicketsDir()
		if err != nil {
			return err
		}
		path, err := FindTicketFile(dir, args[0])
		if err != nil {
			return err
		}
		fmt.Println(path)
		return nil
	},
}

var showCmd = &cobra.Command{
	Use:   "show <id>",
	Short: "Display a ticket's full content (frontmatter + body) and dep relations",
	Args:  cobra.ExactArgs(1),
	RunE:  runShow,
}

var (
	closedLimit int
	queryFilter string
)

func init() {
	closedCmd.Flags().IntVar(&closedLimit, "limit", 20, "max tickets to show")
	for _, c := range []*cobra.Command{readyCmd, blockedCmd, closedCmd} {
		c.Flags().StringVarP(&lsAssignee, "assignee", "a", "", "filter by assignee")
		c.Flags().StringVarP(&lsTag, "tag", "T", "", "filter by tag")
	}
}

func loadAllForDeps() ([]Ticket, map[string]Ticket, error) {
	dir, err := resolveTicketsDir()
	if err != nil {
		return nil, nil, err
	}
	all, err := LoadAllTickets(dir, true) // include archive for dep resolution
	if err != nil {
		return nil, nil, err
	}
	idx := make(map[string]Ticket, len(all))
	for _, t := range all {
		idx[t.ID] = t
	}
	return all, idx, nil
}

func runReady(cmd *cobra.Command, args []string) error {
	all, idx, err := loadAllForDeps()
	if err != nil {
		return err
	}
	out := []Ticket{}
	for _, t := range all {
		if !isActive(t.Status) {
			continue
		}
		if !depsAllResolved(t, idx) {
			continue
		}
		if !filterByAT(t) {
			continue
		}
		out = append(out, t)
	}
	sortByCreatedDesc(out)
	for _, t := range out {
		fmt.Println(formatTicketLine(t))
	}
	return nil
}

func runBlocked(cmd *cobra.Command, args []string) error {
	all, idx, err := loadAllForDeps()
	if err != nil {
		return err
	}
	out := []Ticket{}
	for _, t := range all {
		if !isActive(t.Status) {
			continue
		}
		if depsAllResolved(t, idx) {
			continue
		}
		if !filterByAT(t) {
			continue
		}
		out = append(out, t)
	}
	sortByCreatedDesc(out)
	for _, t := range out {
		fmt.Println(formatTicketLine(t))
	}
	return nil
}

func runClosed(cmd *cobra.Command, args []string) error {
	dir, err := resolveTicketsDir()
	if err != nil {
		return err
	}
	all, err := LoadAllTickets(dir, true)
	if err != nil {
		return err
	}
	out := []Ticket{}
	for _, t := range all {
		if !IsTerminalStatus(t.Status) {
			continue
		}
		if !filterByAT(t) {
			continue
		}
		out = append(out, t)
	}
	sortByCreatedDesc(out)
	if closedLimit > 0 && len(out) > closedLimit {
		out = out[:closedLimit]
	}
	for _, t := range out {
		fmt.Println(formatTicketLine(t))
	}
	return nil
}

func runShow(cmd *cobra.Command, args []string) error {
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
	fmt.Print(string(content))

	// Append blockers/blocking from dep graph
	target, _, err := ParseTicketFile(path, dir)
	if err != nil || target == nil {
		return nil
	}
	all, err := LoadAllTickets(dir, true)
	if err != nil {
		return nil
	}
	idx := make(map[string]Ticket, len(all))
	for _, t := range all {
		idx[t.ID] = t
	}

	var blockers, blocking []Ticket
	for _, dep := range target.Deps {
		if d, ok := idx[dep]; ok && !IsTerminalStatus(d.Status) {
			blockers = append(blockers, d)
		}
	}
	for _, t := range all {
		if t.ID == target.ID {
			continue
		}
		for _, d := range t.Deps {
			if d == target.ID && !IsTerminalStatus(t.Status) {
				blocking = append(blocking, t)
				break
			}
		}
	}

	if len(blockers) > 0 {
		fmt.Print("\n## Blockers\n\n")
		for _, t := range blockers {
			fmt.Printf("- %s [%s] %s\n", t.ID, t.Status, t.Title)
		}
	}
	if len(blocking) > 0 {
		fmt.Print("\n## Blocking\n\n")
		for _, t := range blocking {
			fmt.Printf("- %s [%s] %s\n", t.ID, t.Status, t.Title)
		}
	}

	// AC completion
	total, checked := countAC(string(content))
	if total > 0 {
		pct := checked * 100 / total
		fmt.Printf("\n**Acceptance Criteria:** %d/%d complete (%d%%)\n", checked, total, pct)
	}
	return nil
}

// --- helpers ---

func isActive(s string) bool {
	return !IsTerminalStatus(s)
}

func depsAllResolved(t Ticket, idx map[string]Ticket) bool {
	for _, dep := range t.Deps {
		d, ok := idx[dep]
		if !ok {
			continue // missing dep treated as resolved (matches bash leniency)
		}
		if !IsTerminalStatus(d.Status) {
			return false
		}
	}
	return true
}

func filterByAT(t Ticket) bool {
	if lsAssignee != "" && t.Assignee != lsAssignee {
		return false
	}
	if lsTag != "" {
		found := false
		for _, tag := range t.Tags {
			if tag == lsTag {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	return true
}

func sortByCreatedDesc(ts []Ticket) {
	sort.SliceStable(ts, func(i, j int) bool {
		return ts[i].Created > ts[j].Created
	})
}

func countAC(content string) (total, checked int) {
	for _, line := range strings.Split(content, "\n") {
		l := strings.TrimSpace(line)
		if strings.HasPrefix(l, "- [ ]") || strings.HasPrefix(l, "- [x]") || strings.HasPrefix(l, "- [X]") {
			total++
			if strings.HasPrefix(l, "- [x]") || strings.HasPrefix(l, "- [X]") {
				checked++
			}
		}
	}
	return
}
