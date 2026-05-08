#!/usr/bin/env python3
"""
STRATUM brand asset generator.

Produces every raster the project needs from a single design spec:
- Web favicons (.png + .ico)
- Apple touch icon
- Expo `icon.png` / `splash-icon.png`
- Android adaptive icon (foreground + monochrome)
- Open Graph card

Run from anywhere:
    python3 frontend/stratum-app/assets/brand/generate.py

Outputs land in two places:
  1. assets/brand/exports/  - canonical copies of every size
  2. assets/images/         - in-place overwrite of the files Expo references
                              (icon.png, favicon.png, splash-icon.png,
                              android-foreground.png, android-icon-monochrome.png,
                              android-icon-background.png)
"""

from __future__ import annotations

import os
import struct
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

# ─── Paths ──────────────────────────────────────────────────────────────────
BRAND_DIR = Path(__file__).resolve().parent
APP_DIR = BRAND_DIR.parent.parent          # frontend/stratum-app
IMAGES_DIR = APP_DIR / "assets" / "images"
EXPORTS_DIR = BRAND_DIR / "exports"
FONT_PATH = BRAND_DIR / "fonts" / "SpaceGrotesk-Bold.ttf"

EXPORTS_DIR.mkdir(parents=True, exist_ok=True)

# ─── Brand spec ─────────────────────────────────────────────────────────────
BLACK = (0, 0, 0, 255)
RED = (255, 42, 42, 255)
WHITE = (255, 255, 255, 255)
TRANSPARENT = (0, 0, 0, 0)

# Monogram proportions — every measurement is expressed against the canvas
# edge so the same numbers work at any output resolution. Mirrors the
# canonical monogram.svg: black canvas, red frame, thicker red bottom,
# white S centred (with a small upward bias to balance the heavy bottom).
SIDE_BORDER_FRAC = 0.024         # top / left / right red border thickness
BOTTOM_BORDER_FRAC = 0.070       # bottom red border (thicker)
LETTER_HEIGHT_FRAC = 0.70        # S font-size / canvas edge
LETTER_BASELINE_FRAC = 0.48      # S vertical centre / canvas edge (slight upward bias)

# Wordmark proportions — relative to the wordmark canvas (5:1 ratio).
# Mirrors wordmark.svg: rule width 200/1600, y 256/320, height 10/320.
WM_RULE_W_FRAC = 0.125
WM_RULE_Y_FRAC = 0.80
WM_RULE_H_FRAC = 0.03125

# Android adaptive-icon safe zone is the centred 66% of the canvas.
ADAPTIVE_SAFE_FRAC = 0.66


# ─── Drawing primitives ────────────────────────────────────────────────────
def _load_font(letter_height_px: int) -> ImageFont.FreeTypeFont:
    """Load Space Grotesk Bold; fall back to Arial Bold if missing."""
    if FONT_PATH.exists():
        font = ImageFont.truetype(str(FONT_PATH), size=letter_height_px)
        # The TTF is variable; force the bold axis if available.
        try:
            font.set_variation_by_name("Bold")
        except Exception:
            try:
                font.set_variation_by_axes([700])
            except Exception:
                pass
        return font
    fallback = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
    if Path(fallback).exists():
        return ImageFont.truetype(fallback, size=letter_height_px)
    return ImageFont.load_default()


def _render_letter(
    canvas: Image.Image,
    glyph: str,
    color: tuple[int, int, int, int],
    letter_height_frac: float,
    baseline_frac: float,
) -> None:
    """Centre a glyph on the canvas using exact font metrics."""
    w, h = canvas.size
    # Pillow's font.getbbox uses a px size that maps directly to em-square,
    # so picking size = h * letter_height_frac yields the right cap-height.
    font_size = max(int(h * letter_height_frac), 8)
    font = _load_font(font_size)

    # We ask Pillow for the actual ink bounding box of this glyph, then
    # offset the draw call so the *ink* is centred — anchoring on font
    # metrics alone leaves the optical centre off because of side bearings.
    draw = ImageDraw.Draw(canvas)
    bbox = draw.textbbox((0, 0), glyph, font=font)
    ink_w = bbox[2] - bbox[0]
    ink_h = bbox[3] - bbox[1]

    cx = w / 2 - bbox[0] - ink_w / 2
    cy = h * baseline_frac - bbox[1] - ink_h / 2
    draw.text((cx, cy), glyph, font=font, fill=color)


def _draw_frame(canvas: Image.Image, color: tuple[int, int, int, int]) -> None:
    """Draw the red frame: thin top / left / right, thicker bottom."""
    w, h = canvas.size
    side = max(int(min(w, h) * SIDE_BORDER_FRAC), 1)
    bot = max(int(min(w, h) * BOTTOM_BORDER_FRAC), 1)
    draw = ImageDraw.Draw(canvas)
    draw.rectangle([(0, 0), (w, side)], fill=color)             # top
    draw.rectangle([(0, 0), (side, h)], fill=color)             # left
    draw.rectangle([(w - side, 0), (w, h)], fill=color)         # right
    draw.rectangle([(0, h - bot), (w, h)], fill=color)          # bottom (thicker)


# ─── Compositions ──────────────────────────────────────────────────────────
def make_full_bleed(size: int) -> Image.Image:
    """The hero monogram: black canvas, red frame (thicker bottom), white S.

    Used as the iOS app icon, web favicon, splash, and OG card source.
    """
    img = Image.new("RGBA", (size, size), BLACK)
    _render_letter(img, "S", WHITE, LETTER_HEIGHT_FRAC, LETTER_BASELINE_FRAC)
    _draw_frame(img, RED)
    return img


def make_adaptive_foreground(size: int) -> Image.Image:
    """Android adaptive foreground: full monogram (frame + S) scaled into the
    centred 66% safe zone so launcher masks can't clip the brand.

    Android composes this over `make_adaptive_background()`.
    """
    img = Image.new("RGBA", (size, size), TRANSPARENT)
    inner_size = int(size * ADAPTIVE_SAFE_FRAC)
    inner = Image.new("RGBA", (inner_size, inner_size), BLACK)

    _render_letter(inner, "S", WHITE, LETTER_HEIGHT_FRAC, LETTER_BASELINE_FRAC)
    _draw_frame(inner, RED)

    offset = (size - inner_size) // 2
    img.paste(inner, (offset, offset), inner)
    return img


def make_adaptive_background(size: int) -> Image.Image:
    """Solid black layer behind the foreground."""
    return Image.new("RGBA", (size, size), BLACK)


def make_adaptive_monochrome(size: int) -> Image.Image:
    """Themed-icon layer for Android 13+: white silhouette of the monogram
    (frame + S) on transparent. Android tints this at runtime.
    """
    img = Image.new("RGBA", (size, size), TRANSPARENT)
    inner_size = int(size * ADAPTIVE_SAFE_FRAC)
    inner = Image.new("RGBA", (inner_size, inner_size), TRANSPARENT)

    _render_letter(inner, "S", WHITE, LETTER_HEIGHT_FRAC, LETTER_BASELINE_FRAC)
    _draw_frame(inner, WHITE)

    offset = (size - inner_size) // 2
    img.paste(inner, (offset, offset), inner)
    return img


def make_wordmark(width: int, on_dark: bool = True) -> Image.Image:
    """Horizontal wordmark for headers and email signatures."""
    height = int(width * 0.2)  # 5:1 ratio
    bg = BLACK if on_dark else WHITE
    fg = WHITE if on_dark else BLACK
    img = Image.new("RGBA", (width, height), bg)

    # Letter spacing matches the brand identity page (≈0.32em).
    font_px = int(height * 0.44)
    font = _load_font(font_px)
    draw = ImageDraw.Draw(img)
    text = "STRATUM"
    tracking = int(font_px * 0.32)

    # Pre-measure each glyph so we can lay them out with explicit tracking,
    # because Pillow's draw.text() doesn't expose letter-spacing.
    glyphs = list(text)
    widths = []
    for g in glyphs:
        b = draw.textbbox((0, 0), g, font=font)
        widths.append(b[2] - b[0])
    total_w = sum(widths) + tracking * (len(glyphs) - 1)
    x = (width - total_w) // 2
    # Vertical centre on cap-height
    sample = draw.textbbox((0, 0), "S", font=font)
    y = (height - (sample[3] - sample[1])) // 2 - sample[1]
    for g, gw in zip(glyphs, widths):
        draw.text((x, y), g, font=font, fill=fg)
        x += gw + tracking

    # Red rule centred under the wordmark. Geometric-centre is correct here
    # because the manual layout above already excludes trailing tracking,
    # unlike the SVG which compensates with an explicit x offset.
    rule_w = int(width * WM_RULE_W_FRAC)
    rule_h = max(2, int(height * WM_RULE_H_FRAC))
    rule_x = (width - rule_w) // 2
    rule_y = int(height * WM_RULE_Y_FRAC)
    draw.rectangle(
        [(rule_x, rule_y), (rule_x + rule_w, rule_y + rule_h)],
        fill=RED,
    )
    return img


# ─── ICO writer ────────────────────────────────────────────────────────────
def write_ico(sizes: list[int], dest: Path) -> None:
    """Write a multi-resolution .ico containing each requested size."""
    images = [make_full_bleed(s) for s in sizes]
    # Pillow can save .ico but its sizes argument resamples a single image.
    # Saving the largest with `sizes=` produces all entries at top quality.
    largest = max(sizes)
    base = make_full_bleed(largest)
    base.save(dest, format="ICO", sizes=[(s, s) for s in sizes])


# ─── Drive ─────────────────────────────────────────────────────────────────
def save(img: Image.Image, name: str) -> Path:
    out = EXPORTS_DIR / name
    img.save(out, format="PNG")
    return out


def main() -> None:
    if not FONT_PATH.exists():
        print(
            f"warning: {FONT_PATH} not found. Falling back to Arial Bold."
        )

    # ── Canonical exports ──
    full_1024 = make_full_bleed(1024)
    save(full_1024, "stratum-icon-1024.png")
    save(make_full_bleed(512), "stratum-icon-512.png")
    save(make_full_bleed(256), "stratum-icon-256.png")
    save(make_full_bleed(180), "apple-touch-icon-180.png")
    save(make_full_bleed(192), "favicon-192.png")
    save(make_full_bleed(96), "favicon-96.png")
    save(make_full_bleed(64), "favicon-64.png")
    save(make_full_bleed(32), "favicon-32.png")
    save(make_full_bleed(16), "favicon-16.png")

    write_ico([16, 32, 48, 64, 256], EXPORTS_DIR / "favicon.ico")

    save(make_adaptive_foreground(1024), "android-foreground-1024.png")
    save(make_adaptive_background(1024), "android-background-1024.png")
    save(make_adaptive_monochrome(1024), "android-monochrome-1024.png")

    save(make_wordmark(1600, on_dark=True), "stratum-wordmark-dark-1600.png")
    save(make_wordmark(1600, on_dark=False), "stratum-wordmark-light-1600.png")

    # OG / social card (1200×630, wordmark on black)
    og = Image.new("RGBA", (1200, 630), BLACK)
    wm = make_wordmark(900, on_dark=True)
    # Drop the wordmark canvas (which has its own black bg) onto og
    og.paste(wm, ((1200 - wm.width) // 2, (630 - wm.height) // 2))
    save(og, "og-card-1200x630.png")

    # ── Wire into Expo asset paths ──
    full_1024.save(IMAGES_DIR / "icon.png", format="PNG")
    full_1024.save(IMAGES_DIR / "splash-icon.png", format="PNG")
    full_1024.save(IMAGES_DIR / "favicon.png", format="PNG")
    make_adaptive_foreground(1024).save(
        IMAGES_DIR / "android-foreground.png", format="PNG"
    )
    make_adaptive_background(1024).save(
        IMAGES_DIR / "android-icon-background.png", format="PNG"
    )
    make_adaptive_monochrome(1024).save(
        IMAGES_DIR / "android-icon-monochrome.png", format="PNG"
    )

    print("done.")
    print(f"  exports → {EXPORTS_DIR}")
    print(f"  images  → {IMAGES_DIR}")


if __name__ == "__main__":
    main()
