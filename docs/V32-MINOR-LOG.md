# Librus v32 — Minor Version Log

Production deploy log for the `librus-remake` rewrite (major **32**).

## V32-r21 — 2026-07-01 — Docs refresh, prod/dev branches, GH Pages deploy

**Build:** `v32-r21` · **Cache:** `librus-v32-r21`

| Area | Change |
|------|--------|
| Git | `prod` + `dev` source branches; `gh-pages` publish via `npm run deploy` |
| Deploy | Prod → site root; dev → `/dev/`; `librus-base` meta + `js/base-path.js` |
| Docs | `README.md`, this log; `.gitignore` |
| Context | `pdf-viewer.html` uses shared `context-theme` (system/light/dark) |
| Paths | `librusPath()` for books, context iframes, icons; book expand uses `../icons/` |

## V32-r20 — 2026-07-01 — Context panel theme (system)

**Build:** `v32-r20` · **Cache:** `librus-v32-r20`

| Area | Change |
|------|--------|
| Theme | `pages/context-theme.css` + `context-theme.js`; `?theme=system\|light\|dark` |
| Pages | `context-placeholder.html`, `context-offline.html` follow `prefers-color-scheme` |
| Main | Passes `settings.theme` to iframe URLs; no iframe reload on OS theme change |

## V32-r19 — 2026-07-01 — Lucide icons + theme #333

**Build:** `v32-r19` · **Cache:** `librus-v32-r19`

| Area | Change |
|------|--------|
| Icons | Lucide via `lucide-static`; `icons/sprite.svg` + `<use>`; `js/icons.js` |
| Brand | `columns-4` in `#eee` / `#111` pill; PWA assets regenerated |
| Theme | `--theme-base: #333`; light chrome `#eee`, text `#111` |
| Cleanup | Removed `current.svg` / `expired.svg`; update = LED + badge text only |

## V32-r15–r18 — LED, offline PDF, theme, PWA assets

| Rev | Summary |
|-----|---------|
| r15 | Version pill + status LED; offline → PDF viewer only in context |
| r16 | `#222` theme tokens; LED inside version pill; MD upload UI removed |
| r17 | Mono → Lucide pipeline started; GitHub Octocat; maskable PWA icons |
| r18 | Dropped update-status SVGs; fixed `renderAppUpdateStatus` |

## URLs

- **Prod:** `https://sergioshklr.github.io/librus-remake/`
- **Dev:** `https://sergioshklr.github.io/librus-remake/dev/`