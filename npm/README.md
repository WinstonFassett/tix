# @winstonfassett/tix

Thin npm wrapper for [tix](https://github.com/WinstonFassett/tix) — a minimal Git-like ticket/issue tracker shipped as a single Go binary.

On install, this package downloads the matching pre-built binary from GitHub Releases and exposes it as `tix` on your `PATH`.

## Install

```sh
npm install -g @winstonfassett/tix
tix --help
```

## Supported platforms

- darwin (arm64, amd64)
- linux  (arm64, amd64)

## Env overrides

- `TIX_RELEASE_BASE_URL` — override the release artifact base URL (e.g. `file:///abs/path/to/dist` for local testing).
- `TIX_SKIP_DOWNLOAD` — skip the binary download (offline / CI installs).
