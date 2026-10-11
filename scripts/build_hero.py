#!/usr/bin/env python3
"""Build the profile hero in a light and a dark variant.

The figure is a unit chart: one square is 100 million parameters, so each
model is drawn at its real size relative to the others. To add or change a
model, edit MODELS below and run this script. Nothing is fetched from the
network, so there is nothing to refresh on a schedule.

Text is converted to outlines. GitHub serves repository SVGs with a content
security policy that blocks fonts, so outlined text is the only way the
typeface survives; it also renders the same on every device.

    pip install fonttools uharfbuzz
    python3 scripts/build_hero.py
"""
from pathlib import Path

import uharfbuzz as hb
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
FONTS = Path(__file__).resolve().parent / "fonts"
OUT = ROOT / "assets"

# ---------------------------------------------------------------------------
# Content

NAME = "Rama Krishna Bachu"
STATEMENT = [
    "Java and Python distributed systems.",
    "AI agents and MCP servers.",
    "Small language models, for fun.",
]
LEGEND = "One square is 100 million parameters"

# (label, parameters in billions), drawn left to right.
MODELS = [
    ("Fast", 1.7),
    ("Fin-PRM", 7),
    ("Agentic v3", 7),
    ("Fin", 32),
]

ALT = (
    f"{NAME}. {' '.join(STATEMENT)} "
    "The models, drawn to scale by parameter count: "
    + ", ".join(f"{label} {size:g}B" for label, size in MODELS)
    + "."
)

# ---------------------------------------------------------------------------
# Tokens. Foregrounds are GitHub's own, so the hero sits on the page like text.

THEMES = {
    "light": {"fg": "#1f2328", "muted": "#59636e", "rule": "#d1d9e0", "accent": "#0b8a76"},
    "dark": {"fg": "#f0f6fc", "muted": "#9198a1", "rule": "#3d444d", "accent": "#2ddbc0"},
}

W, H = 1000, 300
BASELINE = 232          # the line every block stands on
PITCH, SQUARE = 9, 6    # grid step and square size
GAP = 46                # space between blocks
ROW_DELAY_MS = 38       # stagger between rows as the blocks stack up


# ---------------------------------------------------------------------------
# Text to outlines

class Face:
    """A font whose glyphs are emitted once as outlines and reused by reference."""

    def __init__(self, key: str, filename: str):
        path = FONTS / filename
        self.key = key
        self.tt = TTFont(path)
        self.glyphs = self.tt.getGlyphSet()
        self.order = self.tt.getGlyphOrder()
        self.upem = self.tt["head"].unitsPerEm
        self.hb = hb.Font(hb.Face(path.read_bytes()))
        self.used: dict[int, str] = {}

    def set(self, text: str, size: float, x: float, y: float, fill: str, tracking: float = 0.0) -> str:
        """Set text at x, baseline y. Tracking is in ems."""
        buf = hb.Buffer()
        buf.add_str(text)
        buf.guess_segment_properties()
        hb.shape(self.hb, buf, {"kern": True, "liga": True})
        scale = size / self.upem
        uses, cursor = [], 0
        for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
            gid = info.codepoint
            if gid not in self.used:
                pen = SVGPathPen(self.glyphs, ntos=lambda v: str(round(v)))
                self.glyphs[self.order[gid]].draw(pen)
                self.used[gid] = pen.getCommands()
            if self.used[gid]:  # spaces have no outline
                uses.append(f'<use href="#{self.key}{gid}" x="{cursor + pos.x_offset}"/>')
            cursor += pos.x_advance + round(tracking * self.upem)
        return (
            f'<g fill="{fill}" transform="translate({x:g} {y:g}) scale({scale:.5f} -{scale:.5f})">'
            + "".join(uses) + "</g>"
        )

    def defs(self) -> str:
        return "".join(
            f'<path id="{self.key}{gid}" d="{d}"/>' for gid, d in sorted(self.used.items()) if d
        )


# ---------------------------------------------------------------------------
# Figure

def block_shape(billions: float):
    """Columns and squares for a model, keeping every block the same proportion."""
    squares = round(billions * 10)
    cols = max(4, round((squares * 0.8) ** 0.5))
    return cols, squares


def dashes(x: float, y: float, count: int) -> str:
    """A run of squares, drawn as one dashed stroke."""
    return f"M{x:g} {y:g}h{count * PITCH - (PITCH - SQUARE):g}"


def build(theme: str) -> str:
    c = THEMES[theme]
    display = Face("d", "BricolageGrotesque-Display-Bold.ttf")
    text = Face("t", "BricolageGrotesque-Text-Medium.ttf")
    type_, rows = [], {}

    # Left column: name, statement, legend.
    type_.append(display.set(NAME, 60, 0, 72, c["fg"], tracking=-0.006))
    for i, line in enumerate(STATEMENT):
        type_.append(text.set(line, 27, 1, 121 + i * 35, c["fg"]))
    type_.append(text.set(LEGEND, 15, 16, 275, c["muted"]))
    legend_swatch = dashes(1, 270, 1)

    # Right column: blocks, right-aligned, smallest first.
    shapes = [block_shape(size) for _, size in MODELS]
    widths = [cols * PITCH - (PITCH - SQUARE) for cols, _ in shapes]
    x = W - 2 - (sum(widths) + GAP * (len(MODELS) - 1))
    figure_left = x
    for (label, size), (cols, squares), width in zip(MODELS, shapes, widths):
        for row in range(-(-squares // cols)):
            count = min(cols, squares - row * cols)
            y = BASELINE - 3 - SQUARE / 2 - row * PITCH
            rows.setdefault(row, []).append(dashes(x, y, count))
        type_.append(text.set(label, 15, x, 255, c["fg"]))
        type_.append(text.set(f"{size:g}B", 15, x, 275, c["muted"]))
        x += width + GAP

    stacked = "\n".join(
        f'<path class="row" style="animation-delay:{row * ROW_DELAY_MS}ms" d="{"".join(rows[row])}"/>'
        for row in sorted(rows)
    )

    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-labelledby="t">
<title id="t">{ALT}</title>
<style>
.row {{ animation: stack .45s cubic-bezier(.2,.7,.2,1) both; }}
@keyframes stack {{ from {{ opacity: 0; transform: translateY(5px); }} }}
@media (prefers-reduced-motion: reduce) {{ .row {{ animation: none; }} }}
</style>
<defs>{display.defs()}{text.defs()}</defs>
{chr(10).join(type_)}
<path stroke="{c['rule']}" d="M{figure_left} {BASELINE + .5}H{W - 2}"/>
<g fill="none" stroke="{c['accent']}" stroke-width="{SQUARE}" stroke-dasharray="{SQUARE} {PITCH - SQUARE}">
<path d="{legend_swatch}"/>
{stacked}
</g>
</svg>
"""


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for theme in THEMES:
        out = OUT / f"hero-{theme}.svg"
        out.write_text(build(theme))
        print(f"wrote {out.relative_to(ROOT)}  ({out.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
