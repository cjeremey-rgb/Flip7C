(() => {
  'use strict';

  const EFFECT_MS = 4000;
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
    const width = Math.max(1, innerWidth);
    const height = Math.max(1, innerHeight);
    const scale = type === 'freeze' ? 2 : Math.min(3, Math.max(2, devicePixelRatio || 1));
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
    for (let y = 0; y < maskHeight; y++) {
      for (let x = 0; x < maskWidth; x++) {
        const screenX = x * maskScale, screenY = y * maskScale;
        const distance = Math.min(screenX, width - screenX, screenY, height - screenY);
        const irregularity = (fractalNoise(screenX * .026, screenY * .026, seed + 211) - .5) * .34;
        activation[y * maskWidth + x] = clamp(distance / (minimum * .5) + irregularity);
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
    const draw = now => {
      const progress = clamp((now - animationStarted) / EFFECT_MS);
      const growth = ease(clamp(progress / .22));
      const opacity = lifeOpacity(progress);
      const maskIndex = Math.min(frost.maskFrames.length - 1, Math.round(growth * (frost.maskFrames.length - 1)));
      context.clearRect(0, 0, width, height);
      context.save();
      context.globalAlpha = opacity;
      context.drawImage(frost.composite, 0, 0, width, height);
      context.globalCompositeOperation = 'destination-in';
      context.drawImage(frost.maskFrames[maskIndex], 0, 0, width, height);
      context.restore();
      if (progress < 1 && effect.isConnected) effectFrame = requestAnimationFrame(draw);
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
    const minimum = Math.min(width, height);
    const center = { x: width * (.45 + random() * .1), y: height * (.36 + random() * .2) };
    const angles = Array.from({ length: 44 }, (_, index) => Math.PI * 2 * index / 44 + (random() - .5) * .21).sort((a, b) => a - b);
    const rays = [], branches = [], microCracks = [], ringSegments = [], facets = [], satellites = [], dust = [], crater = [], lcdLines = [];

    for (let index = 0; index < angles.length; index++) {
      const angle = angles[index], edge = edgeDistance(center, angle, width, height);
      const distance = edge * (index % 6 === 0 ? .92 + random() * .13 : .23 + random() * .68);
      const points = jaggedLine(center, angle, distance, 11 + Math.floor(random() * 8), random, .105);
      rays.push({ points, angle, distance });
      for (let branchIndex = 0; branchIndex < 4 + Math.floor(random() * 4); branchIndex++) {
        const fromIndex = 2 + Math.floor(random() * (points.length - 4));
        const start = points[fromIndex];
        const branchAngle = angle + (random() > .5 ? 1 : -1) * (.22 + random() * .72);
        branches.push({ points: jaggedLine(start, branchAngle, distance * (.035 + random() * .15), 4 + Math.floor(random() * 3), random, .22), delay: .025 + random() * .14 });
      }
    }

    const pointAt = (ray, fraction) => {
      const position = (ray.points.length - 1) * clamp(fraction), index = Math.floor(position), amount = position - index;
      const a = ray.points[index], b = ray.points[Math.min(ray.points.length - 1, index + 1)];
      return { x: a.x + (b.x - a.x) * amount, y: a.y + (b.y - a.y) * amount };
    };

    const ringFractions = [.035, .055, .08, .115, .16, .22, .3, .4, .53, .68];
    for (let ringIndex = 0; ringIndex < ringFractions.length; ringIndex++) {
      for (let index = 0; index < rays.length; index++) {
        if (random() < .2 + ringIndex * .018) continue;
        const next = (index + 1) % rays.length;
        const fraction = ringFractions[ringIndex] * (.86 + random() * .26);
        const a = pointAt(rays[index], fraction), b = pointAt(rays[next], fraction * (.9 + random() * .2));
        const middle = { x: (a.x + b.x) / 2 + (random() - .5) * (3 + ringIndex), y: (a.y + b.y) / 2 + (random() - .5) * (3 + ringIndex) };
        ringSegments.push({ points: [a, middle, b], delay: .045 + ringIndex * .012 + random() * .05 });
      }
    }

    for (let index = 0; index < rays.length; index++) {
      const next = (index + 1) % rays.length;
      for (let band = 0; band < 3; band++) {
        const inner = .035 + band * .19 + random() * .055, outer = Math.min(.92, inner + .13 + random() * .24);
        facets.push({ points: [pointAt(rays[index], inner), pointAt(rays[index], outer), pointAt(rays[next], Math.min(.94, outer * (.88 + random() * .16))), pointAt(rays[next], inner * (.9 + random() * .18))], alpha: .008 + random() * .052, shade: random(), shift: random() * 1.8 });
      }
    }

    for (let index = 0; index < 168; index++) {
      const angle = random() * Math.PI * 2, startRadius = Math.pow(random(), 1.8) * 42;
      const start = { x: center.x + Math.cos(angle) * startRadius, y: center.y + Math.sin(angle) * startRadius };
      microCracks.push({ points: jaggedLine(start, angle + (random() - .5) * .8, 6 + random() * 62, 3 + Math.floor(random() * 5), random, .38), delay: random() * .1 });
    }

    for (let index = 0; index < 2; index++) {
      const angle = random() * Math.PI * 2, distance = minimum * (.18 + random() * .2);
      const hit = { x: center.x + Math.cos(angle) * distance, y: center.y + Math.sin(angle) * distance, cracks: [] };
      for (let ray = 0; ray < 11; ray++) hit.cracks.push({ points: jaggedLine(hit, Math.PI * 2 * ray / 11 + (random() - .5) * .34, 11 + random() * 48, 4, random, .25) });
      satellites.push(hit);
    }

    for (let index = 0; index < 96; index++) {
      const angle = random() * Math.PI * 2, distance = Math.pow(random(), 1.8) * 68;
      dust.push({ x: center.x + Math.cos(angle) * distance, y: center.y + Math.sin(angle) * distance, radius: .22 + random() * 1.7, alpha: .22 + random() * .7 });
    }
    for (let index = 0; index < 26; index++) {
      const angle = Math.PI * 2 * index / 26, radius = 6 + random() * 9;
      crater.push({ x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius });
    }
    for (const [offset, color] of [[-8, 'rgba(255,35,70,.7)'], [-5, 'rgba(50,215,255,.65)'], [4, 'rgba(110,255,120,.55)'], [9, 'rgba(155,70,255,.55)']]) {
      lcdLines.push({ x1: center.x + offset, y1: Math.max(0, center.y - 150 - random() * 45), x2: center.x + offset + (random() - .5) * 2, y2: Math.min(height, center.y + 185 + random() * 80), color });
    }

    const draw = now => {
      const progress = clamp((now - started) / EFFECT_MS), opacity = lifeOpacity(progress);
      const mainGrowth = ease(clamp(progress / .075));
      const detailGrowth = ease(clamp((progress - .018) / .12));
      const webGrowth = ease(clamp((progress - .035) / .18));
      context.clearRect(0, 0, width, height);
      context.save();
      context.globalAlpha = opacity;

      if (progress < .08) {
        const flash = context.createRadialGradient(center.x, center.y, 0, center.x, center.y, Math.max(width, height) * .52);
        flash.addColorStop(0, `rgba(255,255,255,${.78 * (1 - progress / .08)})`);
        flash.addColorStop(.16, `rgba(255,255,255,${.27 * (1 - progress / .08)})`);
        flash.addColorStop(1, 'rgba(255,255,255,0)');
        context.fillStyle = flash;
        context.fillRect(0, 0, width, height);
      }

      context.save();
      context.globalAlpha = opacity * mainGrowth * .62;
      context.translate(center.x, center.y);
      context.scale(1.5, .72);
      const lcdBruise = context.createRadialGradient(0, 0, 0, 0, 0, 78);
      lcdBruise.addColorStop(0, 'rgba(0,0,0,.9)');
      lcdBruise.addColorStop(.22, 'rgba(5,9,13,.72)');
      lcdBruise.addColorStop(.43, 'rgba(68,18,85,.23)');
      lcdBruise.addColorStop(.62, 'rgba(20,105,118,.16)');
      lcdBruise.addColorStop(1, 'rgba(0,0,0,0)');
      context.fillStyle = lcdBruise;
      context.beginPath();
      context.arc(0, 0, 78, 0, Math.PI * 2);
      context.fill();
      context.restore();

      context.save();
      context.globalAlpha = opacity * mainGrowth * .34;
      for (const line of lcdLines) {
        context.strokeStyle = line.color;
        context.lineWidth = .65;
        context.beginPath();
        context.moveTo(line.x1, line.y1);
        context.lineTo(line.x2, line.y2);
        context.stroke();
      }
      context.restore();

      for (const facet of facets) {
        context.beginPath();
        facet.points.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
        context.closePath();
        const gradient = context.createLinearGradient(facet.points[0].x, facet.points[0].y, facet.points[2].x, facet.points[2].y);
        gradient.addColorStop(0, `rgba(255,255,255,${facet.alpha * webGrowth})`);
        gradient.addColorStop(.5, facet.shade > .5 ? `rgba(125,151,162,${facet.alpha * .45 * webGrowth})` : `rgba(248,252,253,${facet.alpha * .15 * webGrowth})`);
        gradient.addColorStop(1, `rgba(255,255,255,${facet.alpha * .75 * webGrowth})`);
        context.fillStyle = gradient;
        context.fill();
      }

      strokeCracks(context, rays, mainGrowth, 3.05, .56, opacity);
      const visibleBranches = branches.map(branch => ({ points: branch.points, fraction: clamp((detailGrowth - branch.delay) / (1 - branch.delay)) }));
      context.strokeStyle = 'rgba(0,2,3,.82)'; context.lineWidth = 1.7; context.shadowBlur = 0;
      for (const branch of visibleBranches) drawPath(context, branch.points, branch.fraction);
      context.strokeStyle = 'rgba(255,255,255,.9)'; context.lineWidth = .38;
      for (const branch of visibleBranches) drawPath(context, branch.points, branch.fraction);

      const visibleMicro = microCracks.map(crack => ({ points: crack.points, fraction: clamp((detailGrowth - crack.delay) / (1 - crack.delay)) }));
      context.strokeStyle = 'rgba(0,2,3,.72)'; context.lineWidth = 1.05;
      for (const crack of visibleMicro) drawPath(context, crack.points, crack.fraction);
      context.strokeStyle = 'rgba(255,255,255,.8)'; context.lineWidth = .28;
      for (const crack of visibleMicro) drawPath(context, crack.points, crack.fraction);

      for (const segment of ringSegments) {
        const local = clamp((webGrowth - segment.delay) / (1 - segment.delay));
        context.strokeStyle = 'rgba(0,2,3,.76)'; context.lineWidth = 1.45; drawPath(context, segment.points, local);
        context.strokeStyle = 'rgba(255,255,255,.84)'; context.lineWidth = .32; drawPath(context, segment.points, local);
      }

      for (const hit of satellites) {
        strokeCracks(context, hit.cracks, webGrowth, 1.75, .35, opacity);
        const chip = context.createRadialGradient(hit.x, hit.y, 0, hit.x, hit.y, 9);
        chip.addColorStop(0, 'rgba(0,2,3,.9)'); chip.addColorStop(.25, 'rgba(255,255,255,.92)'); chip.addColorStop(.47, 'rgba(30,35,38,.7)'); chip.addColorStop(1, 'rgba(255,255,255,0)');
        context.fillStyle = chip; context.beginPath(); context.arc(hit.x, hit.y, 9 * webGrowth, 0, Math.PI * 2); context.fill();
      }

      context.globalAlpha = opacity * mainGrowth;
      for (const particle of dust) { context.fillStyle = `rgba(245,249,250,${particle.alpha})`; context.beginPath(); context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2); context.fill(); }
      context.beginPath(); crater.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y)); context.closePath();
      context.fillStyle = 'rgba(0,1,2,.94)'; context.fill(); context.lineWidth = 1.25; context.strokeStyle = 'rgba(255,255,255,.96)'; context.stroke();
      const impact = context.createRadialGradient(center.x, center.y, 0, center.x, center.y, 36);
      impact.addColorStop(0, 'rgba(0,0,0,.98)'); impact.addColorStop(.16, 'rgba(8,10,12,.94)'); impact.addColorStop(.25, 'rgba(255,255,255,.98)'); impact.addColorStop(.35, 'rgba(21,27,30,.86)'); impact.addColorStop(.5, 'rgba(255,255,255,.55)'); impact.addColorStop(1, 'rgba(255,255,255,0)');
      context.fillStyle = impact; context.beginPath(); context.arc(center.x, center.y, 36 * mainGrowth, 0, Math.PI * 2); context.fill();
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
    const seed = ((innerWidth << 16) ^ innerHeight ^ 0x5f3759df) >>> 0;
    getFrostAsset(innerWidth, innerHeight, seededRandom(seed));
  }

  if ('requestIdleCallback' in globalThis) requestIdleCallback(prewarmFrost, { timeout: 1800 });
  else setTimeout(prewarmFrost, 900);

  globalThis.RealisticScreenEffects = { show, prewarm: prewarmFrost };
})();
