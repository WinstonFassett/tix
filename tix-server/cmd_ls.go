package main

import (
	"fmt"
	"sort"
	"strings"

	"github.com/spf13/cobra"
)

var lsCmd = &cobra.Command{
	Use:   "ls",
	Short: "List tickets (default: open + in-progress)",
	RunE:  runLs,
}

var (
	lsStatus   string
	lsAll      bool
	lsAssignee string
	lsTag      string
)

func init() {
	lsCmd.Flags().StringVar(&lsStatus, "status", "", "filter by status (open, in-progress, done, closed, ...)")
	lsCmd.Flags().BoolVar(&lsAll, "all", false, "include done/closed tickets")
	lsCmd.Flags().StringVarP(&lsAssignee, "assignee", "a", "", "filter by assignee")
	lsCmd.Flags().StringVarP(&lsTag, "tag", "T", "", "filter by tag")
	rootCmd.AddCommand(lsCmd)
}

func runLs(cmd *cobra.Command, args []string) error {
	dir, err := resolveTicketsDir()
	if err != nil {
		return err
	}

	tickets, err := LoadAllTickets(dir, false)
	if err != nil {
		return err
	}
	if len(tickets) == 0 {
		fmt.Println("No tickets found. Create one with 'tix create \"title\"'")
		return nil
	}

	// Filter
	out := tickets[:0]
	for _, t := range tickets {
		if !matchesLsFilter(t) {
			continue
		}
		out = append(out, t)
	}

	// Sort: status priority then created desc.
	sort.SliceStable(out, func(i, j int) bool {
		return out[i].Created > out[j].Created
	})

	for _, t := range out {
		fmt.Println(formatTicketLine(t))
	}
	return nil
}

func matchesLsFilter(t Ticket) bool {
	if lsStatus != "" {
		if t.Status != lsStatus {
			return false
		}
	} else if !lsAll {
		if t.Status == "done" || t.Status == "closed" {
			return false
		}
	}
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

// formatTicketLine renders a ticket in bash-parity format:
//
//	abc12345 [status type assignee] - Title <- [dep1, dep2]
func formatTicketLine(t Ticket) string {
	typ := t.Type
	if typ == "feature" {
		typ = "feat"
	}
	if typ == "" {
		typ = "task"
	}

	assignee := ""
	if t.Assignee != "" {
		assignee = " [" + t.Assignee + "]"
	}

	deps := ""
	if len(t.Deps) > 0 {
		deps = " <- [" + strings.Join(t.Deps, ", ") + "]"
	}

	title := t.Title
	if title == "" {
		title = "(untitled)"
	}

	return fmt.Sprintf("%-8s [%s %s]%s - %s%s",
		t.ID, t.Status, typ, assignee, title, deps)
}
