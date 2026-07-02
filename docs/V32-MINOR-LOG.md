# Librus v32 — Minor Version Log

Production deploy log for the `librus-remake` rewrite (major **32**).

## V32-r29 — 2026-07-01 — Brand scale, CSS trim, centered filter

**Build:** `v32-r29` · **Cache:** `librus-v32-r29`

| Area | Change |
|------|--------|
| Brand | Single `#222` canvas, enlarged columns-4; topbar icon fills 2rem (no extra pill) |
| PWA | Favicon/maskable mark ~85% of tile (was triple-nested + 18% inset) |
| CSS | Merged highlight vars; dropped accent/topbar-icon aliases |
| Layout | Library filter centered on landscape (`--library-filter-max-width`) |

## V32-r28 — 2026-07-01 — Brand = columns-4 (not notebook PNG)

**Build:** `v32-r28` · **Cache:** `librus-v32-r28`

| Area | Change |
|------|--------|
| Brand | Topbar + PWA/favicon use columns-4 mark (`brand-mark.svg` / sprite), not `librus logo.png` |

## V32-r27 — 2026-07-01 — Two-row library topbar + user logo

**Build:** `v32-r27` · **Cache:** `librus-v32-r27`

| Area | Change |
|------|--------|
| Topbar | Library: row 1 = brand/actions, row 2 = filter (always visible) |
| Brand | Topbar uses `pwa/librus logo.png` at icon size (2.25rem) via `librusPath()` |
| Layout | Settings overlay offset for taller library chrome |

## V32-r26 — 2026-07-01 — Cleanup, dark notes, user logo, btn-wide

**Build:** `v32-r26` · **Cache:** `librus-v32-r26`

| Area | Change |
|------|--------|
| Books | Removed stress-test `lde` book |
| UI | `.btn-wide` uses `--theme-base` (no green accent) |
| Dark | Note cards, highlights, quote preview use theme tokens |
| PWA | `pwa/librus logo.png` preferred for icon/favicon PNG generation |

## V32-r25 — 2026-07-01 — Inverted brand icon

**Build:** `v32-r25` · **Cache:** `librus-v32-r25`

| Area | Change |
|------|--------|
| Brand | Inverted columns-4: `#eee` on `#222` pill (UI, favicon, PWA assets) |

## V32-r24 — 2026-07-01 — SW fix, brand #222, TOC icon

**Build:** `v32-r24` · **Cache:** `librus-v32-r24`

| Area | Change |
|------|--------|
| SW | `cacheFirst` / `networkFirst` always resolve to `Response` (fixes offline PDF TypeError) |
| Brand | columns-4 foreground `#222` on `#eee` pill (UI, favicon, PWA SVGs) |
| Icons | TOC toggle: Lucide `list` → `table-of-contents` |
| Deploy | Exclude stray root `git` file so gh-pages worktree stays valid |

## V32-r22 — 2026-07-01 — Icons, enlarged brand, offline PDF viewer

**Build:** `v32-r22` · **Cache:** `librus-v32-r22`

| Area | Change |
|------|--------|
| Icons | Lucide `share` → `share-2`, `library` → `library-big` (sprite + aliases) |
| Brand | Enlarged columns-4 in favicon / PWA SVGs; PNGs regenerated from existing sources |
| Offline | `pages/*` cache-first + `ignoreSearch` so `pdf-viewer.html?theme=…` loads offline |
| Context | PDF viewer treated as shell state (back/share); reload opens file picker when offline |

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