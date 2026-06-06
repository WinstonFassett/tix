package main

import (
	"archive/zip"
	"fmt"
	"io"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/spf13/cobra"
)

// Build version is overridden via -ldflags "-X main.buildVersion=...".
var buildVersion = "dev"

func init() {
	rootCmd.AddCommand(archiveCmd, editCmd, openCmd, versionCmd, backupCmd)
}

// --- archive ---

var (
	archiveDays int
	archiveAll  bool
)

var archiveCmd = &cobra.Command{
	Use:   "archive",
	Short: "Move done/closed tickets older than N days to archive/YYYY-MM-DD/",
	RunE: func(cmd *cobra.Command, args []string) error {
		dir, err := resolveTicketsDir()
		if err != nil {
			return err
		}
		all, err := LoadAllTickets(dir, false) // active only
		if err != nil {
			return err
		}
		cutoff := time.Now().AddDate(0, 0, -archiveDays)
		count := 0
		for _, t := range all {
			if !IsTerminalStatus(t.Status) {
				continue
			}
			path, err := FindTicketFile(dir, t.ID)
			if err != nil {
				continue
			}
			info, err := os.Stat(path)
			if err != nil {
				continue
			}
			if !archiveAll && info.ModTime().After(cutoff) {
				continue
			}
			dst, err := ArchiveTicket(dir, path)
			if err != nil {
				fmt.Fprintf(os.Stderr, "archive %s: %v\n", t.ID, err)
				continue
			}
			fmt.Printf("Archived: %s -> %s\n", t.ID, filepath.Base(filepath.Dir(dst)))
			count++
		}
		if count == 0 {
			fmt.Println("No tickets to archive")
		} else {
			fmt.Printf("Archived %d ticket(s)\n", count)
		}
		return nil
	},
}

func init() {
	archiveCmd.Flags().IntVar(&archiveDays, "days", 3, "archive tickets closed at least N days ago")
	archiveCmd.Flags().BoolVar(&archiveAll, "all", false, "archive all closed tickets regardless of age")
}

// --- edit ---

var editCmd = &cobra.Command{
	Use:   "edit <id>",
	Short: "Open ticket in $EDITOR",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		editor := os.Getenv("VISUAL")
		if editor == "" {
			editor = os.Getenv("EDITOR")
		}
		if editor == "" {
			editor = "vi"
		}
		dir, err := resolveTicketsDir()
		if err != nil {
			return err
		}
		path, err := FindTicketFile(dir, args[0])
		if err != nil {
			return err
		}
		fields := strings.Fields(editor)
		if len(fields) == 0 {
			fields = []string{"vi"}
		}
		cmdArgs := append(fields[1:], path)
		c := exec.Command(fields[0], cmdArgs...)
		c.Stdin = os.Stdin
		c.Stdout = os.Stdout
		c.Stderr = os.Stderr
		return c.Run()
	},
}

// --- open ---

var openCmd = &cobra.Command{
	Use:   "open <id>",
	Short: "Open ticket in default app (macOS: open, linux: xdg-open)",
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
		var bin string
		switch runtime.GOOS {
		case "darwin":
			bin = "open"
		case "linux":
			bin = "xdg-open"
		default:
			fmt.Println(path)
			return nil
		}
		return exec.Command(bin, path).Start()
	},
}

// --- version ---

var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Print build version",
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println("tix", buildVersion)
	},
}

// --- backup ---

var backupCmd = &cobra.Command{
	Use:   "backup [output.zip]",
	Short: "Zip the tickets/ directory to a timestamped archive",
	RunE: func(cmd *cobra.Command, args []string) error {
		dir, err := resolveTicketsDir()
		if err != nil {
			return err
		}
		if _, err := os.Stat(dir); err != nil {
			return fmt.Errorf("no tickets directory at %s", dir)
		}
		var out string
		if len(args) > 0 {
			out = args[0]
		} else {
			ts := time.Now().Format("2006-01-02_15-04-05")
			out = filepath.Join(filepath.Dir(dir), "tix-backup-"+ts+".zip")
		}
		count, err := zipDir(dir, out, filepath.Base(dir))
		if err != nil {
			return err
		}
		fmt.Printf("Backed up %d ticket files to %s\n", count, out)
		return nil
	},
}

func zipDir(srcDir, outPath, prefix string) (int, error) {
	f, err := os.Create(outPath)
	if err != nil {
		return 0, err
	}
	defer f.Close()
	w := zip.NewWriter(f)
	defer w.Close()

	count := 0
	err = filepath.WalkDir(srcDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		if strings.HasSuffix(d.Name(), ".DS_Store") {
			return nil
		}
		rel, err := filepath.Rel(srcDir, path)
		if err != nil {
			return err
		}
		entryName := filepath.ToSlash(filepath.Join(prefix, rel))
		zw, err := w.Create(entryName)
		if err != nil {
			return err
		}
		src, err := os.Open(path)
		if err != nil {
			return err
		}
		defer src.Close()
		if _, err := io.Copy(zw, src); err != nil {
			return err
		}
		if strings.HasSuffix(d.Name(), ".md") {
			count++
		}
		return nil
	})
	return count, err
}
