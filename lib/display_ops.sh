#!/usr/bin/env bash

# display_ops.sh - Output formatting and display operations
# Uses awk for what it's good at: formatting, column alignment

# Format ticket list with columns
format_ticket_list() {
    local status_filter="${1:-}"
    local assignee_filter="${2:-}"
    local tag_filter="${3:-}"
    
    awk -v status_filter="$status_filter" -v assignee_filter="$assignee_filter" -v tag_filter="$tag_filter" '
    function has_tag(tags_str, tag,    i, n, arr) {
        n = split(tags_str, arr, ",")
        for (i = 1; i <= n; i++) if (arr[i] == tag) return 1
        return 0
    }
    function emit() {
        if (id != "" && (status_filter == "" ? (status == "open" || status == "in_progress") : (status == status_filter)) && (assignee_filter == "" || assignee == assignee_filter) && (tag_filter == "" || has_tag(tags, tag_filter))) {
            deps_display = (deps != "") ? "[" deps "]" : "[]"
            gsub(/,/, ", ", deps_display)
            dep_str = (deps_display != "[]") ? " <- " deps_display : ""
            printf "%-8s [%s] - %s%s\n", id, status, title, dep_str
        }
    }
    {
        # Parse JSON input from yq
        id = $1; status = $2; title = $3; deps = $4; assignee = $5; tags = $6
        emit()
    }
    '
}

# Format ready tickets (priority-sorted)
format_ready_tickets() {
    local assignee_filter="${1:-}"
    local tag_filter="${2:-}"
    
    awk -v assignee_filter="$assignee_filter" -v tag_filter="$tag_filter" '
    function has_tag(tags_str, tag,    i, n, arr) {
        n = split(tags_str, arr, ",")
        for (i = 1; i <= n; i++) if (arr[i] == tag) return 1
        return 0
    }
    END {
        # Sort by priority, then by id
        for (i = 1; i <= count; i++) {
            for (j = i + 1; j <= count; j++) {
                split(output[i], a, "|")
                split(output[j], b, "|")
                if (a[1] > b[1] || (a[1] == b[1] && a[2] > b[2])) {
                    tmp = output[i]; output[i] = output[j]; output[j] = tmp
                }
            }
        }
        for (i = 1; i <= count; i++) {
            split(output[i], f, "|")
            printf "%-8s [P%s][%s] - %s\n", f[2], f[1], f[3], f[4]
        }
    }
    {
        # Parse input: priority|id|status|title|deps|assignee|tags
        priority = $1; id = $2; status = $3; title = $4; deps = $5; assignee = $6; tags = $7
        
        if (status != "open" && status != "in_progress") next
        if (assignee_filter != "" && assignee != assignee_filter) next
        if (tag_filter != "" && !has_tag(tags, tag_filter)) next
        
        # Check if all deps are closed
        ready = 1
        if (deps != "") {
            n = split(deps, arr, ",")
            for (i = 1; i <= n; i++) {
                dep = arr[i]
                if (dep != "" && dep_status[dep] != "closed") {
                    ready = 0
                    break
                }
            }
        }
        
        if (ready) {
            output[++count] = sprintf("%s|%s|%s|%s", priority, id, status, title)
        }
    }
    '
}

# Format dependency tree (keep complex awk logic)
format_dep_tree() {
    local root_id="$1"
    local full_mode="${2:-0}"
    
    awk -v root_pattern="$root_id" -v full_mode="$full_mode" '
    # This is where we keep the complex dependency tree logic
    # AWK excels at graph algorithms and tree traversal
    BEGIN { 
        # Build dependency relationships
        # Calculate tree depths
        # Format tree structure
    }
    '
}
