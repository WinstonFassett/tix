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

## release-local — produce dist/tix-<os>-<arch>.tar.gz for all platforms (matches CI naming)
##                Use TAG=vX.Y.Z to embed a build version (default: vlocal).
TAG ?= vlocal
DIST_DIR := ../dist
release-local:
	@mkdir -p $(DIST_DIR)
	@rm -f $(DIST_DIR)/tix-*.tar.gz $(DIST_DIR)/SHA256SUMS
	@for target in darwin-arm64 darwin-amd64 linux-arm64 linux-amd64; do \
		os=$${target%-*}; arch=$${target#*-}; \
		echo "→ $$os/$$arch ($(TAG))…"; \
		GOOS=$$os GOARCH=$$arch go build -trimpath \
			-ldflags "-s -w -X main.buildVersion=$(TAG)" \
			-o $(BIN_DIR)/tix . || exit 1; \
		COPYFILE_DISABLE=1 tar --no-xattrs -czf $(DIST_DIR)/tix-$$os-$$arch.tar.gz -C $(BIN_DIR) tix 2>/dev/null \
			|| COPYFILE_DISABLE=1 tar -czf $(DIST_DIR)/tix-$$os-$$arch.tar.gz -C $(BIN_DIR) tix; \
		rm $(BIN_DIR)/tix; \
	done
	@cd $(DIST_DIR) && shasum -a 256 tix-*.tar.gz > SHA256SUMS
	@ls -lh $(DIST_DIR)/

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
