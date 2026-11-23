// PixQX v0.7 -- UI wiring: top bar, panels, modals, file I/O, shortcuts, app init.

// ---------- Layer panel actions ----------
document.getElementById('btnAddLayer').onclick = () => {
  layers.push(newLayer('Ebene ' + layerIdCounter, doc.w, doc.h, null));
  activeLayerIndex = layers.length - 1;
  rebuildStageDOM(); renderLayerList(); updateLayerInfo(); syncLayerOpacityUI(); pushHistory();
};
document.getElementById('btnDupLayer').onclick = () => {
  const l = activeLayer(); if (!l) return;
  const c = document.createElement('canvas');
  c.width = l.canvas.width; c.height = l.canvas.height;
  c.getContext('2d').drawImage(l.canvas, 0, 0);
  const copy = { id: layerIdCounter++, name: l.name + ' Kopie', canvas: c, ctx: c.getContext('2d'), visible: l.visible, opacity: l.opacity };
  layers.splice(activeLayerIndex + 1, 0, copy);
  activeLayerIndex++;
  rebuildStageDOM(); renderLayerList(); updateLayerInfo(); pushHistory();
};
document.getElementById('btnDelLayer').onclick = () => {
  if (layers.length <= 1) return;
  layers.splice(activeLayerIndex, 1);
  activeLayerIndex = Math.max(0, activeLayerIndex - 1);
  rebuildStageDOM(); renderLayerList(); updateLayerInfo(); syncLayerOpacityUI(); pushHistory();
};
document.getElementById('btnUpLayer').onclick = () => {
  if (activeLayerIndex >= layers.length - 1) return;
  [layers[activeLayerIndex], layers[activeLayerIndex+1]] = [layers[activeLayerIndex+1], layers[activeLayerIndex]];
  activeLayerIndex++;
  rebuildStageDOM(); renderLayerList(); pushHistory();
};
document.getElementById('btnDownLayer').onclick = () => {
  if (activeLayerIndex <= 0) return;
  [layers[activeLayerIndex], layers[activeLayerIndex-1]] = [layers[activeLayerIndex-1], layers[activeLayerIndex]];
  activeLayerIndex--;
  rebuildStageDOM(); renderLayerList(); pushHistory();
};
document.getElementById('btnMergeDown').onclick = () => {
  if (activeLayerIndex <= 0) return;
  const upper = layers[activeLayerIndex];
  const lower = layers[activeLayerIndex - 1];
  lower.ctx.save();
  lower.ctx.globalAlpha = upper.opacity;
  if (upper.visible) lower.ctx.drawImage(upper.canvas, 0, 0);
  lower.ctx.restore();
  layers.splice(activeLayerIndex, 1);
  activeLayerIndex = activeLayerIndex - 1;
  rebuildStageDOM(); renderLayerList(); updateLayerInfo(); syncLayerOpacityUI(); pushHistory();
};

// ---------- Filters ----------
function withImageData(layer, fn) {
  const w = layer.canvas.width, h = layer.canvas.height;
  const imgData = layer.ctx.getImageData(0, 0, w, h);
  fn(imgData.data);
  layer.ctx.putImageData(imgData, 0, 0);
}

document.querySelectorAll('.filter-grid button').forEach(btn => {
  btn.onclick = () => {
    const l = activeLayer(); if (!l) return;
    const key = btn.dataset.filter;
    if (key === 'blur') boxBlur(l);
    else if (key === 'sharpen') sharpen(l);
    else if (key === 'vignette') vignette(l);
    else if (key === 'pixelate') pixelate(l);
    else withImageData(l, filters[key]);
    refreshLayerThumb(); pushHistory();
  };
});

// ---------- Foreground / background colors ----------
const fgSwatch = document.getElementById('fgSwatch');
const bgSwatch = document.getElementById('bgSwatch');
fgSwatch.value = fgColor; bgSwatch.value = bgColor;
fgSwatch.oninput = (e) => { fgColor = e.target.value; };
bgSwatch.oninput = (e) => { bgColor = e.target.value; };
document.getElementById('fgbgSwap').onclick = () => {
  const t = fgColor; fgColor = bgColor; bgColor = t;
  fgSwatch.value = fgColor; bgSwatch.value = bgColor;
};

// ---------- File: open / new / export / insert-as-layer ----------
function loadFileAsNewTab(file) {
  const img = new Image();
  img.onload = () => {
    createNewTab(img.width, img.height, null, file.name.replace(/\.[^/.]+$/, '') || undefined);
    activeLayer().ctx.drawImage(img, 0, 0);
    renderLayerList(); pushHistory();
  };
  img.src = URL.createObjectURL(file);
}

document.getElementById('fileInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  loadFileAsNewTab(file);
});

// "Bild einfügen" -- adds the chosen image as a new layer on top of the current
// document instead of replacing it (Bild-in-Bild-Bearbeitung). Additive, so it
// does not touch any other tab.
document.getElementById('insertInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const img = new Image();
  img.onload = () => {
    const layer = newLayer('Bild ' + layerIdCounter, doc.w, doc.h, null);
    const scale = Math.min(1, doc.w / img.width, doc.h / img.height);
    const dw = img.width * scale, dh = img.height * scale;
    const dx = (doc.w - dw) / 2, dy = (doc.h - dh) / 2;
    layer.ctx.drawImage(img, dx, dy, dw, dh);
    layers.push(layer);
    activeLayerIndex = layers.length - 1;
    rebuildStageDOM(); renderLayerList(); updateLayerInfo(); syncLayerOpacityUI(); pushHistory();
  };
  img.src = URL.createObjectURL(file);
});

document.getElementById('btnNew').onclick = () => document.getElementById('newModal').classList.add('show');
document.getElementById('newCancel').onclick = () => document.getElementById('newModal').classList.remove('show');
document.getElementById('newCreate').onclick = () => {
  const w = parseInt(document.getElementById('newW').value, 10) || 800;
  const h = parseInt(document.getElementById('newH').value, 10) || 600;
  const bg = document.getElementById('newBg').value;
  createNewTab(w, h, bg);
  document.getElementById('newModal').classList.remove('show');
};

// Unsaved-changes warning (now only triggered when closing a tab with unexported work)
document.getElementById('warnCancel').onclick = () => {
  pendingAction = null; pendingCloseTabId = null;
  document.getElementById('warnModal').classList.remove('show');
};
document.getElementById('warnDiscard').onclick = () => {
  document.getElementById('warnModal').classList.remove('show');
  const action = pendingAction; pendingAction = null; pendingCloseTabId = null;
  if (action) action();
};
document.getElementById('warnExport').onclick = () => {
  document.getElementById('warnModal').classList.remove('show');
  if (pendingCloseTabId !== null && pendingCloseTabId !== activeTabId) {
    switchTab(pendingCloseTabId);
  }
  pendingAction = null; pendingCloseTabId = null;
  document.getElementById('exportModal').classList.add('show');
};

document.getElementById('btnAbout').onclick = () => document.getElementById('aboutModal').classList.add('show');
document.getElementById('aboutClose').onclick = () => document.getElementById('aboutModal').classList.remove('show');

document.getElementById('btnExport').onclick = () => document.getElementById('exportModal').classList.add('show');
document.getElementById('exportCancel').onclick = () => document.getElementById('exportModal').classList.remove('show');

document.getElementById('exportFormat').onchange = (e) => {
  document.getElementById('exportQualityWrap').style.display = (e.target.value === 'image/png') ? 'none' : 'block';
};
document.getElementById('exportQuality').oninput = (e) => {
  document.getElementById('exportQualityVal').textContent = e.target.value + '%';
};

const formatExt = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

document.getElementById('exportConfirm').onclick = () => {
  const mime = document.getElementById('exportFormat').value;
  const quality = parseInt(document.getElementById('exportQuality').value, 10) / 100;
  const baseName = document.getElementById('exportName').value.trim() || 'pixqx-export';

  const out = document.createElement('canvas');
  out.width = doc.w; out.height = doc.h;
  const ctx = out.getContext('2d');
  if (mime === 'image/jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, doc.w, doc.h);
  }
  layers.forEach(l => {
    if (!l.visible) return;
    ctx.globalAlpha = l.opacity;
    ctx.drawImage(l.canvas, 0, 0);
  });

  const dataUrl = (mime === 'image/png') ? out.toDataURL(mime) : out.toDataURL(mime, quality);
  const a = document.createElement('a');
  a.download = baseName + '.' + formatExt[mime];
  a.href = dataUrl;
  a.click();
  hasUnsavedWork = false;
  document.getElementById('exportModal').classList.remove('show');
};

// ---------- Selection: delete / copy / paste (keyboard-driven) ----------
function deleteSelectionContents() {
  if (!selection || selection.w < 1 || selection.h < 1) return;
  const l = activeLayer(); if (!l) return;
  if (selection.mask) {
    const img = l.ctx.getImageData(selection.x, selection.y, selection.w, selection.h);
    for (let i = 0; i < selection.mask.length; i++) {
      if (selection.mask[i]) img.data[i*4+3] = 0;
    }
    l.ctx.putImageData(img, selection.x, selection.y);
  } else {
    l.ctx.clearRect(selection.x, selection.y, selection.w, selection.h);
  }
  refreshLayerThumb(); pushHistory();
}

function copySelectionToClipboard() {
  if (!selection || selection.w < 1 || selection.h < 1) return;
  const l = activeLayer(); if (!l) return;
  const tmp = document.createElement('canvas');
  tmp.width = Math.round(selection.w); tmp.height = Math.round(selection.h);
  const tctx = tmp.getContext('2d');
  tctx.drawImage(l.canvas, -selection.x, -selection.y);
  if (selection.mask) {
    const img = tctx.getImageData(0, 0, tmp.width, tmp.height);
    for (let i = 0; i < selection.mask.length; i++) {
      if (!selection.mask[i]) img.data[i*4+3] = 0;
    }
    tctx.putImageData(img, 0, 0);
  }
  clipboardSelection = { dataURL: tmp.toDataURL(), w: tmp.width, h: tmp.height, x: selection.x, y: selection.y };
}

function pasteClipboardSelection() {
  if (!clipboardSelection) return;
  const img = new Image();
  img.onload = () => {
    const layer = newLayer('Einf\u00fcgung ' + layerIdCounter, doc.w, doc.h, null);
    layer.ctx.drawImage(img, clipboardSelection.x, clipboardSelection.y);
    layers.push(layer);
    activeLayerIndex = layers.length - 1;
    rebuildStageDOM(); renderLayerList(); updateLayerInfo(); syncLayerOpacityUI(); pushHistory();
  };
  img.src = clipboardSelection.dataURL;
}

// ---------- Keyboard shortcuts ----------
window.addEventListener('keydown', (e) => {
  if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;

  if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); return; }
  if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); redo(); return; }
  if (e.ctrlKey && e.key === 'c') { copySelectionToClipboard(); return; }
  if (e.ctrlKey && e.key === 'v') { pasteClipboardSelection(); return; }
  if ((e.key === 'Delete' || e.key === 'Backspace') && selection) { deleteSelectionContents(); return; }

  const map = { v:'move', b:'brush', e:'eraser', g:'bucket', r:'rect', o:'ellipse', l:'line',
                t:'text', i:'eyedropper', c:'crop', s:'select', k:'lasso', w:'wand',
                p:'pencil', h:'hand', z:'zoom' };
  if (map[e.key]) {
    const btn = document.querySelector('.tool-btn[data-tool="'+map[e.key]+'"]');
    if (btn) btn.click();
  }
});

// ---------- Zoom controls, undo/redo buttons ----------
document.getElementById('zoomIn').onclick = () => setZoom(zoom * 1.25);
document.getElementById('zoomOut').onclick = () => setZoom(zoom / 1.25);
document.getElementById('zoomFit').onclick = fitZoom;
document.getElementById('btnUndo').onclick = undo;
document.getElementById('btnRedo').onclick = redo;

// ---------- Paste image from OS clipboard ----------
window.addEventListener('paste', (e) => {
  const items = e.clipboardData.items;
  for (const item of items) {
    if (item.type.indexOf('image') === 0) {
      const blob = item.getAsFile();
      const img = new Image();
      img.onload = () => {
        const l = activeLayer();
        if (l) { l.ctx.drawImage(img, 0, 0); refreshLayerThumb(); pushHistory(); }
      };
      img.src = URL.createObjectURL(blob);
    }
  }
});

// ---------- Drag & drop ----------
canvasWrap.addEventListener('dragover', e => e.preventDefault());
canvasWrap.addEventListener('drop', e => {
  e.preventDefault();
  const file = e.dataTransfer.files[0]; if (!file) return;
  loadFileAsNewTab(file);
});

// ---------- App init ----------
createNewTab(1200, 800, '#ffffff', 'Unbenannt 1');
window.addEventListener('resize', () => rebuildStageDOM());
window.addEventListener('beforeunload', (e) => {
  saveCurrentTabState();
  if (tabs.some(t => t.hasUnsavedWork)) { e.preventDefault(); e.returnValue = ''; }
});
