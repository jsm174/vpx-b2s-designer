import { state, elements, getBulbById, getScoreById, markDirty } from './state';
import { getEditable } from './parts';
import { undoManager } from './undo';
import { render } from './canvas-renderer';
import { invokeCallback } from '../shared/callbacks';
import { updateResourcesPanel } from './resources-panel';
import type { Bulb, ScoreInfo, Color } from '../types/data';

export function updatePropertiesPanel(): void {
  const { propertiesPanel } = elements;
  if (!propertiesPanel) return;

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
    const element = input as HTMLInputElement | HTMLSelectElement;
    const prop = element.dataset.prop!;

    element.addEventListener('change', () => {
      applyPropertyChange(type, id, prop, element);
    });

    if (element.type === 'range' || element.type === 'text' || element.type === 'number') {
      element.addEventListener('input', () => {
        applyPropertyChange(type, id, prop, element, true);
      });
    }
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
}

function applyReelTypeChange(id: number, reelType: string): void {
  undoManager.beginUndo('Change reel type');
  undoManager.markScoreForUndo(id);

  const score = getScoreById(id);
  if (score) {
    score.reelType = reelType;
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
  element: HTMLInputElement | HTMLSelectElement,
  preview = false
): void {
  const value = getInputValue(element);

  if (!preview) {
    undoManager.beginUndo(`Change ${prop}`);
    if (type === 'bulb') {
      undoManager.markBulbForUndo(id);
    } else {
      undoManager.markScoreForUndo(id);
    }
  }

  if (type === 'bulb') {
    const bulb = getBulbById(id);
    if (bulb) {
      setProperty(bulb, prop, value);
    }
  } else {
    const score = getScoreById(id);
    if (score) {
      setProperty(score, prop, value);
    }
  }

  if (!preview) {
    undoManager.endUndo();
  } else {
    markDirty();
  }

  render();
  updateIlluminationList();
  if (!preview) {
    updatePropertiesPanel();
  }
  invokeCallback('dataChanged');
}

function getInputValue(element: HTMLInputElement | HTMLSelectElement): unknown {
  if (element.type === 'number' || element.type === 'range') {
    return parseInt(element.value, 10) || 0;
  }
  if (element.type === 'color') {
    return hexToRgb(element.value);
  }
  if (element.type === 'checkbox') {
    return (element as HTMLInputElement).checked;
  }
  return element.value;
}

function setProperty(item: Bulb | ScoreInfo, prop: string, value: unknown): void {
  if (prop === 'lightColor' && 'lightColor' in item) {
    item.lightColor = value as Color;
  } else if (prop === 'reelColor' && 'reelColor' in item) {
    item.reelColor = value as Color;
  } else if (prop === 'visible' && typeof value === 'string') {
    (item as unknown as Record<string, unknown>)[prop] = value === 'true';
  } else if (prop === 'useDream7' && 'reelType' in item) {
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

function bulbPassesFilter(bulb: {
  name?: string;
  romId?: number;
  romIdType?: string;
  romInverted?: boolean;
  initialState?: string;
}): boolean {
  const filter = state.lampFilter;
  if (filter === 'all') return true;
  if (filter === 'off') return bulb.initialState === 'Off';
  if (filter === 'on') return bulb.initialState === 'On';
  if (filter === 'always-on') return bulb.initialState === 'Undefined';
  if (filter === 'no-id') return !bulb.romId || bulb.romId === 0;
  if (filter === 'with-name') return !!bulb.name && bulb.name.trim() !== '';
  if (filter.startsWith('rom-')) {
    const rest = filter.substring(4);
    const inverted = rest.startsWith('I');
    const afterInv = inverted ? rest.substring(1) : rest;
    const dashIdx = afterInv.indexOf('-');
    if (dashIdx > 0) {
      const type = afterInv.substring(0, dashIdx);
      const romId = parseInt(afterInv.substring(dashIdx + 1), 10);
      return bulb.romIdType === type && bulb.romId === romId && (bulb.romInverted ?? false) === inverted;
    }
  }
  return true;
}

export function updateIlluminationList(): void {
  const { illuminationList } = elements;
  if (!illuminationList) return;

  const parentFilter = state.activeTab === 'dmd' ? 'DMD' : 'Backglass';
  const filteredBulbs = state.currentData.illumination.filter(b => b.parent === parentFilter && bulbPassesFilter(b));

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
        <div class="prop-group-title">DMD</div>
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

  return `
    <div class="prop-group">
      <div class="prop-group-title">Backglass</div>
      <div class="prop-row">
        <span class="prop-label">Size</span>
        <span style="flex:1;font-size:11px;">${imageWidth} × ${imageHeight}</span>
      </div>
      <div class="prop-row">
        <span class="prop-label">Name</span>
        <input type="text" class="prop-input" data-prop="name" value="${escapeHtml(data.name)}">
      </div>
      <div class="prop-row">
        <span class="prop-label">Game</span>
        <input type="text" class="prop-input" data-prop="gameName" value="${escapeHtml(data.gameName)}">
      </div>
    </div>
    <div class="prop-group">
      <div class="prop-group-title">Type</div>
      <div class="prop-row">
        <span class="prop-label">Table</span>
        <select class="prop-input" data-prop="tableType">
          <option value="EM" ${data.tableType === 'EM' ? 'selected' : ''}>EM</option>
          <option value="SS" ${data.tableType === 'SS' ? 'selected' : ''}>SS</option>
          <option value="SSDMD" ${data.tableType === 'SSDMD' ? 'selected' : ''}>SS + DMD</option>
          <option value="ORI" ${data.tableType === 'ORI' ? 'selected' : ''}>Original</option>
        </select>
      </div>
      <div class="prop-row">
        <span class="prop-label">DMD</span>
        <select class="prop-input" data-prop="dmdType">
          <option value="None" ${data.dmdType === 'None' ? 'selected' : ''}>None</option>
          <option value="BuiltIn" ${data.dmdType === 'BuiltIn' ? 'selected' : ''}>Built-In</option>
          <option value="External" ${data.dmdType === 'External' ? 'selected' : ''}>External</option>
        </select>
      </div>
      <div class="prop-row">
        <span class="prop-label">Dest</span>
        <select class="prop-input" data-prop="destType">
          <option value="Authentic" ${data.destType === 'Authentic' ? 'selected' : ''}>Authentic</option>
          <option value="Fantasy" ${data.destType === 'Fantasy' ? 'selected' : ''}>Fantasy</option>
        </select>
      </div>
    </div>
    <div class="prop-group">
      <div class="prop-group-title">Settings</div>
      <div class="prop-row">
        <span class="prop-label">Players</span>
        <input type="number" class="prop-input" data-prop="numberOfPlayers" value="${data.numberOfPlayers}" min="1" max="6">
      </div>
      <div class="prop-row">
        <span class="prop-label">Grill Height</span>
        <input type="number" class="prop-input" data-prop="grillHeight" value="${data.grillHeight}" min="0">
      </div>
      <div class="prop-row">
        <span class="prop-label">Dual Mode</span>
        <input type="checkbox" data-prop="dualBackglass" ${data.dualBackglass ? 'checked' : ''}>
      </div>
    </div>
    <div class="prop-group">
      <div class="prop-group-title">Credits</div>
      <div class="prop-row">
        <span class="prop-label">Author</span>
        <input type="text" class="prop-input" data-prop="author" value="${escapeHtml(data.author)}">
      </div>
      <div class="prop-row">
        <span class="prop-label">Artwork</span>
        <input type="text" class="prop-input" data-prop="artwork" value="${escapeHtml(data.artwork)}">
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

function applyBackglassPropertyChange(prop: string, element: HTMLInputElement | HTMLSelectElement): void {
  undoManager.beginUndo(`Change ${prop}`);

  const value = getInputValue(element);
  (state.currentData as unknown as Record<string, unknown>)[prop] = value;

  undoManager.endUndo();
  markDirty();
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
