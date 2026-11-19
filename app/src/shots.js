// Deterministic shot scenes for screenshots (?shot=...).
// shot=cover renders the cover full-frame at the requested size; shot=editor
// shows the editor with the duo photo loaded. Both set window.__shotReady
// once fonts and photos are in and the first frame is drawn, so the
// screenshot driver can wait on it instead of guessing a delay.

import { drawCover, ensureFonts } from './cover.js';
import { loadSamples } from './panels.js';
import { panelsFor } from './layouts.js';

export const SIZES = {
  square: [1080, 1080],
  portrait: [1080, 1350],
  wide: [1920, 1080],
  story: [1080, 1920],
};

export function shotState(params) {
  return {
    layout: params.get('layout') || 'band',
    grade: params.get('grade') || 'photo',
    caption: params.get('caption') || 'MIDNIGHT DUO',
    subtitle: params.get('subtitle') || 'TWO LEADS · ONE SCORE',
    city: params.get('city') || 'AZURA BAY',
    photos: [],
    showCaptions: false,
  };
}

export async function runShotScene(canvas) {
  const params = new URLSearchParams(location.search);
  const shot = params.get('shot') || 'cover';
  const state = shotState(params);
  const photoName = params.get('photo') || 'duo';
  await ensureFonts();
  state.photos = await loadSamples();
  if (shot === 'editor') {
    // The editor page draws itself (main.js); the scene only pre-loads.
    window.__shotPhotos = state.photos;
    window.__shotState = state;
    window.__shotReady = true;
    return;
  }
  // Render at the viewport's own pixel size: the screenshot driver sets the
  // viewport to the shot's w/h from shots.json, so the capture is exactly
  // the cover at that size (the size param only picks the aspect).
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w;
  canvas.height = h;
  // Scale the canvas element to the viewport so the screenshot is exactly
  // the cover at the shot's pixel size.
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext('2d');
  drawCover(ctx, state, w, h);
  window.__shotReady = true;
  return { state, size: [w, h] };
}

export function pickPanelAt(state, W, H, px, py) {
  const { panels } = panelsFor(state.layout, W, H);
  for (let i = panels.length - 1; i >= 0; i--) {
    const p = panels[i];
    if (px >= p.x && px <= p.x + p.w && py >= p.y && py <= p.y + p.h) return i;
  }
  return -1;
}
