import * as THREE from 'three';

function canvas2d(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, x: c.getContext('2d') };
}

function toTexture(canvas, colorSpace = THREE.SRGBColorSpace) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = colorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function makeGlowTexture(size = 128) {
  const { c, x } = canvas2d(size, size);
  x.clearRect(0, 0, size, size);
  const m = size / 2;
  const g = x.createRadialGradient(m, m, 0, m, m, m);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.12, 'rgba(255,255,255,0.98)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.5)');
  g.addColorStop(0.58, 'rgba(255,255,255,0.13)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, size, size);
  return toTexture(c);
}

export function makeFlareTexture(size = 256) {
  const { c, x } = canvas2d(size, size);
  const m = size / 2;
  x.clearRect(0, 0, size, size);
  x.globalCompositeOperation = 'lighter';

  const g = x.createRadialGradient(m, m, 0, m, m, m);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.08, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.22, 'rgba(255,242,210,0.38)');
  g.addColorStop(0.52, 'rgba(255,205,140,0.07)');
  g.addColorStop(1, 'rgba(255,180,100,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, size, size);

  x.translate(m, m);
  for (let i = 0; i < 4; i++) {
    x.save();
    x.rotate((i * Math.PI) / 4);
    const len = i % 2 === 0 ? m * 0.98 : m * 0.58;
    const lg = x.createLinearGradient(-len, 0, len, 0);
    lg.addColorStop(0, 'rgba(255,255,255,0)');
    lg.addColorStop(0.36, 'rgba(255,236,196,0.05)');
    lg.addColorStop(0.49, 'rgba(255,255,255,0.65)');
    lg.addColorStop(0.5, 'rgba(255,255,255,0.9)');
    lg.addColorStop(0.51, 'rgba(255,255,255,0.65)');
    lg.addColorStop(0.64, 'rgba(255,236,196,0.05)');
    lg.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = lg;
    x.fillRect(-len, -1.1, len * 2, 2.2);
    x.restore();
  }
  return toTexture(c);
}

export function makeSparkTexture(size = 64) {
  const { c, x } = canvas2d(size, size);
  const m = size / 2;
  const g = x.createRadialGradient(m, m, 0, m, m, m);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.22, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.46, 'rgba(255,255,255,0.22)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, size, size);
  return toTexture(c);
}

export function makeRingTexture(size = 256) {
  const { c, x } = canvas2d(size, size);
  const m = size / 2;
  x.clearRect(0, 0, size, size);
  const g = x.createRadialGradient(m, m, m * 0.61, m, m, m * 0.98);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.61, 'rgba(255,255,255,0)');
  g.addColorStop(0.79, 'rgba(255,255,255,0.16)');
  g.addColorStop(0.93, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.975, 'rgba(255,255,255,0.62)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, size, size);
  return toTexture(c);
}

export function makeSmokeTexture(size = 192) {
  const { c, x } = canvas2d(size, size);
  x.clearRect(0, 0, size, size);
  const blobs = [
    [0.5, 0.52, 0.34, 0.8],
    [0.38, 0.44, 0.25, 0.62],
    [0.63, 0.42, 0.28, 0.7],
    [0.57, 0.64, 0.28, 0.6],
    [0.34, 0.63, 0.22, 0.44],
    [0.72, 0.63, 0.2, 0.38],
    [0.5, 0.32, 0.18, 0.38],
  ];
  for (const [px, py, r, a] of blobs) {
    const g = x.createRadialGradient(
      px * size,
      py * size,
      r * size * 0.1,
      px * size,
      py * size,
      r * size,
    );
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(0.5, `rgba(255,255,255,${a * 0.36})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, size, size);
  }
  // Break up the silhouette with a few transparent wisps.
  x.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 10; i++) {
    const g = x.createRadialGradient(
      Math.random() * size,
      Math.random() * size,
      0,
      Math.random() * size,
      Math.random() * size,
      size * (0.06 + Math.random() * 0.1),
    );
    g.addColorStop(0, 'rgba(0,0,0,0.25)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, size, size);
  }
  return toTexture(c);
}

export function makeCloudTexture(size = 256) {
  const { c, x } = canvas2d(size, size * 0.55);
  const h = size * 0.55;
  x.clearRect(0, 0, size, h);
  const blobs = [];
  for (let i = 0; i < 18; i++) {
    blobs.push([0.16 + Math.random() * 0.68, 0.38 + Math.random() * 0.26, 0.07 + Math.random() * 0.15]);
  }
  for (const [px, py, r] of blobs) {
    const g = x.createRadialGradient(px * size, py * h, 0, px * size, py * h, r * size);
    g.addColorStop(0, 'rgba(255,255,255,0.2)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.09)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, size, h);
  }
  return toTexture(c);
}

export function makeMoonTexture(size = 256) {
  const { c, x } = canvas2d(size, size);
  const m = size / 2;
  const base = x.createRadialGradient(m * 0.82, m * 0.72, 0, m, m, m * 0.5);
  base.addColorStop(0, '#fff9e8');
  base.addColorStop(0.55, '#f6ead2');
  base.addColorStop(1, '#d9cab3');
  x.fillStyle = base;
  x.beginPath();
  x.arc(m, m, m * 0.44, 0, Math.PI * 2);
  x.fill();

  x.save();
  x.beginPath();
  x.arc(m, m, m * 0.44, 0, Math.PI * 2);
  x.clip();
  const craters = [
    [0.41, 0.42, 0.075], [0.61, 0.35, 0.045], [0.56, 0.61, 0.1],
    [0.35, 0.65, 0.04], [0.68, 0.54, 0.035], [0.48, 0.28, 0.03],
    [0.31, 0.48, 0.025], [0.66, 0.68, 0.025],
  ];
  for (const [cx, cy, r] of craters) {
    const g = x.createRadialGradient(cx * size, cy * size, 0, cx * size, cy * size, r * size);
    g.addColorStop(0, 'rgba(150,136,120,0.24)');
    g.addColorStop(0.7, 'rgba(180,165,145,0.1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.beginPath();
    x.arc(cx * size, cy * size, r * size, 0, Math.PI * 2);
    x.fill();
  }
  x.restore();
  return toTexture(c);
}

export function makeWindowTexture(seed = 1, cols = 9, rows = 26) {
  const { c, x } = canvas2d(160, 384);
  x.fillStyle = '#05070c';
  x.fillRect(0, 0, c.width, c.height);

  // Subtle facade bands.
  x.fillStyle = 'rgba(255,255,255,0.025)';
  for (let r = 0; r < rows; r++) {
    x.fillRect(0, (r / rows) * c.height, c.width, 1);
  }

  let s = seed * 9277;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  const cw = c.width / cols;
  const ch = c.height / rows;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const on = rnd() > 0.56;
      if (!on) {
        x.fillStyle = 'rgba(55,75,100,0.045)';
      } else {
        const r = rnd();
        if (r > 0.73) x.fillStyle = 'rgba(180,218,255,0.68)';
        else if (r > 0.26) x.fillStyle = 'rgba(255,203,132,0.72)';
        else x.fillStyle = 'rgba(255,237,190,0.8)';
      }
      x.fillRect(
        col * cw + cw * 0.22,
        row * ch + ch * 0.23,
        cw * 0.52,
        Math.max(1, ch * 0.34),
      );
    }
  }
  const tex = toTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.1, 2.2);
  return tex;
}

export function makeRadialGradientTexture(inner, outer, size = 128) {
  const { c, x } = canvas2d(size, size);
  const m = size / 2;
  const g = x.createRadialGradient(m, m, 0, m, m, m);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  x.fillStyle = g;
  x.fillRect(0, 0, size, size);
  return toTexture(c);
}
