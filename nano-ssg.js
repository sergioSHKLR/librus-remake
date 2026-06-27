// nano-ssg.js - Librus Nano-SSG (title deduplication + cleaner output)
const fs = require('fs');
const path = require('path');

const INPUT_DIR = 'md';
const OUTPUT_DIR = 'books';

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function mdToBook(md) {
  let title = 'Untitled Book';
  let body = md
    // Extract frontmatter
    .replace(/^---\s*\n([\s\S]*?)\n---\s*\n/, (match, fm) => {
      const t = fm.match(/title:\s*(.+)/i);
      if (t) title = t[1].trim();
      return '';
    });

  // Remove the first H1 if it matches the title (prevents doubling)
  body = body.replace(new RegExp(`^#\\s+${title.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\s*$`, 'm'), '');

  // Process remaining content
  body = body
    .trim()
    .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
    .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Paragraphs
  body = body
    .split(/\n{2,}/)
    .map(block => {
      if (block.match(/^<h[2-3]>/) || !block.trim()) return block;
      return `<p>${block.replace(/\n/g, ' ')}</p>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: Georgia, serif;
      line-height: 1.8;
      max-width: 720px;
      margin: 40px auto;
      padding: 20px;
      color: #222;
      background: #fff;
    }
    @media (prefers-color-scheme: dark) {
      body { background: #111; color: #ddd; }
    }
    h1, h2 { text-align: center; margin: 2.5em 0 1.5em; }
    .book-header { margin-bottom: 4em; padding-bottom: 2em; border-bottom: 1px solid #ccc; text-align: center; }
    p { margin: 1.4em 0; }
    em { font-style: italic; }
    strong { font-weight: bold; }
  </style>
</head>
<body>
  <div class="book-header">
    <h1>${title}</h1>
  </div>
  <div class="book-content">
    ${body}
  </div>
</body>
</html>`;
}

// Build
const mdFiles = fs.readdirSync(INPUT_DIR).filter(f => f.endsWith('.md'));

mdFiles.forEach(file => {
  const md = fs.readFileSync(path.join(INPUT_DIR, file), 'utf8');
  const html = mdToBook(md);
  const outFile = path.join(OUTPUT_DIR, file.replace('.md', '.html'));
  fs.writeFileSync(outFile, html);
  console.log(`Built: ${outFile}`);
});

console.log('\n✅ Done.');