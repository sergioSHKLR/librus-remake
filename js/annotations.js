/* Librus Annotations | V31-260618t/u — Web Annotation scaffold (local-first). */
(function (global) {
 var WA_CONTEXT = 'http://www.w3.org/ns/anno.jsonld';
 var STORAGE_KEY = 'librus_v31_annotations';
 var PREFIX_LEN = 32;
 var SUFFIX_LEN = 32;

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
  var link = document.querySelector('link[rel="canonical"]');
  var base = link && link.href
   ? link.href.replace(/\/$/, '')
   : 'https://librus.app';
  return base + '/books/' + encodeURIComponent(bookId) + '.md';
 }

 var viewportTextCache = { root: null, text: '' };

 function invalidateViewportTextCache() {
  viewportTextCache.root = null;
  viewportTextCache.text = '';
 }

 function textOffsetInViewport(viewport, container, offset) {
  if (container.nodeType !== Node.TEXT_NODE) return 0;
  var walker = document.createTreeWalker(viewport, NodeFilter.SHOW_TEXT);
  var count = 0;
  var current;
  while ((current = walker.nextNode())) {
   if (current === container) return count + offset;
   count += current.nodeValue.length;
  }
  return count;
 }

 function viewportFullText(viewport) {
  if (viewportTextCache.root !== viewport) {
   viewportTextCache.root = viewport;
   viewportTextCache.text = viewport.textContent || '';
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
  var rawStart = textOffsetInViewport(viewport, range.startContainer, range.startOffset);
  var rawEnd = textOffsetInViewport(viewport, range.endContainer, range.endOffset);
  var start = rawStart + leadTrim;
  var end = rawEnd - trailTrim;
  var full = viewportFullText(viewport);
  return {
   exact: exact,
   prefix: full.slice(Math.max(0, start - PREFIX_LEN), start),
   suffix: full.slice(end, end + SUFFIX_LEN),
   start: start,
   end: end
  };
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

 function rangeFromTextOffsets(root, start, end) {
  var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  var count = 0;
  var startNode = null;
  var startOffset = 0;
  var endNode = null;
  var endOffset = 0;
  while (walker.nextNode()) {
   var node = walker.currentNode;
   var len = node.nodeValue.length;
   if (!startNode && count + len > start) {
    startNode = node;
    startOffset = start - count;
   }
   if (!endNode && count + len >= end) {
    endNode = node;
    endOffset = end - count;
    break;
   }
   count += len;
  }
  if (!startNode || !endNode) return null;
  var range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  return range;
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

 var HIGHLIGHT_REGISTRY = 'librus-annotations';

 function clearHighlights() {
  if (!global.CSS || !global.CSS.highlights) return;
  global.CSS.highlights.delete(HIGHLIGHT_REGISTRY);
 }

 function applyHighlights(viewport, annotations) {
  clearHighlights();
  if (!viewport || !annotations || !annotations.length) return { anchored: 0, total: 0 };

  var fullText = viewport.textContent || '';
  var anchored = 0;

  annotations.forEach(function (annotation) {
    if (annotation.motivation !== 'highlighting' && !annotation.body) return;

    var selector = getTextQuoteSelector(annotation);
    if (!selector || !selector.exact) return;

    var offsets = resolveQuoteOffsets(fullText, selector);
    if (!offsets) return;

    var range = rangeFromTextOffsets(viewport, offsets.start, offsets.end);
    if (!range) return;

    try {
      var mark = document.createElement('mark');
      mark.className = 'librus-highlight';
      
        if (annotation.motivation === 'highlighting' && !annotation.body) {
        // Pure highlight - neon yellow
        mark.style.backgroundColor = '#fff44f';   // brighter neon
      } else {
        // Note - keep pale blue
        mark.style.backgroundColor = '#77c9ff';
      }
      
      mark.style.padding = '1px 3px';
      mark.style.borderRadius = '3px';
      mark.style.cursor = 'pointer';

      mark.dataset.annotationId = annotation.id;
      mark.addEventListener('click', function () {
        scrollToNoteCard(annotation.id);
      });

      range.surroundContents(mark);
      anchored++;
    } catch (e) {
      console.warn('Highlight failed for:', selector.exact);
    }
  });

  return { anchored: anchored, total: annotations.length };
 }

 function scrollToAnnotation(viewport, annotation) {
  var selector = getTextQuoteSelector(annotation);
  if (!selector || !viewport) return false;
  var offsets = resolveQuoteOffsets(viewport.textContent || '', selector);
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
  clearHighlights: clearHighlights,
  scrollToAnnotation: scrollToAnnotation
 };
})(window);