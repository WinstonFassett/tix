package main

import (
	"fmt"
	"strings"

	"github.com/spf13/cobra"
)

func init() {
	rootCmd.AddCommand(
		newSetStatusCmd("start", "in-progress", "Set ticket status to in-progress"),
		newSetStatusCmd("hold", "on-hold", "Set ticket status to on-hold"),
		newSetStatusCmd("done", "done", "Mark ticket as done"),
		newSetStatusCmd("close", "closed", "Close a ticket"),
		newSetStatusCmd("reopen", "open", "Reopen a ticket"),
		statusCmd,
		renameCmd,
		deleteCmd,
	)
}

func newSetStatusCmd(verb, target, short string) *cobra.Command {
	return &cobra.Command{
		Use:   verb + " <id>",
		Short: short,
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			return setTicketStatus(args[0], target, verb)
		},
	}
}

var statusCmd = &cobra.Command{
	Use:   "status <id> <status>",
	Short: "Set arbitrary ticket status (open|in-progress|review|on-hold|done|closed)",
	Args:  cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		canonical, ok := NormalizeStatus(args[1])
		if !ok {
			return fmt.Errorf("invalid status %q (open|in-progress|review|on-hold|done|closed)", args[1])
		}
		return setTicketStatus(args[0], canonical, "status")
	},
}

func setTicketStatus(id, status, verb string) error {
	dir, err := resolveTicketsDir()
	if err != nil {
		return err
	}
	t, path, err := LoadTicket(dir, id)
	if err != nil {
		return err
	}
	t.Status = status
	if _, err := SaveTicket(dir, *t, path); err != nil {
		return err
	}
	fmt.Printf("Ticket %s -> %s (%s)\n", id, status, verb)
	return nil
}

var renameCmd = &cobra.Command{
	Use:   "rename <id> <new-title...>",
	Short: "Rename a ticket (regenerates filename)",
	Args:  cobra.MinimumNArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		id := args[0]
		newTitle := strings.Join(args[1:], " ")
		dir, err := resolveTicketsDir()
		if err != nil {
			return err
		}
		t, path, err := LoadTicket(dir, id)
		if err != nil {
			return err
		}
		t.Title = newTitle
		newPath, err := SaveTicket(dir, *t, path)
		if err != nil {
			return err
		}
		fmt.Printf("Renamed %s -> %s\n", id, newPath)
		return nil
	},
}

var deleteCmd = &cobra.Command{
	Use:   "delete <id>",
	Short: "Delete a ticket file (no archive)",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		dir, err := resolveTicketsDir()
		if err != nil {
			return err
		}
		_, path, err := LoadTicket(dir, args[0])
		if err != nil {
			return err
		}
		if err := DeleteTicketFile(path); err != nil {
			return err
		}
		fmt.Printf("Deleted %s\n", path)
		return nil
	},
}
