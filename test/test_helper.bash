#!/usr/bin/env bash

# test_helper.bash - Common test utilities

# Set up test environment
setup() {
    # Create a temporary test workspace
    TEST_DIR="$(mktemp -d)"
    cd "$TEST_DIR"

    # Copy the tix system to test directory
    local src="$BATS_TEST_DIRNAME/.."
    cp "$src/tix" ./tix
    cp "$src/ticket" ./ticket
    cp -r "$src/lib" ./
    cp "$src/setup-deps" ./setup-deps

    # Make scripts executable
    chmod +x tix ticket setup-deps

    # Initialize tickets directory
    mkdir tickets

    # Export test environment
    export TICKET_TEST_MODE=1
}

# Clean up test environment
teardown() {
    cd "$BATS_TEST_DIRNAME/.."
    rm -rf "$TEST_DIR"
}

# Helper to create a test ticket (returns just the ID)
create_test_ticket() {
    local title="$1"
    shift
    ./tix create "$title" "$@" 2>&1 | head -1 | awk '{print $3}'
}

move_ticket_to_folder() {
    local id="$1"
    local folder="$2"
    local file

    mkdir -p "tickets/$folder"
    file=$(find tickets -name "*(${id}).md" | head -1)
    mv "$file" "tickets/$folder/"
}

# Helper to get ticket count
get_ticket_count() {
    ./tix ls | wc -l | tr -d ' '
}

# Helper to check if ticket exists
ticket_exists() {
    local id="$1"
    find tickets -name "*(${id}).md" | grep -q .
}

# Helper to get ticket field (searches tickets/ and archive/)
get_ticket_field() {
    local id="$1"
    local field="$2"
    local file
    file=$(find tickets archive -name "*(${id}).md" 2>/dev/null | head -1)
    [[ -n "$file" ]] && ./lib/yq -f extract ".$field" "$file"
}
