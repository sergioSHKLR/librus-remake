/* js/markdown-to-html.js — shared MD → HTML + TOC (browser + Node) */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LibrusMarkdown = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var TOC_MIN_LEVEL = 2;
  var TOC_MAX_LEVEL = 5;

  var mdFootnoteDefs = {};
  var mdFootnoteRefs = {};

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

  function parseFrontmatter(text) {
    var match = String(text || '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    if (!match) return { meta: {}, body: text };
    var meta = {};
    match[1].split(/\r?\n/).forEach(function (line) {
      line = line.trim();
      if (!line || line.charAt(0) === '#') return;
      var kv = line.match(/^([A-Za-z0-9_-]+):\s*(.+)$/);
      if (!kv) return;
      meta[kv[1].toLowerCase().replace(/-/g, '_')] = kv[2].trim().replace(/^["']|["']$/g, '');
    });
    return { meta: meta, body: text.slice(match[0].length) };
  }

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
      if (/^\/assets\/images\//i.test(src)) src = src.replace(/^\/assets\/images\//i, '/images/');
    if (/^images\//i.test(src)) src = '/' + src;
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
        '<summary>' +
        '<svg class="icon md-block-expand-icon" aria-hidden="true"><use href="../icons/sprite.svg#chevron-down"/></svg>' +
        '<span class="md-block-expand-label">' + parseInlineMarkdown(title || 'More') + '</span>' +
        '</summary>' +
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

  function htmlPathFromMdFilename(filename) {
    return filename.replace(/\.md$/i, '.html');
  }

  function tocPathFromMdFilename(filename) {
    return filename.replace(/\.md$/i, '.toc.json');
  }

  return {
    markdownToHtml: markdownToHtml,
    parseFrontmatter: parseFrontmatter,
    sanitizeDisplayTitle: sanitizeDisplayTitle,
    htmlPathFromMdFilename: htmlPathFromMdFilename,
    tocPathFromMdFilename: tocPathFromMdFilename
  };
}));