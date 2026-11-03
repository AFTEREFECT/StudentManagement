if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).then((registration) => {
      const announce = () => { if (registration.waiting) window.dispatchEvent(new CustomEvent('teacher-pwa-update', { detail: registration.waiting })); };
      announce();
      registration.addEventListener('updatefound', () => registration.installing?.addEventListener('statechange', announce));
    }).catch(() => { /* The online UI stays usable if the browser disallows SW. */ });
  });
}
