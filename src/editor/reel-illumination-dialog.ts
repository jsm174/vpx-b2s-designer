import type { ScoreInfo, ReelIlluLocation } from '../types/data';
import { B2S_ID_TYPES } from '../types/data';
import { showModal } from './modal';

export function showReelIlluminationDialog(score: ScoreInfo, onSave: (changes: Partial<ScoreInfo>) => void): void {
  const typeOptions = B2S_ID_TYPES.map(
    t => `<option value="${t.value}" ${score.reelIlluB2SIDType === t.value ? 'selected' : ''}>${t.label}</option>`
  ).join('');

  const bodyHtml = `
    <div class="prop-group">
      <div class="prop-row">
        <label class="prop-label">Illu location</label>
        <select class="prop-input" id="ri-loc">
          <option value="Off" ${score.reelIlluLocation === 'Off' ? 'selected' : ''}>Off</option>
          <option value="Above" ${score.reelIlluLocation === 'Above' ? 'selected' : ''}>Above</option>
          <option value="Below" ${score.reelIlluLocation === 'Below' ? 'selected' : ''}>Below</option>
          <option value="AboveAndBelow" ${score.reelIlluLocation === 'AboveAndBelow' ? 'selected' : ''}>Above and below</option>
        </select>
      </div>
      <div class="prop-row">
        <label class="prop-label">B2S ID type</label>
        <select class="prop-input" id="ri-b2sidtype">${typeOptions}</select>
      </div>
      <div class="prop-row">
        <label class="prop-label">B2S ID</label>
        <input type="text" class="prop-input" id="ri-b2sid" value="${score.reelIlluB2SID > 0 ? score.reelIlluB2SID : ''}">
      </div>
      <div class="prop-row">
        <label class="prop-label">B2S value</label>
        <input type="text" class="prop-input" id="ri-b2sval" value="${score.reelIlluB2SValue > 0 ? score.reelIlluB2SValue : ''}">
      </div>
      <div class="prop-row">
        <label class="prop-label">Intensity</label>
        <input type="range" class="prop-input prop-range" id="ri-intensity" min="1" max="5" value="${Math.max(1, score.reelIlluIntensity)}">
        <span class="prop-range-value" id="ri-intensity-value">${Math.max(1, score.reelIlluIntensity)}</span>
      </div>
    </div>
  `;

  const handle = showModal({
    id: 'reel-illu-modal',
    title: 'Set reel illumination',
    contentClass: 'reel-illu-content',
    bodyHtml,
    onOk: modal => {
      onSave({
        reelIlluLocation: (modal.querySelector('#ri-loc') as HTMLSelectElement).value as ReelIlluLocation,
        reelIlluB2SID: parseInt((modal.querySelector('#ri-b2sid') as HTMLInputElement).value, 10) || 0,
        reelIlluB2SIDType: parseInt((modal.querySelector('#ri-b2sidtype') as HTMLSelectElement).value, 10) || 0,
        reelIlluB2SValue: parseInt((modal.querySelector('#ri-b2sval') as HTMLInputElement).value, 10) || 0,
        reelIlluIntensity: parseInt((modal.querySelector('#ri-intensity') as HTMLInputElement).value, 10) || 1,
      });
    },
  });

  const typeSel = handle.el.querySelector('#ri-b2sidtype') as HTMLSelectElement;
  const idInput = handle.el.querySelector('#ri-b2sid') as HTMLInputElement;
  const valInput = handle.el.querySelector('#ri-b2sval') as HTMLInputElement;
  const intensity = handle.el.querySelector('#ri-intensity') as HTMLInputElement;
  const intensityValue = handle.el.querySelector('#ri-intensity-value') as HTMLElement;

  typeSel.addEventListener('change', () => {
    const t = B2S_ID_TYPES.find(x => x.value === parseInt(typeSel.value, 10));
    if (t && t.value > 0) idInput.value = String(t.id);
  });
  idInput.addEventListener('input', () => {
    const n = parseInt(idInput.value, 10);
    if (Number.isNaN(n) || n === 0) idInput.value = '';
    typeSel.value = '0';
  });
  valInput.addEventListener('input', () => {
    const n = parseInt(valInput.value, 10);
    if (Number.isNaN(n) || n === 0) valInput.value = '';
  });
  intensity.addEventListener('input', () => {
    intensityValue.textContent = intensity.value;
  });
}
