#!/usr/bin/env python3
"""Build the animated "how the models fit together" diagram, light and dark.

One loop shows two requests. The easy one is answered by NPC Fast. The hard
one is escalated to NPC Fin, whose reasoning steps are scored by Fin-PRM.

Everything is CSS animation inside the SVG, which is the only kind of motion
a GitHub README can play without a GIF. The diagram is complete with the
animation off: nodes, routes and labels are all drawn at rest, and the
moving parts are hidden when the viewer asks for reduced motion.

    pip install fonttools uharfbuzz
    python3 scripts/build_flow.py
"""
from pathlib import Path

from build_hero import Face, THEMES

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets"

W, H = 1000, 296
LOOP = 12.0   # seconds
MID = 150     # the request and the router sit on this line
TOP = 62      # the easy route
LOW = 238     # the hard route

# name, caption, x, y, width, height
NODES = {
    "fast": ("NPC Fast 1.7B", "reads the request, picks a route", 120, 112, 232, 76),
    "fin": ("NPC Fin 32B", "works through it in steps", 440, 200, 206, 76),
    "prm": ("Fin-PRM 7B", "scores each step", 710, 200, 172, 76),
    "answer": ("Answer", "", 906, 120, 92, 60),
}
JUNCTION = 400
EXIT = 952    # both routes come down or up into the answer here

ALT = (
    "Animated diagram. A request reaches NPC Fast 1.7B, which picks a route. "
    "Easy requests it answers itself. Hard requests are escalated to NPC Fin 32B, "
    "which works through them in steps, and Fin-PRM 7B scores each step before the answer."
)

# When each part lights up, in seconds from the start of the loop.
LIT = {
    "fast": [(0.9, 1.7), (5.9, 6.7)],
    "answer": [(3.9, 4.7), (10.2, 11.0)],
    "fin": [(7.5, 8.7)],
    "prm": [(8.4, 9.7)],
    "easy": [(1.7, 3.9)],
    "hard": [(6.7, 10.2)],
}

# Each token: (time, x, y, visible) waypoints. Hidden while a model is working.
def right(node):
    _, _, x, _, w, _ = NODES[node]
    return x + w

EASY = [
    (0.0, 4, MID, 1), (0.9, NODES["fast"][2], MID, 1), (0.95, NODES["fast"][2], MID, 0),
    (1.65, right("fast"), MID, 0), (1.7, right("fast"), MID, 1),
    (1.95, JUNCTION, MID, 1), (2.35, JUNCTION, TOP, 1), (3.55, EXIT, TOP, 1),
    (3.9, EXIT, 120, 1), (3.95, EXIT, 120, 0),
]
HARD = [
    (5.0, 4, MID, 0), (5.05, 4, MID, 1), (5.9, NODES["fast"][2], MID, 1), (5.95, NODES["fast"][2], MID, 0),
    (6.65, right("fast"), MID, 0), (6.7, right("fast"), MID, 1),
    (6.95, JUNCTION, MID, 1), (7.3, JUNCTION, LOW, 1), (7.5, NODES["fin"][2], LOW, 1),
    (7.55, NODES["fin"][2], LOW, 0),
    (9.65, right("prm"), LOW, 0), (9.7, right("prm"), LOW, 1),
    (9.9, EXIT, LOW, 1), (10.2, EXIT, 180, 1), (10.25, EXIT, 180, 0),
]
STEP_STARTS = [8.0, 8.3, 8.6]   # reasoning steps passing from Fin to Fin-PRM
STEP_TRAVEL = 0.4


def pct(t: float) -> str:
    return f"{100 * t / LOOP:.2f}%".replace(".00%", "%")


def token_keyframes(name: str, points) -> str:
    frames = [f"0% {{ transform: translate({points[0][1]}px, {points[0][2]}px); opacity: 0 }}"]
    if points[0][0] == 0:
        frames = []
    for t, x, y, visible in points:
        frames.append(f"{pct(t)} {{ transform: translate({x}px, {y}px); opacity: {visible} }}")
    last = points[-1]
    frames.append(f"100% {{ transform: translate({last[1]}px, {last[2]}px); opacity: 0 }}")
    return f"@keyframes {name} {{ {' '.join(frames)} }}"


def lit_keyframes(name: str, windows) -> str:
    frames = ["0% { opacity: 0 }"]
    for start, end in windows:
        frames += [
            f"{pct(start)} {{ opacity: 0 }}", f"{pct(start + 0.18)} {{ opacity: 1 }}",
            f"{pct(end - 0.3)} {{ opacity: 1 }}", f"{pct(end)} {{ opacity: 0 }}",
        ]
    frames.append("100% { opacity: 0 }")
    return f"@keyframes {name} {{ {' '.join(frames)} }}"


def build(theme: str) -> str:
    c = THEMES[theme]
    text = Face("t", "BricolageGrotesque-Text-Medium.ttf")
    parts, css = [], []

    # Routes, drawn at rest.
    fx, fy, fw = NODES["fast"][2], NODES["fast"][3], NODES["fast"][4]
    routes = (
        f"M0 {MID}H{fx}"
        f"M{fx + fw} {MID}H{JUNCTION}"
        f"M{JUNCTION} {MID}V{TOP}H{EXIT}V{NODES['answer'][3]}"
        f"M{JUNCTION} {MID}V{LOW}H{NODES['fin'][2]}"
        f"M{right('fin')} {LOW}H{NODES['prm'][2]}"
        f"M{right('prm')} {LOW}H{EXIT}V{NODES['answer'][3] + NODES['answer'][5]}"
    )
    parts.append(f'<path fill="none" stroke="{c["rule"]}" stroke-width="1.5" d="{routes}"/>')

    # Route labels: a quiet version at rest, an accent copy that lights up.
    parts.append(text.set("Request", 14, 0, MID - 16, c["muted"]))
    for key, label, x, y in [
        ("easy", "Easy: Fast answers it", JUNCTION + 14, TOP - 12),
        ("hard", "Hard: escalated", JUNCTION + 14, LOW - 46),
    ]:
        parts.append(text.set(label, 14, x, y, c["muted"]))
        parts.append(text.set(label, 14, x, y, c["accent"], attrs=f'class="lit {key}"'))
        css.append(lit_keyframes(key, LIT[key]))
        css.append(f".{key} {{ animation-name: {key} }}")

    # Nodes.
    for key, (name, caption, x, y, w, h) in NODES.items():
        parts.append(
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="none" '
            f'stroke="{c["rule"]}" stroke-width="1.5"/>'
        )
        parts.append(
            f'<rect class="lit {key}" x="{x}" y="{y}" width="{w}" height="{h}" rx="8" '
            f'fill="{c["accent"]}" fill-opacity=".13" stroke="{c["accent"]}" stroke-width="1.5"/>'
        )
        if caption:
            parts.append(text.set(name, 16, x + 16, y + 33, c["fg"]))
            parts.append(text.set(caption, 13, x + 16, y + 54, c["muted"]))
        else:
            parts.append(text.set(name, 16, x + (w - text.width(name, 16)) / 2, y + h / 2 + 5.5, c["fg"]))
        css.append(lit_keyframes(key, LIT[key]))
        css.append(f".{key} {{ animation-name: {key} }}")

    # Moving parts.
    moving = []
    for name, points in [("easyreq", EASY), ("hardreq", HARD)]:
        css.append(token_keyframes(name, points))
        moving.append(f'<rect class="move" style="animation-name:{name}" x="-5" y="-5" width="10" height="10" rx="2"/>')
    for i, start in enumerate(STEP_STARTS):
        a, b = right("fin") + 6, NODES["prm"][2] - 6
        css.append(token_keyframes(f"step{i}", [
            (start - 0.05, a, LOW, 0), (start, a, LOW, 1), (start + STEP_TRAVEL, b, LOW, 1),
            (start + STEP_TRAVEL + 0.05, b, LOW, 0),
        ]))
        moving.append(f'<rect class="move" style="animation-name:step{i}" x="-3" y="-3" width="6" height="6" rx="1"/>')

    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-labelledby="t">
<title id="t">{ALT}</title>
<style>
.lit, .move {{ opacity: 0; animation-duration: {LOOP:g}s; animation-iteration-count: infinite; animation-timing-function: linear; }}
{chr(10).join(css)}
@media (prefers-reduced-motion: reduce) {{ .lit, .move {{ animation: none; }} }}
</style>
<defs>{text.defs()}</defs>
{chr(10).join(parts)}
<g fill="{c['accent']}">{''.join(moving)}</g>
</svg>
"""


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for theme in THEMES:
        out = OUT / f"flow-{theme}.svg"
        out.write_text(build(theme))
        print(f"wrote {out.relative_to(ROOT)}  ({out.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
