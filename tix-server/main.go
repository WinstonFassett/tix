package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
)

// ~/.tix/workspaces.json registry for daemon mode.
type workspaceRegistry struct {
	Workspaces map[string]string `json:"workspaces"` // name → abs path
}

func registryPath() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".tix", "workspaces.json")
}

func loadRegistry() workspaceRegistry {
	reg := workspaceRegistry{Workspaces: map[string]string{}}
	data, err := os.ReadFile(registryPath())
	if err != nil {
		return reg
	}
	_ = json.Unmarshal(data, &reg)
	return reg
}

func saveRegistry(reg workspaceRegistry) error {
	path := registryPath()
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(reg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

func openBrowser(url string) {
	var cmd string
	var args []string
	switch runtime.GOOS {
	case "darwin":
		cmd = "open"
		args = []string{url}
	case "linux":
		cmd = "xdg-open"
		args = []string{url}
	default:
		fmt.Println("Open:", url)
		return
	}
	_ = exec.Command(cmd, args...).Start()
}

// nearestWorkspace finds a registered workspace whose path is an ancestor
// of (or equal to) cwd. Picks the deepest (most specific) match.
func nearestWorkspace(cwd string, reg workspaceRegistry) (string, string) {
	best, bestPath := "", ""
	for name, path := range reg.Workspaces {
		if strings.HasPrefix(cwd, path) && len(path) > len(bestPath) {
			best, bestPath = name, path
		}
	}
	return best, bestPath
}

func main() {
	flag.Usage = func() {
		fmt.Fprintf(os.Stderr, `tix-server — Go-based tix UI server

Usage:
  tix-server [flags]                  Start server for a workspace
  tix-server add <name> [path]        Register a workspace (default path: cwd)
  tix-server rm <name>                Unregister a workspace
  tix-server ls                       List registered workspaces
  tix-server open [name]              Open UI for workspace (auto-detect from cwd)

Flags:
`)
		flag.PrintDefaults()
	}

	workspace := flag.String("workspace", "", "Workspace path (default: cwd or auto-detected)")
	port := flag.Int("port", 4151, "HTTP port")
	noBrowser := flag.Bool("no-browser", false, "Don't open browser on start")
	flag.Parse()

	args := flag.Args()
	cmd := ""
	if len(args) > 0 {
		cmd = args[0]
	}

	switch cmd {
	case "add":
		cmdAdd(args[1:])
	case "rm":
		cmdRm(args[1:])
	case "ls":
		cmdLs()
	case "open":
		cmdOpen(args[1:], *port)
	default:
		cmdServe(*workspace, *port, *noBrowser)
	}
}

func cmdAdd(args []string) {
	if len(args) == 0 {
		fmt.Fprintln(os.Stderr, "usage: tix-server add <name> [path]")
		os.Exit(1)
	}
	name := args[0]
	path := ""
	if len(args) > 1 {
		path = args[1]
	} else {
		cwd, err := os.Getwd()
		if err != nil {
			log.Fatal(err)
		}
		path = cwd
	}
	abs, err := filepath.Abs(path)
	if err != nil {
		log.Fatal(err)
	}
	reg := loadRegistry()
	reg.Workspaces[name] = abs
	if err := saveRegistry(reg); err != nil {
		log.Fatal(err)
	}
	fmt.Printf("registered workspace %q → %s\n", name, abs)
}

func cmdRm(args []string) {
	if len(args) == 0 {
		fmt.Fprintln(os.Stderr, "usage: tix-server rm <name>")
		os.Exit(1)
	}
	reg := loadRegistry()
	if _, ok := reg.Workspaces[args[0]]; !ok {
		fmt.Fprintf(os.Stderr, "workspace %q not found\n", args[0])
		os.Exit(1)
	}
	delete(reg.Workspaces, args[0])
	if err := saveRegistry(reg); err != nil {
		log.Fatal(err)
	}
	fmt.Printf("removed workspace %q\n", args[0])
}

func cmdLs() {
	reg := loadRegistry()
	if len(reg.Workspaces) == 0 {
		fmt.Println("no workspaces registered")
		return
	}
	for name, path := range reg.Workspaces {
		fmt.Printf("  %-20s %s\n", name, path)
	}
}

func cmdOpen(args []string, port int) {
	reg := loadRegistry()
	var wsPath string

	if len(args) > 0 {
		p, ok := reg.Workspaces[args[0]]
		if !ok {
			fmt.Fprintf(os.Stderr, "workspace %q not registered. Use: tix-server add <name>\n", args[0])
			os.Exit(1)
		}
		wsPath = p
	} else {
		cwd, _ := os.Getwd()
		_, wsPath = nearestWorkspace(cwd, reg)
		if wsPath == "" {
			// Fall back to cwd
			wsPath = cwd
		}
	}

	// Re-exec as serve for the resolved workspace, opening browser
	exe, _ := os.Executable()
	c := exec.Command(exe, "--workspace", wsPath, "--port", strconv.Itoa(port))
	c.Stdout = os.Stdout
	c.Stderr = os.Stderr
	if err := c.Run(); err != nil {
		log.Fatal(err)
	}
}

func cmdServe(workspace string, port int, noBrowser bool) {
	wsPath := workspace
	if wsPath == "" {
		// Auto-detect from cwd
		cwd, err := os.Getwd()
		if err != nil {
			log.Fatalf("cannot determine working directory: %v", err)
		}
		reg := loadRegistry()
		_, best := nearestWorkspace(cwd, reg)
		if best != "" {
			wsPath = best
		} else {
			wsPath = cwd
		}
	}

	abs, err := filepath.Abs(wsPath)
	if err != nil {
		log.Fatalf("cannot resolve workspace path: %v", err)
	}
	wsPath = abs

	ticketsDir := filepath.Join(wsPath, "tickets")
	dbDir := filepath.Join(wsPath, ".tix")
	if err := os.MkdirAll(dbDir, 0755); err != nil {
		log.Fatalf("cannot create .tix dir: %v", err)
	}
	dbPath := filepath.Join(dbDir, "tix-server.db")

	srv, err := NewServer(wsPath, ticketsDir, dbPath, port)
	if err != nil {
		log.Fatalf("failed to create server: %v", err)
	}

	addr := fmt.Sprintf("http://localhost:%d", port)
	wsName := filepath.Base(wsPath)
	fmt.Printf("tix-server  %s  (%s)\n", addr, wsName)
	fmt.Printf("workspace   %s\n", wsPath)
	fmt.Printf("tickets     %s\n", ticketsDir)

	if !noBrowser {
		openBrowser(addr)
	}

	if err := srv.Start(); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
