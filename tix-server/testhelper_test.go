package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

// tixCmd runs the compiled tix binary against an isolated temp tickets dir.
// The binary is built once per test via go build; set TIX_TEST_BINARY to a
// pre-built path to skip the build (useful in CI).
//
// Usage:
//
//	out, err := tixCmd(t, dir, "create", "My Ticket", "--type", "bug")
func tixCmd(t *testing.T, ticketsDir string, args ...string) (string, error) {
	t.Helper()
	bin := os.Getenv("TIX_TEST_BINARY")
	if bin == "" {
		bin = buildTixBinary(t)
	}
	cmd := exec.Command(bin, args...)
	cmd.Env = append(os.Environ(), "TICKETS_DIR="+ticketsDir)
	out, err := cmd.CombinedOutput()
	return string(out), err
}

// buildTixBinary compiles the binary into t.TempDir() and caches the path in
// an env var so parallel subtests reuse the same build.
func buildTixBinary(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	bin := filepath.Join(dir, "tix")
	cmd := exec.Command("go", "build", "-o", bin, ".")
	cmd.Dir = "."
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("build tix binary: %v\n%s", err, out)
	}
	t.Setenv("TIX_TEST_BINARY", bin)
	return bin
}
