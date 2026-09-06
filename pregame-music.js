(() => {
  const STORAGE_KEY = 'fr7PregameMusicStateV2';
  const TRACK_URL = 'neon-circuit.mp3?v=20260905-neon-circuit-v1';
  const VOLUME = 0.26;
  const NAVIGATION_WINDOW_MS = 5000;
  const params = new URLSearchParams(location.search);
  const mode = document.body.dataset.pregameMusic || 'off';
  const embedded = window.parent !== window && params.get('fr7Shell') === '1';

  function initialWanted() {
    return mode === 'active' || (mode === 'online' && !(localStorage.fr7room && localStorage.fr7pid));
  }

  // When a pre-game page is displayed by the persistent index shell, the audio
  // stays in the parent document. Child pages only tell that one player when
  // the lobby is active or gameplay has begun.
  if (embedded) {
    const send = (action, detail = {}) => {
      const targetOrigin = location.protocol === 'file:' ? '*' : location.origin;
      window.parent.postMessage({ type: 'fr7-pregame-music', action, ...detail }, targetOrigin);
    };
    const api = {
      play: () => send('sync', { active: true }),
      pause: () => send('sync', { active: false }),
      sync: active => send('sync', { active: Boolean(active) }),
      save: () => send('save'),
      soundPreferenceChanged: () => send('soundPreferenceChanged')
    };
    globalThis.FlipRushPregameMusic = api;
    send('sync', { active: initialWanted() });

    document.addEventListener('click', event => {
      const link = event.target.closest?.('a[href]');
      if (!link) return;
      const url = new URL(link.href, location.href);
      if (url.origin === location.origin && /\/index\.html$/.test(url.pathname)) {
        event.preventDefault();
        send('close');
      }
    });
    return;
  }

  let wanted = initialWanted();
  let lastSavedSecond = -1;
  const audio = new Audio(TRACK_URL);
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

  // A tap unlocks audio on mobile. Because the index page remains loaded while
  // its child screen changes, this same Audio object never gets recreated.
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
    if (document.visibilityState === 'hidden') pause();
    else play();
  });
  document.addEventListener('freeze', pause);
  window.addEventListener('pagehide', pause);
  window.addEventListener('pageshow', play);

  const api = { play, pause, sync, save: savePosition, soundPreferenceChanged };
  globalThis.FlipRushPregameMusic = api;

  // Keep index.html alive as a full-screen shell. The selected mode loads in a
  // same-origin frame, so navigation no longer destroys or restarts the music.
  const isIndexShell = /\/(?:index\.html)?$/.test(location.pathname);
  if (!isIndexShell) return;

  let activeFrame = null;
  const rootOverflow = document.documentElement.style.overflow;
  const bodyOverflow = document.body.style.overflow;

  function frameModeFromHash() {
    const value = location.hash.slice(1).toLowerCase();
    return value === 'offline' || value === 'online' ? value : '';
  }

  function closeFrame() {
    if (activeFrame) activeFrame.remove();
    activeFrame = null;
    document.documentElement.style.overflow = rootOverflow;
    document.body.style.overflow = bodyOverflow;
    sync(true);
  }

  function openFrame(href, frameMode, pushHistory = true) {
    const target = new URL(href, location.href);
    if (params.has('theme') && !target.searchParams.has('theme')) target.searchParams.set('theme', params.get('theme'));
    target.searchParams.set('fr7Shell', '1');

    if (activeFrame) activeFrame.remove();
    const frame = document.createElement('iframe');
    frame.id = 'fr7GameFrame';
    frame.title = frameMode === 'offline' ? 'Flip Rush 7 single player' : 'Flip Rush 7 multiplayer';
    frame.src = target.href;
    frame.allow = 'autoplay; microphone; clipboard-write';
    frame.style.cssText = 'position:fixed;z-index:1000;inset:0;width:100%;height:100%;height:100dvh;border:0;background:#07101d;color-scheme:dark';
    document.body.appendChild(frame);
    activeFrame = frame;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    if (pushHistory) history.pushState({ fr7Frame: frameMode }, '', '#' + frameMode);
  }

  function openMode(frameMode, pushHistory) {
    const link = document.getElementById(frameMode === 'offline' ? 'singlePlayer' : 'multiPlayer');
    const href = link?.href || (frameMode + '.html');
    openFrame(href, frameMode, pushHistory);
  }

  document.addEventListener('click', event => {
    const link = event.target.closest?.('#singlePlayer, #multiPlayer');
    if (!link || event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    openMode(link.id === 'singlePlayer' ? 'offline' : 'online', true);
  });

  window.addEventListener('message', event => {
    if (!activeFrame || event.source !== activeFrame.contentWindow) return;
    if (event.origin !== location.origin && location.protocol !== 'file:') return;
    const message = event.data;
    if (!message || message.type !== 'fr7-pregame-music') return;
    if (message.action === 'sync') sync(message.active);
    else if (message.action === 'save') savePosition();
    else if (message.action === 'soundPreferenceChanged') soundPreferenceChanged();
    else if (message.action === 'close') {
      if (history.state?.fr7Frame) history.back();
      else {
        closeFrame();
        history.replaceState(null, '', location.pathname + location.search);
      }
    }
  });

  window.addEventListener('popstate', () => {
    const frameMode = frameModeFromHash();
    if (frameMode) {
      if (!activeFrame || history.state?.fr7Frame !== frameMode) openMode(frameMode, false);
    } else closeFrame();
  });

  const initialFrameMode = frameModeFromHash();
  if (initialFrameMode) openMode(initialFrameMode, false);
})();
