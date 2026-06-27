// build.js - Auto-friendly MD → Manifest for Librus
const fs = require('fs');
const path = require('path');

const BOOKS_DIR = 'books';
const MANIFEST_PATH = path.join(BOOKS_DIR, 'manifest.json');

function extractTitleAndMeta(content) {
  let title = 'Untitled Book';
  let meta = {};

  const fm = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (fm) {
    fm[1].split('\n').forEach(line => {
      const colon = line.indexOf(':');
      if (colon > 0) {
        const key = line.slice(0, colon).trim().toLowerCase();
        const val = line.slice(colon + 1).trim().replace(/^["']|["']$/g, '');
        meta[key] = val;
        if (key === 'title') title = val;
      }
    });
  }
  if (title === 'Untitled Book') {
    const h1 = content.match(/^#\s+(.+)$/m);
    if (h1) title = h1[1].trim();
  }
  return { title, meta };
}

// Build Manifest
const files = fs.readdirSync(BOOKS_DIR)
  .filter(f => f.endsWith('.md'))
  .sort();

const manifest = {
  files: files,
  entries: {}
};

files.forEach(filename => {
  const content = fs.readFileSync(path.join(BOOKS_DIR, filename), 'utf8');
  const { title, meta } = extractTitleAndMeta(content);

  manifest.entries[filename] = {
    title: title,
    author: meta.author || 'Kardec / Doutrina',
    order: parseInt(meta.order || meta.chronology) || null,
    lang: meta.lang || 'pt'
  };
});

fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

console.log(`✅ Auto-built manifest with ${files.length} books.`);
console.log(`   Ready for https://sergioshklr.github.io/librus-remake/`);