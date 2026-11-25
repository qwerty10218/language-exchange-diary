export const PWA_DISMISS_KEY = 'language-exchange-diary:pwa-hint:v1';

export function isStandaloneMode(win = typeof window !== 'undefined' ? window : undefined) {
  if (!win) return false;
  try {
    if (win.matchMedia?.('(display-mode: standalone)').matches) return true;
    if (win.navigator && 'standalone' in win.navigator && win.navigator.standalone === true) return true;
  } catch {
    return false;
  }
  return false;
}

export function isIosSafari(userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '') {
  const ua = String(userAgent ?? '');
  const isIos = /iPhone|iPad|iPod/i.test(ua);
  const isWebKit = /WebKit/i.test(ua);
  const isOtherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
  return isIos && isWebKit && !isOtherBrowser;
}

export function loadPwaDismissed(getStorage) {
  try {
    return getStorage().getItem(PWA_DISMISS_KEY) === 'dismissed';
  } catch {
    return false;
  }
}

export function savePwaDismissed(getStorage) {
  try {
    getStorage().setItem(PWA_DISMISS_KEY, 'dismissed');
  } catch {
    // Non-fatal if storage is unavailable.
  }
}

/**
 * @param {string} baseUrl
 * @param {(applyUpdate: () => void) => void} onUpdateReady
 * @returns {() => void}
 */
export function registerAppServiceWorker(baseUrl, onUpdateReady) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return () => {};
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const swUrl = `${normalizedBase}sw.js`;
  let disposed = false;
  let reloading = false;

  const onControllerChange = () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  };
  navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

  navigator.serviceWorker
    .register(swUrl, { scope: normalizedBase })
    .then(reg => {
      if (disposed) return;
      const notify = worker => {
        if (!worker || disposed) return;
        onUpdateReady(() => worker.postMessage({ type: 'SKIP_WAITING' }));
      };
      if (reg.waiting && navigator.serviceWorker.controller) {
        notify(reg.waiting);
      }
      reg.addEventListener('updatefound', () => {
        const next = reg.installing;
        if (!next) return;
        next.addEventListener('statechange', () => {
          if (next.state === 'installed' && navigator.serviceWorker.controller) {
            notify(reg.waiting || next);
          }
        });
      });
    })
    .catch(() => {
      // Service worker registration failure never blocks app usage.
    });

  return () => {
    disposed = true;
    navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
  };
}
