#!/usr/bin/env bash
# install.sh — Download and install the tix binary.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/WinstonFassett/tix/main/install.sh | bash
#
# Env overrides:
#   TIX_RELEASE_BASE_URL  Base URL for release artifacts.
#                         Default: https://github.com/WinstonFassett/tix/releases/latest/download
#                         For local testing, point at a file:// URL to a dist/ dir.
#   TIX_INSTALL_DIR       Install directory. Default: ~/.local/bin (falls back to /usr/local/bin).
#   TIX_OS / TIX_ARCH     Override platform detection (darwin|linux, arm64|amd64).
set -euo pipefail

DEFAULT_BASE_URL="https://github.com/WinstonFassett/tix/releases/latest/download"
BASE_URL="${TIX_RELEASE_BASE_URL:-$DEFAULT_BASE_URL}"

err()  { printf 'error: %s\n' "$*" >&2; exit 1; }
info() { printf '%s\n' "$*"; }

detect_os() {
  case "$(uname -s)" in
    Darwin) echo darwin ;;
    Linux)  echo linux ;;
    *) err "unsupported OS: $(uname -s)" ;;
  esac
}

detect_arch() {
  case "$(uname -m)" in
    x86_64|amd64) echo amd64 ;;
    arm64|aarch64) echo arm64 ;;
    *) err "unsupported architecture: $(uname -m)" ;;
  esac
}

pick_install_dir() {
  if [ -n "${TIX_INSTALL_DIR:-}" ]; then
    echo "$TIX_INSTALL_DIR"; return
  fi
  local candidate="$HOME/.local/bin"
  mkdir -p "$candidate" 2>/dev/null || true
  if [ -w "$candidate" ]; then
    echo "$candidate"; return
  fi
  echo "/usr/local/bin"
}

fetch() {
  # fetch <url> <out>
  local url=$1 out=$2
  if [[ "$url" == file://* ]]; then
    cp "${url#file://}" "$out"
    return
  fi
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL --retry 3 -o "$out" "$url"
  elif command -v wget >/dev/null 2>&1; then
    wget -q -O "$out" "$url"
  else
    err "need curl or wget"
  fi
}

main() {
  local os arch install_dir url tmp tarball
  os="${TIX_OS:-$(detect_os)}"
  arch="${TIX_ARCH:-$(detect_arch)}"
  install_dir="$(pick_install_dir)"
  url="${BASE_URL%/}/tix-${os}-${arch}.tar.gz"

  info "Installing tix (${os}/${arch}) from ${url}"
  info "  → ${install_dir}/tix"

  tmp="$(mktemp -d)"
  trap 'rm -rf "${tmp:-}"' EXIT
  tarball="$tmp/tix.tar.gz"

  fetch "$url" "$tarball"
  tar -xzf "$tarball" -C "$tmp"
  [ -f "$tmp/tix" ] || err "extracted archive did not contain a 'tix' binary"
  chmod +x "$tmp/tix"

  mkdir -p "$install_dir"
  if [ -w "$install_dir" ]; then
    mv "$tmp/tix" "$install_dir/tix"
  else
    info "  (sudo required to write $install_dir)"
    sudo mv "$tmp/tix" "$install_dir/tix"
  fi

  info ""
  info "Installed: $("$install_dir/tix" version 2>/dev/null || echo 'tix')"
  case ":$PATH:" in
    *":$install_dir:"*) ;;
    *)
      info ""
      info "⚠️  ${install_dir} is not on your PATH."
      info ""
      info "    Add this to your ~/.zshrc (or ~/.bash_profile):"
      info ""
      info "      export PATH=\"${install_dir}:\$PATH\""
      info ""
      info "    Then reload your shell:"
      info ""
      info "      source ~/.zshrc"
      info ""
      ;;
  esac
}

main "$@"
