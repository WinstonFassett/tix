#!/usr/bin/env bash
set -euo pipefail

# install.sh - Remote bootstrap installer for tix
# Usage: curl -fsSL https://raw.githubusercontent.com/WinstonFassett/tix/main/install.sh | bash

TIX_HOME="${TIX_HOME:-$HOME/.tix}"
REPO="https://github.com/WinstonFassett/tix.git"

echo "Installing tix..."

# Clone or update
if [[ -d "$TIX_HOME/.git" ]]; then
    echo "Updating existing installation..."
    git -C "$TIX_HOME" pull --ff-only --quiet
else
    if [[ -d "$TIX_HOME" ]]; then
        echo "✗ $TIX_HOME exists but is not a git repo. Remove it first."
        exit 1
    fi
    echo "Cloning tix to $TIX_HOME..."
    git clone --quiet "$REPO" "$TIX_HOME"
fi

# Setup vendored deps (yq, jq)
"$TIX_HOME/setup-deps"

# Install symlinks
"$TIX_HOME/install-tix"

echo ""
echo "Done! tix is installed at $TIX_HOME"
echo "To uninstall: $TIX_HOME/uninstall-tix"
