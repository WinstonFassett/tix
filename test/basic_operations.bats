#!/usr/bin/env bats

# basic_operations.bats - Tests for core ticket functionality

load test_helper

@test "tix --help prints help without unknown command error" {
    run ./tix --help
    [ "$status" -eq 0 ]

    [[ "$output" =~ "Usage: tix <command>" ]]
    if [[ "$output" =~ "Unknown command:" ]]; then
        fail "--help should not be treated as an unknown command"
    fi
}

@test "tix create creates a new ticket" {
    local ticket_id
    ticket_id=$(create_test_ticket "Test ticket")

    # Should be a 4-char hex ID
    [[ "$ticket_id" =~ ^[a-f0-9]{4}$ ]]

    # Ticket file should exist
    local file
    file=$(find tickets -name "*(${ticket_id}).md" | head -1)
    [ -f "$file" ]
}

@test "tix create with priority sets priority" {
    local ticket_id
    ticket_id=$(create_test_ticket "High priority ticket" --priority 1)

    local priority
    priority=$(get_ticket_field "$ticket_id" "priority")
    [ "$priority" = "1" ]
}

@test "tix create with type sets type" {
    local ticket_id
    ticket_id=$(create_test_ticket "Bug ticket" --type bug)

    local type
    type=$(get_ticket_field "$ticket_id" "type")
    [ "$type" = "bug" ]
}

@test "tix ls lists tickets" {
    create_test_ticket "First ticket"
    create_test_ticket "Second ticket"

    run ./tix ls
    [ "$status" -eq 0 ]

    [ "$(get_ticket_count)" -eq 2 ]

    [[ "$output" =~ "First Ticket" ]]
    [[ "$output" =~ "Second Ticket" ]]
}

@test "tix ls excludes nested tickets by default and shows them with --deep" {
    local nested_id
    nested_id=$(create_test_ticket "Nested backlog item")
    move_ticket_to_folder "$nested_id" "backlog"

    run ./tix ls
    [ "$status" -eq 0 ]
    if [[ "$output" =~ "$nested_id" ]]; then
        fail "default ls should not include nested tickets"
    fi

    run ./tix ls --deep
    [ "$status" -eq 0 ]
    [[ "$output" =~ "[backlog]" ]]
    [[ "$output" =~ "$nested_id" ]]
}

@test "tix ls filters by status" {
    create_test_ticket "Open ticket"

    local ticket_id
    ticket_id=$(create_test_ticket "Closed ticket")
    ./tix close "$ticket_id"

    run ./tix ls --status=open
    [ "$status" -eq 0 ]

    [[ "$output" =~ "Open Ticket" ]]
    if [[ "$output" =~ "Closed Ticket" ]]; then
        fail "Should not show closed tickets"
    fi
}

@test "tix show displays ticket details" {
    local ticket_id
    ticket_id=$(create_test_ticket "Detailed ticket")

    run ./tix show "$ticket_id"
    [ "$status" -eq 0 ]

    [[ "$output" =~ "$ticket_id" ]]
    [[ "$output" =~ "Detailed ticket" ]]
}

@test "tix start changes status to in-progress" {
    local ticket_id
    ticket_id=$(create_test_ticket "Task to start")

    run ./tix start "$ticket_id"
    [ "$status" -eq 0 ]

    local status=$(get_ticket_field "$ticket_id" "status")
    [ "$status" = "in-progress" ]
}

@test "tix close changes status to closed and archives" {
    local ticket_id
    ticket_id=$(create_test_ticket "Task to close")

    run ./tix close "$ticket_id"
    [ "$status" -eq 0 ]

    # Status should be closed
    local status=$(get_ticket_field "$ticket_id" "status")
    [ "$status" = "closed" ]

    # Ticket should be archived (moved from tickets/)
    local file
    file=$(find tickets -name "*(${ticket_id}).md" 2>/dev/null | head -1)
    [ -z "$file" ]
}

@test "tix status updates status" {
    local ticket_id
    ticket_id=$(create_test_ticket "Status test")

    run ./tix status "$ticket_id" "in-progress"
    [ "$status" -eq 0 ]

    local status=$(get_ticket_field "$ticket_id" "status")
    [ "$status" = "in-progress" ]
}

@test "tix done marks ticket as done and archives" {
    local ticket_id
    ticket_id=$(create_test_ticket "Task to finish")

    run ./tix done "$ticket_id"
    [ "$status" -eq 0 ]

    # Should be archived (moved from tickets/)
    local file
    file=$(find tickets -name "*(${ticket_id}).md" 2>/dev/null | head -1)
    [ -z "$file" ]
}

@test "tix status normalizes aliases" {
    local ticket_id
    ticket_id=$(create_test_ticket "Alias test")

    run ./tix status "$ticket_id" "in_progress"
    [ "$status" -eq 0 ]

    local status=$(get_ticket_field "$ticket_id" "status")
    [ "$status" = "in-progress" ]
}

@test "tix archive archives tickets with terminal status" {
    local ticket_id
    ticket_id=$(create_test_ticket "Manual done ticket")

    # Manually set status to 'completed' (an alias)
    local file
    file=$(find tickets -name "*(${ticket_id}).md" | head -1)
    sed -i '' "s/status: .*/status: completed/" "$file"

    run ./tix archive --all
    [ "$status" -eq 0 ]
    [[ "$output" =~ "Archived" ]]

    # Should be moved from tickets/
    file=$(find tickets -name "*(${ticket_id}).md" 2>/dev/null | head -1)
    [ -z "$file" ]
}

@test "tix ready excludes nested tickets by default and shows them with --deep" {
    local nested_id
    nested_id=$(create_test_ticket "Nested ready item")
    move_ticket_to_folder "$nested_id" "backlog"

    run ./tix ready
    [ "$status" -eq 0 ]
    if [[ "$output" =~ "$nested_id" ]]; then
        fail "default ready should not include nested tickets"
    fi

    run ./tix ready --deep
    [ "$status" -eq 0 ]
    [[ "$output" =~ "[backlog]" ]]
    [[ "$output" =~ "$nested_id" ]]
}

@test "tix blocked excludes nested tickets by default and shows them with --deep" {
    local blocker_id nested_id
    blocker_id=$(create_test_ticket "Top level blocker")
    nested_id=$(create_test_ticket "Nested blocked item")
    move_ticket_to_folder "$nested_id" "backlog"
    ./tix dep "$nested_id" "$blocker_id"

    run ./tix blocked
    [ "$status" -eq 0 ]
    if [[ "$output" =~ "$nested_id" ]]; then
        fail "default blocked should not include nested tickets"
    fi

    run ./tix blocked --deep
    [ "$status" -eq 0 ]
    [[ "$output" =~ "[backlog]" ]]
    [[ "$output" =~ "$blocker_id" ]]
}

@test "tix closed lists terminal tickets and supports --archived" {
    local ticket_id
    ticket_id=$(create_test_ticket "Closed item")

    # Manually set to closed without archiving (simulating agent edit)
    local file
    file=$(find tickets -name "*(${ticket_id}).md" | head -1)
    sed -i '' "s/status: .*/status: closed/" "$file"

    run ./tix closed
    [ "$status" -eq 0 ]
    [[ "$output" =~ "$ticket_id" ]]

    # Now close properly (which archives)
    ./tix close "$ticket_id"

    run ./tix closed --archived
    [ "$status" -eq 0 ]
    [[ "$output" =~ "$ticket_id" ]]
}

@test "tix rename updates filename, YAML title, and keeps id" {
    local ticket_id
    ticket_id=$(create_test_ticket "Old title")

    run ./tix rename "$ticket_id" "New API title"
    [ "$status" -eq 0 ]

    local file
    file=$(find tickets -name "*(${ticket_id}).md" | head -1)
    [[ "$file" == *"New API Title (${ticket_id}).md" ]]

    local title
    title=$(get_ticket_field "$ticket_id" "title")
    [ "$title" = "New API title" ]

    local stored_id
    stored_id=$(get_ticket_field "$ticket_id" "id")
    [ "$stored_id" = "$ticket_id" ]
}

@test "tix rename updates markdown H1" {
    local ticket_id
    ticket_id=$(create_test_ticket "Legacy heading")

    run ./tix rename "$ticket_id" "Improve ui flow"
    [ "$status" -eq 0 ]

    local file
    file=$(find tickets -name "*(${ticket_id}).md" | head -1)
    local heading
    heading=$(grep '^# ' "$file" | head -1)
    [ "$heading" = "# Improve UI Flow" ]
}
