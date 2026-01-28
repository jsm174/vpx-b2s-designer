import { state, elements, getBulbById, getScoreById, markDirty } from './state';
import { getEditable } from './parts';
import { dodgeColorFromIndex } from './parts/bulb';
import { undoManager } from './undo';
import { render, requestRender, updateCountsDisplay } from './canvas-renderer';
import { invokeCallback } from '../shared/callbacks';
import { updateResourcesPanel } from './resources-panel';
import type { Bulb, ScoreInfo, Color } from '../types/data';
import { B2S_ID_TYPES } from '../types/data';
import { bulbPassesFilter } from './bulb-filter';
import { applyScoreTypeRules } from './score-rules';
import { getRenderedLedImage } from './reel-render';
import { DEFAULT_REEL_COLOR, getMainBackgroundImage } from '../types/data';
import { activateResource, exportResourceImage } from './resources-panel';
import { getPlatform } from '../platform';

export function updatePropertiesPanel(): void {
  const { propertiesPanel } = elements;
  if (!propertiesPanel) return;

  if (!state.hasFile) {
    propertiesPanel.innerHTML = '<p class="empty-state">Create a new project or open a directB2S file</p>';
    return;
  }

  if (state.selectedBulbIds.size === 0 && state.selectedScoreIds.size === 0 && state.selectedResource) {
    propertiesPanel.innerHTML = getResourceProperties();
    setupResourcePropertyListeners();
    return;
  }

  if (state.selectedBulbIds.size === 0 && state.selectedScoreIds.size === 0) {
    propertiesPanel.innerHTML = getBackglassProperties();
    setupBackglassPropertyListeners();
    return;
  }

  if (state.selectedBulbIds.size === 1 && state.selectedScoreIds.size === 0) {
    const bulbId = Array.from(state.selectedBulbIds)[0];
    const bulb = getBulbById(bulbId);
    if (!bulb) return;

    const bulbEditable = getEditable('Bulb');
    if (bulbEditable) {
      propertiesPanel.innerHTML = bulbEditable.getProperties(bulb);
      setupPropertyListeners('bulb', bulbId);
    }
    return;
  }

  if (state.selectedScoreIds.size === 1 && state.selectedBulbIds.size === 0) {
    const scoreId = Array.from(state.selectedScoreIds)[0];
    const score = getScoreById(scoreId);
    if (!score) return;

    const scoreEditable = getEditable('Score');
    if (scoreEditable) {
      propertiesPanel.innerHTML = scoreEditable.getProperties(score);
      setupPropertyListeners('score', scoreId);
    }
    return;
  }

  const totalSelected = state.selectedBulbIds.size + state.selectedScoreIds.size;
  propertiesPanel.innerHTML = `<p class="empty-state">${totalSelected} items selected</p>`;
}

function setupPropertyListeners(type: 'bulb' | 'score', id: number): void {
  const { propertiesPanel } = elements;
  if (!propertiesPanel) return;

  const inputs = propertiesPanel.querySelectorAll('[data-prop]');
  inputs.forEach(input => {
    const element = input as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    const prop = element.dataset.prop!;

    if (element.dataset.scope === 'backglass') {
      const cur = (state.currentData as unknown as Record<string, unknown>)[prop];
      if (cur !== undefined && cur !== null) (element as HTMLInputElement).value = String(cur);
      element.addEventListener('change', () => {
        applyBackglassPropertyChange(prop, element);
      });
      return;
    }

    element.addEventListener('change', () => {
      applyPropertyChange(type, id, prop, element);
    });

    if (
      element.type === 'range' ||
      element.type === 'text' ||
      element.type === 'number' ||
      element.tagName === 'TEXTAREA'
    ) {
      element.addEventListener('input', () => {
        applyPropertyChange(type, id, prop, element, true);
      });
    }
  });

  propertiesPanel.querySelectorAll<HTMLCanvasElement>('canvas.reel-option-led').forEach(c => {
    const data = state.currentData;
    const img = getRenderedLedImage(
      c.dataset.ledType || 'RenderedLED8',
      data.reelColor || DEFAULT_REEL_COLOR,
      data.useDream7LEDs,
      data.d7Thickness,
      data.d7Shear,
      data.d7Glow,
      c.width,
      c.height
    );
    if (img) c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
  });

  const reelOptions = propertiesPanel.querySelectorAll('.reel-option[data-reel]');
  reelOptions.forEach(option => {
    option.addEventListener('click', () => {
      const reelType = (option as HTMLElement).dataset.reel;
      if (reelType && type === 'score') {
        applyReelTypeChange(id, reelType);
      }
    });
  });

  propertiesPanel.querySelectorAll('[data-action]').forEach(el => {
    const btn = el as HTMLButtonElement;
    const action = btn.dataset.action!;
    btn.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('properties-action', { detail: { action, type, id } }));
    });
  });
}

function applyReelTypeChange(id: number, reelType: string): void {
  undoManager.beginUndo('Change reel type');
  undoManager.markScoreForUndo(id);

  const score = getScoreById(id);
  if (score) {
    score.reelType = reelType;
    if (state.currentData.reelColor) score.reelColor = { ...state.currentData.reelColor };
  }

  undoManager.endUndo();
  render();
  updatePropertiesPanel();
  invokeCallback('dataChanged');
}

function applyPropertyChange(
  type: 'bulb' | 'score',
  id: number,
  prop: string,
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  preview = false
): void {
  const value = getInputValue(element);
  if (value === undefined) return;

  if (!preview) {
    undoManager.beginUndo(`Change ${prop}`);
    if (type === 'bulb') {
      undoManager.markBulbForUndo(id);
    } else {
      undoManager.markScoreForUndo(id);
    }
  }

  let needsAsyncRules = false;
  if (type === 'bulb' && prop === 'id') {
    const bulb = getBulbById(id);
    const newId = typeof value === 'number' ? value : parseInt(String(value), 10) || 0;
    if (!bulb || preview) return;
    if (newId <= 0 || (newId !== id && getBulbById(newId))) {
      undoManager.cancelUndo();
      (element as HTMLInputElement).value = String(id);
      return;
    }
    if (newId === id) {
      undoManager.cancelUndo();
      return;
    }
    undoManager.markBulbForCreate(newId);
    bulb.id = newId;
    state.selectedBulbIds.delete(id);
    state.selectedBulbIds.add(newId);
    if (state.primarySelection?.type === 'bulb' && state.primarySelection.id === id) {
      state.primarySelection = { type: 'bulb', id: newId };
    }
    if (state.nextBulbId <= newId) state.nextBulbId = newId + 1;
    undoManager.endUndo();
    render();
    updateIlluminationList();
    updatePropertiesPanel();
    invokeCallback('dataChanged');
    return;
  }
  if (type === 'bulb') {
    const bulb = getBulbById(id);
    if (bulb) {
      setProperty(bulb, prop, value);
      applyBulbRules(bulb, prop, element);
      if (prop === 'initialState' || prop === 'intensity' || prop === 'lightColor' || prop === 'dodgeColorIndex') {
        state.lastBulb = {
          ...state.lastBulb,
          intensity: bulb.intensity,
          lightColor: bulb.lightColor,
          dodgeColor: bulb.dodgeColor,
          initialState: bulb.initialState,
        };
      }
    }
  } else {
    const score = getScoreById(id);
    if (score) {
      setProperty(score, prop, value);
      if (!preview && (prop === 'b2sScoreType' || prop === 'b2sPlayerNo' || prop === 'b2sStartDigit')) {
        needsAsyncRules = true;
        undoManager.markAllScoresForUndo();
        void applyScoreTypeRules(state.currentData, score, prop, {
          askYesNo: async message =>
            (await getPlatform().dialogs.showMessageBox({ type: 'question', message, buttons: ['Yes', 'No'] })) === 0,
        }).then(() => {
          undoManager.endUndo();
          render();
          updatePropertiesPanel();
          updateAllLists();
          invokeCallback('dataChanged');
        });
      }
    }
  }

  if (!preview) {
    if (!needsAsyncRules) undoManager.endUndo();
  } else {
    markDirty();
  }
  if (needsAsyncRules) return;

  if (preview) {
    requestRender();
  } else {
    render();
  }
  updateIlluminationList();
  if (!preview) {
    updatePropertiesPanel();
  }
  invokeCallback('dataChanged');
}

function applyBulbRules(
  bulb: Bulb,
  prop: string,
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
): void {
  if (prop === 'romId' && bulb.romId > 0 && bulb.romIdType === 'NotUsed') {
    bulb.romIdType = 'Lamp';
  }
  if (prop === 'b2sId') {
    bulb.b2sIdType = 0;
  }
  if (prop === 'b2sIdType') {
    const t = B2S_ID_TYPES.find(x => x.value === bulb.b2sIdType);
    if (t && t.value > 0) bulb.b2sId = t.id;
  }
  if (prop === 'width' || prop === 'height') {
    if (bulb.width < 10) bulb.width = 10;
    if (bulb.height < 10) bulb.height = 10;
  }
  if (prop === 'zOrder') {
    bulb.zOrder = Math.max(0, Math.min(19, bulb.zOrder));
  }
  if (element.dataset.nonzero !== undefined && typeof (bulb as unknown as Record<string, unknown>)[prop] === 'number') {
    const n = (bulb as unknown as Record<string, number>)[prop];
    if (!n) element.value = '';
  }
}

function getInputValue(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): unknown {
  if (element.tagName === 'TEXTAREA') {
    return element.value.replace(/\r?\n/g, '\r\n');
  }
  if (element.type === 'number' || element.type === 'range' || element.dataset.nonzero !== undefined) {
    return parseInt(element.value, 10) || 0;
  }
  if (element.type === 'color') {
    return hexToRgb(element.value);
  }
  if (element.type === 'checkbox') {
    return (element as HTMLInputElement).checked;
  }
  if (element.type === 'radio') {
    const radio = element as HTMLInputElement;
    if (!radio.checked) return undefined;
    const numVal = parseInt(radio.value, 10);
    return Number.isNaN(numVal) ? radio.value : numVal;
  }
  if (element.tagName === 'SELECT') {
    const sel = element as HTMLSelectElement;
    const numVal = parseInt(sel.value, 10);
    if (!Number.isNaN(numVal) && String(numVal) === sel.value) return numVal;
    return sel.value;
  }
  return element.value;
}

function setProperty(item: Bulb | ScoreInfo, prop: string, value: unknown): void {
  if (prop === 'lightColor' && 'lightColor' in item) {
    item.lightColor = value as Color;
  } else if (prop === 'reelColor' && 'reelColor' in item) {
    item.reelColor = value as Color;
  } else if (prop === 'dodgeColorIndex' && 'lightColor' in item) {
    const idx = typeof value === 'number' ? value : parseInt(value as string, 10);
    (item as Bulb).dodgeColor = dodgeColorFromIndex(idx);
  } else if (prop === 'visible' && typeof value === 'string') {
    (item as unknown as Record<string, unknown>)[prop] = value === 'true';
  } else if (prop === 'dream7Override' && 'reelType' in item) {
    const score = item as ScoreInfo;
    if (value) {
      score.reelType = 'Dream7LED8';
    } else {
      score.reelType = 'EMR_T1_0';
    }
  } else {
    (item as unknown as Record<string, unknown>)[prop] = value;
  }
}

function hexToRgb(hex: string): Color {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
      a: 255,
    };
  }
  return { r: 255, g: 255, b: 255, a: 255 };
}

export function updateIlluminationList(): void {
  const { illuminationList } = elements;
  if (!illuminationList) return;

  const parentFilter = state.activeTab === 'dmd' ? 'DMD' : 'Backglass';
  const filteredBulbs = state.currentData.illumination.filter(
    b => b.parent === parentFilter && bulbPassesFilter(b, state.lampFilter, state.currentData.commType)
  );

  illuminationList.innerHTML = filteredBulbs
    .map(
      bulb => `
      <div class="list-item ${state.selectedBulbIds.has(bulb.id) ? 'selected' : ''}" data-type="bulb" data-id="${bulb.id}">
        <span class="item-color" style="background: rgb(${bulb.lightColor.r},${bulb.lightColor.g},${bulb.lightColor.b})"></span>
        <span class="item-name">${bulb.name || `Bulb ${bulb.id}`}</span>
      </div>
    `
    )
    .join('');

  setupListClickHandlers(illuminationList, 'bulb');
}

export function updateScoresList(): void {
  const { scoresList } = elements;
  if (!scoresList) return;

  const parentFilter = state.activeTab === 'dmd' ? 'DMD' : 'Backglass';
  const filteredScores = state.currentData.scores.filter(s => s.parent === parentFilter);

  scoresList.innerHTML = filteredScores
    .map(
      score => `
      <div class="list-item ${state.selectedScoreIds.has(score.id) ? 'selected' : ''}" data-type="score" data-id="${score.id}">
        <span class="item-icon">&#9733;</span>
        <span class="item-name">Score ${score.id} (${score.digits} digits)</span>
      </div>
    `
    )
    .join('');

  setupListClickHandlers(scoresList, 'score');
}

export function updateAnimationsList(): void {
  const { animationsList } = elements;
  if (!animationsList) return;

  animationsList.innerHTML = state.currentData.animations
    .map(
      anim => `
      <div class="list-item" data-type="animation" data-name="${anim.name}">
        <span class="item-icon">&#9654;</span>
        <span class="item-name">${anim.name}</span>
        <span class="item-count">${anim.steps.length} steps</span>
      </div>
    `
    )
    .join('');

  animationsList.querySelectorAll('.list-item').forEach(item => {
    item.addEventListener('contextmenu', e => {
      e.preventDefault();
      const name = (item as HTMLElement).dataset.name;
      if (name) {
        window.dispatchEvent(
          new CustomEvent('animation-context-menu', {
            detail: { name, x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY },
          })
        );
      }
    });
    item.addEventListener('dblclick', () => {
      const name = (item as HTMLElement).dataset.name;
      if (name) {
        const animation = state.currentData.animations.find(a => a.name === name);
        if (animation) {
          window.dispatchEvent(new CustomEvent('open-animation-editor', { detail: { animation, isNew: false } }));
        }
      }
    });
  });
}

function setupListClickHandlers(container: HTMLElement, type: 'bulb' | 'score'): void {
  container.querySelectorAll('.list-item').forEach(item => {
    item.addEventListener('click', e => {
      const id = parseInt((e.currentTarget as HTMLElement).dataset.id!, 10);
      const shiftKey = (e as MouseEvent).shiftKey;

      if (type === 'bulb') {
        if (!shiftKey) {
          state.selectedBulbIds.clear();
          state.selectedScoreIds.clear();
        }
        state.selectedBulbIds.add(id);
        state.primarySelection = { type: 'bulb', id };
      } else {
        if (!shiftKey) {
          state.selectedBulbIds.clear();
          state.selectedScoreIds.clear();
        }
        state.selectedScoreIds.add(id);
        state.primarySelection = { type: 'score', id };
      }

      render();
      updatePropertiesPanel();
      updateIlluminationList();
      updateScoresList();
      invokeCallback('selectionChanged');
    });
  });
}

export function updateAllLists(): void {
  updateIlluminationList();
  updateScoresList();
  updateAnimationsList();
  updateResourcesPanel();
  updateCountsDisplay();
}

function getBackglassProperties(): string {
  const data = state.currentData;
  const isDmd = state.activeTab === 'dmd';
  const image = isDmd ? state.dmdImage : state.backgroundImage;
  const imageWidth = image?.width || 0;
  const imageHeight = image?.height || 0;

  if (isDmd) {
    return `
      <div class="prop-group">
        <div class="prop-row">
          <span class="prop-label">Size</span>
          <span style="flex:1;font-size:11px;">${imageWidth} × ${imageHeight}</span>
        </div>
        <div class="prop-row">
          <span class="prop-label">Default X</span>
          <input type="number" class="prop-input" data-prop="dmdDefaultLocationX" value="${data.dmdDefaultLocationX}">
        </div>
        <div class="prop-row">
          <span class="prop-label">Default Y</span>
          <input type="number" class="prop-input" data-prop="dmdDefaultLocationY" value="${data.dmdDefaultLocationY}">
        </div>
      </div>
    `;
  }

  const filename = state.currentFilePath ? state.currentFilePath.split(/[\\/]/).pop() || '' : '';

  return `
    <div class="prop-group">
      <div class="prop-row">
        <label class="prop-label">File Name</label>
        <input type="text" class="prop-input" value="${escapeHtml(filename)}" disabled>
      </div>
      <div class="prop-row">
        <label class="prop-label">Size</label>
        <span style="flex:1;font-size:11px;">${imageWidth} × ${imageHeight}</span>
      </div>
      <div class="prop-row">
        <label class="prop-label">Name</label>
        <input type="text" class="prop-input" data-prop="name" value="${escapeHtml(data.name)}">
      </div>
      <div class="prop-row">
        <label class="prop-label">Game</label>
        <input type="text" class="prop-input" data-prop="gameName" value="${escapeHtml(data.gameName)}">
      </div>
      <div class="prop-row">
        <label class="prop-label">Table</label>
        <select class="prop-input" data-prop="tableType">
          <option value="EM" ${data.tableType === 'EM' ? 'selected' : ''}>EM</option>
          <option value="SS" ${data.tableType === 'SS' ? 'selected' : ''}>SS</option>
          <option value="SSDMD" ${data.tableType === 'SSDMD' ? 'selected' : ''}>SS + DMD</option>
          <option value="ORI" ${data.tableType === 'ORI' ? 'selected' : ''}>Original</option>
        </select>
      </div>
      <div class="prop-row">
        <input type="checkbox" data-prop="addEMDefaults" id="bg-add-em" ${data.addEMDefaults ? 'checked' : ''}>
        <label for="bg-add-em" class="prop-label-inline">Add EM Defaults</label>
      </div>
    </div>

    <div class="prop-divider"></div>

    <div class="prop-group">
      <div class="prop-row">
        <label class="prop-label">Author</label>
        <input type="text" class="prop-input" data-prop="author" value="${escapeHtml(data.author)}">
      </div>
      <div class="prop-row">
        <label class="prop-label">Artwork</label>
        <input type="text" class="prop-input" data-prop="artwork" value="${escapeHtml(data.artwork)}">
      </div>
    </div>

    <div class="prop-divider"></div>

    <div class="prop-group">
      <div class="prop-row">
        <label class="prop-label">Players</label>
        <select class="prop-input" data-prop="numberOfPlayers">
          <option value="1" ${data.numberOfPlayers === 1 ? 'selected' : ''}>1</option>
          <option value="2" ${data.numberOfPlayers === 2 ? 'selected' : ''}>2</option>
          <option value="3" ${data.numberOfPlayers === 3 ? 'selected' : ''}>3</option>
          <option value="4" ${data.numberOfPlayers === 4 ? 'selected' : ''}>4</option>
          <option value="5" ${data.numberOfPlayers === 5 ? 'selected' : ''}>5</option>
          <option value="6" ${data.numberOfPlayers === 6 ? 'selected' : ''}>6</option>
        </select>
      </div>
      <div class="prop-row">
        <input type="checkbox" data-prop="dualBackglass" id="bg-dual" ${data.dualBackglass ? 'checked' : ''}>
        <label for="bg-dual" class="prop-label-inline">Dual Backglass</label>
      </div>
      <div class="prop-row">
        <label class="prop-label">Dest</label>
        <select class="prop-input" data-prop="destType">
          <option value="DirectB2S" ${data.destType === 'DirectB2S' ? 'selected' : ''}>B2S.Server 'directB2S' backglass</option>
          <option value="VisualStudio2010" ${data.destType === 'VisualStudio2010' ? 'selected' : ''}>Microsoft Visual Studio 2010 project</option>
        </select>
      </div>
      <div class="prop-row">
        <label class="prop-label">Comm</label>
        <select class="prop-input" data-prop="commType">
          <option value="ROM" ${data.commType === 'ROM' ? 'selected' : ''}>ROM</option>
          <option value="B2S" ${data.commType === 'B2S' ? 'selected' : ''}>B2S</option>
        </select>
      </div>
      <div class="prop-row">
        <label class="prop-label">DMD</label>
        <select class="prop-input" data-prop="dmdType">
          <option value="NotDefined" ${data.dmdType === 'NotDefined' ? 'selected' : ''}>(not set)</option>
          <option value="NoB2SDMD" ${data.dmdType === 'NoB2SDMD' ? 'selected' : ''}>No 'B2S DMD'</option>
          <option value="B2SAlwaysOnSecondMonitor" ${data.dmdType === 'B2SAlwaysOnSecondMonitor' ? 'selected' : ''}>'B2S DMD' always on Backglass ('second monitor')</option>
          <option value="B2SAlwaysOnThirdMonitor" ${data.dmdType === 'B2SAlwaysOnThirdMonitor' ? 'selected' : ''}>'B2S DMD' only on DMD ('third monitor')</option>
          <option value="B2SOnSecondOrThirdMonitor" ${data.dmdType === 'B2SOnSecondOrThirdMonitor' ? 'selected' : ''}>'B2S DMD' on Backglass or DMD</option>
        </select>
      </div>
      <div class="prop-row">
        <label class="prop-label">Grill Height</label>
        <input type="number" class="prop-input" data-prop="grillHeight" value="${data.grillHeight}" min="0">
      </div>
      <div class="prop-row">
        <label class="prop-label">Mini Grill</label>
        <input type="number" class="prop-input" data-prop="smallGrillHeight" value="${data.smallGrillHeight}" min="0">
      </div>
    </div>

    <div class="prop-divider"></div>

    <div class="prop-group">
      <div class="prop-row">
        <label class="prop-label">VS Name</label>
        <input type="text" class="prop-input" data-prop="vsName" value="${escapeHtml(data.vsName)}">
      </div>
      <div class="prop-row">
        <label class="prop-label">Project ID</label>
        <input type="text" class="prop-input" value="${escapeHtml(data.projectGUID)}" disabled>
      </div>
      <div class="prop-row">
        <label class="prop-label">Assembly</label>
        <input type="text" class="prop-input" value="${escapeHtml(data.assemblyGUID)}" disabled>
      </div>
    </div>
  `;
}

function setupBackglassPropertyListeners(): void {
  const { propertiesPanel } = elements;
  if (!propertiesPanel) return;

  const inputs = propertiesPanel.querySelectorAll('[data-prop]');
  inputs.forEach(input => {
    const element = input as HTMLInputElement | HTMLSelectElement;
    const prop = element.dataset.prop!;

    element.addEventListener('change', () => {
      applyBackglassPropertyChange(prop, element);
    });
  });
}

function applyBackglassPropertyChange(
  prop: string,
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
): void {
  undoManager.beginUndo(`Change ${prop}`);
  undoManager.markGeneralForUndo();

  const value = getInputValue(element);
  if (prop === 'numberOfPlayers' && typeof value === 'number' && (value < 1 || value > 4)) {
    undoManager.cancelUndo();
    updatePropertiesPanel();
    return;
  }
  (state.currentData as unknown as Record<string, unknown>)[prop] = value;

  undoManager.endUndo();
  markDirty();
  if (prop === 'author' && typeof value === 'string' && window.vpxB2sDesignerAPI) {
    void window.vpxB2sDesignerAPI.saveSettings({ latestAuthor: value });
  }
  window.dispatchEvent(new CustomEvent('backglass-property-changed', { detail: { prop } }));
  render();
  if (prop !== 'name' && prop !== 'author' && prop !== 'artwork' && prop !== 'gameName' && prop !== 'vsName') {
    updatePropertiesPanel();
  }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getResourceProperties(): string {
  const sel = state.selectedResource;
  if (!sel) return '';
  const images = state.currentData.images;
  const baseName = (p: string): string => p.split(/[\\/]/).pop() || p;
  if (sel.type === 'background') {
    const img = images.backgroundImages[sel.index];
    if (!img) return '';
    const isMain = img === getMainBackgroundImage(images);
    return `
      <div class="prop-group">
        <div class="prop-row"><span class="prop-label">Background</span><span class="prop-static">${escapeHtml(baseName(img.fileName) || 'image')}${isMain ? ' (current)' : ''}</span></div>
        <div class="prop-row">
          <label class="prop-label">Image type</label>
          <select class="prop-input" data-res-prop="type">
            <option value="Main" ${img.type === 'Main' ? 'selected' : ''}>Standard</option>
            <option value="Off" ${img.type === 'Off' ? 'selected' : ''}>Off image (lights off)</option>
            <option value="On" ${img.type === 'On' ? 'selected' : ''}>On image (lights on)</option>
          </select>
        </div>
        <div class="prop-row">
          <label class="prop-label">ROM ID</label>
          <input type="text" class="prop-input" data-res-prop="romId" value="${img.romId > 0 ? img.romId : ''}">
        </div>
        <div class="prop-row">
          <label class="prop-label">ROM ID type</label>
          <select class="prop-input" data-res-prop="romIdType">
            <option value="NotUsed" ${img.romIdType === 'NotUsed' ? 'selected' : ''}>(not used)</option>
            <option value="Lamp" ${img.romIdType === 'Lamp' ? 'selected' : ''}>Lamp</option>
            <option value="Solenoid" ${img.romIdType === 'Solenoid' ? 'selected' : ''}>Solenoid</option>
            <option value="GIString" ${img.romIdType === 'GIString' ? 'selected' : ''}>GI String</option>
          </select>
        </div>
      </div>
      <div class="prop-divider"></div>
      <div class="prop-group">
        <div class="prop-row prop-row-buttons"><button class="prop-btn" data-res-action="activate" ${isMain ? 'disabled' : ''}>Use as background image</button></div>
        <div class="prop-row prop-row-buttons"><button class="prop-btn" data-res-action="save">Save image as...</button></div>
        <div class="prop-row prop-row-buttons"><button class="prop-btn" data-res-action="delete">Delete image</button></div>
      </div>`;
  }
  if (sel.type === 'dmd') {
    const img = images.dmdImages[sel.index];
    if (!img) return '';
    return `
      <div class="prop-group">
        <div class="prop-row"><span class="prop-label">DMD image</span><span class="prop-static">${escapeHtml(baseName(img.fileName) || 'image')}${sel.index === 0 ? ' (current)' : ''}</span></div>
      </div>
      <div class="prop-divider"></div>
      <div class="prop-group">
        <div class="prop-row prop-row-buttons"><button class="prop-btn" data-res-action="activate">${sel.index === 0 ? 'Show DMD image' : 'Use as DMD image'}</button></div>
        <div class="prop-row prop-row-buttons"><button class="prop-btn" data-res-action="save">Save image as...</button></div>
        <div class="prop-row prop-row-buttons"><button class="prop-btn" data-res-action="delete">Delete image</button></div>
      </div>`;
  }
  if (sel.type === 'illumination') {
    const img = images.illuminatedImages[sel.index];
    if (!img) return '';
    const selected = state.selectedIlluminationImage === sel.index;
    return `
      <div class="prop-group">
        <div class="prop-row"><span class="prop-label">Illumination image</span><span class="prop-static">${escapeHtml(baseName(img.fileName) || `Illumination ${sel.index + 1}`)}</span></div>
        <p class="prop-hint">A pre-rendered lit backglass. When selected, 'Show Illumination' copies each bulb's area from this image.</p>
      </div>
      <div class="prop-divider"></div>
      <div class="prop-group">
        <div class="prop-row prop-row-buttons"><button class="prop-btn" data-res-action="activate">${selected ? 'Deselect' : 'Select for Show Illumination'}</button></div>
        <div class="prop-row prop-row-buttons"><button class="prop-btn" data-res-action="save">Save image as...</button></div>
        <div class="prop-row prop-row-buttons"><button class="prop-btn" data-res-action="delete">Delete image</button></div>
      </div>`;
  }
  const bulb = sel.bulbId !== undefined ? getBulbById(sel.bulbId) : undefined;
  return `
      <div class="prop-group">
        <div class="prop-row"><span class="prop-label">Snippit image</span><span class="prop-static">${escapeHtml(bulb?.name || '')}</span></div>
      </div>
      <div class="prop-divider"></div>
      <div class="prop-group">
        <div class="prop-row prop-row-buttons"><button class="prop-btn" data-res-action="activate">Select snippit frame</button></div>
        <div class="prop-row prop-row-buttons"><button class="prop-btn" data-res-action="save">Save image as...</button></div>
      </div>`;
}

function setupResourcePropertyListeners(): void {
  const { propertiesPanel } = elements;
  const sel = state.selectedResource;
  if (!propertiesPanel || !sel) return;
  propertiesPanel.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-res-prop]').forEach(el => {
    el.addEventListener('change', () => {
      const prop = el.dataset.resProp!;
      let value: unknown = el.value;
      if (prop === 'romId') {
        const n = parseInt(el.value, 10);
        value = Number.isNaN(n) ? 0 : n;
        if (!value) el.value = '';
      }
      const action = prop === 'type' ? 'background-type' : prop === 'romId' ? 'background-romid' : 'background-romtype';
      window.dispatchEvent(new CustomEvent('resource-action', { detail: { action, index: sel.index, value } }));
      if (prop === 'romId' && (value as number) > 0) {
        const typeSel = propertiesPanel.querySelector('[data-res-prop="romIdType"]') as HTMLSelectElement | null;
        if (typeSel && typeSel.value === 'NotUsed') {
          typeSel.value = 'Lamp';
          window.dispatchEvent(
            new CustomEvent('resource-action', {
              detail: { action: 'background-romtype', index: sel.index, value: 'Lamp' },
            })
          );
        }
      }
    });
  });
  propertiesPanel.querySelectorAll<HTMLButtonElement>('[data-res-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.resAction;
      if (action === 'activate') activateResource(sel.type, sel.index);
      else if (action === 'save') void exportResourceImage(sel.type, sel.index, sel.bulbId);
      else if (action === 'delete') {
        window.dispatchEvent(
          new CustomEvent('resource-action', { detail: { action: 'delete', type: sel.type, index: sel.index } })
        );
        state.selectedResource = null;
      }
    });
  });
}
