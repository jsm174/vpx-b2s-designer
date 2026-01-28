import { createPlatform, getPlatform } from '../platform';
import { parseDirectB2S } from '../format/parser';
import { writeDirectB2S } from '../format/writer';
import { state, elements, initElements, resetState, markClean, markDirty, updateNextIds } from './state';
import type { Animation } from '../types/data';
import {
  render,
  requestRender,
  resizeCanvas,
  zoomToFit,
  setZoom,
  zoomIn,
  zoomOut,
  updateFileDisplay,
  invalidateColorCache,
} from './canvas-renderer';
import { setupCanvasEvents } from './canvas-events';
import { clearSelection } from './selection';
import { updatePropertiesPanel, updateAllLists } from './properties-panel';
import { createBulb, createScore, deleteSelected, duplicateSelected } from './object-operations';
import { undoManager } from './undo';
import { addCallback, invokeCallback } from '../shared/callbacks';
import { initPanelResize, loadPanelSettings } from './panel-resize';
import { defaultEditorSettings, type EditorSettings } from '../features/settings/shared/component';
import { initResizeComponent, type ResizeSettings, type ResizeElements } from '../features/resize/shared/component';
import {
  initBrightnessComponent,
  applyBrightnessToImageData,
  type BrightnessSettings,
  type BrightnessElements,
} from '../features/brightness/shared/component';
import { applyTheme } from '../shared/theme';
import './parts';
import { clearBulbImageCache } from './parts/bulb';
import { initConsole, appendConsoleLine } from './console-panel';
import { initResourcesPanel } from './resources-panel';

async function getEditorSettings(): Promise<EditorSettings> {
  if (!window.vpxB2sDesignerAPI) return defaultEditorSettings;
  const settings = await window.vpxB2sDesignerAPI.getSettings();
  return {
    theme: settings.theme || defaultEditorSettings.theme,
  };
}

function createResizeHTML(width: number, height: number): string {
  return `
    <div class="modal-header">Resize Image</div>
    <div class="modal-body">
      <div class="resize-info">
        Current size: ${width} × ${height}
      </div>

      <div class="resize-mode-group">
        <label class="resize-radio">
          <input type="radio" name="resize-mode" id="resize-mode-percentage" value="percentage" checked>
          <span>By Percentage</span>
        </label>
        <label class="resize-radio">
          <input type="radio" name="resize-mode" id="resize-mode-absolute" value="absolute">
          <span>By Absolute Size</span>
        </label>
      </div>

      <div class="resize-section" id="percentage-section">
        <div class="settings-field-row">
          <label>Percentage</label>
          <input type="number" id="resize-percentage" class="win-input" value="100" min="1" max="200" style="width: 80px;">
          <span>%</span>
        </div>
      </div>

      <div class="resize-section hidden" id="absolute-section">
        <div class="settings-field-row">
          <label>Width</label>
          <input type="number" id="resize-width" class="win-input" value="${width}" min="1" max="${width * 2}" style="width: 100px;">
          <span>px</span>
        </div>
        <div class="settings-field-row">
          <label>Height</label>
          <input type="number" id="resize-height" class="win-input" value="${height}" min="1" max="${height * 2}" style="width: 100px;">
          <span>px</span>
        </div>
        <label class="settings-checkbox-row">
          <input type="checkbox" id="resize-aspect-ratio" checked>
          <span>Maintain aspect ratio</span>
        </label>
      </div>
    </div>

    <div class="modal-footer">
      <button class="win-btn" id="resize-cancel">Cancel</button>
      <button class="win-btn primary" id="resize-ok">OK</button>
    </div>
  `;
}

function getResizeElements(container: HTMLElement): ResizeElements {
  return {
    percentageRadio: container.querySelector('#resize-mode-percentage') as HTMLInputElement,
    absoluteRadio: container.querySelector('#resize-mode-absolute') as HTMLInputElement,
    percentageSection: container.querySelector('#percentage-section') as HTMLDivElement,
    absoluteSection: container.querySelector('#absolute-section') as HTMLDivElement,
    percentageInput: container.querySelector('#resize-percentage') as HTMLInputElement,
    widthInput: container.querySelector('#resize-width') as HTMLInputElement,
    heightInput: container.querySelector('#resize-height') as HTMLInputElement,
    aspectRatioCheckbox: container.querySelector('#resize-aspect-ratio') as HTMLInputElement,
    okBtn: container.querySelector('#resize-ok') as HTMLButtonElement,
    cancelBtn: container.querySelector('#resize-cancel') as HTMLButtonElement,
  };
}

function showResizeModal(): void {
  const image = state.activeTab === 'dmd' ? state.dmdImage : state.backgroundImage;
  if (!image) {
    appendConsoleLine('No image to resize', 'warn');
    return;
  }

  const width = image.naturalWidth;
  const height = image.naturalHeight;

  const api = window.vpxB2sDesignerAPI as { openResize?: (w: number, h: number) => void } | undefined;
  if (api?.openResize) {
    api.openResize(width, height);
    return;
  }

  const modal = document.getElementById('resize-modal');
  const content = document.getElementById('resize-content');
  if (!modal || !content) return;

  content.innerHTML = createResizeHTML(width, height);

  initResizeComponent(getResizeElements(content), width, height, {
    onResize: settings => {
      modal.classList.add('hidden');
      performResize(settings);
    },
    onCancel: () => {
      modal.classList.add('hidden');
    },
  });

  modal.classList.remove('hidden');
}

async function performResize(settings: ResizeSettings): Promise<void> {
  const { originalWidth, originalHeight, newWidth, newHeight } = settings;

  if (newWidth === originalWidth && newHeight === originalHeight) {
    return;
  }

  const parent: 'Backglass' | 'DMD' = state.activeTab === 'dmd' ? 'DMD' : 'Backglass';
  const scaleX = newWidth / originalWidth;
  const scaleY = newHeight / originalHeight;

  undoManager.beginUndo('Resize image');
  undoManager.markAllBulbsForUndo(parent);
  undoManager.markAllScoresForUndo(parent);
  undoManager.markImagesForUndo();

  for (const bulb of state.currentData.illumination) {
    if (bulb.parent !== parent) continue;
    bulb.locX = Math.round(bulb.locX * scaleX);
    bulb.locY = Math.round(bulb.locY * scaleY);
    bulb.width = Math.round(bulb.width * scaleX);
    bulb.height = Math.round(bulb.height * scaleY);
  }

  for (const score of state.currentData.scores) {
    if (score.parent !== parent) continue;
    score.locX = Math.round(score.locX * scaleX);
    score.locY = Math.round(score.locY * scaleY);
    score.width = Math.round(score.width * scaleX);
    score.height = Math.round(score.height * scaleY);
  }

  try {
    const imageKey = parent === 'DMD' ? 'dmdImages' : 'backgroundImages';
    const images = state.currentData.images[imageKey];

    if (images.length > 0) {
      const imageData = images[0].imageData;
      const { resizedData, resizedImage } = await resizeImageData(imageData, newWidth, newHeight);
      images[0].imageData = resizedData;

      if (parent === 'DMD') {
        state.dmdImage = resizedImage;
      } else {
        state.backgroundImage = resizedImage;
        clearBulbImageCache();
      }
    }

    undoManager.endUndo();
    markDirty();
    zoomToFit();
    updateAllLists();
    updatePropertiesPanel();
    appendConsoleLine(`Resized ${parent.toLowerCase()} image to ${newWidth}×${newHeight}`, 'info');
  } catch (err) {
    undoManager.cancelUndo();
    appendConsoleLine(`Failed to resize image: ${err}`, 'error');
  }
}

async function resizeImageData(
  base64Data: string,
  newWidth: number,
  newHeight: number
): Promise<{ resizedData: string; resizedImage: HTMLImageElement }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = newWidth;
      canvas.height = newHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, newWidth, newHeight);

      const resizedData = canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');

      const resizedImage = new Image();
      resizedImage.onload = () => resolve({ resizedData, resizedImage });
      resizedImage.onerror = () => reject(new Error('Failed to load resized image'));
      resizedImage.src = canvas.toDataURL('image/png');
    };
    img.onerror = () => reject(new Error('Failed to load original image'));
    img.src = `data:image/png;base64,${base64Data}`;
  });
}

function createBrightnessHTML(): string {
  return `
    <div class="modal-header">Brightness</div>
    <div class="modal-body">
      <div class="brightness-preview-container">
        <canvas id="brightness-preview" width="280" height="200"></canvas>
      </div>

      <div class="brightness-controls">
        <div class="brightness-slider-row">
          <input type="range" id="brightness-slider" min="-100" max="100" value="0">
          <input type="number" id="brightness-number" class="win-input" value="0" min="-100" max="100" style="width: 60px; text-align: center;">
        </div>

        <label class="brightness-checkbox-row" id="ignore-grill-row">
          <input type="checkbox" id="brightness-ignore-grill" checked>
          <span>Ignore grill area</span>
        </label>
      </div>
    </div>

    <div class="modal-footer">
      <button class="win-btn" id="brightness-cancel">Cancel</button>
      <button class="win-btn primary" id="brightness-ok">OK</button>
    </div>
  `;
}

function getBrightnessElements(container: HTMLElement): BrightnessElements {
  return {
    slider: container.querySelector('#brightness-slider') as HTMLInputElement,
    numberInput: container.querySelector('#brightness-number') as HTMLInputElement,
    ignoreGrillCheckbox: container.querySelector('#brightness-ignore-grill') as HTMLInputElement,
    preview: container.querySelector('#brightness-preview') as HTMLCanvasElement,
    okBtn: container.querySelector('#brightness-ok') as HTMLButtonElement,
    cancelBtn: container.querySelector('#brightness-cancel') as HTMLButtonElement,
  };
}

function showBrightnessModal(): void {
  const image = state.activeTab === 'dmd' ? state.dmdImage : state.backgroundImage;
  if (!image) {
    appendConsoleLine('No image to adjust brightness', 'warn');
    return;
  }

  const isDmd = state.activeTab === 'dmd';
  const grillHeight = isDmd ? 0 : state.currentData.grillHeight;

  interface BrightnessInitData {
    imageData: string;
    width: number;
    height: number;
    grillHeight: number;
    isDmd: boolean;
  }

  const api = window.vpxB2sDesignerAPI as { openBrightness?: (data: BrightnessInitData) => void } | undefined;
  if (api?.openBrightness) {
    const imageKey = isDmd ? 'dmdImages' : 'backgroundImages';
    const images = state.currentData.images[imageKey];
    if (images.length > 0) {
      api.openBrightness({
        imageData: images[0].imageData,
        width: image.naturalWidth,
        height: image.naturalHeight,
        grillHeight,
        isDmd,
      });
    }
    return;
  }

  const modal = document.getElementById('brightness-modal');
  const content = document.getElementById('brightness-content');
  if (!modal || !content) return;

  content.innerHTML = createBrightnessHTML();

  const ignoreGrillRow = content.querySelector('#ignore-grill-row') as HTMLElement;
  if (ignoreGrillRow) {
    ignoreGrillRow.style.display = grillHeight > 0 && !isDmd ? '' : 'none';
  }

  initBrightnessComponent(getBrightnessElements(content), image, grillHeight, isDmd, {
    onApply: settings => {
      modal.classList.add('hidden');
      performBrightness(settings);
    },
    onCancel: () => {
      modal.classList.add('hidden');
    },
  });

  modal.classList.remove('hidden');
}

async function performBrightness(settings: BrightnessSettings): Promise<void> {
  const { brightness, ignoreGrill } = settings;

  if (brightness === 0) {
    return;
  }

  const isDmd = state.activeTab === 'dmd';
  const grillHeight = ignoreGrill && !isDmd ? state.currentData.grillHeight : 0;

  undoManager.beginUndo('Adjust brightness');
  undoManager.markImagesForUndo();

  try {
    const imageKey = isDmd ? 'dmdImages' : 'backgroundImages';
    const images = state.currentData.images[imageKey];

    if (images.length > 0) {
      const { adjustedData, adjustedImage } = await adjustBrightnessImageData(
        images[0].imageData,
        brightness,
        grillHeight
      );
      images[0].imageData = adjustedData;

      if (isDmd) {
        state.dmdImage = adjustedImage;
      } else {
        state.backgroundImage = adjustedImage;
        clearBulbImageCache();
      }
    }

    undoManager.endUndo();
    markDirty();
    render();
    updatePropertiesPanel();
    appendConsoleLine(`Adjusted brightness by ${brightness}%`, 'info');
  } catch (err) {
    undoManager.cancelUndo();
    appendConsoleLine(`Failed to adjust brightness: ${err}`, 'error');
  }
}

async function adjustBrightnessImageData(
  base64Data: string,
  brightness: number,
  grillHeight: number
): Promise<{ adjustedData: string; adjustedImage: HTMLImageElement }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      applyBrightnessToImageData(imageData, brightness, grillHeight);
      ctx.putImageData(imageData, 0, 0);

      const adjustedData = canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');

      const adjustedImage = new Image();
      adjustedImage.onload = () => resolve({ adjustedData, adjustedImage });
      adjustedImage.onerror = () => reject(new Error('Failed to load adjusted image'));
      adjustedImage.src = canvas.toDataURL('image/png');
    };
    img.onerror = () => reject(new Error('Failed to load original image'));
    img.src = `data:image/png;base64,${base64Data}`;
  });
}

function setupModals(): void {
  const resizeModal = document.getElementById('resize-modal');
  const brightnessModal = document.getElementById('brightness-modal');

  resizeModal?.querySelector('.modal-backdrop')?.addEventListener('click', () => {
    resizeModal?.classList.add('hidden');
  });

  brightnessModal?.querySelector('.modal-backdrop')?.addEventListener('click', () => {
    brightnessModal?.classList.add('hidden');
  });
}

function setInputDisabled(disabled: boolean): void {
  const app = document.getElementById('app');
  if (app) {
    app.style.pointerEvents = disabled ? 'none' : '';
  }
}

function setUIEnabled(enabled: boolean): void {
  const toolbar = document.getElementById('toolbar');
  if (toolbar) {
    toolbar.querySelectorAll('button').forEach(btn => {
      if (btn.id === 'hamburger-btn') return;
      btn.disabled = !enabled;
    });
    toolbar.querySelectorAll('select').forEach(sel => {
      (sel as HTMLSelectElement).disabled = !enabled;
    });
  }

  const addAnimBtn = document.getElementById('btn-add-animation');
  if (addAnimBtn) (addAnimBtn as HTMLButtonElement).disabled = !enabled;

  state.hasFile = enabled;
  window.dispatchEvent(new CustomEvent('update-menu-state', { detail: { hasFile: enabled } }));

  if (enabled) {
    updateLampFilterDropdown();
    syncCurrentImageDropdown();
  }

  syncToggleButtons();
  syncUndoRedoButtons();
}

function setupToolbarControls(): void {
  const lampFilter = document.getElementById('lamp-filter') as HTMLSelectElement | null;
  const currentImage = document.getElementById('current-image') as HTMLSelectElement | null;

  lampFilter?.addEventListener('change', () => {
    state.lampFilter = lampFilter.value;
    render();
    updateAllLists();
    appendConsoleLine(`Lamp filter: ${lampFilter.value}`, 'info');
  });

  currentImage?.addEventListener('change', () => {
    const tab = currentImage.value as 'backglass' | 'dmd';
    switchTab(tab);
  });
}

function getRomIdString(romIdType: string, romId: number, romInverted: boolean): string {
  let prefix = romInverted ? 'I' : '';
  switch (romIdType) {
    case 'Lamp':
      prefix += 'L';
      break;
    case 'Solenoid':
      prefix += 'S';
      break;
    case 'GIString':
      prefix += 'GI';
      break;
    default:
      prefix += 'L';
  }
  return `${prefix}${romId}`;
}

function updateLampFilterDropdown(): void {
  const lampFilter = document.getElementById('lamp-filter') as HTMLSelectElement | null;
  if (!lampFilter) return;

  const existingDynamic = lampFilter.querySelectorAll('option[data-dynamic]');
  existingDynamic.forEach(opt => opt.remove());

  const parentFilter = state.activeTab === 'dmd' ? 'DMD' : 'Backglass';
  const romIdCounts = new Map<string, { type: string; id: number; inverted: boolean; count: number }>();

  state.currentData.illumination
    .filter(b => b.parent === parentFilter)
    .forEach(b => {
      if (b.romId && b.romId > 0) {
        const key = getRomIdString(b.romIdType, b.romId, b.romInverted);
        const existing = romIdCounts.get(key);
        if (existing) {
          existing.count++;
        } else {
          romIdCounts.set(key, { type: b.romIdType, id: b.romId, inverted: b.romInverted, count: 1 });
        }
      }
    });

  const sortedEntries = Array.from(romIdCounts.entries()).sort((a, b) => {
    const aInv = a[1].inverted ? 1 : 0;
    const bInv = b[1].inverted ? 1 : 0;
    if (aInv !== bInv) return aInv - bInv;
    const typeOrder: Record<string, number> = { Lamp: 0, Solenoid: 1, GIString: 2 };
    const aTypeOrder = typeOrder[a[1].type] ?? 3;
    const bTypeOrder = typeOrder[b[1].type] ?? 3;
    if (aTypeOrder !== bTypeOrder) return aTypeOrder - bTypeOrder;
    return a[1].id - b[1].id;
  });

  sortedEntries.forEach(([key, data]) => {
    const opt = document.createElement('option');
    opt.value = `rom-${data.inverted ? 'I' : ''}${data.type}-${data.id}`;
    opt.textContent = `${key} (${data.count})`;
    opt.dataset.dynamic = 'true';
    lampFilter.appendChild(opt);
  });
}

function syncCurrentImageDropdown(): void {
  const currentImage = document.getElementById('current-image') as HTMLSelectElement | null;
  if (currentImage) {
    currentImage.value = state.activeTab;
  }
}

async function init(): Promise<void> {
  await createPlatform();

  initElements();
  setupCanvasEvents();
  setupWindowListeners();
  setupApiListeners();
  setupMenuActions();
  setupToolbarControls();
  setupCallbacks();
  setupModals();

  initPanelResize(resizeCanvas);
  initResourcesPanel();
  await loadPanelSettings();

  const settings = await getEditorSettings();
  applyTheme(settings.theme);

  if (window.vpxB2sDesignerAPI) {
    const appSettings = await window.vpxB2sDesignerAPI.getSettings();
    if (appSettings.showScoreFrames !== undefined) {
      state.showScoreFrames = appSettings.showScoreFrames;
    }
  }

  resizeCanvas();
  setUIEnabled(false);
  await initConsole();

  await checkPendingFile();
}

function setupWindowListeners(): void {
  window.addEventListener('resize', resizeCanvas);

  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
        invalidateColorCache();
        render();
        break;
      }
    }
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

function handleAnimationSaved(animationData: unknown, isNew: boolean): void {
  const animation = animationData as Animation;
  if (!animation || !animation.name) return;

  undoManager.beginUndo(isNew ? 'Add animation' : 'Edit animation');
  undoManager.markAnimationsForUndo();

  if (isNew) {
    state.currentData.animations.push(animation);
  } else {
    const idx = state.currentData.animations.findIndex(a => a.name === animation.name);
    if (idx >= 0) {
      state.currentData.animations[idx] = animation;
    } else {
      state.currentData.animations.push(animation);
    }
  }

  undoManager.endUndo();
  markDirty();
  updateAllLists();
}

function handleAnimationDeleted(name: string): void {
  const idx = state.currentData.animations.findIndex(a => a.name === name);
  if (idx < 0) return;

  undoManager.beginUndo('Delete animation');
  undoManager.markAnimationsForUndo();
  state.currentData.animations.splice(idx, 1);
  undoManager.endUndo();
  markDirty();
  updateAllLists();
}

async function checkPendingFile(): Promise<void> {
  const api = window.vpxB2sDesignerAPI as unknown as {
    getPendingFile?: () => Promise<{ path: string; content: string } | null>;
    getPendingNewFile?: () => Promise<boolean>;
  };
  if (api?.getPendingFile) {
    const file = await api.getPendingFile();
    if (file) {
      await loadFile(file.path, file.content);
      return;
    }
  }
  if (api?.getPendingNewFile) {
    const isNew = await api.getPendingNewFile();
    if (isNew) {
      newFile();
    }
  }
}

function setupApiListeners(): void {
  if (window.vpxB2sDesignerAPI) {
    window.vpxB2sDesignerAPI.onFileOpened(async data => {
      await loadFile(data.path, data.content);
    });

    const extApi = window.vpxB2sDesignerAPI as unknown as { onFileReady?: (cb: () => void) => void };
    extApi.onFileReady?.(() => {
      checkPendingFile();
    });

    window.vpxB2sDesignerAPI.onNewFile(() => {
      newFile();
    });

    window.vpxB2sDesignerAPI.onSaveRequested(() => {
      saveFile();
    });

    (window.vpxB2sDesignerAPI as { onThemeChanged?: (cb: (theme: string) => void) => void }).onThemeChanged?.(
      (theme: string) => {
        applyTheme(theme);
      }
    );

    window.vpxB2sDesignerAPI.onSaveBeforeClose?.(() => {
      saveFile().then(() => {
        window.vpxB2sDesignerAPI.closeAfterSave?.();
      });
    });

    (
      window.vpxB2sDesignerAPI as {
        onAnimationSaved?: (cb: (data: { animation: unknown; isNew: boolean }) => void) => void;
      }
    ).onAnimationSaved?.(data => {
      handleAnimationSaved(data.animation, data.isNew);
    });

    (
      window.vpxB2sDesignerAPI as { onAnimationDeleted?: (cb: (data: { name: string }) => void) => void }
    ).onAnimationDeleted?.(data => {
      handleAnimationDeleted(data.name);
    });

    (
      window.vpxB2sDesignerAPI as { onResizeResult?: (cb: (settings: ResizeSettings) => void) => void }
    ).onResizeResult?.(settings => {
      performResize(settings);
    });

    (
      window.vpxB2sDesignerAPI as { onBrightnessResult?: (cb: (settings: BrightnessSettings) => void) => void }
    ).onBrightnessResult?.(settings => {
      performBrightness(settings);
    });

    (window.vpxB2sDesignerAPI as { onMenuAction?: (cb: (action: string) => void) => void }).onMenuAction?.(action => {
      handleMenuAction(action);
    });

    (
      window.vpxB2sDesignerAPI as { onSetInputDisabled?: (cb: (disabled: boolean) => void) => void }
    ).onSetInputDisabled?.(disabled => {
      setInputDisabled(disabled);
    });
  }

  window.addEventListener('animation-saved', ((e: CustomEvent) => {
    handleAnimationSaved(e.detail.animation, e.detail.isNew);
  }) as EventListener);

  window.addEventListener('animation-deleted', ((e: CustomEvent) => {
    handleAnimationDeleted(e.detail.name);
  }) as EventListener);

  window.addEventListener('open-animation-editor', ((e: CustomEvent) => {
    const { animation, isNew } = e.detail || {};
    const api = window.vpxB2sDesignerAPI as unknown as { openAnimationEditor?: (a: unknown, n: boolean) => void };
    if (api?.openAnimationEditor) {
      api.openAnimationEditor(animation, isNew ?? true);
    }
  }) as EventListener);

  window.addEventListener('close-file', () => {
    closeFile();
  });
}

function setupMenuActions(): void {
  window.addEventListener('menu-action', ((e: CustomEvent) => {
    const action = e.detail;
    handleMenuAction(action);
  }) as EventListener);

  document.getElementById('btn-undo')?.addEventListener('click', () => {
    undoManager.undo();
    render();
    updatePropertiesPanel();
    updateAllLists();
  });
  document.getElementById('btn-redo')?.addEventListener('click', () => {
    undoManager.redo();
    render();
    updatePropertiesPanel();
    updateAllLists();
  });
  document.getElementById('btn-add-bulb')?.addEventListener('click', () => {
    if (!state.showIlluminationFrames) {
      state.showIlluminationFrames = true;
      syncToggleButtons();
      window.dispatchEvent(new CustomEvent('update-menu-state', { detail: { showIlluminationFrames: true } }));
    }
    createBulb();
  });
  document.getElementById('btn-add-score')?.addEventListener('click', () => {
    if (!state.showScoreFrames) {
      state.showScoreFrames = true;
      state.showScoring = true;
      syncToggleButtons();
      window.dispatchEvent(
        new CustomEvent('update-menu-state', { detail: { showScoreFrames: true, showScoring: true } })
      );
    }
    createScore();
  });
  document.getElementById('btn-add-animation')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('open-animation-editor', { detail: { animation: null, isNew: true } }));
  });

  document.getElementById('btn-show-score-frames')?.addEventListener('click', () => {
    toggleScoreFrames();
  });

  document.getElementById('btn-show-scoring')?.addEventListener('click', () => {
    toggleScoring();
  });

  document.getElementById('btn-show-illumination-frames')?.addEventListener('click', () => {
    toggleIlluminationFrames();
  });

  document.getElementById('btn-show-illumination')?.addEventListener('click', () => {
    if (!state.showIlluminationIntensity) {
      toggleIllumination();
    }
  });

  document.getElementById('btn-show-illumination-intensity')?.addEventListener('click', () => {
    if (!state.showIllumination) {
      toggleIlluminationIntensity();
    }
  });

  document.getElementById('zoom-in')?.addEventListener('click', zoomIn);
  document.getElementById('zoom-out')?.addEventListener('click', zoomOut);
  document.getElementById('zoom-home')?.addEventListener('click', zoomToFit);
}

function handleMenuAction(action: string): void {
  switch (action) {
    case 'undo':
      undoManager.undo();
      render();
      updatePropertiesPanel();
      updateAllLists();
      break;
    case 'redo':
      undoManager.redo();
      render();
      updatePropertiesPanel();
      updateAllLists();
      break;
    case 'add-bulb':
      if (!state.showIlluminationFrames) {
        state.showIlluminationFrames = true;
        syncToggleButtons();
        window.dispatchEvent(new CustomEvent('update-menu-state', { detail: { showIlluminationFrames: true } }));
      }
      createBulb();
      break;
    case 'add-score':
      if (!state.showScoreFrames) {
        state.showScoreFrames = true;
        state.showScoring = true;
        syncToggleButtons();
        window.dispatchEvent(
          new CustomEvent('update-menu-state', { detail: { showScoreFrames: true, showScoring: true } })
        );
      }
      createScore();
      break;
    case 'delete':
      deleteSelected();
      break;
    case 'duplicate':
      duplicateSelected();
      break;
    case 'select-all':
      for (const bulb of state.currentData.illumination) {
        state.selectedBulbIds.add(bulb.id);
      }
      for (const score of state.currentData.scores) {
        state.selectedScoreIds.add(score.id);
      }
      render();
      updatePropertiesPanel();
      updateAllLists();
      break;
    case 'deselect':
      clearSelection();
      render();
      updatePropertiesPanel();
      updateAllLists();
      break;
    case 'zoom-in':
      zoomIn();
      break;
    case 'zoom-out':
      zoomOut();
      break;
    case 'zoom-100':
      setZoom(1);
      break;
    case 'zoom-fit':
      zoomToFit();
      break;
    case 'add-animation':
      window.dispatchEvent(new CustomEvent('open-animation-editor', { detail: { animation: null, isNew: true } }));
      break;
    case 'show-backglass-tab':
      switchTab('backglass');
      break;
    case 'show-dmd-tab':
      switchTab('dmd');
      break;
    case 'import-backglass-image':
      importBackglassImage();
      break;
    case 'import-illumination-image':
      importIlluminationImage();
      break;
    case 'import-dmd-image':
      importDmdImage();
      break;
    case 'copy-dmd-from-backglass':
      toggleCopyDmdFromBackglass();
      break;
    case 'set-default-dmd-location':
      toggleSetDmdDefaultLocation();
      break;
    case 'resize-image':
      showResizeModal();
      break;
    case 'adjust-brightness':
      showBrightnessModal();
      break;
    case 'choose-reel-type':
      break;
    case 'set-grill-height':
      toggleSetGrillHeight();
      break;
    case 'set-mini-grill-height':
      toggleSetSmallGrillHeight();
      break;
    case 'toggle-score-frames':
      toggleScoreFrames();
      break;
    case 'toggle-scoring':
      toggleScoring();
      break;
    case 'toggle-illumination-frames':
      toggleIlluminationFrames();
      break;
    case 'toggle-illumination':
      if (!state.showIlluminationIntensity) {
        toggleIllumination();
      }
      break;
    case 'toggle-illumination-intensity':
      if (!state.showIllumination) {
        toggleIlluminationIntensity();
      }
      break;
    case 'select-all-illumination':
    case 'add-illumination-snippet':
    case 'manage-animations':
    case 'trim-all-snippets':
    case 'backglass-preview':
    case 'export-dark-backglass':
    case 'export-illuminated-backglass':
    case 'create-directb2s':
    case 'toggle-resources-panel':
    case 'toggle-reels-panel':
    case 'toggle-illumination-panel':
    case 'toggle-translucent':
      appendConsoleLine(`Action not yet implemented: ${action}`, 'warn');
      break;
  }
}

function toggleScoreFrames(): void {
  state.showScoreFrames = !state.showScoreFrames;
  if (state.showScoreFrames) {
    state.showScoring = true;
  } else {
    state.selectedScoreIds.clear();
    if (state.primarySelection?.type === 'score') {
      state.primarySelection = null;
    }
    updatePropertiesPanel();
    updateAllLists();
  }
  syncToggleButtons();
  window.dispatchEvent(
    new CustomEvent('update-menu-state', {
      detail: { showScoreFrames: state.showScoreFrames, showScoring: state.showScoring },
    })
  );
  if (window.vpxB2sDesignerAPI) {
    window.vpxB2sDesignerAPI.saveSettings({ showScoreFrames: state.showScoreFrames });
  }
  render();
}

function toggleScoring(): void {
  state.showScoring = !state.showScoring;
  if (!state.showScoring) {
    state.showScoreFrames = false;
  }
  syncToggleButtons();
  window.dispatchEvent(
    new CustomEvent('update-menu-state', {
      detail: { showScoring: state.showScoring, showScoreFrames: state.showScoreFrames },
    })
  );
  render();
}

function toggleIlluminationFrames(): void {
  state.showIlluminationFrames = !state.showIlluminationFrames;
  if (!state.showIlluminationFrames) {
    state.selectedBulbIds.clear();
    if (state.primarySelection?.type === 'bulb') {
      state.primarySelection = null;
    }
    updatePropertiesPanel();
    updateAllLists();
  }
  syncToggleButtons();
  window.dispatchEvent(
    new CustomEvent('update-menu-state', { detail: { showIlluminationFrames: state.showIlluminationFrames } })
  );
  render();
}

function toggleIllumination(): void {
  state.showIllumination = !state.showIllumination;
  const btn = document.getElementById('btn-show-illumination');
  const intensityBtn = document.getElementById('btn-show-illumination-intensity');
  if (btn) {
    btn.classList.toggle('active', state.showIllumination);
  }
  if (intensityBtn) {
    intensityBtn.classList.toggle('disabled', state.showIllumination);
  }
  window.dispatchEvent(new CustomEvent('update-menu-state', { detail: { showIllumination: state.showIllumination } }));
  render();
}

function toggleIlluminationIntensity(): void {
  state.showIlluminationIntensity = !state.showIlluminationIntensity;
  const btn = document.getElementById('btn-show-illumination-intensity');
  const illuminationBtn = document.getElementById('btn-show-illumination');
  if (btn) {
    btn.classList.toggle('active', state.showIlluminationIntensity);
  }
  if (illuminationBtn) {
    illuminationBtn.classList.toggle('disabled', state.showIlluminationIntensity);
  }
  window.dispatchEvent(
    new CustomEvent('update-menu-state', { detail: { showIlluminationIntensity: state.showIlluminationIntensity } })
  );
  render();
}

function toggleSetGrillHeight(): void {
  state.setGrillHeight = !state.setGrillHeight;
  if (state.setGrillHeight) {
    state.setSmallGrillHeight = false;
    state.copyDmdFromBackglass = false;
    state.setDmdDefaultLocation = false;
    if (state.activeTab !== 'backglass') {
      switchTab('backglass');
    }
  } else {
    state.mouseWorldY = null;
  }
  window.dispatchEvent(
    new CustomEvent('update-menu-state', {
      detail: {
        setGrillHeight: state.setGrillHeight,
        setSmallGrillHeight: state.setSmallGrillHeight,
        copyDmdFromBackglass: state.copyDmdFromBackglass,
        setDmdDefaultLocation: state.setDmdDefaultLocation,
      },
    })
  );
  render();
}

function toggleSetSmallGrillHeight(): void {
  state.setSmallGrillHeight = !state.setSmallGrillHeight;
  if (state.setSmallGrillHeight) {
    state.setGrillHeight = false;
    state.copyDmdFromBackglass = false;
    state.setDmdDefaultLocation = false;
    if (state.activeTab !== 'backglass') {
      switchTab('backglass');
    }
  } else {
    state.mouseWorldY = null;
  }
  window.dispatchEvent(
    new CustomEvent('update-menu-state', {
      detail: {
        setGrillHeight: state.setGrillHeight,
        setSmallGrillHeight: state.setSmallGrillHeight,
        copyDmdFromBackglass: state.copyDmdFromBackglass,
        setDmdDefaultLocation: state.setDmdDefaultLocation,
      },
    })
  );
  render();
}

function toggleCopyDmdFromBackglass(): void {
  state.copyDmdFromBackglass = !state.copyDmdFromBackglass;
  if (state.copyDmdFromBackglass) {
    state.setDmdDefaultLocation = false;
    state.setGrillHeight = false;
    state.setSmallGrillHeight = false;
    if (state.activeTab !== 'backglass') {
      switchTab('backglass');
    }
    if (state.currentData.dmdCopyAreaWidth <= 0 || state.currentData.dmdCopyAreaHeight <= 0) {
      const image = state.backgroundImage;
      if (image) {
        state.currentData.dmdCopyAreaX = Math.round(image.width / 2 - image.width / 6);
        state.currentData.dmdCopyAreaY = Math.round((image.height / 4) * 3);
        state.currentData.dmdCopyAreaWidth = Math.round(image.width / 3);
        state.currentData.dmdCopyAreaHeight = Math.round(image.height / 6);
      }
    }
  }
  window.dispatchEvent(
    new CustomEvent('update-menu-state', {
      detail: {
        copyDmdFromBackglass: state.copyDmdFromBackglass,
        setDmdDefaultLocation: state.setDmdDefaultLocation,
        setGrillHeight: state.setGrillHeight,
        setSmallGrillHeight: state.setSmallGrillHeight,
      },
    })
  );
  render();
}

function toggleSetDmdDefaultLocation(): void {
  if (!state.dmdImage) {
    appendConsoleLine('Cannot set DMD location: No DMD image loaded', 'warn');
    return;
  }
  state.setDmdDefaultLocation = !state.setDmdDefaultLocation;
  if (state.setDmdDefaultLocation) {
    state.copyDmdFromBackglass = false;
    state.setGrillHeight = false;
    state.setSmallGrillHeight = false;
    if (state.activeTab !== 'backglass') {
      switchTab('backglass');
    }
  } else {
    state.mouseWorldX = null;
    state.mouseWorldY = null;
  }
  window.dispatchEvent(
    new CustomEvent('update-menu-state', {
      detail: {
        setDmdDefaultLocation: state.setDmdDefaultLocation,
        copyDmdFromBackglass: state.copyDmdFromBackglass,
        setGrillHeight: state.setGrillHeight,
        setSmallGrillHeight: state.setSmallGrillHeight,
      },
    })
  );
  render();
}

function syncToggleButtons(): void {
  const scoreFramesBtn = document.getElementById('btn-show-score-frames');
  const scoringBtn = document.getElementById('btn-show-scoring');
  const illuminationFramesBtn = document.getElementById('btn-show-illumination-frames');
  const illuminationBtn = document.getElementById('btn-show-illumination');
  const illuminationIntensityBtn = document.getElementById('btn-show-illumination-intensity');

  scoreFramesBtn?.classList.toggle('active', state.showScoreFrames);
  scoringBtn?.classList.toggle('active', state.showScoring);
  illuminationFramesBtn?.classList.toggle('active', state.showIlluminationFrames);
  illuminationBtn?.classList.toggle('active', state.showIllumination);
  illuminationIntensityBtn?.classList.toggle('active', state.showIlluminationIntensity);

  illuminationBtn?.classList.toggle('disabled', state.showIlluminationIntensity);
  illuminationIntensityBtn?.classList.toggle('disabled', state.showIllumination);
}

function syncUndoRedoButtons(): void {
  const undoBtn = document.getElementById('btn-undo') as HTMLButtonElement | null;
  const redoBtn = document.getElementById('btn-redo') as HTMLButtonElement | null;

  if (undoBtn) undoBtn.disabled = !undoManager.canUndo();
  if (redoBtn) redoBtn.disabled = !undoManager.canRedo();
}

function switchTab(tab: 'backglass' | 'dmd'): void {
  state.activeTab = tab;
  const currentImageSelect = document.getElementById('current-image') as HTMLSelectElement | null;
  if (currentImageSelect) {
    currentImageSelect.value = tab;
  }
  const lampFilter = document.getElementById('lamp-filter') as HTMLSelectElement | null;
  if (lampFilter) {
    lampFilter.value = 'all';
    state.lampFilter = 'all';
  }
  if (tab !== 'backglass') {
    state.setGrillHeight = false;
    state.setSmallGrillHeight = false;
    state.copyDmdFromBackglass = false;
    state.setDmdDefaultLocation = false;
    state.mouseWorldX = null;
    state.mouseWorldY = null;
    window.dispatchEvent(
      new CustomEvent('update-menu-state', {
        detail: {
          setGrillHeight: false,
          setSmallGrillHeight: false,
          copyDmdFromBackglass: false,
          setDmdDefaultLocation: false,
        },
      })
    );
  }
  updateLampFilterDropdown();
  clearSelection();
  zoomToFit();
  updatePropertiesPanel();
  updateAllLists();
}

function closeFile(): void {
  resetState();
  clearBulbImageCache();
  undoManager.clear();
  clearSelection();
  setUIEnabled(false);
  render();
  updatePropertiesPanel();
  updateAllLists();
  updateFileDisplay('No file loaded');
  markClean();
  appendConsoleLine('File closed', 'info');
}

function setupCallbacks(): void {
  addCallback('render', () => {
    requestRender();
  });

  addCallback('dataChanged', () => {
    reloadImagesFromData();
    render();
    updateAllLists();
    updatePropertiesPanel();
  });

  addCallback('selectionChanged', () => {
    updatePropertiesPanel();
    updateAllLists();
  });

  addCallback('undoStackChanged', () => {
    syncUndoRedoButtons();
    const menuState = {
      canUndo: undoManager.canUndo(),
      canRedo: undoManager.canRedo(),
    };
    window.dispatchEvent(new CustomEvent('update-menu-state', { detail: menuState }));
  });
}

function newFile(): void {
  resetState();
  clearBulbImageCache();
  undoManager.clear();
  setUIEnabled(true);
  zoomToFit();
  updatePropertiesPanel();
  updateAllLists();
  updateFileDisplay('Untitled');
  markClean();
  appendConsoleLine('New file created', 'info');
}

async function loadFile(path: string, content: string): Promise<void> {
  try {
    state.currentData = parseDirectB2S(content);
    state.currentFilePath = path;
    clearSelection();
    clearBulbImageCache();
    updateNextIds();
    undoManager.clear();
    undoManager.setSavePoint();

    state.activeTab = 'backglass';

    await loadBackgroundImage();
    loadDmdImage();
    loadIlluminationImages();

    setUIEnabled(true);
    await waitForCanvasReady();
    zoomToFit();
    updatePropertiesPanel();
    updateAllLists();
    updateFileDisplay(path);
    markClean();
    const fileName = path.split('/').pop() || path;
    appendConsoleLine(
      `Loaded: ${fileName} (${state.currentData.illumination.length} bulbs, ${state.currentData.scores.length} scores)`,
      'info'
    );
  } catch (err) {
    appendConsoleLine(`Failed to parse file: ${err}`, 'error');
    alert(`Failed to parse file: ${err}`);
  }
}

function waitForCanvasReady(): Promise<void> {
  return new Promise(resolve => {
    let attempts = 0;
    const maxAttempts = 60;
    const check = (): void => {
      resizeCanvas();
      const { canvas } = elements;
      attempts++;
      if ((canvas && canvas.width > 0 && canvas.height > 0) || attempts >= maxAttempts) {
        resolve();
      } else {
        requestAnimationFrame(check);
      }
    };
    requestAnimationFrame(check);
  });
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteChars = atob(base64);
  const len = byteChars.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = byteChars.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

function loadImageFromBase64(mimeType: string, base64: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    let url: string;
    try {
      const blob = base64ToBlob(base64, mimeType);
      url = URL.createObjectURL(blob);
    } catch (err) {
      reject(err);
      return;
    }
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed'));
    };
    img.src = url;
  });
}

function detectImageFormat(base64: string): string {
  if (base64.startsWith('/9j/')) return 'image/jpeg';
  if (base64.startsWith('iVBORw0KGgo')) return 'image/png';
  if (base64.startsWith('R0lGOD')) return 'image/gif';
  if (base64.startsWith('UklGR')) return 'image/webp';
  if (base64.startsWith('Qk')) return 'image/bmp';
  return 'image/png';
}

async function loadBackgroundImage(): Promise<void> {
  if (state.currentData.images.backgroundImages.length > 0) {
    const imgData = state.currentData.images.backgroundImages[0].imageData;
    if (imgData) {
      const mimeType = detectImageFormat(imgData);
      try {
        const img = await loadImageFromBase64(mimeType, imgData);
        state.backgroundImage = img;
        updateAllLists();
      } catch (err) {
        appendConsoleLine(`Failed to load background image: ${err}`, 'error');
      }
    }
  }
}

async function loadDmdImage(): Promise<void> {
  if (state.currentData.images.dmdImages.length > 0) {
    const imgData = state.currentData.images.dmdImages[0].imageData;
    if (imgData) {
      const mimeType = detectImageFormat(imgData);
      try {
        const img = await loadImageFromBase64(mimeType, imgData);
        state.dmdImage = img;
        updateAllLists();
        if (state.activeTab === 'dmd') {
          zoomToFit();
        }
      } catch (err) {
        appendConsoleLine(`Failed to load DMD image: ${err}`, 'error');
      }
    }
  }
}

async function loadIlluminationImages(): Promise<void> {
  state.illuminationImages.clear();
  for (const img of state.currentData.images.illuminatedImages) {
    if (img.imageData) {
      const mimeType = detectImageFormat(img.imageData);
      const image = new Image();
      image.onload = () => {
        state.illuminationImages.set(img.fileName, image);
        invokeCallback('render');
        updateAllLists();
      };
      image.src = `data:${mimeType};base64,${img.imageData}`;
    }
  }
}

function reloadImagesFromData(): void {
  if (state.currentData.images.backgroundImages.length > 0) {
    const imgData = state.currentData.images.backgroundImages[0].imageData;
    if (imgData) {
      const mimeType = detectImageFormat(imgData);
      loadImageFromBase64(mimeType, imgData).then(img => {
        state.backgroundImage = img;
        requestRender();
      });
    }
  } else {
    state.backgroundImage = null;
  }

  if (state.currentData.images.dmdImages.length > 0) {
    const imgData = state.currentData.images.dmdImages[0].imageData;
    if (imgData) {
      const mimeType = detectImageFormat(imgData);
      loadImageFromBase64(mimeType, imgData).then(img => {
        state.dmdImage = img;
        requestRender();
      });
    }
  } else {
    state.dmdImage = null;
  }

  const currentFileNames = new Set(state.currentData.images.illuminatedImages.map(i => i.fileName));
  for (const fileName of state.illuminationImages.keys()) {
    if (!currentFileNames.has(fileName)) {
      state.illuminationImages.delete(fileName);
    }
  }
  for (const img of state.currentData.images.illuminatedImages) {
    if (img.imageData && !state.illuminationImages.has(img.fileName)) {
      const mimeType = detectImageFormat(img.imageData);
      const image = new Image();
      image.onload = () => {
        state.illuminationImages.set(img.fileName, image);
        requestRender();
      };
      image.src = `data:${mimeType};base64,${img.imageData}`;
    }
  }
}

const IMAGE_FILTERS = [{ name: 'Image Files', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'] }];

async function importBackglassImage(): Promise<void> {
  if (!state.currentData) return;

  const platform = getPlatform();
  const result = await platform.dialogs.showOpenDialog({
    title: 'Import Backglass Image',
    filters: IMAGE_FILTERS,
    readContents: true,
  });

  if (!result?.binaryContent) return;

  try {
    const base64 = uint8ArrayToBase64(result.binaryContent);
    const mimeType = detectImageFormat(base64);
    const img = await loadImageFromBase64(mimeType, base64);

    undoManager.beginUndo('Import backglass image');
    undoManager.markImagesForUndo();

    const fileName = result.filePath.split('/').pop() || result.filePath.split('\\').pop() || 'backglass.png';
    state.currentData.images.backgroundImages = [
      {
        fileName,
        romId: 0,
        romIdType: 'Lamp',
        type: 'Main',
        imageData: base64,
      },
    ];
    state.backgroundImage = img;

    undoManager.endUndo();
    markDirty();
    render();
    updateAllLists();
    appendConsoleLine(`Imported backglass image: ${fileName}`, 'info');
  } catch (err) {
    appendConsoleLine(`Failed to import backglass image: ${err}`, 'error');
  }
}

async function importIlluminationImage(): Promise<void> {
  if (!state.currentData) return;

  const platform = getPlatform();
  const result = await platform.dialogs.showOpenDialog({
    title: 'Import Illumination Image',
    filters: IMAGE_FILTERS,
    readContents: true,
  });

  if (!result?.binaryContent) return;

  try {
    const base64 = uint8ArrayToBase64(result.binaryContent);
    const mimeType = detectImageFormat(base64);
    const img = new Image();

    const fileName = result.filePath.split('/').pop() || result.filePath.split('\\').pop() || 'illumination.png';

    undoManager.beginUndo('Import illumination image');
    undoManager.markImagesForUndo();

    state.currentData.images.illuminatedImages.push({
      fileName,
      imageData: base64,
    });

    img.onload = () => {
      state.illuminationImages.set(fileName, img);
      render();
      updateAllLists();
    };
    img.src = `data:${mimeType};base64,${base64}`;

    undoManager.endUndo();
    markDirty();
    appendConsoleLine(`Imported illumination image: ${fileName}`, 'info');
  } catch (err) {
    appendConsoleLine(`Failed to import illumination image: ${err}`, 'error');
  }
}

async function importDmdImage(): Promise<void> {
  if (!state.currentData) return;

  const platform = getPlatform();
  const result = await platform.dialogs.showOpenDialog({
    title: 'Import DMD Image',
    filters: IMAGE_FILTERS,
    readContents: true,
  });

  if (!result?.binaryContent) return;

  try {
    const base64 = uint8ArrayToBase64(result.binaryContent);
    const mimeType = detectImageFormat(base64);
    const img = await loadImageFromBase64(mimeType, base64);

    undoManager.beginUndo('Import DMD image');
    undoManager.markImagesForUndo();

    const fileName = result.filePath.split('/').pop() || result.filePath.split('\\').pop() || 'dmd.png';
    state.currentData.images.dmdImages = [
      {
        fileName,
        imageData: base64,
      },
    ];
    state.dmdImage = img;

    undoManager.endUndo();
    markDirty();
    render();
    updateAllLists();
    appendConsoleLine(`Imported DMD image: ${fileName}`, 'info');
  } catch (err) {
    appendConsoleLine(`Failed to import DMD image: ${err}`, 'error');
  }
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function saveFile(): Promise<void> {
  if (!window.vpxB2sDesignerAPI) return;

  const content = writeDirectB2S(state.currentData);

  if (state.currentFilePath) {
    const success = await window.vpxB2sDesignerAPI.saveFile(state.currentFilePath, content);
    if (success) {
      markClean();
      undoManager.setSavePoint();
      const fileName = state.currentFilePath.split('/').pop() || state.currentFilePath;
      appendConsoleLine(`Saved: ${fileName}`, 'success');
    }
  } else {
    const result = await window.vpxB2sDesignerAPI.saveFileAs(content);
    if (result) {
      state.currentFilePath = result.path;
      markClean();
      undoManager.setSavePoint();
      updateFileDisplay(result.path);
      const fileName = result.path.split('/').pop() || result.path;
      appendConsoleLine(`Saved: ${fileName}`, 'success');
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
