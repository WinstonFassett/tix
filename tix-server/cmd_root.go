package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "tix",
	Short: "Minimal Git-like ticket tracker",
	Long: `tix is a minimal ticket tracker. Tickets are markdown files with YAML
frontmatter stored under ./tickets/ (like .git/).

With no subcommand, lists open tickets in the current workspace.
Run "tix ui" to launch the web dashboard.`,
	SilenceUsage:  true,
	SilenceErrors: false,
}

// resolveTicketsDir returns the workspace's tickets directory.
// Resolution order matches bash tix:
//  1. TICKETS_DIR (explicit override)
//  2. TIX_WORKSPACE/tickets, then TICKET_WORKSPACE/tickets (legacy)
//  3. <cwd>/tickets
func resolveTicketsDir() (string, error) {
	if v := os.Getenv("TICKETS_DIR"); v != "" {
		abs, err := filepath.Abs(v)
		if err != nil {
			return "", err
		}
		return abs, nil
	}
	if v := os.Getenv("TIX_WORKSPACE"); v != "" {
		return filepath.Abs(filepath.Join(v, "tickets"))
	}
	if v := os.Getenv("TICKET_WORKSPACE"); v != "" {
		return filepath.Abs(filepath.Join(v, "tickets"))
	}
	cwd, err := os.Getwd()
	if err != nil {
		return "", err
	}
	return filepath.Join(cwd, "tickets"), nil
}

func ensureTicketsDir(dir string) error {
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return err
		}
		fmt.Fprintln(os.Stderr, "Created tickets directory:", dir)
	}
	return nil
}
