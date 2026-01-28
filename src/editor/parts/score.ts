import type { ScoreInfo } from '../../types/data';
import { isReelTypeRenderedOrDream7, B2S_SCORE_TYPE } from '../../types/data';
import { registerEditable, getResizeHandlesForBounds, type IEditable, type ResizeHandle } from './registry';
import { invokeCallback } from '../../shared/callbacks';
import { state } from '../state';
import { drawRemoveBox, REMOVE_BOX } from './bulb';
import { getReelImage, ensureReelResourcesLoaded } from '../reel-render';
import { reelTypeDisplayName, resourcePathForReelImage } from '../resources';

export function singleReelSize(score: ScoreInfo): { width: number; height: number } {
  let width = (score.width - (score.spacing / 2) * (score.digits - 1)) / score.digits;
  while (width * score.digits > score.width - 1) width -= 1;
  return { width, height: score.height - 1 };
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export const scoreEditable: IEditable<ScoreInfo> = {
  render(score: ScoreInfo, ctx: CanvasRenderingContext2D, isSelected: boolean): void {
    const showFrames = state.showScoreFrames;
    const zoom = state.zoom || 1;
    const lw = 1 / zoom;
    const isPreviewed = state.previewedItem?.type === 'score' && state.previewedItem.id === score.id;

    if (score.digits > 0) {
      ensureReelResourcesLoaded(score.reelType, () => invokeCallback('render'));
      const { width, height } = singleReelSize(score);
      const image = getReelImage(score, state.currentData, width, height);
      if (image && width > 0 && height > 0) {
        let x = score.locX + 1;
        const y = score.locY + 1;
        for (let i = 0; i < score.digits; i++) {
          ctx.drawImage(image, x, y, width, height);
          x += width + score.spacing / 2;
        }
      }
    }

    ctx.lineWidth = lw;

    if (showFrames) {
      ctx.strokeStyle = '#ff8c00';
      ctx.strokeRect(score.locX, score.locY, score.width, score.height);
      if (isSelected) {
        const off1 = 1 / zoom;
        const off2 = 2 / zoom;
        ctx.strokeRect(score.locX + off1, score.locY + off1, score.width - off1 * 2, score.height - off1 * 2);
        ctx.strokeRect(score.locX + off2, score.locY + off2, score.width - off2 * 2, score.height - off2 * 2);
      } else {
        ctx.strokeStyle = '#fff';
        ctx.setLineDash([5 / zoom, 5 / zoom]);
        ctx.strokeRect(score.locX, score.locY, score.width, score.height);
        ctx.setLineDash([]);
      }
    }

    if (isPreviewed) {
      ctx.strokeStyle = '#ff8c00';
      const off1 = 1 / zoom;
      ctx.strokeRect(score.locX, score.locY, score.width, score.height);
      ctx.strokeRect(score.locX + off1, score.locY + off1, score.width - off1 * 2, score.height - off1 * 2);
    }

    if (!showFrames) return;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const screenX = score.locX * zoom + state.panX;
    const screenY = score.locY * zoom + state.panY;
    const screenW = score.width * zoom;
    const screenH = score.height * zoom;
    const frameColor = '#ff8c00';

    if (isSelected) {
      drawRemoveBox(ctx, screenX, screenY, screenW, screenH, frameColor);
    }

    const drawOutlined = (text: string, x: number, y: number): void => {
      ctx.fillStyle = '#fff';
      ctx.fillText(text, x + 1, y + 1);
      ctx.fillStyle = frameColor;
      ctx.fillText(text, x, y);
    };

    ctx.font = '9px Tahoma, sans-serif';
    if (score.reelIlluB2SID > 0) {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      const text = score.reelIlluB2SID + (score.reelIlluB2SValue > 0 ? '/' + score.reelIlluB2SValue : '');
      drawOutlined(text, screenX + 3, screenY + screenH - 3);
    }

    if (score.b2sStartDigit > 0) {
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      const isSmallRect = screenW < REMOVE_BOX.minFrame || screenH < REMOVE_BOX.minFrame;
      const toLeft = isSelected && !isSmallRect ? 13 : 0;
      const label = (score.b2sPlayerNo > 0 ? `P${score.b2sPlayerNo}/` : '') + score.b2sStartDigit;
      drawOutlined(label, screenX + screenW - 3 - toLeft, screenY + 3);
    }

    ctx.font = 'bold 11px Tahoma, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    drawOutlined(score.id.toString(), screenX + 3, screenY + 3);

    ctx.restore();
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
    const data = state.currentData;
    const b2sEnabled = data.commType === 'B2S';
    const dis = (enabled: boolean): string => (enabled ? '' : 'disabled');
    const isRendered = isReelTypeRenderedOrDream7(score.reelType);
    const colorEnabled = isRendered;
    const illuEnabled = !isRendered;

    const reelTypes = data.reelTypes.length > 0 ? data.reelTypes : [];
    const reelPicker = reelTypes
      .map(rt => {
        const selected = score.reelType === rt ? 'selected' : '';
        let inner: string;
        if (isReelTypeRenderedOrDream7(rt)) {
          inner = `<canvas class="reel-option-led" data-led-type="${escapeHtml(rt)}" width="40" height="54"></canvas>`;
        } else {
          const path = resourcePathForReelImage(rt.endsWith('0') ? rt : rt + '_0');
          inner = path
            ? `<img src="${path}" alt="${escapeHtml(rt)}">`
            : `<div class="reel-option-text">${escapeHtml(rt)}</div>`;
        }
        return `<div class="reel-option ${selected}" data-reel="${escapeHtml(rt)}" title="${escapeHtml(reelTypeDisplayName(rt))}">${inner}</div>`;
      })
      .join('');
    const reelPickerHtml =
      reelTypes.length > 0
        ? `<div class="reel-picker">${reelPicker}</div>`
        : `<p class="prop-hint">No reel or LED types chosen. Use 'Reels &amp; LEDs' &rarr; 'Choose reel type...'.</p>`;

    const playerOptions = [0, 1, 2, 3, 4, 5, 6]
      .map(
        n =>
          `<option value="${n}" ${data.numberOfPlayers === n ? 'selected' : ''}>${n === 0 ? '(not set)' : n}</option>`
      )
      .join('');

    return `
      <div class="prop-group">
        ${reelPickerHtml}
        <div class="prop-row">
          <input type="checkbox" data-prop="useDream7LEDs" data-scope="backglass" id="score-dream7" ${data.useDream7LEDs ? 'checked' : ''}>
          <label for="score-dream7" class="prop-label-inline">Use 'Dream7' LEDs</label>
        </div>
      </div>

      <div class="prop-divider"></div>

      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Number of players</label>
          <select class="prop-input" data-prop="numberOfPlayers" data-scope="backglass">${playerOptions}</select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Display no.</label>
          <input type="text" class="prop-input" value="${score.id}" disabled>
        </div>
        <div class="prop-row">
          <label class="prop-label">B2S start digit</label>
          <input type="text" class="prop-input" data-prop="b2sStartDigit" data-nonzero="1" value="${score.b2sStartDigit > 0 ? score.b2sStartDigit : ''}" ${dis(b2sEnabled)}>
        </div>
        <div class="prop-row">
          <label class="prop-label">B2S score type</label>
          <select class="prop-input" data-prop="b2sScoreType" ${dis(b2sEnabled)}>
            <option value="${B2S_SCORE_TYPE.NotUsed}" ${score.b2sScoreType === B2S_SCORE_TYPE.NotUsed ? 'selected' : ''}>(not used)</option>
            <option value="${B2S_SCORE_TYPE.Scores}" ${score.b2sScoreType === B2S_SCORE_TYPE.Scores ? 'selected' : ''}>Scores</option>
            <option value="${B2S_SCORE_TYPE.Credits}" ${score.b2sScoreType === B2S_SCORE_TYPE.Credits ? 'selected' : ''}>Credits</option>
          </select>
        </div>
        <div class="prop-row">
          <label class="prop-label">B2S player no.</label>
          <select class="prop-input" data-prop="b2sPlayerNo" ${dis(b2sEnabled)}>
            <option value="0" ${score.b2sPlayerNo === 0 ? 'selected' : ''}>(not used)</option>
            <option value="1" ${score.b2sPlayerNo === 1 ? 'selected' : ''}>Player 1</option>
            <option value="2" ${score.b2sPlayerNo === 2 ? 'selected' : ''}>Player 2</option>
            <option value="3" ${score.b2sPlayerNo === 3 ? 'selected' : ''}>Player 3</option>
            <option value="4" ${score.b2sPlayerNo === 4 ? 'selected' : ''}>Player 4</option>
          </select>
        </div>
      </div>

      <div class="prop-divider"></div>

      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Reel/LED count</label>
          <input type="number" class="prop-input" data-prop="digits" min="1" max="50" value="${score.digits}">
        </div>
        <div class="prop-row">
          <label class="prop-label">Reel/LED spacing</label>
          <input type="number" class="prop-input" data-prop="spacing" min="0" max="1000" value="${score.spacing}">
        </div>
        <div class="prop-row">
          <label class="prop-label">Initial state</label>
          <select class="prop-input" data-prop="displayState">
            <option value="0" ${score.displayState === 0 ? 'selected' : ''}>Visible</option>
            <option value="1" ${score.displayState === 1 ? 'selected' : ''}>Hidden</option>
          </select>
        </div>
      </div>

      <div class="prop-divider"></div>

      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Location</label>
          <input type="number" class="prop-input prop-input-half" data-prop="locX" value="${Math.round(score.locX)}" title="X">
          <input type="number" class="prop-input prop-input-half" data-prop="locY" value="${Math.round(score.locY)}" title="Y">
        </div>
        <div class="prop-row">
          <label class="prop-label">Size</label>
          <input type="number" class="prop-input prop-input-half" data-prop="width" min="10" value="${Math.round(score.width)}" title="Width">
          <input type="number" class="prop-input prop-input-half" data-prop="height" min="10" value="${Math.round(score.height)}" title="Height">
        </div>
      </div>

      <div class="prop-divider"></div>

      <div class="prop-group">
        <div class="prop-row prop-row-buttons">
          <button class="prop-btn" data-action="score-perfect-scale">Perfect scale, width is fix</button>
        </div>
        <div class="prop-row prop-row-buttons">
          <button class="prop-btn" data-action="score-led-color" ${dis(colorEnabled)}>Change LED color...</button>
        </div>
        <div class="prop-row prop-row-buttons">
          <button class="prop-btn" data-action="score-reel-illumination" ${dis(illuEnabled)}>Reel illumination...</button>
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
