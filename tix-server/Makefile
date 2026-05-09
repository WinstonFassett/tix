BINARY   := tix-server
BIN_DIR  := ../bin
UI_DIR   := ui
UI_SRC   := ../tix-ui

.PHONY: all build build-ui build-go clean cross install dev

all: build

## build — full build: React SPA → embed → Go binary
build: build-ui build-go

## build-ui — compile React SPA into ui/ for go:embed
build-ui:
	@echo "→ building React SPA (go-mode)…"
	cd $(UI_SRC) && npm run build:go
	@echo "→ copying assets to $(UI_DIR)/…"
	rm -rf $(UI_DIR)/*
	cp -r $(UI_SRC)/dist-go/. $(UI_DIR)/
	@# Rename index.go.html → index.html for Go SPA handler
	@if [ -f $(UI_DIR)/index.go.html ]; then mv $(UI_DIR)/index.go.html $(UI_DIR)/index.html; fi
	@echo "✓ UI assets ready"

## build-go — compile Go binary (uses existing ui/ assets)
build-go:
	@echo "→ building Go binary…"
	@mkdir -p $(BIN_DIR)
	go build -o $(BIN_DIR)/$(BINARY) .
	@echo "✓ $(BIN_DIR)/$(BINARY)  ($$(du -sh $(BIN_DIR)/$(BINARY) | cut -f1))"

## cross — cross-compile for macOS arm64/x64 and Linux x64/arm64
cross:
	@mkdir -p $(BIN_DIR)
	@echo "→ macOS arm64…"
	GOOS=darwin  GOARCH=arm64 go build -o $(BIN_DIR)/$(BINARY)-darwin-arm64  .
	@echo "→ macOS x86_64…"
	GOOS=darwin  GOARCH=amd64 go build -o $(BIN_DIR)/$(BINARY)-darwin-amd64  .
	@echo "→ Linux x86_64…"
	GOOS=linux   GOARCH=amd64 go build -o $(BIN_DIR)/$(BINARY)-linux-amd64   .
	@echo "→ Linux arm64…"
	GOOS=linux   GOARCH=arm64 go build -o $(BIN_DIR)/$(BINARY)-linux-arm64   .
	@ls -lh $(BIN_DIR)/$(BINARY)-*

## install — install binary to ~/.local/bin
install: build
	@mkdir -p ~/.local/bin
	cp $(BIN_DIR)/$(BINARY) ~/.local/bin/$(BINARY)
	@echo "✓ installed ~/.local/bin/$(BINARY)"

## clean — remove build artifacts
clean:
	rm -f $(BIN_DIR)/$(BINARY) $(BIN_DIR)/$(BINARY)-*
	rm -rf $(UI_DIR)/*
	rm -rf $(UI_SRC)/dist-go
	@touch $(UI_DIR)/.gitkeep

## dev — run server against this repo's tickets dir (no browser)
dev:
	go run . --no-browser --port 4152

help:
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/^## //'
