#!/usr/bin/env bash
# Regenerate books/manifest.json for static library scan (GH Pages).
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
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

def is_valid_css_color(value: str) -> bool:
    if not value:
        return False
    return bool(re.match(
        r"^(?:#[0-9a-f]{3,8}|hsl[a]?\([^)]+\)|rgb[a]?\([^)]+\))$",
        value.strip(),
        re.I,
    ))

def parse_order(meta: dict):
    raw = (
        meta.get("chronology")
        or meta.get("order")
        or meta.get("series_order")
        or meta.get("seriesorder")
    )
    if raw is None:
        return None
    try:
        return int(str(raw).strip())
    except ValueError:
        return None

def entry_from_meta(filename: str, meta: dict) -> dict:
    entry = {}
    slug = re.sub(r"\.md$", "", filename, flags=re.I)
    if meta.get("title"):
        entry["title"] = meta["title"].strip()
    if meta.get("author"):
        entry["author"] = meta["author"].strip()
    elif re.match(r"^(adv|mem|ret|hlb|cb|novel)_", slug):
        entry["author"] = "Arthur Conan Doyle"
    if meta.get("subtitle"):
        entry["subtitle"] = meta["subtitle"].strip()
    lang = meta.get("lang") or meta.get("language")
    if lang:
        entry["lang"] = lang.strip()
    bg = meta.get("cover_bg") or meta.get("coverbg") or ""
    fg = meta.get("cover_fg") or meta.get("coverfg") or ""
    if is_valid_css_color(bg):
        entry["coverBg"] = bg.strip()
        entry["coverFg"] = fg.strip() if is_valid_css_color(fg) else "#f5f0e8"
    chronology = parse_order(meta)
    if chronology is not None:
        entry["chronology"] = chronology
    return entry

file_rows = []
for filename in glob.glob("*.md"):
    with open(filename, encoding="utf-8") as handle:
        text = handle.read(8192)
    meta = parse_frontmatter(text)
    entry = entry_from_meta(filename, meta)
    chronology = entry.get("chronology")
    file_rows.append((chronology if chronology is not None else 10**9, filename.lower(), filename, entry))

file_rows.sort(key=lambda row: (row[0], row[1]))
files = [row[2] for row in file_rows]
entries = {row[2]: row[3] for row in file_rows if row[3]}

manifest = {
    "version": 2,
    "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "files": files,
    "entries": entries,
}
with open("manifest.json", "w", encoding="utf-8") as handle:
    json.dump(manifest, handle, indent=2)
    handle.write("\n")
print(f"manifest.json: {len(files)} markdown files, {len(entries)} metadata entries")
PY