(() => {
  const STORAGE_KEY = 'fr7PregameMusicStateV1';
  const TRACK_URL = 'neon-circuit.mp3?v=20260905-neon-circuit-v1';
  const VOLUME = 0.26;
  const NAVIGATION_WINDOW_MS = 5000;

  const mode = document.body.dataset.pregameMusic || 'off';
  let wanted = mode === 'active' || (mode === 'online' && !(localStorage.fr7room && localStorage.fr7pid));
  let lastSavedSecond = -1;

  const audio = new Audio(TRACK_URL);
  audio.id = 'pregameMusic';
  audio.preload = 'auto';
  audio.loop = true;
  audio.playsInline = true;
  audio.volume = VOLUME;

  function soundEnabled() {
    return localStorage.fr7sound !== 'off';
  }

  function readPosition() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
      let position = Number(saved.position) || 0;
      const elapsed = Date.now() - (Number(saved.savedAt) || 0);
      if (elapsed > 0 && elapsed < NAVIGATION_WINDOW_MS) position += elapsed / 1000;
      return position;
    } catch {
      return 0;
    }
  }

  function restorePosition() {
    const position = readPosition();
    const seek = () => {
      if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
      try { audio.currentTime = position % audio.duration; } catch {}
    };
    if (audio.readyState >= 1) seek();
    else audio.addEventListener('loadedmetadata', seek, { once: true });
  }

  function savePosition() {
    const position = Number(audio.currentTime) || readPosition();
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ position, savedAt: Date.now() })); } catch {}
  }

  function pause() {
    if (!audio.paused) audio.pause();
    savePosition();
  }

  function play() {
    if (!wanted || !soundEnabled() || document.visibilityState === 'hidden') return;
    audio.play().catch(() => {});
  }

  function sync(active) {
    wanted = Boolean(active);
    if (wanted && soundEnabled()) play();
    else pause();
  }

  function soundPreferenceChanged() {
    if (wanted && soundEnabled()) play();
    else pause();
  }

  restorePosition();
  play();

  // Mobile browsers require the first audible playback to follow a user gesture.
  // Once unlocked, the same Audio instance continues through all pre-game states.
  const unlock = () => play();
  document.addEventListener('pointerdown', unlock, { passive: true });
  document.addEventListener('keydown', unlock);
  audio.addEventListener('timeupdate', () => {
    const second = Math.floor(audio.currentTime);
    if (second !== lastSavedSecond) {
      lastSavedSecond = second;
      savePosition();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') savePosition();
    else play();
  });
  window.addEventListener('pagehide', savePosition);

  globalThis.FlipRushPregameMusic = { play, pause, sync, save: savePosition, soundPreferenceChanged };
})();
