import { state, elements } from './state';
import { getMainBackgroundImage } from '../types/data';
import { getEditable } from './parts';
import { compositeIllumination } from './illumination-render';
import { bulbPassesFilter } from './bulb-filter';

export interface HitTestResult {
  type: 'bulb' | 'score';
  id: number;
}

const ZOOM_STEPS = [
  500, 450, 400, 350, 300, 275, 250, 225, 200, 175, 150, 125, 110, 100, 90, 80, 75, 70, 67, 60, 50, 40, 33, 30, 25, 20,
  10, 5,
];
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 5;
const EDGE_THICK = 6;
let lastWindowZoom = 1;
let zoomIsWindow = true;

interface CanvasColors {
  canvasBg: string;
  emptyBg: string;
  emptyBorder: string;
  loadingBg: string;
  textMuted: string;
  handleFill: string;
  handleStroke: string;
}

let cachedColors: CanvasColors | null = null;
let cachedTheme: string | null = null;

function getCanvasColors(): CanvasColors {
  const theme = document.documentElement.getAttribute('data-theme') || 'dark';
  if (cachedColors && cachedTheme === theme) return cachedColors;

  const style = getComputedStyle(document.documentElement);
  const read = (prop: string): string => style.getPropertyValue(prop).trim();

  const isLight = theme === 'light';
  cachedTheme = theme;
  cachedColors = {
    canvasBg: read('--canvas-bg') || (isLight ? '#cccccc' : '#1a1a1a'),
    emptyBg: isLight ? '#e8e8e8' : '#222',
    emptyBorder: isLight ? '#bbb' : '#444',
    loadingBg: isLight ? '#ddd' : '#333',
    textMuted: isLight ? '#999' : '#666',
    handleFill: isLight ? '#000' : '#fff',
    handleStroke: isLight ? '#fff' : '#000',
  };
  return cachedColors;
}

export function invalidateColorCache(): void {
  cachedColors = null;
}

function getActiveImageDimensions(): { width: number; height: number } {
  const isDmd = state.activeTab === 'dmd';
  const image = isDmd ? state.dmdImage : state.backgroundImage;
  if (image) {
    return { width: image.width, height: image.height };
  }
  return { width: 800, height: 600 };
}

let renderPending = false;

export function requestRender(): void {
  if (renderPending) return;
  renderPending = true;
  requestAnimationFrame(() => {
    renderPending = false;
    render();
  });
}

export function render(): void {
  const { canvas, ctx } = elements;
  if (!canvas || !ctx) return;

  const colors = getCanvasColors();
  ctx.fillStyle = colors.canvasBg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (!state.hasFile) return;

  ctx.save();
  ctx.translate(state.panX, state.panY);
  ctx.scale(state.zoom, state.zoom);

  renderBackground(ctx);
  renderIlluminationOverlay(ctx);
  renderScores(ctx);
  renderBulbs(ctx);
  renderGrillHeightOverlay(ctx);
  renderDmdCopyAreaOverlay(ctx);
  renderDmdDefaultLocationOverlay(ctx);
  renderSnippetDragOverlay(ctx);

  ctx.restore();

  updateZoomDisplay();
}

function renderBackground(ctx: CanvasRenderingContext2D): void {
  const isDmd = state.activeTab === 'dmd';
  const image = isDmd ? state.dmdImage : state.backgroundImage;
  const hasImageData = isDmd
    ? state.currentData.images.dmdImages.length > 0
    : !!getMainBackgroundImage(state.currentData.images);

  const colors = getCanvasColors();
  if (image) {
    ctx.drawImage(image, 0, 0);
  } else if (hasImageData) {
    ctx.fillStyle = colors.loadingBg;
    ctx.fillRect(0, 0, 800, 600);
    ctx.fillStyle = colors.textMuted;
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isDmd ? 'Loading DMD...' : 'Loading background...', 400, 300);
  } else {
    ctx.fillStyle = colors.emptyBg;
    ctx.fillRect(0, 0, 800, 600);
    ctx.strokeStyle = colors.emptyBorder;
    ctx.strokeRect(0, 0, 800, 600);
    ctx.fillStyle = colors.textMuted;
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isDmd ? 'No DMD Image' : 'No Backglass Image', 400, 300);
  }
}

function renderIlluminationOverlay(ctx: CanvasRenderingContext2D): void {
  const showIllumination = state.showIllumination || state.showIlluminationIntensity;
  if (!showIllumination) return;

  const isDmd = state.activeTab === 'dmd';
  const bg = isDmd ? state.dmdImage : state.backgroundImage;
  if (!bg) return;

  const parentFilter = isDmd ? 'DMD' : 'Backglass';
  const bulbs = state.currentData.illumination.filter(
    b => b.parent === parentFilter && bulbPassesFilter(b, state.lampFilter, state.currentData.commType)
  );
  if (bulbs.length === 0) return;

  if (!isDmd && state.selectedIlluminationImage !== null) {
    const entry = state.currentData.images.illuminatedImages[state.selectedIlluminationImage];
    const illuImage = entry
      ? state.illuminationImages.get(entry.fileName || `#${state.selectedIlluminationImage}`)
      : null;
    if (illuImage) {
      for (const bulb of bulbs) {
        const x = Math.max(0, Math.min(bulb.locX, bg.width));
        const y = Math.max(0, Math.min(bulb.locY, bg.height));
        const w = Math.min(bulb.width, bg.width - x);
        const h = Math.min(bulb.height, bg.height - y);
        if (w > 0 && h > 0) ctx.drawImage(illuImage, x, y, w, h, x, y, w, h);
      }
      return;
    }
  }

  compositeIllumination(ctx, bg, bulbs, {
    useIntensity: state.showIlluminationIntensity,
  });
}

function renderBulbs(ctx: CanvasRenderingContext2D): void {
  const bulbEditable = getEditable('Bulb');
  if (!bulbEditable) return;

  const parentFilter = state.activeTab === 'dmd' ? 'DMD' : 'Backglass';
  const filteredBulbs = state.currentData.illumination
    .filter(b => b.parent === parentFilter && bulbPassesFilter(b, state.lampFilter, state.currentData.commType))
    .reverse();

  for (const bulb of filteredBulbs) {
    const isSelected = state.selectedBulbIds.has(bulb.id);
    bulbEditable.render(bulb, ctx, isSelected);
  }
}

function renderScores(ctx: CanvasRenderingContext2D): void {
  if (!state.showScoring && !state.showScoreFrames) return;

  const scoreEditable = getEditable('Score');
  if (!scoreEditable) return;

  const parentFilter = state.activeTab === 'dmd' ? 'DMD' : 'Backglass';
  const filteredScores = state.currentData.scores.filter(s => s.parent === parentFilter).reverse();

  for (const score of filteredScores) {
    const isSelected = state.selectedScoreIds.has(score.id);
    scoreEditable.render(score, ctx, isSelected);
  }
}

function renderSnippetDragOverlay(ctx: CanvasRenderingContext2D): void {
  const drag = state.snippetDrag;
  if (!drag) return;
  const x = Math.min(drag.startX, drag.curX);
  const y = Math.min(drag.startY, drag.curY);
  const w = Math.abs(drag.curX - drag.startX);
  const h = Math.abs(drag.curY - drag.startY);
  ctx.save();
  ctx.lineWidth = 1 / state.zoom;
  ctx.strokeStyle = '#ffff00';
  ctx.fillStyle = 'rgba(255, 255, 0, 0.15)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

function renderGrillHeightOverlay(ctx: CanvasRenderingContext2D): void {
  if (state.activeTab !== 'backglass') return;
  if (!state.setGrillHeight && !state.setSmallGrillHeight) return;

  const { width: imgWidth, height: imgHeight } = getActiveImageDimensions();
  const zoom = state.zoom || 1;
  const lineWidth = 2 / zoom;
  const fontSize = Math.max(12, 14 / zoom);
  const removeBoxSize = 12 / zoom;

  ctx.font = `${fontSize}px sans-serif`;
  ctx.textBaseline = 'middle';

  if (state.currentData.grillHeight > 0) {
    const grillY = imgHeight - state.currentData.grillHeight;
    ctx.strokeStyle = '#228b22';
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(0, grillY);
    ctx.lineTo(imgWidth, grillY);
    ctx.stroke();

    ctx.fillStyle = '#228b22';
    ctx.textAlign = 'right';
    ctx.fillText("'Standard grill' top location", imgWidth - 20 / zoom, grillY - fontSize);

    const removeX = imgWidth - 15 / zoom;
    const removeY = grillY - 15 / zoom;
    ctx.fillStyle = '#228b22';
    ctx.fillRect(removeX, removeY, removeBoxSize, removeBoxSize);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5 / zoom;
    ctx.beginPath();
    ctx.moveTo(removeX + 3 / zoom, removeY + 3 / zoom);
    ctx.lineTo(removeX + removeBoxSize - 3 / zoom, removeY + removeBoxSize - 3 / zoom);
    ctx.moveTo(removeX + removeBoxSize - 3 / zoom, removeY + 3 / zoom);
    ctx.lineTo(removeX + 3 / zoom, removeY + removeBoxSize - 3 / zoom);
    ctx.stroke();
  }

  if (state.currentData.smallGrillHeight > 0) {
    const smallGrillY = imgHeight - state.currentData.smallGrillHeight;
    ctx.strokeStyle = '#8b0000';
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(0, smallGrillY);
    ctx.lineTo(imgWidth, smallGrillY);
    ctx.stroke();

    ctx.fillStyle = '#8b0000';
    ctx.textAlign = 'right';
    ctx.fillText("'Mini grill' top location", imgWidth - 20 / zoom, smallGrillY - fontSize);

    const removeX = imgWidth - 15 / zoom;
    const removeY = smallGrillY - 15 / zoom;
    ctx.fillStyle = '#8b0000';
    ctx.fillRect(removeX, removeY, removeBoxSize, removeBoxSize);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5 / zoom;
    ctx.beginPath();
    ctx.moveTo(removeX + 3 / zoom, removeY + 3 / zoom);
    ctx.lineTo(removeX + removeBoxSize - 3 / zoom, removeY + removeBoxSize - 3 / zoom);
    ctx.moveTo(removeX + removeBoxSize - 3 / zoom, removeY + 3 / zoom);
    ctx.lineTo(removeX + 3 / zoom, removeY + removeBoxSize - 3 / zoom);
    ctx.stroke();
  }

  if (state.mouseWorldY !== null && state.mouseWorldY >= 0 && state.mouseWorldY <= imgHeight) {
    const color = state.setGrillHeight ? '#90ee90' : '#ff6347';
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash([5 / zoom, 5 / zoom]);
    ctx.beginPath();
    ctx.moveTo(0, state.mouseWorldY);
    ctx.lineTo(imgWidth, state.mouseWorldY);
    ctx.stroke();
    ctx.setLineDash([]);

    const heightValue = Math.round(imgHeight - state.mouseWorldY);
    ctx.fillStyle = color;
    ctx.textAlign = 'right';
    ctx.fillText(`${heightValue} px`, imgWidth - 20 / zoom, state.mouseWorldY - fontSize);
  }
}

function renderDmdCopyAreaOverlay(ctx: CanvasRenderingContext2D): void {
  if (state.activeTab !== 'backglass') return;
  if (!state.copyDmdFromBackglass) return;

  const data = state.currentData;
  if (data.dmdCopyAreaWidth <= 0 || data.dmdCopyAreaHeight <= 0) return;

  const zoom = state.zoom || 1;
  const lineWidth = 2 / zoom;
  const iconSize = 16 / zoom;

  ctx.strokeStyle = '#ffff00';
  ctx.lineWidth = lineWidth;
  ctx.strokeRect(data.dmdCopyAreaX, data.dmdCopyAreaY, data.dmdCopyAreaWidth, data.dmdCopyAreaHeight);

  ctx.strokeStyle = '#000';
  ctx.setLineDash([4 / zoom, 4 / zoom]);
  ctx.strokeRect(data.dmdCopyAreaX, data.dmdCopyAreaY, data.dmdCopyAreaWidth, data.dmdCopyAreaHeight);
  ctx.setLineDash([]);

  const cameraX = data.dmdCopyAreaX + data.dmdCopyAreaWidth - iconSize - 3 / zoom;
  const cameraY = data.dmdCopyAreaY + 3 / zoom;
  ctx.fillStyle = '#ffff00';
  ctx.fillRect(cameraX - 2 / zoom, cameraY - 2 / zoom, iconSize + 4 / zoom, iconSize + 4 / zoom);
  ctx.fillStyle = '#333';
  const cameraBodyX = cameraX + 2 / zoom;
  const cameraBodyY = cameraY + 4 / zoom;
  const cameraBodyW = iconSize - 4 / zoom;
  const cameraBodyH = iconSize - 6 / zoom;
  ctx.fillRect(cameraBodyX, cameraBodyY, cameraBodyW, cameraBodyH);
  ctx.beginPath();
  ctx.arc(cameraBodyX + cameraBodyW / 2, cameraBodyY + cameraBodyH / 2, cameraBodyH / 3, 0, Math.PI * 2);
  ctx.fillStyle = '#ffff00';
  ctx.fill();

  drawDmdCopyAreaResizeHandles(
    ctx,
    data.dmdCopyAreaX,
    data.dmdCopyAreaY,
    data.dmdCopyAreaWidth,
    data.dmdCopyAreaHeight
  );
}

function drawDmdCopyAreaResizeHandles(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const zoom = state.zoom || 1;
  const handleSize = 8 / zoom;
  const hw = handleSize / 2;
  const handles = [
    [x - hw, y - hw],
    [x + w / 2 - hw, y - hw],
    [x + w - hw, y - hw],
    [x - hw, y + h / 2 - hw],
    [x + w - hw, y + h / 2 - hw],
    [x - hw, y + h - hw],
    [x + w / 2 - hw, y + h - hw],
    [x + w - hw, y + h - hw],
  ];

  ctx.lineWidth = 1 / zoom;
  for (const [hx, hy] of handles) {
    ctx.fillStyle = '#ffff00';
    ctx.fillRect(hx, hy, handleSize, handleSize);
    ctx.strokeStyle = '#000';
    ctx.strokeRect(hx, hy, handleSize, handleSize);
  }
}

function renderDmdDefaultLocationOverlay(ctx: CanvasRenderingContext2D): void {
  if (state.activeTab !== 'backglass') return;
  if (!state.setDmdDefaultLocation) return;
  if (!state.dmdImage) return;

  const data = state.currentData;
  const zoom = state.zoom || 1;
  const dmdWidth = state.dmdImage.width;
  const dmdHeight = state.dmdImage.height;
  const removeBoxSize = 12 / zoom;

  if (data.dmdDefaultLocationX > 0 || data.dmdDefaultLocationY > 0) {
    ctx.fillStyle = 'rgba(34, 139, 34, 0.7)';
    ctx.fillRect(data.dmdDefaultLocationX, data.dmdDefaultLocationY, dmdWidth, dmdHeight);

    const removeX = data.dmdDefaultLocationX + dmdWidth + 5 / zoom;
    const removeY = data.dmdDefaultLocationY;
    ctx.fillStyle = '#228b22';
    ctx.fillRect(removeX, removeY, removeBoxSize, removeBoxSize);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5 / zoom;
    ctx.beginPath();
    ctx.moveTo(removeX + 2 / zoom, removeY + 2 / zoom);
    ctx.lineTo(removeX + removeBoxSize - 2 / zoom, removeY + removeBoxSize - 2 / zoom);
    ctx.moveTo(removeX + removeBoxSize - 2 / zoom, removeY + 2 / zoom);
    ctx.lineTo(removeX + 2 / zoom, removeY + removeBoxSize - 2 / zoom);
    ctx.stroke();
  }

  if (state.mouseWorldX !== null && state.mouseWorldY !== null) {
    ctx.fillStyle = 'rgba(139, 0, 0, 0.7)';
    ctx.fillRect(state.mouseWorldX, state.mouseWorldY, dmdWidth, dmdHeight);
  }
}

function updateZoomDisplay(): void {
  const input = elements.zoomLevel as HTMLInputElement | null;
  if (!input) return;
  if (document.activeElement === input) return;
  input.value = zoomIsWindow ? 'Window' : `${Math.round(state.zoom * 100)}%`;
}

export function initZoomControl(): void {
  const input = elements.zoomLevel as HTMLInputElement | null;
  const list = document.getElementById('zoom-steps');
  if (list) {
    list.innerHTML = ['Window', ...ZOOM_STEPS.map(z => `${z}%`)].map(v => `<option value="${v}"></option>`).join('');
  }
  if (!input) return;
  const apply = (): void => {
    const text = input.value.trim().toLowerCase();
    if (text === 'window' || text === '') {
      zoomToFit();
      return;
    }
    const n = parseInt(text.replace('%', ''), 10);
    if (!Number.isNaN(n) && n > 0 && n <= 500) {
      setZoomPercent(n);
    } else {
      updateZoomDisplay();
    }
  };
  input.addEventListener('change', apply);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      apply();
      input.blur();
    }
    e.stopPropagation();
  });
}

export function setZoomPercent(percent: number): void {
  const { canvas } = elements;
  if (!canvas) return;
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const worldX = (centerX - state.panX) / state.zoom;
  const worldY = (centerY - state.panY) / state.zoom;
  const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, percent / 100));
  state.panX = centerX - worldX * newZoom;
  state.panY = centerY - worldY * newZoom;
  state.zoom = newZoom;
  zoomIsWindow = false;
  render();
}

export function updateCoordsDisplay(x: number, y: number): void {
  if (elements.statusCoords) {
    elements.statusCoords.textContent = `${x}, ${y}`;
  }
}

let progressResetTimer: number | null = null;

export function setStatusProgress(percent: number): void {
  const el = document.getElementById('status-progress') as HTMLProgressElement | null;
  if (!el) return;
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  el.value = value;
  el.classList.toggle('hidden', value <= 0);
  if (progressResetTimer !== null) {
    clearTimeout(progressResetTimer);
    progressResetTimer = null;
  }
  if (value >= 100) {
    progressResetTimer = window.setTimeout(() => {
      el.value = 0;
      el.classList.add('hidden');
      progressResetTimer = null;
    }, 100);
  }
}

export function updateStatusInfo(): void {
  const info = document.getElementById('status-info');
  const imageFile = document.getElementById('status-image-file');
  const imageSize = document.getElementById('status-image-size');
  if (info) {
    info.textContent = state.hasFile
      ? "Choose your background image and design reels and illumination. Don't forget to save from time to time."
      : 'Start a new project or open an already existing project file. Maybe use the recent file list.';
  }
  const isDmd = state.activeTab === 'dmd';
  const image = isDmd ? state.dmdImage : state.backgroundImage;
  const entry = isDmd ? state.currentData.images.dmdImages[0] : getMainBackgroundImage(state.currentData.images);
  if (imageFile) {
    imageFile.textContent = state.hasFile && entry ? entry.fileName.split(/[\\/]/).pop() || '' : '';
  }
  if (imageSize) {
    imageSize.textContent = state.hasFile && image ? `${image.width} x ${image.height}` : '';
  }
}

export function updateCountsDisplay(): void {
  const el = document.getElementById('status-counts');
  if (!el) return;
  if (!state.hasFile) {
    el.textContent = '';
    return;
  }
  const bulbs = state.currentData.illumination.length;
  const scores = state.currentData.scores.length;
  const animations = state.currentData.animations.length;
  el.textContent = `${bulbs} bulbs · ${scores} scores · ${animations} anims`;
}

export function updateFileDisplay(path: string): void {
  if (elements.statusFile) {
    const fileName = path.split('/').pop() || path;
    elements.statusFile.textContent = fileName;
  }
}

export function screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
  const { canvas } = elements;
  if (!canvas) return { x: 0, y: 0 };

  const rect = canvas.getBoundingClientRect();

  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const canvasX = (screenX - rect.left) * scaleX;
  const canvasY = (screenY - rect.top) * scaleY;

  const x = (canvasX - state.panX) / state.zoom;
  const y = (canvasY - state.panY) / state.zoom;
  return { x, y };
}

export function worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
  const { canvas } = elements;
  if (!canvas) return { x: 0, y: 0 };

  const rect = canvas.getBoundingClientRect();

  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const canvasX = worldX * state.zoom + state.panX;
  const canvasY = worldY * state.zoom + state.panY;

  const x = canvasX / scaleX + rect.left;
  const y = canvasY / scaleY + rect.top;
  return { x, y };
}

export function hitTestItemsAtPoint(worldX: number, worldY: number, includeAll = false): HitTestResult[] {
  const bulbEditable = getEditable('Bulb');
  const scoreEditable = getEditable('Score');
  const results: HitTestResult[] = [];
  const parent = state.activeTab === 'dmd' ? 'DMD' : 'Backglass';
  const startWithBulbs = state.primarySelection?.type !== 'score';

  const collectBulbs = (): void => {
    if (!state.showIlluminationFrames) return;
    for (const bulb of state.currentData.illumination) {
      if (bulb.parent !== parent) continue;
      if (!bulbPassesFilter(bulb, state.lampFilter, state.currentData.commType)) continue;
      if (bulbEditable?.hitTest(bulb, worldX, worldY)) results.push({ type: 'bulb', id: bulb.id });
    }
  };
  const collectScores = (): void => {
    if (!state.showScoreFrames) return;
    for (const score of state.currentData.scores) {
      if (score.parent !== parent) continue;
      if (scoreEditable?.hitTest(score, worldX, worldY)) results.push({ type: 'score', id: score.id });
    }
  };
  if (startWithBulbs) {
    collectBulbs();
    if (results.length === 0 || includeAll) collectScores();
  } else {
    collectScores();
    if (results.length === 0 || includeAll) collectBulbs();
  }
  return results;
}

export function hitTestAtPoint(worldX: number, worldY: number): HitTestResult | null {
  return hitTestItemsAtPoint(worldX, worldY)[0] || null;
}

export type EdgeHit = 'nw' | 'n' | 'ne' | 'w' | 'e' | 'sw' | 's' | 'se';

export function hitTestEdge(type: 'bulb' | 'score', id: number, worldX: number, worldY: number): EdgeHit | null {
  const item =
    type === 'bulb'
      ? state.currentData.illumination.find(b => b.id === id)
      : state.currentData.scores.find(s => s.id === id);
  if (!item) return null;
  if (type === 'bulb' && (item as { isImageSnippet?: boolean }).isImageSnippet) return null;
  const thick = EDGE_THICK / (state.zoom || 1);
  const { locX, locY, width, height } = item;
  let top = false;
  let bottom = false;
  let left = false;
  let right = false;
  if (worldX >= locX && worldX <= locX + width) {
    top = worldY >= locY && worldY <= locY + thick;
    bottom = worldY >= locY + height - thick && worldY <= locY + height;
  }
  if (worldY >= locY && worldY <= locY + height) {
    left = worldX >= locX && worldX <= locX + thick;
    right = worldX >= locX + width - thick && worldX <= locX + width;
  }
  if (left && top) return 'nw';
  if (left && bottom) return 'sw';
  if (right && top) return 'ne';
  if (right && bottom) return 'se';
  if (left) return 'w';
  if (right) return 'e';
  if (top) return 'n';
  if (bottom) return 's';
  return null;
}

export function hitTestGrillRemoveButton(worldX: number, worldY: number): 'grill' | 'smallGrill' | null {
  if (!state.setGrillHeight && !state.setSmallGrillHeight) return null;
  if (state.activeTab !== 'backglass') return null;

  const { width: imgWidth, height: imgHeight } = getActiveImageDimensions();
  const zoom = state.zoom || 1;
  const removeBoxSize = 12 / zoom;

  if (state.currentData.grillHeight > 0) {
    const grillY = imgHeight - state.currentData.grillHeight;
    const removeX = imgWidth - 15 / zoom;
    const removeY = grillY - 15 / zoom;
    if (
      worldX >= removeX &&
      worldX <= removeX + removeBoxSize &&
      worldY >= removeY &&
      worldY <= removeY + removeBoxSize
    ) {
      return 'grill';
    }
  }

  if (state.currentData.smallGrillHeight > 0) {
    const smallGrillY = imgHeight - state.currentData.smallGrillHeight;
    const removeX = imgWidth - 15 / zoom;
    const removeY = smallGrillY - 15 / zoom;
    if (
      worldX >= removeX &&
      worldX <= removeX + removeBoxSize &&
      worldY >= removeY &&
      worldY <= removeY + removeBoxSize
    ) {
      return 'smallGrill';
    }
  }

  return null;
}

export type DmdCopyAreaHit = 'camera' | 'nw' | 'n' | 'ne' | 'w' | 'e' | 'sw' | 's' | 'se' | 'move';

export function hitTestDmdCopyArea(worldX: number, worldY: number): DmdCopyAreaHit | null {
  if (!state.copyDmdFromBackglass) return null;
  if (state.activeTab !== 'backglass') return null;

  const data = state.currentData;
  if (data.dmdCopyAreaWidth <= 0 || data.dmdCopyAreaHeight <= 0) return null;

  const zoom = state.zoom || 1;
  const iconSize = 16 / zoom;
  const handleSize = 8 / zoom;
  const hitMargin = 8 / zoom;

  const cameraX = data.dmdCopyAreaX + data.dmdCopyAreaWidth - iconSize - 3 / zoom;
  const cameraY = data.dmdCopyAreaY + 3 / zoom;
  if (
    worldX >= cameraX - 2 / zoom &&
    worldX <= cameraX + iconSize + 2 / zoom &&
    worldY >= cameraY - 2 / zoom &&
    worldY <= cameraY + iconSize + 2 / zoom
  ) {
    return 'camera';
  }

  const x = data.dmdCopyAreaX;
  const y = data.dmdCopyAreaY;
  const w = data.dmdCopyAreaWidth;
  const h = data.dmdCopyAreaHeight;
  const hw = handleSize / 2;

  const handles: [number, number, DmdCopyAreaHit][] = [
    [x, y, 'nw'],
    [x + w / 2, y, 'n'],
    [x + w, y, 'ne'],
    [x, y + h / 2, 'w'],
    [x + w, y + h / 2, 'e'],
    [x, y + h, 'sw'],
    [x + w / 2, y + h, 's'],
    [x + w, y + h, 'se'],
  ];

  for (const [hx, hy, handle] of handles) {
    if (
      worldX >= hx - hw - hitMargin &&
      worldX <= hx + hw + hitMargin &&
      worldY >= hy - hw - hitMargin &&
      worldY <= hy + hw + hitMargin
    ) {
      return handle;
    }
  }

  if (worldX >= x && worldX <= x + w && worldY >= y && worldY <= y + h) {
    return 'move';
  }

  return null;
}

export function hitTestDmdDefaultLocationRemove(worldX: number, worldY: number): boolean {
  if (!state.setDmdDefaultLocation) return false;
  if (state.activeTab !== 'backglass') return false;
  if (!state.dmdImage) return false;

  const data = state.currentData;
  if (data.dmdDefaultLocationX <= 0 && data.dmdDefaultLocationY <= 0) return false;

  const zoom = state.zoom || 1;
  const dmdWidth = state.dmdImage.width;
  const removeBoxSize = 12 / zoom;

  const removeX = data.dmdDefaultLocationX + dmdWidth + 5 / zoom;
  const removeY = data.dmdDefaultLocationY;

  return (
    worldX >= removeX && worldX <= removeX + removeBoxSize && worldY >= removeY && worldY <= removeY + removeBoxSize
  );
}

export function resizeCanvas(): void {
  const { canvas } = elements;
  if (!canvas) return;

  const container = canvas.parentElement;
  if (!container) return;

  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight - 36;
  render();
}

export function zoomToFit(): void {
  const { canvas } = elements;
  if (!canvas) return;

  if (canvas.width === 0 || canvas.height === 0) {
    resizeCanvas();
  }

  const { width: imgWidth, height: imgHeight } = getActiveImageDimensions();
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;

  if (canvasWidth <= 0 || canvasHeight <= 0) return;

  const padding = 40;
  const availableWidth = canvasWidth - padding;
  const availableHeight = canvasHeight - padding;

  const scaleX = availableWidth / imgWidth;
  const scaleY = availableHeight / imgHeight;
  state.zoom = Math.min(scaleX, scaleY, MAX_ZOOM);
  state.zoom = Math.max(state.zoom, MIN_ZOOM);

  state.panX = (canvasWidth - imgWidth * state.zoom) / 2;
  state.panY = (canvasHeight - imgHeight * state.zoom) / 2;
  lastWindowZoom = state.zoom;
  zoomIsWindow = true;

  render();
}

export function setZoom(newZoom: number): void {
  setZoomPercent(Math.round(newZoom * 100));
}

function currentZoomPercent(): number {
  return Math.round((zoomIsWindow ? lastWindowZoom : state.zoom) * 100);
}

export function zoomIn(): void {
  const current = currentZoomPercent();
  const next = [...ZOOM_STEPS].reverse().find(z => z > current);
  if (next !== undefined) setZoomPercent(next);
}

export function zoomOut(): void {
  const current = currentZoomPercent();
  const next = ZOOM_STEPS.find(z => z < current);
  if (next !== undefined) setZoomPercent(next);
}

export function zoomByWheel(direction: number, screenX: number, screenY: number): void {
  const percent = currentZoomPercent();
  const change = direction * Math.max(1, percent / 10);
  const next = Math.max(5, Math.min(500, Math.ceil(percent + change)));
  const { canvas } = elements;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const canvasX = screenX - rect.left;
  const canvasY = screenY - rect.top;
  const worldX = (canvasX - state.panX) / state.zoom;
  const worldY = (canvasY - state.panY) / state.zoom;
  const newZoom = next / 100;
  state.panX = canvasX - worldX * newZoom;
  state.panY = canvasY - worldY * newZoom;
  state.zoom = newZoom;
  zoomIsWindow = false;
  render();
}
