import { createPlatform, getPlatform } from '../platform';
import { parseDirectB2SWithWarnings } from '../format/parser';
import { writeDirectB2S, type WriterAssets } from '../format/writer';
import { loadReelResource } from './resources';
import { state, elements, initElements, resetState, markClean, markDirty, updateNextIds } from './state';
import type { Animation, Bulb, Color } from '../types/data';
import { createDefaultBulb, getOffBackgroundImage, getMainBackgroundImage, createEmptyDirectB2S } from '../types/data';
import { showProjectSettingsDialog } from './settings-dialog';
import { showLedColorDialog } from './led-color-dialog';
import { checkDataBeforeExport } from './export-checks';
import { importAnimationsXml, exportAnimationXml } from './animation-xml';
import { createSnippetBulb, fileBaseName } from './snippet-import';
import { createDarkBackglassImage, createIlluminatedBackglassImage } from './image-export';
import { showSimpleContextMenu } from './context-menu';
import { storeLastBulbSettings, storeLastScoreSettings } from './object-operations';
import { clearReelRenderCaches } from './reel-render';
import { invalidateSpriteCache } from './illumination-render';
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
  screenToWorld,
  initZoomControl,
} from './canvas-renderer';
import { setupCanvasEvents } from './canvas-events';
import { clearSelection } from './selection';
import { updatePropertiesPanel, updateAllLists, updateIlluminationList, updateScoresList } from './properties-panel';
import {
  createBulb,
  createScore,
  deleteSelected,
  duplicateSelected,
  copySelected,
  cutSelected,
  pasteClipboard,
  changeZOrderForSelection,
} from './object-operations';
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
import { clearBulbImageCache, bulbImageCache, invalidateBulbImage } from './parts/bulb';
import { initConsole, appendConsoleLine } from './console-panel';
import { initResourcesPanel, illuminationImageKey } from './resources-panel';
import { showReelTypeDialog } from './reel-type-dialog';
import { trimAllSnippets, trimSnippetBulb } from './snippet-trim';
import { showBackglassPreview } from './backglass-preview';
import { showSnippetSettingsDialog } from './snippet-settings-dialog';
import { showFontPickerDialog } from './font-picker-dialog';
import { showReelIlluminationDialog } from './reel-illumination-dialog';
import { showUndoHistoryDialog } from './undo-history-dialog';
import { showModal } from './modal';
import { bulbPassesFilter, romInfoToString, b2sInfoToString } from './bulb-filter';
import { setStatusProgress, updateStatusInfo } from './canvas-renderer';

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
          <input type="radio" name="resize-mode" id="resize-mode-percentage" value="percentage">
          <span>By Percentage</span>
        </label>
        <label class="resize-radio">
          <input type="radio" name="resize-mode" id="resize-mode-absolute" value="absolute" checked>
          <span>By Absolute Size</span>
        </label>
      </div>

      <div class="resize-section hidden" id="percentage-section">
        <div class="settings-field-row">
          <label>Percentage</label>
          <input type="number" id="resize-percentage" class="win-input" value="100" min="1" max="200" style="width: 80px;">
          <span>%</span>
        </div>
      </div>

      <div class="resize-section" id="absolute-section">
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
  undoManager.markGrillHeightsForUndo();

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
    const mainEntry = parent === 'DMD' ? images[0] : getMainBackgroundImage(state.currentData.images);

    for (const entry of images) {
      if (!entry.imageData) continue;
      const { resizedData, resizedImage } = await resizeImageData(entry.imageData, newWidth, newHeight);
      entry.imageData = resizedData;
      if (entry === mainEntry) {
        if (parent === 'DMD') {
          state.dmdImage = resizedImage;
        } else {
          state.backgroundImage = resizedImage;
          clearBulbImageCache();
          invalidateSpriteCache();
        }
      }
    }
    if (parent !== 'DMD') {
      state.currentData.grillHeight = Math.round(state.currentData.grillHeight * scaleY);
      state.currentData.smallGrillHeight = Math.round(state.currentData.smallGrillHeight * scaleY);
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
  pushMenuState();

  if (enabled) {
    updateLampFilterDropdown();
    syncCurrentImageDropdown();
  }

  syncToggleButtons();
  syncUndoRedoButtons();
  updateStatusInfo();
}

function pushMenuState(): void {
  const data = state.currentData;
  const hasBackgroundImage = !!state.backgroundImage;
  window.dispatchEvent(
    new CustomEvent('update-menu-state', {
      detail: {
        hasFile: state.hasFile,
        hasBackgroundImage,
        dmdAllowed: data.dmdType !== 'NoB2SDMD',
        canCreateDirectB2S: data.destType !== 'VisualStudio2010',
        inDMD: state.activeTab === 'dmd',
        inBackglass: state.activeTab !== 'dmd',
        hasAnimations: data.animations.length > 0,
        showScoreFrames: state.showScoreFrames,
        showScoring: state.showScoring,
        showIlluminationFrames: state.showIlluminationFrames,
        showIllumination: state.showIllumination,
        showIlluminationIntensity: state.showIlluminationIntensity,
      },
    })
  );
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

function updateLampFilterDropdown(): void {
  const lampFilter = document.getElementById('lamp-filter') as HTMLSelectElement | null;
  if (!lampFilter) return;

  const previous = state.lampFilter;
  lampFilter.querySelectorAll('option[data-dynamic]').forEach(opt => opt.remove());

  const parentFilter = state.activeTab === 'dmd' ? 'DMD' : 'Backglass';
  const counts = new Map<string, number>();
  for (const bulb of state.currentData.illumination) {
    if (bulb.parent !== parentFilter) continue;
    const rom = romInfoToString(bulb);
    const b2s = b2sInfoToString(bulb);
    if (rom) counts.set(rom, (counts.get(rom) || 0) + 1);
    if (b2s) counts.set(b2s, (counts.get(b2s) || 0) + 1);
  }

  const typeOrder = (key: string): number => {
    if (/^\d+$/.test(key)) return 0;
    const inv = key.startsWith('I') ? 10 : 0;
    const t = key.replace(/^I/, '');
    if (t.startsWith('GI')) return inv + 3;
    if (t.startsWith('S')) return inv + 2;
    return inv + 1;
  };
  const numeric = (key: string): number => parseInt(key.replace(/^[A-Z]+/, ''), 10) || 0;
  const sorted = Array.from(counts.entries()).sort(
    (a, b) => typeOrder(a[0]) - typeOrder(b[0]) || numeric(a[0]) - numeric(b[0])
  );

  const anchor = lampFilter.querySelector('option[value="withoutid"]');
  const addOption = (value: string, label: string): void => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    opt.dataset.dynamic = 'true';
    lampFilter.insertBefore(opt, anchor);
  };
  if (state.currentData.dualBackglass) {
    addOption('authentic', 'Authentic');
    addOption('fantasy', 'Fantasy');
  }
  for (const [key, count] of sorted) {
    addOption(key, `${key} (${count})`);
  }

  if (Array.from(lampFilter.options).some(o => o.value === previous)) {
    lampFilter.value = previous;
  } else {
    lampFilter.value = '';
    state.lampFilter = '';
  }
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
  initZoomControl();
  setupCanvasEvents();
  setupWindowListeners();
  setupApiListeners();
  setupMenuActions();
  setupToolbarControls();
  setupCallbacks();
  setupModals();
  setupDragAndDrop();

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
    if (appSettings.showIlluminationFrames !== undefined) {
      state.showIlluminationFrames = appSettings.showIlluminationFrames;
    }
  }
  defaultFrameVisibility = { scores: state.showScoreFrames, bulbs: state.showIlluminationFrames };

  resizeCanvas();
  setUIEnabled(false);
  await initConsole();

  await checkPendingFile();
}

let defaultFrameVisibility = { scores: true, bulbs: true };

function applyDefaultFrameVisibility(): void {
  state.showScoreFrames = defaultFrameVisibility.scores;
  state.showIlluminationFrames = defaultFrameVisibility.bulbs;
  state.showScoring = true;
  syncToggleButtons();
  pushMenuState();
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

    window.vpxB2sDesignerAPI.onSaveAsRequested?.(() => {
      void saveFileAs();
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
    e.detail.namedBulbs = getNamedBulbs();
    e.detail.dualBackglass = state.currentData.dualBackglass;
    const api = window.vpxB2sDesignerAPI as unknown as {
      openAnimationEditor?: (a: unknown, n: boolean, c: unknown) => void;
    };
    if (api?.openAnimationEditor) {
      api.openAnimationEditor(animation, isNew ?? true, {
        namedBulbs: e.detail.namedBulbs,
        dualBackglass: e.detail.dualBackglass,
      });
    }
  }) as EventListener);

  window.addEventListener('animation-bulb-clicked', ((e: CustomEvent) => {
    const api = window.vpxB2sDesignerAPI as unknown as { animationBulbClicked?: (name: string) => void };
    api?.animationBulbClicked?.(e.detail as string);
  }) as EventListener);

  window.addEventListener('close-file', () => {
    closeFile();
  });

  window.addEventListener('resource-action', ((e: CustomEvent) => {
    void handleResourceAction(
      e.detail as { action: string; index?: number; type?: string; value?: unknown; bulbId?: number }
    );
  }) as EventListener);

  window.addEventListener('backglass-property-changed', () => {
    pushMenuState();
    updateLampFilterDropdown();
  });

  window.addEventListener('animation-context-menu', ((e: CustomEvent) => {
    const { name, x, y } = e.detail as { name: string; x: number; y: number };
    showSimpleContextMenu(x, y, [
      {
        label: 'Edit...',
        onClick: () => {
          const animation = state.currentData.animations.find(a => a.name === name);
          if (animation) {
            window.dispatchEvent(new CustomEvent('open-animation-editor', { detail: { animation, isNew: false } }));
          }
        },
      },
      { label: 'Export...', onClick: () => void exportAnimation(name) },
      { label: '', separator: true },
      { label: 'Delete', onClick: () => handleAnimationDeleted(name) },
    ]);
  }) as EventListener);
}

function getNamedBulbs(): string[] {
  const parent = state.activeTab === 'dmd' ? 'DMD' : 'Backglass';
  const names = state.currentData.illumination
    .filter(b => b.parent === parent && b.name && bulbPassesFilter(b, state.lampFilter, state.currentData.commType))
    .map(b => b.name);
  return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
}

function setupMenuActions(): void {
  window.addEventListener('menu-action', ((e: CustomEvent) => {
    const action = e.detail;
    handleMenuAction(action);
  }) as EventListener);

  window.addEventListener('selection-from-context', () => {
    render();
    updatePropertiesPanel();
    updateAllLists();
  });

  window.addEventListener('zorder-action', ((e: CustomEvent) => {
    const op = e.detail?.op as 'front' | 'back' | 'forward' | 'backward';
    if (op) changeZOrderForSelection(op);
  }) as EventListener);

  window.addEventListener('properties-action', ((e: CustomEvent) => {
    handlePropertiesAction(e.detail.action as string, e.detail.type as 'bulb' | 'score', e.detail.id as number);
  }) as EventListener);

  window.addEventListener('snippet-region-captured', ((e: CustomEvent) => {
    const { x, y, w, h } = e.detail as { x: number; y: number; w: number; h: number };
    void captureSnippetFromBackglass(x, y, w, h);
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
    addScoreAction();
  });
  document.getElementById('btn-add-animation')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('open-animation-editor', { detail: { animation: null, isNew: true } }));
  });
  document.getElementById('btn-import-animation')?.addEventListener('click', () => {
    void importAnimations();
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
      addScoreAction();
      break;
    case 'save-file-as':
      void saveFileAs();
      break;
    case 'project-settings':
      showProjectSettings();
      break;
    case 'delete':
      deleteSelected();
      break;
    case 'duplicate':
      duplicateSelected();
      break;
    case 'cut':
      cutSelected();
      break;
    case 'copy':
      copySelected();
      break;
    case 'paste':
      pasteClipboard();
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
    case 'reload-backglass-image':
      void reloadBackglassImage();
      break;
    case 'save-backup-as':
      void saveBackupAs();
      break;
    case 'save-all':
      void saveFile();
      break;
    case 'open-backup':
      void openBackupFile();
      break;
    case 'import-backglass-file':
      void importBackglassFile();
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
      chooseReelTypes();
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
    case 'export-dark-backglass':
      void createDarkBackglassImage();
      break;
    case 'export-illuminated-backglass':
      void createIlluminatedBackglassImage();
      break;
    case 'select-all-illumination': {
      const parentFilter = state.activeTab === 'dmd' ? 'DMD' : 'Backglass';
      state.selectedScoreIds.clear();
      state.selectedBulbIds.clear();
      for (const bulb of state.currentData.illumination) {
        if (bulb.parent === parentFilter) {
          state.selectedBulbIds.add(bulb.id);
        }
      }
      const first = state.selectedBulbIds.values().next().value;
      state.primarySelection = first !== undefined ? { type: 'bulb', id: first } : null;
      render();
      updatePropertiesPanel();
      updateAllLists();
      break;
    }
    case 'manage-animations': {
      if (!state.showIlluminationFrames) toggleIlluminationFrames();
      const lampFilter = document.getElementById('lamp-filter') as HTMLSelectElement | null;
      if (lampFilter && getNamedBulbs().length > 0 && !state.lampFilter) {
        lampFilter.value = 'withname';
        state.lampFilter = 'withname';
        render();
        updateAllLists();
      }
      const first = state.currentData.animations[0] || null;
      window.dispatchEvent(
        new CustomEvent('open-animation-editor', { detail: { animation: first, isNew: first === null } })
      );
      break;
    }
    case 'toggle-resources-panel':
      toggleLeftPanelSection('resources-section');
      break;
    case 'toggle-illumination-panel':
      toggleLeftPanelSection('illumination-section');
      break;
    case 'toggle-reels-panel':
      toggleLeftPanelSection('scores-section');
      break;
    case 'trim-all-snippets':
      void trimAllSnippets();
      break;
    case 'add-illumination-snippet':
      toggleAddSnippetMode();
      break;
    case 'create-directb2s':
      void exportDirectB2SFile();
      break;
    case 'backglass-preview':
      void showBackglassPreview();
      break;
    case 'show-history':
      showUndoHistoryDialog();
      break;
    case 'toggle-translucent':
      if (window.vpxB2sDesignerAPI?.toggleTranslucent) {
        void window.vpxB2sDesignerAPI.toggleTranslucent().then(isTranslucent => {
          window.dispatchEvent(new CustomEvent('update-menu-state', { detail: { isTranslucent } }));
        });
      } else {
        appendConsoleLine('Translucent only available on desktop.', 'warn');
      }
      break;
  }
}

function handlePropertiesAction(action: string, type: 'bulb' | 'score', id: number): void {
  switch (action) {
    case 'score-perfect-scale': {
      if (type !== 'score') return;
      const score = state.currentData.scores.find(s => s.id === id);
      if (!score) return;
      const bg = state.activeTab === 'dmd' ? state.dmdImage : state.backgroundImage;
      if (!bg) {
        appendConsoleLine('No background image to scale against.', 'warn');
        return;
      }
      void bg;
      undoManager.beginUndo('Perfect scale, width is fix');
      undoManager.markScoreForUndo(id);
      let singleWidth = (score.width - (score.spacing / 2) * (score.digits - 1)) / score.digits;
      while (singleWidth * score.digits > score.width - 1) singleWidth -= 1;
      score.height = Math.round((80 / 60) * singleWidth) + 1;
      undoManager.endUndo();
      storeLastScoreSettings(score);
      render();
      updatePropertiesPanel();
      break;
    }
    case 'score-led-color': {
      if (type !== 'score') return;
      const score = state.currentData.scores.find(s => s.id === id);
      if (!score) return;
      const original = { ...score.reelColor };
      showLedColorDialog({
        title: 'Set LED color',
        initial: score.reelColor,
        useLastColor: true,
        onPreview: c => {
          score.reelColor = c;
          render();
        },
        onOk: c => {
          score.reelColor = original;
          undoManager.beginUndo('Change LED color');
          undoManager.markScoreForUndo(id);
          score.reelColor = c;
          undoManager.endUndo();
          storeLastScoreSettings(score);
          render();
          updatePropertiesPanel();
          updateAllLists();
        },
        onCancel: () => {
          score.reelColor = original;
          render();
        },
      });
      break;
    }
    case 'bulb-light-color': {
      if (type !== 'bulb') return;
      const bulb = state.currentData.illumination.find(b => b.id === id);
      if (!bulb) return;
      const original = { ...bulb.lightColor };
      const preview = (c: Color): void => {
        bulb.lightColor = c;
        invalidateSpriteCache();
        render();
      };
      showLedColorDialog({
        title: 'Set light color',
        initial: bulb.lightColor,
        useLastColor: true,
        onPreview: preview,
        onOk: c => {
          bulb.lightColor = original;
          undoManager.beginUndo('Change light color');
          undoManager.markBulbForUndo(id);
          bulb.lightColor = c;
          undoManager.endUndo();
          storeLastBulbSettings(bulb);
          invalidateSpriteCache();
          render();
          updatePropertiesPanel();
          updateAllLists();
        },
        onCancel: () => preview(original),
      });
      break;
    }
    case 'score-reel-illumination': {
      if (type !== 'score') return;
      const score = state.currentData.scores.find(s => s.id === id);
      if (!score) return;
      showReelIlluminationDialog(score, changes => {
        undoManager.beginUndo('Reel Illumination');
        undoManager.markScoreForUndo(id);
        Object.assign(score, changes);
        undoManager.endUndo();
        render();
        updatePropertiesPanel();
        updateAllLists();
      });
      break;
    }
    case 'bulb-fonts': {
      if (type !== 'bulb') return;
      const bulb = state.currentData.illumination.find(b => b.id === id);
      if (!bulb) return;
      showFontPickerDialog(bulb, changes => {
        undoManager.beginUndo('Font');
        undoManager.markBulbForUndo(id);
        Object.assign(bulb, changes);
        undoManager.endUndo();
        render();
        updatePropertiesPanel();
        updateAllLists();
      });
      break;
    }
    case 'bulb-snippet-settings': {
      if (type !== 'bulb') return;
      const bulb = state.currentData.illumination.find(b => b.id === id);
      if (!bulb || !bulb.isImageSnippet) return;
      showSnippetSettingsDialog(bulb, {
        onSave: changes => {
          undoManager.beginUndo('Snippit settings');
          undoManager.markBulbForUndo(id);
          Object.assign(bulb, changes);
          if (changes.imageData !== undefined) invalidateBulbImage(id);
          undoManager.endUndo();
          markDirty();
          render();
          updatePropertiesPanel();
          updateAllLists();
        },
        onChangeImage: async () => {
          const platform = getPlatform();
          const result = await platform.dialogs.showOpenDialog({
            title: 'Change snippit image',
            filters: IMAGE_FILTERS,
            readContents: true,
          });
          if (!result?.binaryContent) return null;
          const base64 = uint8ArrayToBase64(result.binaryContent);
          try {
            const img = await loadImageFromBase64(detectImageFormat(base64), base64);
            return { name: fileBaseName(result.filePath), base64, width: img.naturalWidth, height: img.naturalHeight };
          } catch {
            appendConsoleLine("Can't load or use this image file. Have you selected an image file?", 'error');
            return null;
          }
        },
        onTrimImage: () => trimSnippetBulb(bulb),
      });
      break;
    }
  }
}

async function serializeCurrentData(): Promise<string> {
  const data = state.currentData;
  const offEntry = getOffBackgroundImage(data.images);
  let offImage: HTMLImageElement | null = null;
  if (offEntry?.imageData) {
    try {
      offImage = await loadImageFromBase64(detectImageFormat(offEntry.imageData), offEntry.imageData);
    } catch {
      offImage = null;
    }
  }
  const assets: WriterAssets = {
    backgroundImage: state.backgroundImage,
    offImage,
    dmdImage: state.dmdImage,
    loadReelImage: async (name: string) => {
      const res = await loadReelResource(name);
      return res ? { image: res.image, base64: res.base64 } : null;
    },
    onProgress: percent => setStatusProgress(percent),
  };
  try {
    return await writeDirectB2S(data, assets);
  } finally {
    setStatusProgress(100);
  }
}

async function exportDirectB2SFile(): Promise<void> {
  if (!state.currentData) return;
  const platform = getPlatform();
  const ok = await checkDataBeforeExport(state.currentData, {
    showError: async message => {
      await platform.dialogs.showMessageBox({ type: 'error', message, buttons: ['OK'] });
    },
    askYesNo: async message =>
      (await platform.dialogs.showMessageBox({ type: 'question', message, buttons: ['Yes', 'No'] })) === 0,
  });
  if (!ok) return;
  const xml = await serializeCurrentData();
  const baseName = state.currentData.vsName || state.currentData.name || 'backglass';
  const result = await platform.dialogs.showSaveDialog({
    title: "Create 'directB2S' backglass file",
    defaultPath: `${baseName}.directb2s`,
    filters: [{ name: 'DirectB2S Files', extensions: ['directb2s'] }],
    content: xml,
  });
  if (result) {
    appendConsoleLine(`Created directB2S backglass file: ${result.filePath}`, 'success');
  }
}

async function saveFileAs(): Promise<void> {
  if (!window.vpxB2sDesignerAPI || !state.currentData) return;
  const content = await serializeCurrentData();
  const result = await window.vpxB2sDesignerAPI.saveFileAs(content);
  if (result) {
    state.currentFilePath = result.path;
    markClean();
    undoManager.setSavePoint();
    updateFileDisplay(result.path);
    appendConsoleLine(`Saved: ${result.path.split(/[\\/]/).pop() || result.path}`, 'success');
  }
}

function addScoreAction(): void {
  if (!state.showScoreFrames) {
    state.showScoreFrames = true;
    syncToggleButtons();
    pushMenuState();
  }
  if (state.currentData.reelTypes.length === 0 && !state.lastScore?.reelType) {
    appendConsoleLine('No reel or LED types chosen yet. Choose them first, then the score display is added.', 'info');
    chooseReelTypes(() => {
      if (state.currentData.reelTypes.length > 0) createScore();
    });
    return;
  }
  createScore();
}

function chooseReelTypes(afterOk?: () => void): void {
  showReelTypeDialog(state.currentData, {
    onOk: settings => {
      undoManager.beginUndo('Reels and LEDs');
      undoManager.markGeneralForUndo();
      undoManager.markAllScoresForUndo();
      const data = state.currentData;
      data.reelTypes = settings.reelTypes;
      data.reelColor = settings.reelColor;
      data.reelRollingDirection = settings.reelRollingDirection;
      data.reelRollingInterval = settings.reelRollingInterval;
      data.reelIntermediateImageCount = settings.reelIntermediateImageCount;
      data.useDream7LEDs = settings.useDream7LEDs;
      data.d7Glow = settings.d7Glow;
      data.d7Thickness = settings.d7Thickness;
      data.d7Shear = settings.d7Shear;
      for (const score of data.scores) {
        if (!score.reelType) score.reelType = data.reelTypes[0] || '';
      }
      undoManager.endUndo();
      clearReelRenderCaches();
      markDirty();
      render();
      updatePropertiesPanel();
      updateAllLists();
      afterOk?.();
    },
    onExport: reelType => void exportReelImageSet(reelType),
    onDelete: reelType => deleteImportedReelSet(reelType),
    onImportReelSet: () => void importReelImageSet('EMR_T'),
    onImportCreditReelSet: () => void importReelImageSet('EMR_CT'),
    onImportLEDSet: () => void importReelImageSet('LED_T'),
  });
}

async function exportReelImageSet(reelType: string): Promise<void> {
  const platform = getPlatform();
  const base = reelType.replace(/_0+$/, '');
  const images: { name: string; base64: string }[] = [];
  if (reelType.startsWith('Imported')) {
    for (const img of state.currentData.reels.images) {
      if (img.name.toLowerCase().startsWith(base.toLowerCase() + '_'))
        images.push({ name: img.name, base64: img.imageData });
    }
  } else {
    const isCredit = base.startsWith('EMR_CT');
    for (let i = 0; i < 100; i++) {
      const name = isCredit ? `${base}_${i.toString().padStart(2, '0')}` : `${base}_${i}`;
      const res = await loadReelResource(name);
      if (!res) break;
      images.push({ name, base64: res.base64 });
    }
  }
  if (images.length === 0) {
    appendConsoleLine(`No images found for ${reelType}.`, 'warn');
    return;
  }
  let saved = 0;
  for (let i = 0; i < images.length; i++) {
    const bytes = Uint8Array.from(atob(images[i].base64), c => c.charCodeAt(0));
    const ext = images[i].base64.startsWith('/9j/') ? 'jpg' : 'png';
    const result = await platform.dialogs.showSaveDialog({
      title: 'Export reel image',
      defaultPath: `${base}_${i.toString().padStart(2, '0')}.${ext}`,
      filters: [{ name: 'Image', extensions: [ext] }],
      binaryContent: bytes,
    });
    if (!result) break;
    saved++;
  }
  appendConsoleLine(`Successfully exported ${saved} images.`, 'info');
}

function deleteImportedReelSet(reelType: string): void {
  const base = reelType.replace(/_0+$/, '').toLowerCase();
  undoManager.beginUndo('Delete imported reel set');
  undoManager.markGeneralForUndo();
  const data = state.currentData;
  data.reels.images = data.reels.images.filter(i => !i.name.toLowerCase().startsWith(base + '_'));
  data.reelTypes = data.reelTypes.filter(t => t !== reelType);
  for (const score of data.scores) {
    if (score.reelType === reelType) score.reelType = '';
  }
  undoManager.endUndo();
  clearReelRenderCaches();
  markDirty();
  render();
  updateAllLists();
}

async function importReelImageSet(kind: 'EMR_T' | 'EMR_CT' | 'LED_T'): Promise<void> {
  const platform = getPlatform();
  const isCredit = kind === 'EMR_CT';
  await platform.dialogs.showMessageBox({
    type: 'info',
    message: isCredit
      ? "Please start your credit reel import with the image for '00'. Then move on, step by step with your images for '01', '02' and so on."
      : "Please start your image set import with the image for reel or LED '0'. Then move on, step by step with your images from '1' to '9'. The last one is the image for an empty reel or LED.",
    buttons: ['OK'],
  });
  const files = await platform.dialogs.showOpenDialogMultiple({
    title: 'Import reel images (select all images of the set)',
    filters: IMAGE_FILTERS,
    readContents: true,
  });
  if (files.length === 0) return;
  files.sort((a, b) => a.filePath.localeCompare(b.filePath, undefined, { numeric: true }));
  if (!isCredit && files.length < 10) {
    await platform.dialogs.showMessageBox({
      type: 'error',
      message:
        'Please remember, you have to import 11 images step by step, one image for each numeric character, from 0 to 9, and one image for an empty reel or LED.',
      buttons: ['OK'],
    });
    return;
  }
  const data = state.currentData;
  const existing = new Set<number>();
  const re = new RegExp(`^Imported${kind}(\\d+)_`, 'i');
  for (const img of data.reels.images) {
    const m = re.exec(img.name);
    if (m) existing.add(parseInt(m[1], 10));
  }
  const key = existing.size > 0 ? Math.max(...existing) + 1 : 1;
  const base = `Imported${kind}${key}`;
  undoManager.beginUndo('Import reel image set');
  undoManager.markGeneralForUndo();
  files.forEach((f, i) => {
    if (!f.binaryContent) return;
    let suffix: string;
    if (isCredit) suffix = i.toString().padStart(2, '0');
    else suffix = i < 10 ? String(i) : 'Empty';
    data.reels.images.push({
      name: `${base}_${suffix}`,
      countOfIntermediates: 0,
      imageData: uint8ArrayToBase64(f.binaryContent),
      intermediates: [],
    });
  });
  const reelType = `${base}_${isCredit ? '00' : '0'}`;
  if (!data.reelTypes.includes(reelType)) data.reelTypes.push(reelType);
  undoManager.endUndo();
  clearReelRenderCaches();
  markDirty();
  updateAllLists();
  await platform.dialogs.showMessageBox({
    type: 'info',
    message: 'You have successfully imported all reel or LED images.',
    buttons: ['OK'],
  });
  chooseReelTypes();
}

async function handleResourceAction(detail: {
  action: string;
  index?: number;
  type?: string;
  value?: unknown;
  bulbId?: number;
}): Promise<void> {
  const images = state.currentData.images;
  switch (detail.action) {
    case 'selected':
      render();
      updatePropertiesPanel();
      updateIlluminationList();
      updateScoresList();
      break;
    case 'activate-background': {
      const idx = detail.index ?? 0;
      const entry = images.backgroundImages[idx];
      if (!entry || !entry.imageData) return;
      const current = getMainBackgroundImage(images);
      if (entry === current) return;
      const img = await loadImageFromBase64(detectImageFormat(entry.imageData), entry.imageData);
      undoManager.beginUndo('Change background image');
      undoManager.markImagesForUndo();
      if (state.backgroundImage) {
        await rescaleItemsToNewImage(
          state.backgroundImage.width,
          state.backgroundImage.height,
          img.naturalWidth,
          img.naturalHeight
        );
      }
      images.backgroundImages.splice(idx, 1);
      if (entry.type === 'Off') entry.type = 'Main';
      images.backgroundImages.unshift(entry);
      state.backgroundImage = img;
      undoManager.endUndo();
      markDirty();
      clearBulbImageCache();
      invalidateSpriteCache();
      if (state.activeTab !== 'backglass') switchTab('backglass');
      else zoomToFit();
      pushMenuState();
      updateStatusInfo();
      render();
      updateAllLists();
      updatePropertiesPanel();
      break;
    }
    case 'activate-dmd': {
      const idx = detail.index ?? 0;
      const entry = images.dmdImages[idx];
      if (!entry || idx === 0) {
        if (entry) switchTab('dmd');
        return;
      }
      const img = await loadImageFromBase64(detectImageFormat(entry.imageData), entry.imageData);
      undoManager.beginUndo('Change DMD image');
      undoManager.markImagesForUndo();
      images.dmdImages.splice(idx, 1);
      images.dmdImages.unshift(entry);
      state.dmdImage = img;
      undoManager.endUndo();
      markDirty();
      switchTab('dmd');
      updateAllLists();
      break;
    }
    case 'illumination-selected':
      render();
      break;
    case 'select-snippet': {
      if (detail.bulbId === undefined) return;
      state.selectedBulbIds.clear();
      state.selectedScoreIds.clear();
      state.selectedBulbIds.add(detail.bulbId);
      state.primarySelection = { type: 'bulb', id: detail.bulbId };
      render();
      updatePropertiesPanel();
      updateAllLists();
      break;
    }
    case 'delete': {
      const idx = detail.index ?? 0;
      undoManager.beginUndo('Delete image');
      undoManager.markImagesForUndo();
      if (detail.type === 'background') {
        const entry = images.backgroundImages[idx];
        const wasMain = entry === getMainBackgroundImage(images);
        images.backgroundImages.splice(idx, 1);
        if (wasMain) {
          const next = getMainBackgroundImage(images);
          state.backgroundImage = next
            ? await loadImageFromBase64(detectImageFormat(next.imageData), next.imageData)
            : null;
          clearBulbImageCache();
          invalidateSpriteCache();
        }
      } else if (detail.type === 'dmd') {
        images.dmdImages.splice(idx, 1);
        if (idx === 0) {
          const next = images.dmdImages[0];
          state.dmdImage = next ? await loadImageFromBase64(detectImageFormat(next.imageData), next.imageData) : null;
        }
      } else if (detail.type === 'illumination') {
        images.illuminatedImages.splice(idx, 1);
        if (state.selectedIlluminationImage === idx) state.selectedIlluminationImage = null;
        reloadImagesFromData();
      }
      undoManager.endUndo();
      markDirty();
      pushMenuState();
      updateStatusInfo();
      render();
      updateAllLists();
      updatePropertiesPanel();
      break;
    }
    case 'background-type':
    case 'background-romid':
    case 'background-romtype': {
      const entry = images.backgroundImages[detail.index ?? 0];
      if (!entry) return;
      undoManager.beginUndo('Change background image info');
      undoManager.markImagesForUndo();
      if (detail.action === 'background-type') entry.type = detail.value as 'Main' | 'On' | 'Off';
      else if (detail.action === 'background-romid') entry.romId = (detail.value as number) || 0;
      else entry.romIdType = detail.value as Bulb['romIdType'];
      undoManager.endUndo();
      markDirty();
      if (detail.action === 'background-type') {
        reloadImagesFromData();
        updateAllLists();
      }
      break;
    }
  }
}

function showProjectSettings(): void {
  const data = state.currentData;
  void (async () => {
    const settings = window.vpxB2sDesignerAPI ? await window.vpxB2sDesignerAPI.getSettings() : null;
    showProjectSettingsDialog({
      mode: 'edit',
      data,
      latestAuthor: settings?.latestAuthor,
      onPickTableFile: pickVpTableFile,
      onOk: s => {
        undoManager.beginUndo('Settings');
        undoManager.markGeneralForUndo();
        Object.assign(data, s);
        undoManager.endUndo();
        markDirty();
        if (window.vpxB2sDesignerAPI) void window.vpxB2sDesignerAPI.saveSettings({ latestAuthor: s.author });
        pushMenuState();
        updateLampFilterDropdown();
        render();
        updatePropertiesPanel();
        updateAllLists();
      },
    });
  })();
}

async function pickVpTableFile(): Promise<string | null> {
  const platform = getPlatform();
  const settings = window.vpxB2sDesignerAPI ? await window.vpxB2sDesignerAPI.getSettings() : null;
  const result = await platform.dialogs.showOpenDialog({
    title: 'Choose Visual Pinball table',
    filters: [{ name: 'Visual Pinball tables', extensions: ['vpx', 'vpt'] }],
    defaultPath: settings?.vpTablesFolder,
    readContents: false,
  });
  if (!result) return null;
  const folder = result.filePath.replace(/[\\/][^\\/]*$/, '');
  if (window.vpxB2sDesignerAPI && folder && folder !== result.filePath) {
    void window.vpxB2sDesignerAPI.saveSettings({ vpTablesFolder: folder });
  }
  return fileBaseName(result.filePath);
}

async function importAnimations(): Promise<void> {
  const platform = getPlatform();
  const result = await platform.dialogs.showOpenDialog({
    title: 'Import animations',
    filters: [{ name: 'XML files', extensions: ['xml'] }],
    readContents: true,
  });
  if (!result) return;
  let text = result.content;
  if (!text && result.binaryContent) text = new TextDecoder().decode(result.binaryContent);
  if (!text) return;
  try {
    const imported = importAnimationsXml(text);
    if (imported.length === 0) {
      appendConsoleLine('No animations found in file.', 'warn');
      return;
    }
    undoManager.beginUndo('Import animations');
    undoManager.markAnimationsForUndo();
    for (const anim of imported) state.currentData.animations.push(anim);
    undoManager.endUndo();
    markDirty();
    updateAllLists();
    pushMenuState();
    await platform.dialogs.showMessageBox({
      type: 'info',
      message: `Successfully imported ${imported.length} animation${imported.length === 1 ? '' : 's'}.`,
      buttons: ['OK'],
    });
  } catch (err) {
    await platform.dialogs.showMessageBox({
      type: 'error',
      message: `Error importing animations: ${err}`,
      buttons: ['OK'],
    });
  }
}

async function exportAnimation(name: string): Promise<void> {
  const anim = state.currentData.animations.find(a => a.name === name);
  if (!anim) return;
  const platform = getPlatform();
  const result = await platform.dialogs.showSaveDialog({
    title: 'Export animation',
    defaultPath: `${anim.name}.xml`,
    filters: [{ name: 'XML files', extensions: ['xml'] }],
    content: exportAnimationXml(anim),
  });
  if (result) appendConsoleLine(`Exported animation '${anim.name}' to ${result.filePath}`, 'success');
}

async function captureSnippetFromBackglass(x: number, y: number, w: number, h: number): Promise<void> {
  if (!state.backgroundImage || w < 4 || h < 4) {
    appendConsoleLine('Snippet region too small.', 'warn');
    return;
  }
  const sx = Math.max(0, Math.floor(x));
  const sy = Math.max(0, Math.floor(y));
  const sw = Math.min(Math.ceil(w), state.backgroundImage.width - sx);
  const sh = Math.min(Math.ceil(h), state.backgroundImage.height - sy);
  if (sw <= 0 || sh <= 0) return;

  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.drawImage(state.backgroundImage, sx, sy, sw, sh, 0, 0, sw, sh);
  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1] || '';

  const id = state.nextBulbId++;
  const bulb: Bulb = {
    ...createDefaultBulb(id),
    name: `Snippit${id}`,
    parent: 'Backglass',
    locX: sx,
    locY: sy,
    width: sw,
    height: sh,
    isImageSnippet: true,
    imageData: base64,
  };

  undoManager.beginUndo('Add Snippit');
  undoManager.markBulbForCreate(id);
  state.currentData.illumination.unshift(bulb);
  undoManager.endUndo();

  state.selectedBulbIds.clear();
  state.selectedScoreIds.clear();
  state.selectedBulbIds.add(id);
  state.primarySelection = { type: 'bulb', id };
  render();
  updatePropertiesPanel();
  updateAllLists();
  appendConsoleLine(`Created snippet from backglass region ${sw}x${sh}`, 'info');
}

function toggleAddSnippetMode(): void {
  if (!state.backgroundImage) {
    appendConsoleLine('Import a backglass image first.', 'warn');
    return;
  }
  showAddSnippetChooser();
}

function showAddSnippetChooser(): void {
  const bodyHtml = `
    <p style="margin-bottom:12px;font-size:12px;color:var(--text-secondary)">Choose how to create the snippet:</p>
    <div class="prop-row prop-row-buttons">
      <button class="prop-btn" id="snippet-from-region">Capture from Backglass Region</button>
    </div>
    <div class="prop-row prop-row-buttons">
      <button class="prop-btn" id="snippet-from-file">Pick Image File...</button>
    </div>
  `;
  const handle = showModal({
    id: 'add-snippet-modal',
    title: 'Add Snippet',
    contentClass: 'add-snippet-content',
    bodyHtml,
    okLabel: null,
    cancelLabel: 'Cancel',
  });
  handle.el.querySelector('#snippet-from-region')?.addEventListener('click', () => {
    handle.close();
    state.addSnippet = true;
    state.snippetDrag = null;
    state.activeTab = 'backglass';
    state.showIlluminationFrames = true;
    const canvas = elements.canvas;
    if (canvas) canvas.style.cursor = 'crosshair';
    appendConsoleLine('Drag a region on the backglass to capture as a snippet. Esc to cancel.', 'info');
    render();
  });
  handle.el.querySelector('#snippet-from-file')?.addEventListener('click', () => {
    handle.close();
    void createSnippetFromImageFile();
  });
}

async function createSnippetFromImageFile(): Promise<void> {
  const platform = getPlatform();
  const files = await platform.dialogs.showOpenDialogMultiple({
    title: 'Add illumination snippit images',
    filters: IMAGE_FILTERS,
    readContents: true,
  });
  if (files.length === 0) return;
  const items: { name: string; base64: string; img: HTMLImageElement }[] = [];
  for (const f of files) {
    if (!f.binaryContent) continue;
    const base64 = uint8ArrayToBase64(f.binaryContent);
    try {
      const img = await loadImageFromBase64(detectImageFormat(base64), base64);
      items.push({ name: fileBaseName(f.filePath), base64, img });
    } catch {
      appendConsoleLine(`Can't load or use this image file (${f.filePath}).`, 'error');
    }
  }
  if (items.length === 0) return;

  const bodyHtml = `
    <div class="prop-group">
      <div class="prop-row"><label class="prop-label">Images</label><span style="flex:1;font-size:11px;">${items.map(i => escapeHtmlText(i.name)).join(', ')}</span></div>
      <div class="prop-row">
        <label class="prop-label">Location</label>
        <input type="number" class="prop-input prop-input-half" id="snip-x" value="0" title="X">
        <input type="number" class="prop-input prop-input-half" id="snip-y" value="0" title="Y">
      </div>
    </div>`;
  showModal({
    id: 'add-snippit-location-modal',
    title: 'Add snippit',
    bodyHtml,
    okLabel: 'Apply',
    onOk: modal => {
      const x = parseInt((modal.querySelector('#snip-x') as HTMLInputElement).value, 10) || 0;
      const y = parseInt((modal.querySelector('#snip-y') as HTMLInputElement).value, 10) || 0;
      addSnippetBulbs(items, x, y);
    },
  });
}

function escapeHtmlText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function toggleLeftPanelSection(sectionId: string): void {
  const section = document.getElementById(sectionId);
  if (!section) return;
  const handle = section.nextElementSibling;
  const hidden = section.classList.toggle('panel-hidden');
  if (handle && handle.classList.contains('section-resize-handle')) {
    handle.classList.toggle('panel-hidden', hidden);
  }
}

function toggleScoreFrames(): void {
  state.showScoreFrames = !state.showScoreFrames;
  defaultFrameVisibility.scores = state.showScoreFrames;
  if (!state.showScoreFrames) {
    state.selectedScoreIds.clear();
    if (state.primarySelection?.type === 'score') {
      state.primarySelection = null;
    }
    updatePropertiesPanel();
    updateAllLists();
  }
  syncToggleButtons();
  pushMenuState();
  if (window.vpxB2sDesignerAPI) {
    window.vpxB2sDesignerAPI.saveSettings({ showScoreFrames: state.showScoreFrames });
  }
  render();
}

function toggleScoring(): void {
  state.showScoring = !state.showScoring;
  syncToggleButtons();
  pushMenuState();
  render();
}

function toggleIlluminationFrames(): void {
  state.showIlluminationFrames = !state.showIlluminationFrames;
  defaultFrameVisibility.bulbs = state.showIlluminationFrames;
  if (window.vpxB2sDesignerAPI) {
    void window.vpxB2sDesignerAPI.saveSettings({ showIlluminationFrames: state.showIlluminationFrames });
  }
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
  updateStatusInfo();
  pushMenuState();
}

function closeFile(): void {
  resetState();
  clearBulbImageCache();
  clearReelRenderCaches();
  invalidateSpriteCache();
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
  void (async () => {
    const settings = window.vpxB2sDesignerAPI ? await window.vpxB2sDesignerAPI.getSettings() : null;
    showProjectSettingsDialog({
      mode: 'new',
      data: createEmptyDirectB2S(),
      latestAuthor: settings?.latestAuthor,
      onPickTableFile: pickVpTableFile,
      onOk: s => {
        resetState();
        clearBulbImageCache();
        clearReelRenderCaches();
        invalidateSpriteCache();
        undoManager.clear();
        Object.assign(state.currentData, s);
        if (window.vpxB2sDesignerAPI) void window.vpxB2sDesignerAPI.saveSettings({ latestAuthor: s.author });
        applyDefaultFrameVisibility();
        setUIEnabled(true);
        zoomToFit();
        updatePropertiesPanel();
        updateAllLists();
        updateFileDisplay('Untitled');
        markClean();
        appendConsoleLine(`New project '${s.name}' created`, 'info');
      },
    });
  })();
}

async function loadFile(path: string, content: string): Promise<void> {
  try {
    const parsed = parseDirectB2SWithWarnings(content);
    state.currentData = parsed.data;
    if (!state.currentData.vsName) {
      state.currentData.vsName = fileBaseName(path);
    }
    for (const w of parsed.warnings) appendConsoleLine(w, 'warn');
    state.currentFilePath = path;
    clearSelection();
    clearBulbImageCache();
    clearReelRenderCaches();
    invalidateSpriteCache();
    updateNextIds();
    undoManager.clear();
    undoManager.setSavePoint();

    state.activeTab = 'backglass';

    await loadBackgroundImage();
    loadDmdImage();
    loadIlluminationImages();

    applyDefaultFrameVisibility();
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

async function reloadBackglassImage(): Promise<void> {
  const main = getMainBackgroundImage(state.currentData.images);
  if (!main) return;
  const api = window.vpxB2sDesignerAPI;
  const platform = getPlatform();
  const bytes = api?.readBinaryFile && main.fileName ? await api.readBinaryFile(main.fileName) : null;
  if (!bytes) {
    await platform.dialogs.showMessageBox({
      type: 'error',
      message: `Can't reload the background picture because I can't find it at location '${main.fileName}'. You have to reimport the image.`,
      buttons: ['OK'],
    });
    return;
  }
  try {
    const base64 = uint8ArrayToBase64(bytes);
    const img = await loadImageFromBase64(detectImageFormat(base64), base64);
    const oldW = state.backgroundImage?.width || img.naturalWidth;
    const oldH = state.backgroundImage?.height || img.naturalHeight;
    let data = base64;
    let finalImg = img;
    if (img.naturalWidth !== oldW || img.naturalHeight !== oldH) {
      const resized = await resizeImageData(base64, oldW, oldH);
      data = resized.resizedData;
      finalImg = resized.resizedImage;
    }
    undoManager.beginUndo('Reload backglass image');
    undoManager.markImagesForUndo();
    main.imageData = data;
    state.backgroundImage = finalImg;
    undoManager.endUndo();
    markDirty();
    clearBulbImageCache();
    invalidateSpriteCache();
    render();
    updateAllLists();
    appendConsoleLine('Backglass image reloaded from file', 'info');
  } catch (err) {
    appendConsoleLine(`Failed to reload backglass image: ${err}`, 'error');
  }
}

async function rescaleItemsToNewImage(oldW: number, oldH: number, newW: number, newH: number): Promise<void> {
  if (oldW <= 0 || oldH <= 0 || (oldW === newW && oldH === newH)) return;
  const platform = getPlatform();
  const answer = await platform.dialogs.showMessageBox({
    type: 'question',
    message: 'Do you want to move and resize all the bulb, reel and LED infos matching the new background image?',
    buttons: ['Yes', 'No'],
    defaultId: 0,
  });
  if (answer !== 0) return;
  const sx = newW / oldW;
  const sy = newH / oldH;
  undoManager.markAllBulbsForUndo('Backglass');
  undoManager.markAllScoresForUndo('Backglass');
  undoManager.markGrillHeightsForUndo();
  for (const bulb of state.currentData.illumination) {
    if (bulb.parent === 'DMD') continue;
    bulb.locX = Math.round(bulb.locX * sx);
    bulb.locY = Math.round(bulb.locY * sy);
    bulb.width = Math.round(bulb.width * sx);
    bulb.height = Math.round(bulb.height * sy);
  }
  for (const score of state.currentData.scores) {
    if (score.parent === 'DMD') continue;
    score.locX = Math.round(score.locX * sx);
    score.locY = Math.round(score.locY * sy);
    score.width = Math.round(score.width * sx);
    score.height = Math.round(score.height * sy);
  }
  state.currentData.grillHeight = Math.round(state.currentData.grillHeight * sy);
  state.currentData.smallGrillHeight = Math.round(state.currentData.smallGrillHeight * sy);
}

async function loadBackgroundImage(): Promise<void> {
  const main = getMainBackgroundImage(state.currentData.images);
  if (main) {
    const imgData = main.imageData;
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
  state.currentData.images.illuminatedImages.forEach((img, index) => {
    if (img.imageData) {
      const mimeType = detectImageFormat(img.imageData);
      const image = new Image();
      image.onload = () => {
        state.illuminationImages.set(illuminationImageKey(img.fileName, index), image);
        invokeCallback('render');
        updateAllLists();
      };
      image.src = `data:${mimeType};base64,${img.imageData}`;
    }
  });
}

function reloadImagesFromData(): void {
  const main = getMainBackgroundImage(state.currentData.images);
  if (main && main.imageData) {
    const imgData = main.imageData;
    const mimeType = detectImageFormat(imgData);
    loadImageFromBase64(mimeType, imgData).then(img => {
      state.backgroundImage = img;
      clearBulbImageCache();
      invalidateSpriteCache();
      pushMenuState();
      updateStatusInfo();
      requestRender();
    });
  } else {
    state.backgroundImage = null;
    pushMenuState();
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

  const currentKeys = new Set(
    state.currentData.images.illuminatedImages.map((i, idx) => illuminationImageKey(i.fileName, idx))
  );
  for (const key of state.illuminationImages.keys()) {
    if (!currentKeys.has(key)) {
      state.illuminationImages.delete(key);
    }
  }
  state.currentData.images.illuminatedImages.forEach((img, idx) => {
    const key = illuminationImageKey(img.fileName, idx);
    if (img.imageData && !state.illuminationImages.has(key)) {
      const mimeType = detectImageFormat(img.imageData);
      const image = new Image();
      image.onload = () => {
        state.illuminationImages.set(key, image);
        requestRender();
      };
      image.src = `data:${mimeType};base64,${img.imageData}`;
    }
  });
  if (
    state.selectedIlluminationImage !== null &&
    state.selectedIlluminationImage >= state.currentData.images.illuminatedImages.length
  ) {
    state.selectedIlluminationImage = null;
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

    const previous = state.backgroundImage;
    if (previous) {
      await rescaleItemsToNewImage(previous.width, previous.height, img.naturalWidth, img.naturalHeight);
    }

    const fileName = result.filePath;
    state.currentData.images.backgroundImages.unshift({
      fileName,
      romId: 0,
      romIdType: 'NotUsed',
      type: 'Main',
      imageData: base64,
    });
    state.backgroundImage = img;
    if (!state.currentData.images.thumbnailImage) {
      state.currentData.images.thumbnailImage = undefined;
    }

    undoManager.endUndo();
    markDirty();
    clearBulbImageCache();
    invalidateSpriteCache();
    if (state.activeTab !== 'backglass') switchTab('backglass');
    else zoomToFit();
    pushMenuState();
    updateStatusInfo();
    render();
    updateAllLists();
    updatePropertiesPanel();
    appendConsoleLine(`Imported backglass image: ${fileBaseName(fileName)}`, 'info');
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

    const fileName = result.filePath;

    undoManager.beginUndo('Import illumination image');
    undoManager.markImagesForUndo();

    state.currentData.images.illuminatedImages.push({
      fileName,
      imageData: base64,
    });

    const key = illuminationImageKey(fileName, state.currentData.images.illuminatedImages.length - 1);
    img.onload = () => {
      state.illuminationImages.set(key, img);
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

    const fileName = result.filePath;
    state.currentData.images.dmdImages.unshift({
      fileName,
      imageData: base64,
    });
    state.dmdImage = img;

    undoManager.endUndo();
    markDirty();
    switchTab('dmd');
    render();
    updateAllLists();
    appendConsoleLine(`Imported DMD image: ${fileBaseName(fileName)}`, 'info');
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

async function saveBackupAs(): Promise<void> {
  if (!window.vpxB2sDesignerAPI || !state.currentData) return;
  const content = await serializeCurrentData();
  const result = await window.vpxB2sDesignerAPI.saveFileAs(content);
  if (result) {
    appendConsoleLine(`Backup saved: ${result.path}`, 'success');
  }
}

async function openBackupFile(): Promise<void> {
  const platform = getPlatform();
  const result = await platform.dialogs.showOpenDialog({
    title: 'Open Backup',
    filters: [{ name: 'DirectB2S Files', extensions: ['directb2s', 'bak'] }],
    readContents: true,
  });
  if (!result) return;
  let text = result.content;
  if (!text && result.binaryContent) text = new TextDecoder().decode(result.binaryContent);
  if (!text) return;
  await loadFile(result.filePath, text);
}

async function importBackglassFile(): Promise<void> {
  const platform = getPlatform();
  const settings = window.vpxB2sDesignerAPI ? await window.vpxB2sDesignerAPI.getSettings() : null;
  const result = await platform.dialogs.showOpenDialog({
    title: "Import 'directB2S' backglass file",
    filters: [{ name: 'DirectB2S Files', extensions: ['directb2s'] }],
    defaultPath: settings?.latestImportDirectory,
    readContents: true,
  });
  if (!result) return;
  let text = result.content;
  if (!text && result.binaryContent) text = new TextDecoder().decode(result.binaryContent);
  if (!text) return;
  if (window.vpxB2sDesignerAPI && /[\\/]/.test(result.filePath)) {
    void window.vpxB2sDesignerAPI.saveSettings({
      latestImportDirectory: result.filePath.replace(/[\\/][^\\/]*$/, ''),
    });
  }
  await loadFile(result.filePath, text);
}

async function saveFile(): Promise<void> {
  if (!window.vpxB2sDesignerAPI) return;

  const content = await serializeCurrentData();

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

function setupDragAndDrop(): void {
  const target = document.getElementById('app') || document.body;

  target.addEventListener('dragover', (e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    target.classList.add('drag-over');
  });

  target.addEventListener('dragleave', (e: DragEvent) => {
    if (e.target === target) target.classList.remove('drag-over');
  });

  target.addEventListener('drop', async (e: DragEvent) => {
    e.preventDefault();
    target.classList.remove('drag-over');
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    let dropWorld: { x: number; y: number } | null = null;
    const canvas = elements.canvas;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
        dropWorld = screenToWorld(e.clientX, e.clientY);
      }
    }

    const snippets: { name: string; base64: string; img: HTMLImageElement }[] = [];
    for (const file of Array.from(files)) {
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.directb2s')) {
        const text = await file.text();
        await loadFile(file.name, text);
        continue;
      }
      if (lower.endsWith('.b2s') || lower.endsWith('.b2b')) {
        appendConsoleLine(
          `B2S project files (${file.name}) are not supported. Open a .directb2s file instead.`,
          'warn'
        );
        continue;
      }
      if (file.type.startsWith('image/')) {
        if (!state.hasFile) {
          appendConsoleLine('Open or create a backglass file before dropping images.', 'warn');
          continue;
        }
        const buf = await file.arrayBuffer();
        const base64 = uint8ArrayToBase64(new Uint8Array(buf));
        const img = await loadImageFromBase64(detectImageFormat(base64), base64);
        snippets.push({ name: fileBaseName(file.name), base64, img });
        continue;
      }
      appendConsoleLine(`Unsupported file type: ${file.name}`, 'warn');
    }

    if (snippets.length > 0) {
      const image = state.activeTab === 'dmd' ? state.dmdImage : state.backgroundImage;
      let x = 0;
      let y = 0;
      if (
        dropWorld &&
        image &&
        dropWorld.x >= 0 &&
        dropWorld.y >= 0 &&
        dropWorld.x <= image.width &&
        dropWorld.y <= image.height
      ) {
        x = dropWorld.x;
        y = dropWorld.y;
      }
      addSnippetBulbs(snippets, x, y);
    }
  });
}

function addSnippetBulbs(items: { name: string; base64: string; img: HTMLImageElement }[], x: number, y: number): void {
  const parent: 'Backglass' | 'DMD' = state.activeTab === 'dmd' ? 'DMD' : 'Backglass';
  if (!state.showIlluminationFrames) {
    state.showIlluminationFrames = true;
    syncToggleButtons();
    pushMenuState();
  }
  undoManager.beginUndo(items.length === 1 ? 'Add Snippit' : `Add ${items.length} Snippits`);
  const ids: number[] = [];
  for (const item of items) {
    const id = state.nextBulbId++;
    const bulb = createSnippetBulb(
      id,
      item.name,
      item.base64,
      item.img.naturalWidth,
      item.img.naturalHeight,
      x,
      y,
      parent
    );
    undoManager.markBulbForCreate(id);
    state.currentData.illumination.unshift(bulb);
    bulbImageCache.set(id, item.img);
    ids.push(id);
  }
  undoManager.endUndo();
  state.selectedBulbIds.clear();
  state.selectedScoreIds.clear();
  for (const id of ids) state.selectedBulbIds.add(id);
  state.primarySelection = { type: 'bulb', id: ids[0] };
  render();
  updatePropertiesPanel();
  updateAllLists();
  appendConsoleLine(
    `Added ${ids.length} snippit${ids.length === 1 ? '' : 's'} at (${Math.round(x)}, ${Math.round(y)})`,
    'info'
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
