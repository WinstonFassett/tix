#!/usr/bin/env bats

# add_ac.bats - Regression tests for `tix add-ac` text preservation and persistence
# Covers ticket 99bf: add-ac was dropping 'n' characters, tripling single quotes,
# and silently discarding all but the first AC when called back-to-back.

load test_helper

@test "add-ac: round-trip a ticket and preserve file structure" {
    local id
    id=$(create_test_ticket "Round trip ticket")
    run ./tix add-ac "$id" "simple criterion"
    [ "$status" -eq 0 ]

    local file
    file=$(find tickets -name "*(${id}).md" | head -1)
    [ -f "$file" ]

    grep -q "^## Acceptance Criteria$" "$file"
    grep -qFe "- [ ] simple criterion" "$file"
}

@test "add-ac: text with many 'n' characters is preserved verbatim" {
    local id
    id=$(create_test_ticket "N test")
    local text="defines ambient agent listens not none running winning"
    run ./tix add-ac "$id" "$text"
    [ "$status" -eq 0 ]

    local file
    file=$(find tickets -name "*(${id}).md" | head -1)
    grep -qFe "- [ ] $text" "$file"
}

@test "add-ac: text with single quotes is preserved verbatim (no tripling)" {
    local id
    id=$(create_test_ticket "Quote test")
    local text="mode is 'ambient' and 'quiet'"
    run ./tix add-ac "$id" "$text"
    [ "$status" -eq 0 ]

    local file
    file=$(find tickets -name "*(${id}).md" | head -1)
    grep -qFe "- [ ] $text" "$file"

    # Must not contain tripled quotes
    if grep -qF "'''" "$file"; then
        echo "File contains tripled single quotes:" >&2
        cat "$file" >&2
        return 1
    fi
}

@test "add-ac: multiple back-to-back invocations all persist" {
    local id
    id=$(create_test_ticket "Multi AC test")
    run ./tix add-ac "$id" "first criterion"
    [ "$status" -eq 0 ]
    run ./tix add-ac "$id" "second criterion"
    [ "$status" -eq 0 ]
    run ./tix add-ac "$id" "third criterion"
    [ "$status" -eq 0 ]

    local file
    file=$(find tickets -name "*(${id}).md" | head -1)
    grep -qFe "- [ ] first criterion" "$file"
    grep -qFe "- [ ] second criterion" "$file"
    grep -qFe "- [ ] third criterion" "$file"

    local count
    count=$(grep -ce "^- \[ \]" "$file")
    [ "$count" -eq 3 ]
}

@test "add-ac: combined - multiple ACs with n's and single quotes all persist verbatim" {
    local id
    id=$(create_test_ticket "Combined test")

    run ./tix add-ac "$id" "Skill defines a third mode: 'ambient' / 'quiet' agent listens but does not speak"
    [ "$status" -eq 0 ]
    run ./tix add-ac "$id" "Wake word is 'dude' (case-insensitive); only direct address breaks silence"
    [ "$status" -eq 0 ]
    run ./tix add-ac "$id" "Hard gate, not fuzzy: agent stays silent unless utterance contains the wake word"
    [ "$status" -eq 0 ]
    run ./tix add-ac "$id" "Mode is explicitly entered ('quiet mode') and explicitly exited ('dude, come back')"
    [ "$status" -eq 0 ]

    local file
    file=$(find tickets -name "*(${id}).md" | head -1)

    grep -qFe "- [ ] Skill defines a third mode: 'ambient' / 'quiet' agent listens but does not speak" "$file"
    grep -qFe "- [ ] Wake word is 'dude' (case-insensitive); only direct address breaks silence" "$file"
    grep -qFe "- [ ] Hard gate, not fuzzy: agent stays silent unless utterance contains the wake word" "$file"
    grep -qFe "- [ ] Mode is explicitly entered ('quiet mode') and explicitly exited ('dude, come back')" "$file"

    # No tripled quotes anywhere
    if grep -qF "'''" "$file"; then
        echo "File contains tripled single quotes:" >&2
        cat "$file" >&2
        return 1
    fi

    local count
    count=$(grep -ce "^- \[ \]" "$file")
    [ "$count" -eq 4 ]
}

@test "add-ac: appends to existing AC section when section is last in file" {
    local id
    id=$(create_test_ticket "Append test")

    # First add creates section
    run ./tix add-ac "$id" "alpha"
    [ "$status" -eq 0 ]

    # Second add must find existing section and append - this is the "only first
    # AC persists" regression from 99bf.
    run ./tix add-ac "$id" "beta"
    [ "$status" -eq 0 ]

    local file
    file=$(find tickets -name "*(${id}).md" | head -1)
    grep -qFe "- [ ] alpha" "$file"
    grep -qFe "- [ ] beta" "$file"
}

@test "add-ac: inserts before following heading when AC section is not last" {
    local id
    id=$(create_test_ticket "Middle section test")

    local file
    file=$(find tickets -name "*(${id}).md" | head -1)

    # Manually add an AC section followed by another section
    cat >> "$file" <<'EOF'

## Acceptance Criteria
- [ ] existing

## Notes
trailing content
EOF

    run ./tix add-ac "$id" "added"
    [ "$status" -eq 0 ]

    grep -qFe "- [ ] existing" "$file"
    grep -qFe "- [ ] added" "$file"
    grep -qF "trailing content" "$file"
    # Notes heading must still exist exactly once
    local notes_count
    notes_count=$(grep -c "^## Notes$" "$file")
    [ "$notes_count" -eq 1 ]
}
