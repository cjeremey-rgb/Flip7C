(() => {
  'use strict';

  const EFFECT_MS = 2500;
  const FLIP3_EFFECT_MS = 3500;
  const FROST_TEXTURE_URL = 'frost-whiteout.webp?v=20260901-deep-freezer';
  const BUST_OVERLAY_URL = 'bust-approved-overlay.png?v=20260901-approved-mockup-v2';
  let effectTimer = 0;
  let effectFrame = 0;
  let shockTimer = 0;
  let frostCache = null;
  let frostTexturePreload = null;
  let bustArtworkPreload = null;

  const clamp = value => Math.max(0, Math.min(1, value));
  const ease = value => { value = clamp(value); return value * value * (3 - 2 * value); };
  const lifeOpacity = progress => clamp(progress < .035 ? progress / .035 : progress > .86 ? (1 - progress) / .14 : 1);
  const seededRandom = seed => () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

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

  function show(type) {
    clearTimeout(effectTimer);
    clearTimeout(shockTimer);
    cancelAnimationFrame(effectFrame);
    document.getElementById('screenEffect')?.remove();
    document.body.classList.remove('shatter-impact');
    const effect = document.createElement('div');
    effect.id = 'screenEffect';
    effect.className = `screen-effect ${type === 'freeze' ? 'freeze-screen-effect' : type === 'flip3' ? 'flip3-screen-effect' : 'shatter-screen-effect'}`;
    effect.setAttribute('aria-hidden', 'true');
    document.body.appendChild(effect);
    if (type === 'bust') {
      // Draw an immediate fallback so a slow or failed image request can never
      // leave the player with no bust animation.
      const surface = createSurface(effect, type);
      const random = seededRandom((Date.now() ^ (surface.width << 8) ^ surface.height) >>> 0);
      const started = performance.now();
      const fallbackStamp = document.createElement('div');
      fallbackStamp.className = 'screen-effect-stamp bust-screen-stamp';
      fallbackStamp.textContent = 'BUST';
      styleBustStamp(fallbackStamp);
      effect.appendChild(fallbackStamp);
      startBust(effect, surface.context, surface.width, surface.height, random, started);

      const artwork = new Image();
      artwork.className = 'bust-approved-artwork';
      artwork.alt = '';
      artwork.decoding = 'async';
      artwork.src = BUST_OVERLAY_URL;
      artwork.style.position = 'absolute';
      artwork.style.zIndex = '2';
      artwork.style.inset = '0';
      artwork.style.width = '100%';
      artwork.style.height = '100%';
      artwork.style.objectFit = 'fill';
      artwork.style.willChange = 'opacity, transform';
      artwork.style.opacity = '0';
      const revealApprovedArtwork = () => {
        artwork.style.opacity = '1';
        surface.canvas.style.visibility = 'hidden';
        fallbackStamp.style.visibility = 'hidden';
      };
      artwork.addEventListener('load', revealApprovedArtwork, { once: true });
      if (artwork.complete && artwork.naturalWidth) revealApprovedArtwork();
      effect.appendChild(artwork);
      void document.body.offsetWidth;
      document.body.classList.add('shatter-impact');
      shockTimer = setTimeout(() => document.body.classList.remove('shatter-impact'), 420);
    } else {
      const stamp = document.createElement('div');
      stamp.className = `screen-effect-stamp ${type === 'freeze' ? 'frozen-screen-stamp' : 'flip3-screen-stamp'}`;
      stamp.textContent = type === 'freeze' ? 'FROZEN' : 'FLIP 3';
      effect.appendChild(stamp);
      if (type === 'freeze') {
      const frostTexture = new Image();
      frostTexture.className = 'freeze-screen-texture';
      frostTexture.alt = '';
      frostTexture.decoding = 'async';
      frostTexture.src = FROST_TEXTURE_URL;
      effect.insertBefore(frostTexture, stamp);
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
    }
    effectTimer = setTimeout(() => {
      cancelAnimationFrame(effectFrame);
      document.body.classList.remove('shatter-impact');
      if (effect.isConnected) effect.remove();
    }, type === 'flip3' ? FLIP3_EFFECT_MS : EFFECT_MS);
  }

  function prewarmFrost() {
    if (!frostTexturePreload) {
      frostTexturePreload = new Image();
      frostTexturePreload.decoding = 'async';
      frostTexturePreload.src = FROST_TEXTURE_URL;
      frostTexturePreload.decode?.().catch(() => {});
    }
    if (!bustArtworkPreload) {
      bustArtworkPreload = new Image();
      bustArtworkPreload.decoding = 'async';
      bustArtworkPreload.src = BUST_OVERLAY_URL;
      bustArtworkPreload.decode?.().catch(() => {});
    }
  }

  globalThis.RealisticScreenEffects = { show, prewarm: prewarmFrost };
  const queueFrostPreload = () => {
    if ('requestIdleCallback' in globalThis) requestIdleCallback(prewarmFrost, { timeout: 1800 });
    else setTimeout(prewarmFrost, 250);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', queueFrostPreload, { once: true });
  else queueFrostPreload();
})();
