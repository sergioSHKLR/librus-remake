/* Resolve site root for GitHub Pages (/repo/, /repo/dev/) and local serve. */
(function (g) {
  function detectBase() {
    var meta = document.querySelector('meta[name="librus-base"]');
    if (meta) {
      var content = (meta.getAttribute('content') || '').trim();
      if (content === '' || content === '/') return '/';
      return content.endsWith('/') ? content : content + '/';
    }

    var path = g.location.pathname || '/';
    var devMatch = path.match(/^(.*\/dev\/)/);
    if (devMatch) return devMatch[1];

    if (g.location.hostname && g.location.hostname.endsWith('github.io')) {
      var repoMatch = path.match(/^\/([^/]+)\//);
      if (repoMatch) return '/' + repoMatch[1] + '/';
    }

    return '/';
  }

  g.LIBRUS_BASE = detectBase();

  g.librusPath = function (subpath) {
    var base = g.LIBRUS_BASE || '/';
    var clean = String(subpath || '').replace(/^\//, '');
    return base === '/' ? '/' + clean : base + clean;
  };
})(typeof window !== 'undefined' ? window : global);