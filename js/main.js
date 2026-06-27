// =========================================================================
// V31-260617s/a | SECTION 01: CONSTANTS
// STORAGE KEYS, MANIFEST PATH, DEFAULT PROVIDERS
// =========================================================================
const SESSION_STORAGE_KEY = 'librus_v31_session';
const TAB_SESSION_KEY = 'librus_v31_tab_active';
const SETTINGS_STORAGE_KEY = 'librus_v31_settings';
const UPLOADS_STORAGE_KEY = 'librus_v31_uploads';
const MANIFEST_URL = 'books/manifest.json';
const BOOKS_BASE = 'books/';
/* Dev ships the full manifest (60 books). Prod uses an empty manifest. No partial fallback. */
const BUNDLED_MANIFEST_FILES = [];
const SCROLL_THRESHOLD = 6;
const SCROLL_HIDE_OFFSET = 40;
const READER_FONT_SCALE_CYCLE = [0.8125, 0.875, 0.9375, 1, 1.0625, 1.125, 1.1875, 1.25];
const READER_FONT_SCALE_MIN = READER_FONT_SCALE_CYCLE[0];
const READER_FONT_SCALE_MAX = READER_FONT_SCALE_CYCLE[READER_FONT_SCALE_CYCLE.length - 1];
const LIBRUS_SITE_URL = 'https://librus.app';
const LIBRUS_SHARE_ATTRIBUTION = 'Shared from ' + LIBRUS_SITE_URL;
const CONTEXT_PLACEHOLDER_URL = 'context-placeholder.html';

const DEFAULT_PROVIDERS = {
 wiki: 'https://en.wikipedia.org/w/index.php?search={query}',
 dictionary: 'https://en.wiktionary.org/w/index.php?search={query}',
 map: 'map.html?q={query}'
};

const LEGACY_PROVIDER_URLS = {
 wiki: [
  'https://pt.wikipedia.org',
  'https://pt.wikipedia.org/w/index.php?search={query}'
 ],
 dictionary: [
  'https://pt.wikipedia.org/wiki/Dicion%C3%A1rio',
  'https://pt.wikipedia.org/wiki/Dicionário',
  'https://pt.wiktionary.org/w/index.php?search={query}'
 ]
};

const DEFAULT_SETTINGS = {
 theme: 'system',
 hiddenIds: [],
 providers: { ...DEFAULT_PROVIDERS },
 readerFontScale: 1
};

let defaultReaderHtml = '';

// =========================================================================
// V31-260617s/a | SECTION 02: STATE VARIABLES
// MUTABLE RUNTIME STATE — NO DOM BINDINGS IN THIS BLOCK
// =========================================================================
let books = [];
let uploads = [];
let settings = loadSettingsFromStorage();
let lastOpenedBookId = null;
let scrollTops = new WeakMap();
let searchHits = [];
let currentMatchIndex = -1;
let totalMatchCount = 0;
let contextNavigationDepth = 0;
let isInternalBackNavigation = false;
let contextArticleUrl = '';
let contextLastProviderKey = 'wiki';
const CONTEXT_PROVIDER_LABELS = {
 wiki: 'Encyclopaedia',
 dictionary: 'Dictionary',
 map: 'Map'
};
const CONTEXT_PROVIDER_ICONS = {
 wiki: '\uF106',
 dictionary: '\uF385',
 map: '\uF3CA'
};
let contextReloadUrl = '';
let contextLoadPreviousUrl = '';
let contextLoadingActive = false;
let contextLoadingStartedAt = 0;
let contextLoadingSlowTimer = null;
let contextLoadingTimeoutTimer = null;
let contextLoadingElapsedTimer = null;
const CONTEXT_LOAD_SLOW_MS = 3000;
const CONTEXT_LOAD_TIMEOUT_MS = 20000;
let libraryFilterQuery = '';
let currentBookToc = [];
let tocFilterQuery = '';
let tocScrollRaf = 0;
let lastTocActiveId = '';
const bookRenderCache = new Map();
let readerHeadingIndex = [];
let readerHeadingIndexRaf = 0;

function getTocList() {
 return document.getElementById('reader-toc-list');
}
let lastLookupSelection = '';
let lastNotesSelectionQuote = null;
let lastNotesSectionId = '';
let currentBookAnnotations = [];
let notesReplyParentId = null;
let notesFilterQuery = '';
const NOTES_COMPOSE_PLACEHOLDER = 'Select text, then save as Highlight OR Write note';
const NOTES_COMPOSE_WITH_QUOTE_PLACEHOLDER = 'Select text, then save as Note';
const NOTES_REPLY_PLACEHOLDER = 'Reply to selected note…';
const NOTES_EMPTY_DEFAULT = 'No notes for this book yet.';
const NOTES_EMPTY_FILTERED = 'No notes match this filter.';

// =========================================================================
// V31-260617s/a | SECTION 03: SETTINGS PERSISTENCE
// LOAD / SAVE USER PREFERENCES AND PROVIDERS
// =========================================================================
function migrateProviderTemplates(providers) {
 var merged = Object.assign({}, DEFAULT_PROVIDERS, providers || {});
 if (LEGACY_PROVIDER_URLS.wiki.indexOf(merged.wiki) !== -1) {
  merged.wiki = DEFAULT_PROVIDERS.wiki;
 }
 if (LEGACY_PROVIDER_URLS.dictionary.indexOf(merged.dictionary) !== -1) {
  merged.dictionary = DEFAULT_PROVIDERS.dictionary;
 }
 if (merged.wiki.indexOf('{query}') === -1) {
  merged.wiki = DEFAULT_PROVIDERS.wiki;
 }
 if (merged.dictionary.indexOf('{query}') === -1) {
  merged.dictionary = DEFAULT_PROVIDERS.dictionary;
 }
 if (!merged.map || !merged.map.trim() || merged.map.indexOf('{query}') === -1) {
  merged.map = DEFAULT_PROVIDERS.map;
 }
 delete merged.search;
 return merged;
}

function loadSettingsFromStorage() {
 try {
  const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (!raw) return structuredClone(DEFAULT_SETTINGS);
  const data = JSON.parse(raw);
  var scale = Number(data.readerFontScale);
  return {
   theme: data.theme || 'system',
   hiddenIds: Array.isArray(data.hiddenIds) ? data.hiddenIds : [],
   providers: migrateProviderTemplates(data.providers),
   readerFontScale: scale >= READER_FONT_SCALE_MIN && scale <= READER_FONT_SCALE_MAX
    ? scale : DEFAULT_SETTINGS.readerFontScale
  };
 } catch (e) {
  return structuredClone(DEFAULT_SETTINGS);
 }
}

function saveSettings() {
 localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

function isBookHidden(bookId) {
 return settings.hiddenIds.indexOf(bookId) !== -1;
}

function hideBook(bookId) {
 if (!isBookHidden(bookId)) settings.hiddenIds.push(bookId);
 saveSettings();
 renderHiddenBooksList();
 renderLibraryGrid();
}

function restoreHiddenBook(bookId) {
 settings.hiddenIds = settings.hiddenIds.filter(function (id) { return id !== bookId; });
 saveSettings();
 renderHiddenBooksList();
 renderLibraryGrid();
}

// =========================================================================
// V31-260617s/i | SECTION 04: READER FONT SCALE
// A+/A- — BOOK CONTENT ONLY, PERSISTED IN SETTINGS
// =========================================================================
function nearestReaderFontScaleIndex(scale) {
 var best = 0;
 var bestDiff = Math.abs(READER_FONT_SCALE_CYCLE[0] - scale);
 for (var i = 1; i < READER_FONT_SCALE_CYCLE.length; i++) {
  var diff = Math.abs(READER_FONT_SCALE_CYCLE[i] - scale);
  if (diff < bestDiff) {
   best = i;
   bestDiff = diff;
  }
 }
 return best;
}

function clampReaderFontScale(scale) {
 return READER_FONT_SCALE_CYCLE[nearestReaderFontScaleIndex(scale)];
}

function readerFontScalePercent(scale) {
 return Math.round(scale * 100) + '%';
}

function updateReaderFontScaleButtonLabel() {
 var btn = document.getElementById('reader-font-cycle-btn');
 if (!btn) return;
 var pct = readerFontScalePercent(settings.readerFontScale);
 var tip = 'Text size: ' + pct + '. Tap to cycle.';
 btn.title = tip;
 btn.setAttribute('aria-label', tip);
}

function applyReaderFontScale() {
 var viewport = document.getElementById('main-text-viewport');
 if (!viewport) return;
 settings.readerFontScale = clampReaderFontScale(settings.readerFontScale);
 viewport.style.setProperty('--reader-font-scale', String(settings.readerFontScale));
 updateReaderFontScaleButtonLabel();
}

function cycleReaderFontScale() {
 var idx = nearestReaderFontScaleIndex(settings.readerFontScale);
 var nextIdx = (idx + 1) % READER_FONT_SCALE_CYCLE.length;
 settings.readerFontScale = READER_FONT_SCALE_CYCLE[nextIdx];
 applyReaderFontScale();
 saveSettings();
 scheduleReaderHeadingIndexRebuild();
}

// =========================================================================
// V31-260617s/a | SECTION 05: THEME CONTROLLER
// =========================================================================
function resolvedAppTheme() {
 var theme = settings.theme || 'system';
 if (theme === 'system') {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
 }
 return theme;
}

function contextPlaceholderUrl() {
 return CONTEXT_PLACEHOLDER_URL
  + '?theme=' + encodeURIComponent(resolvedAppTheme())
  + '&online=' + (navigator.onLine ? '1' : '0');
}

function syncContextPlaceholderConnectivity() {
 var frame = document.getElementById('context-viewport');
 if (!frame || !isContextPlaceholderUrl(frame.src || '')) return;
 try {
  if (frame.contentWindow) {
   frame.contentWindow.postMessage({
    type: 'librus:connectivity',
    online: navigator.onLine
   }, window.location.origin);
  }
 } catch (e) { /* cross-origin or not ready */ }
}

function syncFaviconForTheme() {
 var theme = resolvedAppTheme();
 var href = theme === 'dark' ? 'icons/favicon-dark.svg' : 'icons/favicon-light.svg';
 document.querySelectorAll('link[rel="icon"][type="image/svg+xml"]').forEach(function (link) {
  link.href = href;
 });
}

function changeTheme(themeValue, skipPersist) {
 document.body.className = '';
 document.body.classList.add('theme--' + themeValue);
 settings.theme = themeValue;
 var sel = document.getElementById('settings-theme-selector');
 if (sel) sel.value = themeValue;
 syncFaviconForTheme();
 var frame = document.getElementById('context-viewport');
 if (frame && isContextPlaceholderUrl(frame.src || '')) {
  frame.src = contextPlaceholderUrl();
 }
 if (!skipPersist) {
  saveSettings();
  persistSession();
 }
}

// =========================================================================
// V31-260617s/a | SECTION 06: VIEW ROUTER
// =========================================================================
function isMobileReaderLayout() {
 return window.matchMedia('(max-width: 48rem)').matches;
}

function isReaderOverlayLayout() {
 return window.matchMedia('(max-width: 75rem)').matches;
}

function resetReaderChromeState() {
 var readerContainer = document.getElementById('reader-container');
 if (!readerContainer) return;
 readerContainer.classList.remove('is-topbar-hidden');
}

function switchView(viewId) {
 document.getElementById('library').classList.add('is-hidden');
 document.getElementById('reader').classList.add('is-hidden');
 document.getElementById(viewId).classList.remove('is-hidden');
 if (viewId === 'library') syncBookShareHash(null);

 closeLibrarySettings();
 closeAllReaderOverlays();
 resetReaderChromeState();
 updateReaderShareButtonState();
}

// =========================================================================
// V31-260617s/q | SECTION 07: LIBRARY SETTINGS PANEL
// =========================================================================
function syncSettingsOverlayChrome() {
 var panel = document.getElementById('library-settings');
 var backdrop = document.getElementById('settings-overlay-backdrop');
 var app = document.getElementById('librus-app');
 var open = panel && !panel.classList.contains('is-hidden') && panel.classList.contains('is-overlay');
 var overlayLayout = isReaderOverlayLayout();
 if (app) app.classList.toggle('has-settings-overlay', !!open && overlayLayout);
 if (backdrop) backdrop.classList.toggle('is-hidden', !(open && overlayLayout));
}

function isLibrarySettingsOpen() {
 var panel = document.getElementById('library-settings');
 return !!(panel && !panel.classList.contains('is-hidden'));
}

function openLibrarySettings() {
 closeAllReaderOverlays();
 document.getElementById('library-settings').classList.remove('is-hidden');
 document.getElementById('library-settings').classList.add('is-overlay');
 syncSettingsForm();
 syncSettingsBuildLabel();
 renderAppUpdateStatus();
 renderHiddenBooksList();
 syncSettingsOverlayChrome();
}

function toggleLibrarySettings() {
 if (isLibrarySettingsOpen()) closeLibrarySettings();
 else openLibrarySettings();
}

function closeLibrarySettings() {
 var panel = document.getElementById('library-settings');
 if (!panel) return;
 panel.classList.add('is-hidden');
 panel.classList.remove('is-overlay');
 syncSettingsOverlayChrome();
}

function handleSettingsOverlayClickOut(event) {
 if (!isLibrarySettingsOpen()) return;
 var panel = document.getElementById('library-settings');
 if (!panel || !panel.classList.contains('is-overlay')) return;
 if (panel.contains(event.target)) return;
 if (event.target.closest('#library-settings-btn, #read-settings-btn')) return;
 if (event.target.closest('.settings-overlay-backdrop')) return;
 if (!isReaderOverlayLayout()) return;
 closeLibrarySettings();
}

function syncBrandVersion() {
 var pwa = window.LibrusPwa;
 if (!pwa) return;
 var brandText = pwa.appName || 'LIBRUS';
 var brandEl = document.querySelector('.library-topbar-brand-title');
 if (brandEl) brandEl.textContent = brandText;
 document.title = brandText;
}

function syncSettingsBuildLabel() {
 var label = document.getElementById('settings-build-label');
 var buildWrap = document.getElementById('settings-build-id');
 if (!label || !buildWrap) return;
 var pwa = window.LibrusPwa;
 var versionLabel = pwa && pwa.versionLabel ? pwa.versionLabel : '—';
 var deployId = pwa && pwa.buildId ? pwa.buildId : '—';
 label.textContent = versionLabel;
 buildWrap.title = 'Deployed version ' + versionLabel + ' (deploy ' + deployId + ')';
}

function syncSettingsForm() {
 document.getElementById('settings-theme-selector').value = settings.theme;
 document.getElementById('settings-provider-wiki').value = settings.providers.wiki;
 document.getElementById('settings-provider-dictionary').value = settings.providers.dictionary;
 document.getElementById('settings-provider-map').value = settings.providers.map || '';
}

function applySettingsFromForm() {
 settings.providers.wiki = document.getElementById('settings-provider-wiki').value.trim() || DEFAULT_PROVIDERS.wiki;
 settings.providers.dictionary = document.getElementById('settings-provider-dictionary').value.trim() || DEFAULT_PROVIDERS.dictionary;
 settings.providers.map = document.getElementById('settings-provider-map').value.trim();
 delete settings.providers.search;
 saveSettings();
 updateContextLookupControls();
}

function renderHiddenBooksList() {
 var list = document.getElementById('settings-hidden-list');
 var empty = document.getElementById('settings-hidden-empty');
 list.innerHTML = '';
 if (!settings.hiddenIds.length) {
  empty.classList.remove('is-hidden');
  return;
 }
 empty.classList.add('is-hidden');
 settings.hiddenIds.forEach(function (id) {
  var book = findBookById(id);
  var li = document.createElement('li');
  li.className = 'library-settings-hidden-item';
  var label = document.createElement('span');
  label.textContent = book ? book.title : id;
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-wide library-settings-restore-btn';
  btn.textContent = 'Restore';
  btn.addEventListener('click', function () { restoreHiddenBook(id); });
  li.appendChild(label);
  li.appendChild(btn);
  list.appendChild(li);
 });
}

// =========================================================================
// V31-260617s/a | SECTION 08: OFF-LOAD ACTIONS
// EXPORT CATALOG / SESSION, CLEAR LOCAL CACHE
// =========================================================================
function downloadJson(filename, data) {
 var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
 var url = URL.createObjectURL(blob);
 var a = document.createElement('a');
 a.href = url;
 a.download = filename;
 a.click();
 URL.revokeObjectURL(url);
}

function exportCatalog() {
 downloadJson('librus-catalog.json', {
  exported: new Date().toISOString(),
  books: books.map(function (b) {
   return { id: b.id, title: b.title, author: b.author, source: b.source, path: b.path || null };
  }),
  hiddenIds: settings.hiddenIds
 });
}

function exportSessionSnapshot() {
 downloadJson('librus-session.json', {
  exported: new Date().toISOString(),
  lastOpenedBookId: lastOpenedBookId,
  settings: settings,
  uploads: uploads.map(function (u) { return { id: u.id, title: u.title, author: u.author }; })
 });
}

function clearLocalCache() {
 if (!confirm('Clear all local cache? Hidden books, uploads, session, and offline files will be reset.')) return;
 var pwaClear = window.LibrusPwa
  ? Promise.all([window.LibrusPwa.clearCaches(), window.LibrusPwa.unregister()])
  : Promise.resolve();
 pwaClear.finally(function () {
  localStorage.removeItem(SESSION_STORAGE_KEY);
  localStorage.removeItem(UPLOADS_STORAGE_KEY);
  localStorage.removeItem(SETTINGS_STORAGE_KEY);
  settings = structuredClone(DEFAULT_SETTINGS);
  uploads = [];
  lastOpenedBookId = null;
  saveSettings();
  loadUploadsFromStorage();
  initLibrary().then(function () {
   changeTheme('system', true);
   switchView('library');
  });
 });
}

// =========================================================================
// V31-260617s/t | SECTION 09: MANIFEST SCAN & BOOK IMPORT
// FETCH books/manifest.json AND LOAD ALL LOCAL MD FILES
// =========================================================================
let manifestEntries = {};
let manifestFileOrder = [];
function slugFromFilename(filename) {
 return filename.replace(/\.md$/i, '');
}

function titleFromSlug(slug) {
 return slug.replace(/^adv_\d+_/, '').replace(/_/g, ' ').replace(/\b\w/g, function (c) {
  return c.toUpperCase();
 });
}

function sanitizeDisplayTitle(raw) {
 if (!raw) return '';
 return String(raw)
  .replace(/\s*\{#[^}]+\}/g, '')
  .replace(/\*\*([^*]+)\*\*/g, '$1')
  .replace(/\*([^*]+)\*/g, '$1')
  .replace(/__([^_]+)__/g, '$1')
  .replace(/_([^_]+)_/g, '$1')
  .replace(/`([^`]+)`/g, '$1')
  .replace(/^\s*#+\s*/, '')
  .replace(/^[\s\p{Extended_Pictographic}\uFE0F]+/u, '')
  .replace(/\s+/g, ' ')
  .trim();
}

function normalizeFrontmatterKey(raw) {
 return String(raw || '').toLowerCase().replace(/-/g, '_');
}

function unquoteFrontmatterValue(raw) {
 var val = String(raw || '').trim();
 if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
  return val.slice(1, -1);
 }
 return val;
}

function parseFrontmatter(text) {
 var match = String(text || '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
 if (!match) return { meta: {}, body: text };
 var meta = {};
 match[1].split(/\r?\n/).forEach(function (line) {
  line = line.trim();
  if (!line || line.charAt(0) === '#') return;
  var kv = line.match(/^([A-Za-z0-9_-]+):\s*(.+)$/);
  if (!kv) return;
  meta[normalizeFrontmatterKey(kv[1])] = unquoteFrontmatterValue(kv[2]);
 });
 return { meta: meta, body: text.slice(match[0].length) };
}

function isValidCssColor(value) {
 if (!value) return false;
 return /^(?:#[0-9a-f]{3,8}|hsl[a]?\([^)]+\)|rgb[a]?\([^)]+\))$/i.test(value.trim());
}

function coverStyleFromFrontmatter(meta) {
 var bg = meta.cover_bg || meta.coverbg || '';
 var fg = meta.cover_fg || meta.coverfg || '';
 bg = isValidCssColor(bg) ? bg.trim() : '';
 fg = isValidCssColor(fg) ? fg.trim() : '';
 if (!bg) return null;
 if (!fg) fg = '#f5f0e8';
 return { bg: bg, fg: fg };
}

function inferAuthorFromBody(body, id) {
 var authorLine = body.match(/^author:\s*(.+)$/im);
 if (authorLine) return authorLine[1].trim();
 if (/^adv_/i.test(id)) return 'Arthur Conan Doyle';
 if (/sherlock|watson|holmes/i.test(body.slice(0, 500))) return 'Arthur Conan Doyle';
 return 'Unknown Author';
}

function chronologyFromFrontmatter(meta) {
 var orderRaw = meta.chronology || meta.order || meta.series_order || meta.seriesorder;
 if (orderRaw == null || orderRaw === '') return null;
 var order = Number(orderRaw);
 return Number.isFinite(order) ? order : null;
}

function parseBookMeta(filename, text) {
 var id = slugFromFilename(filename);
 var title = titleFromSlug(id);
 var author = 'Unknown Author';
 var parsed = parseFrontmatter(text);
 var body = parsed.body;
 var meta = parsed.meta;
 if (meta.title) title = sanitizeDisplayTitle(meta.title);
 else {
  var h1 = body.match(/^#\s+(.+)$/m);
  var h2 = body.match(/^##\s+(.+)$/m);
  if (h1) title = sanitizeDisplayTitle(h1[1].trim());
  else if (h2) title = sanitizeDisplayTitle(h2[1].trim());
 }
 author = meta.author || inferAuthorFromBody(body, id);
 var cover = coverStyleFromFrontmatter(meta);
 var order = chronologyFromFrontmatter(meta);
 return {
  id: id,
  title: title,
  author: author,
  subtitle: meta.subtitle || '',
  lang: meta.lang || meta.language || '',
  order: order,
  coverBg: cover ? cover.bg : '',
  coverFg: cover ? cover.fg : '',
  body: body
 };
}

function applyParsedBookMeta(book, parsed) {
 if (!book || !parsed) return book;
 if (parsed.title) book.title = parsed.title;
 if (parsed.author) book.author = parsed.author;
 if (parsed.subtitle) book.subtitle = parsed.subtitle;
 if (parsed.lang) book.lang = parsed.lang;
 if (parsed.order != null) book.order = parsed.order;
 applyCoverStyleToBook(book);
 return book;
}

function bookMarkdownBody(book) {
 if (!book || !book.content) return '';
 return parseFrontmatter(book.content).body;
}

const COVER_STYLE_CARD = { bg: '#ffffff', fg: '#1a1d21' };
const COVER_STYLE_LEATHER = { bg: 'hsl(14, 38%, 24%)', fg: '#f5f0e8' };
const COVER_STYLE_UNKNOWN = { bg: 'hsl(220, 18%, 28%)', fg: '#ffffff' };
const COVER_STYLE_AUTHOR_PALETTE = [
 COVER_STYLE_LEATHER,
 COVER_STYLE_UNKNOWN,
 { bg: 'hsl(155, 32%, 22%)', fg: '#f0f7f2' },
 { bg: 'hsl(235, 40%, 24%)', fg: '#f0f2fa' },
 { bg: 'hsl(350, 32%, 26%)', fg: '#faf0f2' },
 { bg: 'hsl(30, 12%, 26%)', fg: '#f5f3f0' }
];

function hashAuthorKey(author) {
 var key = (author || 'Unknown Author').trim().toLowerCase();
 var hash = 0;
 for (var i = 0; i < key.length; i++) {
  hash = key.charCodeAt(i) + ((hash << 5) - hash);
 }
 return Math.abs(hash);
}

function coverStyleForAuthor(author) {
 var name = (author || 'Unknown Author').trim();
 if (/^arthur\s+conan\s+doyle$/i.test(name)) {
  return COVER_STYLE_LEATHER;
 }
 if (!name || /^unknown\s+author$/i.test(name)) {
  return COVER_STYLE_UNKNOWN;
 }
 var paletteStart = 2;
 var idx = paletteStart + (hashAuthorKey(name) % (COVER_STYLE_AUTHOR_PALETTE.length - paletteStart));
 return COVER_STYLE_AUTHOR_PALETTE[idx];
}

function applyCoverStyleToBook(book) {
 book.coverBg = COVER_STYLE_CARD.bg;
 book.coverFg = COVER_STYLE_CARD.fg;
 return book;
}

function manifestEntryForFile(filename) {
 return manifestEntries[filename] || null;
}

async function fetchManifest() {
 var res = await fetch(MANIFEST_URL, { cache: 'no-cache' });
 if (!res.ok) throw new Error('manifest fetch failed');
 var text = await res.text();
 var data;
 try {
  data = JSON.parse(text);
 } catch (e) {
  throw new Error('manifest JSON invalid: ' + (text.slice(0, 80) || '(empty)'));
 }
 manifestEntries = data.entries && typeof data.entries === 'object' ? data.entries : {};
 manifestFileOrder = Array.isArray(data.files) ? data.files.slice() : [];
 return data;
}

function manifestOrderFromEntry(entry) {
 if (!entry) return null;
 var raw = entry.chronology != null && entry.chronology !== ''
  ? entry.chronology
  : entry.order;
 if (raw == null || raw === '') return null;
 var n = Number(raw);
 return Number.isFinite(n) ? n : null;
}

function bookFilename(book) {
 if (book.path) return book.path.split('/').pop();
 return book.id + '.md';
}

function manifestIndexForBook(book) {
 if (book.manifestIndex != null) return book.manifestIndex;
 var filename = bookFilename(book);
 var idx = manifestFileOrder.indexOf(filename);
 return idx === -1 ? 1e9 : idx;
}

function stubBookFromFilename(filename, manifestIndex) {
 var id = slugFromFilename(filename);
 var entry = manifestEntryForFile(filename) || {};
 var author = entry.author || (/^adv_/i.test(id) ? 'Arthur Conan Doyle' : 'Unknown Author');
 var book = {
  id: id,
  title: entry.title || titleFromSlug(id),
  author: author,
  subtitle: entry.subtitle || '',
  lang: entry.lang || '',
  order: manifestOrderFromEntry(entry),
  manifestIndex: manifestIndex != null ? manifestIndex : null,
  coverBg: entry.coverBg || '',
  coverFg: entry.coverFg || '',
  path: BOOKS_BASE + filename,
  source: 'bundled',
  content: null
 };
 return applyCoverStyleToBook(book);
}

async function scanBookStubs() {
 var manifest = await fetchManifest();
 var files = manifest.files && manifest.files.length ? manifest.files : [];
 if (!files.length) return [];
 return files.map(function (filename, index) {
  return stubBookFromFilename(filename, index);
 });
}

function bundledBooksSignature(scanned) {
 return scanned.map(function (b) {
  return b.id + '@' + (b.order != null ? b.order : '') + '#' + (b.manifestIndex != null ? b.manifestIndex : '');
 }).join(',');
}

async function hydrateBook(book) {
 if (!book || book.content || !book.path) return book;
 var filename = book.path.split('/').pop();
 var res = await fetch(book.path);
 if (!res.ok) throw new Error('book fetch failed: ' + book.path);
 var text = await res.text();
 var meta = parseBookMeta(filename, text);
 book.content = meta.body;
 applyParsedBookMeta(book, meta);
 return book;
}

function revalidateLibraryManifest() {
 scanBookStubs().then(function (scanned) {
  var uploadsOnly = books.filter(function (b) { return b.source === 'upload'; });
  var bundled = books.filter(function (b) { return b.source !== 'upload'; });
  var nextBooks = sortBooksForLibrary(scanned.concat(uploadsOnly));
  if (scanned.length !== bundled.length
   || bundledBooksSignature(scanned) !== bundledBooksSignature(bundled)) {
   books = nextBooks;
   renderLibraryGrid();
  }
 }).catch(function (e) {
  console.warn('manifest revalidate failed', e);
 });
}

function loadUploadsFromStorage() {
 try {
  var raw = localStorage.getItem(UPLOADS_STORAGE_KEY);
  uploads = raw ? JSON.parse(raw) : [];
 } catch (e) {
  uploads = [];
 }
 uploads.forEach(function (u) {
  u.source = 'upload';
  if (u.content) {
   var reparsed = parseBookMeta((u.path || u.id || 'upload') + '.md', u.content);
   u.content = reparsed.body;
   applyParsedBookMeta(u, reparsed);
  } else {
   applyCoverStyleToBook(u);
  }
 });
}

function saveUploads() {
 localStorage.setItem(UPLOADS_STORAGE_KEY, JSON.stringify(uploads));
}

function compareBooksForLibrary(a, b) {
 var ao = a.order;
 var bo = b.order;
 var aHas = ao != null && ao !== '' && Number.isFinite(Number(ao));
 var bHas = bo != null && bo !== '' && Number.isFinite(Number(bo));
 if (aHas && bHas && ao !== bo) return ao - bo;
 if (aHas && !bHas) return -1;
 if (!aHas && bHas) return 1;
 var ai = manifestIndexForBook(a);
 var bi = manifestIndexForBook(b);
 if (ai !== bi) return ai - bi;
 return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
}

function sortBooksForLibrary(list) {
 return list.slice().sort(compareBooksForLibrary);
}

function getVisibleBooks() {
 return sortBooksForLibrary(books.filter(function (b) {
  if (isBookHidden(b.id)) return false;
  if (!libraryFilterQuery) return true;
  var q = libraryFilterQuery.toLowerCase();
  return b.title.toLowerCase().indexOf(q) !== -1 || b.author.toLowerCase().indexOf(q) !== -1;
 }));
}

function findBookById(id) {
 return books.find(function (b) { return b.id === id; }) || null;
}

// =========================================================================
// V31-260617s/c | SECTION 10: LIBRARY GRID RENDER
// 6:9 COVERS, AUTHOR-MATCHED COLORS, DELETE CONTROL, FILTER
// =========================================================================
function renderLibraryGrid() {
 var grid = document.getElementById('book-grid');
 var empty = document.getElementById('library-grid-empty');
 var visible = getVisibleBooks();
 grid.innerHTML = '';
 if (!visible.length) {
  empty.classList.remove('is-hidden');
  return;
 }
 empty.classList.add('is-hidden');
 visible.forEach(function (book) {
  var card = document.createElement('article');
  card.className = 'library-grid-card';
  card.dataset.bookId = book.id;
  card.setAttribute('tabindex', '0');

  var cover = document.createElement('div');
  cover.className = 'library-grid-cover';
  cover.style.setProperty('--cover-bg', COVER_STYLE_CARD.bg);
  cover.style.setProperty('--cover-fg', COVER_STYLE_CARD.fg);

  var titleId = 'book-title-' + book.id.replace(/[^a-z0-9_-]/gi, '-');
  var authorId = 'book-author-' + book.id.replace(/[^a-z0-9_-]/gi, '-');

  var titleEl = document.createElement('span');
  titleEl.className = 'library-grid-cover-title';
  titleEl.id = titleId;
  titleEl.textContent = sanitizeDisplayTitle(book.title);

  var authorEl = document.createElement('span');
  authorEl.className = 'library-grid-cover-author';
  authorEl.id = authorId;
  authorEl.textContent = book.author;

  card.setAttribute('aria-labelledby', titleId + ' ' + authorId);

  cover.appendChild(titleEl);
  cover.appendChild(authorEl);

  var deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'icon-btn library-grid-delete';
  deleteBtn.title = 'Remove from library';
  deleteBtn.setAttribute('aria-label', 'Remove ' + book.title + ' from library');
  deleteBtn.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">&#xE872;</span>';
  deleteBtn.addEventListener('click', function (e) {
   e.stopPropagation();
   if (book.source === 'upload') {
    removeUploadedBook(book.id);
   } else {
    hideBook(book.id);
   }
  });

  card.appendChild(cover);
  card.appendChild(deleteBtn);
  card.addEventListener('click', function () { openBookById(book.id); });
  card.addEventListener('keydown', function (e) {
   if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    openBookById(book.id);
   }
  });
  grid.appendChild(card);
 });
}

function removeUploadedBook(bookId) {
 if (!confirm('Delete this uploaded book permanently?')) return;
 uploads = uploads.filter(function (u) { return u.id !== bookId; });
 books = books.filter(function (b) { return b.id !== bookId; });
 saveUploads();
 if (lastOpenedBookId === bookId) lastOpenedBookId = null;
 renderLibraryGrid();
 persistSession();
}

// =========================================================================
// V31-260619b/b | SECTION 11: MARKDOWN RENDER & TOC
// =========================================================================
var TOC_MIN_LEVEL = 2;
var TOC_MAX_LEVEL = 5;

function slugifyHeading(text) {
 return String(text || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '');
}

function escapeHtml(str) {
 return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

var mdFootnoteDefs = {};
var mdFootnoteRefs = {};

function resetMdFootnoteState() {
 mdFootnoteDefs = {};
 mdFootnoteRefs = {};
}

function parseInlineMarkdown(text) {
 var out = escapeHtml(text);
 out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
 out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
 out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function (_, alt, url) {
  var src = url;
  if (/^\/assets\/images\//i.test(src)) src = src.replace(/^\/assets\/images\//i, 'images/');
  return '<img class="md-image" src="' + escapeHtml(src) + '" alt="' + escapeHtml(alt) + '" loading="lazy" decoding="async">';
 });
 out = out.replace(/\[([^\]]+)\]\(#([^)]+)\)/g, function (_, label, anchor) {
  return '<a href="#' + escapeHtml(anchor) + '">' + label + '</a>';
 });
 out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (_, label, url) {
  if (!/^https?:\/\//i.test(url)) return '[' + label + '](' + url + ')';
  return '<a href="' + escapeHtml(url) + '" rel="noopener noreferrer">' + label + '</a>';
 });
 out = out.replace(/\[\^([^\]]+)\]/g, function (_, id) {
  mdFootnoteRefs[id] = true;
  return '<sup class="md-fn-ref-wrap"><a href="#fn-' + escapeHtml(id) + '" id="fnref-' + escapeHtml(id) + '" class="md-fn-ref">' + escapeHtml(id) + '</a></sup>';
 });
 return out;
}

function parseHeadingLine(trimmed) {
 var hm = trimmed.match(/^(#{1,6})\s+(.+)$/);
 if (!hm) return null;
 var level = hm[1].length;
 var text = hm[2];
 var idTag = text.match(/\s*\{#([^}]+)\}\s*$/);
 var rawText = idTag ? text.replace(/\s*\{#[^}]+\}\s*$/, '').trim() : text;
 var id = idTag ? idTag[1] : slugifyHeading(sanitizeDisplayTitle(rawText) || rawText);
 return {
  level: level,
  id: id,
  text: rawText,
  tocText: sanitizeDisplayTitle(rawText) || rawText
 };
}

function listItemKind(trimmed) {
 if (/^\d+\.\s/.test(trimmed)) return 'decimal';
 if (/^[a-z]\)\s/i.test(trimmed)) return 'alpha';
 if (/^-\s/.test(trimmed)) return 'bullet';
 return null;
}

function listItemText(trimmed, kind) {
 if (kind === 'decimal') return trimmed.replace(/^\d+\.\s*/, '');
 if (kind === 'alpha') return trimmed.replace(/^[a-z]\)\s*/i, '');
 if (kind === 'bullet') return trimmed.slice(2);
 return trimmed;
}

function listTagForKind(kind) {
 if (kind === 'bullet') return { tag: 'ul', className: 'md-block-list' };
 if (kind === 'alpha') return { tag: 'ol', className: 'md-list md-list--alpha' };
 return { tag: 'ol', className: 'md-list' };
}

function lineHasHardBreak(rawLine) {
 return /  \s*$/.test(rawLine);
}

function isIndexEntryLine(text) {
 return /\s[–—-]\s+\[[^\]]+\]\([^)]+\)/.test(text);
}

function renderParagraphGroup(para) {
 if (!para.length) return '';
 if (para.length === 1) {
  return '<p>' + parseInlineMarkdown(para[0].text) + '</p>';
 }
 if (para.every(function (entry) { return isIndexEntryLine(entry.text); })) {
  return para.map(function (entry) {
   return '<p class="md-index-entry">' + parseInlineMarkdown(entry.text) + '</p>';
  }).join('');
 }
 var chunks = [];
 para.forEach(function (entry, idx) {
  chunks.push(parseInlineMarkdown(entry.text));
  if (idx >= para.length - 1) return;
  if (entry.hardBreak) chunks.push('<br>');
  else chunks.push(' ');
 });
 return '<p>' + chunks.join('') + '</p>';
}

function renderBodyBlocks(lines) {
 var html = [];
 var i = 0;
 while (i < lines.length) {
  var trimmed = lines[i].trim();
  if (!trimmed) {
   i++;
   continue;
  }
  var kind = listItemKind(trimmed);
  if (kind) {
   var listKind = kind;
   var items = [];
   while (i < lines.length) {
    var probe = lines[i].trim();
    if (!probe) break;
    var probeKind = listItemKind(probe);
    if (probeKind !== listKind) break;
    items.push(listItemText(probe, listKind));
    i++;
   }
   var listMeta = listTagForKind(listKind);
   html.push('<' + listMeta.tag + ' class="' + listMeta.className + '">' +
    items.map(function (item) {
     return '<li>' + parseInlineMarkdown(item) + '</li>';
    }).join('') +
    '</' + listMeta.tag + '>');
   continue;
  }
  var para = [];
  while (i < lines.length) {
   var rawLine = lines[i];
   var line = rawLine.trim();
   if (!line) break;
   if (listItemKind(line)) break;
   para.push({ text: line, hardBreak: lineHasHardBreak(rawLine) });
   i++;
  }
  if (para.length) {
   html.push(renderParagraphGroup(para));
  }
 }
 return html.join('');
}

function renderMdBlockLines(lines) {
 return renderBodyBlocks(lines);
}

function extractFootnoteDefs(lines) {
 var body = [];
 lines.forEach(function (line) {
  var trimmed = line.trim();
  var match = trimmed.match(/^\[\^([^\]]+)\]:\s*(.*)$/);
  if (match) {
   mdFootnoteDefs[match[1]] = match[2];
   return;
  }
  body.push(line);
 });
 return body;
}

function renderMdFootnotes() {
 var ids = Object.keys(mdFootnoteDefs).filter(function (id) {
  return mdFootnoteRefs[id];
 });
 if (!ids.length) return '';
 ids.sort(function (a, b) {
  var na = parseInt(a, 10);
  var nb = parseInt(b, 10);
  if (!isNaN(na) && !isNaN(nb)) return na - nb;
  return a.localeCompare(b);
 });
 return '<section class="md-footnotes" aria-label="Notes"><ol>' +
  ids.map(function (id) {
   return '<li id="fn-' + escapeHtml(id) + '">' + parseInlineMarkdown(mdFootnoteDefs[id]) +
    ' <a href="#fnref-' + escapeHtml(id) + '" class="md-fn-back" aria-label="Back">↩</a></li>';
  }).join('') +
  '</ol></section>';
}

function renderMdBlock(type, title, lines) {
 var body = renderMdBlockLines(lines);
 if (type === 'expand') {
  return '<details class="md-block md-block--expand">' +
   '<summary><span class="md-block-expand-icon material-symbols-outlined" aria-hidden="true">\uE313</span>' +
   '<span class="md-block-expand-label">' + parseInlineMarkdown(title || 'More') + '</span></summary>' +
   '<div class="md-block-body">' + body + '</div></details>';
 }
 var titleHtml = title ? '<p class="md-block-title">' + parseInlineMarkdown(title) + '</p>' : '';
 return '<div class="md-block md-block--' + escapeHtml(type) + '">' + titleHtml +
  '<div class="md-block-body">' + body + '</div></div>';
}

function isSkippableComment(trimmed) {
 return trimmed.indexOf('<!--') === 0;
}

function markdownToHtml(md) {
 resetMdFootnoteState();
 var lines = extractFootnoteDefs(md.replace(/\r\n/g, '\n').split('\n'));
 var html = [];
 var toc = [];
 var i = 0;

 while (i < lines.length) {
  var trimmed = lines[i].trim();
  if (!trimmed) {
   i++;
   continue;
  }
  if (trimmed === '<!-- PART_BREAK -->') {
   html.push('<hr class="md-part-break" aria-hidden="true">');
   i++;
   continue;
  }
  if (isSkippableComment(trimmed)) {
   i++;
   continue;
  }
  var blockOpen = trimmed.match(/^:::\s*([\w-]+)(?:\s+(.+))?$/);
  if (blockOpen) {
   var blockType = blockOpen[1];
   var blockTitle = blockOpen[2] || '';
   var blockLines = [];
   i++;
   while (i < lines.length && lines[i].trim() !== ':::') {
    blockLines.push(lines[i]);
    i++;
   }
   if (i < lines.length) i++;
   html.push(renderMdBlock(blockType, blockTitle, blockLines));
   continue;
  }
  var heading = parseHeadingLine(trimmed);
  if (heading) {
   if (heading.level >= TOC_MIN_LEVEL && heading.level <= TOC_MAX_LEVEL) {
    toc.push({ id: heading.id, text: heading.tocText, level: heading.level });
   }
   var relatedTermsClass = sanitizeDisplayTitle(heading.tocText) === 'Termos relacionados'
    ? ' class="reader-heading--related-terms"' : '';
   html.push('<h' + heading.level + ' id="' + escapeHtml(heading.id) + '"' + relatedTermsClass + '>' +
    parseInlineMarkdown(heading.text) + '</h' + heading.level + '>');
   i++;
   continue;
  }
  var bodyStart = i;
  while (i < lines.length) {
   var probe = lines[i].trim();
   if (!probe) break;
   if (probe === '<!-- PART_BREAK -->' || isSkippableComment(probe)) break;
   if (probe.match(/^:::\s*[\w-]+/) || probe === ':::') break;
   if (probe.match(/^#{1,6}\s+/)) break;
   i++;
  }
  if (i > bodyStart) {
   html.push(renderBodyBlocks(lines.slice(bodyStart, i)));
  } else {
   i++;
  }
 }

 var footnotes = renderMdFootnotes();
 if (footnotes) html.push(footnotes);

 return { html: html.join('\n'), toc: toc };
}

function getCachedBookRender(book) {
 if (!book || !book.id || book.content == null) return null;
 var cached = bookRenderCache.get(book.id);
 if (!cached || cached.content !== book.content) return null;
 return cached.parsed;
}

function setCachedBookRender(book, parsed) {
 if (!book || !book.id) return;
 bookRenderCache.set(book.id, { content: book.content, parsed: parsed });
}

function parseBookForReader(book) {
 var cached = getCachedBookRender(book);
 if (cached) return cached;
 var parsed = markdownToHtml(bookMarkdownBody(book));
 setCachedBookRender(book, parsed);
 return parsed;
}

function rebuildReaderHeadingIndex() {
 var viewport = document.getElementById('main-text-viewport');
 var scrollEl = readerMainScrollEl();
 readerHeadingIndex = [];
 if (!viewport || !scrollEl) return;
 var headings = viewport.querySelectorAll('h2, h3, h4, h5');
 if (!headings.length) return;
 var scrollRect = scrollEl.getBoundingClientRect();
 var scrollTop = scrollEl.scrollTop;
 readerHeadingIndex = Array.from(headings).map(function (el) {
  return {
   id: el.id,
   top: el.getBoundingClientRect().top - scrollRect.top + scrollTop
  };
 });
}

function scheduleReaderHeadingIndexRebuild() {
 if (readerHeadingIndexRaf) return;
 readerHeadingIndexRaf = requestAnimationFrame(function () {
  readerHeadingIndexRaf = 0;
  rebuildReaderHeadingIndex();
  scheduleTocScrollSync();
 });
}

function getReaderActiveHeadingId() {
 var scrollEl = readerMainScrollEl();
 if (!scrollEl || !readerHeadingIndex.length) return '';
 var marker = scrollEl.scrollTop + (scrollEl.clientHeight / 2);
 var activeId = '';
 for (var i = 0; i < readerHeadingIndex.length; i++) {
  if (readerHeadingIndex[i].top <= marker) activeId = readerHeadingIndex[i].id;
  else break;
 }
 return activeId;
}

function createTocLink(item) {
 var a = document.createElement('a');
 a.href = '#' + item.id;
 a.className = 'reader-toc-item';
 a.dataset.section = item.id;
 a.textContent = item.text;
 a.addEventListener('click', function (e) { scrollToSection(e, item.id); });
 return a;
}

function tocItemMatchesFilter(item, q) {
 return !q || item.text.toLowerCase().indexOf(q) !== -1;
}

function renderTocList(toc) {
 currentBookToc = toc || [];
 var list = getTocList();
 if (!list) return;
 list.innerHTML = '';
 var q = tocFilterQuery.toLowerCase();
 currentBookToc.forEach(function (item) {
  if (!tocItemMatchesFilter(item, q)) return;
  var li = document.createElement('li');
  li.appendChild(createTocLink(item));
  list.appendChild(li);
 });
 scheduleTocScrollSync();
}

function scrollActiveTocItemIntoView(link, container) {
 if (!link || !container) return;
 var targetRect = link.getBoundingClientRect();
 var containerRect = container.getBoundingClientRect();
 var midY = containerRect.top + (containerRect.height / 2);

 if (targetRect.bottom > midY) {
  container.scrollTop += targetRect.bottom - midY;
  return;
 }
 if (targetRect.top < containerRect.top) {
  var delta = containerRect.top - targetRect.top;
  var projectedBottom = targetRect.bottom + delta;
  if (projectedBottom > midY) delta -= projectedBottom - midY;
  container.scrollTop -= delta;
 }
}

function syncTocScrollState() {
 tocScrollRaf = 0;
 var list = getTocList();
 if (!list) return;
 var activeId = getReaderActiveHeadingId();
 list.querySelectorAll('.reader-toc-item').forEach(function (link) {
  link.classList.toggle('is-active', link.dataset.section === activeId);
 });
 if (!activeId) {
  lastTocActiveId = '';
  return;
 }
 if (activeId !== lastTocActiveId) {
  var activeLink = list.querySelector('.reader-toc-item.is-active');
  var tocBody = document.querySelector('.reader-toc-body');
  scrollActiveTocItemIntoView(activeLink, tocBody);
  lastTocActiveId = activeId;
 }
}

function scheduleTocScrollSync() {
 if (tocScrollRaf) return;
 tocScrollRaf = requestAnimationFrame(syncTocScrollState);
}

// =========================================================================
// V31-260617s/a | SECTION 12: BOOK OPEN & SESSION
// =========================================================================
function openBookById(bookId) {
 var book = findBookById(bookId);
 if (!book) return;
 hydrateBook(book).then(function () {
  loadBook(book);
 }).catch(function (e) {
  console.error('open book failed', e);
 });
}

function loadBook(book, skipPersist) {
 lastOpenedBookId = book.id;
 switchView('reader');
 var displayTitle = sanitizeDisplayTitle(book.title);
 var readerTitleEl = document.getElementById('reader-title');
 readerTitleEl.textContent = displayTitle;
 readerTitleEl.title = displayTitle;
 var parsed = parseBookForReader(book);
 var viewport = document.getElementById('main-text-viewport');
 viewport.replaceChildren();
 viewport.insertAdjacentHTML('afterbegin', parsed.html);
 var scrollEl = readerMainScrollEl();
 if (scrollEl) scrollEl.scrollTop = 0;
 tocFilterQuery = '';
 var tocFilterInput = document.getElementById('toc-filter-input');
 if (tocFilterInput) {
  tocFilterInput.value = '';
  syncInputClearButton(tocFilterInput);
 }
 resetNotesFilters();
 lastTocActiveId = '';
 readerHeadingIndex = [];
 renderTocList(parsed.toc);
 requestAnimationFrame(function () {
  if (window.LibrusAnnotations && typeof LibrusAnnotations.invalidateViewportTextCache === 'function') {
   LibrusAnnotations.invalidateViewportTextCache();
  }
  scheduleReaderHeadingIndexRebuild();
  refreshNotesPanel();
 });
 resetReaderChromeState();
 showContextPlaceholder();
 lastLookupSelection = '';
 clearNotesSelectionCache();
 var searchInput = document.getElementById('reader-search-input');
 if (searchInput) {
  searchInput.value = '';
  syncInputClearButton(searchInput);
 }
 resetSearchCounter();
 syncBookShareHash(book.id);
 updateReaderShareButtonState();
 if (!skipPersist) persistSession();
}

function persistSession() {
 if (!lastOpenedBookId) {
  localStorage.removeItem(SESSION_STORAGE_KEY);
  return;
 }
 localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
  lastBookId: lastOpenedBookId,
  theme: settings.theme
 }));
}

function shouldRestoreSession() {
 if (new URLSearchParams(window.location.search).has('library')) return false;
 var nav = performance.getEntriesByType('navigation')[0];
 if (!nav || nav.type !== 'reload') return false;
 return sessionStorage.getItem(TAB_SESSION_KEY) === '1';
}

function markTabSessionActive() {
 if (!lastOpenedBookId) return;
 try {
  sessionStorage.setItem(TAB_SESSION_KEY, '1');
 } catch (e) { /* private mode */ }
}

function scheduleSessionRestore() {
 if (!shouldRestoreSession()) return;
 var restore = function () {
  restoreSession().catch(function (e) {
   console.error('restore session failed', e);
  });
 };
 if ('requestIdleCallback' in window) {
  requestIdleCallback(restore, { timeout: 2500 });
 } else {
  window.setTimeout(restore, 1);
 }
}

async function restoreSession() {
 var raw = localStorage.getItem(SESSION_STORAGE_KEY);
 if (!raw) return false;
 try {
  var data = JSON.parse(raw);
  if (data.theme) changeTheme(data.theme, true);
  if (data.lastBookId) {
   var book = findBookById(data.lastBookId);
   if (book) {
    await hydrateBook(book);
    loadBook(book, true);
    return true;
   }
  }
 } catch (e) {
  localStorage.removeItem(SESSION_STORAGE_KEY);
 }
 return false;
}

function handleMDUpload(event) {
 var file = event.target.files[0];
 if (!file) return;
 var reader = new FileReader();
 reader.onload = function (ev) {
  var text = ev.target.result;
  var filename = file.name;
  var meta = parseBookMeta(filename, text);
  var id = 'upload-' + Date.now();
  var book = applyParsedBookMeta({
   id: id,
   title: meta.title,
   author: meta.author,
   subtitle: meta.subtitle,
   lang: meta.lang,
   source: 'upload',
   content: meta.body
  }, meta);
  uploads.push(book);
  books.push(book);
  saveUploads();
  renderLibraryGrid();
  loadBook(book);
 };
 reader.readAsText(file);
 event.target.value = '';
}

async function initLibrary() {
 loadUploadsFromStorage();
 try {
  books = sortBooksForLibrary((await scanBookStubs()).concat(uploads));
 } catch (e) {
  console.warn('library manifest load failed', e);
  manifestEntries = {};
  manifestFileOrder = [];
  books = sortBooksForLibrary(uploads);
 }
 renderLibraryGrid();
 if ('requestIdleCallback' in window) {
  requestIdleCallback(revalidateLibraryManifest, { timeout: 12000 });
 } else {
  window.setTimeout(revalidateLibraryManifest, 2000);
 }
}

// =========================================================================
// V31-260617s/p | SECTION 13: READER OVERLAYS & SCROLL
// =========================================================================
var READER_OVERLAY_PANELS = ['reader-toc', 'reader-notes', 'reader-context'];

function getOpenReaderOverlay() {
 for (var i = 0; i < READER_OVERLAY_PANELS.length; i++) {
  var panel = document.getElementById(READER_OVERLAY_PANELS[i]);
  if (panel && panel.classList.contains('is-overlay')) return READER_OVERLAY_PANELS[i];
 }
 return null;
}

function syncReaderOverlayChrome() {
 var reader = document.getElementById('reader-container');
 var backdrop = document.getElementById('reader-overlay-backdrop');
 var open = getOpenReaderOverlay();
 var overlayLayout = isReaderOverlayLayout();
 if (reader) {
  reader.classList.toggle('has-reader-overlay', !!open && overlayLayout);
  if (open && isMobileReaderLayout()) reader.classList.remove('is-topbar-hidden');
 }
 if (backdrop) backdrop.classList.toggle('is-hidden', !(open && overlayLayout));
}

function closeOverlayPanel(panelId) {
 var panel = document.getElementById(panelId);
 if (panel) panel.classList.remove('is-overlay');
 syncReaderOverlayChrome();
}

function openOverlayPanel(panelId) {
 closeLibrarySettings();
 closeAllReaderOverlays({ skipSync: true });
 var panel = document.getElementById(panelId);
 if (panel) panel.classList.add('is-overlay');
 syncReaderOverlayChrome();
}

function toggleOverlayPanel(panelId) {
 var panel = document.getElementById(panelId);
 if (!panel) return;
 if (panel.classList.contains('is-overlay')) closeOverlayPanel(panelId);
 else openOverlayPanel(panelId);
}

function closeAllReaderOverlays(options) {
 READER_OVERLAY_PANELS.forEach(function (id) {
  var panel = document.getElementById(id);
  if (panel) panel.classList.remove('is-overlay');
 });
 if (!options || !options.skipSync) syncReaderOverlayChrome();
}

function readerMainScrollEl() {
 return document.getElementById('reader-main-scroll');
}

function scrollToElementInContainer(el, scrollContainer, offset) {
 if (!el || !scrollContainer) return;
 var elRect = el.getBoundingClientRect();
 var containerRect = scrollContainer.getBoundingClientRect();
 scrollContainer.scrollTop += elRect.top - containerRect.top - (offset || 0);
}

function isBookShareHash(raw) {
 return /^book=/i.test(raw || '');
}

function scrollToReaderAnchor(elementId) {
 var targetElement = document.getElementById(elementId);
 if (!targetElement) return false;
 scrollToElementInContainer(targetElement, readerMainScrollEl(), 20);
 return true;
}

function scrollToSection(event, elementId) {
 if (event && event.preventDefault) event.preventDefault();
 scrollToReaderAnchor(elementId);
 scheduleTocScrollSync();
 if (isReaderOverlayLayout()) closeOverlayPanel('reader-toc');
}

function handleReaderContentLinkClick(event) {
 var viewport = document.getElementById('main-text-viewport');
 if (!viewport) return;
 var link = event.target.closest('a[href^="#"]');
 if (!link || !viewport.contains(link)) return;
 var raw = (link.getAttribute('href') || '').slice(1).trim();
 if (!raw || isBookShareHash(raw)) return;
 if (!document.getElementById(raw)) return;
 scrollToSection(event, raw);
}

function handleScrollContainerScroll(container) {
 if (container.id === 'reader-main-scroll') scheduleTocScrollSync();
 if (container.id !== 'reader-main-scroll') return;
 if (!isMobileReaderLayout()) return;

 var readerContainer = document.getElementById('reader-container');
 var last = scrollTops.get(container) || 0;
 var st = container.scrollTop;
 if (Math.abs(st - last) <= SCROLL_THRESHOLD) return;

 if (st <= SCROLL_HIDE_OFFSET || st < last) {
  readerContainer.classList.remove('is-topbar-hidden');
 } else if (st > last) {
  readerContainer.classList.add('is-topbar-hidden');
 }

 scrollTops.set(container, st);
}

// =========================================================================
// V31-260617s/q | SECTION 14: SEARCH & CONTEXT
// IN-DOCUMENT HIGHLIGHT SEARCH + EXPANDABLE FIELD
// =========================================================================
function escapeRegex(str) {
 return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function clearSearchHighlights() {
 var viewport = document.getElementById('main-text-viewport');
 if (!viewport) return;
 viewport.querySelectorAll('.reader-search-hit').forEach(function (mark) {
  var parent = mark.parentNode;
  if (!parent) return;
  parent.replaceChild(document.createTextNode(mark.textContent), mark);
  parent.normalize();
 });
 searchHits = [];
}

function collectTextNodes(root) {
 var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
  acceptNode: function (node) {
   if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
   if (node.parentElement && node.parentElement.closest('.reader-search-hit')) {
    return NodeFilter.FILTER_REJECT;
   }
   return NodeFilter.FILTER_ACCEPT;
  }
 });
 var nodes = [];
 while (walker.nextNode()) nodes.push(walker.currentNode);
 return nodes;
}

function executeDocumentSearch(query) {
 var viewport = document.getElementById('main-text-viewport');
 var metaGroup = document.getElementById('reader-search-meta');
 clearSearchHighlights();
 if (!query) {
  resetSearchCounter();
  return;
 }
 metaGroup.classList.add('is-visible');
 var regex = new RegExp(escapeRegex(query), 'gi');
 collectTextNodes(viewport).forEach(function (node) {
  var text = node.nodeValue;
  regex.lastIndex = 0;
  if (!regex.test(text)) return;
  regex.lastIndex = 0;
  var frag = document.createDocumentFragment();
  var last = 0;
  var match;
  while ((match = regex.exec(text)) !== null) {
   if (match.index > last) {
    frag.appendChild(document.createTextNode(text.slice(last, match.index)));
   }
   var mark = document.createElement('mark');
   mark.className = 'reader-search-hit';
   mark.textContent = match[0];
   frag.appendChild(mark);
   last = regex.lastIndex;
  }
  if (last < text.length) {
   frag.appendChild(document.createTextNode(text.slice(last)));
  }
  node.parentNode.replaceChild(frag, node);
 });
 searchHits = Array.from(viewport.querySelectorAll('.reader-search-hit'));
 totalMatchCount = searchHits.length;
 currentMatchIndex = -1;
 updateSearchHitDisplay();
}

function scrollToSearchHit(index) {
 if (index < 0 || index >= searchHits.length) return;
 var hit = searchHits[index];
 var scrollContainer = readerMainScrollEl();
 if (!hit || !scrollContainer) return;
 var hitRect = hit.getBoundingClientRect();
 var containerRect = scrollContainer.getBoundingClientRect();
 var relativeTop = hitRect.top - containerRect.top + scrollContainer.scrollTop;
 var target = relativeTop - (scrollContainer.clientHeight / 2) + (hitRect.height / 2);
 scrollContainer.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
}

function updateSearchHitDisplay() {
 var counterText = '0 / 0';
 if (totalMatchCount > 0) {
  counterText = (currentMatchIndex >= 0 ? (currentMatchIndex + 1) : '0') + ' / ' + totalMatchCount;
 }
 document.getElementById('reader-search-counter').innerText = counterText;
 searchHits.forEach(function (hit, index) {
  hit.classList.toggle('is-current', index === currentMatchIndex);
 });
}

function clearSearchInterface() {
 var input = document.getElementById('reader-search-input');
 if (input) {
  input.value = '';
  syncInputClearButton(input);
  input.blur();
 }
 resetSearchCounter();
}

function handleSearchInput(event) {
 var query = event.target.value.trim();
 if (!query) {
  resetSearchCounter();
  return;
 }
 executeDocumentSearch(query);
}

function handleSearchKey(event) {
 if (event.key === 'Escape') {
  clearSearchInterface();
  return;
 }
 if (event.key === 'Enter') {
  navigateSearch('next');
 }
}

function navigateSearch(direction) {
 if (totalMatchCount === 0) return;
 if (direction === 'next') {
  currentMatchIndex = currentMatchIndex >= totalMatchCount - 1 ? 0 : currentMatchIndex + 1;
 } else {
  currentMatchIndex = currentMatchIndex <= 0 ? totalMatchCount - 1 : currentMatchIndex - 1;
 }
 updateSearchHitDisplay();
 scrollToSearchHit(currentMatchIndex);
}

function resetSearchCounter() {
 clearSearchHighlights();
 currentMatchIndex = -1;
 totalMatchCount = 0;
 document.getElementById('reader-search-counter').innerText = '0 / 0';
 document.getElementById('reader-search-meta').classList.remove('is-visible');
}

function getSelectedText() {
 var selection = window.getSelection();
 return selection ? selection.toString().trim() : '';
}

function isSelectionInReader(selection) {
 if (!selection || selection.isCollapsed) return false;
 var viewport = document.getElementById('main-text-viewport');
 if (!viewport) return false;
 var node = selection.anchorNode;
 return !!(node && viewport.contains(node));
}

var lookupSelectionSyncRaf = 0;

function scheduleLookupSelectionSync() {
 if (lookupSelectionSyncRaf) cancelAnimationFrame(lookupSelectionSyncRaf);
 lookupSelectionSyncRaf = requestAnimationFrame(function () {
  lookupSelectionSyncRaf = 0;
  cacheLookupSelection();
  updateContextLookupControls();
 });
}

function cacheLookupSelection() {
 var selection = window.getSelection();
 if (!isSelectionInReader(selection) || !selection || selection.isCollapsed) return;
 var text = selection.toString().trim();
 if (text) lastLookupSelection = text;
}

function clearLookupSelection() {
 var selection = window.getSelection();
 if (selection) selection.removeAllRanges();
 lastLookupSelection = '';
}

function getLookupQuery() {
 var live = getSelectedText();
 if (live && isSelectionInReader(window.getSelection())) {
  lastLookupSelection = live;
  return live;
 }
 return lastLookupSelection;
}

function getContextProviderKey() {
 return contextLastProviderKey;
}

function isContextProviderMenuOpen() {
 var menu = document.getElementById('context-provider-menu');
 return menu && !menu.classList.contains('is-hidden');
}

function positionContextProviderMenu() {
 var menu = document.getElementById('context-provider-menu');
 var split = document.getElementById('context-split-search');
 if (!menu || !split) return;
 var rect = split.getBoundingClientRect();
 menu.style.top = (rect.bottom + 4) + 'px';
 menu.style.left = rect.left + 'px';
}

function setContextProviderMenuOpen(open) {
 var menu = document.getElementById('context-provider-menu');
 var toggle = document.getElementById('context-provider-toggle');
 var split = document.getElementById('context-split-search');
 if (!menu || !toggle) return;
 if (open) positionContextProviderMenu();
 menu.classList.toggle('is-hidden', !open);
 if (split) split.classList.toggle('is-open', open);
 toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function closeContextProviderMenu() {
 setContextProviderMenuOpen(false);
}

function toggleContextProviderMenu() {
 setContextProviderMenuOpen(!isContextProviderMenuOpen());
}

function selectContextProvider(providerKey) {
 contextLastProviderKey = providerKey;
 closeContextProviderMenu();
 updateContextLookupControls();
}

function getContextProviderTemplate(providerKey) {
 var template = settings.providers[providerKey];
 return template && template.trim() ? template.trim() : '';
}

function buildProviderUrl(template, query) {
 if (!template) return '';
 return template.replace(/\{query\}/g, query ? encodeURIComponent(query) : '');
}

function geocodeServiceUrl(query) {
 return new URL('geocode?q=' + encodeURIComponent(query), window.location.href).href;
}

function fetchOpenMeteoGeocode(query) {
 var url = 'https://geocoding-api.open-meteo.com/v1/search?name='
  + encodeURIComponent(query) + '&count=1&language=en';
 return fetch(url)
  .then(function (response) {
   if (!response.ok) throw new Error('open-meteo unavailable');
   return response.json();
  })
  .then(function (data) {
   if (!data.results || !data.results.length) return [];
   return data.results.map(function (hit) {
    var label = [hit.name, hit.admin1, hit.country].filter(Boolean).join(', ');
    return {
     lat: String(hit.latitude),
     lon: String(hit.longitude),
     display_name: label
    };
   });
  });
}

function fetchGeocodeResults(query) {
 if (navigator.serviceWorker && navigator.serviceWorker.controller) {
  return fetch(geocodeServiceUrl(query), { headers: { Accept: 'application/json' } })
   .then(function (response) {
    if (!response.ok) throw new Error('geocode unavailable');
    var contentType = response.headers.get('content-type') || '';
    if (contentType.indexOf('json') === -1) throw new Error('geocode invalid response');
    return response.json();
   })
   .then(function (data) {
    return Array.isArray(data) ? data : [];
   })
   .catch(function () {
    return fetchOpenMeteoGeocode(query);
   });
 }
 return fetchOpenMeteoGeocode(query);
}

function postMapPlaceToFrame(hit, query) {
 var frame = document.getElementById('context-viewport');
 if (!frame || !frame.contentWindow || !hit) return;
 try {
  frame.contentWindow.postMessage({
   type: 'librus:map-place',
   query: query || '',
   lat: parseFloat(hit.lat),
   lon: parseFloat(hit.lon),
   label: hit.display_name || query || ''
  }, window.location.origin);
 } catch (e) { /* iframe not ready */ }
}

var mapGeocodeToken = 0;

function pushMapGeocodeToFrame(query) {
 var normalized = normalizeMapQuery(query);
 if (!normalized) return;
 var token = ++mapGeocodeToken;
 fetchGeocodeResults(normalized).then(function (results) {
  if (token !== mapGeocodeToken) return;
  if (results.length) postMapPlaceToFrame(results[0], normalized);
 });
}

function normalizeMapQuery(query) {
 return String(query || '').trim().replace(/^[\s"'\u201C\u201D\u2018\u2019]+|[\s"'\u201C\u201D\u2018\u2019.,;:!?]+$/g, '');
}

function isContextPlaceholderUrl(url) {
 if (!url) return true;
 try {
  var parsed = new URL(url, window.location.href);
  return /context-placeholder\.html$/i.test(parsed.pathname);
 } catch (e) {
  return url.indexOf('context-placeholder.html') !== -1;
 }
}

function isShareableContextUrl(url) {
 if (!url || url === 'about:blank' || isContextPlaceholderUrl(url)) return false;
 try {
  var parsed = new URL(url, window.location.href);
  return parsed.protocol === 'http:' || parsed.protocol === 'https:';
 } catch (e) {
  return false;
 }
}

function showContextPlaceholder() {
 var frame = document.getElementById('context-viewport');
 if (!frame) return;
 contextNavigationDepth = 0;
 isInternalBackNavigation = false;
 contextArticleUrl = '';
 var placeholderUrl = contextPlaceholderUrl();
 try {
  var current = new URL(frame.src || '', window.location.href);
  var next = new URL(placeholderUrl, window.location.href);
  if (!isContextPlaceholderUrl(frame.src || '') || current.href !== next.href) {
   frame.src = placeholderUrl;
  }
 } catch (e) {
  frame.src = placeholderUrl;
 }
 hideContextLoading();
 updateContextBackButtonState();
 updateContextShareButtonState();
 syncContextPlaceholderConnectivity();
}

function syncContextArticleUrl() {
 var frame = document.getElementById('context-viewport');
 if (!frame) return '';
 var resolved = '';
 try {
  resolved = frame.contentWindow.location.href;
 } catch (e) {
  resolved = frame.src || '';
 }
 if (!isShareableContextUrl(resolved)) return contextArticleUrl;
 contextArticleUrl = resolved;
 return contextArticleUrl;
}

function getContextArticleTitle() {
 var frame = document.getElementById('context-viewport');
 if (frame) {
  try {
   var docTitle = frame.contentDocument.title;
   if (docTitle && docTitle.trim()) return docTitle.trim();
  } catch (e) { }
 }
 var readerTitle = document.getElementById('reader-title');
 return readerTitle && readerTitle.textContent ? readerTitle.textContent.trim() : 'Reference';
}

function updateContextShareButtonState() {
 var shareBtn = document.getElementById('context-share-btn');
 if (!shareBtn) return;
 var hasArticle = isShareableContextUrl(contextArticleUrl);
 shareBtn.disabled = !hasArticle;
 shareBtn.title = hasArticle ? 'Share article link' : 'Share article link (load a reference first)';
 shareBtn.setAttribute('aria-label', shareBtn.title);
}

var shareIconFileCache;

function shareLinkGap() {
 return '\n\n';
}

function loadShareIconFile() {
 if (shareIconFileCache !== undefined) return Promise.resolve(shareIconFileCache);
 return fetch('icons/pwa/icon-192.png')
  .then(function (res) {
   if (!res.ok) throw new Error('icon unavailable');
   return res.blob();
  })
  .then(function (blob) {
   shareIconFileCache = new File([blob], 'app-icon.png', { type: 'image/png' });
   return shareIconFileCache;
  })
  .catch(function () {
   shareIconFileCache = null;
   return null;
  });
}

function tryWebShare(basePayloads, onFallback) {
 if (!navigator.share) {
  onFallback();
  return;
 }
 loadShareIconFile().then(function (iconFile) {
  var payloads = basePayloads.slice();
  if (iconFile) payloads.unshift(Object.assign({}, payloads[0], { files: [iconFile] }));
  for (var i = 0; i < payloads.length; i++) {
   var payload = payloads[i];
   if (navigator.canShare && !navigator.canShare(payload)) continue;
   navigator.share(payload).catch(function (err) {
    if (err && err.name === 'AbortError') return;
    onFallback();
   });
   return;
  }
  onFallback();
 });
}

function buildContextShareClipboardText(title, url) {
 return title + '\n' + url + shareLinkGap() + LIBRUS_SHARE_ATTRIBUTION;
}

function shareContextArticle() {
 var url = syncContextArticleUrl();
 if (!isShareableContextUrl(url)) return;
 var title = getContextArticleTitle();
 tryWebShare([
  { title: title, url: url, text: shareLinkGap() + LIBRUS_SHARE_ATTRIBUTION },
  { url: url, text: buildContextShareClipboardText(title, url) },
  { url: url, title: title },
  { url: url }
 ], function () { copyContextArticleLink(title, url); });
}

function copyContextArticleLink(title, url) {
 if (!navigator.clipboard || !navigator.clipboard.writeText) return;
 navigator.clipboard.writeText(buildContextShareClipboardText(title, url)).catch(function () { });
}

function parseBookIdFromHash() {
 var raw = (window.location.hash || '').replace(/^#/, '').trim();
 if (!raw) return null;
 try {
  var bookId = new URLSearchParams(raw).get('book');
  return bookId ? decodeURIComponent(bookId) : null;
 } catch (e) {
  return null;
 }
}

function syncBookShareHash(bookId) {
 var path = window.location.pathname + window.location.search;
 if (!bookId) {
  if (window.location.hash) history.replaceState(null, '', path);
  return;
 }
 var nextHash = '#book=' + encodeURIComponent(bookId);
 if (window.location.hash !== nextHash) history.replaceState(null, '', path + nextHash);
}

function buildBookShareUrl(bookId) {
 var canonical = document.querySelector('link[rel="canonical"]');
 var root = canonical && canonical.href
  ? canonical.href.replace(/\/$/, '')
  : LIBRUS_SITE_URL.replace(/\/$/, '');
 return root + '/#book=' + encodeURIComponent(bookId);
}

function buildBookShareClipboardText(title, author, url) {
 var lines = [title];
 if (author) lines.push(author);
 lines.push(url);
 lines.push(LIBRUS_SHARE_ATTRIBUTION);
 return lines.join('\n\n');
}

function buildBookShareWebText(author) {
 var lines = [];
 if (author) lines.push(author);
 lines.push(LIBRUS_SHARE_ATTRIBUTION);
 return shareLinkGap() + lines.join('\n\n');
}

function updateReaderShareButtonState() {
 var shareBtn = document.getElementById('reader-share-btn');
 if (!shareBtn) return;
 var book = lastOpenedBookId ? findBookById(lastOpenedBookId) : null;
 var canShare = !!book;
 shareBtn.disabled = !canShare;
 var tip = canShare
  ? 'Share link to this book: opens the reader for the recipient'
  : 'Share link to this book (open a book first)';
 shareBtn.title = tip;
 shareBtn.setAttribute('aria-label', tip);
}

function shareCurrentBook() {
 if (!lastOpenedBookId) return;
 var book = findBookById(lastOpenedBookId);
 if (!book) return;
 var title = sanitizeDisplayTitle(book.title);
 var author = book.author ? book.author.trim() : '';
 var url = buildBookShareUrl(book.id);
 var clipboardText = buildBookShareClipboardText(title, author, url);
 tryWebShare([
  { title: title, url: url, text: buildBookShareWebText(author) },
  { title: title, text: clipboardText },
  { text: clipboardText, url: url },
  { text: clipboardText }
 ], function () { copyAnnotationShareText(clipboardText); });
}

function handleBookHashNavigation() {
 var bookId = parseBookIdFromHash();
 if (bookId) {
  if (bookId !== lastOpenedBookId) openBookById(bookId);
  return;
 }
 var raw = (window.location.hash || '').replace(/^#/, '').trim();
 var readerVisible = document.getElementById('reader')
  && !document.getElementById('reader').classList.contains('is-hidden');
 if (readerVisible && raw && !isBookShareHash(raw) && scrollToReaderAnchor(raw)) return;
 if (readerVisible) switchView('library');
}

function contextProviderLabel(providerKey) {
 if (providerKey === 'wiki') return 'Encyclopaedia';
 if (providerKey === 'dictionary') return 'Dictionary';
 if (providerKey === 'map') return 'Map';
 return 'Reference';
}

function updateContextLoadingElapsed() {
 var elapsedEl = document.getElementById('context-loading-elapsed');
 if (!elapsedEl || !contextLoadingStartedAt) return;
 var secs = Math.max(1, Math.floor((Date.now() - contextLoadingStartedAt) / 1000));
 elapsedEl.textContent = secs + 's';
}

function hideContextLoading() {
 contextLoadingActive = false;
 contextLoadingStartedAt = 0;
 if (contextLoadingSlowTimer) {
  clearTimeout(contextLoadingSlowTimer);
  contextLoadingSlowTimer = null;
 }
 if (contextLoadingTimeoutTimer) {
  clearTimeout(contextLoadingTimeoutTimer);
  contextLoadingTimeoutTimer = null;
 }
 if (contextLoadingElapsedTimer) {
  clearInterval(contextLoadingElapsedTimer);
  contextLoadingElapsedTimer = null;
 }
 var overlay = document.getElementById('context-loading-overlay');
 if (overlay) {
  overlay.classList.add('is-hidden');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.setAttribute('aria-busy', 'false');
 }
 updateContextLookupControls();
}

function showContextLoading(providerKey, query) {
 hideContextLoading();
 var overlay = document.getElementById('context-loading-overlay');
 var statusEl = document.getElementById('context-loading-status');
 var elapsedEl = document.getElementById('context-loading-elapsed');
 if (!overlay || !statusEl) return;
 contextLoadingActive = true;
 contextLoadingStartedAt = Date.now();
 var label = contextProviderLabel(providerKey);
 var quote = query ? '\u201C' + query + '\u201D' : 'your selection';
 statusEl.textContent = 'Looking up ' + quote + ' in ' + label + '\u2026';
 if (elapsedEl) {
  elapsedEl.classList.add('is-hidden');
  elapsedEl.textContent = '';
 }
 overlay.classList.remove('is-hidden');
 overlay.setAttribute('aria-hidden', 'false');
 overlay.setAttribute('aria-busy', 'true');
 updateContextLookupControls();
 contextLoadingSlowTimer = window.setTimeout(function () {
  if (!contextLoadingActive || !elapsedEl) return;
  elapsedEl.classList.remove('is-hidden');
  updateContextLoadingElapsed();
  contextLoadingElapsedTimer = window.setInterval(updateContextLoadingElapsed, 1000);
 }, CONTEXT_LOAD_SLOW_MS);
 contextLoadingTimeoutTimer = window.setTimeout(function () {
  if (!contextLoadingActive || !statusEl) return;
  statusEl.textContent = 'Still loading \u2014 slow connection?';
 }, CONTEXT_LOAD_TIMEOUT_MS);
}

function loadContextUrl(url, options) {
 if (!url || url === 'about:blank') return;
 var opts = options || {};
 var frame = document.getElementById('context-viewport');
 contextLoadPreviousUrl = frame.src || contextPlaceholderUrl();
 if (!opts.preserveHistory) {
  contextNavigationDepth = 0;
  isInternalBackNavigation = false;
 }
 contextReloadUrl = url;
 contextArticleUrl = url;
 var resolved = new URL(url, window.location.href);
 resolved.searchParams.set('_ts', String(Date.now()));
 frame.src = resolved.origin === window.location.origin
  ? resolved.pathname + resolved.search
  : resolved.href;
 updateContextBackButtonState();
 updateContextShareButtonState();
 updateContextLookupControls();
}

function loadContextFromProvider(template, providerKey, query) {
 if (!template || !navigator.onLine) return;
 var lookupQuery = typeof query === 'string' ? query : getLookupQuery();
 if (!lookupQuery) return;
 contextLastProviderKey = providerKey;
 var normalizedQuery = providerKey === 'map' ? normalizeMapQuery(lookupQuery) : lookupQuery;
 if (!normalizedQuery) return;
 showContextLoading(providerKey, normalizedQuery);
 if (providerKey === 'map') {
  loadContextUrl(buildProviderUrl(template, normalizedQuery));
  return;
 }
 loadContextUrl(buildProviderUrl(template, normalizedQuery));
}

function submitContextLookup() {
 cacheLookupSelection();
 var providerKey = getContextProviderKey();
 var template = getContextProviderTemplate(providerKey);
 var query = getLookupQuery();
 if (!query) return;
 if (!navigator.onLine) return;
 if (!template) return;
 loadContextFromProvider(template, providerKey, query);
}

function stopContextLoad() {
 if (!contextLoadingActive) return;
 var frame = document.getElementById('context-viewport');
 var fallback = contextLoadPreviousUrl || '';
 hideContextLoading();
 try {
  frame.contentWindow.stop();
 } catch (e) { /* cross-origin */ }
 if (fallback && fallback !== 'about:blank' && !isContextPlaceholderUrl(fallback)) {
  frame.src = fallback;
 } else {
  showContextPlaceholder();
 }
 updateContextLookupControls();
}

function reloadContextPanel() {
 if (contextLoadingActive) {
  stopContextLoad();
  return;
 }
 var frame = document.getElementById('context-viewport');
 if (!frame) return;
 if (isContextFrameOnPlaceholder(frame)) {
  submitContextLookup();
  return;
 }
 var url = syncContextArticleUrl() || contextReloadUrl || frame.src || '';
 if (!url || isContextPlaceholderUrl(url)) {
  submitContextLookup();
  return;
 }
 contextLoadPreviousUrl = frame.src || contextPlaceholderUrl();
 showContextLoading(getContextProviderKey(), getLookupQuery());
 frame.src = url;
 updateContextLookupControls();
}

function handleContextReloadClick() {
 if (contextLoadingActive) stopContextLoad();
 else reloadContextPanel();
}

function isContextFrameOnPlaceholder(frame) {
 if (!frame) return true;
 var src = frame.src || '';
 if (!src || src === window.location.href) return true;
 if (isContextPlaceholderUrl(src)) return true;
 try {
  return isContextPlaceholderUrl(frame.contentWindow.location.href);
 } catch (e) {
  return false;
 }
}

function navigateContextBack() {
 var frame = document.getElementById('context-viewport');
 if (!frame || isContextFrameOnPlaceholder(frame)) return;

 var historyDepth = 1;
 try {
  historyDepth = frame.contentWindow.history.length;
 } catch (e) {
  historyDepth = contextNavigationDepth;
 }

 if (historyDepth > 1) {
  isInternalBackNavigation = true;
  contextNavigationDepth = Math.max(0, contextNavigationDepth - 1);
  try {
   frame.contentWindow.history.back();
  } catch (e) {
   isInternalBackNavigation = false;
   showContextPlaceholder();
  }
 } else {
  showContextPlaceholder();
 }
 updateContextBackButtonState();
}

function updateContextBackButtonState() {
 var backBtn = document.getElementById('context-back-btn');
 var frame = document.getElementById('context-viewport');
 if (!backBtn) return;
 var canGoBack = frame && !isContextFrameOnPlaceholder(frame);
 backBtn.disabled = !canGoBack;
 var tip = canGoBack
  ? 'Go back in reference panel'
  : 'Go back in reference panel (no history)';
 backBtn.title = tip;
 backBtn.setAttribute('aria-label', tip);
}

function updateContextLookupControls() {
 var online = navigator.onLine;
 var searchBtn = document.getElementById('context-search-btn');
 var providerToggle = document.getElementById('context-provider-toggle');
 var reloadBtn = document.getElementById('context-reload-btn');
 var reloadIcon = document.getElementById('context-reload-icon');
 var providerKey = getContextProviderKey();
 var template = getContextProviderTemplate(providerKey);
 var query = getLookupQuery();
 var providerLabel = CONTEXT_PROVIDER_LABELS[providerKey] || 'Reference';

 document.querySelectorAll('.context-provider-option').forEach(function (option) {
  var key = option.getAttribute('data-provider');
  var optionTemplate = getContextProviderTemplate(key);
  var offlineBlocked = !online && key === 'map';
  var missingTemplate = !optionTemplate;
  var active = key === providerKey;
  option.disabled = offlineBlocked || missingTemplate;
  option.classList.toggle('is-active', active);
  option.setAttribute('aria-checked', active ? 'true' : 'false');
 });

 var searchIcon = document.getElementById('context-search-icon');
 if (searchIcon) {
  searchIcon.textContent = CONTEXT_PROVIDER_ICONS[providerKey] || CONTEXT_PROVIDER_ICONS.wiki;
 }

 if (searchBtn) {
  var searchDisabled = contextLoadingActive || !online || !template || !query;
  searchBtn.disabled = searchDisabled;
  var searchTip = 'Look up selection in ' + providerLabel;
  if (contextLoadingActive) searchTip = 'Loading reference…';
  else if (!query) searchTip = 'Select text in the book to look up';
  else if (!online) searchTip = 'Lookup unavailable offline';
  else if (!template) searchTip = 'Set a URL template in Settings';
  searchBtn.title = searchTip;
  searchBtn.setAttribute('aria-label', searchTip);
 }

 if (providerToggle) providerToggle.disabled = contextLoadingActive;

 if (reloadBtn && reloadIcon) {
  reloadBtn.disabled = false;
  if (contextLoadingActive) {
   reloadBtn.classList.add('is-stop');
   reloadIcon.textContent = '\uE5CD';
   reloadBtn.title = 'Stop loading';
   reloadBtn.setAttribute('aria-label', 'Stop loading');
  } else {
   reloadBtn.classList.remove('is-stop');
   reloadIcon.textContent = '\uE5D5';
   reloadBtn.title = 'Reload reference';
   reloadBtn.setAttribute('aria-label', 'Reload reference');
  }
 }
}

// =========================================================================
// V31-260617s/p | SECTION 15: EVENT LISTENERS
// ALL DOM BINDINGS — KEEP SEPARATE FROM STATE VARIABLES
// =========================================================================
function bindSettingsListeners() {
 document.getElementById('library-settings-btn').addEventListener('click', toggleLibrarySettings);
 document.getElementById('read-settings-btn').addEventListener('click', toggleLibrarySettings);

 document.getElementById('settings-theme-selector').addEventListener('change', function (e) {
  changeTheme(e.target.value, false);
 });

 ['settings-provider-wiki', 'settings-provider-dictionary', 'settings-provider-map'].forEach(function (id) {
  document.getElementById(id).addEventListener('change', applySettingsFromForm);
 });

 document.getElementById('settings-export-notes-btn').addEventListener('click', exportCurrentBookAnnotations);
 document.getElementById('settings-export-catalog-btn').addEventListener('click', exportCatalog);
 document.getElementById('settings-export-session-btn').addEventListener('click', exportSessionSnapshot);
 document.getElementById('settings-clear-cache-btn').addEventListener('click', clearLocalCache);
}

function bindLibraryListeners() {
 document.getElementById('library-upload-btn').addEventListener('click', function () {
  document.getElementById('md-upload').click();
 });
 document.getElementById('md-upload').addEventListener('change', handleMDUpload);
 document.getElementById('library-filter').addEventListener('input', function (e) {
  libraryFilterQuery = e.target.value.trim();
  renderLibraryGrid();
 });
}

function bindReaderNavListeners() {
 var viewport = document.getElementById('main-text-viewport');
 if (viewport) viewport.addEventListener('click', handleReaderContentLinkClick);
 document.getElementById('reader-back-btn').addEventListener('click', function () { switchView('library'); });
 document.getElementById('toc-toggle-btn').addEventListener('click', function () {
  toggleOverlayPanel('reader-toc');
 });
 var tocFilter = document.getElementById('toc-filter-input');
 if (tocFilter) {
  tocFilter.addEventListener('input', function (e) {
   tocFilterQuery = e.target.value.trim();
   renderTocList(currentBookToc);
  });
 }
 document.getElementById('notes-toggle-btn').addEventListener('click', function () {
  toggleOverlayPanel('reader-notes');
 });
 document.getElementById('reader-share-btn').addEventListener('click', shareCurrentBook);
 document.getElementById('context-toggle-btn').addEventListener('click', function () {
  toggleOverlayPanel('reader-context');
 });
 var backdrop = document.getElementById('reader-overlay-backdrop');
 if (backdrop) {
  backdrop.addEventListener('pointerdown', function () {
   if (!isReaderOverlayLayout()) return;
   closeAllReaderOverlays();
  });
 }
 document.addEventListener('pointerdown', handleReaderOverlayClickOut, true);
 var readerContainer = document.getElementById('reader-container');
 if (readerContainer) {
  readerContainer.addEventListener('click', handleReaderOverlayClickOut);
 }
}

function shouldCloseReaderOverlayFromEvent(event) {
 if (!isReaderOverlayLayout()) return false;
 var openId = getOpenReaderOverlay();
 if (!openId) return false;
 var panel = document.getElementById(openId);
 if (!panel) return false;
 if (panel.contains(event.target)) return false;
 if (event.target.closest('#reader-topbar')) return false;
 if (event.target.closest('#toc-toggle-btn, #notes-toggle-btn, #context-toggle-btn')) return false;
 return true;
}

function handleReaderOverlayClickOut(event) {
 if (!shouldCloseReaderOverlayFromEvent(event)) return;
 closeAllReaderOverlays();
}

function bindSearchListeners() {
 var searchInput = document.getElementById('reader-search-input');
 searchInput.addEventListener('input', handleSearchInput);
 searchInput.addEventListener('keydown', function (event) {
  if (event.key === 'Escape' || event.key === 'Enter') handleSearchKey(event);
 });
 document.getElementById('reader-search-prev-btn').addEventListener('click', function () { navigateSearch('prev'); });
 document.getElementById('reader-search-next-btn').addEventListener('click', function () { navigateSearch('next'); });
 document.getElementById('reader-font-cycle-btn').addEventListener('click', cycleReaderFontScale);
}

function bindContextListeners() {
 document.getElementById('context-back-btn').addEventListener('click', navigateContextBack);
 document.getElementById('context-reload-btn').addEventListener('click', handleContextReloadClick);
 var contextSearchBtn = document.getElementById('context-search-btn');
 contextSearchBtn.addEventListener('pointerdown', function () {
  cacheLookupSelection();
 });
 contextSearchBtn.addEventListener('click', submitContextLookup);
 document.getElementById('context-provider-toggle').addEventListener('pointerdown', function (event) {
  event.stopPropagation();
 });
 document.getElementById('context-provider-toggle').addEventListener('click', function (event) {
  event.preventDefault();
  event.stopPropagation();
  toggleContextProviderMenu();
 });
 document.querySelectorAll('.context-provider-option').forEach(function (option) {
  option.addEventListener('click', function () {
   if (option.disabled) return;
   selectContextProvider(option.getAttribute('data-provider'));
  });
 });
 document.getElementById('context-share-btn').addEventListener('click', shareContextArticle);
 var contextFrame = document.getElementById('context-viewport');
 contextFrame.addEventListener('load', function () {
  hideContextLoading();
  var src = contextFrame.src || '';
  if (!src || contextFrame.src === window.location.href || isContextPlaceholderUrl(src)) {
   contextArticleUrl = '';
   contextNavigationDepth = 0;
   updateContextBackButtonState();
   updateContextShareButtonState();
   syncContextPlaceholderConnectivity();
   return;
  }
  syncContextArticleUrl();
  updateContextShareButtonState();
  if (isInternalBackNavigation) {
   isInternalBackNavigation = false;
   updateContextBackButtonState();
   return;
  }
  contextNavigationDepth++;
  updateContextBackButtonState();
 });
 showContextPlaceholder();
 updateContextLookupControls();
}

function bindScrollListeners() {
 document.querySelectorAll('.scroll-track').forEach(function (container) {
  container.addEventListener('scroll', function () {
   handleScrollContainerScroll(container);
  }, { passive: true });
 });
}

function bindDocumentListeners() {
 document.addEventListener('selectionchange', scheduleLookupSelectionSync);
 window.addEventListener('resize', function () {
  if (!isMobileReaderLayout()) resetReaderChromeState();
  syncReaderOverlayChrome();
  syncSettingsOverlayChrome();
  scheduleReaderHeadingIndexRebuild();
  if (isContextProviderMenuOpen()) positionContextProviderMenu();
 });

 var settingsBackdrop = document.getElementById('settings-overlay-backdrop');
 if (settingsBackdrop) {
  settingsBackdrop.addEventListener('pointerdown', function () {
   if (!isLibrarySettingsOpen() || !isReaderOverlayLayout()) return;
   closeLibrarySettings();
  });
 }
 document.addEventListener('pointerdown', handleSettingsOverlayClickOut, true);
 document.addEventListener('pointerdown', function (event) {
  if (!isContextProviderMenuOpen()) return;
  if (event.target.closest('#context-split-search')) return;
  closeContextProviderMenu();
 }, true);
 document.addEventListener('keydown', function (event) {
  if (event.key === 'Escape') closeContextProviderMenu();
 });
 window.addEventListener('message', function (event) {
  if (event.origin !== window.location.origin) return;
  if (!event.data || event.data.type !== 'librus:map-ready') return;
  var frame = document.getElementById('context-viewport');
  if (!frame || event.source !== frame.contentWindow) return;
  var mapQuery = normalizeMapQuery(event.data.query || '');
  if (!mapQuery) {
   try {
    var mapUrl = new URL(frame.src || '', window.location.href);
    mapQuery = normalizeMapQuery(mapUrl.searchParams.get('q') || '');
   } catch (e) { /* ignore */ }
  }
  if (mapQuery) pushMapGeocodeToFrame(mapQuery);
  try {
   frame.contentWindow.postMessage({ type: 'librus:map-invalidate' }, window.location.origin);
  } catch (e) { /* cross-origin */ }
 });

 window.addEventListener('online', function () {
  updateContextLookupControls();
  syncContextPlaceholderConnectivity();
 });
 window.addEventListener('offline', function () {
  updateContextLookupControls();
  syncContextPlaceholderConnectivity();
 });
}

function syncInputClearButton(input) {
 if (!input) return;
 var wrap = input.closest('.input-clearable');
 if (!wrap) return;
 var btn = wrap.querySelector('.input-clear-btn');
 if (btn) btn.hidden = !input.value.length;
}

function syncAllInputClearButtons() {
 document.querySelectorAll('input[type="text"]').forEach(syncInputClearButton);
}

function initInputClearButtons() {
 var clearLabel = 'Clear';
 document.querySelectorAll('input[type="text"]').forEach(function (input) {
  if (input.dataset.clearBound === '1') return;
  var wrap;
  var host = input.parentElement;
  if (host && host.classList.contains('reader-main-search-field')) {
   wrap = host;
   wrap.classList.add('input-clearable');
  } else if (!input.closest('.input-clearable')) {
   wrap = document.createElement('div');
   wrap.className = 'input-clearable';
   input.parentNode.insertBefore(wrap, input);
   wrap.appendChild(input);
  } else {
   wrap = input.closest('.input-clearable');
  }
  if (!wrap || wrap.querySelector('.input-clear-btn')) {
   input.dataset.clearBound = '1';
   syncInputClearButton(input);
   return;
  }
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'input-clear-btn';
  btn.setAttribute('aria-label', clearLabel);
  btn.hidden = true;
  btn.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">&#xE14C;</span>';
  btn.addEventListener('click', function () {
   input.value = '';
   input.dispatchEvent(new Event('input', { bubbles: true }));
   input.dispatchEvent(new Event('change', { bubbles: true }));
   syncInputClearButton(input);
   input.focus();
  });
  wrap.appendChild(btn);
  input.addEventListener('input', function () { syncInputClearButton(input); });
  input.dataset.clearBound = '1';
  syncInputClearButton(input);
 });
}

function bindAllListeners() {
 bindSettingsListeners();
 bindLibraryListeners();
 bindReaderNavListeners();
 bindSearchListeners();
 bindContextListeners();
 bindNotesListeners();
 bindScrollListeners();
 bindDocumentListeners();
 initInputClearButtons();
}

// =========================================================================
// V31-260619a/o | SECTION 16: APP UPDATE STATUS
// SETTINGS FOOTER — MOBILE_CHECK (UP TO DATE) / MOBILE_ALERT (UPDATE)
// =========================================================================
var APP_UPDATE_ICONS = {
 uptodate: '\uF073',
 update: '\uF2D3'
};

function getAppUpdateSnapshot() {
 var pwa = window.LibrusPwa;
 if (pwa && typeof pwa.getStatus === 'function') return pwa.getStatus();
 return {
  supported: 'serviceWorker' in navigator,
  online: navigator.onLine,
  updateAvailable: false,
  versionLabel: '—',
  buildId: '—'
 };
}

function resolveAppUpdateState(snapshot) {
 if (snapshot.updateAvailable) return 'update';
 return 'uptodate';
}

function appUpdateCopy(state, snapshot) {
 var versionLabel = snapshot.versionLabel || '—';
 if (state === 'update') {
  return {
   label: 'Update available',
   title: 'App update available',
   detail: 'A newer version is ready (currently ' + versionLabel + ').',
   action: 'Refresh app'
  };
 }
 return {
  label: 'App up to date',
  title: 'App up to date',
  detail: 'Running version ' + versionLabel + '.',
  action: 'Check for updates'
 };
}

function renderAppUpdateStatus() {
 var badge = document.getElementById('settings-update-badge');
 var iconEl = document.getElementById('settings-update-icon');
 var detailEl = document.getElementById('settings-update-detail');
 var actionBtn = document.getElementById('settings-update-action');
 if (!badge || !iconEl || !detailEl || !actionBtn) return;

 var snapshot = getAppUpdateSnapshot();
 var state = resolveAppUpdateState(snapshot);
 var copy = appUpdateCopy(state, snapshot);
 var icon = APP_UPDATE_ICONS[state] || APP_UPDATE_ICONS.uptodate;

 badge.classList.remove('is-update', 'is-uptodate');
 badge.classList.add('is-' + state);
 badge.title = copy.title;
 iconEl.textContent = icon;
 detailEl.textContent = copy.label;
 actionBtn.textContent = copy.action;
 actionBtn.title = copy.detail;
 actionBtn.setAttribute('aria-label', copy.action + '. ' + copy.detail);
 actionBtn.dataset.updateState = state;
}

function handleAppUpdateAction() {
 var snapshot = getAppUpdateSnapshot();
 var state = resolveAppUpdateState(snapshot);
 if (state === 'update') {
  if (window.LibrusPwa && typeof window.LibrusPwa.applyUpdate === 'function') {
   window.LibrusPwa.applyUpdate();
  }
  return;
 }
 if (window.LibrusPwa && typeof window.LibrusPwa.checkForUpdates === 'function') {
  window.LibrusPwa.checkForUpdates().then(function (hasUpdate) {
   renderAppUpdateStatus();
   if (!hasUpdate) {
    var detailEl = document.getElementById('settings-update-detail');
    if (detailEl) detailEl.textContent = 'Up to date';
    var actionBtn = document.getElementById('settings-update-action');
    if (actionBtn) actionBtn.title = 'No update found — you are on the latest build.';
   }
  });
 }
}

function bindAppUpdateListeners() {
 var actionBtn = document.getElementById('settings-update-action');
 if (!actionBtn) return;
 actionBtn.addEventListener('click', handleAppUpdateAction);
 window.addEventListener('librus:pwa-update-available', renderAppUpdateStatus);
 window.addEventListener('librus:pwa-update-cleared', renderAppUpdateStatus);
 window.addEventListener('librus:pwa-ready', renderAppUpdateStatus);
}

function initAppUpdateStatus() {
 bindAppUpdateListeners();
 renderAppUpdateStatus();
}

// =========================================================================
// V31-260619a/p | SECTION 18: NOTES & WEB ANNOTATIONS
// LOCAL-FIRST ANNOTATION COLLECTION (W3C WEB ANNOTATION MODEL)
// =========================================================================
function notesViewport() {
 return document.getElementById('main-text-viewport');
}

function sectionIdFromSelection(selection) {
 if (!selection || !selection.anchorNode) return '';
 var parent = selection.anchorNode.parentElement;
 var section = parent ? parent.closest('[id]') : null;
 return section ? section.id : '';
}

var notesSelectionSyncRaf = 0;

function scheduleNotesSelectionSync() {
 if (notesSelectionSyncRaf) cancelAnimationFrame(notesSelectionSyncRaf);
 notesSelectionSyncRaf = requestAnimationFrame(function () {
  notesSelectionSyncRaf = 0;
  cacheNotesSelection();
  renderNotesSelectionPreview();
 });
}

function cacheNotesSelection() {
 var viewport = notesViewport();
 var selection = window.getSelection();
 if (!viewport || !window.LibrusAnnotations || !isSelectionInReader(selection)) return;
 var quote = LibrusAnnotations.buildTextQuoteFromSelection(viewport, selection);
 if (!quote) return;
 lastNotesSelectionQuote = quote;
 lastNotesSectionId = sectionIdFromSelection(selection);
}

function clearNotesSelectionCache() {
 lastNotesSelectionQuote = null;
 lastNotesSectionId = '';
}

function getNotesSelectionQuote() {
 var viewport = notesViewport();
 var selection = window.getSelection();
 if (viewport && window.LibrusAnnotations && isSelectionInReader(selection)) {
  var live = LibrusAnnotations.buildTextQuoteFromSelection(viewport, selection);
  if (live) {
   lastNotesSelectionQuote = live;
   lastNotesSectionId = sectionIdFromSelection(selection);
   return live;
  }
 }
 return lastNotesSelectionQuote;
}

function formatAnnotationDate(iso) {
 if (!iso) return '';
 try {
  var d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  var yy = String(d.getFullYear()).slice(-2);
  var mmm = d.toLocaleString('en-US', { month: 'short' }).replace(/\./g, '');
  var dd = String(d.getDate()).padStart(2, '0');
  var hh = String(d.getHours()).padStart(2, '0');
  var min = String(d.getMinutes()).padStart(2, '0');
  return dd + mmm + yy + ' ' + hh + ':' + min;
 } catch (e) {
  return '';
 }
}

function annotationCardLabel(annotation) {
 if (annotation.motivation === 'highlighting') return 'Highlight';
 if (annotation.motivation === 'replying') return 'Reply';
 return 'Note';
}

function currentBookTitleForShare() {
 var book = lastOpenedBookId ? findBookById(lastOpenedBookId) : null;
 if (book && book.title) return book.title;
 var titleEl = document.getElementById('reader-title');
 return titleEl && titleEl.textContent ? titleEl.textContent.trim() : (lastOpenedBookId || 'librus');
}

function buildAnnotationShareText(annotation) {
 var quote = LibrusAnnotations.getTextQuoteSelector(annotation);
 var lines = [];
 if (quote && quote.exact) lines.push('\u201C' + quote.exact + '\u201D');
 if (annotation.body && annotation.body.value) lines.push(annotation.body.value);
 lines.push('\u2014 ' + currentBookTitleForShare());
 lines.push(LIBRUS_SHARE_ATTRIBUTION);
 return lines.join('\n\n');
}

function copyAnnotationShareText(text) {
 if (!navigator.clipboard || !navigator.clipboard.writeText) return;
 navigator.clipboard.writeText(text).catch(function () { });
}

function buildAnnotationShareWebText(annotation) {
 var quote = LibrusAnnotations.getTextQuoteSelector(annotation);
 var lines = [];
 if (quote && quote.exact) lines.push('\u201C' + quote.exact + '\u201D');
 if (annotation.body && annotation.body.value) lines.push(annotation.body.value);
 lines.push('\u2014 ' + currentBookTitleForShare());
 return lines.join('\n\n');
}

function shareAnnotation(annotation) {
 var clipboardText = buildAnnotationShareText(annotation);
 var webText = buildAnnotationShareWebText(annotation);
 var bookTitle = currentBookTitleForShare();
 var shareTitle = annotationCardLabel(annotation) + ' · ' + bookTitle;
 var canonical = document.querySelector('link[rel="canonical"]');
 var url = lastOpenedBookId
  ? buildBookShareUrl(lastOpenedBookId)
  : (canonical && canonical.href ? canonical.href : LIBRUS_SITE_URL);
 tryWebShare([
  { title: shareTitle, url: url, text: webText + shareLinkGap() + LIBRUS_SHARE_ATTRIBUTION },
  { title: shareTitle, text: clipboardText },
  { text: clipboardText, url: url },
  { text: clipboardText }
 ], function () { copyAnnotationShareText(clipboardText); });
}

function syncNotesComposePlaceholder() {
 var input = document.getElementById('notes-input');
 if (!input) return;
 if (notesReplyParentId) {
  input.placeholder = NOTES_REPLY_PLACEHOLDER;
  return;
 }
 var quote = getNotesSelectionQuote();
 input.placeholder = quote ? NOTES_COMPOSE_WITH_QUOTE_PLACEHOLDER : NOTES_COMPOSE_PLACEHOLDER;
}

function renderNotesSelectionPreview() {
 var preview = document.getElementById('notes-selection');
 var saveBtn = document.getElementById('notes-save-btn');
 var highlightBtn = document.getElementById('notes-highlight-btn');
 if (!preview) return;
 var quote = getNotesSelectionQuote();
 if (!quote) {
  preview.textContent = '';
  preview.classList.add('is-empty');
  preview.hidden = true;
  if (saveBtn) saveBtn.disabled = !notesReplyParentId;
  if (highlightBtn) highlightBtn.disabled = true;
  syncNotesComposePlaceholder();
  return;
 }
 preview.textContent = '\u201C' + quote.exact + '\u201D';
 preview.classList.remove('is-empty');
 preview.hidden = false;
 if (saveBtn) saveBtn.disabled = false;
 if (highlightBtn) highlightBtn.disabled = false;
 syncNotesComposePlaceholder();
}

function resetNotesFilters() {
 notesFilterQuery = '';
 var input = document.getElementById('notes-filter-input');
 if (input) {
  input.value = '';
  syncInputClearButton(input);
 }
}

function annotationSearchText(annotation, quote) {
 var parts = [];
 if (quote && quote.exact) parts.push(quote.exact);
 if (annotation.body && annotation.body.value) parts.push(annotation.body.value);
 return parts.join(' ').toLowerCase();
}

function annotationMatchesNotesFilter(annotation, replies) {
 if (!notesFilterQuery) return true;
 var q = notesFilterQuery.toLowerCase();
 var quote = window.LibrusAnnotations ? LibrusAnnotations.getTextQuoteSelector(annotation) : null;
 if (annotationSearchText(annotation, quote).indexOf(q) !== -1) return true;
 return replies.filter(function (r) { return r.partOf === annotation.id; }).some(function (reply) {
  return annotationSearchText(reply, null).indexOf(q) !== -1;
 });
}

function renderNotesList() {
 var list = document.getElementById('notes-list');
 var empty = document.getElementById('notes-empty');
 if (!list) return;
 list.innerHTML = '';
 var roots = currentBookAnnotations.filter(function (a) { return !a.partOf; });
 var replies = currentBookAnnotations.filter(function (a) { return !!a.partOf; });
 var filteredRoots = roots.filter(function (a) { return annotationMatchesNotesFilter(a, replies); });
 if (!roots.length) {
  if (empty) {
   empty.textContent = NOTES_EMPTY_DEFAULT;
   empty.classList.remove('is-hidden');
  }
  return;
 }
 if (!filteredRoots.length) {
  if (empty) {
   empty.textContent = NOTES_EMPTY_FILTERED;
   empty.classList.remove('is-hidden');
  }
  return;
 }
 if (empty) empty.classList.add('is-hidden');
 filteredRoots.sort(function (a, b) {
  return (a.created || '').localeCompare(b.created || '');
 }).forEach(function (annotation) {
  list.appendChild(buildAnnotationCard(annotation, replies));
 });
}

function createNotesIconButton(iconHtml, title, extraClass, filled) {
 var btn = document.createElement('button');
 btn.type = 'button';
 btn.className = 'icon-btn' + (extraClass ? ' ' + extraClass : '');
 btn.title = title;
 btn.setAttribute('aria-label', title);
 var glyphClass = filled ? 'material-symbols-outlined icon-glyph-filled' : 'material-symbols-outlined';
 btn.innerHTML = '<span class="' + glyphClass + '" aria-hidden="true">' + iconHtml + '</span>';
 return btn;
}

function buildAnnotationCard(annotation, replies) {
 var card = document.createElement('article');
 card.className = 'reader-notes-annotation';
 card.dataset.annotationId = annotation.id;
 var quote = LibrusAnnotations.getTextQuoteSelector(annotation);
 var quoteEl = document.createElement('blockquote');
 quoteEl.className = 'reader-notes-quote';
 quoteEl.textContent = quote ? quote.exact : '(passage unavailable)';
 var meta = document.createElement('div');
 meta.className = 'reader-notes-meta';
 meta.textContent = annotationCardLabel(annotation) + ' · ' + formatAnnotationDate(annotation.created);
 card.appendChild(quoteEl);
 card.appendChild(meta);
 if (annotation.body && annotation.body.value) {
  var body = document.createElement('p');
  body.className = 'reader-notes-body-text';
  body.textContent = annotation.body.value;
  card.appendChild(body);
 }
 var actions = document.createElement('div');
 actions.className = 'reader-notes-card-actions';
 var jumpBtn = createNotesIconButton('&#xE244;', 'Go to passage', '', true);
 jumpBtn.addEventListener('click', function () {
  LibrusAnnotations.scrollToAnnotation(notesViewport(), annotation);
 });
 var replyBtn = createNotesIconButton('&#xE15E;', 'Reply', 'icon-btn-reply');
 replyBtn.addEventListener('click', function () {
  notesReplyParentId = annotation.id;
  clearNotesSelectionCache();
  var input = document.getElementById('notes-input');
  var cancelReplyBtn = document.getElementById('notes-cancel-reply-btn');
  if (input) {
   input.focus();
   input.placeholder = NOTES_REPLY_PLACEHOLDER;
  }
  if (cancelReplyBtn) cancelReplyBtn.classList.remove('is-hidden');
  renderNotesSelectionPreview();
 });
 var shareBtn = createNotesIconButton('&#xE80D;', 'Share note: sends the passage and comment via message, email, or another app', 'icon-btn-share');
 shareBtn.addEventListener('click', function () {
  shareAnnotation(annotation);
 });
 var deleteBtn = createNotesIconButton('&#xE872;', 'Delete note', 'icon-btn-danger');
 deleteBtn.addEventListener('click', function () {
  if (!lastOpenedBookId || !confirm('Delete this note and its replies?')) return;
  currentBookAnnotations = LibrusAnnotations.removeAnnotation(lastOpenedBookId, annotation.id);
  if (notesReplyParentId === annotation.id) notesReplyParentId = null;
  refreshNotesPanel();
 });
 actions.appendChild(jumpBtn);
 actions.appendChild(replyBtn);
 actions.appendChild(shareBtn);
 actions.appendChild(deleteBtn);
 card.appendChild(actions);
 replies.filter(function (r) { return r.partOf === annotation.id; }).forEach(function (reply) {
  var replyCard = document.createElement('div');
  replyCard.className = 'reader-notes-reply';
  if (reply.body && reply.body.value) {
   var replyBody = document.createElement('p');
   replyBody.className = 'reader-notes-body-text';
   replyBody.textContent = reply.body.value;
   replyCard.appendChild(replyBody);
  }
  var replyMeta = document.createElement('div');
  replyMeta.className = 'reader-notes-meta';
  replyMeta.textContent = 'Reply · ' + formatAnnotationDate(reply.created);
  replyCard.appendChild(replyMeta);
  card.appendChild(replyCard);
 });
 return card;
}

function applyCurrentBookHighlights() {
 var viewport = notesViewport();
 if (!viewport || !window.LibrusAnnotations) return;
 LibrusAnnotations.applyHighlights(viewport, currentBookAnnotations);
}

function refreshNotesPanel() {
 if (!lastOpenedBookId || !window.LibrusAnnotations) {
  currentBookAnnotations = [];
 } else {
  currentBookAnnotations = LibrusAnnotations.loadForBook(lastOpenedBookId);
 }
 renderNotesSelectionPreview();
 renderNotesList();
 applyCurrentBookHighlights();
}

function saveNoteFromCompose(motivation) {
 if (!lastOpenedBookId || !window.LibrusAnnotations) return;
 var quote = getNotesSelectionQuote();
 if (!quote && !notesReplyParentId) return;
 var input = document.getElementById('notes-input');
 var body = input ? input.value.trim() : '';
 if (motivation !== 'highlighting' && !body) return;
 var sectionId = lastNotesSectionId;
 if (!sectionId && quote) {
  var liveSelection = window.getSelection();
  if (isSelectionInReader(liveSelection)) {
   sectionId = sectionIdFromSelection(liveSelection);
  }
 }
 var annotation = LibrusAnnotations.createAnnotation({
  bookId: lastOpenedBookId,
  quote: quote || { exact: '', prefix: '', suffix: '', start: 0, end: 0 },
  body: body,
  motivation: notesReplyParentId ? 'replying' : motivation,
  partOf: notesReplyParentId || undefined,
  sectionId: sectionId
 });
 if (notesReplyParentId && !quote) {
  var parent = currentBookAnnotations.find(function (a) { return a.id === notesReplyParentId; });
  var parentQuote = parent ? LibrusAnnotations.getTextQuoteSelector(parent) : null;
  if (parentQuote) {
   annotation.target.selector[0] = Object.assign({}, parentQuote);
   annotation.target.selector[1] = { type: 'FragmentSelector', value: sectionId || lastOpenedBookId };
  }
 }
 LibrusAnnotations.addAnnotation(lastOpenedBookId, annotation);
 notesReplyParentId = null;
 if (input) {
  input.value = '';
  syncNotesComposePlaceholder();
 }
 if (motivation === 'highlighting') clearLookupSelection();
 clearNotesSelectionCache();
 refreshNotesPanel();
}

function exportCurrentBookAnnotations() {
 if (!lastOpenedBookId || !window.LibrusAnnotations) return;
 var payload = LibrusAnnotations.exportBookAnnotations(lastOpenedBookId);
 var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/ld+json' });
 var url = URL.createObjectURL(blob);
 var link = document.createElement('a');
 link.href = url;
 link.download = lastOpenedBookId + '-annotations.jsonld';
 link.click();
 URL.revokeObjectURL(url);
}

function bindNotesListeners() {
 var notesFilterInput = document.getElementById('notes-filter-input');
 if (notesFilterInput) {
  notesFilterInput.addEventListener('input', function (e) {
   notesFilterQuery = e.target.value.trim();
   renderNotesList();
  });
 }
 var saveBtn = document.getElementById('notes-save-btn');
 var highlightBtn = document.getElementById('notes-highlight-btn');
 var cancelReplyBtn = document.getElementById('notes-cancel-reply-btn');
 if (saveBtn) {
  saveBtn.addEventListener('click', function () { saveNoteFromCompose('commenting'); });
 }
 if (highlightBtn) {
  highlightBtn.addEventListener('click', function () { saveNoteFromCompose('highlighting'); });
 }
 if (cancelReplyBtn) {
  cancelReplyBtn.addEventListener('click', function () {
   notesReplyParentId = null;
   var input = document.getElementById('notes-input');
   if (input) syncNotesComposePlaceholder();
   cancelReplyBtn.classList.add('is-hidden');
   renderNotesSelectionPreview();
  });
 }
 var notesInput = document.getElementById('notes-input');
 if (notesInput) notesInput.addEventListener('pointerdown', cacheNotesSelection);
 [saveBtn, highlightBtn].forEach(function (btn) {
  if (btn) btn.addEventListener('pointerdown', cacheNotesSelection);
 });
 document.addEventListener('selectionchange', scheduleNotesSelectionSync);
}

// =========================================================================
// V31-260617s/r | SECTION 19: BOOTSTRAP
// =========================================================================
async function initApp() {
 defaultReaderHtml = document.getElementById('main-text-viewport').innerHTML;
 bindAllListeners();
 initAppUpdateStatus();
 syncBrandVersion();
 syncSettingsForm();
 syncAllInputClearButtons();
 syncSettingsBuildLabel();
 changeTheme(settings.theme, true);
 syncFaviconForTheme();
 window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
  if ((settings.theme || 'system') === 'system') syncFaviconForTheme();
 });
 applyReaderFontScale();
 updateContextLookupControls();
 updateReaderShareButtonState();
 switchView('library');
 await initLibrary();
 var hashBookId = parseBookIdFromHash();
 if (hashBookId) {
  openBookById(hashBookId);
 } else {
  scheduleSessionRestore();
 }
}

window.addEventListener('hashchange', handleBookHashNavigation);

window.addEventListener('pagehide', markTabSessionActive);

document.addEventListener('DOMContentLoaded', function () {
 initApp().catch(function (e) {
  console.error('init failed', e);
  switchView('library');
 });
});