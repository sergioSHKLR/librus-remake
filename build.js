// build.js — MD → HTML fragments + TOC JSON + manifest (nano-SSG)
const fs = require('fs');
const path = require('path');
const {
  markdownToHtml,
  parseFrontmatter,
  sanitizeDisplayTitle,
  htmlPathFromMdFilename,
  tocPathFromMdFilename
} = require('./js/markdown-to-html.js');

const BOOKS_DIR = 'books';
const MANIFEST_PATH = path.join(BOOKS_DIR, 'manifest.json');
const MD_SOURCE_DIR = 'md';

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function extractTitleAndMeta(content) {
  const parsed = parseFrontmatter(content);
  let title = 'Untitled Book';
  const meta = parsed.meta || {};

  if (meta.title) {
    title = sanitizeDisplayTitle(meta.title);
  } else {
    const h1 = parsed.body.match(/^#\s+(.+)$/m);
    if (h1) title = sanitizeDisplayTitle(h1[1].trim());
  }

  return { title, meta, body: parsed.body };
}

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

const files = fs.readdirSync(BOOKS_DIR)
  .filter(f => f.endsWith('.md'))
  .sort();

const manifest = {
  builtAt: new Date().toISOString(),
  files: files,
  entries: {}
};

let built = 0;

files.forEach((filename) => {
  const mdPath = path.join(BOOKS_DIR, filename);
  const content = fs.readFileSync(mdPath, 'utf8');
  const { title, meta, body } = extractTitleAndMeta(content);
  const rendered = markdownToHtml(body);

  const htmlName = htmlPathFromMdFilename(filename);
  const tocName = tocPathFromMdFilename(filename);

  fs.writeFileSync(path.join(BOOKS_DIR, htmlName), rendered.html, 'utf8');
  fs.writeFileSync(path.join(BOOKS_DIR, tocName), JSON.stringify(rendered.toc, null, 2), 'utf8');

  manifest.entries[filename] = {
    title: title,
    author: meta.author || 'Kardec / Doutrina',
    order: parseInt(meta.order || meta.chronology, 10) || null,
    lang: meta.lang || 'pt',
    html: htmlName,
    toc: tocName
  };

  built++;
  console.log(`  ${filename} → ${htmlName} (${rendered.toc.length} toc entries)`);
});

fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

console.log(`\n✅ Built ${built} books (HTML + TOC JSON)`);
console.log(`   Manifest: ${MANIFEST_PATH}`);