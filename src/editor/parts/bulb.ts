import type { Bulb } from '../../types/data';
import { registerEditable, getResizeHandlesForBounds, type IEditable, type ResizeHandle } from './registry';
import { invokeCallback } from '../../shared/callbacks';
import { state } from '../state';

function colorOverlay(a: number, b: number): number {
  const c = a < 128 ? (2 * b * a) / 255 : 255 - (2 * (255 - b) * (255 - a)) / 255;
  return Math.min(255, Math.max(0, c));
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function rgbToHex(color: { r: number; g: number; b: number }): string {
  const r = color.r.toString(16).padStart(2, '0');
  const g = color.g.toString(16).padStart(2, '0');
  const b = color.b.toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

const bulbImageCache: Map<number, HTMLImageElement> = new Map();
const loadingBulbImages: Set<number> = new Set();

function detectImageFormat(base64: string): string {
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

export const bulbEditable: IEditable<Bulb> = {
  render(bulb: Bulb, ctx: CanvasRenderingContext2D, isSelected: boolean): void {
    const zoom = state.zoom || 1;
    const lw = 1 / zoom;
    const showFrames = state.showIlluminationFrames;

    const showIllumination = state.showIllumination || state.showIlluminationIntensity;

    if (showIllumination) {
      if (bulb.isImageSnippet && bulb.imageData) {
        const cachedImg = bulbImageCache.get(bulb.id);
        if (cachedImg) {
          ctx.drawImage(cachedImg, bulb.locX, bulb.locY, bulb.width, bulb.height);
        } else {
          loadBulbImage(bulb);
        }
      } else {
        const bgImage = state.activeTab === 'dmd' ? state.dmdImage : state.backgroundImage;
        if (bgImage) {
          const intensity = state.showIlluminationIntensity ? bulb.intensity : 2;
          const { r: lr, g: lg, b: lb } = bulb.lightColor;

          const bx = Math.max(0, Math.floor(bulb.locX));
          const by = Math.max(0, Math.floor(bulb.locY));
          const bw = Math.min(Math.ceil(bulb.width), bgImage.width - bx);
          const bh = Math.min(Math.ceil(bulb.height), bgImage.height - by);

          if (bw > 0 && bh > 0) {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = bgImage.width;
            tempCanvas.height = bgImage.height;
            const tempCtx = tempCanvas.getContext('2d')!;
            tempCtx.drawImage(bgImage, 0, 0);
            const bgData = tempCtx.getImageData(bx, by, bw, bh);

            const outCanvas = document.createElement('canvas');
            outCanvas.width = bw;
            outCanvas.height = bh;
            const outCtx = outCanvas.getContext('2d')!;

            const grad = outCtx.createRadialGradient(bw / 2, bh / 2, 0, bw / 2, bh / 2, Math.max(bw, bh) / 2);
            grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
            grad.addColorStop(0.15, 'rgba(255, 255, 255, 1)');
            grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            outCtx.fillStyle = grad;
            outCtx.fillRect(0, 0, bw, bh);

            const alphaData = outCtx.getImageData(0, 0, bw, bh);
            const outData = outCtx.createImageData(bw, bh);

            for (let i = 0; i < bgData.data.length; i += 4) {
              const alpha = alphaData.data[i + 3] / 255;
              if (alpha === 0) {
                outData.data[i + 3] = 0;
                continue;
              }

              let r = bgData.data[i];
              let g = bgData.data[i + 1];
              let b = bgData.data[i + 2];

              for (let j = 0; j < intensity; j++) {
                r = colorOverlay(r, lr);
                g = colorOverlay(g, lg);
                b = colorOverlay(b, lb);
              }

              outData.data[i] = r;
              outData.data[i + 1] = g;
              outData.data[i + 2] = b;
              outData.data[i + 3] = Math.round(alpha * 255);
            }

            outCtx.putImageData(outData, 0, 0);
            ctx.drawImage(outCanvas, bx, by);
          }
        }
      }
    }

    if (showFrames && bulb.isImageSnippet && bulb.imageData) {
      const cachedImg = bulbImageCache.get(bulb.id);
      if (cachedImg) {
        ctx.drawImage(cachedImg, bulb.locX, bulb.locY, bulb.width, bulb.height);
      } else {
        loadBulbImage(bulb);
      }
    }

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = lw;

    if (isSelected) {
      ctx.strokeRect(bulb.locX, bulb.locY, bulb.width, bulb.height);
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
    } else if (showFrames) {
      ctx.setLineDash([6 / zoom, 6 / zoom]);
      ctx.strokeRect(bulb.locX, bulb.locY, bulb.width, bulb.height);
      ctx.setLineDash([]);
    }

    if (showFrames) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      const screenX = bulb.locX * zoom + state.panX;
      const screenY = bulb.locY * zoom + state.panY;
      const screenW = bulb.width * zoom;
      const screenH = bulb.height * zoom;
      const frameColor = '#fff';

      ctx.font = `${isSelected ? 'bold ' : ''}7px Tahoma, sans-serif`;

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

      if (bulb.b2sId && bulb.b2sId > 0) {
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        const rightPad = isSelected ? 15 : 3;
        ctx.fillStyle = frameColor;
        ctx.fillText(bulb.b2sId.toString(), screenX + screenW - rightPad, screenY + 3);
      }

      if (bulb.romId && bulb.romId > 0) {
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        const prefix =
          (bulb.romInverted ? 'I' : '') +
          (bulb.romIdType === 'Lamp' ? 'L' : bulb.romIdType === 'Solenoid' ? 'S' : 'GI');
        ctx.fillStyle = frameColor;
        ctx.fillText(`${prefix}${bulb.romId}`, screenX + screenW - 3, screenY + screenH - 3);
      }

      ctx.restore();
    }
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
    return `
      <div class="prop-group">
        <div class="prop-group-title">Bulb</div>
        <div class="prop-row">
          <label class="prop-label">ID</label>
          <input type="text" class="prop-input" value="${bulb.id}" disabled>
        </div>
        <div class="prop-row">
          <label class="prop-label">Name</label>
          <input type="text" class="prop-input" data-prop="name" value="${escapeHtml(bulb.name)}">
        </div>
        <div class="prop-row">
          <label class="prop-label">Visible</label>
          <input type="checkbox" data-prop="visible" ${bulb.visible ? 'checked' : ''}>
        </div>
      </div>

      <div class="prop-group">
        <div class="prop-group-title">Position</div>
        <div class="prop-row">
          <label class="prop-label">X</label>
          <input type="number" class="prop-input" data-prop="locX" value="${bulb.locX}">
        </div>
        <div class="prop-row">
          <label class="prop-label">Y</label>
          <input type="number" class="prop-input" data-prop="locY" value="${bulb.locY}">
        </div>
        <div class="prop-row">
          <label class="prop-label">Width</label>
          <input type="number" class="prop-input" data-prop="width" value="${bulb.width}">
        </div>
        <div class="prop-row">
          <label class="prop-label">Height</label>
          <input type="number" class="prop-input" data-prop="height" value="${bulb.height}">
        </div>
      </div>

      <div class="prop-group">
        <div class="prop-group-title">Appearance</div>
        <div class="prop-row">
          <label class="prop-label">Color</label>
          <input type="color" class="prop-input prop-color" data-prop="lightColor" value="${rgbToHex(bulb.lightColor)}">
        </div>
        <div class="prop-row">
          <label class="prop-label">Intensity</label>
          <input type="range" class="prop-input prop-range" data-prop="intensity" min="1" max="5" value="${bulb.intensity}">
        </div>
        <div class="prop-row">
          <label class="prop-label">Z-Order</label>
          <input type="number" class="prop-input" data-prop="zOrder" value="${bulb.zOrder}">
        </div>
      </div>

      <div class="prop-group">
        <div class="prop-group-title">Text</div>
        <div class="prop-row">
          <label class="prop-label">Text</label>
          <input type="text" class="prop-input" data-prop="text" value="${escapeHtml(bulb.text || '')}">
        </div>
        <div class="prop-row">
          <label class="prop-label">Align</label>
          <select class="prop-input" data-prop="textAlignment">
            <option value="0" ${bulb.textAlignment === 0 ? 'selected' : ''}>Center</option>
            <option value="1" ${bulb.textAlignment === 1 ? 'selected' : ''}>Left</option>
            <option value="2" ${bulb.textAlignment === 2 ? 'selected' : ''}>Right</option>
          </select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Font</label>
          <input type="text" class="prop-input" data-prop="fontName" value="${escapeHtml(bulb.fontName || '')}">
        </div>
        <div class="prop-row">
          <label class="prop-label">Size</label>
          <input type="number" class="prop-input" data-prop="fontSize" value="${bulb.fontSize || 10}">
        </div>
      </div>

      <div class="prop-group">
        <div class="prop-group-title">ROM Control</div>
        <div class="prop-row">
          <label class="prop-label">ROM ID</label>
          <input type="number" class="prop-input" data-prop="romId" value="${bulb.romId}">
        </div>
        <div class="prop-row">
          <label class="prop-label">ROM Type</label>
          <select class="prop-input" data-prop="romIdType">
            <option value="Lamp" ${bulb.romIdType === 'Lamp' ? 'selected' : ''}>Lamp</option>
            <option value="Solenoid" ${bulb.romIdType === 'Solenoid' ? 'selected' : ''}>Solenoid</option>
            <option value="GIString" ${bulb.romIdType === 'GIString' ? 'selected' : ''}>GI String</option>
          </select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Inverted</label>
          <input type="checkbox" data-prop="romInverted" ${bulb.romInverted ? 'checked' : ''}>
        </div>
      </div>

      <div class="prop-group">
        <div class="prop-group-title">B2S Control</div>
        <div class="prop-row">
          <label class="prop-label">B2S ID</label>
          <input type="number" class="prop-input" data-prop="b2sId" value="${bulb.b2sId}">
        </div>
        <div class="prop-row">
          <label class="prop-label">B2S Type</label>
          <select class="prop-input" data-prop="b2sIdType">
            <option value="Straight" ${bulb.b2sIdType === 'Straight' ? 'selected' : ''}>Straight</option>
            <option value="Cyclic" ${bulb.b2sIdType === 'Cyclic' ? 'selected' : ''}>Cyclic</option>
          </select>
        </div>
      </div>

      <div class="prop-group">
        <div class="prop-group-title">State</div>
        <div class="prop-row">
          <label class="prop-label">Initial</label>
          <select class="prop-input" data-prop="initialState">
            <option value="Off" ${bulb.initialState === 'Off' ? 'selected' : ''}>Off</option>
            <option value="On" ${bulb.initialState === 'On' ? 'selected' : ''}>On</option>
            <option value="Undefined" ${bulb.initialState === 'Undefined' ? 'selected' : ''}>Always On</option>
          </select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Dual Mode</label>
          <select class="prop-input" data-prop="dualMode">
            <option value="Both" ${bulb.dualMode === 'Both' ? 'selected' : ''}>Both</option>
            <option value="Authentic" ${bulb.dualMode === 'Authentic' ? 'selected' : ''}>Authentic</option>
            <option value="Fantasy" ${bulb.dualMode === 'Fantasy' ? 'selected' : ''}>Fantasy</option>
          </select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Mode</label>
          <select class="prop-input" data-prop="illuminationMode">
            <option value="Standard" ${bulb.illuminationMode === 'Standard' ? 'selected' : ''}>Standard</option>
            <option value="Flasher" ${bulb.illuminationMode === 'Flasher' ? 'selected' : ''}>Flasher</option>
          </select>
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
