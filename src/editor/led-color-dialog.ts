import type { Color } from '../types/data';
import { showModal } from './modal';

let lastChosenColor: Color | null = null;

export interface ColorDialogOptions {
  title?: string;
  initial: Color;
  useLastColor?: boolean;
  onPreview: (color: Color) => void;
  onOk: (color: Color) => void;
  onCancel: (original: Color) => void;
}

function toHex(c: Color): string {
  return [c.r, c.g, c.b]
    .map(v =>
      Math.max(0, Math.min(255, Math.round(v)))
        .toString(16)
        .padStart(2, '0')
    )
    .join('');
}

function fromHex(hex: string): Color | null {
  const m = /^([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  return {
    r: parseInt(m[1].substring(0, 2), 16),
    g: parseInt(m[1].substring(2, 4), 16),
    b: parseInt(m[1].substring(4, 6), 16),
    a: 255,
  };
}

export function showLedColorDialog(opts: ColorDialogOptions): void {
  const original: Color = { ...opts.initial };
  const start: Color = opts.useLastColor && lastChosenColor ? { ...lastChosenColor } : { ...opts.initial };
  const current: Color = { ...start };

  const bar = (ch: 'r' | 'g' | 'b', label: string): string => `
    <div class="colorbar-row">
      <span class="colorbar-label">${label}</span>
      <input type="range" class="colorbar-slider" id="cb-${ch}" min="0" max="255" value="${current[ch]}">
      <input type="number" class="prop-input colorbar-num" id="cbn-${ch}" min="0" max="255" value="${current[ch]}">
    </div>`;

  const bodyHtml = `
    <div class="prop-group colorbar">
      ${bar('r', 'R')}
      ${bar('g', 'G')}
      ${bar('b', 'B')}
      <div class="colorbar-row">
        <span class="colorbar-label">Hex</span>
        <input type="text" class="prop-input colorbar-hex" id="cb-hex" maxlength="6" value="${toHex(current)}">
        <span class="colorbar-preview" id="cb-preview"></span>
      </div>
    </div>
  `;

  let okPressed = false;
  const handle = showModal({
    id: 'led-color-modal',
    title: opts.title || 'Set LED color',
    contentClass: 'led-color-content',
    bodyHtml,
    onOk: () => {
      okPressed = true;
      lastChosenColor = { ...current };
      opts.onOk({ ...current });
    },
    onClose: () => {
      if (!okPressed) opts.onCancel(original);
    },
  });

  const el = handle.el;
  const sliders = {
    r: el.querySelector('#cb-r'),
    g: el.querySelector('#cb-g'),
    b: el.querySelector('#cb-b'),
  } as Record<'r' | 'g' | 'b', HTMLInputElement>;
  const nums = {
    r: el.querySelector('#cbn-r'),
    g: el.querySelector('#cbn-g'),
    b: el.querySelector('#cbn-b'),
  } as Record<'r' | 'g' | 'b', HTMLInputElement>;
  const hex = el.querySelector('#cb-hex') as HTMLInputElement;
  const preview = el.querySelector('#cb-preview') as HTMLElement;

  const refresh = (source: 'slider' | 'num' | 'hex'): void => {
    for (const ch of ['r', 'g', 'b'] as const) {
      if (source !== 'slider') sliders[ch].value = String(current[ch]);
      if (source !== 'num') nums[ch].value = String(current[ch]);
      sliders[ch].style.background = `linear-gradient(to right, ${gradientStart(ch)}, ${gradientEnd(ch)})`;
    }
    if (source !== 'hex') hex.value = toHex(current);
    preview.style.background = `rgb(${current.r},${current.g},${current.b})`;
    opts.onPreview({ ...current });
  };

  const gradientStart = (ch: 'r' | 'g' | 'b'): string => {
    const c = { ...current, [ch]: 0 };
    return `rgb(${c.r},${c.g},${c.b})`;
  };
  const gradientEnd = (ch: 'r' | 'g' | 'b'): string => {
    const c = { ...current, [ch]: 255 };
    return `rgb(${c.r},${c.g},${c.b})`;
  };

  for (const ch of ['r', 'g', 'b'] as const) {
    sliders[ch].addEventListener('input', () => {
      current[ch] = parseInt(sliders[ch].value, 10) || 0;
      refresh('slider');
    });
    nums[ch].addEventListener('input', () => {
      current[ch] = Math.max(0, Math.min(255, parseInt(nums[ch].value, 10) || 0));
      refresh('num');
    });
  }
  hex.addEventListener('input', () => {
    const c = fromHex(hex.value.padStart(6, '0'));
    if (c) {
      current.r = c.r;
      current.g = c.g;
      current.b = c.b;
      refresh('hex');
    }
  });

  refresh('hex');
}
