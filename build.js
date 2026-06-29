// build.js - Auto-friendly MD → Manifest for Librus / Doutrina
// V32 - Preserves emojis, frontmatter, and large files
const fs = require('fs');
const path = require('path');

const BOOKS_DIR = 'books';
const MANIFEST_PATH = path.join(BOOKS_DIR, 'manifest.json');

// Optional: copy from md/ to books/ if you keep source there
const MD_SOURCE_DIR = 'md';

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function extractTitleAndMeta(content) {
  let title = 'Untitled Book';
  let meta = {};

  // Frontmatter
  const fm = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (fm) {
    fm[1].split('\n').forEach(line => {
      const colon = line.indexOf(':');
      if (colon > 0) {
        const key = line.slice(0, colon).trim().toLowerCase();
        let val = line.slice(colon + 1).trim().replace(/^["']|["']$/g, '');
        meta[key] = val;
        if (key === 'title') title = val;
      }
    });
  }

  // Fallback to first H1
  if (title === 'Untitled Book') {
    const h1 = content.match(/^#\s+(.+)$/m);
    if (h1) title = h1[1].trim();
  }

  return { title, meta };
}

// Auto-copy from md/ to books/ (uncomment if you use md/ as source)
if (fs.existsSync(MD_SOURCE_DIR)) {
  ensureDir(BOOKS_DIR);
  fs.readdirSync(MD_SOURCE_DIR).forEach(file => {
    if (file.endsWith('.md')) {
      const src = path.join(MD_SOURCE_DIR, file);
      const dest = path.join(BOOKS_DIR, file);
      fs.copyFileSync(src, dest);
      console.log(`Copied: ${file}`);
    }
  });
}

// Build Manifest
const files = fs.readdirSync(BOOKS_DIR)
  .filter(f => f.endsWith('.md'))
  .sort();

const manifest = {
  files: files,
  entries: {}
};

files.forEach((filename, index) => {
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
console.log(`   Manifest: ${MANIFEST_PATH}`);
console.log(`   Ready for deployment.`);