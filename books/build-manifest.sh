#!/usr/bin/env bash
# build-manifest.sh - Generates books/manifest.json with smart title extraction
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

python3 << PY
import glob
import json
import os
import re
from datetime import datetime, timezone

os.chdir("$DIR")

def normalize_key(raw: str) -> str:
    return raw.strip().lower().replace("-", "_")

def unquote(val: str) -> str:
    val = val.strip()
    if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
        return val[1:-1]
    return val

def parse_frontmatter(text: str):
    match = re.match(r"^---\r?\n([\s\S]*?)\r?\n---\r?\n?", text)
    if not match:
        return {}
    meta = {}
    for line in match.group(1).splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        kv = re.match(r"^([A-Za-z0-9_-]+):\s*(.+)$", line)
        if not kv:
            continue
        meta[normalize_key(kv.group(1))] = unquote(kv.group(2))
    return meta

def extract_first_heading(text: str) -> str:
    match = re.search(r"^\s*#\s+(.+)$", text, re.MULTILINE)
    if match:
        return match.group(1).strip()
    return ""

def entry_from_meta(filename: str, text: str) -> dict:
    slug = re.sub(r"\.md$", "", filename, flags=re.I)
    meta = parse_frontmatter(text)
    entry = {}

    # Title priority: frontmatter > first # heading > filename
    title = meta.get("title")
    if not title:
        title = extract_first_heading(text)
    if not title:
        title = re.sub(r'^(adv|mem|ret|hlb|cb|novel)_[0-9_]*', '', slug)
        title = re.sub(r'_', ' ', title).strip()
        title = ' '.join(word.capitalize() for word in title.split())
    
    entry["title"] = title
    entry["slug"] = slug   # useful for linking

    if meta.get("author"):
        entry["author"] = meta["author"].strip()
    elif re.match(r"^(adv|mem|ret|hlb|cb|novel)_", slug):
        entry["author"] = "Arthur Conan Doyle"

    if meta.get("subtitle"):
        entry["subtitle"] = meta["subtitle"].strip()

    lang = meta.get("lang") or meta.get("language")
    if lang:
        entry["lang"] = lang.strip()

    # Cover colors
    bg = meta.get("cover_bg") or meta.get("coverbg") or ""
    fg = meta.get("cover_fg") or meta.get("coverfg") or ""
    if bg and re.match(r"^(#[0-9a-f]{3,8}|hsl[a]?\(|rgb[a]?\()", bg.strip(), re.I):
        entry["coverBg"] = bg.strip()
        entry["coverFg"] = fg.strip() if fg else "#f5f0e8"

    # Chronology
    raw_order = (meta.get("chronology") or meta.get("order") or 
                 meta.get("series_order") or meta.get("seriesorder"))
    if raw_order is not None:
        try:
            entry["chronology"] = int(str(raw_order).strip())
        except ValueError:
            pass

    return entry

# Main processing
file_rows = []
for filename in sorted(glob.glob("*.md")):
    with open(filename, encoding="utf-8") as f:
        text = f.read(16384)  # first 16KB should be enough
    entry = entry_from_meta(filename, text)
    order = entry.get("chronology", 999999)
    file_rows.append((order, filename.lower(), filename, entry))

file_rows.sort(key=lambda x: (x[0], x[1]))

manifest = {
    "version": 2,
    "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "files": [row[2] for row in file_rows],
    "entries": {row[2]: row[3] for row in file_rows}
}

with open("manifest.json", "w", encoding="utf-8") as f:
    json.dump(manifest, f, indent=2, ensure_ascii=False)
    f.write("\n")

print(f"✅ manifest.json created: {len(manifest['files'])} books")
PY