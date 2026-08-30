(() => {
  'use strict';

  const EFFECT_MS = 2000;
  let effectTimer = 0;
  let effectFrame = 0;
  let shockTimer = 0;
  let frostCache = null;

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
    const scale = type === 'freeze' ? 1.25 : Math.min(3, Math.max(2, devicePixelRatio || 1));
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
    const textureScale = .25;
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
    const frostDepth = Math.max(40, Math.min(52, minimum * .12));
    for (let y = 0; y < maskHeight; y++) {
      for (let x = 0; x < maskWidth; x++) {
        const screenX = x * maskScale, screenY = y * maskScale;
        const edgeDistances = [screenY, width - screenX, height - screenY, screenX];
        let side = 0;
        for (let index = 1; index < edgeDistances.length; index++) if (edgeDistances[index] < edgeDistances[side]) side = index;
        const distance = edgeDistances[side];
        const along = side % 2 === 0 ? screenX : screenY;
        const rollingEdge = (fractalNoise(along * .045, side * 19.7 + 3, seed + 211) - .5) * 15;
        const chippedEdge = (noiseHash(Math.floor(along / 8), side * 37 + 5, seed + 347) - .5) * 17;
        const splinterNoise = noiseHash(Math.floor(along / 17), side * 53 + 11, seed + 503);
        const splinter = splinterNoise > .82 ? (splinterNoise - .82) / .18 * 13 : 0;
        const localDepth = Math.max(28, frostDepth + rollingEdge + chippedEdge + splinter);
        const surfaceNoise = (fractalNoise(screenX * .031, screenY * .031, seed + 619) - .5) * .1;
        activation[y * maskWidth + x] = distance / localDepth + surfaceNoise;
      }
    }
    const maskFrames = [];
    for (let frame = 0; frame <= 24; frame++) {
      const mask = document.createElement('canvas');
      mask.width = maskWidth; mask.height = maskHeight;
      const maskContext = mask.getContext('2d');
      const maskPixels = maskContext.createImageData(maskWidth, maskHeight);
      const growth = ease(frame / 24);
      for (let index = 0; index < activation.length; index++) {
        const reveal = ease(clamp((growth * 1.04 - activation[index]) / .14));
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
    for (let index = 0; index < 164; index++) {
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
    for (let index = 0; index < 82; index++) {
      const x = random() * width, y = random() * height;
      droplets.push({ x, y, radius: .8 + random() * 4.1, stretch: 1.2 + random() * 2.5, alpha: .08 + random() * .24 });
    }
    for (let index = 0; index < 720; index++) {
      grain.push({ x: random() * width, y: random() * height, radius: .22 + random() * 1.35, alpha: .08 + random() * .42, rotation: random() * Math.PI });
    }

    const composite = document.createElement('canvas'), compositeScale = 1.25;
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
    const diagonal = Math.hypot(width, height);
    const impactAnchors = [
      [.18, .2], [.78, .27], [.3, .7], [.76, .79], [.52, .46]
    ];
    const impactCount = width < 520 ? 4 : 5;
    const impacts = impactAnchors.slice(0, impactCount).map(([x, y]) => ({
      x: width * (x + (random() - .5) * .1),
      y: height * (y + (random() - .5) * .08),
      radius: 10 + random() * 8,
      rays: [], rings: []
    }));
    const majorCracks = [], detailCracks = [], facets = [];

    const pointAt = (points, fraction) => {
      const position = (points.length - 1) * clamp(fraction), index = Math.floor(position), amount = position - index;
      const a = points[index], b = points[Math.min(points.length - 1, index + 1)];
      return { x: a.x + (b.x - a.x) * amount, y: a.y + (b.y - a.y) * amount };
    };

    for (const impact of impacts) {
      const rayCount = 8 + Math.floor(random() * 2);
      for (let index = 0; index < rayCount; index++) {
        const angle = Math.PI * 2 * index / rayCount + (random() - .5) * .24;
        const edge = edgeDistance(impact, angle, width, height);
        const distance = edge * (.54 + random() * .5);
        const points = jaggedLine(impact, angle, distance, 10 + Math.floor(random() * 7), random, .12);
        impact.rays.push(points);
        majorCracks.push({ points });
        for (let branch = 0; branch < 2 + Math.floor(random() * 3); branch++) {
          const from = 2 + Math.floor(random() * Math.max(1, points.length - 3));
          const start = points[Math.min(points.length - 2, from)];
          const branchAngle = angle + (random() > .5 ? 1 : -1) * (.28 + random() * .76);
          detailCracks.push({ points: jaggedLine(start, branchAngle, distance * (.05 + random() * .14), 4 + Math.floor(random() * 4), random, .26) });
        }
      }
      for (const fraction of [.08, .14, .22, .32]) {
        for (let index = 0; index < impact.rays.length; index++) {
          if (random() < .24) continue;
          const next = (index + 1) % impact.rays.length;
          const a = pointAt(impact.rays[index], fraction * (.86 + random() * .25));
          const b = pointAt(impact.rays[next], fraction * (.86 + random() * .25));
          impact.rings.push({ points: [a, { x: (a.x + b.x) / 2 + (random() - .5) * 6, y: (a.y + b.y) / 2 + (random() - .5) * 6 }, b] });
        }
      }
      for (let index = 0; index < 17; index++) {
        const angle = random() * Math.PI * 2, radius = Math.pow(random(), 1.65) * 58;
        const start = { x: impact.x + Math.cos(angle) * radius, y: impact.y + Math.sin(angle) * radius };
        detailCracks.push({ points: jaggedLine(start, angle + (random() - .5) * 1.1, 8 + random() * 48, 3 + Math.floor(random() * 4), random, .36) });
      }
    }

    const edgePoint = side => {
      if (side === 0) return { x: random() * width, y: -2 };
      if (side === 1) return { x: width + 2, y: random() * height };
      if (side === 2) return { x: random() * width, y: height + 2 };
      return { x: -2, y: random() * height };
    };
    for (let index = 0; index < 11; index++) {
      const side = index % 4;
      const start = edgePoint(side), end = edgePoint((side + 2 + (random() > .72 ? 1 : 0)) % 4);
      const points = jaggedBetween(start, end, 18 + Math.floor(random() * 9), random, 28 + random() * 38);
      majorCracks.push({ points });
      for (let branch = 3; branch < points.length - 3; branch += 4 + Math.floor(random() * 3)) {
        const a = points[branch], angle = Math.atan2(points[branch + 1].y - a.y, points[branch + 1].x - a.x) + (random() > .5 ? 1 : -1) * (.42 + random() * .62);
        detailCracks.push({ points: jaggedLine(a, angle, 18 + random() * 62, 4 + Math.floor(random() * 4), random, .3) });
      }
    }

    const columns = 5, rows = 9, nodes = [];
    for (let row = 0; row <= rows; row++) {
      nodes[row] = [];
      for (let column = 0; column <= columns; column++) {
        nodes[row][column] = {
          x: width * column / columns + (column > 0 && column < columns ? (random() - .5) * width / columns * .55 : 0),
          y: height * row / rows + (row > 0 && row < rows ? (random() - .5) * height / rows * .55 : 0)
        };
      }
    }
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const a = nodes[row][column], b = nodes[row][column + 1], c = nodes[row + 1][column + 1], d = nodes[row + 1][column];
        if (random() > .5) {
          facets.push({ points: [a, b, d], alpha: .012 + random() * .035, shade: random() });
          facets.push({ points: [b, c, d], alpha: .012 + random() * .035, shade: random() });
          if (random() > .5) detailCracks.push({ points: jaggedBetween(b, d, 5, random, 8) });
        } else {
          facets.push({ points: [a, b, c], alpha: .012 + random() * .035, shade: random() });
          facets.push({ points: [a, c, d], alpha: .012 + random() * .035, shade: random() });
          if (random() > .5) detailCracks.push({ points: jaggedBetween(a, c, 5, random, 8) });
        }
      }
    }

    const layer = document.createElement('canvas');
    const layerScale = Math.min(2, Math.max(1.35, devicePixelRatio || 1));
    layer.width = Math.ceil(width * layerScale); layer.height = Math.ceil(height * layerScale);
    const layerContext = layer.getContext('2d', { alpha: true });
    layerContext.setTransform(layerScale, 0, 0, layerScale, 0, 0);
    layerContext.fillStyle = 'rgba(218,230,235,.035)';
    layerContext.fillRect(0, 0, width, height);

    for (const facet of facets) {
      layerContext.beginPath();
      facet.points.forEach((point, index) => index ? layerContext.lineTo(point.x, point.y) : layerContext.moveTo(point.x, point.y));
      layerContext.closePath();
      const gradient = layerContext.createLinearGradient(facet.points[0].x, facet.points[0].y, facet.points[2].x, facet.points[2].y);
      gradient.addColorStop(0, `rgba(255,255,255,${facet.alpha})`);
      gradient.addColorStop(.55, facet.shade > .5 ? `rgba(105,132,146,${facet.alpha * .5})` : `rgba(250,253,254,${facet.alpha * .18})`);
      gradient.addColorStop(1, `rgba(255,255,255,${facet.alpha * .72})`);
      layerContext.fillStyle = gradient;
      layerContext.fill();
    }
    strokeCracks(layerContext, majorCracks, 1, 2.45, .5, 1);
    strokeCracks(layerContext, detailCracks, 1, 1.15, .27, .94);
    for (const impact of impacts) {
      strokeCracks(layerContext, impact.rings, 1, 1.35, .32, .96);
    }

    const draw = now => {
      const progress = clamp((now - started) / EFFECT_MS), opacity = lifeOpacity(progress);
      const growth = ease(clamp(progress / .085));
      context.clearRect(0, 0, width, height);
      context.save();
      context.globalAlpha = opacity * growth;
      context.drawImage(layer, 0, 0, width, height);
      if (progress < .065) {
        context.globalAlpha = opacity * (1 - progress / .065) * .28;
        context.fillStyle = '#fff';
        context.fillRect(0, 0, width, height);
      }
      context.restore();
      if (progress < 1 && effect.isConnected) effectFrame = requestAnimationFrame(draw);
    };
    effectFrame = requestAnimationFrame(draw);
  }

  function show(type) {
    clearTimeout(effectTimer);
    clearTimeout(shockTimer);
    cancelAnimationFrame(effectFrame);
    document.getElementById('screenEffect')?.remove();
    document.body.classList.remove('shatter-impact');
    const effect = document.createElement('div');
    effect.id = 'screenEffect';
    effect.className = `screen-effect ${type === 'freeze' ? 'freeze-screen-effect' : 'shatter-screen-effect'}`;
    effect.setAttribute('aria-hidden', 'true');
    document.body.appendChild(effect);
    const surface = createSurface(effect, type);
    const random = seededRandom((Date.now() ^ (surface.width << 8) ^ surface.height) >>> 0);
    const started = performance.now();
    if (type === 'freeze') startFreeze(effect, surface.context, surface.width, surface.height, random, started);
    else {
      void document.body.offsetWidth;
      document.body.classList.add('shatter-impact');
      shockTimer = setTimeout(() => document.body.classList.remove('shatter-impact'), 420);
      startBust(effect, surface.context, surface.width, surface.height, random, started);
    }
    effectTimer = setTimeout(() => {
      cancelAnimationFrame(effectFrame);
      document.body.classList.remove('shatter-impact');
      if (effect.isConnected) effect.remove();
    }, EFFECT_MS);
  }

  function prewarmFrost() {
    if (frostCache || !document.body || innerWidth < 2 || innerHeight < 2) return;
    const bottomInset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bottom-ui-inset')) || 0;
    const width = innerWidth;
    const height = Math.max(1, innerHeight - bottomInset);
    const seed = ((width << 16) ^ height ^ 0x5f3759df) >>> 0;
    getFrostAsset(width, height, seededRandom(seed));
  }

  if ('requestIdleCallback' in globalThis) requestIdleCallback(prewarmFrost, { timeout: 1800 });
  else setTimeout(prewarmFrost, 900);

  globalThis.RealisticScreenEffects = { show, prewarm: prewarmFrost };
})();
