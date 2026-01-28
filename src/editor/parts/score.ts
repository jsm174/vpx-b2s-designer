import type { ScoreInfo } from '../../types/data';
import { registerEditable, getResizeHandlesForBounds, type IEditable, type ResizeHandle } from './registry';
import {
  getReelImageSync,
  getCreditReelImageSync,
  preloadReelType,
  preloadCreditReelType,
  isReelTypeLoaded,
  isCreditReelTypeLoaded,
  REEL_INFO,
  CREDIT_REEL_INFO,
} from '../resources';
import { invokeCallback } from '../../shared/callbacks';
import { state } from '../state';

const EM_REELS = [
  { value: 'EMR_T1_0', label: 'EM Reel 1', img: 'EMR_T1_0.jpg' },
  { value: 'EMR_T2_0', label: 'EM Reel 2', img: 'EMR_T2_0.jpg' },
  { value: 'EMR_T3_0', label: 'EM Reel 3', img: 'EMR_T3_0.jpg' },
  { value: 'EMR_T4_0', label: 'EM Reel 4', img: 'EMR_T4_0.png' },
  { value: 'EMR_T5_0', label: 'EM Reel 5', img: 'EMR_T5_0.png' },
  { value: 'EMR_T6_0', label: 'EM Reel 6', img: 'EMR_T6_0.png' },
];

const CREDIT_REELS = [
  { value: 'EMR_CT1_00', label: 'Credit 1', img: 'EMR_CT1_00.jpg' },
  { value: 'EMR_CT2_00', label: 'Credit 2', img: 'EMR_CT2_00.jpg' },
  { value: 'EMR_CT3_00', label: 'Credit 3', img: 'EMR_CT3_00.png' },
];

function getResourceReelType(reelType: string): string {
  return reelType.replace(/_0+$/, '');
}

function rgbToHex(color: { r: number; g: number; b: number }): string {
  const r = color.r.toString(16).padStart(2, '0');
  const g = color.g.toString(16).padStart(2, '0');
  const b = color.b.toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

function ensureReelTypeLoaded(reelType: string): void {
  if (reelType.startsWith('Dream7') || reelType.startsWith('Rendered')) return;

  if (reelType.startsWith('EMR_CT')) {
    const resourceType = getResourceReelType(reelType);
    if (!isCreditReelTypeLoaded(resourceType)) {
      preloadCreditReelType(resourceType).then(() => {
        invokeCallback('render');
      });
    }
    return;
  }

  const resourceType = getResourceReelType(reelType);
  if (!isReelTypeLoaded(resourceType)) {
    preloadReelType(resourceType).then(() => {
      invokeCallback('render');
    });
  }
}

function renderReelDigits(ctx: CanvasRenderingContext2D, score: ScoreInfo, displayValue: string): void {
  const reelType = score.reelType;

  if (reelType.startsWith('Dream7') || reelType.startsWith('Rendered')) {
    renderDream7(ctx, score, displayValue);
    return;
  }

  if (reelType.startsWith('EMR_CT')) {
    renderCreditReel(ctx, score, displayValue);
    return;
  }

  const resourceType = getResourceReelType(reelType);
  const info = REEL_INFO[resourceType as keyof typeof REEL_INFO];
  if (!info) {
    renderPlaceholder(ctx, score, displayValue);
    return;
  }

  const actualSpacing = score.spacing / 2;
  const digitWidth = (score.width - actualSpacing * (score.digits - 1)) / score.digits;
  const digitHeight = score.height;

  for (let i = 0; i < score.digits; i++) {
    const digitChar = displayValue[i] || '0';
    const digitValue = parseInt(digitChar, 10);
    const img = getReelImageSync(resourceType, isNaN(digitValue) ? 0 : digitValue);

    const x = score.locX + i * (digitWidth + actualSpacing);
    const y = score.locY;

    if (img) {
      ctx.drawImage(img, x, y, digitWidth, digitHeight);
    } else {
      ctx.fillStyle = '#222';
      ctx.fillRect(x, y, digitWidth, digitHeight);
      ctx.fillStyle = '#0f0';
      ctx.font = `${Math.min(digitHeight * 0.7, 16)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(digitChar, x + digitWidth / 2, y + digitHeight / 2);
    }
  }
}

function renderCreditReel(ctx: CanvasRenderingContext2D, score: ScoreInfo, displayValue: string): void {
  const resourceType = getResourceReelType(score.reelType);
  const info = CREDIT_REEL_INFO[resourceType as keyof typeof CREDIT_REEL_INFO];

  const actualSpacing = score.spacing / 2;
  const digitWidth = (score.width - actualSpacing * (score.digits - 1)) / score.digits;
  const digitHeight = score.height;

  for (let i = 0; i < score.digits; i++) {
    const digitChar = displayValue[i] || '0';
    const digitValue = parseInt(digitChar, 10);
    const value = isNaN(digitValue) ? 0 : Math.min(digitValue, info?.maxValue ?? 15);
    const img = getCreditReelImageSync(resourceType, value);

    const x = score.locX + i * (digitWidth + actualSpacing);
    const y = score.locY;

    if (img) {
      ctx.drawImage(img, x, y, digitWidth, digitHeight);
    } else {
      ctx.fillStyle = '#222';
      ctx.fillRect(x, y, digitWidth, digitHeight);
      ctx.fillStyle = '#ff0';
      ctx.font = `${Math.min(digitHeight * 0.7, 16)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(digitChar, x + digitWidth / 2, y + digitHeight / 2);
    }
  }
}

function renderDream7(ctx: CanvasRenderingContext2D, score: ScoreInfo, displayValue: string): void {
  const actualSpacing = score.spacing / 2;
  const digitWidth = (score.width - actualSpacing * (score.digits - 1)) / score.digits;
  const digitHeight = score.height;
  const { r, g, b } = score.reelColor;

  for (let i = 0; i < score.digits; i++) {
    const digitChar = displayValue[i] || '0';
    const x = score.locX + i * (digitWidth + actualSpacing);
    const y = score.locY;

    ctx.fillStyle = '#111';
    ctx.fillRect(x, y, digitWidth, digitHeight);

    renderSevenSegment(ctx, x, y, digitWidth, digitHeight, digitChar, { r, g, b });
  }
}

function renderSevenSegment(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  digit: string,
  color: { r: number; g: number; b: number }
): void {
  const segmentMap: Record<string, number> = {
    '0': 0b1111110,
    '1': 0b0110000,
    '2': 0b1101101,
    '3': 0b1111001,
    '4': 0b0110011,
    '5': 0b1011011,
    '6': 0b1011111,
    '7': 0b1110000,
    '8': 0b1111111,
    '9': 0b1111011,
  };

  const segments = segmentMap[digit] ?? 0;
  const litColor = `rgb(${color.r}, ${color.g}, ${color.b})`;
  const darkColor = `rgba(${color.r}, ${color.g}, ${color.b}, 0.15)`;

  const sw = width * 0.15;
  const sh = height * 0.08;
  const gap = width * 0.05;
  const pad = width * 0.08;

  const segA = { x: x + pad, y: y + gap, w: width - 2 * pad, h: sh };
  const segB = { x: x + width - pad - sw, y: y + gap + sh, w: sw, h: (height - 3 * sh - 2 * gap) / 2 };
  const segC = { x: x + width - pad - sw, y: y + height / 2 + sh / 2, w: sw, h: (height - 3 * sh - 2 * gap) / 2 };
  const segD = { x: x + pad, y: y + height - gap - sh, w: width - 2 * pad, h: sh };
  const segE = { x: x + pad, y: y + height / 2 + sh / 2, w: sw, h: (height - 3 * sh - 2 * gap) / 2 };
  const segF = { x: x + pad, y: y + gap + sh, w: sw, h: (height - 3 * sh - 2 * gap) / 2 };
  const segG = { x: x + pad, y: y + height / 2 - sh / 2, w: width - 2 * pad, h: sh };

  const allSegs = [segA, segB, segC, segD, segE, segF, segG];

  for (let i = 0; i < 7; i++) {
    const isLit = (segments & (1 << (6 - i))) !== 0;
    ctx.fillStyle = isLit ? litColor : darkColor;
    const s = allSegs[i];
    ctx.fillRect(s.x, s.y, s.w, s.h);
  }
}

function renderPlaceholder(ctx: CanvasRenderingContext2D, score: ScoreInfo, displayValue: string): void {
  const { r, g, b } = score.reelColor;
  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.font = `${Math.min(score.height * 0.8, 20)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(displayValue, score.locX + score.width / 2, score.locY + score.height / 2);
}

export const scoreEditable: IEditable<ScoreInfo> = {
  render(score: ScoreInfo, ctx: CanvasRenderingContext2D, isSelected: boolean): void {
    const showFrames = state.showScoreFrames;
    const zoom = state.zoom || 1;
    const lw = 1 / zoom;

    ensureReelTypeLoaded(score.reelType);

    ctx.fillStyle = '#111';
    ctx.fillRect(score.locX, score.locY, score.width, score.height);

    const displayValue = '0'.repeat(score.digits);
    renderReelDigits(ctx, score, displayValue);

    ctx.lineWidth = lw;

    if (showFrames) {
      if (isSelected) {
        ctx.strokeStyle = '#ff8c00';
        ctx.strokeRect(score.locX, score.locY, score.width, score.height);
        const off1 = 1 / zoom;
        const off2 = 2 / zoom;
        ctx.strokeRect(score.locX + off1, score.locY + off1, score.width - off1 * 2, score.height - off1 * 2);
        ctx.strokeRect(score.locX + off2, score.locY + off2, score.width - off2 * 2, score.height - off2 * 2);
      } else {
        ctx.strokeStyle = '#ff8c00';
        ctx.strokeRect(score.locX, score.locY, score.width, score.height);
        ctx.strokeStyle = '#fff';
        ctx.setLineDash([5 / zoom, 5 / zoom]);
        ctx.strokeRect(score.locX, score.locY, score.width, score.height);
        ctx.setLineDash([]);
      }

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      const screenX = score.locX * zoom + state.panX;
      const screenY = score.locY * zoom + state.panY;
      const screenW = score.width * zoom;

      ctx.font = 'bold 8px Tahoma, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      ctx.fillStyle = '#fff';
      ctx.fillText(score.id.toString(), screenX + 4, screenY + 4);
      ctx.fillStyle = '#ff8c00';
      ctx.fillText(score.id.toString(), screenX + 3, screenY + 3);

      if (score.b2sStartDigit > 0) {
        ctx.font = '7px Tahoma, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';

        let label = '';
        if (score.b2sPlayerNo > 0) {
          label = `P${score.b2sPlayerNo}/${score.b2sStartDigit}`;
        } else {
          label = score.b2sStartDigit.toString();
        }

        const rightPad = isSelected ? 15 : 3;
        ctx.fillStyle = '#fff';
        ctx.fillText(label, screenX + screenW - rightPad + 1, screenY + 4);
        ctx.fillStyle = '#ff8c00';
        ctx.fillText(label, screenX + screenW - rightPad, screenY + 3);
      }

      ctx.restore();
    } else if (isSelected) {
      ctx.strokeStyle = '#ff8c00';
      ctx.strokeRect(score.locX, score.locY, score.width, score.height);
      const off1 = 1 / zoom;
      const off2 = 2 / zoom;
      ctx.strokeRect(score.locX + off1, score.locY + off1, score.width - off1 * 2, score.height - off1 * 2);
      ctx.strokeRect(score.locX + off2, score.locY + off2, score.width - off2 * 2, score.height - off2 * 2);
    }
  },

  hitTest(score: ScoreInfo, worldX: number, worldY: number): boolean {
    return (
      worldX >= score.locX &&
      worldX <= score.locX + score.width &&
      worldY >= score.locY &&
      worldY <= score.locY + score.height
    );
  },

  getProperties(score: ScoreInfo): string {
    const isLED = score.reelType.startsWith('Dream7') || score.reelType.startsWith('Rendered');

    const emReelPicker = EM_REELS.map(
      r => `<div class="reel-option ${score.reelType === r.value ? 'selected' : ''}" data-reel="${r.value}" title="${r.label}">
        <img src="reels/${r.img}" alt="${r.label}">
      </div>`
    ).join('');

    const creditReelPicker = CREDIT_REELS.map(
      r => `<div class="reel-option ${score.reelType === r.value ? 'selected' : ''}" data-reel="${r.value}" title="${r.label}">
        <img src="reels/${r.img}" alt="${r.label}">
      </div>`
    ).join('');

    return `
      <div class="prop-group">
        <div class="prop-group-title">Reels & LEDs</div>
        <div class="prop-row">
          <label class="prop-label">Display no</label>
          <input type="text" class="prop-input" value="${score.id}" disabled>
        </div>
        <div class="prop-row">
          <label class="prop-label">Reel/LED count</label>
          <input type="number" class="prop-input" data-prop="digits" min="1" max="15" value="${score.digits}">
        </div>
        <div class="prop-row">
          <label class="prop-label">Reel/LED spacing</label>
          <input type="number" class="prop-input" data-prop="spacing" value="${score.spacing}">
        </div>
        <div class="prop-row">
          <label class="prop-label">Initial state</label>
          <select class="prop-input" data-prop="visible">
            <option value="true" ${score.visible ? 'selected' : ''}>Visible</option>
            <option value="false" ${!score.visible ? 'selected' : ''}>Hidden</option>
          </select>
        </div>
      </div>

      <div class="prop-group">
        <div class="prop-group-title">Reel Type</div>
        <div class="reel-picker-section">
          <div class="reel-picker-label">EM reel</div>
          <div class="reel-picker">${emReelPicker}</div>
        </div>
        <div class="reel-picker-section">
          <div class="reel-picker-label">EM credit reel</div>
          <div class="reel-picker">${creditReelPicker}</div>
        </div>
        <div class="prop-row">
          <input type="checkbox" data-prop="useDream7" ${isLED ? 'checked' : ''}>
          <label class="prop-label-inline">Use 'Dream7' LEDs</label>
        </div>
      </div>

      <div class="prop-group">
        <div class="prop-group-title">Location</div>
        <div class="prop-row">
          <label class="prop-label">X</label>
          <input type="number" class="prop-input" data-prop="locX" value="${Math.round(score.locX)}">
        </div>
        <div class="prop-row">
          <label class="prop-label">Y</label>
          <input type="number" class="prop-input" data-prop="locY" value="${Math.round(score.locY)}">
        </div>
      </div>

      <div class="prop-group">
        <div class="prop-group-title">Size</div>
        <div class="prop-row">
          <label class="prop-label">Width</label>
          <input type="number" class="prop-input" data-prop="width" value="${Math.round(score.width)}">
        </div>
        <div class="prop-row">
          <label class="prop-label">Height</label>
          <input type="number" class="prop-input" data-prop="height" value="${Math.round(score.height)}">
        </div>
      </div>

      <div class="prop-group">
        <div class="prop-group-title">B2S</div>
        <div class="prop-row">
          <label class="prop-label">B2S score type</label>
          <select class="prop-input" data-prop="b2sScoreType">
            <option value="0" ${score.b2sScoreType === 0 ? 'selected' : ''}>Not Used</option>
            <option value="1" ${score.b2sScoreType === 1 ? 'selected' : ''}>Scores</option>
            <option value="29" ${score.b2sScoreType === 29 ? 'selected' : ''}>Credits</option>
          </select>
        </div>
        <div class="prop-row">
          <label class="prop-label">B2S player no</label>
          <select class="prop-input" data-prop="b2sPlayerNo">
            <option value="0" ${score.b2sPlayerNo === 0 ? 'selected' : ''}>Not Used</option>
            <option value="1" ${score.b2sPlayerNo === 1 ? 'selected' : ''}>Player 1</option>
            <option value="2" ${score.b2sPlayerNo === 2 ? 'selected' : ''}>Player 2</option>
            <option value="3" ${score.b2sPlayerNo === 3 ? 'selected' : ''}>Player 3</option>
            <option value="4" ${score.b2sPlayerNo === 4 ? 'selected' : ''}>Player 4</option>
            <option value="5" ${score.b2sPlayerNo === 5 ? 'selected' : ''}>Player 5</option>
            <option value="6" ${score.b2sPlayerNo === 6 ? 'selected' : ''}>Player 6</option>
          </select>
        </div>
        <div class="prop-row">
          <label class="prop-label">B2S start digit</label>
          <input type="number" class="prop-input" data-prop="b2sStartDigit" min="0" value="${score.b2sStartDigit}">
        </div>
      </div>

      <div class="prop-group">
        <div class="prop-group-title">Appearance</div>
        <div class="prop-row">
          <label class="prop-label">Color</label>
          <input type="color" class="prop-input prop-color" data-prop="reelColor" value="${rgbToHex(score.reelColor)}">
        </div>
      </div>
    `;
  },

  getResizeHandles(score: ScoreInfo): ResizeHandle[] {
    return getResizeHandlesForBounds(score.locX, score.locY, score.width, score.height);
  },

  getBounds(score: ScoreInfo): { x: number; y: number; width: number; height: number } {
    return { x: score.locX, y: score.locY, width: score.width, height: score.height };
  },
};

registerEditable('Score', scoreEditable);
