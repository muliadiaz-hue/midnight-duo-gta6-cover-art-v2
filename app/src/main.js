// Editor wiring for Midnight Duo: tray, controls, preview, export,
// undo/redo, drag-pan and wheel-zoom on the selected panel.
// The preview and the PNG export share one code path (drawCover), so what
// you see is exactly what exports.

import { drawCover, drawCoverToCanvas, ensureFonts } from './cover.js';
import { LAYOUTS, HERO_FOCAL } from './layouts.js';
import { GRADES } from './grades.js';
import { loadSamples, loadFromFile, SAMPLE_FILES, SAMPLE_LABELS } from './panels.js';
import { runShotScene, SIZES, pickPanelAt } from './shots.js';

const $ = (id) => document.getElementById(id);
const DEFAULTS = {
  layout: 'band',
  grade: 'photo',
  size: 'wide',
  caption: 'MIDNIGHT DUO',
  subtitle: 'TWO LEADS · ONE SCORE',
  city: 'AZURA BAY',
  showCaptions: false,
};

function defaultFocus() {
  return [
    { ...HERO_FOCAL },
    { fx: 0.5, fy: 0.5, zoom: 1 },
    { fx: 0.5, fy: 0.5, zoom: 1 },
    { fx: 0.5, fy: 0.5, zoom: 1 },
    { fx: 0.5, fy: 0.5, zoom: 1 },
  ];
}

function snapshotOf(state) {
  return JSON.stringify({
    layout: state.layout,
    grade: state.grade,
    size: state.size,
    caption: state.caption,
    subtitle: state.subtitle,
    city: state.city,
    showCaptions: state.showCaptions,
    focus: state.focus,
  });
}

function applySnapshot(state, json) {
  const s = JSON.parse(json);
  Object.assign(state, s);
}

class Editor {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = { ...DEFAULTS, photos: [], focus: defaultFocus(), selected: 0 };
    this.undoStack = [];
    this.redoStack = [];
  }

  pushHistory() {
    this.undoStack.push(snapshotOf(this.state));
    if (this.undoStack.length > 60) this.undoStack.shift();
    this.redoStack.length = 0;
  }

  undo() {
    if (!this.undoStack.length) return;
    this.redoStack.push(snapshotOf(this.state));
    applySnapshot(this.state, this.undoStack.pop());
    this.syncControls();
    this.draw();
  }

  redo() {
    if (!this.redoStack.length) return;
    this.undoStack.push(snapshotOf(this.state));
    applySnapshot(this.state, this.redoStack.pop());
    this.syncControls();
    this.draw();
  }

  previewSize() {
    const [w, h] = SIZES[this.state.size];
    const scale = Math.min(1, 960 / Math.max(w, h));
    return [Math.round(w * scale), Math.round(h * scale)];
  }

  draw() {
    const [w, h] = this.previewSize();
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    drawCover(this.ctx, this.state, w, h);
    const status = $('status');
    if (status) {
      status.textContent =
        `${this.state.layout} · ${this.state.grade} · ${this.state.size} ` +
        `${SIZES[this.state.size][0]}×${SIZES[this.state.size][1]} · panel ${this.state.selected + 1} selected`;
    }
  }

  syncControls() {
    const set = (id, value) => {
      const el = $(id);
      if (el) el.value = value;
    };
    set('caption', this.state.caption);
    set('subtitle', this.state.subtitle);
    set('city', this.state.city);
    set('size', this.state.size);
    document.querySelectorAll('[data-layout]').forEach((b) =>
      b.classList.toggle('active', b.dataset.layout === this.state.layout));
    document.querySelectorAll('[data-grade]').forEach((b) =>
      b.classList.toggle('active', b.dataset.grade === this.state.grade));
  }

  exportPNG() {
    const [w, h] = SIZES[this.state.size];
    const out = drawCoverToCanvas(this.state, w, h);
    out.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `midnight-duo-${this.state.size}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }, 'image/png');
  }
}

function buildButtons(containerId, items, key, onPick) {
  const box = $(containerId);
  box.innerHTML = '';
  for (const item of items) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = item.label;
    b.dataset[key] = item.id;
    b.addEventListener('click', () => onPick(item.id));
    box.appendChild(b);
  }
}

async function initEditor() {
  const editor = new Editor($('cover'));
  await ensureFonts();
  editor.state.photos = await loadSamples();
  window.__editor = editor;

  buildButtons('layouts', LAYOUTS, 'layout', (id) => {
    editor.pushHistory();
    editor.state.layout = id;
    editor.syncControls();
    editor.draw();
  });
  buildButtons('grades', GRADES, 'grade', (id) => {
    editor.pushHistory();
    editor.state.grade = id;
    editor.syncControls();
    editor.draw();
  });

  // Tray: click a sample to drop it onto the selected panel.
  const tray = $('tray');
  SAMPLE_FILES.forEach((file, i) => {
    const img = document.createElement('img');
    img.src = `samples/${file}`;
    img.alt = SAMPLE_LABELS[i];
    img.title = SAMPLE_LABELS[i];
    img.addEventListener('click', () => {
      editor.pushHistory();
      const slot = editor.state.selected;
      editor.state.photos[slot] = editor.state.photos[i];
      editor.draw();
    });
    tray.appendChild(img);
  });

  $('upload').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const img = await loadFromFile(file);
    if (img) {
      editor.pushHistory();
      editor.state.photos[editor.state.selected] = img;
      editor.draw();
    }
    e.target.value = '';
  });

  const bindText = (id, key) => {
    $(id).addEventListener('input', (e) => {
      editor.state[key] = e.target.value.toUpperCase();
      editor.draw();
    });
    $(id).addEventListener('change', () => editor.pushHistory());
  };
  bindText('caption', 'caption');
  bindText('subtitle', 'subtitle');
  bindText('city', 'city');
  $('size').addEventListener('change', (e) => {
    editor.pushHistory();
    editor.state.size = e.target.value;
    editor.draw();
  });
  $('captions').addEventListener('change', (e) => {
    editor.pushHistory();
    editor.state.showCaptions = e.target.checked;
    editor.draw();
  });
  $('export').addEventListener('click', () => editor.exportPNG());
  $('undo').addEventListener('click', () => editor.undo());
  $('redo').addEventListener('click', () => editor.redo());

  // Drag to pan the selected panel's photo, wheel to zoom it.
  let dragging = null;
  editor.canvas.addEventListener('pointerdown', (e) => {
    const r = editor.canvas.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * editor.canvas.width;
    const py = ((e.clientY - r.top) / r.height) * editor.canvas.height;
    const hit = pickPanelAt(editor.state, editor.canvas.width, editor.canvas.height, px, py);
    if (hit >= 0) {
      editor.state.selected = hit;
      dragging = { x: px, y: py, moved: false };
      editor.canvas.setPointerCapture(e.pointerId);
      editor.draw();
    }
  });
  editor.canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const r = editor.canvas.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * editor.canvas.width;
    const py = ((e.clientY - r.top) / r.height) * editor.canvas.height;
    const f = editor.state.focus[editor.state.selected];
    f.fx -= (px - dragging.x) / editor.canvas.width / 2;
    f.fy -= (py - dragging.y) / editor.canvas.height / 2;
    f.fx = Math.max(0.05, Math.min(0.95, f.fx));
    f.fy = Math.max(0.05, Math.min(0.95, f.fy));
    dragging = { x: px, y: py, moved: true };
    editor.draw();
  });
  editor.canvas.addEventListener('pointerup', () => {
    if (dragging && dragging.moved) editor.pushHistory();
    dragging = null;
  });
  editor.canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const f = editor.state.focus[editor.state.selected];
    f.zoom = Math.max(1, Math.min(2.2, f.zoom * (e.deltaY < 0 ? 1.08 : 0.93)));
    editor.draw();
  }, { passive: false });

  editor.syncControls();
  editor.draw();
  window.__shotReady = true;
}

const params = new URLSearchParams(location.search);
if (params.get('shot') === 'cover') {
  document.getElementById('app').style.display = 'none';
  const stage = document.getElementById('stage');
  stage.style.display = 'block';
  runShotScene(document.getElementById('shot'));
} else {
  initEditor();
  if (params.get('shot') === 'editor') {
    // Editor shot: the driver waits for __shotReady, set at init end.
  }
}
