#!/usr/bin/env node
/* Build Lucide icon sprite + standalone SVGs used in cached book HTML. */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ICONS = path.join(ROOT, 'icons');
const LUCIDE = path.join(ROOT, 'node_modules', 'lucide-static', 'icons');

const SPRITE_ICONS = [
  'columns-4',
  'settings',
  'list-filter',
  'library',
  'list',
  'search',
  'sticky-note',
  'chevron-up',
  'chevron-down',
  'type',
  'share',
  'arrow-left',
  'refresh-cw',
  'globe',
  'book-a',
  'map',
  'highlighter',
  'save',
  'x',
  'trash-2',
  'upload',
  'smartphone',
  'wifi',
  'wifi-off',
  'quote',
  'reply',
];

const STANDALONE_ALIASES = {
  'expand.svg': 'chevron-down',
  'filter.svg': 'list-filter',
  'books.svg': 'library',
  'toc.svg': 'list',
  'notes.svg': 'sticky-note',
  'up.svg': 'chevron-up',
  'down.svg': 'chevron-down',
  'text-size.svg': 'type',
  'back.svg': 'arrow-left',
  'refresh.svg': 'refresh-cw',
  'wiki.svg': 'globe',
  'wikipedia.svg': 'globe',
  'dict.svg': 'book-a',
  'dictionary.svg': 'book-a',
  'maps.svg': 'map',
  'map.svg': 'map',
  'hilite.svg': 'highlighter',
  'close.svg': 'x',
  'close-small.svg': 'x',
  'delete.svg': 'trash-2',
  'device.svg': 'smartphone',
  'online.svg': 'wifi',
  'offline.svg': 'wifi-off',
  'brand.svg': 'columns-4',
};

const GITHUB_SYMBOL = '<path fill="currentColor" fill-rule="evenodd" d="M12 2C6.48 2 2 6.58 2 12.01c0 4.42 2.87 8.17 6.84 9.5.5.09.68-.22.68-.48 0-.24-.01-.87-.01-1.7-2.78.62-3.37-1.36-3.37-1.36-.45-1.17-1.12-1.48-1.12-1.48-.92-.64.07-.63.07-.63 1.02.08 1.55 1.06 1.55 1.06.9 1.56 2.36 1.11 2.94.85.09-.67.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.7 0 0 .84-.28 2.75 1.05A9.2 9.2 0 0112 6.8c.84 0 1.68.11 2.47.33 1.91-1.33 2.75-1.05 2.75-1.05.55 1.4.2 2.44.1 2.7.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.81-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .27.18.58.69.48A10.01 10.01 0 0022 12.01C22 6.58 17.52 2 12 2z"/>';

function readLucideInner(name) {
  const file = path.join(LUCIDE, name + '.svg');
  if (!fs.existsSync(file)) {
    throw new Error('Missing Lucide icon: ' + name);
  }
  const raw = fs.readFileSync(file, 'utf8');
  const match = raw.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
  if (!match) throw new Error('Could not parse Lucide icon: ' + name);
  return match[1].trim();
}

function standaloneSvg(inner) {
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    inner +
    '</svg>\n';
}

const STROKE_ATTRS = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

function buildSprite() {
  const symbols = SPRITE_ICONS.map(function (name) {
    return '<symbol id="' + name + '" viewBox="0 0 24 24" ' + STROKE_ATTRS + '>' + readLucideInner(name) + '</symbol>';
  });
  symbols.push('<symbol id="github" viewBox="0 0 24 24">' + GITHUB_SYMBOL + '</symbol>');

  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="display:none">' +
    symbols.join('') +
    '</svg>\n';
}

fs.mkdirSync(ICONS, { recursive: true });
fs.writeFileSync(path.join(ICONS, 'sprite.svg'), buildSprite());

Object.entries(STANDALONE_ALIASES).forEach(function ([file, lucideName]) {
  fs.writeFileSync(path.join(ICONS, file), standaloneSvg(readLucideInner(lucideName)));
});

fs.writeFileSync(
  path.join(ICONS, 'github.svg'),
  '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">' +
    GITHUB_SYMBOL +
    '</svg>\n'
);

console.log('wrote sprite with', SPRITE_ICONS.length + 1, 'symbols and', Object.keys(STANDALONE_ALIASES).length + 1, 'standalone SVGs');