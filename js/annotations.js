/* Librus Annotations | V31-260618t/u — Web Annotation scaffold (local-first). */
(function (global) {
 var WA_CONTEXT = 'http://www.w3.org/ns/anno.jsonld';
 var STORAGE_KEY = 'librus_v31_annotations';
 var PREFIX_LEN = 32;
 var SUFFIX_LEN = 32;
 var HIGHLIGHT_YELLOW = 'librus-highlight-yellow';
 var HIGHLIGHT_BLUE = 'librus-highlight-blue';

 function nowIso() {
  return new Date().toISOString();
 }

 function newAnnotationId() {
  if (global.crypto && global.crypto.randomUUID) {
   return 'urn:uuid:' + global.crypto.randomUUID();
  }
  return 'urn:uuid:' + nowIso().replace(/[^\d]/g, '') + '-' + Math.random().toString(16).slice(2);
 }

 function readStore() {
  try {
   var raw = localStorage.getItem(STORAGE_KEY);
   return raw ? JSON.parse(raw) : {};
  } catch (e) {
   return {};
  }
 }

 function writeStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
 }

 function bookSourceUrl(bookId) {
  if (typeof librusPath === 'function') {
   var root = librusPath('').replace(/\/$/, '');
   return root + '/books/' + encodeURIComponent(bookId) + '.md';
  }
  var link = document.querySelector('link[rel="canonical"]');
  var base = link && link.href
   ? link.href.replace(/\/$/, '')
   : 'https://librus.app';
  return base + '/books/' + encodeURIComponent(bookId) + '.md';
 }

 var viewportTextCache = { root: null, text: '' };
 var textNodeIndex = { root: null, entries: [] };
 var nodeStartOffset = new WeakMap();
 var annotationRangeMap = new Map();

 function supportsCssHighlights() {
  return !!(global.CSS && global.CSS.highlights && typeof global.Highlight === 'function');
 }

 function invalidateViewportTextCache() {
  viewportTextCache.root = null;
  viewportTextCache.text = '';
  textNodeIndex.root = null;
  textNodeIndex.entries = [];
 }

 function ensureTextNodeIndex(root) {
  if (!root) return;
  if (textNodeIndex.root === root && textNodeIndex.entries.length) return;
  textNodeIndex.root = root;
  textNodeIndex.entries = [];
  var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  var count = 0;
  while (walker.nextNode()) {
   var node = walker.currentNode;
   var len = node.nodeValue.length;
   nodeStartOffset.set(node, count);
   textNodeIndex.entries.push({ node: node, start: count, end: count + len });
   count += len;
  }
 }

 function textOffsetsForRange(viewport, range) {
  if (!viewport || !range) return null;
  ensureTextNodeIndex(viewport);
  var startBase = nodeStartOffset.get(range.startContainer);
  var endBase = nodeStartOffset.get(range.endContainer);
  if (startBase === undefined || endBase === undefined) return null;
  return {
   start: startBase + range.startOffset,
   end: endBase + range.endOffset
  };
 }

 function rangeFromTextOffsets(root, start, end) {
  ensureTextNodeIndex(root);
  var entries = textNodeIndex.entries;
  if (!entries.length) return null;
  var startNode = null;
  var startOffset = 0;
  var endNode = null;
  var endOffset = 0;
  for (var i = 0; i < entries.length; i++) {
   var entry = entries[i];
   if (!startNode && entry.end > start) {
    startNode = entry.node;
    startOffset = start - entry.start;
   }
   if (!endNode && entry.end >= end) {
    endNode = entry.node;
    endOffset = end - entry.start;
    break;
   }
  }
  if (!startNode || !endNode) return null;
  var range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  return range;
 }

 function viewportFullText(viewport) {
  if (viewportTextCache.root !== viewport || !viewportTextCache.text) {
   ensureTextNodeIndex(viewport);
   viewportTextCache.root = viewport;
   var parts = [];
   textNodeIndex.entries.forEach(function (entry) {
    parts.push(entry.node.nodeValue);
   });
   viewportTextCache.text = parts.join('');
  }
  return viewportTextCache.text;
 }

 function buildTextQuoteFromSelection(viewport, selection) {
  if (!viewport || !selection || selection.isCollapsed) return null;
  var range = selection.rangeCount ? selection.getRangeAt(0) : null;
  if (!range) return null;
  var raw = range.toString();
  if (!raw) return null;
  var leadTrim = raw.length - raw.trimStart().length;
  var trailTrim = raw.length - raw.trimEnd().length;
  var exact = raw.slice(leadTrim, raw.length - trailTrim);
  if (!exact) return null;
  var offsets = textOffsetsForRange(viewport, range);
  if (!offsets) return null;
  var start = offsets.start + leadTrim;
  var end = offsets.end - trailTrim;
  var full = viewportFullText(viewport);
  return {
   exact: exact,
   prefix: full.slice(Math.max(0, start - PREFIX_LEN), start),
   suffix: full.slice(end, end + SUFFIX_LEN),
   start: start,
   end: end
  };
 }

 function shouldApplyHighlight(annotation) {
  if (!annotation) return false;
  if (annotation.motivation !== 'highlighting' && !annotation.body) return false;
  var selector = getTextQuoteSelector(annotation);
  return !!(selector && selector.exact);
 }

 function resolveQuoteOffsets(fullText, selector) {
  if (!selector || !selector.exact) return null;
  var exact = selector.exact;
  if (typeof selector.start === 'number' && typeof selector.end === 'number') {
   if (fullText.slice(selector.start, selector.end) === exact) {
    return { start: selector.start, end: selector.end };
   }
  }
  if (typeof selector.start === 'number') {
   var hinted = selector.start;
   if (fullText.slice(hinted, hinted + exact.length) === exact) {
    return { start: hinted, end: hinted + exact.length };
   }
  }
  var pos = findQuotePosition(fullText, selector);
  if (pos < 0 && typeof selector.start === 'number') {
   var hint = selector.start;
   var nearest = -1;
   var nearestDist = Infinity;
   var idx = 0;
   while (idx < fullText.length) {
    var hit = fullText.indexOf(exact, idx);
    if (hit === -1) break;
    var dist = Math.abs(hit - hint);
    if (dist < nearestDist) {
     nearestDist = dist;
     nearest = hit;
    }
    idx = hit + 1;
   }
   if (nearest >= 0 && nearestDist <= exact.length + PREFIX_LEN) {
    pos = nearest;
   }
  }
  if (pos < 0) return null;
  return { start: pos, end: pos + exact.length };
 }

 function findQuotePosition(fullText, selector) {
  if (!selector || !selector.exact) return -1;
  var exact = selector.exact;
  var idx = 0;
  while (idx < fullText.length) {
   var pos = fullText.indexOf(exact, idx);
   if (pos === -1) return -1;
   var prefix = fullText.slice(Math.max(0, pos - selector.prefix.length), pos);
   var suffix = fullText.slice(pos + exact.length, pos + exact.length + selector.suffix.length);
   if ((!selector.prefix || prefix.endsWith(selector.prefix))
    && (!selector.suffix || suffix.startsWith(selector.suffix))) {
    return pos;
   }
   idx = pos + 1;
  }
  return -1;
 }

 function getTextQuoteSelector(annotation) {
  var target = annotation && annotation.target;
  if (!target || !target.selector) return null;
  var list = Array.isArray(target.selector) ? target.selector : [target.selector];
  for (var i = 0; i < list.length; i++) {
   if (list[i].type === 'TextQuoteSelector') return list[i];
  }
  return null;
 }

 function createAnnotation(options) {
  var quote = options.quote;
  var textQuote = {
   type: 'TextQuoteSelector',
   exact: quote.exact,
   prefix: quote.prefix || '',
   suffix: quote.suffix || ''
  };
  if (typeof quote.start === 'number') textQuote.start = quote.start;
  if (typeof quote.end === 'number') textQuote.end = quote.end;
  var selector = [
   textQuote,
   {
    type: 'FragmentSelector',
    value: options.sectionId || options.bookId
   }
  ];
  var motivation = options.motivation || 'commenting';
  var bodyValue = (options.body || '').trim();
  var annotation = {
   '@context': WA_CONTEXT,
   id: newAnnotationId(),
   type: 'Annotation',
   motivation: motivation,
   created: nowIso(),
   modified: nowIso(),
   creator: { type: 'Person', name: options.creatorName || 'You' },
   target: {
    source: options.source || bookSourceUrl(options.bookId),
    selector: selector
   }
  };
  if (options.partOf) annotation.partOf = options.partOf;
  if (bodyValue) {
   annotation.body = {
    type: 'TextualBody',
    value: bodyValue,
    purpose: motivation === 'highlighting' ? 'highlighting' : 'commenting'
   };
  }
  return annotation;
 }

 function loadForBook(bookId) {
  var store = readStore();
  return Array.isArray(store[bookId]) ? store[bookId].slice() : [];
 }

 function saveForBook(bookId, annotations) {
  var store = readStore();
  store[bookId] = annotations;
  writeStore(store);
 }

 function addAnnotation(bookId, annotation) {
  var list = loadForBook(bookId);
  list.push(annotation);
  saveForBook(bookId, list);
  return annotation;
 }

 function removeAnnotation(bookId, annotationId) {
  var list = loadForBook(bookId).filter(function (a) {
   return a.id !== annotationId && a.partOf !== annotationId;
  });
  saveForBook(bookId, list);
  return list;
 }

 function exportBookAnnotations(bookId) {
  return {
   '@context': WA_CONTEXT,
   type: 'AnnotationCollection',
   label: 'Annotations — ' + bookId,
   items: loadForBook(bookId)
  };
 }

 function getHighlightRegistry(name) {
  var existing = global.CSS.highlights.get(name);
  if (existing) return existing;
  var registry = new Highlight();
  global.CSS.highlights.set(name, registry);
  return registry;
 }

 function clearCssHighlightRegistries() {
  if (!supportsCssHighlights()) return;
  global.CSS.highlights.delete(HIGHLIGHT_YELLOW);
  global.CSS.highlights.delete(HIGHLIGHT_BLUE);
  annotationRangeMap.clear();
 }

 function highlightRegistryForAnnotation(annotation) {
  return (annotation.motivation === 'highlighting' && !annotation.body)
   ? HIGHLIGHT_YELLOW
   : HIGHLIGHT_BLUE;
 }

 function createHighlightMark(annotation) {
  var mark = document.createElement('mark');
  mark.className = 'librus-highlight';
  if (annotation.motivation === 'highlighting' && !annotation.body) {
   mark.classList.add('librus-highlight--yellow');
  } else {
   mark.classList.add('librus-highlight--blue');
  }
  if (annotation.body && annotation.body.value) {
   mark.dataset.note = '1';
  }
  mark.style.padding = '1px 3px';
  mark.style.borderRadius = '3px';
  mark.style.cursor = 'pointer';
  mark.dataset.annotationId = annotation.id;
  mark.addEventListener('click', function () {
   if (typeof global.scrollToNoteCard === 'function') {
    global.scrollToNoteCard(annotation.id);
   }
  });
  return mark;
 }

 function clearHighlights() {
  clearCssHighlightRegistries();
 }

 function clearAllHighlightMarks(viewport) {
  clearCssHighlightRegistries();
  if (!viewport) return;
  viewport.querySelectorAll('mark.librus-highlight, mark.highlight, .librus-highlight').forEach(function (el) {
   var parent = el.parentNode;
   if (!parent) return;
   parent.replaceChild(document.createTextNode(el.textContent), el);
   parent.normalize();
  });
 }

 function removeHighlightForAnnotation(viewport, annotationId) {
  if (!annotationId) return;
  var entry = annotationRangeMap.get(annotationId);
  if (entry && supportsCssHighlights()) {
   var registry = global.CSS.highlights.get(entry.registry);
   if (registry) registry.delete(entry.range);
   annotationRangeMap.delete(annotationId);
   return;
  }
  if (!viewport) return;
  var mark = viewport.querySelector('.librus-highlight[data-annotation-id="' + annotationId + '"]');
  if (!mark) return;
  var parent = mark.parentNode;
  if (parent) {
   parent.replaceChild(document.createTextNode(mark.textContent), mark);
   parent.normalize();
  }
 }

 function applySingleHighlight(viewport, annotation) {
  if (!viewport || !shouldApplyHighlight(annotation)) return false;
  if (annotationRangeMap.has(annotation.id)) return true;
  if (viewport.querySelector('.librus-highlight[data-annotation-id="' + annotation.id + '"]')) {
   return true;
  }

  var selector = getTextQuoteSelector(annotation);
  var fullText = viewportFullText(viewport);
  var offsets = resolveQuoteOffsets(fullText, selector);
  if (!offsets) return false;

  var range = rangeFromTextOffsets(viewport, offsets.start, offsets.end);
  if (!range) return false;

  if (supportsCssHighlights()) {
   var registryName = highlightRegistryForAnnotation(annotation);
   getHighlightRegistry(registryName).add(range);
   annotationRangeMap.set(annotation.id, {
    range: range,
    registry: registryName,
    start: offsets.start,
    end: offsets.end
   });
   return true;
  }

  try {
   range.surroundContents(createHighlightMark(annotation));
   return true;
  } catch (e) {
   console.warn('Highlight failed for:', selector.exact);
   return false;
  }
 }

 function applyHighlights(viewport, annotations) {
  clearHighlights();
  clearAllHighlightMarks(viewport);
  if (!viewport || !annotations || !annotations.length) return { anchored: 0, total: 0 };

  var anchored = 0;
  annotations.forEach(function (annotation) {
   if (applySingleHighlight(viewport, annotation)) anchored++;
  });

  return { anchored: anchored, total: annotations.length };
 }

 function findAnnotationAtOffset(offset) {
  var hitId = '';
  annotationRangeMap.forEach(function (entry, id) {
   if (offset >= entry.start && offset < entry.end) hitId = id;
  });
  return hitId;
 }

 function bindHighlightClickHandler(viewport) {
  if (!viewport || viewport.dataset.highlightClickBound === '1') return;
  viewport.dataset.highlightClickBound = '1';
  viewport.addEventListener('click', function (e) {
   if (!supportsCssHighlights() || !annotationRangeMap.size) return;
   var caret = document.caretRangeFromPoint(e.clientX, e.clientY);
   if (!caret || !viewport.contains(caret.startContainer)) return;
   var offsets = textOffsetsForRange(viewport, caret);
   if (!offsets) return;
   var hitId = findAnnotationAtOffset(offsets.start);
   if (!hitId || typeof global.scrollToNoteCard !== 'function') return;
   global.scrollToNoteCard(hitId);
  });
 }

 function scrollToAnnotation(viewport, annotation) {
  var selector = getTextQuoteSelector(annotation);
  if (!selector || !viewport) return false;
  var offsets = resolveQuoteOffsets(viewportFullText(viewport), selector);
  if (!offsets) return false;
  var range = rangeFromTextOffsets(viewport, offsets.start, offsets.end);
  if (!range) return false;
  var rect = range.getBoundingClientRect();
  var container = viewport.closest('.scroll-track') || viewport;
  container.scrollTop += rect.top - container.getBoundingClientRect().top - 48;
  return true;
 }

 global.LibrusAnnotations = {
  CONTEXT: WA_CONTEXT,
  buildTextQuoteFromSelection: buildTextQuoteFromSelection,
  invalidateViewportTextCache: invalidateViewportTextCache,
  createAnnotation: createAnnotation,
  loadForBook: loadForBook,
  saveForBook: saveForBook,
  addAnnotation: addAnnotation,
  removeAnnotation: removeAnnotation,
  exportBookAnnotations: exportBookAnnotations,
  getTextQuoteSelector: getTextQuoteSelector,
  applyHighlights: applyHighlights,
  applySingleHighlight: applySingleHighlight,
  removeHighlightForAnnotation: removeHighlightForAnnotation,
  clearAllHighlightMarks: clearAllHighlightMarks,
  clearHighlights: clearHighlights,
  bindHighlightClickHandler: bindHighlightClickHandler,
  scrollToAnnotation: scrollToAnnotation
 };
})(window);