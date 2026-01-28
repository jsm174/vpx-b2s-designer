import type { Bulb } from '../../types/data';
import { B2S_ID_TYPES } from '../../types/data';
import { registerEditable, getResizeHandlesForBounds, type IEditable, type ResizeHandle } from './registry';
import { invokeCallback } from '../../shared/callbacks';
import { state } from '../state';
import { romInfoToString } from '../bulb-filter';

export { colorOverlay } from '../illumination-render';

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function rgbToHex(color: { r: number; g: number; b: number }): string {
  const r = color.r.toString(16).padStart(2, '0');
  const g = color.g.toString(16).padStart(2, '0');
  const b = color.b.toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

const DODGE_COLOR_TABLE: Array<{ r: number; g: number; b: number }> = [
  { r: 0, g: 0, b: 0 },
  { r: 255, g: 0, b: 0 },
  { r: 0, g: 255, b: 0 },
  { r: 0, g: 0, b: 255 },
  { r: 255, g: 255, b: 0 },
  { r: 0, g: 255, b: 255 },
  { r: 255, g: 0, b: 255 },
  { r: 255, g: 255, b: 255 },
];

export const DODGE_COLOR_LABELS = ['(none)', 'Red', 'Green', 'Blue', 'Yellow', 'Cyan', 'Magenta', 'White'];

export function dodgeColorToIndex(color?: { r: number; g: number; b: number }): number {
  if (!color) return 0;
  for (let i = 1; i < DODGE_COLOR_TABLE.length; i++) {
    const c = DODGE_COLOR_TABLE[i];
    if (color.r === c.r && color.g === c.g && color.b === c.b) return i;
  }
  return 0;
}

export function dodgeColorFromIndex(index: number): { r: number; g: number; b: number; a: number } | undefined {
  if (index <= 0 || index >= DODGE_COLOR_TABLE.length) return undefined;
  const c = DODGE_COLOR_TABLE[index];
  return { r: c.r, g: c.g, b: c.b, a: 255 };
}

export const bulbImageCache: Map<number, HTMLImageElement> = new Map();
const loadingBulbImages: Set<number> = new Set();

export function detectImageFormat(base64: string): string {
  if (base64.startsWith('/9j/')) return 'image/jpeg';
  if (base64.startsWith('iVBORw0KGgo')) return 'image/png';
  if (base64.startsWith('R0lGOD')) return 'image/gif';
  if (base64.startsWith('UklGR')) return 'image/webp';
  if (base64.startsWith('Qk')) return 'image/bmp';
  return 'image/png';
}

function loadBulbImage(bulb: Bulb): void {
  if (!bulb.imageData || bulbImageCache.has(bulb.id) || loadingBulbImages.has(bulb.id)) return;

  loadingBulbImages.add(bulb.id);
  const mimeType = detectImageFormat(bulb.imageData);
  const img = new Image();
  img.onload = () => {
    bulbImageCache.set(bulb.id, img);
    loadingBulbImages.delete(bulb.id);
    invokeCallback('render');
  };
  img.onerror = () => {
    loadingBulbImages.delete(bulb.id);
  };
  img.src = `data:${mimeType};base64,${bulb.imageData}`;
}

export function clearBulbImageCache(): void {
  bulbImageCache.clear();
  loadingBulbImages.clear();
}

export function invalidateBulbImage(id: number): void {
  bulbImageCache.delete(id);
  loadingBulbImages.delete(id);
}

export const REMOVE_BOX = { size: 10, right: 15, top: 5, minFrame: 25 };

export function hitTestRemoveBox(
  bounds: { locX: number; locY: number; width: number; height: number },
  worldX: number,
  worldY: number
): boolean {
  const zoom = state.zoom || 1;
  if (bounds.width * zoom < REMOVE_BOX.minFrame || bounds.height * zoom < REMOVE_BOX.minFrame) return false;
  const bx = bounds.locX + bounds.width - REMOVE_BOX.right / zoom;
  const by = bounds.locY + REMOVE_BOX.top / zoom;
  const size = REMOVE_BOX.size / zoom;
  return worldX >= bx && worldX <= bx + size && worldY >= by && worldY <= by + size;
}

export function drawRemoveBox(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  screenW: number,
  screenH: number,
  color: string
): void {
  if (screenW < REMOVE_BOX.minFrame || screenH < REMOVE_BOX.minFrame) return;
  const x = screenX + screenW - REMOVE_BOX.right;
  const y = screenY + REMOVE_BOX.top;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, REMOVE_BOX.size, REMOVE_BOX.size);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 2, y + 2);
  ctx.lineTo(x + 8, y + 8);
  ctx.moveTo(x + 8, y + 2);
  ctx.lineTo(x + 2, y + 8);
  ctx.stroke();
}

export const bulbEditable: IEditable<Bulb> = {
  render(bulb: Bulb, ctx: CanvasRenderingContext2D, isSelected: boolean): void {
    const zoom = state.zoom || 1;
    const lw = 1 / zoom;
    const showFrames = state.showIlluminationFrames;
    const showIllumination = state.showIllumination || state.showIlluminationIntensity;
    const isPreviewed = state.previewedItem?.type === 'bulb' && state.previewedItem.id === bulb.id;

    if ((showIllumination || showFrames) && bulb.isImageSnippet && bulb.imageData) {
      const cachedImg = bulbImageCache.get(bulb.id);
      if (cachedImg) {
        ctx.drawImage(cachedImg, bulb.locX, bulb.locY, bulb.width, bulb.height);
      } else {
        loadBulbImage(bulb);
      }
    }

    if (!showFrames) return;

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = lw;
    ctx.strokeRect(bulb.locX, bulb.locY, bulb.width, bulb.height);

    if (isSelected) {
      const off1 = 1 / zoom;
      const off2 = 2 / zoom;
      ctx.strokeRect(bulb.locX + off1, bulb.locY + off1, bulb.width - off1 * 2, bulb.height - off1 * 2);
      ctx.strokeRect(bulb.locX + off2, bulb.locY + off2, bulb.width - off2 * 2, bulb.height - off2 * 2);

      const cx = bulb.locX + bulb.width / 2;
      const cy = bulb.locY + bulb.height / 2;
      const crossSize = 3 / zoom;
      ctx.beginPath();
      ctx.moveTo(cx - crossSize, cy);
      ctx.lineTo(cx + crossSize, cy);
      ctx.moveTo(cx, cy - crossSize);
      ctx.lineTo(cx, cy + crossSize);
      ctx.stroke();
    } else {
      ctx.strokeStyle = '#000';
      ctx.setLineDash([2 / zoom, 20 / zoom]);
      ctx.strokeRect(bulb.locX, bulb.locY, bulb.width, bulb.height);
      ctx.setLineDash([]);
    }

    if (isPreviewed) {
      ctx.strokeStyle = '#fff';
      const off1 = 1 / zoom;
      ctx.strokeRect(bulb.locX, bulb.locY, bulb.width, bulb.height);
      ctx.strokeRect(bulb.locX + off1, bulb.locY + off1, bulb.width - off1 * 2, bulb.height - off1 * 2);
    }

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const screenX = bulb.locX * zoom + state.panX;
    const screenY = bulb.locY * zoom + state.panY;
    const screenW = bulb.width * zoom;
    const screenH = bulb.height * zoom;
    const frameColor = '#fff';
    const isSmallRect = screenW < REMOVE_BOX.minFrame || screenH < REMOVE_BOX.minFrame;

    if (isSelected) {
      drawRemoveBox(ctx, screenX, screenY, screenW, screenH, frameColor);
    }

    ctx.font = `${isSelected ? 'bold ' : ''}9px Tahoma, sans-serif`;

    if (bulb.name) {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = frameColor;
      ctx.fillText(bulb.name, screenX + 3, screenY + 4);
    }

    let stateText = bulb.initialState === 'Off' ? 'Off' : bulb.initialState === 'On' ? 'On' : 'Always on';
    if (state.currentData?.dualBackglass) {
      const dualChar = bulb.dualMode === 'Authentic' ? 'A' : bulb.dualMode === 'Fantasy' ? 'F' : 'B';
      stateText += '/' + dualChar;
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = frameColor;
    ctx.fillText(stateText, screenX + 3, screenY + screenH - 3);

    if (bulb.b2sId > 0) {
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      const toLeft = isSelected ? (isSmallRect ? -1 : 13) : 0;
      ctx.fillStyle = frameColor;
      const text = bulb.b2sId.toString() + (bulb.b2sValue > 0 ? '/' + bulb.b2sValue : '');
      ctx.fillText(text, screenX + screenW - 3 - toLeft, screenY + 3);
    }

    const romText = romInfoToString(bulb);
    if (romText) {
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = frameColor;
      ctx.fillText(romText, screenX + screenW - 3, screenY + screenH - 3);
    }

    if (!showIllumination && bulb.text) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(screenX, screenY, screenW, screenH);
      ctx.clip();
      const px = Math.max(1, ((bulb.fontSize || 10) * 96) / 72) * zoom;
      ctx.font = `${bulb.fontStyle & 2 ? 'italic ' : ''}${bulb.fontStyle & 1 ? 'bold ' : ''}${px}px ${bulb.fontName ? `"${bulb.fontName}", ` : ''}sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.fillStyle = frameColor;
      const lines = bulb.text.split(/\r\n|\n|\r/);
      const lineHeight = px * 1.2;
      let y = screenY + screenH / 2 - ((lines.length - 1) * lineHeight) / 2;
      for (const line of lines) {
        if (bulb.textAlignment === 1) {
          ctx.textAlign = 'left';
          ctx.fillText(line, screenX + 2, y);
        } else if (bulb.textAlignment === 2) {
          ctx.textAlign = 'right';
          ctx.fillText(line, screenX + screenW - 2, y);
        } else {
          ctx.textAlign = 'center';
          ctx.fillText(line, screenX + screenW / 2, y);
        }
        y += lineHeight;
      }
      ctx.restore();
    }

    ctx.restore();
  },

  hitTest(bulb: Bulb, worldX: number, worldY: number): boolean {
    return (
      worldX >= bulb.locX &&
      worldX <= bulb.locX + bulb.width &&
      worldY >= bulb.locY &&
      worldY <= bulb.locY + bulb.height
    );
  },

  getProperties(bulb: Bulb): string {
    const dodgeIdx = dodgeColorToIndex(bulb.dodgeColor);
    const dualBackglass = !!state.currentData?.dualBackglass;
    const commType = state.currentData?.commType;
    const b2sEnabled = commType === 'B2S';
    const romEnabled = commType !== 'B2S';
    const dis = (enabled: boolean): string => (enabled ? '' : 'disabled');
    const b2sTypeOptions = B2S_ID_TYPES.map(
      t => `<option value="${t.value}" ${bulb.b2sIdType === t.value ? 'selected' : ''}>${t.label}</option>`
    ).join('');
    const dodgeOptions = DODGE_COLOR_LABELS.map(
      (label, i) => `<option value="${i}" ${dodgeIdx === i ? 'selected' : ''}>${label}</option>`
    ).join('');
    const fontLabel = bulb.fontName ? `${escapeHtml(bulb.fontName)}, Size=${bulb.fontSize}` : 'Choose font...';

    return `
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Name</label>
          <input type="text" class="prop-input" data-prop="name" value="${escapeHtml(bulb.name)}">
        </div>
        <div class="prop-row">
          <label class="prop-label">ID</label>
          <input type="number" class="prop-input" data-prop="id" min="1" value="${bulb.id}">
        </div>
      </div>

      <div class="prop-divider"></div>

      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">B2S ID</label>
          <input type="text" class="prop-input" data-prop="b2sId" data-nonzero="1" value="${bulb.b2sId > 0 ? bulb.b2sId : ''}" ${dis(b2sEnabled)}>
        </div>
        <div class="prop-row">
          <label class="prop-label">B2S ID type</label>
          <select class="prop-input" data-prop="b2sIdType" ${dis(b2sEnabled)}>${b2sTypeOptions}</select>
        </div>
        <div class="prop-row">
          <label class="prop-label">B2S value</label>
          <input type="text" class="prop-input" data-prop="b2sValue" data-nonzero="1" value="${bulb.b2sValue > 0 ? bulb.b2sValue : ''}" ${dis(b2sEnabled)}>
        </div>
      </div>

      <div class="prop-divider"></div>

      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">ROM ID</label>
          <input type="text" class="prop-input" data-prop="romId" data-nonzero="1" value="${bulb.romId > 0 ? bulb.romId : ''}" ${dis(romEnabled)}>
        </div>
        <div class="prop-row">
          <label class="prop-label">ROM ID type</label>
          <select class="prop-input" data-prop="romIdType" ${dis(romEnabled)}>
            <option value="NotUsed" ${bulb.romIdType === 'NotUsed' ? 'selected' : ''}>(not used)</option>
            <option value="Lamp" ${bulb.romIdType === 'Lamp' ? 'selected' : ''}>Lamp</option>
            <option value="Solenoid" ${bulb.romIdType === 'Solenoid' ? 'selected' : ''}>Solenoid</option>
            <option value="GIString" ${bulb.romIdType === 'GIString' ? 'selected' : ''}>GI String</option>
          </select>
        </div>
        <div class="prop-row">
          <input type="checkbox" data-prop="romInverted" id="bulb-rom-inverted" ${bulb.romInverted ? 'checked' : ''} ${dis(romEnabled)}>
          <label for="bulb-rom-inverted" class="prop-label-inline">Inverted</label>
        </div>
      </div>

      <div class="prop-divider"></div>

      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Initial state</label>
          <select class="prop-input" data-prop="initialState">
            <option value="Off" ${bulb.initialState === 'Off' ? 'selected' : ''}>Off</option>
            <option value="On" ${bulb.initialState === 'On' ? 'selected' : ''}>On</option>
            <option value="AlwaysOn" ${bulb.initialState === 'AlwaysOn' ? 'selected' : ''}>Always on</option>
          </select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Dual mode</label>
          <select class="prop-input" data-prop="dualMode" ${dis(dualBackglass)}>
            <option value="Both" ${bulb.dualMode === 'Both' ? 'selected' : ''}>${dualBackglass ? 'Both' : '(single backglass)'}</option>
            <option value="Authentic" ${bulb.dualMode === 'Authentic' ? 'selected' : ''}>Authentic</option>
            <option value="Fantasy" ${bulb.dualMode === 'Fantasy' ? 'selected' : ''}>Fantasy</option>
          </select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Intensity</label>
          <input type="range" class="prop-input prop-range" data-prop="intensity" min="1" max="5" value="${bulb.intensity}">
          <span class="prop-range-value">${bulb.intensity}</span>
        </div>
        <div class="prop-row prop-row-buttons">
          <button class="prop-btn prop-btn-color" data-action="bulb-light-color" style="background:${rgbToHex(bulb.lightColor)}">Change light color...</button>
        </div>
        <div class="prop-row">
          <label class="prop-label">Dodge color</label>
          <select class="prop-input" data-prop="dodgeColorIndex">${dodgeOptions}</select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Illu mode</label>
          <select class="prop-input" data-prop="illuminationMode">
            <option value="Standard" ${bulb.illuminationMode === 'Standard' ? 'selected' : ''}>Standard</option>
            <option value="Flasher" ${bulb.illuminationMode === 'Flasher' ? 'selected' : ''}>Flasher</option>
          </select>
        </div>
      </div>

      <div class="prop-divider"></div>

      <div class="prop-group">
        <div class="prop-row prop-row-top">
          <label class="prop-label">Text</label>
          <textarea class="prop-input prop-textarea" data-prop="text" rows="3">${escapeHtml(bulb.text || '')}</textarea>
        </div>
        <div class="prop-row prop-row-buttons">
          <button class="prop-btn" data-action="bulb-fonts">${fontLabel}</button>
        </div>
        <div class="prop-row prop-row-radios">
          <label class="prop-radio"><input type="radio" name="textAlign" data-prop="textAlignment" value="1" ${bulb.textAlignment === 1 ? 'checked' : ''}> Left</label>
          <label class="prop-radio"><input type="radio" name="textAlign" data-prop="textAlignment" value="0" ${bulb.textAlignment === 0 ? 'checked' : ''}> Center</label>
          <label class="prop-radio"><input type="radio" name="textAlign" data-prop="textAlignment" value="2" ${bulb.textAlignment === 2 ? 'checked' : ''}> Right</label>
        </div>
      </div>

      <div class="prop-divider"></div>

      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Location</label>
          <input type="number" class="prop-input prop-input-half" data-prop="locX" value="${bulb.locX}" title="X">
          <input type="number" class="prop-input prop-input-half" data-prop="locY" value="${bulb.locY}" title="Y">
        </div>
        <div class="prop-row">
          <label class="prop-label">Size</label>
          <input type="number" class="prop-input prop-input-half" data-prop="width" min="10" value="${bulb.width}" title="Width">
          <input type="number" class="prop-input prop-input-half" data-prop="height" min="10" value="${bulb.height}" title="Height">
        </div>
        <div class="prop-row">
          <label class="prop-label">Z-Order</label>
          <input type="number" class="prop-input" data-prop="zOrder" min="0" max="19" value="${bulb.zOrder}">
        </div>
      </div>

      <div class="prop-divider"></div>

      <div class="prop-group">
        <div class="prop-row prop-row-buttons">
          <button class="prop-btn prop-btn-snippet" data-action="bulb-snippet-settings" ${bulb.isImageSnippet ? '' : 'disabled'}>Snippit settings...</button>
        </div>
      </div>
    `;
  },

  getResizeHandles(bulb: Bulb): ResizeHandle[] {
    return getResizeHandlesForBounds(bulb.locX, bulb.locY, bulb.width, bulb.height);
  },

  getBounds(bulb: Bulb): { x: number; y: number; width: number; height: number } {
    return { x: bulb.locX, y: bulb.locY, width: bulb.width, height: bulb.height };
  },
};

registerEditable('Bulb', bulbEditable);
