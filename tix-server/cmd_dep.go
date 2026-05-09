package main

import (
	"fmt"
	"sort"
	"strings"

	"github.com/spf13/cobra"
)

func init() {
	depCmd.AddCommand(depTreeCmd, depCycleCmd)
	rootCmd.AddCommand(depCmd, undepCmd)
}

var depCmd = &cobra.Command{
	Use:   "dep <id> <dep-id>",
	Short: "Add a dependency (id depends on dep-id)",
	RunE: func(cmd *cobra.Command, args []string) error {
		// Allow `tix dep tree …` and `tix dep cycle …` to fall through to subcommands.
		if len(args) >= 1 && (args[0] == "tree" || args[0] == "cycle") {
			return cmd.Help()
		}
		if len(args) != 2 {
			return fmt.Errorf("usage: tix dep <id> <dep-id>")
		}
		dir, err := resolveTicketsDir()
		if err != nil {
			return err
		}
		t, path, err := LoadTicket(dir, args[0])
		if err != nil {
			return err
		}
		if _, _, err := LoadTicket(dir, args[1]); err != nil {
			return fmt.Errorf("dependency not found: %s", args[1])
		}
		for _, d := range t.Deps {
			if d == args[1] {
				fmt.Println("Dependency already exists")
				return nil
			}
		}
		t.Deps = append(t.Deps, args[1])
		if _, err := SaveTicket(dir, *t, path); err != nil {
			return err
		}
		fmt.Printf("Added dependency: %s -> %s\n", args[0], args[1])
		return nil
	},
}

var undepCmd = &cobra.Command{
	Use:   "undep <id> <dep-id>",
	Short: "Remove a dependency",
	Args:  cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		dir, err := resolveTicketsDir()
		if err != nil {
			return err
		}
		t, path, err := LoadTicket(dir, args[0])
		if err != nil {
			return err
		}
		out := t.Deps[:0]
		removed := false
		for _, d := range t.Deps {
			if d == args[1] {
				removed = true
				continue
			}
			out = append(out, d)
		}
		if !removed {
			return fmt.Errorf("dependency %s not found on %s", args[1], args[0])
		}
		t.Deps = out
		if _, err := SaveTicket(dir, *t, path); err != nil {
			return err
		}
		fmt.Printf("Removed dependency: %s -X-> %s\n", args[0], args[1])
		return nil
	},
}

var depFullMode bool

var depTreeCmd = &cobra.Command{
	Use:   "tree [id]",
	Short: "Show dependency tree (or all trees if no id)",
	RunE:  runDepTree,
}

func init() {
	depTreeCmd.Flags().BoolVar(&depFullMode, "full", false, "show terminal tickets too")
}

var depCycleCmd = &cobra.Command{
	Use:   "cycle",
	Short: "Find dependency cycles in open tickets",
	RunE:  runDepCycle,
}

func runDepTree(cmd *cobra.Command, args []string) error {
	_, idx, err := loadAllForDeps()
	if err != nil {
		return err
	}
	if len(args) == 0 {
		// All trees: roots = tickets nothing depends on
		dependedOn := map[string]bool{}
		for _, t := range idx {
			for _, d := range t.Deps {
				dependedOn[d] = true
			}
		}
		var roots []string
		for id, t := range idx {
			if dependedOn[id] {
				continue
			}
			if !depFullMode && IsTerminalStatus(t.Status) {
				continue
			}
			roots = append(roots, id)
		}
		sort.Strings(roots)
		for _, r := range roots {
			printDepTree(r, idx, 0, map[string]bool{})
		}
		return nil
	}
	id := args[0]
	if _, ok := idx[id]; !ok {
		return fmt.Errorf("ticket %s not found", id)
	}
	printDepTree(id, idx, 0, map[string]bool{})
	return nil
}

func printDepTree(id string, idx map[string]Ticket, depth int, seen map[string]bool) {
	t, ok := idx[id]
	if !ok {
		fmt.Printf("%s%s [missing]\n", strings.Repeat("  ", depth), id)
		return
	}
	if !depFullMode && IsTerminalStatus(t.Status) {
		return
	}
	marker := ""
	if seen[id] {
		marker = " (cycle)"
	}
	fmt.Printf("%s%s [%s] %s%s\n", strings.Repeat("  ", depth), id, t.Status, t.Title, marker)
	if seen[id] {
		return
	}
	seen[id] = true
	defer delete(seen, id)
	for _, d := range t.Deps {
		printDepTree(d, idx, depth+1, seen)
	}
}

func runDepCycle(cmd *cobra.Command, args []string) error {
	_, idx, err := loadAllForDeps()
	if err != nil {
		return err
	}
	cycles := findCycles(idx)
	if len(cycles) == 0 {
		fmt.Println("No dependency cycles found.")
		return nil
	}
	fmt.Printf("Found %d cycle(s):\n", len(cycles))
	for i, c := range cycles {
		fmt.Printf("%d: %s\n", i+1, strings.Join(c, " -> "))
	}
	return nil
}

func findCycles(idx map[string]Ticket) [][]string {
	var cycles [][]string
	color := map[string]int{} // 0=white, 1=gray, 2=black
	var stack []string

	var dfs func(string)
	dfs = func(u string) {
		color[u] = 1
		stack = append(stack, u)
		t, ok := idx[u]
		if ok {
			for _, v := range t.Deps {
				switch color[v] {
				case 0:
					dfs(v)
				case 1:
					// found cycle: extract from stack
					for i, s := range stack {
						if s == v {
							cycle := append([]string{}, stack[i:]...)
							cycle = append(cycle, v)
							cycles = append(cycles, cycle)
							break
						}
					}
				}
			}
		}
		color[u] = 2
		stack = stack[:len(stack)-1]
	}

	keys := make([]string, 0, len(idx))
	for k := range idx {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		if color[k] == 0 {
			dfs(k)
		}
	}
	return cycles
}
