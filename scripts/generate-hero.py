#!/usr/bin/env python3
"""Generate the profile hero SVG with a live stats grid.

Reads HuggingFace, PyPI, and npm public APIs to populate four cells:
models published, total HF 30-day downloads, PyPI package count, npm package
count. On any fetch failure, falls back to the last-known-good values
checkpointed in ``assets/.hero-state.json``; if no state file exists, falls
back to the static defaults at the top of this module. The script never
writes a misleading ``0`` for any cell.

Note: uses ``json.loads(strict=False)`` instead of ``json.load()`` because the
HuggingFace model API returns JSON with unescaped control characters in
card-data text fields (raw ``\\n`` / ``\\t`` inside string values). Strict JSON
parsing rejects this; lenient parsing tolerates it without sacrificing
structural validation.
"""
import json
import ssl as _ssl
import urllib.parse
import urllib.request
import urllib.error
from pathlib import Path

# Use certifi's CA bundle when importable. macOS framework Python ships without
# system trust integration; the Actions runner setup-python installs certifi
# automatically. When certifi is absent, fall through to the default context.
try:
    import certifi as _certifi
    _SSL_CTX = _ssl.create_default_context(cafile=_certifi.where())
except ImportError:
    _SSL_CTX = None

# -----------------------------------------------------------------------------
# Stat sources

HF_MODELS = [
    "ramankrishna10/npc-fast-1.7b",
    "ramankrishna10/npc-fin-32b-sft",
    "ramankrishna10/npc-fin-prm-7b",
    "ramankrishna10/npc-agentic-7b-v3",
]
PYPI_PACKAGES = ["npc-mom-router", "bottensor-fleet", "polyrt"]
NPM_PACKAGES = ["@bottensor/cogito", "@bottensor/engram", "@bottensor/forge"]

# Static fallbacks. Used only if the state file is missing AND a fetch fails.
# These should track the live truth at first-run; subsequent runs prefer the
# state checkpoint instead.
STATIC_FALLBACK = {
    "models": len(HF_MODELS),
    "hf_downloads": 924,
    "pypi": len(PYPI_PACKAGES),
    "npm": len(NPM_PACKAGES),
}

# -----------------------------------------------------------------------------
# Design system (must match generate-hf-cards.py)

BG = "#161b26"
TEAL = "#00dbb8"
GOLD = "#f5c842"
TEXT = "#ffffff"
MUTED = "#8a93a8"

ROOT = Path(__file__).parent.parent
ASSETS = ROOT / "assets"
ASSETS.mkdir(parents=True, exist_ok=True)
STATE_FILE = ASSETS / ".hero-state.json"
OUT = ASSETS / "hero.svg"


# -----------------------------------------------------------------------------
# Fetchers

def _fetch_json(url: str, timeout: int = 10) -> dict:
    with urllib.request.urlopen(url, timeout=timeout, context=_SSL_CTX) as r:
        return json.loads(r.read().decode("utf-8"), strict=False)


def fetch_hf_total_downloads() -> int:
    total = 0
    for mid in HF_MODELS:
        d = _fetch_json(f"https://huggingface.co/api/models/{mid}")
        total += int(d.get("downloads", 0))
    return total


def fetch_pypi_count() -> int:
    n = 0
    for p in PYPI_PACKAGES:
        try:
            _fetch_json(f"https://pypi.org/pypi/{p}/json")
            n += 1
        except urllib.error.HTTPError:
            pass
    return n


def fetch_npm_count() -> int:
    n = 0
    for p in NPM_PACKAGES:
        try:
            enc = urllib.parse.quote(p, safe="")
            _fetch_json(f"https://registry.npmjs.org/{enc}")
            n += 1
        except urllib.error.HTTPError:
            pass
    return n


# -----------------------------------------------------------------------------
# Stat aggregation with fallback chain

def gather_stats() -> dict:
    last_good: dict = {}
    if STATE_FILE.exists():
        try:
            last_good = json.loads(STATE_FILE.read_text())
        except Exception as e:
            print(f"WARN: state file unreadable ({e}); ignoring")

    plan = [
        ("models", lambda: len(HF_MODELS)),
        ("hf_downloads", fetch_hf_total_downloads),
        ("pypi", fetch_pypi_count),
        ("npm", fetch_npm_count),
    ]
    out: dict = {}
    for key, fn in plan:
        try:
            v = fn()
            # Refuse misleading zeros on stats that should be non-zero.
            if v == 0 and key != "models":
                raise ValueError(f"{key} resolved to 0; refusing to render")
            out[key] = v
        except Exception as e:
            print(f"WARN: fetch failed for {key}: {e}")
            if key in last_good and last_good[key]:
                print(f"      using last-good: {last_good[key]}")
                out[key] = last_good[key]
            else:
                print(f"      using static fallback: {STATIC_FALLBACK[key]}")
                out[key] = STATIC_FALLBACK[key]
    return out


def fmt_num(n: int) -> str:
    if n >= 1_000_000:
        return f"{n / 1_000_000:.1f}M"
    if n >= 10_000:
        return f"{int(round(n / 1_000))}k"
    if n >= 1_000:
        return f"{n / 1_000:.1f}k"
    return str(n)


# -----------------------------------------------------------------------------
# SVG composition

def hero_svg(stats: dict) -> str:
    pad_x = 60
    cell_w = 290  # 4 * 290 = 1160; with pad_x=60 each side, fills 1280 exactly
    centers = [pad_x + cell_w * (i + 0.5) for i in range(4)]
    sep_xs = [pad_x + cell_w * i for i in range(1, 4)]  # 350, 640, 930
    grid_top = 175
    grid_bottom = 260

    cells = [
        (str(stats["models"]),               "MODELS"),
        (fmt_num(stats["hf_downloads"]),     "HF DL"),
        (str(stats["pypi"]),                 "PYPI"),
        (str(stats["npm"]),                  "NPM"),
    ]

    parts: list[str] = []
    parts.append(
        '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="320" '
        'viewBox="0 0 1280 320" role="img" '
        'aria-label="Rama Krishna Bachu — Training small specialized language models end-to-end">'
    )
    parts.append('  <style>')
    parts.append(f"    .name      {{ font: 700 56px 'Outfit', system-ui, sans-serif; fill: {TEXT}; }}")
    parts.append(f"    .headline  {{ font: 400 18px 'DM Mono', ui-monospace, monospace; fill: {TEAL}; letter-spacing: 0.3px; }}")
    parts.append(f"    .stat-val  {{ font: 600 44px 'Outfit', system-ui, sans-serif; fill: {TEXT}; text-anchor: middle; }}")
    parts.append(f"    .stat-lbl  {{ font: 400 11px 'DM Mono', ui-monospace, monospace; fill: {MUTED}; letter-spacing: 1.5px; text-anchor: middle; text-transform: uppercase; }}")
    parts.append('  </style>')

    # Background
    parts.append(f'  <rect width="1280" height="320" fill="{BG}"/>')

    # Name + headline (left-aligned)
    parts.append(f'  <text x="{pad_x}" y="88" class="name">Rama Krishna Bachu</text>')
    parts.append(f'  <text x="{pad_x}" y="125" class="headline">Training small specialized language models end-to-end</text>')

    # Accent dots (top-right anchor)
    for dx in (1180, 1200, 1220):
        parts.append(f'  <circle cx="{dx}" cy="60" r="5" fill="{GOLD}"/>')

    # Stat values
    for cx, (val, _) in zip(centers, cells):
        parts.append(f'  <text x="{cx:.0f}" y="220" class="stat-val">{val}</text>')

    # Stat labels
    for cx, (_, lbl) in zip(centers, cells):
        parts.append(f'  <text x="{cx:.0f}" y="252" class="stat-lbl">{lbl}</text>')

    # Vertical separators (open grid, no boxes)
    for sx in sep_xs:
        parts.append(
            f'  <line x1="{sx}" x2="{sx}" y1="{grid_top}" y2="{grid_bottom}" '
            f'stroke="{TEAL}" stroke-opacity="0.25" stroke-width="1"/>'
        )

    # Bottom rule
    parts.append(
        f'  <line x1="{pad_x}" x2="{1280 - pad_x}" y1="290" y2="290" '
        f'stroke="{TEAL}" stroke-opacity="0.3" stroke-width="1"/>'
    )

    parts.append('</svg>')
    return '\n'.join(parts) + '\n'


# -----------------------------------------------------------------------------
# Main

def main() -> None:
    stats = gather_stats()
    OUT.write_text(hero_svg(stats))
    STATE_FILE.write_text(json.dumps(stats, indent=2) + "\n")
    print(f"wrote {OUT}  ({stats})")


if __name__ == "__main__":
    main()
