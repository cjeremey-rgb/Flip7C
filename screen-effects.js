(() => {
  'use strict';

  const EFFECT_MS = 2500;
  const FREEZE_EFFECT_MS = 2050;
  const FLIP3_EFFECT_MS = 3500;
  const SECOND_CHANCE_EFFECT_MS = 3150;
  const FROST_TEXTURE_URL = 'frost-whiteout.webp?v=20260901-deep-freezer';
  const BUST_OVERLAY_URL = 'bust-approved-exact.webp?v=20260901-approved-mockup-v5';
  const SECOND_CHANCE_OVERLAY_URL = 'second-chance-guardian-approved.webp?v=20260902-approved-mockup-v2';
  const FREEZE_SOUND_URL = 'freeze-sfx.mp3?v=20260905-approved-v1';
  const BUST_SOUND_URL = 'bust-sfx.mp3?v=20260905-timing-v2';
  const FLIP3_SOUND_URL = 'flip3-sfx.mp3?v=20260905-tada-card-fan-v1';
  const SECOND_CHANCE_SOUND_URL = 'second-chance-sfx.mp3?v=20260905-metal-shield-v1';
  const HOLD_SOUND_URL = 'hold-sfx.mp3?v=20260905-real-service-bell-v1';
  const FLIP7_SOUND_URL = 'flip7-sfx.mp3?v=20260905-clean-crowd-v1';
  const WINNER_SOUND_URL = 'winner-sfx.mp3?v=20260905-cinematic-crowd-v1';
  const SCREEN_EFFECT_SOUND_VOLUME = 0.38;
  let effectTimer = 0;
  let effectFrame = 0;
  let shockTimer = 0;
  let frostCache = null;
  let frostTexturePreload = null;
  let bustArtworkPreload = null;
  let secondChanceArtworkPreload = null;
  let freezeSoundPreload = null;
  let bustSoundPreload = null;
  let flip3SoundPreload = null;
  let secondChanceSoundPreload = null;
  let holdSoundPreload = null;
  let flip7SoundPreload = null;
  let winnerSoundPreload = null;

  const clamp = value => Math.max(0, Math.min(1, value));
  const ease = value => { value = clamp(value); return value * value * (3 - 2 * value); };
  const lifeOpacity = progress => clamp(progress < .035 ? progress / .035 : progress > .86 ? (1 - progress) / .14 : 1);
  const seededRandom = seed => () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const soundVolume = (volumeScale = 1) => SCREEN_EFFECT_SOUND_VOLUME * clamp(Number.isFinite(volumeScale) ? volumeScale : 1);

  function playFreezeSound(volumeScale = 1) {
    try {
      if (localStorage.getItem('fr7sound') === 'off') return;
      const sound = freezeSoundPreload ? freezeSoundPreload.cloneNode(true) : new Audio(FREEZE_SOUND_URL);
      sound.volume = soundVolume(volumeScale);
      sound.currentTime = 0;
      sound.play().catch(() => {});
    } catch {}
  }

  function playBustSound(volumeScale = 1) {
    try {
      if (localStorage.getItem('fr7sound') === 'off') return;
      const sound = bustSoundPreload || new Audio(BUST_SOUND_URL);
      bustSoundPreload = sound;
      sound.pause();
      sound.currentTime = 0;
      sound.volume = soundVolume(volumeScale);
      sound.play().catch(() => {
        try {
          bustSoundPreload = new Audio(BUST_SOUND_URL);
          bustSoundPreload.preload = 'auto';
          bustSoundPreload.volume = soundVolume(volumeScale);
          bustSoundPreload.play().catch(() => {});
        } catch {}
      });
    } catch {}
  }

  function playSecondChanceSound(volumeScale = 1) {
    try {
      if (localStorage.getItem('fr7sound') === 'off') return;
      const sound = secondChanceSoundPreload || new Audio(SECOND_CHANCE_SOUND_URL);
      secondChanceSoundPreload = sound;
      sound.pause();
      sound.currentTime = 0;
      sound.volume = soundVolume(volumeScale);
      sound.play().catch(() => {
        try {
          secondChanceSoundPreload = new Audio(SECOND_CHANCE_SOUND_URL);
          secondChanceSoundPreload.preload = 'auto';
          secondChanceSoundPreload.volume = soundVolume(volumeScale);
          secondChanceSoundPreload.play().catch(() => {});
        } catch {}
      });
    } catch {}
  }

  function playFlip3Sound(volumeScale = 1) {
    try {
      if (localStorage.getItem('fr7sound') === 'off') return;
      const sound = flip3SoundPreload || new Audio(FLIP3_SOUND_URL);
      flip3SoundPreload = sound;
      sound.pause();
      sound.currentTime = 0;
      sound.volume = soundVolume(volumeScale);
      sound.play().catch(() => {
        try {
          flip3SoundPreload = new Audio(FLIP3_SOUND_URL);
          flip3SoundPreload.preload = 'auto';
          flip3SoundPreload.volume = soundVolume(volumeScale);
          flip3SoundPreload.play().catch(() => {});
        } catch {}
      });
    } catch {}
  }

  function playHoldSound(volumeScale = 1) {
    try {
      if (localStorage.getItem('fr7sound') === 'off') return;
      const sound = holdSoundPreload ? holdSoundPreload.cloneNode(true) : new Audio(HOLD_SOUND_URL);
      sound.volume = soundVolume(volumeScale);
      sound.currentTime = 0;
      sound.play().catch(() => {});
    } catch {}
  }

  function playFlip7Sound(volumeScale = 1) {
    try {
      if (localStorage.getItem('fr7sound') === 'off') return;
      const sound = flip7SoundPreload || new Audio(FLIP7_SOUND_URL);
      flip7SoundPreload = sound;
      sound.pause();
      sound.currentTime = 0;
      sound.volume = soundVolume(volumeScale);
      sound.play().catch(() => {});
    } catch {}
  }

  function playWinnerSound(volumeScale = 1) {
    try {
      if (localStorage.getItem('fr7sound') === 'off') return;
      const sound = winnerSoundPreload || new Audio(WINNER_SOUND_URL);
      winnerSoundPreload = sound;
      sound.pause();
      sound.currentTime = 0;
      sound.volume = soundVolume(volumeScale);
      sound.play().catch(() => {});
    } catch {}
  }

  function playSound(type, volumeScale = 1) {
    if (type === 'freeze') playFreezeSound(volumeScale);
    else if (type === 'bust') playBustSound(volumeScale);
    else if (type === 'flip3') playFlip3Sound(volumeScale);
    else if (type === 'secondChance') playSecondChanceSound(volumeScale);
    else if (type === 'hold') playHoldSound(volumeScale);
    else if (type === 'flip7') playFlip7Sound(volumeScale);
    else if (type === 'winner') playWinnerSound(volumeScale);
  }

  function createSurface(effect, type) {
    const canvas = document.createElement('canvas');
    const width = Math.max(1, effect.clientWidth || innerWidth);
    const height = Math.max(1, effect.clientHeight || innerHeight);
    const scale = type === 'freeze' ? 1 : Math.min(3, Math.max(2, devicePixelRatio || 1));
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    effect.appendChild(canvas);
    const context = canvas.getContext('2d', { alpha: true, desynchronized: true });
    context.setTransform(scale, 0, 0, scale, 0, 0);
    return { canvas, context, width, height };
  }

  function drawPath(context, points, fraction = 1) {
    if (!points.length || fraction <= 0) return;
    const last = (points.length - 1) * clamp(fraction);
    const whole = Math.floor(last);
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    for (let index = 1; index <= whole; index++) context.lineTo(points[index].x, points[index].y);
    if (whole < points.length - 1) {
      const amount = last - whole;
      const a = points[whole];
      const b = points[whole + 1];
      context.lineTo(a.x + (b.x - a.x) * amount, a.y + (b.y - a.y) * amount);
    }
    context.stroke();
  }

  function noiseHash(x, y, seed) {
    let value = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1442695041);
    value = Math.imul(value ^ (value >>> 13), 1274126177);
    return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
  }

  function smoothNoise(x, y, seed) {
    const x0 = Math.floor(x), y0 = Math.floor(y), tx = x - x0, ty = y - y0;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = noiseHash(x0, y0, seed), b = noiseHash(x0 + 1, y0, seed);
    const c = noiseHash(x0, y0 + 1, seed), d = noiseHash(x0 + 1, y0 + 1, seed);
    return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
  }

  function fractalNoise(x, y, seed) {
    let value = 0, amplitude = .57, total = 0;
    for (let octave = 0; octave < 2; octave++) {
      value += smoothNoise(x, y, seed + octave * 29) * amplitude;
      total += amplitude;
      amplitude *= .5;
      x *= 2.04;
      y *= 2.04;
    }
    return value / total;
  }

  function buildFrostTexture(width, height, random) {
    const texture = document.createElement('canvas');
    const textureScale = .16;
    texture.width = Math.ceil(width * textureScale);
    texture.height = Math.ceil(height * textureScale);
    const textureContext = texture.getContext('2d');
    const pixels = textureContext.createImageData(texture.width, texture.height);
    const seed = Math.floor(random() * 100000) + 1;
    const minimum = Math.min(width, height);
    for (let y = 0; y < texture.height; y++) {
      for (let x = 0; x < texture.width; x++) {
        const index = (y * texture.width + x) * 4;
        const screenX = x / textureScale, screenY = y / textureScale;
        const distance = Math.min(screenX, width - screenX, screenY, height - screenY);
        const edge = 1 - clamp(distance / (minimum * .52));
        const cloud = fractalNoise(screenX * .021, screenY * .021, seed);
        const crystalNoise = noiseHash(Math.floor(screenX * .31), Math.floor(screenY * .31), seed + 47);
        const ridge = Math.pow(1 - Math.abs(crystalNoise * 2 - 1), 6.5);
        const grain = noiseHash(Math.floor(screenX), Math.floor(screenY), seed + 101);
        let alpha = (.08 + cloud * .27 + ridge * .31 + edge * .29) * (.78 + grain * .22);
        if (grain > .992) alpha = Math.min(.98, alpha + .3);
        alpha = Math.min(.92, alpha);
        const tone = Math.min(252, Math.round(207 + cloud * 30 + ridge * 12 + grain * 7));
        pixels.data[index] = tone - 5;
        pixels.data[index + 1] = tone + 1;
        pixels.data[index + 2] = Math.min(255, tone + 4);
        pixels.data[index + 3] = Math.round(alpha * 255);
      }
    }
    textureContext.putImageData(pixels, 0, 0);

    const maskScale = 6;
    const maskWidth = Math.ceil(width / maskScale), maskHeight = Math.ceil(height / maskScale);
    const activation = new Float32Array(maskWidth * maskHeight);
    for (let y = 0; y < maskHeight; y++) {
      for (let x = 0; x < maskWidth; x++) {
        const screenX = x * maskScale, screenY = y * maskScale;
        const distance = Math.min(screenX, width - screenX, screenY, height - screenY);
        const irregularity = (fractalNoise(screenX * .026, screenY * .026, seed + 211) - .5) * .34;
        activation[y * maskWidth + x] = clamp(distance / (minimum * .5) + irregularity);
      }
    }
    const maskFrames = [];
    for (let frame = 0; frame <= 16; frame++) {
      const mask = document.createElement('canvas');
      mask.width = maskWidth; mask.height = maskHeight;
      const maskContext = mask.getContext('2d');
      const maskPixels = maskContext.createImageData(maskWidth, maskHeight);
      const growth = ease(frame / 16);
      for (let index = 0; index < activation.length; index++) {
        const reveal = ease(clamp((growth * 1.12 - activation[index]) / .12));
        maskPixels.data[index * 4] = 255;
        maskPixels.data[index * 4 + 1] = 255;
        maskPixels.data[index * 4 + 2] = 255;
        maskPixels.data[index * 4 + 3] = Math.round(reveal * 255);
      }
      maskContext.putImageData(maskPixels, 0, 0);
      maskFrames.push(mask);
    }
    return { texture, maskFrames };
  }

  function buildFrostAsset(width, height, random) {
    const minimum = Math.min(width, height);
    const frost = buildFrostTexture(width, height, random);
    const crystals = [], droplets = [], grain = [];
    for (let index = 0; index < 64; index++) {
      const side = index % 4, across = random();
      const start = side === 0 ? { x: across * width, y: -2 } : side === 1 ? { x: width + 2, y: across * height } : side === 2 ? { x: across * width, y: height + 2 } : { x: -2, y: across * height };
      const angle = (side === 0 ? Math.PI / 2 : side === 1 ? Math.PI : side === 2 ? -Math.PI / 2 : 0) + (random() - .5) * .54;
      const length = (side % 2 === 0 ? height : width) * (.18 + random() * .39);
      const segments = 10 + Math.floor(random() * 9), points = [start], branches = [];
      let heading = angle;
      for (let step = 1; step <= segments; step++) {
        heading += (random() - .5) * .075;
        const previous = points[points.length - 1], distance = length / segments;
        const point = { x: previous.x + Math.cos(heading) * distance, y: previous.y + Math.sin(heading) * distance };
        points.push(point);
        if (step > 1 && step < segments && step % 2 === 0) {
          for (const direction of [-1, 1]) {
            const branchAngle = heading + direction * (.62 + random() * .34), branchLength = length * (.035 + random() * .07);
            const tip = { x: point.x + Math.cos(branchAngle) * branchLength, y: point.y + Math.sin(branchAngle) * branchLength };
            branches.push([point, tip, { x: tip.x + Math.cos(branchAngle + direction * .48) * branchLength * .4, y: tip.y + Math.sin(branchAngle + direction * .48) * branchLength * .4 }]);
          }
        }
      }
      crystals.push({ points, branches, width: .34 + random() * 1.05 });
    }
    for (let index = 0; index < 32; index++) {
      const x = random() * width, y = random() * height;
      droplets.push({ x, y, radius: .8 + random() * 4.1, stretch: 1.2 + random() * 2.5, alpha: .08 + random() * .24 });
    }
    for (let index = 0; index < 260; index++) {
      grain.push({ x: random() * width, y: random() * height, radius: .22 + random() * 1.35, alpha: .08 + random() * .42, rotation: random() * Math.PI });
    }

    const composite = document.createElement('canvas'), compositeScale = 1;
    composite.width = Math.ceil(width * compositeScale);
    composite.height = Math.ceil(height * compositeScale);
    const compositeContext = composite.getContext('2d', { alpha: true });
    compositeContext.setTransform(compositeScale, 0, 0, compositeScale, 0, 0);
    compositeContext.drawImage(frost.texture, 0, 0, width, height);
    compositeContext.globalCompositeOperation = 'screen';
    for (const fleck of grain) {
      compositeContext.globalAlpha = fleck.alpha;
      compositeContext.beginPath();
      compositeContext.ellipse(fleck.x, fleck.y, fleck.radius * 1.8, fleck.radius * .55, fleck.rotation, 0, Math.PI * 2);
      compositeContext.fillStyle = 'rgba(252,253,253,.94)';
      compositeContext.fill();
    }
    compositeContext.lineCap = 'round';
    compositeContext.lineJoin = 'round';
    compositeContext.shadowColor = 'rgba(255,255,255,.78)';
    compositeContext.shadowBlur = 1.9;
    for (const crystal of crystals) {
      compositeContext.globalAlpha = .95;
      compositeContext.strokeStyle = 'rgba(249,252,252,.96)';
      compositeContext.lineWidth = crystal.width;
      drawPath(compositeContext, crystal.points, 1);
      compositeContext.lineWidth = Math.max(.28, crystal.width * .55);
      for (const branch of crystal.branches) drawPath(compositeContext, branch, 1);
    }
    compositeContext.shadowBlur = 0;
    for (const droplet of droplets) {
      compositeContext.globalAlpha = droplet.alpha;
      compositeContext.beginPath();
      compositeContext.ellipse(droplet.x, droplet.y, droplet.radius, droplet.radius * droplet.stretch, 0, 0, Math.PI * 2);
      compositeContext.fillStyle = 'rgba(168,184,188,.3)';
      compositeContext.fill();
      compositeContext.lineWidth = .55;
      compositeContext.strokeStyle = 'rgba(255,255,255,.8)';
      compositeContext.stroke();
    }
    compositeContext.globalAlpha = 1;
    return { key: `${Math.round(width)}x${Math.round(height)}`, composite, maskFrames: frost.maskFrames, minimum };
  }

  function getFrostAsset(width, height, random) {
    const key = `${Math.round(width)}x${Math.round(height)}`;
    if (frostCache?.key === key) return frostCache;
    frostCache = buildFrostAsset(width, height, random);
    return frostCache;
  }

  function startFreeze(effect, context, width, height, random, started) {
    const frost = getFrostAsset(width, height, random);
    const animationStarted = performance.now();
    let lastMaskIndex = -1;
    const draw = now => {
      const progress = clamp((now - animationStarted) / EFFECT_MS);
      const growth = ease(clamp(progress / .22));
      const maskIndex = Math.min(frost.maskFrames.length - 1, Math.round(growth * (frost.maskFrames.length - 1)));
      if (maskIndex !== lastMaskIndex) {
        lastMaskIndex = maskIndex;
        context.clearRect(0, 0, width, height);
        context.save();
        context.drawImage(frost.composite, 0, 0, width, height);
        context.globalCompositeOperation = 'destination-in';
        context.drawImage(frost.maskFrames[maskIndex], 0, 0, width, height);
        context.restore();
      }
      if (growth < 1 && effect.isConnected) effectFrame = requestAnimationFrame(draw);
    };
    effectFrame = requestAnimationFrame(draw);
  }

  function edgeDistance(center, angle, width, height) {
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const xDistance = dx > 0 ? (width - center.x) / dx : -center.x / dx;
    const yDistance = dy > 0 ? (height - center.y) / dy : -center.y / dy;
    return Math.min(Math.abs(xDistance), Math.abs(yDistance));
  }

  function jaggedLine(start, angle, length, segments, random, bend = .13) {
    const points = [start];
    let heading = angle;
    for (let step = 1; step <= segments; step++) {
      heading += (random() - .5) * bend;
      const previous = points[points.length - 1], distance = length / segments;
      points.push({ x: previous.x + Math.cos(heading) * distance, y: previous.y + Math.sin(heading) * distance });
    }
    return points;
  }

  function jaggedBetween(start, end, segments, random, variance) {
    const points = [start];
    const dx = end.x - start.x, dy = end.y - start.y;
    const length = Math.hypot(dx, dy) || 1;
    const normalX = -dy / length, normalY = dx / length;
    for (let step = 1; step < segments; step++) {
      const progress = step / segments;
      const edgeTaper = Math.sin(progress * Math.PI);
      const offset = (random() - .5) * variance * edgeTaper;
      points.push({
        x: start.x + dx * progress + normalX * offset,
        y: start.y + dy * progress + normalY * offset
      });
    }
    points.push(end);
    return points;
  }

  function strokeCracks(context, cracks, fraction, darkWidth, lightWidth, opacity) {
    context.save();
    context.globalAlpha = opacity;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.shadowBlur = 0;
    context.strokeStyle = 'rgba(0,2,3,.88)';
    context.lineWidth = darkWidth;
    context.translate(.85, 1.05);
    for (const crack of cracks) drawPath(context, crack.points || crack, fraction);
    context.translate(-.85, -1.05);
    context.strokeStyle = 'rgba(255,255,255,.97)';
    context.lineWidth = lightWidth;
    context.shadowColor = 'rgba(255,255,255,.9)';
    context.shadowBlur = 1.4;
    for (const crack of cracks) drawPath(context, crack.points || crack, fraction);
    context.restore();
  }

  function startBust(effect, context, width, height, random, started) {
    // Approved bust treatment: one clean central break, sparse long fractures,
    // no circular impact marks, and no dense spider-web rings.
    const center = {
      x: width * (.49 + (random() - .5) * .035),
      y: height * (.46 + (random() - .5) * .035)
    };
    const majorCracks = [];
    const detailCracks = [];
    const rayCount = width < 520 ? 11 : 13;

    for (let index = 0; index < rayCount; index++) {
      const angle = Math.PI * 2 * index / rayCount + (random() - .5) * .2;
      const distance = edgeDistance(center, angle, width, height) * 1.06;
      const points = jaggedLine(center, angle, distance, 12 + Math.floor(random() * 6), random, .115);
      majorCracks.push({ points });

      const branchCount = index % 3 === 0 ? 2 : 1;
      for (let branch = 0; branch < branchCount; branch++) {
        const fromIndex = 3 + Math.floor(random() * Math.max(1, points.length - 6));
        const from = points[Math.min(points.length - 2, fromIndex)];
        const direction = random() > .5 ? 1 : -1;
        const branchAngle = angle + direction * (.38 + random() * .58);
        const branchLength = Math.min(width, height) * (.07 + random() * .13);
        detailCracks.push({
          points: jaggedLine(from, branchAngle, branchLength, 4 + Math.floor(random() * 4), random, .25)
        });
      }
    }

    // A few long offset fractures give the mockup its broken-glass depth
    // without adding another impact center.
    for (let index = 0; index < 3; index++) {
      const vertical = index !== 1;
      const start = vertical
        ? { x: width * (.18 + index * .31 + (random() - .5) * .08), y: -2 }
        : { x: -2, y: height * (.72 + (random() - .5) * .08) };
      const end = vertical
        ? { x: width * (.08 + index * .37 + (random() - .5) * .1), y: height + 2 }
        : { x: width + 2, y: height * (.31 + (random() - .5) * .09) };
      majorCracks.push({
        points: jaggedBetween(start, end, 18 + Math.floor(random() * 7), random, 18 + random() * 24)
      });
    }

    const layer = document.createElement('canvas');
    const layerScale = Math.min(2, Math.max(1.35, devicePixelRatio || 1));
    layer.width = Math.ceil(width * layerScale);
    layer.height = Math.ceil(height * layerScale);
    const layerContext = layer.getContext('2d', { alpha: true });
    layerContext.setTransform(layerScale, 0, 0, layerScale, 0, 0);
    layerContext.fillStyle = 'rgba(5,8,12,.035)';
    layerContext.fillRect(0, 0, width, height);
    strokeCracks(layerContext, majorCracks, 1, 2.65, .58, 1);
    strokeCracks(layerContext, detailCracks, 1, 1.2, .3, .9);

    const draw = now => {
      const progress = clamp((now - started) / EFFECT_MS);
      const opacity = lifeOpacity(progress);
      const majorGrowth = ease(clamp(progress / .09));
      const detailGrowth = ease(clamp((progress - .035) / .12));
      context.clearRect(0, 0, width, height);
      context.save();
      context.globalAlpha = opacity;
      if (progress < .055) {
        context.globalAlpha = opacity * (1 - progress / .055) * .2;
        context.fillStyle = '#fff';
        context.fillRect(0, 0, width, height);
      }
      context.globalAlpha = opacity * majorGrowth;
      context.drawImage(layer, 0, 0, width, height);
      if (detailGrowth < 1) {
        context.globalAlpha = opacity * (1 - detailGrowth) * .12;
        context.fillStyle = '#ff183f';
        context.fillRect(0, 0, width, height);
      }
      context.restore();
      if (progress < 1 && effect.isConnected) effectFrame = requestAnimationFrame(draw);
    };
    effectFrame = requestAnimationFrame(draw);
  }

  function styleBustStamp(stamp) {
    stamp.style.setProperty('--stamp-rotation', '-5deg');
    stamp.style.minWidth = '0';
    stamp.style.width = 'max-content';
    stamp.style.maxWidth = 'calc(100vw - 24px)';
    stamp.style.padding = '0';
    stamp.style.border = '0';
    stamp.style.borderRadius = '0';
    stamp.style.color = '#fff';
    stamp.style.background = 'transparent';
    stamp.style.fontSize = 'clamp(76px, 25vw, 154px)';
    stamp.style.lineHeight = '.82';
    stamp.style.letterSpacing = '-.035em';
    stamp.style.whiteSpace = 'nowrap';
    stamp.style.textShadow = '0 5px 0 #8b0019, 0 0 5px #fff, 0 0 18px #ff1744, 0 0 42px rgba(255,20,59,.9)';
    stamp.style.filter = 'drop-shadow(0 13px 13px rgba(0,0,0,.82))';
    stamp.style.boxShadow = 'none';
    stamp.style.webkitTextStroke = 'clamp(1px,.35vw,3px) rgba(255,255,255,.96)';
  }

  function startFreezeEdgeGrowth(effect, stamp) {
    effect.classList.add('freeze-edge-growth');
    effect.style.background = 'transparent';

    if (!document.getElementById('freezeEdgeGrowthStyles')) {
      const style = document.createElement('style');
      style.id = 'freezeEdgeGrowthStyles';
      style.textContent = `
        .freeze-screen-effect.freeze-edge-growth:before {
          opacity: 0;
          animation: freezeCenterCloud ${FREEZE_EFFECT_MS}ms ease-out forwards;
        }
        .freeze-screen-effect.freeze-edge-growth:after {
          opacity: 0;
          animation: freezeEdgeFrame ${FREEZE_EFFECT_MS}ms ease-out forwards;
        }
        @keyframes freezeCenterCloud {
          0%,24% { opacity:0 }
          44%,84% { opacity:1 }
          100% { opacity:0 }
        }
        @keyframes freezeEdgeFrame {
          0% { opacity:0 }
          8%,84% { opacity:1 }
          100% { opacity:0 }
        }
      `;
      document.head.appendChild(style);
    }

    const layerSpecs = [
      {
        start: 'polygon(0 0,100% 0,100% 0,84% 0,67% 0,50% 0,33% 0,16% 0,0 0)',
        end: 'polygon(0 0,100% 0,100% 48%,84% 53%,67% 49%,50% 56%,33% 50%,16% 54%,0 48%)',
        delay: 0
      },
      {
        start: 'polygon(0 100%,16% 100%,33% 100%,50% 100%,67% 100%,84% 100%,100% 100%,100% 100%,0 100%)',
        end: 'polygon(0 52%,16% 47%,33% 51%,50% 45%,67% 50%,84% 46%,100% 52%,100% 100%,0 100%)',
        delay: 35
      },
      {
        start: 'polygon(0 0,0 0,0 16%,0 33%,0 50%,0 67%,0 84%,0 100%,0 100%)',
        end: 'polygon(0 0,49% 0,54% 16%,50% 33%,56% 50%,49% 67%,53% 84%,48% 100%,0 100%)',
        delay: 70
      },
      {
        start: 'polygon(100% 0,100% 0,100% 16%,100% 33%,100% 50%,100% 67%,100% 84%,100% 100%,100% 100%,100% 84%,100% 67%,100% 50%,100% 33%,100% 16%)',
        end: 'polygon(51% 0,100% 0,100% 16%,100% 33%,100% 50%,100% 67%,100% 84%,100% 100%,52% 100%,47% 84%,51% 67%,45% 50%,50% 33%,46% 16%)',
        delay: 20
      }
    ];

    for (const spec of layerSpecs) {
      const layer = new Image();
      layer.className = 'freeze-growth-layer';
      layer.alt = '';
      layer.decoding = 'async';
      layer.src = FROST_TEXTURE_URL;
      layer.style.position = 'absolute';
      layer.style.zIndex = '0';
      layer.style.inset = '0';
      layer.style.width = '100%';
      layer.style.height = '100%';
      layer.style.objectFit = 'cover';
      layer.style.objectPosition = 'center';
      layer.style.clipPath = spec.start;
      layer.style.willChange = 'clip-path, opacity';
      effect.insertBefore(layer, stamp);
      if (layer.animate) {
        layer.animate([
          { clipPath: spec.start, opacity: .72 },
          { offset: .16, clipPath: spec.start, opacity: .96 },
          { clipPath: spec.end, opacity: .96 }
        ], {
          duration: 800,
          delay: spec.delay,
          easing: 'cubic-bezier(.14,.72,.22,1)',
          fill: 'forwards'
        });
      } else {
        layer.style.clipPath = spec.end;
        layer.style.opacity = '.96';
      }
    }

    stamp.style.animation = 'none';
    stamp.style.opacity = '0';
    if (stamp.animate) {
      stamp.animate([
        { opacity: 0, transform: 'translate(-50%,-50%) rotate(-4deg) scale(1.45)' },
        { offset: .27, opacity: 0, transform: 'translate(-50%,-50%) rotate(-4deg) scale(1.45)' },
        { offset: .39, opacity: 1, transform: 'translate(-50%,-50%) rotate(-4deg) scale(1)' },
        { offset: .84, opacity: 1, transform: 'translate(-50%,-50%) rotate(-4deg) scale(1)' },
        { opacity: 0, transform: 'translate(-50%,-50%) rotate(-4deg) scale(.94)' }
      ], { duration: FREEZE_EFFECT_MS, easing: 'cubic-bezier(.18,.86,.24,1)', fill: 'forwards' });
    } else {
      stamp.style.opacity = '1';
    }
  }

  function startSecondChanceShield(effect) {
    effect.style.animation = 'none';
    effect.style.background = 'transparent';
    effect.style.isolation = 'auto';
    effect.style.mixBlendMode = 'screen';

    const artwork = new Image();
    artwork.className = 'second-chance-approved-artwork';
    artwork.alt = '';
    artwork.decoding = 'async';
    artwork.style.position = 'absolute';
    artwork.style.zIndex = '2';
    artwork.style.inset = '0';
    artwork.style.width = '100%';
    artwork.style.height = '100%';
    artwork.style.objectFit = 'fill';
    artwork.style.objectPosition = 'center';
    artwork.style.mixBlendMode = 'normal';
    artwork.style.opacity = '0';
    artwork.style.transformOrigin = '50% 47%';
    artwork.style.willChange = 'opacity, transform, filter';
    effect.appendChild(artwork);

    // Screen blending removes the source's pure-black field while preserving the
    // exact approved glow. This normal-blend card cover keeps the central card
    // fully opaque, matching the mockup instead of allowing the board through it.
    const card = document.createElement('div');
    card.id = 'secondChanceCardOverlay';
    card.className = 'second-chance-approved-card';
    card.innerHTML = '<span>SECOND</span><span>CHANCE</span>';
    const effectBounds = effect.getBoundingClientRect();
    Object.assign(card.style, {
      position: 'fixed',
      zIndex: '503',
      left: `${effectBounds.left + effectBounds.width * .492}px`,
      top: `${effectBounds.top + effectBounds.height * .4735}px`,
      width: `${Math.min(effectBounds.width * .315, 190)}px`,
      aspectRatio: '.64',
      transform: 'translate(-50%,-50%) scale(.82)',
      transformOrigin: '50% 50%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      border: 'clamp(4px,1.15vw,7px) solid #fff',
      borderRadius: 'clamp(13px,4.2vw,24px)',
      color: '#fff',
      background: 'repeating-linear-gradient(135deg,#ff5f7f 0 17px,#e62f58 17px 34px)',
      boxShadow: '0 8px 0 #78162d,0 16px 30px rgba(0,0,0,.72),0 0 16px rgba(255,92,132,.55)',
      fontFamily: "'Archivo Black',Impact,sans-serif",
      fontSize: 'clamp(17px,4.75vw,30px)',
      fontWeight: '900',
      lineHeight: '.95',
      textAlign: 'center',
      textShadow: '0 3px 0 #8d1838',
      opacity: '0',
      willChange: 'opacity, transform'
    });
    document.body.appendChild(card);
    effect._secondChanceCard = card;

    let started = false;
    const removeEffect = () => {
      if (card.isConnected) card.remove();
      if (effect.isConnected) effect.remove();
    };
    const startApprovedArtwork = () => {
      if (started || !artwork.naturalWidth || !effect.isConnected) return;
      started = true;
      playSecondChanceSound();
      artwork.style.opacity = '1';
      if (artwork.animate) {
        artwork.animate([
          { opacity: 0, transform: 'scale(.88)', filter: 'brightness(.75)' },
          { offset: .082, opacity: 1, transform: 'scale(1.045)', filter: 'brightness(1.18)' },
          { offset: .15, opacity: 1, transform: 'scale(1)', filter: 'brightness(1)' },
          { offset: .287, opacity: 1, transform: 'translateX(0) scale(1)', filter: 'brightness(1)' },
          { offset: .311, opacity: 1, transform: 'translateX(-1.4%) scale(1.012)', filter: 'brightness(1.42)' },
          { offset: .334, opacity: 1, transform: 'translateX(.8%) scale(1)', filter: 'brightness(1.08)' },
          { offset: .85, opacity: 1, transform: 'translateX(0) scale(1)', filter: 'brightness(1)' },
          { opacity: 0, transform: 'scale(.96)', filter: 'brightness(.86)' }
        ], {
          duration: SECOND_CHANCE_EFFECT_MS,
          easing: 'cubic-bezier(.18,.86,.24,1)',
          fill: 'forwards'
        });
      }
      if (card.animate) {
        card.animate([
          { opacity: 0, transform: 'translate(-50%,-50%) rotate(-8deg) scale(.55)' },
          { offset: .089, opacity: 0, transform: 'translate(-50%,-50%) rotate(-8deg) scale(.55)' },
          { offset: .164, opacity: 1, transform: 'translate(-50%,-50%) rotate(2deg) scale(1.07)' },
          { offset: .212, opacity: 1, transform: 'translate(-50%,-50%) rotate(0) scale(1)' },
          { offset: .85, opacity: 1, transform: 'translate(-50%,-50%) scale(1)' },
          { opacity: 0, transform: 'translate(-50%,-50%) scale(.92)' }
        ], {
          duration: SECOND_CHANCE_EFFECT_MS,
          easing: 'cubic-bezier(.16,.86,.22,1)',
          fill: 'forwards'
        });
      } else {
        card.style.opacity = '1';
        card.style.transform = 'translate(-50%,-50%)';
      }
    };

    artwork.addEventListener('load', startApprovedArtwork, { once: true });
    artwork.addEventListener('error', removeEffect, { once: true });
    artwork.src = SECOND_CHANCE_OVERLAY_URL;
    if (artwork.complete && artwork.naturalWidth) startApprovedArtwork();
    else artwork.decode?.().then(startApprovedArtwork).catch(() => {});
  }
  function show(type) {
    // Start the impact before building the visual overlay. The trimmed file's
    // glass transient begins about 50 ms later, aligned with the first crack.
    if (type === 'bust') playBustSound();
    clearTimeout(effectTimer);
    clearTimeout(shockTimer);
    cancelAnimationFrame(effectFrame);
    document.getElementById('screenEffect')?.remove();
    document.getElementById('secondChanceCardOverlay')?.remove();
    document.body.classList.remove('shatter-impact');
    const effect = document.createElement('div');
    effect.id = 'screenEffect';
    effect.className = `screen-effect ${type === 'freeze' ? 'freeze-screen-effect' : type === 'flip3' ? 'flip3-screen-effect' : type === 'secondChance' ? 'second-chance-screen-effect' : 'shatter-screen-effect'}`;
    effect.setAttribute('aria-hidden', 'true');
    document.body.appendChild(effect);
    if (type === 'freeze') playFreezeSound();
    if (type === 'flip3') playFlip3Sound();
    if (type === 'bust') {
      // Render the exact user-approved artwork. The black source background is
      // removed by screen blending so only the approved BUST and crack artwork
      // appears over the live game board.
      effect.style.inset = '0';
      effect.style.animation = 'none';
      effect.style.background = 'transparent';
      effect.style.isolation = 'auto';
      effect.style.mixBlendMode = 'screen';

      const artwork = new Image();
      artwork.className = 'bust-approved-artwork';
      artwork.alt = '';
      artwork.decoding = 'async';
      artwork.style.position = 'absolute';
      artwork.style.zIndex = '2';
      artwork.style.inset = '0';
      artwork.style.width = '100%';
      artwork.style.height = '100%';
      artwork.style.objectFit = 'fill';
      artwork.style.objectPosition = 'center';
      artwork.style.mixBlendMode = 'normal';
      artwork.style.opacity = '0';
      artwork.style.transformOrigin = '50% 50%';
      artwork.style.willChange = 'opacity, transform';
      effect.appendChild(artwork);

      let started = false;
      const removeEffect = () => {
        document.body.classList.remove('shatter-impact');
        if (effect.isConnected) effect.remove();
      };
      const startApprovedArtwork = () => {
        if (started || !artwork.naturalWidth || !effect.isConnected) return;
        started = true;
        artwork.style.opacity = '1';
        if (artwork.animate) {
          artwork.animate([
            { opacity: 0, transform: 'scale(1.075)' },
            { offset: .075, opacity: 1, transform: 'scale(1)' },
            { offset: .86, opacity: 1, transform: 'scale(1)' },
            { opacity: 0, transform: 'scale(.995)' }
          ], {
            duration: EFFECT_MS,
            easing: 'cubic-bezier(.18,.86,.24,1)',
            fill: 'forwards'
          });
        }
        void document.body.offsetWidth;
        document.body.classList.add('shatter-impact');
        shockTimer = setTimeout(() => document.body.classList.remove('shatter-impact'), 420);
        effectTimer = setTimeout(removeEffect, EFFECT_MS);
      };

      artwork.addEventListener('load', startApprovedArtwork, { once: true });
      artwork.addEventListener('error', removeEffect, { once: true });
      artwork.src = BUST_OVERLAY_URL;
      if (artwork.complete && artwork.naturalWidth) startApprovedArtwork();
      else artwork.decode?.().then(startApprovedArtwork).catch(() => {});
      return;
    }

    if (type === 'secondChance') {
      startSecondChanceShield(effect);
      effectTimer = setTimeout(() => {
        effect._secondChanceCard?.remove();
        if (effect.isConnected) effect.remove();
      }, SECOND_CHANCE_EFFECT_MS);
      return;
    }

      const stamp = document.createElement('div');
      stamp.className = `screen-effect-stamp ${type === 'freeze' ? 'frozen-screen-stamp' : 'flip3-screen-stamp'}`;
      stamp.textContent = type === 'freeze' ? 'FROZEN' : 'FLIP 3';
      effect.appendChild(stamp);
      if (type === 'freeze') {
        startFreezeEdgeGrowth(effect, stamp);
      } else {
        const cards = document.createElement('div');
        cards.className = 'flip3-screen-cards';
        for (let number = 1; number <= 3; number++) {
          const card = document.createElement('div');
          card.className = `flip3-screen-card flip3-screen-card-${number}`;
          card.innerHTML = `<small>ACTION</small><strong>${number}</strong><b>FLIP</b>`;
          cards.appendChild(card);
        }
        effect.appendChild(cards);
        const sparks = document.createElement('div');
        sparks.className = 'flip3-screen-sparks';
        for (let index = 0; index < 18; index++) {
          const spark = document.createElement('i');
          spark.style.setProperty('--spark-angle', `${index * 20}deg`);
          spark.style.setProperty('--spark-delay', `${(index % 6) * .035}s`);
          spark.style.setProperty('--spark-distance', `${42 + (index % 4) * 9}vmin`);
          sparks.appendChild(spark);
        }
        effect.appendChild(sparks);
      }
    effectTimer = setTimeout(() => {
      cancelAnimationFrame(effectFrame);
      document.body.classList.remove('shatter-impact');
      if (effect.isConnected) effect.remove();
    }, type === 'flip3' ? FLIP3_EFFECT_MS : type === 'freeze' ? FREEZE_EFFECT_MS : EFFECT_MS);
  }

  function prewarmFrost() {
    if (!frostTexturePreload) {
      frostTexturePreload = new Image();
      frostTexturePreload.decoding = 'async';
      frostTexturePreload.src = FROST_TEXTURE_URL;
      frostTexturePreload.decode?.().catch(() => {});
    }
    if (!freezeSoundPreload) {
      try {
        freezeSoundPreload = new Audio(FREEZE_SOUND_URL);
        freezeSoundPreload.preload = 'auto';
        freezeSoundPreload.volume = SCREEN_EFFECT_SOUND_VOLUME;
        freezeSoundPreload.load();
      } catch {}
    }
    if (!bustSoundPreload) {
      try {
        bustSoundPreload = new Audio(BUST_SOUND_URL);
        bustSoundPreload.preload = 'auto';
        bustSoundPreload.volume = SCREEN_EFFECT_SOUND_VOLUME;
        bustSoundPreload.load();
      } catch {}
    }
    if (!secondChanceSoundPreload) {
      try {
        secondChanceSoundPreload = new Audio(SECOND_CHANCE_SOUND_URL);
        secondChanceSoundPreload.preload = 'auto';
        secondChanceSoundPreload.volume = SCREEN_EFFECT_SOUND_VOLUME;
        secondChanceSoundPreload.load();
      } catch {}
    }
    if (!flip3SoundPreload) {
      try {
        flip3SoundPreload = new Audio(FLIP3_SOUND_URL);
        flip3SoundPreload.preload = 'auto';
        flip3SoundPreload.volume = SCREEN_EFFECT_SOUND_VOLUME;
        flip3SoundPreload.load();
      } catch {}
    }
    if (!holdSoundPreload) {
      try {
        holdSoundPreload = new Audio(HOLD_SOUND_URL);
        holdSoundPreload.preload = 'auto';
        holdSoundPreload.volume = SCREEN_EFFECT_SOUND_VOLUME;
        holdSoundPreload.load();
      } catch {}
    }
    if (!flip7SoundPreload) {
      try {
        flip7SoundPreload = new Audio(FLIP7_SOUND_URL);
        flip7SoundPreload.preload = 'auto';
        flip7SoundPreload.volume = SCREEN_EFFECT_SOUND_VOLUME;
        flip7SoundPreload.load();
      } catch {}
    }
    if (!winnerSoundPreload) {
      try {
        winnerSoundPreload = new Audio(WINNER_SOUND_URL);
        winnerSoundPreload.preload = 'auto';
        winnerSoundPreload.volume = SCREEN_EFFECT_SOUND_VOLUME;
        winnerSoundPreload.load();
      } catch {}
    }
    if (!bustArtworkPreload) {
      bustArtworkPreload = new Image();
      bustArtworkPreload.decoding = 'async';
      bustArtworkPreload.src = BUST_OVERLAY_URL;
      bustArtworkPreload.decode?.().catch(() => {});
    }
    if (!secondChanceArtworkPreload) {
      secondChanceArtworkPreload = new Image();
      secondChanceArtworkPreload.decoding = 'async';
      secondChanceArtworkPreload.src = SECOND_CHANCE_OVERLAY_URL;
      secondChanceArtworkPreload.decode?.().catch(() => {});
    }
  }

  let effectSoundsUnlocked = false;
  function unlockEffectSounds() {
    if (effectSoundsUnlocked) return;
    effectSoundsUnlocked = true;
    prewarmFrost();
    for (const sound of [freezeSoundPreload, bustSoundPreload, flip3SoundPreload, secondChanceSoundPreload, holdSoundPreload, flip7SoundPreload, winnerSoundPreload]) {
      if (!sound) continue;
      const volume = sound.volume;
      sound.volume = 0;
      sound.currentTime = 0;
      const attempt = sound.play();
      if (attempt?.then) {
        attempt.then(() => {
          sound.pause();
          sound.currentTime = 0;
          sound.volume = volume;
        }).catch(() => { sound.volume = volume; });
      } else {
        sound.pause();
        sound.currentTime = 0;
        sound.volume = volume;
      }
    }
  }

  globalThis.RealisticScreenEffects = { show, playSound, prewarm: prewarmFrost };
  const queueFrostPreload = () => {
    if ('requestIdleCallback' in globalThis) requestIdleCallback(prewarmFrost, { timeout: 1800 });
    else setTimeout(prewarmFrost, 250);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', queueFrostPreload, { once: true });
  else queueFrostPreload();
  document.addEventListener('pointerdown', unlockEffectSounds, { once: true, capture: true });
  document.addEventListener('touchstart', unlockEffectSounds, { once: true, capture: true, passive: true });
  document.addEventListener('keydown', unlockEffectSounds, { once: true, capture: true });
})();
