// Cover renderer: one draw function for preview and export.
// State: { layout, grade, photos[5], caption, subtitle, city,
//           showCaptions }. All sizes derive from the canvas W/H, so the
// same code draws the 720p preview and the 1920px export.

import { panelsFor, coverWindow, HERO_FOCAL } from './layouts.js';
import { gradePixels, speckle, vignette } from './grades.js';

export const INK = '#12081f';
export const TITLE_STOPS = ['#7b2ff7', '#e0218a', '#ff9a3d'];

const FONTS = [
  { family: 'Anton', url: 'fonts/Anton-Regular.ttf' },
  { family: 'Pacifico', url: 'fonts/Pacifico-Regular.ttf' },
  { family: 'Passion One', url: 'fonts/PassionOne.ttf' },
];

let fontsReady = null;
export function ensureFonts() {
  if (fontsReady) return fontsReady;
  fontsReady = (async () => {
    for (const f of FONTS) {
      try {
        const face = new FontFace(f.family, `url(${f.url})`);
        await face.load();
        document.fonts.add(face);
      } catch {
        // Canvas falls back to a system sans; the shot gate catches it.
      }
    }
    await Promise.all([
      document.fonts.load('40px "Anton"'),
      document.fonts.load('40px "Pacifico"'),
      document.fonts.load('40px "Passion One"'),
    ]);
  })();
  return fontsReady;
}

// Draw one photo into a panel rect with cover-fit around a focal point.
// Grades other than 'photo' run through a pixel pass on a scratch canvas.
function paintPanel(ctx, img, rect, grade, focal) {
  if (!img || !img.naturalWidth) {
    ctx.fillStyle = '#241335';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    return;
  }
  const win = coverWindow(img.naturalWidth, img.naturalHeight, rect, focal.fx, focal.fy, focal.zoom || 1);
  if (grade === 'photo') {
    ctx.drawImage(img, win.sx, win.sy, win.sw, win.sh, rect.x, rect.y, rect.w, rect.h);
    return;
  }
  const scratch = document.createElement('canvas');
  scratch.width = Math.max(2, Math.round(rect.w));
  scratch.height = Math.max(2, Math.round(rect.h));
  const sctx = scratch.getContext('2d');
  sctx.drawImage(img, win.sx, win.sy, win.sw, win.sh, 0, 0, scratch.width, scratch.height);
  const data = sctx.getImageData(0, 0, scratch.width, scratch.height);
  gradePixels(data, grade);
  sctx.putImageData(data, 0, 0);
  ctx.drawImage(scratch, rect.x, rect.y);
}

function starPath(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.42;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// One-line title in Passion One, sunset gradient fill over a heavy ink
// outline. px is the starting size; it grows/shrinks to fill targetW.
export function paintGradientTitle(ctx, text, cx, baselineY, px, targetW, maxPx) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  let size = px;
  ctx.font = `400 ${size}px "Passion One", "Anton", sans-serif`;
  const w0 = ctx.measureText(text).width;
  if (w0 > 0) {
    size = Math.min(maxPx, size * (targetW / w0));
    if (size < px * 0.55) size = px * 0.55;
    ctx.font = `400 ${size}px "Passion One", "Anton", sans-serif`;
  }
  const grad = ctx.createLinearGradient(0, baselineY - size, 0, baselineY);
  grad.addColorStop(0, TITLE_STOPS[0]);
  grad.addColorStop(0.52, TITLE_STOPS[1]);
  grad.addColorStop(1, TITLE_STOPS[2]);
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.lineWidth = Math.max(3, size * 0.085);
  ctx.strokeStyle = INK;
  ctx.strokeText(text, cx, baselineY);
  ctx.fillStyle = grad;
  ctx.fillText(text, cx, baselineY);
  return size;
}

function paintCityLine(ctx, city, cx, baselineY, px) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `400 ${px}px "Anton", sans-serif`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${px * 0.42}px`;
  const tw = ctx.measureText(city).width;
  ctx.fillStyle = '#ffd7ef';
  ctx.fillText(city, cx, baselineY);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  const starR = px * 0.42;
  const gap = px * 0.9;
  ctx.fillStyle = '#ffe9f6';
  starPath(ctx, cx - tw / 2 - gap, baselineY - px * 0.32, starR);
  ctx.fill();
  starPath(ctx, cx + tw / 2 + gap, baselineY - px * 0.32, starR);
  ctx.fill();
}

function paintTagline(ctx, text, cx, baselineY, px) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `400 ${px}px "Anton", sans-serif`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${px * 0.3}px`;
  ctx.fillStyle = '#ffe054';
  ctx.fillText(text, cx, baselineY);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
}

// The hero title block: scrim, city line, one-line gradient title, tagline.
// Anchored bottom-up so nothing ever falls off-canvas.
function paintHeroTitle(ctx, hero, state) {
  const { x, y, w, h } = hero;
  const scrim = ctx.createLinearGradient(0, y + h * 0.68, 0, y + h);
  scrim.addColorStop(0, 'rgba(16,3,32,0)');
  scrim.addColorStop(1, 'rgba(16,3,32,0.88)');
  ctx.fillStyle = scrim;
  ctx.fillRect(x, y + h * 0.68, w, h * 0.32);
  const cx = x + w / 2;
  const tagPx = Math.max(12, h * 0.03);
  const tagY = y + h * 0.965;
  const titlePx = Math.max(20, h * 0.115);
  const titleY = tagY - tagPx * 2.1;
  const cityPx = Math.max(11, h * 0.036);
  const cityY = titleY - titlePx * 1.28;
  paintCityLine(ctx, state.city, cx, cityY, cityPx);
  paintGradientTitle(ctx, state.caption, cx, titleY, titlePx, w * 0.86, h * 0.16);
  paintTagline(ctx, state.subtitle, cx, tagY, tagPx);
}

// Magenta corner sash with rotated text, clipped to the hero panel. The
// band's centreline runs from the top edge down to the left edge, so the
// rotation origin sits on that diagonal (12% across, 9% down the hero)
// and the text stays on-canvas, centred on the line.
function paintSash(ctx, hero, text = 'ONE NIGHT ONLY') {
  const { x, y, w, h } = hero;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.translate(x + w * 0.12, y + h * 0.09);
  ctx.rotate(-0.62);
  const bandH = Math.max(18, h * 0.055);
  ctx.fillStyle = '#e0218a';
  ctx.fillRect(-w * 0.5, -bandH / 2, w * 1.0, bandH);
  ctx.fillStyle = '#ffffff';
  ctx.font = `400 ${bandH * 0.62}px "Anton", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function paintCaption(ctx, text, px, py, pw, size) {
  ctx.save();
  ctx.font = `400 ${size}px "Anton", sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  const tw = ctx.measureText(text).width;
  ctx.fillStyle = 'rgba(16,3,32,0.72)';
  ctx.fillRect(px, py - size * 1.7, tw + size * 1.2, size * 1.7);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, px + size * 0.6, py - size * 0.35);
  ctx.restore();
}

export function drawCover(ctx, state, W, H) {
  const { layout, grade, photos } = state;
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);
  const { panels, title } = panelsFor(layout, W, H);

  if (layout === 'tilted') {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#2a0a4a');
    sky.addColorStop(0.45, '#c22a7a');
    sky.addColorStop(0.75, '#ff7a3d');
    sky.addColorStop(1, '#1a0530');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.arc(W * 0.78, H * 0.2, Math.min(W, H) * 0.09, 0, Math.PI * 2);
    ctx.fill();
  }

  // Per-panel focal points come from the editor (drag-pan / wheel-zoom);
  // shots and fresh states fall back to the hero focal / centre defaults.
  const focalFor = (p) => {
    const f = state.focus && state.focus[p.photo];
    if (f) return f;
    if (p.kind !== 'hero') return { fx: 0.5, fy: 0.5, zoom: 1 };
    // A narrow hero (story/square) cannot hold both faces if zoomed in:
    // keep zoom 1 there; wide heroes get the tighter 1.15 framing.
    const zoom = p.w / p.h < 0.9 ? 1 : HERO_FOCAL.zoom;
    return { fx: HERO_FOCAL.fx, fy: HERO_FOCAL.fy, zoom };
  };

  for (const p of panels) {
    const focal = focalFor(p);
    if (layout === 'tilted') {
      ctx.save();
      ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
      ctx.rotate(p.rot || 0);
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = Math.min(W, H) * 0.03;
      ctx.shadowOffsetY = Math.min(W, H) * 0.012;
      const pad = Math.min(p.w, p.h) * 0.045;
      ctx.fillStyle = '#fdf6ec';
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.shadowColor = 'transparent';
      const inner = { x: -p.w / 2 + pad, y: -p.h / 2 + pad, w: p.w - pad * 2, h: p.h - pad * 2.4 };
      const img = photos[p.photo];
      if (img && img.naturalWidth) {
        const win = coverWindow(img.naturalWidth, img.naturalHeight, inner, focal.fx, focal.fy, 1);
        ctx.drawImage(img, win.sx, win.sy, win.sw, win.sh, inner.x, inner.y, inner.w, inner.h);
      } else {
        ctx.fillStyle = '#241335';
        ctx.fillRect(inner.x, inner.y, inner.w, inner.h);
      }
      ctx.restore();
      continue;
    }
    paintPanel(ctx, photos[p.photo], p, grade, focal);
    if (state.showCaptions && layout !== 'band' && p.kind !== 'hero') {
      paintCaption(ctx, `SHOT 0${p.photo + 1}`, p.x + 10, p.y + p.h - 10, p.w, Math.max(12, p.h * 0.045));
    }
  }

  // Title zones per layout.
  if (title.zone === 'hero-bottom') {
    const hero = panels.find((p) => p.kind === 'hero') || panels[0];
    paintHeroTitle(ctx, hero, state);
    paintSash(ctx, hero);
  } else if (title.zone === 'cell') {
    ctx.fillStyle = '#1c0633';
    ctx.fillRect(title.x, title.y, title.w, title.h);
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(title.x + title.w / 2, title.y + title.h * 0.26, Math.min(title.w, title.h) * 0.11, 0, Math.PI * 2);
    ctx.fill();
    const cx = title.x + title.w / 2;
    paintGradientTitle(ctx, state.caption, cx, title.y + title.h * 0.62, title.h * 0.16, title.w * 0.92, title.h * 0.2);
    ctx.font = `400 ${Math.max(12, title.h * 0.075)}px "Pacifico", cursive`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff7ad9';
    ctx.fillText(state.subtitle.toLowerCase(), cx, title.y + title.h * 0.8);
  } else if (title.zone === 'band-bottom') {
    const scrim = ctx.createLinearGradient(0, title.y, 0, title.y + title.h);
    scrim.addColorStop(0, 'rgba(16,3,32,0)');
    scrim.addColorStop(1, 'rgba(16,3,32,0.9)');
    ctx.fillStyle = scrim;
    ctx.fillRect(title.x, title.y, title.w, title.h);
    const cx = title.x + title.w / 2;
    const tagPx = Math.max(11, title.h * 0.14);
    paintGradientTitle(ctx, state.caption, cx, title.y + title.h * 0.62, title.h * 0.3, title.w * 0.8, title.h * 0.36);
    paintTagline(ctx, state.subtitle, cx, title.y + title.h * 0.88, tagPx);
    paintCityLine(ctx, state.city, cx, title.y + title.h * 0.18, Math.max(10, title.h * 0.13));
  } else if (title.zone === 'diagonal') {
    ctx.save();
    ctx.translate(W / 2, title.y + title.h / 2);
    ctx.rotate(-0.1);
    ctx.fillStyle = '#1c0633';
    ctx.fillRect(-W * 0.6, -title.h / 2, W * 1.2, title.h);
    ctx.fillStyle = '#ff2ea6';
    ctx.fillRect(-W * 0.6, -title.h / 2, W * 1.2, 3);
    ctx.fillRect(-W * 0.6, title.h / 2 - 3, W * 1.2, 3);
    ctx.restore();
    paintGradientTitle(ctx, state.caption, W / 2, title.y + title.h * 0.58, title.h * 0.34, W * 0.7, title.h * 0.4);
  } else if (title.zone === 'top') {
    paintGradientTitle(ctx, state.caption, W / 2, title.h * 0.72, title.h * 0.5, W * 0.72, title.h * 0.6);
    ctx.font = `400 ${Math.max(13, title.h * 0.22)}px "Pacifico", cursive`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff7ad9';
    ctx.fillText(state.subtitle.toLowerCase(), W / 2, title.h * 0.98);
  }

  if (grade === 'poster') speckle(ctx, W, H, 0.05);
  vignette(ctx, W, H, 0.18);
}

export function drawCoverToCanvas(state, W, H) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  drawCover(canvas.getContext('2d'), state, W, H);
  return canvas;
}
