/* Librus PWA | V31-260620a/u — registration, update detection, LED status hooks. */
(function () {
 var APP_NAME = 'LIBRUS';
 var APP_VERSION = 'v.31t';
 var BUILD_ID = 'v31-r84';
 var waitingWorker = null;
 var registrationRef = null;

 function dispatch(name, detail) {
  window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
 }

 function setUpdateAvailable(worker) {
  if (!worker) return;
  waitingWorker = worker;
  dispatch('librus:pwa-update-available', { buildId: BUILD_ID });
 }

 function clearUpdateAvailable() {
  waitingWorker = null;
  dispatch('librus:pwa-update-cleared');
 }

 function watchWorker(worker) {
  if (!worker) return;
  if (worker.state === 'installed' && navigator.serviceWorker.controller) {
   setUpdateAvailable(worker);
  }
  worker.addEventListener('statechange', function () {
   if (worker.state === 'installed' && navigator.serviceWorker.controller) {
    setUpdateAvailable(worker);
   }
   if (worker.state === 'activated') clearUpdateAvailable();
  });
 }

 function registerUpdateListeners(registration) {
  registrationRef = registration;
  if (registration.waiting) setUpdateAvailable(registration.waiting);
  registration.addEventListener('updatefound', function () {
   watchWorker(registration.installing);
  });
 }

 function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return Promise.resolve(null);
  return navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' })
   .then(function (registration) {
    registerUpdateListeners(registration);
    dispatch('librus:pwa-ready');
    return registration;
   })
   .catch(function (err) {
    console.warn('service worker registration failed', err);
    return null;
   });
 }

 function waitForWaitingWorker(maxAttempts) {
  return new Promise(function (resolve) {
   var attempts = 0;
   function check() {
    if (waitingWorker) {
     resolve(true);
     return;
    }
    if (registrationRef && registrationRef.waiting) {
     setUpdateAvailable(registrationRef.waiting);
     resolve(true);
     return;
    }
    if (++attempts >= maxAttempts) {
     resolve(false);
     return;
    }
    window.setTimeout(check, 150);
   }
   check();
  });
 }

 function checkForUpdates() {
  if (!registrationRef) return Promise.resolve(false);
  return registrationRef.update()
   .then(function () { return waitForWaitingWorker(24); })
   .catch(function () { return false; });
 }

 function applyUpdate() {
  if (!waitingWorker) return Promise.resolve(false);
  waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  return new Promise(function (resolve) {
   navigator.serviceWorker.addEventListener('controllerchange', function onChange() {
    navigator.serviceWorker.removeEventListener('controllerchange', onChange);
    resolve(true);
    window.location.reload();
   });
  });
 }

 function clearServiceWorkerCaches() {
  if (!('caches' in window)) return Promise.resolve();
  return caches.keys().then(function (keys) {
   return Promise.all(keys.map(function (key) { return caches.delete(key); }));
  });
 }

 function unregisterServiceWorker() {
  if (!('serviceWorker' in navigator)) return Promise.resolve();
  return navigator.serviceWorker.getRegistrations().then(function (regs) {
   return Promise.all(regs.map(function (reg) { return reg.unregister(); }));
  });
 }

 document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'visible') {
   checkForUpdates().then(function (hasUpdate) {
    if (hasUpdate) dispatch('librus:pwa-update-available', { buildId: BUILD_ID });
   });
  }
 });

 window.LibrusPwa = {
  appName: APP_NAME,
  versionLabel: APP_VERSION,
  buildId: BUILD_ID,
  getStatus: function () {
   return {
    supported: 'serviceWorker' in navigator,
    online: navigator.onLine,
    updateAvailable: !!waitingWorker,
    appName: APP_NAME,
    versionLabel: APP_VERSION,
    buildId: BUILD_ID
   };
  },
  checkForUpdates: checkForUpdates,
  applyUpdate: applyUpdate,
  clearCaches: clearServiceWorkerCaches,
  unregister: unregisterServiceWorker
 };

 registerServiceWorker();
})();