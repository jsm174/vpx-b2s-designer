import type { DirectB2SData, Color, ReelRollingDirection } from '../types/data';
import {
  DEFAULT_EM_REELS,
  DEFAULT_EM_CREDIT_REELS,
  DEFAULT_LEDS,
  RENDERED_LEDS,
  DEFAULT_REEL_COLOR,
  getRenderedLEDName,
  IMPORTED_START_STRING,
} from '../types/data';
import { showModal, escapeHtml } from './modal';
import { resourcePathForReelImage, reelTypeDisplayName } from './resources';
import { renderDream7Digit } from './dream7';
import { renderLedDigit } from './rendered-led';
import { showLedColorDialog } from './led-color-dialog';

export interface ReelTypeSettings {
  reelTypes: string[];
  reelColor: Color;
  reelRollingDirection: ReelRollingDirection;
  reelRollingInterval: number;
  reelIntermediateImageCount: number;
  useDream7LEDs: boolean;
  d7Glow: number;
  d7Thickness: number;
  d7Shear: number;
}

export interface ReelTypeDialogCallbacks {
  onOk: (settings: ReelTypeSettings) => void;
  onExport?: (reelType: string) => void;
  onDelete?: (reelType: string) => void;
  onImportReelSet?: () => void;
  onImportCreditReelSet?: () => void;
  onImportLEDSet?: () => void;
}

function importedTypesFromData(data: DirectB2SData, prefix: string): string[] {
  const set = new Set<string>();
  for (const t of data.reelTypes) {
    if (t.startsWith(IMPORTED_START_STRING + prefix)) set.add(t);
  }
  for (const s of data.scores) {
    if (s.reelType.startsWith(IMPORTED_START_STRING + prefix)) set.add(s.reelType);
  }
  return Array.from(set);
}

function listCell(reelType: string, selected: boolean, imgSrc: string | null): string {
  const inner = imgSrc
    ? `<img src="${imgSrc}" alt="${escapeHtml(reelType)}">`
    : `<div class="reel-type-text">${escapeHtml(reelType)}</div>`;
  return `<div class="reel-type-cell ${selected ? 'selected' : ''}" data-value="${escapeHtml(reelType)}" tabindex="0">
    ${inner}
    <div class="reel-type-label">${escapeHtml(reelTypeDisplayName(reelType))}</div>
  </div>`;
}

export function showReelTypeDialog(data: DirectB2SData, callbacks: ReelTypeDialogCallbacks): void {
  const selected = new Set<string>(data.reelTypes);
  for (const s of data.scores) if (s.reelType) selected.add(s.reelType);

  const emReels = [...DEFAULT_EM_REELS, ...importedTypesFromData(data, 'EMR_T')];
  const creditReels = [...DEFAULT_EM_CREDIT_REELS, ...importedTypesFromData(data, 'EMR_CT')];
  const leds = [...DEFAULT_LEDS, ...importedTypesFromData(data, 'LED_T')];

  const renderedSelected = new Set<string>();
  for (const t of selected) {
    const name = getRenderedLEDName(t);
    if (name) renderedSelected.add(name);
  }

  let reelColor: Color = data.reelColor ? { ...data.reelColor } : { ...DEFAULT_REEL_COLOR };
  let useDream7 = data.useDream7LEDs;
  let glow = data.d7Glow === 0 ? 9 : data.d7Glow;
  let thickness = data.d7Thickness === 0 ? 14 : data.d7Thickness;
  let shear = data.d7Shear === 0 ? 0.1 : data.d7Shear;
  let digitKey = 0;

  const cells = (types: string[]): string =>
    types
      .map(t => {
        const path = t.startsWith(IMPORTED_START_STRING)
          ? null
          : resourcePathForReelImage(t.endsWith('0') ? t : t + '_0');
        return listCell(t, selected.has(t), path);
      })
      .join('');

  const bodyHtml = `
    <div class="reel-type-dialog">
      <div class="reel-type-column">
        <div class="reel-type-section">
          <div class="reel-type-heading">EM reels</div>
          <div class="reel-type-grid" id="rt-em">${cells(emReels)}</div>
          <div class="reel-type-actions">
            <button class="win-btn" id="rt-import-em">Import reel image set...</button>
            <button class="win-btn" id="rt-export-em">Export reel image set</button>
          </div>
        </div>
        <div class="reel-type-section">
          <div class="reel-type-heading">EM credit reels</div>
          <div class="reel-type-grid" id="rt-credit">${cells(creditReels)}</div>
          <div class="reel-type-actions">
            <button class="win-btn" id="rt-import-credit">Import credit reel set...</button>
            <button class="win-btn" id="rt-export-credit">Export credit reel set</button>
          </div>
        </div>
        <div class="reel-type-section">
          <div class="reel-type-heading">LEDs</div>
          <div class="reel-type-grid" id="rt-led">${cells(leds)}</div>
          <div class="reel-type-actions">
            <button class="win-btn" id="rt-import-led">Import LED image set...</button>
            <button class="win-btn" id="rt-export-led">Export LED image set</button>
          </div>
        </div>
      </div>
      <div class="reel-type-column">
        <div class="reel-type-section">
          <div class="reel-type-heading">Rendered LEDs (press 0-9 to preview a digit)</div>
          <div class="reel-type-grid" id="rt-rendered">
            ${RENDERED_LEDS.map(
              t => `<div class="reel-type-cell rendered ${renderedSelected.has(t) ? 'selected' : ''}" data-value="${t}" tabindex="0">
                <canvas class="rendered-led-preview" data-type="${t.substring(11)}" width="45" height="60"></canvas>
                <div class="reel-type-label">${t.substring(11)} segments</div>
              </div>`
            ).join('')}
          </div>
          <div class="prop-row">
            <input type="checkbox" id="rt-dream7" ${useDream7 ? 'checked' : ''}>
            <label for="rt-dream7" class="prop-label-inline">Use 'Dream7' LEDs</label>
          </div>
          <div class="prop-row">
            <label class="prop-label">Glow</label>
            <input type="range" class="prop-input prop-range" id="rt-glow" min="0" max="25" value="${Math.round(glow)}">
            <span class="prop-range-value" id="rt-glow-v">${Math.round(glow)}</span>
          </div>
          <div class="prop-row">
            <label class="prop-label">Size</label>
            <input type="range" class="prop-input prop-range" id="rt-thick" min="1" max="25" value="${Math.max(1, Math.round(thickness / 2))}">
            <span class="prop-range-value" id="rt-thick-v">${Math.max(1, Math.round(thickness / 2))}</span>
          </div>
          <div class="prop-row">
            <label class="prop-label">Shear</label>
            <input type="range" class="prop-input prop-range" id="rt-shear" min="0" max="25" value="${Math.round(shear * 50)}">
            <span class="prop-range-value" id="rt-shear-v">${Math.round(shear * 50)}</span>
          </div>
          <div class="prop-row prop-row-buttons">
            <button class="prop-btn prop-btn-color" id="rt-color" style="background:rgb(${reelColor.r},${reelColor.g},${reelColor.b})">LED color...</button>
          </div>
        </div>
        <div class="reel-type-section">
          <div class="reel-type-heading">Reel rolling</div>
          <div class="prop-row">
            <label class="prop-label">Direction</label>
            <select class="prop-input" id="rt-direction">
              <option value="Up" ${data.reelRollingDirection === 'Up' ? 'selected' : ''}>Up</option>
              <option value="Down" ${data.reelRollingDirection === 'Down' ? 'selected' : ''}>Down</option>
            </select>
          </div>
          <div class="prop-row">
            <label class="prop-label">Interval (ms)</label>
            <input type="number" class="prop-input" id="rt-interval" min="20" max="200" value="${Math.max(20, data.reelRollingInterval || 20)}">
          </div>
          <div class="prop-row">
            <label class="prop-label">Intermediate images</label>
            <input type="number" class="prop-input" id="rt-intermediates" min="0" max="5" value="${Math.max(0, Math.min(5, data.reelIntermediateImageCount))}">
          </div>
        </div>
      </div>
    </div>
  `;

  const handle = showModal({
    id: 'reel-type-modal',
    title: 'Reels and LEDs',
    contentClass: 'reel-type-content',
    bodyHtml,
    onOk: modal => {
      const types: string[] = [];
      for (const t of [...emReels, ...creditReels, ...leds]) if (selected.has(t)) types.push(t);
      for (const t of RENDERED_LEDS) if (renderedSelected.has(t) && !types.includes(t)) types.push(t);
      for (const s of data.scores) if (s.reelType && !types.includes(s.reelType)) types.push(s.reelType);
      const interval = Math.max(
        20,
        Math.min(200, parseInt((modal.querySelector('#rt-interval') as HTMLInputElement).value, 10) || 20)
      );
      const intermediates = Math.max(
        0,
        Math.min(5, parseInt((modal.querySelector('#rt-intermediates') as HTMLInputElement).value, 10) || 0)
      );
      callbacks.onOk({
        reelTypes: types,
        reelColor,
        reelRollingDirection: (modal.querySelector('#rt-direction') as HTMLSelectElement).value as ReelRollingDirection,
        reelRollingInterval: interval,
        reelIntermediateImageCount: intermediates,
        useDream7LEDs: useDream7,
        d7Glow: glow,
        d7Thickness: thickness,
        d7Shear: shear,
      });
    },
  });

  const el = handle.el;
  const bind = (gridId: string): void => {
    el.querySelectorAll(`#${gridId} .reel-type-cell`).forEach(cell => {
      const value = (cell as HTMLElement).dataset.value!;
      cell.addEventListener('click', () => {
        if (selected.has(value)) selected.delete(value);
        else selected.add(value);
        cell.classList.toggle('selected', selected.has(value));
      });
      cell.addEventListener('dblclick', () => {
        selected.add(value);
        (el.querySelector('[data-modal-action="ok"]') as HTMLButtonElement | null)?.click();
      });
      cell.addEventListener('contextmenu', e => {
        e.preventDefault();
        showCellMenu(e as MouseEvent, value);
      });
    });
  };
  bind('rt-em');
  bind('rt-credit');
  bind('rt-led');

  const showCellMenu = (e: MouseEvent, value: string): void => {
    document.querySelectorAll('.context-menu').forEach(m => m.remove());
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    const add = (label: string, fn: () => void): void => {
      const item = document.createElement('div');
      item.className = 'context-menu-item';
      item.textContent = label;
      item.addEventListener('click', () => {
        menu.remove();
        fn();
      });
      menu.appendChild(item);
    };
    add('Export', () => callbacks.onExport?.(value));
    if (value.startsWith(IMPORTED_START_STRING)) {
      add('Delete', () => {
        if (confirm(`Do you really want to delete ${reelTypeDisplayName(value)}?`)) {
          callbacks.onDelete?.(value);
          selected.delete(value);
          el.querySelector(`.reel-type-cell[data-value="${value}"]`)?.remove();
        }
      });
    }
    document.body.appendChild(menu);
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;
    const closer = (): void => {
      menu.remove();
      document.removeEventListener('click', closer);
    };
    setTimeout(() => document.addEventListener('click', closer), 0);
  };

  el.querySelectorAll('#rt-rendered .reel-type-cell').forEach(cell => {
    const value = (cell as HTMLElement).dataset.value!;
    cell.addEventListener('click', () => {
      if (renderedSelected.has(value)) renderedSelected.delete(value);
      else renderedSelected.add(value);
      cell.classList.toggle('selected', renderedSelected.has(value));
    });
  });

  const segmentsForDigit = (type: string, digit: number): number => {
    const led10 = type === '10';
    const led14 = type === '14';
    switch (digit) {
      case 0:
        return 1 + 2 + 4 + 8 + 16 + 32;
      case 1:
        return led10 ? 256 + 512 : 2 + 4;
      case 2:
        return 1 + 2 + 8 + 16 + 64 + (led14 ? 2048 : 0);
      case 3:
        return 1 + 2 + 4 + 8 + 64 + (led14 ? 2048 - 64 : 0);
      case 4:
        return 2 + 4 + 32 + 64 + (led14 ? 2048 : 0);
      case 5:
        return 1 + 4 + 8 + 32 + 64 + (led14 ? 2048 : 0);
      case 6:
        return 1 + 4 + 8 + 16 + 32 + 64 + (led14 ? 2048 : 0);
      case 7:
        return 1 + 2 + 4;
      case 8:
        return 1 + 2 + 4 + 8 + 16 + 32 + 64 + (led14 ? 2048 : 0);
      case 9:
        return 1 + 2 + 4 + 8 + 32 + 64 + (led14 ? 2048 : 0);
      default:
        return 65535;
    }
  };

  const redrawPreviews = (): void => {
    el.querySelectorAll<HTMLCanvasElement>('.rendered-led-preview').forEach(c => {
      const type = c.dataset.type || '8';
      const ctx = c.getContext('2d')!;
      ctx.clearRect(0, 0, c.width, c.height);
      const segments = segmentsForDigit(type, digitKey);
      const img = useDream7
        ? renderDream7Digit({
            type,
            width: c.width,
            height: c.height,
            reelColor,
            glow,
            shear,
            thickness,
            segments,
          })
        : renderLedDigit(type, reelColor, segments);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, 0, 0, c.width, c.height);
    });
  };

  const dream7Chk = el.querySelector('#rt-dream7') as HTMLInputElement;
  const glowSl = el.querySelector('#rt-glow') as HTMLInputElement;
  const thickSl = el.querySelector('#rt-thick') as HTMLInputElement;
  const shearSl = el.querySelector('#rt-shear') as HTMLInputElement;
  const colorBtn = el.querySelector('#rt-color') as HTMLButtonElement;

  dream7Chk.addEventListener('change', () => {
    useDream7 = dream7Chk.checked;
    redrawPreviews();
  });
  glowSl.addEventListener('input', () => {
    glow = parseInt(glowSl.value, 10) || 0;
    (el.querySelector('#rt-glow-v') as HTMLElement).textContent = glowSl.value;
    redrawPreviews();
  });
  thickSl.addEventListener('input', () => {
    thickness = (parseInt(thickSl.value, 10) || 1) * 2;
    (el.querySelector('#rt-thick-v') as HTMLElement).textContent = thickSl.value;
    redrawPreviews();
  });
  shearSl.addEventListener('input', () => {
    shear = (parseInt(shearSl.value, 10) || 0) / 50;
    (el.querySelector('#rt-shear-v') as HTMLElement).textContent = shearSl.value;
    redrawPreviews();
  });
  colorBtn.addEventListener('click', () => {
    showLedColorDialog({
      initial: reelColor,
      onPreview: c => {
        reelColor = c;
        colorBtn.style.background = `rgb(${c.r},${c.g},${c.b})`;
        redrawPreviews();
      },
      onOk: c => {
        reelColor = c;
        redrawPreviews();
      },
      onCancel: c => {
        reelColor = c;
        colorBtn.style.background = `rgb(${c.r},${c.g},${c.b})`;
        redrawPreviews();
      },
    });
  });

  const onKey = (e: KeyboardEvent): void => {
    if (!document.body.contains(el)) {
      document.removeEventListener('keydown', onKey);
      return;
    }
    if (e.target instanceof HTMLInputElement && e.target.type !== 'range') return;
    if (e.key >= '0' && e.key <= '9') {
      digitKey = parseInt(e.key, 10);
      redrawPreviews();
    }
  };
  document.addEventListener('keydown', onKey);

  el.querySelector('#rt-import-em')?.addEventListener('click', () => callbacks.onImportReelSet?.());
  el.querySelector('#rt-import-credit')?.addEventListener('click', () => callbacks.onImportCreditReelSet?.());
  el.querySelector('#rt-import-led')?.addEventListener('click', () => callbacks.onImportLEDSet?.());
  const exportSelected = (gridId: string): void => {
    const cell = el.querySelector(`#${gridId} .reel-type-cell.selected`) as HTMLElement | null;
    if (cell?.dataset.value) callbacks.onExport?.(cell.dataset.value);
  };
  el.querySelector('#rt-export-em')?.addEventListener('click', () => exportSelected('rt-em'));
  el.querySelector('#rt-export-credit')?.addEventListener('click', () => exportSelected('rt-credit'));
  el.querySelector('#rt-export-led')?.addEventListener('click', () => exportSelected('rt-led'));

  redrawPreviews();
}
