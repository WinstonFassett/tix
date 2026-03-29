#!/usr/bin/env bash

# yaml_ops.sh - YAML operations using yq
# Replaces fragile awk YAML parsing with robust yq operations

# Get the directory where this script is located
YAML_OPS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
YQ_BIN="$YAML_OPS_DIR/yq"

# Initialize yq binary path (optional - call if needed)
init_yaml_ops() {
    local script_dir="${1:-$YAML_OPS_DIR}"
    
    if [[ ! -f "$script_dir/yq" ]]; then
        echo "Error: yq not found. Run 'ticket-cli/setup-deps' first." >&2
        exit 1
    fi
    
    YQ_BIN="$script_dir/yq"
}

# Extract YAML field from markdown file
yaml_field() {
    local file="$1"
    local field="$2"
    
    # Extract only the frontmatter and process with yq
    awk '
    BEGIN { in_frontmatter = 0 }
    /^---$/ {
        if (in_frontmatter == 0) {
            in_frontmatter = 1
            next
        } else if (in_frontmatter == 1) {
            in_frontmatter = 0
            exit
        }
    }
    in_frontmatter == 1 { print }
    ' "$file" | "$YQ_BIN" ".$field" 2>/dev/null || echo ""
}

# Update YAML field in markdown file
update_yaml_field() {
    local file="$1"
    local field="$2"
    local value="$3"
    
    # Create temporary file
    local temp_file
    temp_file=$(mktemp) || { echo "Error: Failed to create temporary file" >&2; return 1; }
    
    # Process the file: extract frontmatter, update field, preserve rest
    awk -v field="$field" -v value="$value" '
    BEGIN { in_frontmatter = 0; frontmatter_end = 0 }
    /^---$/ {
        if (in_frontmatter == 0) {
            in_frontmatter = 1
            print "---"
            next
        } else if (in_frontmatter == 1) {
            in_frontmatter = 0
            frontmatter_end = 1
            print "---"
            next
        }
    }
    
    # In frontmatter - update the target field
    in_frontmatter == 1 {
        if ($0 ~ "^" field ":") {
            # Quote string values, leave arrays and numbers unquoted
            if (value ~ "^\\[.*\\]$" || value ~ "^[0-9]+$") {
                print field ": " value
            } else {
                print field ": \"" value "\""
            }
        } else {
            print
        }
        next
    }
    
    # Outside frontmatter - print as-is
    { print }
    ' "$file" > "$temp_file"
    
    # Replace original file
    mv "$temp_file" "$file" || { rm -f "$temp_file"; return 1; }
}

# Get all ticket IDs from directory
get_ticket_ids() {
    local tickets_dir="$1"
    find "$tickets_dir" -name "*.md" -not -path "*/archive/*" 2>/dev/null | while read -r file; do
        yaml_field "$file" "id"
    done
}

# Get ticket metadata as JSON for processing
get_ticket_json() {
    local file="$1"
    "$YQ_BIN" -o json "$file" 2>/dev/null || echo "{}"
}

# Check if ticket exists by ID
ticket_exists() {
    local tickets_dir="$1"
    local id="$2"
    find "$tickets_dir" -name "*(${id}).md" 2>/dev/null | head -1
}

# Validate YAML frontmatter
validate_yaml() {
    local file="$1"
    "$YQ_BIN" eval '.' "$file" >/dev/null 2>&1
}
