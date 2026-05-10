package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/spf13/cobra"
)

// `tix ui` and friends — HTTP server + workspace registry. Replaces the old
// tix-server top-level commands.

var uiCmd = &cobra.Command{
	Use:   "ui",
	Short: "Run the web UI server (and open browser)",
	RunE:  runUiServe,
}

var (
	uiWorkspace string
	uiPort      int
	uiNoBrowser bool
)

func init() {
	uiCmd.Flags().StringVar(&uiWorkspace, "workspace", "", "workspace path (default: cwd or auto-detect)")
	uiCmd.Flags().IntVar(&uiPort, "port", 4151, "HTTP port")
	uiCmd.Flags().BoolVar(&uiNoBrowser, "no-browser", false, "don't open browser on start")

	uiCmd.AddCommand(uiAddCmd, uiRmCmd, uiLsCmd, uiOpenCmd)
	rootCmd.AddCommand(uiCmd)
}

var uiAddCmd = &cobra.Command{
	Use:   "add <name> [path]",
	Short: "Register a workspace (default path: cwd)",
	Args:  cobra.MinimumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		name := args[0]
		path := ""
		if len(args) > 1 {
			path = args[1]
		} else {
			cwd, err := os.Getwd()
			if err != nil {
				return err
			}
			path = cwd
		}
		abs, err := filepath.Abs(path)
		if err != nil {
			return err
		}
		reg := loadRegistry()
		reg.Workspaces[name] = abs
		if err := saveRegistry(reg); err != nil {
			return err
		}
		fmt.Printf("registered workspace %q → %s\n", name, abs)
		return nil
	},
}

var uiRmCmd = &cobra.Command{
	Use:   "rm <name>",
	Short: "Unregister a workspace",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		reg := loadRegistry()
		if _, ok := reg.Workspaces[args[0]]; !ok {
			return fmt.Errorf("workspace %q not found", args[0])
		}
		delete(reg.Workspaces, args[0])
		if err := saveRegistry(reg); err != nil {
			return err
		}
		fmt.Printf("removed workspace %q\n", args[0])
		return nil
	},
}

var uiLsCmd = &cobra.Command{
	Use:   "ls",
	Short: "List registered workspaces",
	RunE: func(cmd *cobra.Command, args []string) error {
		reg := loadRegistry()
		if len(reg.Workspaces) == 0 {
			fmt.Println("no workspaces registered")
			return nil
		}
		for name, path := range reg.Workspaces {
			fmt.Printf("  %-20s %s\n", name, path)
		}
		return nil
	},
}

var uiOpenCmd = &cobra.Command{
	Use:   "open [name]",
	Short: "Open UI for a workspace (probes port, starts if needed)",
	RunE: func(cmd *cobra.Command, args []string) error {
		reg := loadRegistry()
		var wsPath string

		if len(args) > 0 {
			p, ok := reg.Workspaces[args[0]]
			if !ok {
				return fmt.Errorf("workspace %q not registered. Use: tix ui add <name>", args[0])
			}
			wsPath = p
		} else {
			cwd, _ := os.Getwd()
			_, wsPath = nearestWorkspace(cwd, reg)
			if wsPath == "" {
				wsPath = cwd
			}
		}

		port := uiPort
		addr := "http://localhost:" + strconv.Itoa(port)

		if isListening(addr) {
			fmt.Println("server already running →", addr)
			openBrowser(addr)
			return nil
		}

		exe, _ := os.Executable()
		c := exec.Command(exe, "ui", "--workspace", wsPath, "--port", strconv.Itoa(port))
		c.Stdout = os.Stdout
		c.Stderr = os.Stderr
		return c.Run()
	},
}

func runUiServe(cmd *cobra.Command, args []string) error {
	wsPath := uiWorkspace
	if wsPath == "" {
		cwd, err := os.Getwd()
		if err != nil {
			return fmt.Errorf("cannot determine working directory: %w", err)
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
		return fmt.Errorf("cannot resolve workspace path: %w", err)
	}
	wsPath = abs

	ticketsDir := filepath.Join(wsPath, "tickets")
	dbDir := filepath.Join(wsPath, ".tix")
	if err := os.MkdirAll(dbDir, 0755); err != nil {
		return fmt.Errorf("cannot create .tix dir: %w", err)
	}
	dbPath := filepath.Join(dbDir, "tix-server.db")

	wsName := filepath.Base(wsPath)
	appName := wsName + "-tix"

	port, err := findFreePort(uiPort)
	if err != nil {
		return err
	}

	// If portless is available and we're not already running inside it, re-exec via portless.
	portlessPath, _ := exec.LookPath("portless")
	if portlessPath != "" && os.Getenv("PORTLESS") != "0" && os.Getenv("TIX_UI_PORTLESS") == "" {
		portlessURL := fmt.Sprintf("http://%s.localhost:%s", appName, portlessPort())
		fmt.Printf("tix ui      %s  (%s)\n", portlessURL, wsName)
		fmt.Printf("workspace   %s\n", wsPath)
		fmt.Printf("tickets     %s\n", ticketsDir)
		fmt.Println("(press ^C to stop)")
		if !uiNoBrowser {
			go waitAndOpen(fmt.Sprintf("localhost:%d", port), portlessURL)
		}
		exe, _ := os.Executable()
		c := exec.Command(portlessPath, appName, exe, "ui",
			"--workspace", wsPath,
			"--port", strconv.Itoa(port),
			"--no-browser",
		)
		c.Env = append(os.Environ(), "TIX_UI_PORTLESS=1")
		c.Stdout = os.Stdout
		c.Stderr = os.Stderr
		return c.Run()
	}

	srv, err := NewServer(wsPath, ticketsDir, dbPath, port)
	if err != nil {
		return fmt.Errorf("failed to create server: %w", err)
	}

	addr := fmt.Sprintf("http://localhost:%d", port)
	fmt.Printf("tix ui      %s  (%s)\n", addr, wsName)
	fmt.Printf("workspace   %s\n", wsPath)
	fmt.Printf("tickets     %s\n", ticketsDir)
	fmt.Println("(press ^C to stop)")

	if !uiNoBrowser {
		go waitAndOpen(fmt.Sprintf("localhost:%d", port), addr)
	}

	if err := srv.Start(); err != nil {
		log.Fatalf("server error: %v", err)
	}
	return nil
}

func findFreePort(start int) (int, error) {
	for port := start; port < 65535; port++ {
		ln, err := net.Listen("tcp", fmt.Sprintf(":%d", port))
		if err == nil {
			ln.Close()
			return port, nil
		}
	}
	return 0, fmt.Errorf("no free port found starting from %d", start)
}

func portlessPort() string {
	if p := os.Getenv("PORTLESS_PORT"); p != "" {
		return p
	}
	return "1355"
}

// waitAndOpen polls hostPort (e.g. "localhost:4151") until the server is up,
// then opens openURL in the browser.
func waitAndOpen(hostPort, openURL string) {
	deadline := time.Now().Add(60 * time.Second)
	for time.Now().Before(deadline) {
		conn, err := net.DialTimeout("tcp", hostPort, 300*time.Millisecond)
		if err == nil {
			conn.Close()
			openBrowser(openURL)
			return
		}
		time.Sleep(100 * time.Millisecond)
	}
}

// --- Workspace registry helpers (moved from main.go) ---

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
	if reg.Workspaces == nil {
		reg.Workspaces = map[string]string{}
	}
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

func nearestWorkspace(cwd string, reg workspaceRegistry) (string, string) {
	best, bestPath := "", ""
	for name, path := range reg.Workspaces {
		if strings.HasPrefix(cwd, path) && len(path) > len(bestPath) {
			best, bestPath = name, path
		}
	}
	return best, bestPath
}

func isListening(addr string) bool {
	hostPort := strings.TrimPrefix(addr, "http://")
	conn, err := net.DialTimeout("tcp", hostPort, 300*time.Millisecond)
	if err != nil {
		return false
	}
	conn.Close()
	return true
}
