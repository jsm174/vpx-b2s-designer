import type { Bulb } from '../types/data';
import { showModal, escapeHtml } from './modal';

const COMMON_FONTS = [
  'Arial',
  'Arial Black',
  'Arial Narrow',
  'Calibri',
  'Cambria',
  'Comic Sans MS',
  'Consolas',
  'Courier New',
  'Georgia',
  'Helvetica',
  'Impact',
  'Lucida Console',
  'Tahoma',
  'Times New Roman',
  'Trebuchet MS',
  'Verdana',
];

const STYLE_REGULAR = 0;
const STYLE_BOLD = 1;
const STYLE_ITALIC = 2;
const STYLE_UNDERLINE = 4;

export function showFontPickerDialog(bulb: Bulb, onSave: (changes: Partial<Bulb>) => void): void {
  const fontOptions = COMMON_FONTS.map(
    f => `<option value="${f}" ${f === bulb.fontName ? 'selected' : ''} style="font-family:'${f}'">${f}</option>`
  ).join('');

  const sizeOptions = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72]
    .map(s => `<option value="${s}" ${s === bulb.fontSize ? 'selected' : ''}>${s}</option>`)
    .join('');

  const bodyHtml = `
    <div class="prop-row">
      <label class="prop-label">Font</label>
      <select class="prop-input" id="font-name">${fontOptions}</select>
    </div>
    <div class="prop-row">
      <label class="prop-label">Custom</label>
      <input type="text" class="prop-input" id="font-custom" placeholder="(or enter font name)" value="${COMMON_FONTS.includes(bulb.fontName) ? '' : escapeHtml(bulb.fontName)}">
    </div>
    <div class="prop-row">
      <label class="prop-label">Size</label>
      <select class="prop-input" id="font-size">${sizeOptions}</select>
    </div>
    <div class="prop-row">
      <label class="prop-label">Style</label>
      <div class="font-style-checks">
        <label><input type="checkbox" id="font-bold" ${bulb.fontStyle & STYLE_BOLD ? 'checked' : ''}> Bold</label>
        <label><input type="checkbox" id="font-italic" ${bulb.fontStyle & STYLE_ITALIC ? 'checked' : ''}> Italic</label>
        <label><input type="checkbox" id="font-underline" ${bulb.fontStyle & STYLE_UNDERLINE ? 'checked' : ''}> Underline</label>
      </div>
    </div>
    <div class="font-preview" id="font-preview">${escapeHtml(bulb.text || 'Sample')}</div>
  `;

  const handle = showModal({
    id: 'font-picker-modal',
    title: 'Font',
    contentClass: 'font-picker-content',
    bodyHtml,
    onOk: modal => {
      const customInput = modal.querySelector('#font-custom') as HTMLInputElement;
      const nameSel = modal.querySelector('#font-name') as HTMLSelectElement;
      const sizeSel = modal.querySelector('#font-size') as HTMLSelectElement;
      const boldChk = modal.querySelector('#font-bold') as HTMLInputElement;
      const italicChk = modal.querySelector('#font-italic') as HTMLInputElement;
      const underlineChk = modal.querySelector('#font-underline') as HTMLInputElement;

      let style = STYLE_REGULAR;
      if (boldChk.checked) style |= STYLE_BOLD;
      if (italicChk.checked) style |= STYLE_ITALIC;
      if (underlineChk.checked) style |= STYLE_UNDERLINE;

      onSave({
        fontName: customInput.value.trim() || nameSel.value,
        fontSize: parseInt(sizeSel.value, 10) || 12,
        fontStyle: style,
      });
    },
  });

  const nameSel = handle.el.querySelector('#font-name') as HTMLSelectElement;
  const customInput = handle.el.querySelector('#font-custom') as HTMLInputElement;
  const sizeSel = handle.el.querySelector('#font-size') as HTMLSelectElement;
  const boldChk = handle.el.querySelector('#font-bold') as HTMLInputElement;
  const italicChk = handle.el.querySelector('#font-italic') as HTMLInputElement;
  const underlineChk = handle.el.querySelector('#font-underline') as HTMLInputElement;
  const preview = handle.el.querySelector('#font-preview') as HTMLElement;

  const updatePreview = (): void => {
    preview.style.fontFamily = `'${customInput.value.trim() || nameSel.value}'`;
    preview.style.fontSize = `${sizeSel.value}px`;
    preview.style.fontWeight = boldChk.checked ? 'bold' : 'normal';
    preview.style.fontStyle = italicChk.checked ? 'italic' : 'normal';
    preview.style.textDecoration = underlineChk.checked ? 'underline' : 'none';
  };
  [nameSel, customInput, sizeSel, boldChk, italicChk, underlineChk].forEach(el => {
    el.addEventListener('input', updatePreview);
    el.addEventListener('change', updatePreview);
  });
  updatePreview();
}
