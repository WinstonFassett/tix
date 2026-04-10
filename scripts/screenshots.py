#!/usr/bin/env python3
"""Take screenshots of tix-ui for documentation.

Usage:
  python scripts/screenshots.py                        # Default: localhost:3000
  python scripts/screenshots.py --url http://my-project-tix.localhost:1355
  python scripts/screenshots.py --port 3001
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


def take_screenshots(p, base_url: str, out_dir: Path, width: int, height: int):
    out_dir.mkdir(parents=True, exist_ok=True)
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": width, "height": height})

    for theme in ("dark", "light"):
        page.goto(f"{base_url}/")
        set_theme(page, theme == "dark")

        # List view
        page.screenshot(path=str(out_dir / f"list-{theme}.png"))
        print(f"  list-{theme}.png")

        # Detail view — click first ticket row
        row = page.locator('[role="button"]').first
        if row.count() > 0:
            row.click()
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(600)
            page.add_style_tag(content=HIDE_DEV_OVERLAYS)
            page.wait_for_timeout(200)
            page.screenshot(path=str(out_dir / f"detail-{theme}.png"))
            print(f"  detail-{theme}.png")

    browser.close()


def main():
    parser = argparse.ArgumentParser(description="Take tix-ui screenshots")
    parser.add_argument("--url", type=str, default=None,
                        help="Base URL (e.g. http://my-project-tix.localhost:1355)")
    parser.add_argument("--port", type=int, default=None,
                        help="Port on localhost (default 3000)")
    parser.add_argument("--width", type=int, default=1280)
    parser.add_argument("--height", type=int, default=800)
    args = parser.parse_args()

    if args.url:
        base_url = args.url.rstrip("/")
    else:
        base_url = f"http://localhost:{args.port or 3000}"

    with sync_playwright() as p:
        print(f"tix-ui ({base_url}):")
        take_screenshots(p, base_url, ROOT / "tix-ui" / "screenshots", args.width, args.height)

    print("\nDone!")


if __name__ == "__main__":
    main()
