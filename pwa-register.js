(() => {
  // Load multiplayer layout corrections after the main game styles so their
  // overrides win the cascade.
  const ensureLayoutFix = () => {
    if (!document.querySelector('link[data-multiplayer-layout-fix]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = './multiplayer-layout-fix.css?v=20260906-layout-v2';
      link.dataset.multiplayerLayoutFix = '1';
      document.head.appendChild(link);
    }
    if (!document.querySelector('link[data-multiplayer-lobby-safety]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = './multiplayer-lobby-safety.css?v=20260906-lobby-v1';
      link.dataset.multiplayerLobbySafety = '1';
      document.head.appendChild(link);
    }
  };

  const syncRoomSizeClass = () => {
    const players = document.getElementById('players');
    const count = players ? players.children.length : 0;
    const large = count >= 4;
    document.documentElement.classList.toggle('large-room', large);
    document.body.classList.toggle('large-room', large);
  };

  ensureLayoutFix();
  window.addEventListener('DOMContentLoaded', () => {
    ensureLayoutFix();
    syncRoomSizeClass();
    const players = document.getElementById('players');
    if (players) new MutationObserver(syncRoomSizeClass).observe(players, { childList: true });
  });

  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js', { scope: './' }).then(registration => {
      registration.update().catch(() => {});
    }).catch(() => {});
  });
})();
