// Panel geometry for Midnight Duo. Every layout is a pure function of the
// canvas size: given W and H it returns the photo panels (each with the
// sample index it shows) and, where the layout has one, the title zone.
// Coordinates are canvas pixels; g is the ink gutter between panels.
// The band layout is the default: hero + 2x2, title block on the hero only.

export const LAYOUTS = [
  { id: 'band', label: 'Band (hero + 2x2)' },
  { id: 'nine', label: 'Nine-panel classic' },
  { id: 'hero', label: 'Hero + three' },
  { id: 'bleed', label: 'Full-bleed hero' },
  { id: 'tilted', label: 'Tilted snapshots' },
  { id: 'diptych', label: 'Diptych split' },
  { id: 'strip', label: 'Strip comic' },
];

const INK = 8; // gutter width, scaled with canvas size below

function gutter(w, h) {
  return Math.max(4, Math.round(Math.min(w, h) * 0.006));
}

// Cover-fit source window: pick the sub-rectangle of the photo that fills
// rect without distortion, keeping the focal point (fx, fy as fractions of
// the photo) visible. zoom > 1 tightens the crop around the focal point.
export function coverWindow(photoW, photoH, rect, fx, fy, zoom = 1) {
  const want = rect.w / rect.h;
  const have = photoW / photoH;
  let sw;
  let sh;
  if (have > want) {
    sh = photoH / zoom;
    sw = sh * want;
  } else {
    sw = photoW / zoom;
    sh = sw / want;
  }
  // Keep the focal point at the same relative spot inside the window.
  let sx = fx * photoW - sw * fx;
  let sy = fy * photoH - sh * fy;
  sx = Math.max(0, Math.min(photoW - sw, sx));
  sy = Math.max(0, Math.min(photoH - sh, sy));
  return { sx, sy, sw, sh };
}

// The hero photo (the duo) needs its focal point left of centre: the woman
// stands on the left of the frame, the man on the right, both faces in the
// upper half. fx 0.16 keeps the woman's face inside the crop at every
// aspect; the zoom tightens only when the hero is wide enough to still hold
// both faces (see focalFor in cover.js).
export const HERO_FOCAL = { fx: 0.16, fy: 0.36, zoom: 1.15 };

function split2x2(x, y, w, h, g, base) {
  const cw = (w - g) / 2;
  const ch = (h - g) / 2;
  return [
    { x, y, w: cw, h: ch, photo: base + 1 },
    { x: x + cw + g, y, w: cw, h: ch, photo: base + 2 },
    { x, y: y + ch + g, w: cw, h: ch, photo: base + 3 },
    { x: x + cw + g, y: y + ch + g, w: cw, h: ch, photo: base + 4 },
  ];
}

// Band: hero + 2x2. Wide canvases put the hero on the left; square and
// tall canvases (portrait/story) put the hero on top, so the woman is never
// cropped out of the frame by a narrow side column.
export function bandPanels(w, h) {
  const g = gutter(w, h);
  const hero = { photo: 0, kind: 'hero' };
  if (w > h) {
    const heroW = Math.round(w * 0.56);
    hero.x = 0;
    hero.y = 0;
    hero.w = heroW;
    hero.h = h;
    const rest = split2x2(heroW + g, 0, w - heroW - g, h, g, 0);
    return { panels: [hero, ...rest], title: { ...hero, zone: 'hero-bottom' } };
  }
  const heroH = Math.round(h * 0.52);
  hero.x = 0;
  hero.y = 0;
  hero.w = w;
  hero.h = heroH;
  const rest = split2x2(0, heroH + g, w, h - heroH - g, g, 0);
  return { panels: [hero, ...rest], title: { ...hero, zone: 'hero-bottom' } };
}

export function panelsFor(layout, w, h) {
  const g = gutter(w, h);
  switch (layout) {
    case 'band':
      return bandPanels(w, h);
    case 'nine': {
      const cw = (w - g * 2) / 3;
      const ch = (h - g * 2) / 3;
      const panels = [];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          if (r === 1 && c === 1) continue; // centre cell is the title
          panels.push({
            x: c * (cw + g),
            y: r * (ch + g),
            w: cw,
            h: ch,
            photo: panels.length % 5,
          });
        }
      }
      return {
        panels,
        title: { x: cw + g, y: ch + g, w: cw, h: ch, zone: 'cell' },
      };
    }
    case 'hero': {
      const heroW = Math.round(w * 0.62);
      const hero = { x: 0, y: 0, w: heroW, h, photo: 0, kind: 'hero' };
      const stackH = (h - g * 2) / 3;
      const stack = [1, 2, 3].map((p, i) => ({
        x: heroW + g,
        y: i * (stackH + g),
        w: w - heroW - g,
        h: stackH,
        photo: p,
      }));
      return {
        panels: [hero, ...stack],
        title: { ...hero, zone: 'hero-bottom' },
      };
    }
    case 'bleed': {
      const stripH = Math.round(h * 0.13);
      const minis = [1, 2, 3].map((p, i) => ({
        x: i * ((w - g * 2) / 3 + g),
        y: 0,
        w: (w - g * 2) / 3,
        h: stripH,
        photo: p,
      }));
      return {
        panels: [
          { x: 0, y: 0, w, h, photo: 0, kind: 'hero' },
          ...minis,
        ],
        title: { x: 0, y: h - Math.round(h * 0.24), w, h: Math.round(h * 0.24), zone: 'band-bottom' },
      };
    }
    case 'tilted': {
      // Three polaroid cards scattered over a painted sky; positions are
      // fractions so the composition scales to any export size.
      const cards = [
        { fx: 0.1, fy: 0.1, fw: 0.42, fh: 0.55, rot: -0.05, photo: 0 },
        { fx: 0.48, fy: 0.05, fw: 0.42, fh: 0.5, rot: 0.04, photo: 1 },
        { fx: 0.28, fy: 0.48, fw: 0.46, fh: 0.46, rot: -0.02, photo: 3 },
      ].map((c) => ({
        x: c.fx * w,
        y: c.fy * h,
        w: c.fw * w,
        h: c.fh * h,
        rot: c.rot,
        photo: c.photo,
      }));
      return {
        panels: cards,
        title: { x: 0, y: 0, w, h: Math.round(h * 0.12), zone: 'top' },
      };
    }
    case 'diptych': {
      const half = (w - g) / 2;
      return {
        panels: [
          { x: 0, y: 0, w: half, h, photo: 0, kind: 'hero' },
          { x: half + g, y: 0, w: half, h, photo: 2 },
        ],
        title: { x: 0, y: Math.round(h * 0.42), w, h: Math.round(h * 0.16), zone: 'diagonal' },
      };
    }
    case 'strip': {
      const bandH = (h - g * 3) / 4;
      const panels = [0, 1, 2, 3].map((p, i) => ({
        x: 0,
        y: i * (bandH + g),
        w,
        h: bandH,
        photo: p,
      }));
      return {
        panels,
        title: { x: 0, y: Math.round(h * 0.36), w, h: Math.round(h * 0.28), zone: 'band-bottom' },
      };
    }
    default:
      return bandPanels(w, h);
  }
}
