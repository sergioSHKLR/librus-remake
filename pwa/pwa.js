/* Librus PWA | Cleaned V31-260620a — registration + update handling */
(function () {
  var APP_NAME = 'LIBRUS';
  const APP_VERSION = 'v.32';
  const BUILD_ID = 'v32-r34';   // ← bump this on every change

  var waitingWorker = null;
  var registrationRef = null;

  function dispatch(name, detail) {
    window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
  }

function setUpdateAvailable(worker) {
  // Top gear orange dot
  const badge = document.getElementById('settings-update-badge-mini');
  if (badge) badge.classList.add('is-update');

  // Bottom settings panel (the one you showed)
  const updateContainer = document.getElementById('settings-update-badge');
  if (updateContainer) {
    updateContainer.classList.add('is-update');
    const updateLabel = document.getElementById('settings-update-detail');
    if (updateLabel) updateLabel.textContent = 'Update available — tap to refresh';
  }

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

    navigator.serviceWorker.register('./sw.js', {
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
      registrationRef.update().catch(() => { });
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
    }
  };

  // Force check on page load
  window.addEventListener('load', function () {
    setTimeout(() => {
      if (window.LibrusPwa && typeof window.LibrusPwa.checkForUpdates === 'function') {
        window.LibrusPwa.checkForUpdates().catch(() => { });
      }
    }, 2000);
  });
})();