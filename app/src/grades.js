// Colour grades as pure pixel operations on ImageData.
// 'photo' is the default: the photo passes through untouched, so the cover
// stays photographic. 'poster' is an optional painterly treatment. The
// others are gradient-map style sunset/neon looks. Every op is
// deterministic: no timestamps, no Math.random anywhere in this file.

export const GRADES = [
  { id: 'photo', label: 'Photo (as shot)' },
  { id: 'poster', label: 'Poster ink' },
  { id: 'sunset', label: 'Vice sunset' },
  { id: 'neon', label: 'Neon night' },
  { id: 'golden', label: 'Golden hour' },
  { id: 'dusk', label: 'Teal dusk' },
  { id: 'mono', label: 'Mono ink' },
];

function clamp(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

function lift(d, sat, con, bright) {
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const grey = 0.299 * r + 0.587 * g + 0.114 * b;
    d[i] = clamp(((r - grey) * sat + grey - 128) * con + 128 + bright);
    d[i + 1] = clamp(((g - grey) * sat + grey - 128) * con + 128 + bright);
    d[i + 2] = clamp(((b - grey) * sat + grey - 128) * con + 128 + bright);
  }
}

function posterize(d, levels) {
  const step = 255 / (levels - 1);
  for (let i = 0; i < d.length; i += 4) {
    d[i] = Math.round(d[i] / step) * step;
    d[i + 1] = Math.round(d[i + 1] / step) * step;
    d[i + 2] = Math.round(d[i + 2] / step) * step;
  }
}

// Split-tone: warm highlights, cool shadows, by mixing two tints
// proportional to luminance.
function splitTone(d, warm, cool, amount) {
  for (let i = 0; i < d.length; i += 4) {
    const lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
    const t = lum < 0.5 ? (1 - lum * 2) * amount : 0;
    const s = lum >= 0.5 ? (lum * 2 - 1) * amount : 0;
    d[i] = clamp(d[i] + warm[0] * s + cool[0] * t);
    d[i + 1] = clamp(d[i + 1] + warm[1] * s + cool[1] * t);
    d[i + 2] = clamp(d[i + 2] + warm[2] * s + cool[2] * t);
  }
}

export function gradePixels(imageData, grade) {
  const d = imageData.data;
  switch (grade) {
    case 'photo':
      return; // untouched by design
    case 'poster':
      lift(d, 1.35, 1.12, 0);
      posterize(d, 5);
      return;
    case 'sunset':
      lift(d, 1.15, 1.06, 4);
      splitTone(d, [26, 8, -14], [-16, -6, 22], 0.5);
      return;
    case 'neon':
      lift(d, 1.3, 1.18, -6);
      splitTone(d, [18, -10, 26], [-22, -8, 30], 0.55);
      return;
    case 'golden':
      lift(d, 1.1, 1.04, 10);
      splitTone(d, [30, 16, -18], [-10, -4, 6], 0.45);
      return;
    case 'dusk':
      lift(d, 1.18, 1.1, -2);
      splitTone(d, [20, -6, 18], [-18, 14, 26], 0.55);
      return;
    case 'mono': {
      for (let i = 0; i < d.length; i += 4) {
        const grey = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const v = clamp((grey - 128) * 1.25 + 128);
        d[i] = clamp(v + 22);
        d[i + 1] = clamp(v * 0.94);
        d[i + 2] = clamp(v * 1.1);
      }
      return;
    }
    default:
      return;
  }
}

// Fixed-seed grain: the same dots on every run, so two renders are
// byte-identical. mulberry32 with the competition date as the seed.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function speckle(ctx, w, h, alpha, seed = 20261119) {
  const rand = mulberry32(seed);
  const count = Math.floor((w * h) / 260);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < count; i++) {
    const x = rand() * w;
    const y = rand() * h;
    ctx.fillRect(x, y, 1.4, 1.4);
  }
  ctx.fillStyle = '#000000';
  for (let i = 0; i < count; i++) {
    const x = rand() * w;
    const y = rand() * h;
    ctx.fillRect(x, y, 1.4, 1.4);
  }
  ctx.restore();
}

export function vignette(ctx, w, h, strength = 0.22) {
  const g = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.42,
    w / 2, h / 2, Math.max(w, h) * 0.75,
  );
  g.addColorStop(0, 'rgba(8,2,18,0)');
  g.addColorStop(1, `rgba(8,2,18,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
