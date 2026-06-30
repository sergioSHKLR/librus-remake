/* Librus service worker | V31-260620a/u — bump CACHE_VERSION on each deploy. */
const CACHE_VERSION = 'librus-v32-r02';

const SHELL_ASSETS = [
  './index.html',
  './js/main.js',
  './js/annotations.js',
  './pwa/pwa.js',
  './styles/layout-opt.css',
  './styles/fonts-opt.css',
  './styles/colors-opt.css',
  './manifest.webmanifest',
  './pages/context-placeholder.html',
  './pages/map.html',
  './books/manifest.json',
  './icons/online.svg',
  './icons/offline.svg',
];

function stashInCache(cacheName, request, response) {
  if (!response || !response.ok) return Promise.resolve();

  if (!request || !request.url || request.url.startsWith('file://')) {
    return Promise.resolve(); // silent skip
  }

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
 return /\/books\/[^/]+\.md$/i.test(pathname) || /\/books\/manifest\.json$/i.test(pathname);
}

function isShellAsset(pathname) {
 return /\.(?:js|css|woff2|html|json|svg|png|ico|webmanifest)$/i.test(pathname)
  || pathname.endsWith('/');
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

 if (event.request.mode === 'navigate') {
  event.respondWith(
   fetch(event.request).then(function (response) {
    stashInCache(CACHE_VERSION, './index.html', response);
    return response;
   }).catch(function () {
    return caches.match('./index.html');
   })
  );
  return;
 }

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

 if (isBookAsset(url.pathname)) {
  event.respondWith(
   caches.open(CACHE_VERSION).then(function (cache) {
    return cache.match(event.request).then(function (cached) {
     var network = fetch(event.request).then(function (response) {
      if (response && response.ok) {
       var copy = response.clone();
       if (event.request && event.request.url && !event.request.url.startsWith('file://')) {
        cache.put(event.request, copy);
       }
      }
      return response;
     }).catch(function () {
      return cached;
     });
     return cached || network;
    });
   })
  );
  return;
 }

 if (isShellAsset(url.pathname)) {
  event.respondWith(
   caches.match(event.request).then(function (cached) {
    var network = fetch(event.request).then(function (response) {
     stashInCache(CACHE_VERSION, event.request, response);
     return response;
    });
    return cached || network;
   })
  );
 }
});