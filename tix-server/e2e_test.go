package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// extractID pulls the 4-hex ticket ID out of a "Created ticket XXXX at:" line.
func extractID(t *testing.T, out string) string {
	t.Helper()
	for _, line := range strings.Split(out, "\n") {
		if strings.HasPrefix(line, "Created ticket ") {
			parts := strings.Fields(line)
			if len(parts) >= 3 {
				return parts[2]
			}
		}
	}
	t.Fatalf("could not extract ticket ID from output:\n%s", out)
	return ""
}

func TestE2E_CreateAndList(t *testing.T) {
	dir := t.TempDir()

	out, err := tixCmd(t, dir, "create", "My Bug", "--type", "bug")
	if err != nil {
		t.Fatalf("create: %v\n%s", err, out)
	}
	if !strings.Contains(out, "Created ticket") {
		t.Fatalf("expected 'Created ticket' in output, got:\n%s", out)
	}

	out, err = tixCmd(t, dir, "ls")
	if err != nil {
		t.Fatalf("ls: %v\n%s", err, out)
	}
	if !strings.Contains(out, "My Bug") {
		t.Fatalf("expected 'My Bug' in ls output, got:\n%s", out)
	}
}

func TestE2E_CreateSetsType(t *testing.T) {
	dir := t.TempDir()
	out, err := tixCmd(t, dir, "create", "Feature Ticket", "--type", "feature")
	if err != nil {
		t.Fatalf("create: %v\n%s", err, out)
	}
	id := extractID(t, out)

	path, err := FindTicketFile(dir, id)
	if err != nil {
		t.Fatal(err)
	}
	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(content), "type: feature") {
		t.Errorf("expected type: feature in file, got:\n%s", string(content))
	}
}

func TestE2E_Rename(t *testing.T) {
	dir := t.TempDir()
	out, err := tixCmd(t, dir, "create", "Old Title")
	if err != nil {
		t.Fatalf("create: %v\n%s", err, out)
	}
	id := extractID(t, out)

	out, err = tixCmd(t, dir, "rename", id, "New Title")
	if err != nil {
		t.Fatalf("rename: %v\n%s", err, out)
	}

	// Filename should reflect new title.
	path, err := FindTicketFile(dir, id)
	if err != nil {
		t.Fatalf("FindTicketFile after rename: %v", err)
	}
	if !strings.Contains(filepath.Base(path), "New Title") {
		t.Errorf("expected filename to contain 'New Title', got %s", filepath.Base(path))
	}

	// H1 in file body should be updated.
	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(content), "# New Title") {
		t.Errorf("expected '# New Title' in file body, got:\n%s", string(content))
	}
	if strings.Contains(string(content), "# Old Title") {
		t.Errorf("stale '# Old Title' still present in file body:\n%s", string(content))
	}
}

func TestE2E_Lifecycle(t *testing.T) {
	dir := t.TempDir()
	out, err := tixCmd(t, dir, "create", "Lifecycle Ticket")
	if err != nil {
		t.Fatalf("create: %v\n%s", err, out)
	}
	id := extractID(t, out)

	steps := []struct {
		cmd    string
		status string
	}{
		{"start", "in-progress"},
		{"hold", "on-hold"},
		{"reopen", "open"},
		{"done", "done"},
		{"close", "closed"},
	}

	for _, step := range steps {
		out, err = tixCmd(t, dir, step.cmd, id)
		if err != nil {
			t.Fatalf("%s: %v\n%s", step.cmd, err, out)
		}
		loaded, _, loadErr := LoadTicket(dir, id)
		if loadErr != nil {
			t.Fatalf("LoadTicket after %s: %v", step.cmd, loadErr)
		}
		if loaded.Status != step.status {
			t.Errorf("after %s: expected status %q, got %q", step.cmd, step.status, loaded.Status)
		}
	}
}

func TestE2E_StatusCommand(t *testing.T) {
	dir := t.TempDir()
	out, err := tixCmd(t, dir, "create", "Status Test")
	if err != nil {
		t.Fatalf("create: %v\n%s", err, out)
	}
	id := extractID(t, out)

	out, err = tixCmd(t, dir, "status", id, "review")
	if err != nil {
		t.Fatalf("status: %v\n%s", err, out)
	}

	ticket, _, err := LoadTicket(dir, id)
	if err != nil {
		t.Fatal(err)
	}
	if ticket.Status != "review" {
		t.Errorf("expected status review, got %s", ticket.Status)
	}
}

func TestE2E_DepAndUndep(t *testing.T) {
	dir := t.TempDir()

	out, err := tixCmd(t, dir, "create", "Parent Task")
	if err != nil {
		t.Fatalf("create parent: %v\n%s", err, out)
	}
	parentID := extractID(t, out)

	out, err = tixCmd(t, dir, "create", "Child Task")
	if err != nil {
		t.Fatalf("create child: %v\n%s", err, out)
	}
	childID := extractID(t, out)

	// parent depends on child
	out, err = tixCmd(t, dir, "dep", parentID, childID)
	if err != nil {
		t.Fatalf("dep: %v\n%s", err, out)
	}
	if !strings.Contains(out, "Added dependency") {
		t.Errorf("expected 'Added dependency' in output, got:\n%s", out)
	}

	ticket, _, err := LoadTicket(dir, parentID)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, d := range ticket.Deps {
		if d == childID {
			found = true
		}
	}
	if !found {
		t.Errorf("expected %s in Deps of %s, got %v", childID, parentID, ticket.Deps)
	}

	// duplicate dep is a no-op
	out, err = tixCmd(t, dir, "dep", parentID, childID)
	if err != nil {
		t.Fatalf("dep duplicate: %v\n%s", err, out)
	}
	if !strings.Contains(out, "already exists") {
		t.Errorf("expected 'already exists' for duplicate dep, got:\n%s", out)
	}

	// undep removes it
	out, err = tixCmd(t, dir, "undep", parentID, childID)
	if err != nil {
		t.Fatalf("undep: %v\n%s", err, out)
	}
	ticket, _, err = LoadTicket(dir, parentID)
	if err != nil {
		t.Fatal(err)
	}
	for _, d := range ticket.Deps {
		if d == childID {
			t.Errorf("dep %s still present after undep", childID)
		}
	}
}

func TestE2E_AddNote(t *testing.T) {
	dir := t.TempDir()
	out, err := tixCmd(t, dir, "create", "Note Target")
	if err != nil {
		t.Fatalf("create: %v\n%s", err, out)
	}
	id := extractID(t, out)

	out, err = tixCmd(t, dir, "add-note", id, "This is my note")
	if err != nil {
		t.Fatalf("add-note: %v\n%s", err, out)
	}

	path, err := FindTicketFile(dir, id)
	if err != nil {
		t.Fatal(err)
	}
	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(content), "## Notes") {
		t.Errorf("expected '## Notes' section in file:\n%s", string(content))
	}
	if !strings.Contains(string(content), "This is my note") {
		t.Errorf("expected note text in file:\n%s", string(content))
	}
}

func TestE2E_AddACAndCheck(t *testing.T) {
	dir := t.TempDir()
	out, err := tixCmd(t, dir, "create", "AC Ticket")
	if err != nil {
		t.Fatalf("create: %v\n%s", err, out)
	}
	id := extractID(t, out)

	// add two AC items
	out, err = tixCmd(t, dir, "add-ac", id, "First criterion")
	if err != nil {
		t.Fatalf("add-ac 1: %v\n%s", err, out)
	}
	out, err = tixCmd(t, dir, "add-ac", id, "Second criterion")
	if err != nil {
		t.Fatalf("add-ac 2: %v\n%s", err, out)
	}

	path, err := FindTicketFile(dir, id)
	if err != nil {
		t.Fatal(err)
	}
	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(content), "- [ ] First criterion") {
		t.Errorf("expected unchecked first AC, got:\n%s", string(content))
	}

	// check item #1
	out, err = tixCmd(t, dir, "check", id, "1")
	if err != nil {
		t.Fatalf("check: %v\n%s", err, out)
	}

	content, err = os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(content), "- [x] First criterion") {
		t.Errorf("expected checked first AC after check, got:\n%s", string(content))
	}
	if !strings.Contains(string(content), "- [ ] Second criterion") {
		t.Errorf("expected unchecked second AC, got:\n%s", string(content))
	}

	// check #1 again — toggles back to unchecked
	out, err = tixCmd(t, dir, "check", id, "1")
	if err != nil {
		t.Fatalf("check toggle: %v\n%s", err, out)
	}
	content, err = os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(content), "- [ ] First criterion") {
		t.Errorf("expected unchecked first AC after toggle, got:\n%s", string(content))
	}
}

func TestE2E_Archive(t *testing.T) {
	dir := t.TempDir()
	out, err := tixCmd(t, dir, "create", "Archive Me")
	if err != nil {
		t.Fatalf("create: %v\n%s", err, out)
	}
	id := extractID(t, out)

	out, err = tixCmd(t, dir, "close", id)
	if err != nil {
		t.Fatalf("close: %v\n%s", err, out)
	}

	// archive --all bypasses the age check
	out, err = tixCmd(t, dir, "archive", "--all")
	if err != nil {
		t.Fatalf("archive: %v\n%s", err, out)
	}
	if !strings.Contains(out, "Archived") {
		t.Fatalf("expected 'Archived' in output, got:\n%s", out)
	}

	// ticket should no longer appear in default ls
	out, err = tixCmd(t, dir, "ls")
	if err != nil {
		t.Fatalf("ls after archive: %v\n%s", err, out)
	}
	if strings.Contains(out, "Archive Me") {
		t.Errorf("expected archived ticket to be absent from ls, got:\n%s", out)
	}

	// ticket file should exist under archive/
	archDir := filepath.Join(dir, "archive")
	found := false
	_ = filepath.Walk(archDir, func(p string, _ os.FileInfo, _ error) error {
		if strings.Contains(filepath.Base(p), id) {
			found = true
		}
		return nil
	})
	if !found {
		t.Errorf("expected ticket file under archive/, not found in %s", archDir)
	}
}

func TestE2E_DepTree(t *testing.T) {
	dir := t.TempDir()

	out, err := tixCmd(t, dir, "create", "Root Epic")
	if err != nil {
		t.Fatalf("create root: %v\n%s", err, out)
	}
	rootID := extractID(t, out)

	out, err = tixCmd(t, dir, "create", "Sub Task")
	if err != nil {
		t.Fatalf("create sub: %v\n%s", err, out)
	}
	subID := extractID(t, out)

	// root depends on sub
	_, err = tixCmd(t, dir, "dep", rootID, subID)
	if err != nil {
		t.Fatalf("dep: %v", err)
	}

	out, err = tixCmd(t, dir, "dep", "tree")
	if err != nil {
		t.Fatalf("dep tree: %v\n%s", err, out)
	}
	if !strings.Contains(out, rootID) {
		t.Errorf("expected root %s in tree output, got:\n%s", rootID, out)
	}
	if !strings.Contains(out, subID) {
		t.Errorf("expected sub %s in tree output, got:\n%s", subID, out)
	}

	// --full includes terminal (done/closed) tickets; mark sub done, verify --full shows it
	_, err = tixCmd(t, dir, "done", subID)
	if err != nil {
		t.Fatalf("done: %v", err)
	}

	out, err = tixCmd(t, dir, "dep", "tree", "--full")
	if err != nil {
		t.Fatalf("dep tree --full: %v\n%s", err, out)
	}
	if !strings.Contains(out, subID) {
		t.Errorf("expected done sub %s in --full tree output, got:\n%s", subID, out)
	}
}
