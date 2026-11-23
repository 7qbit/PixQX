// PixQX v0.7 -- core state, document/layer model, history, multi-tab management
// Shares the global script scope with the other pixqx-*.js files (classic scripts,
// loaded in order via <script defer>, intentionally NOT ES modules, so that plain
// `let` state declared here stays directly readable/writable from pixqx-tools.js
// and pixqx-ui.js without any import/export wiring.

const stage = document.getElementById('stage');
const overlay = document.getElementById('overlay');
const overlayCtx = overlay.getContext('2d');
const canvasWrap = document.getElementById('canvasWrap');
const layerListEl = document.getElementById('layerList');
const cursorReadout = document.getElementById('cursorReadout');
const docSizeEl = document.getElementById('docSize');
const layerInfoEl = document.getElementById('layerInfo');
const tabBarEl = document.getElementById('tabBarRow');

let doc = { w: 1200, h: 800 };
let layers = [];          // {id, name, canvas, ctx, visible, opacity}
let activeLayerIndex = 0;
let zoom = 1;
let currentTool = 'move';
let drawing = false;
let lastPos = null;
let startPos = null;
let history = [];          // snapshots: {doc, activeLayerIndex, layers:[{id,name,visible,opacity,dataURL}]}
let historyIndex = -1;
const MAX_HISTORY = 25;
let layerIdCounter = 1;
let cropRect = null;
let hasUnsavedWork = false;
let pendingAction = null;
let pendingCloseTabId = null;
let selection = null;          // {x,y,w,h,mask?}  mask: Uint8Array sized w*h, local to bbox
let clipboardSelection = null; // {dataURL, w, h, x, y}
let panStart = null;
let fgColor = '#ff8a3d';
let bgColor = '#1d2024';

// ---------- Tabs ----------
let tabs = [];
let activeTabId = null;
let tabIdCounter = 1;
let tabNameCounter = 1;

function newLayer(name, w, h, fillColor) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.style.width = w + 'px';
  c.style.height = h + 'px';
  const ctx = c.getContext('2d');
  if (fillColor) { ctx.fillStyle = fillColor; ctx.fillRect(0,0,w,h); }
  const layer = { id: layerIdCounter++, name, canvas: c, ctx, visible: true, opacity: 1 };
  return layer;
}

function rebuildStageDOM() {
  Array.from(stage.querySelectorAll('canvas.layer-canvas')).forEach(c => c.remove());
  layers.forEach(layer => {
    layer.canvas.classList.add('layer-canvas');
    layer.canvas.style.opacity = layer.visible ? layer.opacity : 0;
    stage.insertBefore(layer.canvas, overlay);
  });
  stage.style.width = (doc.w * zoom) + 'px';
  stage.style.height = (doc.h * zoom) + 'px';
  overlay.width = doc.w; overlay.height = doc.h;
  overlay.style.width = (doc.w * zoom) + 'px';
  overlay.style.height = (doc.h * zoom) + 'px';
  layers.forEach(layer => {
    layer.canvas.style.width = (doc.w * zoom) + 'px';
    layer.canvas.style.height = (doc.h * zoom) + 'px';
  });
  docSizeEl.textContent = doc.w + ' \u00d7 ' + doc.h + ' px';
}

function renderLayerList() {
  layerListEl.innerHTML = '';
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    const row = document.createElement('div');
    row.className = 'layer-row' + (i === activeLayerIndex ? ' selected' : '') + (!layer.visible ? ' hidden-layer' : '');
    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    thumb.style.backgroundImage = 'url(' + layer.canvas.toDataURL() + ')';
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = layer.name;
    name.ondblclick = (e) => {
      e.stopPropagation();
      const newName = prompt('Ebene umbenennen:', layer.name);
      if (newName && newName.trim()) {
        layer.name = newName.trim();
        renderLayerList(); updateLayerInfo(); pushHistory();
      }
    };
    const vis = document.createElement('div');
    vis.className = 'vis';
    vis.textContent = layer.visible ? '\ud83d\udc41' : '\u2014';
    vis.onclick = (e) => { e.stopPropagation(); layer.visible = !layer.visible; rebuildStageDOM(); renderLayerList(); };
    row.appendChild(thumb); row.appendChild(name); row.appendChild(vis);
    row.onclick = () => { activeLayerIndex = i; renderLayerList(); updateLayerInfo(); syncLayerOpacityUI(); };
    layerListEl.appendChild(row);
  }
}

function updateLayerInfo() {
  const l = layers[activeLayerIndex];
  layerInfoEl.textContent = l ? ('Ebene: ' + l.name) : '\u2014';
}

function syncLayerOpacityUI() {
  const l = layers[activeLayerIndex];
  if (!l) return;
  document.getElementById('layerOpRange').value = Math.round(l.opacity * 100);
  document.getElementById('layerOpVal').textContent = Math.round(l.opacity * 100) + '%';
}

function activeLayer() { return layers[activeLayerIndex]; }

function createDocument(w, h, bg) {
  doc = { w, h };
  layers = [ newLayer('Hintergrund', w, h, bg) ];
  activeLayerIndex = 0;
  layerIdCounter = 2;
  cropRect = null;
  selection = null;
  rebuildStageDOM();
  renderLayerList();
  updateLayerInfo();
  fitZoom();
  history = []; historyIndex = -1;
  pushHistory();
  hasUnsavedWork = false;
}

function pushHistory() {
  const snap = {
    doc: { ...doc },
    activeLayerIndex,
    layers: layers.map(l => ({ id: l.id, name: l.name, visible: l.visible, opacity: l.opacity, dataURL: l.canvas.toDataURL() }))
  };
  history = history.slice(0, historyIndex + 1);
  history.push(snap);
  if (history.length > MAX_HISTORY) history.shift();
  historyIndex = history.length - 1;
  hasUnsavedWork = true;
}

function guardUnsaved(action) {
  if (hasUnsavedWork) {
    pendingAction = action;
    document.getElementById('warnModal').classList.add('show');
  } else {
    action();
  }
}

function restoreHistory(snap, cb) {
  doc = { ...snap.doc };
  let loaded = 0;
  const newLayers = [];
  snap.layers.forEach((ld, idx) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = doc.w; c.height = doc.h;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      newLayers[idx] = { id: ld.id, name: ld.name, canvas: c, ctx, visible: ld.visible, opacity: ld.opacity };
      loaded++;
      if (loaded === snap.layers.length) {
        layers = newLayers;
        activeLayerIndex = Math.min(snap.activeLayerIndex, layers.length - 1);
        rebuildStageDOM(); renderLayerList(); updateLayerInfo(); syncLayerOpacityUI();
        if (cb) cb();
      }
    };
    img.src = ld.dataURL;
  });
}

function undo() {
  if (historyIndex <= 0) return;
  historyIndex--;
  restoreHistory(history[historyIndex]);
}
function redo() {
  if (historyIndex >= history.length - 1) return;
  historyIndex++;
  restoreHistory(history[historyIndex]);
}

// ---------- Tab management ----------
// Tabs hold a full copy of the document state. Switching tabs explicitly saves the
// outgoing tab's live globals into its record, then restores the incoming tab's
// record into the same globals -- the rest of the app (tools, history, rendering)
// never needs to know tabs exist at all, it just keeps using doc/layers/etc.
function saveCurrentTabState() {
  const rec = tabs.find(t => t.id === activeTabId);
  if (rec) Object.assign(rec, { doc, layers, activeLayerIndex, zoom, history, historyIndex, hasUnsavedWork, layerIdCounter });
}

function createNewTab(w, h, bg, name) {
  saveCurrentTabState();
  const id = tabIdCounter++;
  const record = { id, name: name || ('Unbenannt ' + (tabNameCounter++)) };
  tabs.push(record);
  activeTabId = id;
  createDocument(w, h, bg);
  saveCurrentTabState();
  renderTabBar();
}

function switchTab(id) {
  if (id === activeTabId) return;
  saveCurrentTabState();
  const rec = tabs.find(t => t.id === id);
  if (!rec) return;
  activeTabId = id;
  ({ doc, layers, activeLayerIndex, zoom, history, historyIndex, hasUnsavedWork, layerIdCounter } = rec);
  cropRect = null; selection = null;
  hideCropActions();
  rebuildStageDOM(); renderLayerList(); updateLayerInfo(); syncLayerOpacityUI();
  document.getElementById('zoomLabel').textContent = Math.round(zoom * 100) + '%';
  renderTabBar();
}

function closeTab(id) {
  const rec = tabs.find(t => t.id === id);
  if (!rec) return;
  if (id === activeTabId) saveCurrentTabState();
  const dirty = id === activeTabId ? hasUnsavedWork : rec.hasUnsavedWork;
  const doClose = () => actuallyCloseTab(id);
  if (dirty) {
    pendingAction = doClose;
    pendingCloseTabId = id;
    document.getElementById('warnModal').classList.add('show');
  } else {
    doClose();
  }
}

function actuallyCloseTab(id) {
  const wasActive = id === activeTabId;
  tabs = tabs.filter(t => t.id !== id);
  if (tabs.length === 0) {
    activeTabId = null;
    createNewTab(1200, 800, '#ffffff');
    return;
  }
  if (wasActive) {
    const next = tabs[tabs.length - 1];
    activeTabId = next.id;
    ({ doc, layers, activeLayerIndex, zoom, history, historyIndex, hasUnsavedWork, layerIdCounter } = next);
    cropRect = null; selection = null;
    hideCropActions();
    rebuildStageDOM(); renderLayerList(); updateLayerInfo(); syncLayerOpacityUI();
  }
  renderTabBar();
}

function renderTabBar() {
  tabBarEl.innerHTML = '';
  tabs.forEach(t => {
    const tabEl = document.createElement('div');
    tabEl.className = 'tab' + (t.id === activeTabId ? ' active' : '');
    const nameEl = document.createElement('span');
    nameEl.className = 'tab-name';
    const dirty = (t.id === activeTabId ? hasUnsavedWork : t.hasUnsavedWork);
    nameEl.textContent = t.name + (dirty ? ' \u2022' : '');
    nameEl.onclick = () => switchTab(t.id);
    const closeEl = document.createElement('span');
    closeEl.className = 'tab-close';
    closeEl.textContent = '\u00d7';
    closeEl.onclick = (e) => { e.stopPropagation(); closeTab(t.id); };
    tabEl.appendChild(nameEl); tabEl.appendChild(closeEl);
    tabBarEl.appendChild(tabEl);
  });
  const addBtn = document.createElement('button');
  addBtn.className = 'tab-add';
  addBtn.textContent = '+';
  addBtn.title = 'Neuer Tab';
  addBtn.onclick = () => document.getElementById('newModal').classList.add('show');
  tabBarEl.appendChild(addBtn);
}
