(() => {
  // Multiplayer-only player-count layout. Keeping this separate lets the
  // three-player game stay compact while larger rooms become scrollable.
  if (/online\.html$/i.test(location.pathname)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'multiplayer-player-count.css?v=20260906-v1';
    document.head.appendChild(link);
  }

  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js', { scope: './' }).then(registration => {
      // Check for updated website code whenever the installed app is opened.
      registration.update().catch(() => {});
    }).catch(() => {});
  });
})();
