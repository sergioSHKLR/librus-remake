#!/usr/bin/env node
/* Publish prod → gh-pages root, dev → gh-pages/dev/ */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const WORKTREE = path.join(ROOT, '.gh-pages-work');
const REPO_BASE = '/librus-remake/';
const DEV_BASE = '/librus-remake/dev/';

const DEPLOY_EXCLUDE = new Set([
  'node_modules',
  '.git',
  '.gh-pages-work',
  'md',
  'scrap.txt',
  'package.json',
  'package-lock.json',
  'README,md',
  'scripts',
  'git',
]);

const DEPLOY_EXCLUDE_FILE = /\.md$/i;

function run(cmd, opts) {
  console.log('$', cmd);
  execSync(cmd, { stdio: 'inherit', cwd: opts && opts.cwd ? opts.cwd : ROOT });
}

function shouldSkip(relPath) {
  const parts = relPath.split(path.sep);
  if (parts.some(function (p) { return DEPLOY_EXCLUDE.has(p); })) return true;
  if (DEPLOY_EXCLUDE_FILE.test(relPath)) return true;
  return false;
}

function copyRecursive(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  fs.readdirSync(srcDir, { withFileTypes: true }).forEach(function (entry) {
    const src = path.join(srcDir, entry.name);
    const rel = path.relative(ROOT, src);
    if (shouldSkip(rel)) return;
    const dest = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(src, dest);
    } else if (entry.isFile()) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    }
  });
}

function clearDir(dir) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(function (name) {
    if (name === 'dev' && dir === WORKTREE) return;
    if (name === '.git') return;
    const target = path.join(dir, name);
    fs.rmSync(target, { recursive: true, force: true });
  });
}

function injectBaseHref(indexPath, baseHref) {
  if (!fs.existsSync(indexPath)) return;
  let html = fs.readFileSync(indexPath, 'utf8');
  html = html.replace(/\s*<meta name="librus-base"[^>]*>\s*/i, '\n');
  const tag = '  <meta name="librus-base" content="' + baseHref + '">\n';
  html = html.replace(/<head>/i, '<head>\n' + tag);
  fs.writeFileSync(indexPath, html);
}

function stageSite(targetDir, baseHref) {
  clearDir(targetDir);
  copyRecursive(ROOT, targetDir);
  fs.writeFileSync(path.join(targetDir, '.nojekyll'), '\n');
  injectBaseHref(path.join(targetDir, 'index.html'), baseHref);
}

function ensureGhPagesWorktree() {
  if (fs.existsSync(path.join(WORKTREE, '.git'))) {
    run('git fetch origin gh-pages', { cwd: WORKTREE });
    run('git reset --hard origin/gh-pages', { cwd: WORKTREE });
    return;
  }
  if (fs.existsSync(WORKTREE)) {
    fs.rmSync(WORKTREE, { recursive: true, force: true });
  }
  run('git worktree prune');
  run('git fetch origin gh-pages');
  run('git worktree add --detach "' + WORKTREE + '" origin/gh-pages');
}

function readBuildId() {
  try {
    const pwa = fs.readFileSync(path.join(ROOT, 'pwa/pwa.js'), 'utf8');
    const m = pwa.match(/BUILD_ID\s*=\s*'([^']+)'/);
    return m ? m[1] : 'v32-r21';
  } catch (e) {
    return 'v32-r21';
  }
}

function main() {
  run('node build.js');
  run('npm run assets');
  ensureGhPagesWorktree();

  const prodDir = WORKTREE;
  const devDir = path.join(WORKTREE, 'dev');

  stageSite(prodDir, REPO_BASE);
  fs.mkdirSync(devDir, { recursive: true });
  clearDir(devDir);
  copyRecursive(ROOT, devDir);
  fs.writeFileSync(path.join(devDir, '.nojekyll'), '\n');
  injectBaseHref(path.join(devDir, 'index.html'), DEV_BASE);

  const buildId = readBuildId();
  const worktreeGit = path.join(WORKTREE, '.git');
  if (!fs.existsSync(worktreeGit)) {
    throw new Error('gh-pages worktree .git pointer missing at ' + worktreeGit);
  }
  run('git add -A', { cwd: WORKTREE });
  try {
    run('git commit -m "deploy ' + buildId + ': prod root + dev subpath"', { cwd: WORKTREE });
  } catch (e) {
    console.log('Nothing to commit on gh-pages (already up to date).');
  }

  console.log('\nDeploy staged in .gh-pages-work');
  console.log('  prod → ' + REPO_BASE);
  console.log('  dev  → ' + DEV_BASE);
  console.log('Push: git -C .gh-pages-work push origin HEAD:gh-pages');
}

main();