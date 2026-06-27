/* Librus PWA | Cleaned V31-260620a — registration + update handling */
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

  // === MAIN SERVICE WORKER REGISTRATION ===
  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('./pwa/sw.js', { 
      scope: './',
      updateViaCache: 'none'
    })
    .then(reg => {
      console.log('✅ Service Worker registered with scope:', reg.scope);
      registerUpdateListeners(reg);
    })
    .catch(err => {
      console.error('❌ Service Worker registration failed:', err);
    });
  }

  // Register on load
  window.addEventListener('load', registerServiceWorker);

  // Update check on visibility change
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && registrationRef) {
      registrationRef.update().catch(() => {});
    }
  });

  // Public API
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
    checkForUpdates: function () {
      return registrationRef ? registrationRef.update() : Promise.resolve(false);
    },
    applyUpdate: function () {
      if (!waitingWorker) return Promise.resolve(false);
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      return new Promise(resolve => {
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          resolve(true);
          window.location.reload();
        });
      });
    },
    clearCaches: function () {
      if (!('caches' in window)) return Promise.resolve();
      return caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
    },
    unregister: function () {
      if (!('serviceWorker' in navigator)) return Promise.resolve();
      return navigator.serviceWorker.getRegistrations().then(regs => 
        Promise.all(regs.map(reg => reg.unregister()))
      );
    }
  };
})();