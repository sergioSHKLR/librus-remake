/* Lucide sprite helpers — icons/sprite.svg built by scripts/build-lucide-icons.js */
(function (global) {
  function spriteHref() {
    return (typeof librusPath === 'function' ? librusPath('icons/sprite.svg') : 'icons/sprite.svg');
  }

  function html(name, opts) {
    opts = opts || {};
    var cls = 'icon';
    if (opts.className) cls += ' ' + opts.className;
    var size = opts.size || 24;
    return '<svg class="' + cls + '" width="' + size + '" height="' + size + '" aria-hidden="true">' +
      '<use href="' + spriteHref() + '#' + name + '"/></svg>';
  }

  function svg(name, opts) {
    opts = opts || {};
    var el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    el.setAttribute('aria-hidden', 'true');
    el.classList.add('icon');
    if (opts.className) {
      opts.className.split(/\s+/).forEach(function (c) {
        if (c) el.classList.add(c);
      });
    }
    var size = opts.size || 24;
    el.setAttribute('width', String(size));
    el.setAttribute('height', String(size));
    var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', spriteHref() + '#' + name);
    el.appendChild(use);
    return el;
  }

  function setIcon(host, name, opts) {
    if (!host) return;
    host.innerHTML = html(name, opts);
  }

  global.LibrusIcons = {
    sprite: spriteHref,
    html: html,
    svg: svg,
    setIcon: setIcon
  };
})(typeof window !== 'undefined' ? window : global);