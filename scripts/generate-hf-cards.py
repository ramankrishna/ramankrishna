#!/usr/bin/env python3
"""Generate static SVG cards for HuggingFace models. Run on commit, commit output.

Note: uses ``json.loads(strict=False)`` instead of ``json.load()`` because the
HuggingFace model API returns JSON with unescaped control characters in
card-data text fields (raw ``\\n`` / ``\\t`` inside string values). Strict JSON
parsing rejects this; lenient parsing tolerates it without sacrificing
structural validation.
"""
import json
import urllib.request
from pathlib import Path
from datetime import datetime

MODELS = [
    {"id": "ramankrishna10/npc-fast-1.7b", "display": "NPC Fast 1.7B", "base": "SmolLM2-1.7B-Instruct"},
    {"id": "ramankrishna10/npc-fin-32b-sft", "display": "NPC Fin 32B", "base": "Qwen2.5-32B-Instruct"},
    {"id": "ramankrishna10/npc-fin-prm-7b", "display": "Fin-PRM 7B", "base": "Qwen2.5-7B"},
    {"id": "ramankrishna10/npc-agentic-7b-v3", "display": "NPC Agentic 7B v3", "base": "Qwen2.5-7B"},
]

# Design system colors from bottensor.xyz
BG = "#161b26"
TEAL = "#00dbb8"
GOLD = "#f5c842"
TEXT = "#ffffff"
MUTED = "#8a93a8"

OUT_DIR = Path(__file__).parent.parent / "assets" / "hf-cards"
OUT_DIR.mkdir(parents=True, exist_ok=True)

def fetch(model_id: str) -> dict:
    url = f"https://huggingface.co/api/models/{model_id}"
    with urllib.request.urlopen(url, timeout=10) as r:
        return json.loads(r.read().decode("utf-8"), strict=False)

def fmt_downloads(n: int) -> str:
    if n >= 1_000_000: return f"{n/1_000_000:.1f}M"
    if n >= 1_000: return f"{n/1_000:.1f}k"
    return str(n)

def fmt_date(iso: str) -> str:
    try:
        d = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return d.strftime("%b %Y")
    except Exception:
        return "—"

def card_svg(m: dict, data: dict) -> str:
    downloads = fmt_downloads(data.get("downloads", 0))
    likes = data.get("likes", 0)
    updated = fmt_date(data.get("lastModified", ""))

    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="400" height="120" viewBox="0 0 400 120" role="img" aria-label="{m['display']} on HuggingFace">
  <style>
    .title {{ font: 600 16px 'Outfit', system-ui, sans-serif; fill: {TEAL}; }}
    .base  {{ font: 400 12px 'DM Mono', ui-monospace, monospace; fill: {MUTED}; }}
    .stat-label {{ font: 400 10px 'DM Mono', ui-monospace, monospace; fill: {MUTED}; letter-spacing: 0.5px; text-transform: uppercase; }}
    .stat-value {{ font: 600 18px 'Outfit', system-ui, sans-serif; fill: {TEXT}; }}
    .updated {{ font: 400 10px 'DM Mono', ui-monospace, monospace; fill: {GOLD}; }}
  </style>
  <rect x="0.5" y="0.5" width="399" height="119" rx="8" fill="{BG}" stroke="{TEAL}" stroke-opacity="0.3"/>
  <text x="20" y="32" class="title">{m['display']}</text>
  <text x="20" y="50" class="base">{m['base']}</text>

  <text x="20"  y="84" class="stat-label">Downloads</text>
  <text x="20"  y="104" class="stat-value">{downloads}</text>

  <text x="160" y="84" class="stat-label">Likes</text>
  <text x="160" y="104" class="stat-value">{likes}</text>

  <text x="240" y="84" class="stat-label">Updated</text>
  <text x="240" y="104" class="updated">{updated}</text>

  <circle cx="380" cy="20" r="4" fill="{GOLD}"/>
</svg>'''

def main():
    for m in MODELS:
        try:
            data = fetch(m["id"])
        except Exception as e:
            print(f"WARN: fetch failed for {m['id']}: {e}")
            continue
        slug = m["id"].split("/")[-1]
        out = OUT_DIR / f"{slug}.svg"
        out.write_text(card_svg(m, data))
        print(f"wrote {out}  (downloads={data.get('downloads', 0)}, likes={data.get('likes', 0)})")

if __name__ == "__main__":
    main()
