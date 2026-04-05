package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os/exec"
	"runtime"
)

func openBrowser(url string) {
	var cmd string
	switch runtime.GOOS {
	case "darwin":
		cmd = "open"
	case "linux":
		cmd = "xdg-open"
	case "windows":
		cmd = "start"
	default:
		return
	}
	exec.Command(cmd, url).Start()
}

func main() {
	port := flag.Int("port", 4200, "HTTP server port")
	noBrowser := flag.Bool("no-browser", false, "Don't auto-open browser")
	flag.Parse()

	dir := ticketsDir()
	log.Printf("Tickets directory: %s", dir)

	startWatcher()

	mux := setupRoutes()
	addr := fmt.Sprintf(":%d", *port)
	url := fmt.Sprintf("http://localhost:%d", *port)

	log.Printf("Starting tix-ui-go on %s", url)

	if !*noBrowser {
		go openBrowser(url)
	}

	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
