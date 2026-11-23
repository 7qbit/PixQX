// PixQX v0.7 -- tool selection, pointer handling, crop/selection/lasso/wand logic.
// Depends on globals declared in pixqx-state.js (loaded before this file).

function docToScreen(x, y) { return { x: x * zoom, y: y * zoom }; }
function screenToDoc(clientX, clientY) {
  const rect = stage.getBoundingClientRect();
  return { x: (clientX - rect.left) / zoom, y: (clientY - rect.top) / zoom };
}

function setZoom(z) {
  zoom = Math.max(0.05, Math.min(8, z));
  rebuildStageDOM();
  document.getElementById('zoomLabel').textContent = Math.round(zoom * 100) + '%';
}
function fitZoom() {
  const availW = canvasWrap.clientWidth - 60;
  const availH = canvasWrap.clientHeight - 60;
  setZoom(Math.min(availW / doc.w, availH / doc.h, 1));
}

// ---------- Tool selection ----------
document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTool = btn.dataset.tool;
    stage.dataset.tool = currentTool;
    cropRect = null;
    selection = null;
    document.getElementById('cropActions').style.display = 'none';
    overlayCtx.clearRect(0,0,overlay.width, overlay.height);
  };
});

function getColor() { return fgColor; }
function getSize() { return parseInt(document.getElementById('sizeRange').value, 10); }
function getOpacity() { return parseInt(document.getElementById('opRange').value, 10) / 100; }

document.getElementById('sizeRange').oninput = e => document.getElementById('sizeVal').textContent = e.target.value;
document.getElementById('opRange').oninput = e => document.getElementById('opVal').textContent = e.target.value + '%';
document.getElementById('layerOpRange').oninput = e => {
  const v = parseInt(e.target.value, 10) / 100;
  document.getElementById('layerOpVal').textContent = e.target.value + '%';
  const l = activeLayer(); if (l) { l.opacity = v; rebuildStageDOM(); }
};

stage.addEventListener('mousedown', onPointerDown);
stage.addEventListener('mousemove', onPointerMove);
window.addEventListener('mouseup', onPointerUp);
stage.addEventListener('mousemove', e => {
  const p = screenToDoc(e.clientX, e.clientY);
  cursorReadout.textContent = Math.round(p.x) + ', ' + Math.round(p.y);
});

let lassoPoints = null;

function onPointerDown(e) {
  if (e.target.closest('#cropActions')) return;
  const p = screenToDoc(e.clientX, e.clientY);
  startPos = p; lastPos = p; drawing = true;
  const l = activeLayer(); if (!l) return;

  if (currentTool === 'brush' || currentTool === 'eraser') {
    l.ctx.save();
    l.ctx.globalCompositeOperation = currentTool === 'eraser' ? 'destination-out' : 'source-over';
    l.ctx.globalAlpha = getOpacity();
    l.ctx.strokeStyle = getColor();
    l.ctx.lineWidth = getSize();
    l.ctx.lineCap = 'round'; l.ctx.lineJoin = 'round';
    l.ctx.beginPath();
    l.ctx.moveTo(p.x, p.y);
    l.ctx.lineTo(p.x + 0.01, p.y + 0.01);
    l.ctx.stroke();
  } else if (currentTool === 'pencil') {
    l.ctx.save();
    l.ctx.globalAlpha = getOpacity();
    l.ctx.fillStyle = getColor();
    l.ctx.imageSmoothingEnabled = false;
    const s = Math.max(1, Math.round(getSize() / 4));
    l.ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s);
  } else if (currentTool === 'bucket') {
    floodFill(l, Math.round(p.x), Math.round(p.y), getColor(), getOpacity());
    refreshLayerThumb();
    pushHistory();
    drawing = false;
  } else if (currentTool === 'eyedropper') {
    const px = l.ctx.getImageData(Math.round(p.x), Math.round(p.y), 1, 1).data;
    const hex = '#' + [px[0],px[1],px[2]].map(v => v.toString(16).padStart(2,'0')).join('');
    fgColor = hex;
    document.getElementById('fgSwatch').style.background = hex;
    drawing = false;
  } else if (currentTool === 'crop') {
    cropRect = { x: p.x, y: p.y, w: 0, h: 0 };
  } else if (currentTool === 'select') {
    selection = { x: p.x, y: p.y, w: 0, h: 0 };
  } else if (currentTool === 'lasso') {
    lassoPoints = [p];
  } else if (currentTool === 'wand') {
    magicWandSelect(l, Math.round(p.x), Math.round(p.y));
    drawing = false;
  } else if (currentTool === 'hand') {
    panStart = { scrollLeft: canvasWrap.scrollLeft, scrollTop: canvasWrap.scrollTop, clientX: e.clientX, clientY: e.clientY };
  } else if (currentTool === 'zoom') {
    if (e.altKey || e.shiftKey) setZoom(zoom / 1.25); else setZoom(zoom * 1.25);
    drawing = false;
  }
}

function onPointerMove(e) {
  if (!drawing) return;
  const p = screenToDoc(e.clientX, e.clientY);
  const l = activeLayer();

  if (currentTool === 'brush' || currentTool === 'eraser') {
    l.ctx.lineTo(p.x, p.y);
    l.ctx.stroke();
    lastPos = p;
  } else if (currentTool === 'pencil') {
    const s = Math.max(1, Math.round(getSize() / 4));
    l.ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s);
    lastPos = p;
  } else if (currentTool === 'move') {
    const dx = p.x - lastPos.x, dy = p.y - lastPos.y;
    const tmp = document.createElement('canvas');
    tmp.width = l.canvas.width; tmp.height = l.canvas.height;
    tmp.getContext('2d').drawImage(l.canvas, 0, 0);
    l.ctx.clearRect(0,0,l.canvas.width,l.canvas.height);
    l.ctx.drawImage(tmp, dx, dy);
    lastPos = p;
  } else if (['rect','ellipse','line'].includes(currentTool)) {
    overlayCtx.clearRect(0,0,overlay.width, overlay.height);
    overlayCtx.strokeStyle = getColor();
    overlayCtx.fillStyle = getColor();
    overlayCtx.globalAlpha = getOpacity();
    overlayCtx.lineWidth = getSize();
    drawShape(overlayCtx, currentTool, startPos, p);
  } else if (currentTool === 'crop' && cropRect) {
    cropRect.w = p.x - cropRect.x; cropRect.h = p.y - cropRect.y;
    overlayCtx.clearRect(0,0,overlay.width, overlay.height);
    overlayCtx.fillStyle = 'rgba(0,0,0,0.5)';
    overlayCtx.fillRect(0,0,overlay.width, overlay.height);
    overlayCtx.clearRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
    overlayCtx.strokeStyle = '#ff8a3d';
    overlayCtx.lineWidth = 1;
    overlayCtx.strokeRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
  } else if (currentTool === 'select' && selection) {
    selection.w = p.x - selection.x; selection.h = p.y - selection.y;
    renderSelectionOverlay();
  } else if (currentTool === 'lasso' && lassoPoints) {
    lassoPoints.push(p);
    overlayCtx.clearRect(0,0,overlay.width, overlay.height);
    overlayCtx.setLineDash([6,4]);
    overlayCtx.strokeStyle = '#4fd1c5';
    overlayCtx.lineWidth = 1;
    overlayCtx.beginPath();
    overlayCtx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
    for (let i=1;i<lassoPoints.length;i++) overlayCtx.lineTo(lassoPoints[i].x, lassoPoints[i].y);
    overlayCtx.stroke();
    overlayCtx.setLineDash([]);
  } else if (currentTool === 'hand' && panStart) {
    canvasWrap.scrollLeft = panStart.scrollLeft - (e.clientX - panStart.clientX);
    canvasWrap.scrollTop = panStart.scrollTop - (e.clientY - panStart.clientY);
  }
}

function drawShape(ctx, tool, a, b) {
  ctx.beginPath();
  if (tool === 'rect') {
    ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
  } else if (tool === 'ellipse') {
    const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
    const rx = Math.abs(b.x - a.x) / 2, ry = Math.abs(b.y - a.y) / 2;
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (tool === 'line') {
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
}

function onPointerUp(e) {
  if (!drawing) return;
  drawing = false;
  const l = activeLayer();
  if (currentTool === 'brush' || currentTool === 'eraser') {
    l.ctx.restore();
    refreshLayerThumb(); pushHistory();
  } else if (currentTool === 'pencil') {
    refreshLayerThumb(); pushHistory();
  } else if (['rect','ellipse','line'].includes(currentTool) && lastPos) {
    const p = screenToDoc(e.clientX, e.clientY);
    l.ctx.save();
    l.ctx.strokeStyle = getColor(); l.ctx.fillStyle = getColor();
    l.ctx.globalAlpha = getOpacity(); l.ctx.lineWidth = getSize();
    drawShape(l.ctx, currentTool, startPos, p);
    l.ctx.restore();
    overlayCtx.clearRect(0,0,overlay.width, overlay.height);
    refreshLayerThumb(); pushHistory();
  } else if (currentTool === 'move') {
    pushHistory();
  } else if (currentTool === 'crop' && cropRect) {
    normalizeCropRect();
    if (cropRect.w < 2 || cropRect.h < 2) {
      cancelCrop();
    } else {
      showCropActions();
    }
  } else if (currentTool === 'select' && selection) {
    let { x, y, w, h } = selection;
    if (w < 0) { x += w; w = -w; }
    if (h < 0) { y += h; h = -h; }
    selection = { x, y, w, h };
    renderSelectionOverlay();
  } else if (currentTool === 'lasso' && lassoPoints) {
    finishLasso();
  } else if (currentTool === 'hand') {
    panStart = null;
  }
  lastPos = null;
}

// ---------- Crop ----------
function normalizeCropRect() {
  let { x, y, w, h } = cropRect;
  if (w < 0) { x += w; w = -w; }
  if (h < 0) { y += h; h = -h; }
  cropRect = { x, y, w, h };
}

function showCropActions() {
  const box = document.getElementById('cropActions');
  const left = (cropRect.x + cropRect.w / 2) * zoom;
  const top = (cropRect.y + cropRect.h) * zoom + 8;
  box.style.left = Math.max(0, left - 80) + 'px';
  box.style.top = Math.min(stage.clientHeight - 10, top) + 'px';
  box.style.display = 'flex';
}
function hideCropActions() { document.getElementById('cropActions').style.display = 'none'; }
function cancelCrop() { cropRect = null; hideCropActions(); overlayCtx.clearRect(0,0,overlay.width,overlay.height); }

document.getElementById('cropApply').onclick = () => { applyCrop(); hideCropActions(); };
document.getElementById('cropCancel').onclick = () => cancelCrop();

function applyCrop() {
  if (!cropRect || Math.abs(cropRect.w) < 2 || Math.abs(cropRect.h) < 2) { cropRect = null; overlayCtx.clearRect(0,0,overlay.width,overlay.height); return; }
  let { x, y, w, h } = cropRect;
  if (w < 0) { x += w; w = -w; }
  if (h < 0) { y += h; h = -h; }
  x = Math.max(0, Math.round(x)); y = Math.max(0, Math.round(y));
  w = Math.round(w); h = Math.round(h);
  layers.forEach(layer => {
    const tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    tmp.getContext('2d').drawImage(layer.canvas, -x, -y);
    layer.canvas.width = w; layer.canvas.height = h;
    layer.ctx.drawImage(tmp, 0, 0);
  });
  doc = { w, h };
  cropRect = null;
  overlayCtx.clearRect(0,0,overlay.width,overlay.height);
  rebuildStageDOM(); renderLayerList(); fitZoom(); pushHistory();
}

// ---------- Rectangular selection ----------
function renderSelectionOverlay() {
  overlayCtx.clearRect(0,0,overlay.width, overlay.height);
  if (!selection) return;
  if (selection.mask) {
    const img = overlayCtx.createImageData(selection.w, selection.h);
    for (let i = 0; i < selection.mask.length; i++) {
      if (selection.mask[i]) {
        img.data[i*4] = 79; img.data[i*4+1] = 209; img.data[i*4+2] = 197; img.data[i*4+3] = 110;
      }
    }
    overlayCtx.putImageData(img, selection.x, selection.y);
  }
  overlayCtx.setLineDash([6,4]);
  overlayCtx.strokeStyle = '#4fd1c5';
  overlayCtx.lineWidth = 1;
  overlayCtx.strokeRect(selection.x, selection.y, selection.w, selection.h);
  overlayCtx.setLineDash([]);
}

// ---------- Lasso (polygon selection via scanline rasterization) ----------
function finishLasso() {
  const pts = lassoPoints;
  lassoPoints = null;
  overlayCtx.clearRect(0,0,overlay.width, overlay.height);
  if (!pts || pts.length < 3) return;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  pts.forEach(p => { minX = Math.min(minX,p.x); minY = Math.min(minY,p.y); maxX = Math.max(maxX,p.x); maxY = Math.max(maxY,p.y); });
  minX = Math.max(0, Math.floor(minX)); minY = Math.max(0, Math.floor(minY));
  maxX = Math.min(doc.w, Math.ceil(maxX)); maxY = Math.min(doc.h, Math.ceil(maxY));
  const w = Math.max(1, maxX - minX), h = Math.max(1, maxY - minY);
  if (w < 2 || h < 2) return;

  const mask = new Uint8Array(w * h);
  // Standard scanline polygon fill (even-odd rule), one row at a time.
  for (let row = 0; row < h; row++) {
    const y = minY + row + 0.5;
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i+1) % pts.length];
      if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
        const t = (y - a.y) / (b.y - a.y);
        xs.push(a.x + t * (b.x - a.x));
      }
    }
    xs.sort((a,b) => a-b);
    for (let i = 0; i < xs.length - 1; i += 2) {
      const xStart = Math.max(0, Math.round(xs[i] - minX));
      const xEnd = Math.min(w, Math.round(xs[i+1] - minX));
      for (let x = xStart; x < xEnd; x++) mask[row*w + x] = 1;
    }
  }
  selection = { x: minX, y: minY, w, h, mask };
  renderSelectionOverlay();
}

// ---------- Magic wand ----------
function magicWandSelect(layer, startX, startY) {
  const w = layer.canvas.width, h = layer.canvas.height;
  if (startX < 0 || startY < 0 || startX >= w || startY >= h) return;
  const imgData = layer.ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const idx = (startY * w + startX) * 4;
  const target = [data[idx], data[idx+1], data[idx+2], data[idx+3]];
  const tolerance = 32;
  const visited = new Uint8Array(w * h);
  function matches(i) {
    return Math.abs(data[i]-target[0]) <= tolerance && Math.abs(data[i+1]-target[1]) <= tolerance &&
           Math.abs(data[i+2]-target[2]) <= tolerance && Math.abs(data[i+3]-target[3]) <= tolerance;
  }
  const stack = [[startX, startY]];
  let minX = startX, minY = startY, maxX = startX, maxY = startY;
  while (stack.length) {
    const [cx, cy] = stack.pop();
    if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue;
    const pos = cy * w + cx;
    if (visited[pos]) continue;
    const i = pos * 4;
    if (!matches(i)) continue;
    visited[pos] = 1;
    if (cx < minX) minX = cx; if (cx > maxX) maxX = cx;
    if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
    stack.push([cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]);
  }
  const bw = maxX - minX + 1, bh = maxY - minY + 1;
  const mask = new Uint8Array(bw * bh);
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    mask[y*bw + x] = visited[(minY+y) * w + (minX+x)];
  }
  selection = { x: minX, y: minY, w: bw, h: bh, mask };
  renderSelectionOverlay();
}

// ---------- Flood fill (bucket tool) ----------
function floodFill(layer, x, y, hexColor, alpha) {
  const ctx = layer.ctx;
  const w = layer.canvas.width, h = layer.canvas.height;
  if (x < 0 || y < 0 || x >= w || y >= h) return;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const idx = (y * w + x) * 4;
  const target = [data[idx], data[idx+1], data[idx+2], data[idx+3]];
  const fill = hexToRgb(hexColor);
  const fillA = Math.round(alpha * 255);
  if (target[0] === fill[0] && target[1] === fill[1] && target[2] === fill[2] && target[3] === fillA) return;
  const stack = [[x,y]];
  const tolerance = 32;
  function matches(i) {
    return Math.abs(data[i]-target[0]) <= tolerance && Math.abs(data[i+1]-target[1]) <= tolerance &&
           Math.abs(data[i+2]-target[2]) <= tolerance && Math.abs(data[i+3]-target[3]) <= tolerance;
  }
  while (stack.length) {
    const [cx, cy] = stack.pop();
    if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue;
    const i = (cy * w + cx) * 4;
    if (!matches(i)) continue;
    data[i] = fill[0]; data[i+1] = fill[1]; data[i+2] = fill[2]; data[i+3] = fillA;
    stack.push([cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]);
  }
  ctx.putImageData(imgData, 0, 0);
}

function hexToRgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255, 255];
}

function refreshLayerThumb() { renderLayerList(); }

// ---------- Text tool ----------
stage.addEventListener('dblclick', (e) => {
  if (currentTool !== 'text') return;
  const p = screenToDoc(e.clientX, e.clientY);
  const txt = prompt('Text eingeben:');
  if (!txt) return;
  const l = activeLayer();
  l.ctx.save();
  l.ctx.fillStyle = getColor();
  l.ctx.globalAlpha = getOpacity();
  l.ctx.font = (getSize() * 2) + 'px sans-serif';
  l.ctx.textBaseline = 'top';
  l.ctx.fillText(txt, p.x, p.y);
  l.ctx.restore();
  refreshLayerThumb(); pushHistory();
});
