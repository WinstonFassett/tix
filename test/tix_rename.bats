#!/usr/bin/env bats

# tix_rename.bats - Tests for ticket→tix CLI rename

load test_helper

@test "tix --help works and says 'tix' in usage" {
    run ./tix --help
    [ "$status" -eq 0 ]
    [[ "$output" =~ "Usage: tix" ]]
}

@test "tix --help does not contain 'ticket' in command examples" {
    run ./tix --help
    [ "$status" -eq 0 ]
    # Usage line should say "tix" not "ticket"
    [[ "$output" =~ "Usage: tix" ]]
    # Example lines should not use "ticket" as command (grep for "Example: ticket" or "ticket create" patterns)
    [[ ! "$output" =~ "Example: ticket " ]]
    [[ ! "$output" =~ "Usage: ticket " ]]
}

@test "tix create works" {
    run ./tix create "Tix test ticket"
    [ "$status" -eq 0 ]
    [[ "$output" =~ "Created" ]]
}

@test "tix ls works" {
    ./tix create "List me" >/dev/null
    run ./tix ls
    [ "$status" -eq 0 ]
    [[ "$output" =~ "List Me" ]]
}

@test "tix start works" {
    local ticket_id
    ticket_id=$(create_test_ticket "Start me")
    run ./tix start "$ticket_id"
    [ "$status" -eq 0 ]
}

@test "tix done works" {
    local ticket_id
    ticket_id=$(create_test_ticket "Finish me")
    run ./tix done "$ticket_id"
    [ "$status" -eq 0 ]
}

@test "tix close works" {
    local ticket_id
    ticket_id=$(create_test_ticket "Close me")
    run ./tix close "$ticket_id"
    [ "$status" -eq 0 ]
}

@test "ticket compat wrapper still works but shows deprecation warning" {
    run ./ticket --help
    [ "$status" -eq 0 ]
    # stderr should have deprecation warning (bats merges stderr into output with run)
    [[ "$output" =~ "deprecated" ]]
    # Should still show help output
    [[ "$output" =~ "Usage:" ]]
}

@test "ticket compat wrapper forwards commands" {
    ./tix create "Compat test" >/dev/null
    run ./ticket ls
    [ "$status" -eq 0 ]
    [[ "$output" =~ "Compat Test" ]]
}

@test "TIX_WORKSPACE env var works" {
    local alt_dir
    alt_dir="$(mktemp -d)"
    mkdir -p "$alt_dir/tickets"

    TIX_WORKSPACE="$alt_dir" run ./tix create "Alt workspace ticket"
    [ "$status" -eq 0 ]

    TIX_WORKSPACE="$alt_dir" run ./tix ls
    [ "$status" -eq 0 ]
    [[ "$output" =~ "Alt Workspace Ticket" ]]

    rm -rf "$alt_dir"
}

@test "TICKET_WORKSPACE env var still works as fallback" {
    local alt_dir
    alt_dir="$(mktemp -d)"
    mkdir -p "$alt_dir/tickets"

    TICKET_WORKSPACE="$alt_dir" run ./tix create "Fallback ticket"
    [ "$status" -eq 0 ]

    TICKET_WORKSPACE="$alt_dir" run ./tix ls
    [ "$status" -eq 0 ]
    [[ "$output" =~ "Fallback Ticket" ]]

    rm -rf "$alt_dir"
}

@test "TIX_WORKSPACE takes precedence over TICKET_WORKSPACE" {
    local tix_dir ticket_dir
    tix_dir="$(mktemp -d)"
    ticket_dir="$(mktemp -d)"
    mkdir -p "$tix_dir/tickets" "$ticket_dir/tickets"

    TIX_WORKSPACE="$tix_dir" TICKET_WORKSPACE="$ticket_dir" run ./tix create "Precedence test"
    [ "$status" -eq 0 ]

    # Should be in TIX_WORKSPACE, not TICKET_WORKSPACE
    TIX_WORKSPACE="$tix_dir" run ./tix ls
    [ "$status" -eq 0 ]
    [[ "$output" =~ "Precedence Test" ]]

    TICKET_WORKSPACE="$ticket_dir" run ./tix ls
    [ "$status" -eq 0 ]
    [[ ! "$output" =~ "Precedence Test" ]]

    rm -rf "$tix_dir" "$ticket_dir"
}
