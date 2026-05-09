package main

import (
	"fmt"
	"strings"
	"time"

	"github.com/spf13/cobra"
)

var createCmd = &cobra.Command{
	Use:   "create [title]",
	Short: "Create a new ticket",
	Long: `Create a new ticket. Title may be passed as a positional argument or with -t.

Examples:
  tix create "Fix login bug" --type bug --priority 1
  tix create -t "API timeout" --tags backend,perf --deps abc1,def2`,
	RunE: runCreate,
}

var (
	createTitle    string
	createType     string
	createPriority int
	createAssignee string
	createTags     string
	createDeps     string
	createDesc     string
)

func init() {
	createCmd.Flags().StringVarP(&createTitle, "title", "t", "", "ticket title (or pass as positional arg)")
	createCmd.Flags().StringVarP(&createType, "type", "T", "task", "ticket type (task, bug, feature, spike, epic, ...)")
	createCmd.Flags().IntVarP(&createPriority, "priority", "p", 2, "priority 0-4 (0 highest)")
	createCmd.Flags().StringVarP(&createAssignee, "assignee", "a", "", "assignee")
	createCmd.Flags().StringVar(&createTags, "tags", "", "comma-separated tags")
	createCmd.Flags().StringVar(&createDeps, "deps", "", "comma-separated dependency IDs")
	createCmd.Flags().StringVarP(&createDesc, "description", "d", "", "description (becomes ticket body)")
	rootCmd.AddCommand(createCmd)
}

func runCreate(cmd *cobra.Command, args []string) error {
	title := createTitle
	if title == "" && len(args) > 0 {
		title = strings.TrimSpace(args[0])
	}
	if title == "" {
		return fmt.Errorf("title is required (positional arg or -t/--title)")
	}
	if createPriority < 0 || createPriority > 4 {
		return fmt.Errorf("priority must be 0-4")
	}

	dir, err := resolveTicketsDir()
	if err != nil {
		return err
	}
	if err := ensureTicketsDir(dir); err != nil {
		return err
	}

	id, err := NextTicketID(dir)
	if err != nil {
		return err
	}

	t := Ticket{
		ID:       id,
		Title:    title,
		Status:   "open",
		Type:     createType,
		Priority: createPriority,
		Assignee: createAssignee,
		Tags:     splitCSV(createTags),
		Deps:     splitCSV(createDeps),
		Links:    []string{},
		Created:  time.Now().UTC().Format("2006-01-02T15:04:05Z"),
		Body:     createDesc,
	}

	path, err := WriteNewTicketFile(dir, t)
	if err != nil {
		return err
	}

	fmt.Printf("Created ticket %s at:\n%s\n", id, path)
	return nil
}

func splitCSV(s string) []string {
	if s == "" {
		return []string{}
	}
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}
