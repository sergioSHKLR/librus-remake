#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ICONS = path.join(__dirname, '..', 'icons');
const S = '#000000';

function mono(name, body) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${S}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>\n`;
}

function monoFill(name, body) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="${S}">${body}</svg>\n`;
}

const icons = {
  'settings.svg': mono('settings', '<circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>'),
  'filter.svg': mono('filter', '<path d="M4 5h16l-6 7v6l-4 2v-8z"/>'),
  'books.svg': mono('books', '<path d="M5 4h7a2 2 0 012 2v14H7a2 2 0 01-2-2V4z"/><path d="M12 6h7a2 2 0 012 2v12h-9V6z"/>'),
  'toc.svg': mono('toc', '<path d="M4 6h16M4 12h16M4 18h10"/><path d="M18 16l2 2-2 2"/>'),
  'search.svg': mono('search', '<circle cx="11" cy="11" r="6"/><path d="M20 20l-3.5-3.5"/>'),
  'notes.svg': mono('notes', '<path d="M6 4h12v16l-4-3-4 3V4z"/><path d="M9 9h6M9 13h4"/>'),
  'up.svg': mono('up', '<path d="M12 6l-5 5h10z"/>'),
  'down.svg': mono('down', '<path d="M12 18l5-5H7z"/>'),
  'text-size.svg': mono('text-size', '<path d="M6 18V6l3 12M9 12H3"/><path d="M15 10h6M18 8v8"/>'),
  'share.svg': mono('share', '<path d="M14 4h6v6"/><path d="M10 14L20 4"/><path d="M18 12v6a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h6"/>'),
  'back.svg': mono('back', '<path d="M10 6L4 12l6 6"/><path d="M4 12h16"/>'),
  'refresh.svg': mono('refresh', '<path d="M20 7a8 8 0 10-1.4 4.7"/><path d="M20 7v-4h-4"/>'),
  'wiki.svg': mono('wiki', '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 3 4 6.5 4 9s-1.5 6-4 9"/><path d="M12 3c-2.5 3-4 6.5-4 9s1.5 6 4 9"/>'),
  'wikipedia.svg': mono('wiki', '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 3 4 6.5 4 9s-1.5 6-4 9"/><path d="M12 3c-2.5 3-4 6.5-4 9s1.5 6 4 9"/>'),
  'dict.svg': mono('dict', '<path d="M6 4h12v16H6z"/><path d="M9 8h6M9 12h6M9 16h4"/>'),
  'dictionary.svg': mono('dict', '<path d="M6 4h12v16H6z"/><path d="M9 8h6M9 12h6M9 16h4"/>'),
  'maps.svg': mono('maps', '<path d="M4 6l6-2 6 2 4-1v13l-6 2-6-2-4 1V6z"/><path d="M10 4v14M16 6v14"/>'),
  'map.svg': mono('maps', '<path d="M4 6l6-2 6 2 4-1v13l-6 2-6-2-4 1V6z"/><path d="M10 4v14M16 6v14"/>'),
  'hilite.svg': mono('hilite', '<path d="M4 18h16"/><path d="M8 14l8-8 2 2-8 8H8z"/>'),
  'save.svg': mono('save', '<path d="M6 4h12v16H6z"/><path d="M9 4v5h6V4"/><path d="M9 14h6"/>'),
  'close.svg': mono('close', '<path d="M6 6l12 12M18 6L6 18"/>'),
  'close-small.svg': mono('close', '<path d="M7 7l10 10M17 7L7 17"/>'),
  'delete.svg': mono('delete', '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M9 7V5h6v2"/><path d="M7 7l1 12h8l1-12"/>'),
  'expand.svg': mono('expand', '<path d="M8 10l4 4 4-4"/>'),
  'upload.svg': mono('upload', '<path d="M12 5v10"/><path d="M8 9l4-4 4 4"/><path d="M5 19h14"/>'),
  'device.svg': mono('device', '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>'),
  'online.svg': mono('online', '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>'),
  'offline.svg': mono('offline', '<circle cx="12" cy="12" r="9"/><path d="M8 8l8 8"/>'),
  'dropdown.svg': mono('dropdown', '<path d="M6 9l6 6 6-6"/>'),
  'write.svg': mono('write', '<path d="M4 18h4l9-9-4-4-9 9z"/><path d="M13 5l4 4"/>'),
  'quote.svg': mono('quote', '<path d="M8 10H5a2 2 0 01-2-2V6a2 2 0 012-2h3v6zM18 10h-3a2 2 0 01-2-2V6a2 2 0 012-2h3v6z"/>'),
  'reply.svg': mono('reply', '<path d="M10 8L4 14l6 6"/><path d="M4 14h10a6 6 0 016 6v1"/>'),
  'database-search.svg': mono('database-search', '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v4c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 10v4c0 1.7 3.1 3 7 3 1.2 0 2.3-.1 3.3-.4"/><circle cx="16" cy="17" r="3"/><path d="M18.5 19.5L21 22"/>'),
  'update.svg': mono('update', '<path d="M20 7a8 8 0 10-1.4 4.7"/><path d="M20 7v-4h-4"/>'),
  'github.svg': monoFill('github', '<path fill-rule="evenodd" d="M12 2C6.48 2 2 6.58 2 12.01c0 4.42 2.87 8.17 6.84 9.5.5.09.68-.22.68-.48 0-.24-.01-.87-.01-1.7-2.78.62-3.37-1.36-3.37-1.36-.45-1.17-1.12-1.48-1.12-1.48-.92-.64.07-.63.07-.63 1.02.08 1.55 1.06 1.55 1.06.9 1.56 2.36 1.11 2.94.85.09-.67.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.7 0 0 .84-.28 2.75 1.05A9.2 9.2 0 0112 6.8c.84 0 1.68.11 2.47.33 1.91-1.33 2.75-1.05 2.75-1.05.55 1.4.2 2.44.1 2.7.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.81-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .27.18.58.69.48A10.01 10.01 0 0022 12.01C22 6.58 17.52 2 12 2z"/>'),
};

const brandSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36" fill="none">
  <path d="M8 7h20v24H8z" fill="#f5f5f5" fill-opacity="0.1"/>
  <path d="M8 7c0-1.5 1.2-2.5 2.5-2.5h13c1.3 0 2.5 1 2.5 2.5v24c0 1.5-1.2 2.5-2.5 2.5h-13C9.2 33.5 8 32.5 8 31V7z" stroke="#f5f5f5" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M18 7v24" stroke="#d4a84b" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M12 13h8M12 18h10M12 23h7" stroke="#f5f5f5" stroke-width="1.2" stroke-linecap="round" opacity="0.9"/>
</svg>
`;

for (const [file, svg] of Object.entries(icons)) {
  fs.writeFileSync(path.join(ICONS, file), svg);
}
fs.writeFileSync(path.join(ICONS, 'brand.svg'), brandSvg);

// Legacy aliases → unified mono set
['search-green.svg', 'search-blue.svg', 'search-yellow.svg', 'share-green.svg', 'share-blue.svg', 'share-yellow.svg'].forEach(function (alias) {
  const src = alias.indexOf('search') === 0 ? 'search.svg' : 'share.svg';
  fs.copyFileSync(path.join(ICONS, src), path.join(ICONS, alias));
});

console.log('wrote', Object.keys(icons).length + 1, 'icons');