"""
Wheeler Stratigraphic Notation – SVG publication renderer.

Generates a 1964-style black-and-white Wheeler Space–Time diagram as a
standalone SVG string.

MIT License

Copyright (c) 2025 Banu Andrei & Mircea Levin-Constantin

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
"""

from __future__ import annotations

from typing import Any


# ─── Layout constants ─────────────────────────────────────────────────────────
COL_W = 160   # pixels per trench column
ROW_H = 70    # pixels per time row
PAD_L = 90    # left margin  (Y-axis labels)
PAD_R = 50    # right margin
PAD_T = 60    # top margin   (X-axis / trench labels)
PAD_B = 55    # bottom margin

# Typography / style
FONT = "Georgia, 'Times New Roman', serif"
STROKE = "#1a1a1a"
STROKE_W = 1.5
FILL_BG = "#ffffff"
FILL_DEPOSIT = "#f0ede8"   # very light warm fill for deposit blocks


def generate_wheeler_svg(data: dict[str, Any]) -> str:
    """
    Generate a Wheeler Space–Time diagram as an SVG string.

    Args:
        data: dict with keys:
            ``trenches``   – list of ``{id, label, order}`` dicts
            ``placements`` – list of ``{contextId, trenchIds, rowStart, rowEnd}``

    Returns:
        A self-contained SVG string (UTF-8).
    """
    trenches: list[dict] = sorted(
        data.get("trenches", []), key=lambda t: t.get("order", 0)
    )
    placements: list[dict] = data.get("placements", [])

    # ── Edge case: nothing to draw ────────────────────────────────────────────
    if not trenches:
        return (
            '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="120">'
            '<rect width="400" height="120" fill="#fff" stroke="#ccc"/>'
            '<text x="200" y="66" text-anchor="middle" '
            f'font-family="{FONT}" font-size="14" fill="#888">'
            "No trench data available.</text></svg>"
        )

    cols = len(trenches)
    # Map trench id → column index (sorted by order)
    trench_idx: dict[str, int] = {t["id"]: i for i, t in enumerate(trenches)}

    # ── Compute row count ─────────────────────────────────────────────────────
    total_rows = max(
        (p.get("rowEnd", 0) + 1 for p in placements),
        default=1,
    )

    # ── Build occupancy grid  occupancy[row][col] = contextId | None ─────────
    occupancy: list[list[str | None]] = [
        [None] * cols for _ in range(total_rows)
    ]
    for p in placements:
        ctx_id: str = p.get("contextId", "?")
        row_s: int = p.get("rowStart", 0)
        row_e: int = p.get("rowEnd", row_s)
        for tid in p.get("trenchIds", []):
            ci = trench_idx.get(tid)
            if ci is None:
                continue
            for r in range(row_s, row_e + 1):
                if 0 <= r < total_rows:
                    occupancy[r][ci] = ctx_id

    # ── Coordinate helpers ────────────────────────────────────────────────────
    # row 0 = oldest → BOTTOM;  row (total_rows-1) = youngest → TOP
    def x_of(col: int) -> float:
        return PAD_L + col * COL_W

    def y_of(row: int) -> float:
        """Top edge of the given row band (row 0 is at the bottom)."""
        return PAD_T + (total_rows - 1 - row) * ROW_H

    graph_w = cols * COL_W
    graph_h = total_rows * ROW_H
    total_w = PAD_L + graph_w + PAD_R
    total_h = PAD_T + graph_h + PAD_B

    # ── Row extents (leftmost / rightmost occupied column per row) ────────────
    row_exts: list[tuple[int, int]] = []   # (left, right) — -1 if empty
    for r in range(total_rows):
        left = -1; right = -1
        for c in range(cols):
            if occupancy[r][c] is not None:
                if left == -1:
                    left = c
                right = c
        row_exts.append((left, right))

    # ── Sequences (contiguous occupied rows) ──────────────────────────────────
    sequences: list[dict] = []   # {row_start, row_end, extents: [(l, r), ...]}
    seq_start = -1
    for r in range(total_rows):
        if row_exts[r][0] >= 0:
            if seq_start < 0:
                seq_start = r
        elif seq_start >= 0:
            sequences.append({
                "row_start": seq_start,
                "row_end": r - 1,
                "extents": row_exts[seq_start:r],
            })
            seq_start = -1
    if seq_start >= 0:
        sequences.append({
            "row_start": seq_start,
            "row_end": total_rows - 1,
            "extents": row_exts[seq_start:total_rows],
        })

    # ── Build closed polygon for each sequence ───────────────────────────────
    def build_sequence_polygon(seq: dict) -> str:
        pts: list[str] = []
        exts = seq["extents"]
        rs = seq["row_start"]
        # Left boundary: bottom → top
        for i, (lft, _) in enumerate(exts):
            r = rs + i
            x = x_of(lft)
            pts.append(f"{x:.1f},{y_of(r) + ROW_H:.1f}")
            pts.append(f"{x:.1f},{y_of(r):.1f}")
        # Right boundary: top → bottom
        for i in range(len(exts) - 1, -1, -1):
            _, rgt = exts[i]
            r = rs + i
            x = x_of(rgt + 1)
            pts.append(f"{x:.1f},{y_of(r):.1f}")
            pts.append(f"{x:.1f},{y_of(r) + ROW_H:.1f}")
        return " ".join(pts)

    # ── Hiatus ranges (gap rows between sequences) ────────────────────────────
    hiatus_ranges: list[tuple[int, int]] = []
    for i in range(len(sequences) - 1):
        gap_s = sequences[i]["row_end"] + 1
        gap_e = sequences[i + 1]["row_start"] - 1
        if gap_s <= gap_e:
            hiatus_ranges.append((gap_s, gap_e))

    # ── Degradation vacuity polygons ──────────────────────────────────────────
    vacuity_polys: list[str] = []
    for seq in sequences:
        exts = seq["extents"]
        rs = seq["row_start"]
        for i in range(1, len(exts)):
            prev_l, prev_r = exts[i - 1]
            curr_l, curr_r = exts[i]
            r_prev = rs + i - 1
            r_curr = rs + i
            if curr_l > prev_l:
                pts = " ".join([
                    f"{x_of(prev_l):.1f},{y_of(r_prev):.1f}",
                    f"{x_of(curr_l):.1f},{y_of(r_curr):.1f}",
                    f"{x_of(curr_l):.1f},{y_of(r_curr) + ROW_H:.1f}",
                    f"{x_of(prev_l):.1f},{y_of(r_prev):.1f}",
                ])
                vacuity_polys.append(pts)
            if curr_r < prev_r:
                pts = " ".join([
                    f"{x_of(prev_r + 1):.1f},{y_of(r_prev):.1f}",
                    f"{x_of(curr_r + 1):.1f},{y_of(r_curr):.1f}",
                    f"{x_of(curr_r + 1):.1f},{y_of(r_curr) + ROW_H:.1f}",
                    f"{x_of(prev_r + 1):.1f},{y_of(r_prev):.1f}",
                ])
                vacuity_polys.append(pts)

    # ── Context label placement (centroid of each context's cells) ────────────
    # Build: contextId → list of (col, row) cells
    ctx_cells: dict[str, list[tuple[int, int]]] = {}
    for r in range(total_rows):
        for c in range(cols):
            cid = occupancy[r][c]
            if cid:
                ctx_cells.setdefault(cid, []).append((c, r))

    # ─────────────────────────── SVG ASSEMBLY ────────────────────────────────

    parts: list[str] = []

    # ── <defs> ────────────────────────────────────────────────────────────────
    parts.append(f"""<defs>
  <!-- Diagonal hatching for degradation vacuity -->
  <pattern id="pub-vacuity" patternUnits="userSpaceOnUse" width="6" height="6"
           patternTransform="rotate(45)">
    <line x1="0" y1="0" x2="0" y2="6" stroke="{STROKE}" stroke-width="0.7" opacity="0.55"/>
  </pattern>
  <!-- Horizontal dashed hatching for hiatus zones -->
  <pattern id="pub-hiatus" patternUnits="userSpaceOnUse" width="1" height="8">
    <line x1="0" y1="0" x2="1" y2="0" stroke="{STROKE}" stroke-width="0.8" opacity="0.35"/>
  </pattern>
  <!-- Clip path to constrain labels inside the graph area -->
  <clipPath id="pub-graph-clip">
    <rect x="{PAD_L}" y="{PAD_T}" width="{graph_w}" height="{graph_h}"/>
  </clipPath>
</defs>""")

    # ── Background ────────────────────────────────────────────────────────────
    parts.append(
        f'<rect width="{total_w}" height="{total_h}" fill="{FILL_BG}"/>'
    )
    # Graph area background
    parts.append(
        f'<rect x="{PAD_L}" y="{PAD_T}" width="{graph_w}" height="{graph_h}" '
        f'fill="{FILL_BG}" stroke="{STROKE}" stroke-width="{STROKE_W}"/>'
    )

    # ── Subtle horizontal time-grid lines ─────────────────────────────────────
    for r in range(total_rows + 1):
        y = PAD_T + r * ROW_H
        parts.append(
            f'<line x1="{PAD_L}" y1="{y}" x2="{PAD_L + graph_w}" y2="{y}" '
            f'stroke="{STROKE}" stroke-width="0.4" stroke-dasharray="4,6" opacity="0.4"/>'
        )

    # ── Sequence deposit polygons ─────────────────────────────────────────────
    for seq in sequences:
        pts = build_sequence_polygon(seq)
        parts.append(
            f'<polygon points="{pts}" fill="{FILL_DEPOSIT}" '
            f'stroke="{STROKE}" stroke-width="{STROKE_W}" stroke-linejoin="round"/>'
        )

    # ── Hiatus zones ──────────────────────────────────────────────────────────
    for (hs, he) in hiatus_ranges:
        # y1 = top edge of the top hiatus row, y2 = bottom edge of bottom row
        y_top = y_of(he)
        y_bot = y_of(hs) + ROW_H
        h_height = y_bot - y_top
        # Hatched fill
        parts.append(
            f'<rect x="{PAD_L}" y="{y_top:.1f}" width="{graph_w}" '
            f'height="{h_height:.1f}" fill="url(#pub-hiatus)"/>'
        )
        # Bounding lines
        parts.append(
            f'<line x1="{PAD_L}" y1="{y_top:.1f}" x2="{PAD_L + graph_w}" y2="{y_top:.1f}" '
            f'stroke="{STROKE}" stroke-width="1.5" stroke-dasharray="10,5"/>'
        )
        parts.append(
            f'<line x1="{PAD_L}" y1="{y_bot:.1f}" x2="{PAD_L + graph_w}" y2="{y_bot:.1f}" '
            f'stroke="{STROKE}" stroke-width="1.5" stroke-dasharray="10,5"/>'
        )
        # Label
        label_y = (y_top + y_bot) / 2
        parts.append(
            f'<text x="{PAD_L + 12}" y="{label_y + 4:.1f}" '
            f'font-family="{FONT}" font-size="11" fill="{STROKE}" '
            f'font-style="italic" clip-path="url(#pub-graph-clip)">Hiatus</text>'
        )

    # ── Degradation vacuity hatching ──────────────────────────────────────────
    for pts in vacuity_polys:
        parts.append(
            f'<polygon points="{pts}" fill="url(#pub-vacuity)" '
            f'stroke="{STROKE}" stroke-width="0.8" stroke-dasharray="4,3"/>'
        )

    # ── Context ID labels ─────────────────────────────────────────────────────
    for cid, cells in ctx_cells.items():
        avg_x = sum(x_of(c) + COL_W / 2 for c, _ in cells) / len(cells)
        avg_y = sum(y_of(r) + ROW_H / 2 for _, r in cells) / len(cells)
        parts.append(
            f'<text x="{avg_x:.1f}" y="{avg_y + 4:.1f}" '
            f'text-anchor="middle" font-family="{FONT}" font-size="11" '
            f'fill="{STROKE}" font-weight="600" '
            f'clip-path="url(#pub-graph-clip)">{_esc(cid)}</text>'
        )

    # ── Y-axis: time period labels (t1 = bottom = row 0) ─────────────────────
    for r in range(total_rows):
        y_centre = y_of(r) + ROW_H / 2
        label = f"t{r + 1}"
        parts.append(
            f'<text x="{PAD_L - 8}" y="{y_centre + 4:.1f}" '
            f'text-anchor="end" font-family="{FONT}" font-size="12" '
            f'fill="{STROKE}" font-style="italic">{label}</text>'
        )
        # Tick
        parts.append(
            f'<line x1="{PAD_L - 4}" y1="{y_centre:.1f}" '
            f'x2="{PAD_L}" y2="{y_centre:.1f}" '
            f'stroke="{STROKE}" stroke-width="1"/>'
        )

    # ── X-axis: trench labels (bottom) ───────────────────────────────────────
    graph_bottom = PAD_T + graph_h
    for i, t in enumerate(trenches):
        x_centre = PAD_L + i * COL_W + COL_W / 2
        lbl = _esc(t.get("label") or t.get("id") or f"T{i+1}")
        parts.append(
            f'<text x="{x_centre:.1f}" y="{graph_bottom + 20}" '
            f'text-anchor="middle" font-family="{FONT}" font-size="13" '
            f'fill="{STROKE}" font-weight="bold">{lbl}</text>'
        )
        # Vertical column divider
        if 0 < i:
            xd = PAD_L + i * COL_W
            parts.append(
                f'<line x1="{xd}" y1="{PAD_T}" x2="{xd}" y2="{graph_bottom}" '
                f'stroke="{STROKE}" stroke-width="0.5" opacity="0.4"/>'
            )

    # ── Axis titles ───────────────────────────────────────────────────────────
    # Y-axis title (rotated)
    y_title_x = PAD_L - 60
    y_title_y = PAD_T + graph_h / 2
    parts.append(
        f'<text x="{y_title_x:.1f}" y="{y_title_y:.1f}" '
        f'text-anchor="middle" font-family="{FONT}" font-size="12" '
        f'fill="{STROKE}" font-style="italic" '
        f'transform="rotate(-90, {y_title_x:.1f}, {y_title_y:.1f})">'
        f'Time (oldest → youngest)</text>'
    )
    # X-axis title
    x_title_x = PAD_L + graph_w / 2
    x_title_y = graph_bottom + PAD_B - 12
    parts.append(
        f'<text x="{x_title_x:.1f}" y="{x_title_y}" '
        f'text-anchor="middle" font-family="{FONT}" font-size="12" '
        f'fill="{STROKE}" font-style="italic">Space (Trenches)</text>'
    )

    # ── Wrap in <svg> ─────────────────────────────────────────────────────────
    body = "\n".join(parts)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'width="{total_w}" height="{total_h}" '
        f'viewBox="0 0 {total_w} {total_h}">\n'
        f'{body}\n'
        f'</svg>'
    )


# ── Helpers ───────────────────────────────────────────────────────────────────

def _esc(text: str) -> str:
    """Minimal XML character escaping for SVG text content."""
    return (
        text.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;")
    )