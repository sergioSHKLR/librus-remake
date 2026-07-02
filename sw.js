/* Librus service worker | nano-SSG — bump CACHE_VERSION on each deploy. */
const CACHE_VERSION = 'librus-v32-r26';

const SHELL_ASSETS = [
  './index.html',
  './js/markdown-to-html.js',
  './js/main.js',
  './js/annotations.js',
  './pwa/pwa.js',
  './styles/layout-opt.css',
  './styles/fonts-opt.css',
  './styles/colors-opt.css',
  './styles/icons.css',
  './js/base-path.js',
  './js/icons.js',
  './icons/sprite.svg',
  './manifest.webmanifest',
  './pages/context-placeholder.html',
  './pages/context-offline.html',
  './pages/context-theme.css',
  './pages/context-theme.js',
  './pages/pdf-viewer.html',
  './pages/map.html',
  './books/manifest.json',
  './icons/expand.svg',
  './images/vine.png',
];

function stashInCache(cacheName, request, response) {
  if (!response || !response.ok) return Promise.resolve();
  if (!request || !request.url || request.url.startsWith('file://')) return Promise.resolve();

  var copy = response.clone();
  return caches.open(cacheName).then(function (cache) {
    return cache.put(request, copy);
  });
}

function precacheAssets(cache, assets) {
  return Promise.all(assets.map(function (url) {
    return cache.add(url).catch(function (err) {
      console.warn('[sw] precache skipped:', url, err && err.message ? err.message : err);
    });
  }));
}

function isBookAsset(pathname) {
  return /\/books\/[^/]+\.(?:html|toc\.json|md)$/i.test(pathname) || /\/books\/manifest\.json$/i.test(pathname);
}

function isStaticPage(pathname) {
  return /\/pages\/[^/]+\.html$/i.test(pathname);
}

function isShellAsset(pathname) {
  if (isBookAsset(pathname) || isStaticPage(pathname)) return false;
  return /\.(?:js|css|woff2|json|svg|png|ico|webmanifest)$/i.test(pathname)
    || pathname.endsWith('/');
}

function isAppShellBody(body) {
  return /id=["']librus-app["']/.test(body || '');
}

function isGeocodeRequest(pathname) {
  return /\/geocode$/i.test(pathname);
}

function fetchGeocode(query) {
  var nominatimUrl = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q='
    + encodeURIComponent(query);
  return fetch(nominatimUrl, {
    headers: {
      'Accept': 'application/json',
      'Accept-Language': 'en',
      'User-Agent': 'LibrusZero/1.0 (map lookup; contact: https://librus.app)'
    }
  }).then(function (response) {
    return response.text().then(function (body) {
      return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        }
      });
    });
  });
}

function asResponse(value) {
  return value instanceof Response ? value : Response.error();
}

function matchCached(request) {
  return caches.match(request, { ignoreSearch: true });
}

function cacheFirst(request) {
  return matchCached(request).then(function (cached) {
    if (cached) return cached;
    return fetch(request).then(function (response) {
      if (response && response.ok) stashInCache(CACHE_VERSION, request, response);
      return response;
    }).catch(function () {
      return matchCached(request);
    });
  }).then(asResponse);
}

function networkFirst(request) {
  var pathname = new URL(request.url).pathname;
  var isBookHtml = /\/books\/[^/]+\.html$/i.test(pathname);

  return fetch(request).then(function (response) {
    if (!response || !response.ok) return response;

    if (isBookHtml) {
      return response.clone().text().then(function (body) {
        if (isAppShellBody(body)) return response;
        stashInCache(CACHE_VERSION, request, response);
        return response;
      });
    }

    stashInCache(CACHE_VERSION, request, response);
    return response;
  }).catch(function () {
    return matchCached(request);
  }).then(asResponse);
}

self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      return precacheAssets(cache, SHELL_ASSETS);
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key !== CACHE_VERSION; }).map(function (key) {
          return caches.delete(key);
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;

  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (isGeocodeRequest(url.pathname)) {
    var placeQuery = url.searchParams.get('q') || '';
    if (!placeQuery.trim()) {
      event.respondWith(new Response('[]', {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        }
      }));
      return;
    }
    event.respondWith(fetchGeocode(placeQuery.trim()));
    return;
  }

  if (isStaticPage(url.pathname)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  if (isBookAsset(url.pathname) || isShellAsset(url.pathname)) {
    event.respondWith(networkFirst(event.request));
  }
});