#!/usr/bin/env node
/* Generate PWA PNGs from columns-4 brand SVGs (brand-mark.svg, favicon.svg). */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const PWA = path.join(ROOT, 'pwa');

const BRAND_BG = '#222222';
const BRAND_FG = '#eeeeee';
const FG = '#f5f5f5';
const MUTED = '#8a8a8a';

function columns4Mark(viewSize, stroke, insetRatio) {
  const inset = viewSize * insetRatio;
  const iconSize = viewSize - inset * 2;
  const ix = inset;
  const iy = inset;
  const col = iconSize / 4;
  const rx = iconSize * 0.06;
  return `<rect x="${ix}" y="${iy}" width="${iconSize}" height="${iconSize}" rx="${rx}" fill="none" stroke="${BRAND_FG}" stroke-width="${stroke}" stroke-linejoin="round"/>
  <path d="M${ix + col} ${iy}v${iconSize}" stroke="${BRAND_FG}" stroke-width="${stroke}" stroke-linecap="round"/>
  <path d="M${ix + col * 2} ${iy}v${iconSize}" stroke="${BRAND_FG}" stroke-width="${stroke}" stroke-linecap="round"/>
  <path d="M${ix + col * 3} ${iy}v${iconSize}" stroke="${BRAND_FG}" stroke-width="${stroke}" stroke-linecap="round"/>`;
}

function readSvgOrDefault(filePath, fallback) {
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf8');
  }
  return fallback;
}

const brandMarkSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="${BRAND_BG}"/>
  ${columns4Mark(512, 28, 0.078)}
</svg>`;

const maskableSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${BRAND_BG}"/>
  ${columns4Mark(512, 24, 0.11)}
</svg>`;

const faviconSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="${BRAND_BG}"/>
  ${columns4Mark(32, 2, 0.0625)}
</svg>`;

function screenshotWideSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#f7f7f7"/>
  <rect width="1280" height="54" fill="${BRAND_BG}"/>
  <text x="640" y="35" text-anchor="middle" fill="${FG}" font-family="Tahoma, sans-serif" font-size="22" font-weight="700">LIBRUS</text>
  <text x="700" y="35" fill="${MUTED}" font-family="Tahoma, sans-serif" font-size="12">32</text>
  <circle cx="748" cy="28" r="5" fill="#34c759"/>
  <rect x="0" y="54" width="1280" height="48" fill="#ececec"/>
  <rect x="420" y="66" width="440" height="24" rx="4" fill="#fff" stroke="#ccc"/>
  <g transform="translate(80 130)">
    ${[0, 1, 2, 3, 4].map(function (i) {
      const x = (i % 5) * 210;
      const y = Math.floor(i / 5) * 280;
      return `<rect x="${x}" y="${y}" width="170" height="240" rx="6" fill="#4a2f1f"/>
        <rect x="${x}" y="${y}" width="12" height="240" fill="#2d1606"/>
        <text x="${x + 85}" y="${y + 120}" text-anchor="middle" fill="#f0d090" font-family="Georgia, serif" font-size="14">Book ${i + 1}</text>`;
    }).join('')}
  </g>
  <text x="640" y="680" text-anchor="middle" fill="#888" font-family="system-ui, sans-serif" font-size="14">Library catalog — LIBRUS reading workspace</text>
</svg>`;
}

function screenshotNarrowSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="407" height="904" viewBox="0 0 407 904">
  <rect width="407" height="904" fill="#fff"/>
  <rect width="407" height="54" fill="${BRAND_BG}"/>
  <text x="203" y="34" text-anchor="middle" fill="${FG}" font-family="Tahoma, sans-serif" font-size="18" font-weight="700">Reader</text>
  <rect x="0" y="54" width="120" height="850" fill="#ececec"/>
  <rect x="8" y="70" width="104" height="20" rx="3" fill="#fff" stroke="#ccc"/>
  <text x="14" y="120" fill="#444" font-family="system-ui, sans-serif" font-size="11">Part I</text>
  <text x="22" y="142" fill="#666" font-family="system-ui, sans-serif" font-size="10">Chapter 1</text>
  <rect x="120" y="54" width="287" height="850" fill="#fff"/>
  <text x="140" y="100" fill="#222" font-family="Georgia, serif" font-size="16">Reading workspace</text>
  <text x="140" y="130" fill="#555" font-family="Georgia, serif" font-size="12">Select text to annotate or look up references.</text>
</svg>`;
}

function socialCardSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${BRAND_BG}"/>
  <g transform="translate(80 80)">
    ${columns4Mark(180, 10, 0.08)}
  </g>
  <text x="300" y="170" fill="${FG}" font-family="Tahoma, sans-serif" font-size="72" font-weight="700">LIBRUS</text>
  <text x="300" y="240" fill="${MUTED}" font-family="system-ui, sans-serif" font-size="32">Digital reading workspace</text>
  <text x="300" y="300" fill="#9a9a9a" font-family="system-ui, sans-serif" font-size="22">Local library · annotations · reference panel</text>
</svg>`;
}

async function svgToPng(svg, outPath, width, height) {
  await sharp(Buffer.from(svg)).resize(width, height).png().toFile(outPath);
}

async function main() {
  fs.mkdirSync(PWA, { recursive: true });
  const faviconPath = path.join(ROOT, 'favicon.svg');
  const brandPath = path.join(PWA, 'brand-mark.svg');
  const faviconSource = readSvgOrDefault(faviconPath, faviconSvg);
  const brandSource = readSvgOrDefault(brandPath, brandMarkSvg);
  if (!fs.existsSync(faviconPath)) fs.writeFileSync(faviconPath, faviconSource);
  if (!fs.existsSync(brandPath)) fs.writeFileSync(brandPath, brandSource);

  const jobs = [
    [brandSource, path.join(PWA, 'icon-192.png'), 192, 192],
    [brandSource, path.join(PWA, 'icon-512.png'), 512, 512],
    [brandSource, path.join(ROOT, 'icons', 'apple-touch-icon.png'), 180, 180],
    [maskableSvg, path.join(PWA, 'icon-maskable-192.png'), 192, 192],
    [maskableSvg, path.join(PWA, 'icon-maskable-512.png'), 512, 512],
    [brandSource, path.join(PWA, '1024.png'), 1024, 1024],
    [screenshotWideSvg(), path.join(PWA, 'screenshot-wide.png'), 1280, 720],
    [screenshotNarrowSvg(), path.join(PWA, 'screenshot-narrow.png'), 407, 904],
    [socialCardSvg(), path.join(PWA, 'social-card.png'), 1200, 630],
    [faviconSource, path.join(ROOT, 'favicon.png'), 32, 32],
    [faviconSource, path.join(ROOT, 'favicon-32.png'), 32, 32],
    [brandSource, path.join(ROOT, 'icon-192.png'), 192, 192],
    [brandSource, path.join(ROOT, 'icon-512.png'), 512, 512],
  ];

  for (const [svg, out, w, h] of jobs) {
    await svgToPng(svg, out, w, h);
    console.log('wrote', path.relative(ROOT, out));
  }
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});