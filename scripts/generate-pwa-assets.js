#!/usr/bin/env node
/* Generate PWA PNGs from pwa/librus-logo.png (reference padding from source artwork). */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const PWA = path.join(ROOT, 'pwa');

const BRAND_BG = '#111111';
const FG = '#f5f5f5';
const MUTED = '#8a8a8a';

const LOGO_CANDIDATES = [
  path.join(PWA, 'librus-logo.png'),
  path.join(PWA, 'librus logo.png'),
];

function resolveLogoPath() {
  for (const candidate of LOGO_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

async function logoArtwork(logoSize) {
  const logoPath = resolveLogoPath();
  const { data, info } = await sharp(logoPath)
    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  for (let i = 0; i < width * height; i++) {
    const o = i * channels;
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    if (r > 232 && g > 232 && b > 232) {
      data[o + 3] = 0;
    }
  }

  return sharp(data, { raw: { width, height, channels } }).png().toBuffer();
}

async function logoPng(size, paddingRatio, cornerRadius) {
  const logoPath = resolveLogoPath();
  if (!logoPath) {
    throw new Error('librus logo PNG not found in pwa/');
  }

  const padding = Math.round(size * paddingRatio);
  const logoSize = size - padding * 2;
  const logo = await logoArtwork(logoSize);

  let buf = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BRAND_BG,
    },
  })
    .composite([{ input: logo, left: padding, top: padding }])
    .png()
    .toBuffer();

  if (cornerRadius > 0) {
    const mask = Buffer.from(
      `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${cornerRadius}" fill="#fff"/></svg>`
    );
    buf = await sharp(buf)
      .composite([{ input: mask, blend: 'dest-in' }])
      .png()
      .toBuffer();
  }

  return buf;
}

function screenshotWideSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#0a0612"/>
  <rect width="1280" height="54" fill="${BRAND_BG}"/>
  <text x="640" y="35" text-anchor="middle" fill="${FG}" font-family="Tahoma, sans-serif" font-size="22" font-weight="700">LIBRUS</text>
  <text x="700" y="35" fill="${MUTED}" font-family="Tahoma, sans-serif" font-size="12">32</text>
  <circle cx="748" cy="28" r="5" fill="#34c759"/>
  <rect x="0" y="54" width="1280" height="48" fill="${BRAND_BG}"/>
  <rect x="420" y="66" width="440" height="24" rx="4" fill="#1a1a1a" stroke="#333"/>
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

async function socialCardPng() {
  const logoPath = resolveLogoPath();
  const cardW = 1200;
  const cardH = 630;
  const logoSize = 180;
  const padding = Math.round(logoSize * 0.11);
  const logo = await logoArtwork(logoSize - padding * 2);

  const logoPlate = await sharp({
    create: { width: logoSize, height: logoSize, channels: 4, background: BRAND_BG },
  })
    .composite([{ input: logo, left: padding, top: padding }])
    .png()
    .toBuffer();

  const textSvg = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${cardW}" height="${cardH}">
  <text x="300" y="170" fill="${FG}" font-family="Tahoma, sans-serif" font-size="72" font-weight="700">LIBRUS</text>
  <text x="300" y="240" fill="${MUTED}" font-family="system-ui, sans-serif" font-size="32">Digital reading workspace</text>
  <text x="300" y="300" fill="#9a9a9a" font-family="system-ui, sans-serif" font-size="22">Local library · annotations · reference panel</text>
</svg>`);

  return sharp({
    create: { width: cardW, height: cardH, channels: 4, background: BRAND_BG },
  })
    .composite([
      { input: logoPlate, left: 80, top: 80 },
      { input: textSvg, left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
}

async function writePng(buffer, outPath, width, height) {
  await sharp(buffer).resize(width, height).png().toFile(outPath);
}

async function main() {
  fs.mkdirSync(PWA, { recursive: true });
  if (!resolveLogoPath()) {
    throw new Error('Missing pwa/librus-logo.png');
  }

  const brandBuf = await logoPng(512, 0.11, 96);
  const maskableBuf = await logoPng(512, 0.14, 0);
  const faviconBuf = await logoPng(32, 0.11, 6);
  const socialBuf = await socialCardPng();
  const topbarLogo = await logoArtwork(128);
  fs.writeFileSync(path.join(PWA, 'librus-logo-transparent.png'), topbarLogo);
  console.log('wrote', path.relative(ROOT, path.join(PWA, 'librus-logo-transparent.png')));

  const jobs = [
    [brandBuf, path.join(PWA, 'icon-192.png'), 192, 192],
    [brandBuf, path.join(PWA, 'icon-512.png'), 512, 512],
    [brandBuf, path.join(ROOT, 'icons', 'apple-touch-icon.png'), 180, 180],
    [maskableBuf, path.join(PWA, 'icon-maskable-192.png'), 192, 192],
    [maskableBuf, path.join(PWA, 'icon-maskable-512.png'), 512, 512],
    [brandBuf, path.join(PWA, '1024.png'), 1024, 1024],
    [screenshotWideSvg(), path.join(PWA, 'screenshot-wide.png'), 1280, 720],
    [screenshotNarrowSvg(), path.join(PWA, 'screenshot-narrow.png'), 407, 904],
    [socialBuf, path.join(PWA, 'social-card.png'), 1200, 630],
    [faviconBuf, path.join(ROOT, 'favicon.png'), 32, 32],
    [faviconBuf, path.join(ROOT, 'favicon-32.png'), 32, 32],
    [brandBuf, path.join(ROOT, 'icon-192.png'), 192, 192],
    [brandBuf, path.join(ROOT, 'icon-512.png'), 512, 512],
  ];

  for (const [source, out, w, h] of jobs) {
    if (typeof source === 'string' && source.trim().startsWith('<?xml')) {
      await sharp(Buffer.from(source)).resize(w, h).png().toFile(out);
    } else if (Buffer.isBuffer(source)) {
      await writePng(source, out, w, h);
    } else {
      await sharp(Buffer.from(source)).resize(w, h).png().toFile(out);
    }
    console.log('wrote', path.relative(ROOT, out));
  }
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});