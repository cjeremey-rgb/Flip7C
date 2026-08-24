(() => {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js', { scope: './' }).then(registration => {
      // Check for updated website code whenever the installed app is opened.
      registration.update().catch(() => {});
    }).catch(() => {});
  });
})();
