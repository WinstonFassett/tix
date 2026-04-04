#!/usr/bin/env python3
"""Take screenshots of tix web UIs for documentation.

Usage:
  python scripts/screenshots.py                    # Both UIs, default ports
  python scripts/screenshots.py --svelte 5175      # Svelte only
  python scripts/screenshots.py --react 5176       # React only
  python scripts/screenshots.py --width 1440 --height 900

Requires: playwright (pip install playwright && playwright install chromium)
"""

import argparse
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent

# Hide dev-mode overlays (web-dev-mcp grabber, Vite error overlay, etc.)
HIDE_DEV_OVERLAYS = """
  [class*="grab"], [class*="element-picker"], [id*="web-dev"],
  [style*="position: fixed"][style*="z-index"],
  vite-error-overlay { display: none !important; }
"""


def set_theme(page, dark: bool):
    """Set theme via localStorage and reload."""
    theme = "dark" if dark else "light"
    page.evaluate(f"localStorage.setItem('tix-theme', '{theme}')")
    page.reload()
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(600)
    page.add_style_tag(content=HIDE_DEV_OVERLAYS)
    page.wait_for_timeout(200)


def take_screenshots(p, port: int, out_dir: Path, label: str, width: int, height: int):
    out_dir.mkdir(parents=True, exist_ok=True)
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": width, "height": height})

    for theme in ("dark", "light"):
        page.goto(f"http://localhost:{port}/")
        set_theme(page, theme == "dark")

        # List view
        page.screenshot(path=str(out_dir / f"list-{theme}.png"))
        print(f"  [{label}] list-{theme}.png")

        # Detail view — click first ticket row
        row = page.locator('[role="button"]').first
        if row.count() > 0:
            row.click()
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(600)
            page.add_style_tag(content=HIDE_DEV_OVERLAYS)
            page.wait_for_timeout(200)
            page.screenshot(path=str(out_dir / f"detail-{theme}.png"))
            print(f"  [{label}] detail-{theme}.png")

    browser.close()


def main():
    parser = argparse.ArgumentParser(description="Take tix UI screenshots")
    parser.add_argument("--svelte", type=int, metavar="PORT", nargs="?", const=5175, default=None)
    parser.add_argument("--react", type=int, metavar="PORT", nargs="?", const=5176, default=None)
    parser.add_argument("--width", type=int, default=1280)
    parser.add_argument("--height", type=int, default=800)
    args = parser.parse_args()

    # Default: both UIs
    if args.svelte is None and args.react is None:
        args.svelte = 5175
        args.react = 5176

    with sync_playwright() as p:
        if args.svelte:
            print(f"Svelte UI (port {args.svelte}):")
            take_screenshots(p, args.svelte, ROOT / "tix-ui" / "screenshots", "Svelte", args.width, args.height)
        if args.react:
            print(f"React UI (port {args.react}):")
            take_screenshots(p, args.react, ROOT / "tix-ui-react" / "screenshots", "React", args.width, args.height)

    print("\nDone!")


if __name__ == "__main__":
    main()
