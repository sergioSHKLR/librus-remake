# LIBRUS

A lightweight digital reading workspace: local markdown library, annotations, and configurable reference lookup.

**Live:** [https://sergioshklr.github.io/librus-remake/](https://sergioshklr.github.io/librus-remake/)  
**Dev:** [https://sergioshklr.github.io/librus-remake/dev/](https://sergioshklr.github.io/librus-remake/dev/)

Build **v32** · deploy **r21**

## Branches

| Branch | Role |
|--------|------|
| `prod` | Production source — deploys to site root |
| `dev` | Development source — deploys to `/dev/` |
| `gh-pages` | Published static site (do not edit by hand) |
| `main` | Legacy; superseded by `prod` |

## Quick start

```bash
npm install
npm run build      # MD → HTML + TOC + manifest
npm run assets     # Lucide sprite + PWA PNGs
npx serve -l 3000 -c serve.json .
```

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run build` | Run `build.js` (books from `md/` + `books/*.md`) |
| `npm run icons` | Build Lucide sprite (`icons/sprite.svg`) |
| `npm run pwa-assets` | Favicon, PWA icons, screenshots |
| `npm run assets` | Icons + PWA assets |
| `npm run deploy` | Build, then publish `prod` → `/` and `dev` → `/dev/` on `gh-pages` |

## Deploy

```bash
git checkout dev        # or prod
npm run deploy
git push origin gh-pages
```

After deploy: unregister the service worker, clear site data, hard refresh.

## Version bumps

On every release, bump in sync:

- `pwa/pwa.js` → `BUILD_ID` (e.g. `v32-r21`)
- `sw.js` → `CACHE_VERSION` (e.g. `librus-v32-r21`)

## Docs

- [`docs/V32-MINOR-LOG.md`](docs/V32-MINOR-LOG.md) — v32 revision history
- Older reference HTML exports remain in `docs/` for archival use

## Stack

Vanilla HTML/CSS/JS PWA · nano-SSG (`build.js`) · Lucide icons (sprite) · Web Annotation notes · Service worker shell cache