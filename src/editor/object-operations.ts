import { state, elements, markDirty, getBulbById, getScoreById } from './state';
import { prefillFromFilter } from './bulb-filter';
import { getPlatform } from '../platform';
import { MSG_CHECK_B2S_SCORE_TYPES } from './export-checks';
import { undoManager } from './undo';
import { createDefaultBulb, createDefaultScore, type ScoreInfo, type Bulb } from '../types/data';
import { selectBulb, selectScore, clearSelection } from './selection';
import { render, requestRender } from './canvas-renderer';
import { updatePropertiesPanel, updateAllLists } from './properties-panel';
import { invokeCallback } from '../shared/callbacks';

function visibleWorldRect(): { x: number; y: number; w: number; h: number } {
  const canvas = elements.canvas;
  const zoom = state.zoom || 1;
  if (!canvas) return { x: 0, y: 0, w: 800, h: 600 };
  return { x: -state.panX / zoom, y: -state.panY / zoom, w: canvas.width / zoom, h: canvas.height / zoom };
}

function activeImageSize(): { width: number; height: number } | null {
  const img = state.activeTab === 'dmd' ? state.dmdImage : state.backgroundImage;
  return img ? { width: img.width, height: img.height } : null;
}

export function createBulb(locX?: number, locY?: number): Bulb {
  const id = state.nextBulbId++;
  const bulb = createDefaultBulb(id);
  bulb.parent = state.activeTab === 'dmd' ? 'DMD' : 'Backglass';

  const last = state.lastBulb;
  if (last) {
    if (last.width && last.height) {
      bulb.width = last.width;
      bulb.height = last.height;
    }
    if (last.intensity) bulb.intensity = last.intensity;
    if (last.lightColor) bulb.lightColor = { ...last.lightColor };
    if (last.dodgeColor) bulb.dodgeColor = { ...last.dodgeColor };
    if (last.initialState) bulb.initialState = last.initialState;
    if (last.fontName !== undefined) bulb.fontName = last.fontName;
    if (last.fontSize) bulb.fontSize = last.fontSize;
    if (last.fontStyle !== undefined) bulb.fontStyle = last.fontStyle;
  }

  const prefill = prefillFromFilter(state.lampFilter);
  if (prefill.initialState) bulb.initialState = prefill.initialState;
  if (prefill.dualMode) bulb.dualMode = prefill.dualMode;
  if (prefill.romIdType) {
    bulb.romIdType = prefill.romIdType;
    bulb.romId = prefill.romId || 0;
    bulb.romInverted = !!prefill.romInverted;
  }
  if (prefill.b2sId) {
    bulb.b2sId = prefill.b2sId;
    bulb.b2sIdType = prefill.b2sIdType || 0;
  }

  if (locX !== undefined && locY !== undefined) {
    bulb.locX = Math.round(locX);
    bulb.locY = Math.round(locY);
  } else {
    const selected = state.primarySelection?.type === 'bulb' ? getBulbById(state.primarySelection.id) : undefined;
    if (selected && selected.locX > 20 && selected.locY > -20) {
      bulb.locX = selected.locX - 20;
      bulb.locY = selected.locY + 20;
    } else {
      const view = visibleWorldRect();
      const size = activeImageSize();
      let x = Math.round(view.x + view.w * 0.2);
      let y = Math.round(view.y + view.h * 0.2);
      if (size) {
        x = Math.max(0, Math.min(x, size.width - bulb.width));
        y = Math.max(0, Math.min(y, size.height - bulb.height));
      }
      if (x < 0 || y < 0) {
        x = 50;
        y = 50;
      }
      bulb.locX = x;
      bulb.locY = y;
    }
  }

  undoManager.beginUndo('Add Bulb');
  undoManager.markBulbForCreate(id);
  state.currentData.illumination.unshift(bulb);
  undoManager.endUndo();

  selectBulb(id);
  storeLastBulbSettings(bulb);
  render();
  updatePropertiesPanel();
  updateAllLists();

  return bulb;
}

export function storeLastBulbSettings(bulb: Bulb): void {
  state.lastBulb = {
    width: bulb.width,
    height: bulb.height,
    intensity: bulb.intensity,
    lightColor: { ...bulb.lightColor },
    dodgeColor: bulb.dodgeColor ? { ...bulb.dodgeColor } : undefined,
    initialState: bulb.initialState,
    fontName: bulb.fontName,
    fontSize: bulb.fontSize,
    fontStyle: bulb.fontStyle,
  };
}

export function storeLastScoreSettings(score: ScoreInfo): void {
  state.lastScore = {
    width: score.width,
    height: score.height,
    digits: score.digits,
    spacing: score.spacing,
    reelType: score.reelType,
    reelColor: { ...score.reelColor },
  };
}

export function storeCurrentSettings(): void {
  if (state.primarySelection?.type === 'bulb') {
    const bulb = getBulbById(state.primarySelection.id);
    if (bulb) storeLastBulbSettings(bulb);
  } else if (state.primarySelection?.type === 'score') {
    const score = getScoreById(state.primarySelection.id);
    if (score) storeLastScoreSettings(score);
  }
}

export function createScore(locX?: number, locY?: number): ScoreInfo | null {
  const parent = state.activeTab === 'dmd' ? 'DMD' : 'Backglass';
  const id = Math.max(state.currentData.scores.length + 1, state.nextScoreId);
  const score: ScoreInfo = { ...createDefaultScore(id), parent };

  const last = state.lastScore;
  if (last) {
    if (last.width && last.height) {
      score.width = last.width;
      score.height = last.height;
    }
    if (last.digits) score.digits = last.digits;
    if (last.spacing !== undefined) score.spacing = last.spacing;
    if (last.reelType) score.reelType = last.reelType;
    if (last.reelColor) score.reelColor = { ...last.reelColor };
  }
  if (!score.reelType) {
    score.reelType = state.currentData.reelTypes[0] || '';
  }
  if (state.currentData.reelColor && !last?.reelColor) {
    score.reelColor = { ...state.currentData.reelColor };
  }

  if (locX !== undefined && locY !== undefined) {
    score.locX = Math.round(locX);
    score.locY = Math.round(locY);
  } else {
    const view = visibleWorldRect();
    const size = activeImageSize();
    let x = Math.round(view.x + view.w / 2 - score.width / 2);
    let y = Math.round(view.y + view.h / 2 - score.height / 2);
    if (size) {
      x = Math.max(0, Math.min(x, size.width - score.width));
      y = Math.max(0, Math.min(y, size.height - score.height));
    }
    score.locX = Math.max(0, x);
    score.locY = Math.max(0, y);
  }

  undoManager.beginUndo('Add Score');
  undoManager.markScoreForCreate(id);
  state.currentData.scores.unshift(score);
  undoManager.endUndo();
  state.nextScoreId = Math.max(state.nextScoreId, id + 1);

  selectScore(id);
  storeLastScoreSettings(score);
  render();
  updatePropertiesPanel();
  updateAllLists();

  if (!score.reelType) {
    void getPlatform().dialogs.showMessageBox({ type: 'error', message: MSG_CHECK_B2S_SCORE_TYPES, buttons: ['OK'] });
  }

  return score;
}

export function deleteSelected(): void {
  if (state.selectedBulbIds.size === 0 && state.selectedScoreIds.size === 0) return;

  const bulbCount = state.selectedBulbIds.size;
  const scoreCount = state.selectedScoreIds.size;
  const description = bulbCount + scoreCount === 1 ? 'Delete Item' : `Delete ${bulbCount + scoreCount} Items`;

  undoManager.beginUndo(description);

  for (const id of state.selectedBulbIds) {
    undoManager.markBulbForDelete(id);
  }
  state.currentData.illumination = state.currentData.illumination.filter(b => !state.selectedBulbIds.has(b.id));

  for (const id of state.selectedScoreIds) {
    undoManager.markScoreForDelete(id);
  }
  state.currentData.scores = state.currentData.scores.filter(s => !state.selectedScoreIds.has(s.id));

  undoManager.endUndo();

  clearSelection();
  render();
  updatePropertiesPanel();
  updateAllLists();
}

export function changeZOrderForSelection(op: 'front' | 'back' | 'forward' | 'backward'): void {
  if (state.selectedBulbIds.size === 0) return;

  undoManager.beginUndo('Change Z-Order');

  const allBulbs = state.currentData.illumination;
  const zValues = allBulbs.map(b => b.zOrder);
  const maxZ = zValues.length > 0 ? Math.max(...zValues) : 0;
  const minZ = zValues.length > 0 ? Math.min(...zValues) : 0;

  for (const id of state.selectedBulbIds) {
    const bulb = getBulbById(id);
    if (!bulb) continue;
    undoManager.markBulbForUndo(id);
    if (op === 'front') bulb.zOrder = maxZ + 1;
    else if (op === 'back') bulb.zOrder = minZ - 1;
    else if (op === 'forward') bulb.zOrder = bulb.zOrder + 1;
    else if (op === 'backward') bulb.zOrder = bulb.zOrder - 1;
  }

  undoManager.endUndo();
  render();
  updatePropertiesPanel();
  updateAllLists();
}

interface Clipboard {
  bulbs: Bulb[];
  scores: ScoreInfo[];
}

let clipboard: Clipboard = { bulbs: [], scores: [] };

export function hasClipboard(): boolean {
  return clipboard.bulbs.length > 0 || clipboard.scores.length > 0;
}

export function copySelected(): void {
  const bulbs: Bulb[] = [];
  const scores: ScoreInfo[] = [];
  for (const id of state.selectedBulbIds) {
    const b = getBulbById(id);
    if (b) bulbs.push(JSON.parse(JSON.stringify(b)));
  }
  for (const id of state.selectedScoreIds) {
    const s = getScoreById(id);
    if (s) scores.push(JSON.parse(JSON.stringify(s)));
  }
  if (bulbs.length === 0 && scores.length === 0) return;
  clipboard = { bulbs, scores };
}

export function cutSelected(): void {
  if (state.selectedBulbIds.size === 0 && state.selectedScoreIds.size === 0) return;
  copySelected();
  deleteSelected();
}

export function pasteClipboard(): void {
  if (!hasClipboard()) return;
  const offset = 10;
  const newBulbIds: number[] = [];
  const newScoreIds: number[] = [];
  const parent: 'Backglass' | 'DMD' = state.activeTab === 'dmd' ? 'DMD' : 'Backglass';

  undoManager.beginUndo('Paste');
  for (const b of clipboard.bulbs) {
    const newId = state.nextBulbId++;
    b.locX += offset;
    b.locY += offset;
    const clone: Bulb = {
      ...b,
      id: newId,
      parent,
      lightColor: { ...b.lightColor },
      dodgeColor: b.dodgeColor ? { ...b.dodgeColor } : undefined,
    };
    undoManager.markBulbForCreate(newId);
    state.currentData.illumination.unshift(clone);
    newBulbIds.push(newId);
  }
  for (const s of clipboard.scores) {
    const newId = state.nextScoreId++;
    s.locX += offset;
    s.locY += offset;
    const clone: ScoreInfo = {
      ...s,
      id: newId,
      parent,
      reelColor: { ...s.reelColor },
    };
    undoManager.markScoreForCreate(newId);
    state.currentData.scores.unshift(clone);
    newScoreIds.push(newId);
  }
  undoManager.endUndo();

  state.selectedBulbIds.clear();
  state.selectedScoreIds.clear();
  for (const id of newBulbIds) state.selectedBulbIds.add(id);
  for (const id of newScoreIds) state.selectedScoreIds.add(id);
  if (newBulbIds.length > 0) state.primarySelection = { type: 'bulb', id: newBulbIds[0] };
  else if (newScoreIds.length > 0) state.primarySelection = { type: 'score', id: newScoreIds[0] };

  invokeCallback('selectionChanged');
  render();
  updatePropertiesPanel();
  updateAllLists();
}

export function duplicateSelected(): void {
  if (state.selectedBulbIds.size === 0 && state.selectedScoreIds.size === 0) return;

  const newBulbIds: number[] = [];
  const newScoreIds: number[] = [];
  const offset = 20;

  undoManager.beginUndo('Duplicate');

  for (const id of state.selectedBulbIds) {
    const original = getBulbById(id);
    if (original) {
      const newId = state.nextBulbId++;
      const clone: Bulb = {
        ...original,
        id: newId,
        name: `${original.name}_copy`,
        locX: original.locX + offset,
        locY: original.locY + offset,
        lightColor: { ...original.lightColor },
        dodgeColor: original.dodgeColor ? { ...original.dodgeColor } : undefined,
      };

      undoManager.markBulbForCreate(newId);
      state.currentData.illumination.push(clone);
      newBulbIds.push(newId);
    }
  }

  for (const id of state.selectedScoreIds) {
    const original = getScoreById(id);
    if (original) {
      const newId = state.nextScoreId++;
      const clone: ScoreInfo = {
        ...original,
        id: newId,
        locX: original.locX + offset,
        locY: original.locY + offset,
        reelColor: { ...original.reelColor },
      };

      undoManager.markScoreForCreate(newId);
      state.currentData.scores.push(clone);
      newScoreIds.push(newId);
    }
  }

  undoManager.endUndo();

  state.selectedBulbIds.clear();
  state.selectedScoreIds.clear();
  for (const id of newBulbIds) {
    state.selectedBulbIds.add(id);
  }
  for (const id of newScoreIds) {
    state.selectedScoreIds.add(id);
  }

  if (newBulbIds.length > 0) {
    state.primarySelection = { type: 'bulb', id: newBulbIds[0] };
  } else if (newScoreIds.length > 0) {
    state.primarySelection = { type: 'score', id: newScoreIds[0] };
  }

  invokeCallback('selectionChanged');
  render();
  updatePropertiesPanel();
  updateAllLists();
}

export function moveSelected(dx: number, dy: number, commit = true): void {
  if (state.selectedBulbIds.size === 0 && state.selectedScoreIds.size === 0) return;

  if (commit) {
    undoManager.beginUndo('Move');
    for (const id of state.selectedBulbIds) {
      undoManager.markBulbForUndo(id);
    }
    for (const id of state.selectedScoreIds) {
      undoManager.markScoreForUndo(id);
    }
  }

  const size = activeImageSize();
  const clampItem = (item: { locX: number; locY: number; width: number; height: number }): void => {
    item.locX += dx;
    item.locY += dy;
    if (!size) return;
    if (item.locX < -item.width / 2) item.locX = Math.round(-item.width / 2);
    if (item.locY < -item.height / 2) item.locY = Math.round(-item.height / 2);
    if (item.locX > size.width - item.width / 2) item.locX = Math.round(size.width - item.width / 2);
    if (item.locY > size.height - item.height / 2) item.locY = Math.round(size.height - item.height / 2);
  };

  for (const id of state.selectedBulbIds) {
    const bulb = getBulbById(id);
    if (bulb) clampItem(bulb);
  }

  for (const id of state.selectedScoreIds) {
    const score = getScoreById(id);
    if (score) clampItem(score);
  }

  if (commit) {
    undoManager.endUndo();
    storeCurrentSettings();
    render();
  } else {
    markDirty();
    requestRender();
  }
  updatePropertiesPanel();
}

export function resizeSelectedBy(dw: number, dh: number): void {
  if (state.selectedBulbIds.size === 0 && state.selectedScoreIds.size === 0) return;
  undoManager.beginUndo('Resize');
  for (const id of state.selectedBulbIds) undoManager.markBulbForUndo(id);
  for (const id of state.selectedScoreIds) undoManager.markScoreForUndo(id);
  const apply = (item: { width: number; height: number }): void => {
    item.width = Math.max(10, item.width + dw);
    item.height = Math.max(10, item.height + dh);
  };
  for (const id of state.selectedBulbIds) {
    const bulb = getBulbById(id);
    if (bulb) apply(bulb);
  }
  for (const id of state.selectedScoreIds) {
    const score = getScoreById(id);
    if (score) apply(score);
  }
  undoManager.endUndo();
  storeCurrentSettings();
  render();
  updatePropertiesPanel();
}

export function bringToTopOfStack(type: 'bulb' | 'score', id: number): void {
  if (type === 'bulb') {
    const list = state.currentData.illumination;
    const idx = list.findIndex(b => b.id === id);
    if (idx > 0) {
      const [item] = list.splice(idx, 1);
      list.unshift(item);
    }
  } else {
    const list = state.currentData.scores;
    const idx = list.findIndex(s => s.id === id);
    if (idx > 0) {
      const [item] = list.splice(idx, 1);
      list.unshift(item);
    }
  }
}

export function resizeItem(
  type: 'bulb' | 'score',
  id: number,
  position: string,
  dx: number,
  dy: number,
  commit = true
): void {
  if (commit) {
    undoManager.beginUndo('Resize');
    if (type === 'bulb') {
      undoManager.markBulbForUndo(id);
    } else {
      undoManager.markScoreForUndo(id);
    }
  }

  const item = type === 'bulb' ? getBulbById(id) : getScoreById(id);
  if (!item) return;

  const locProp = 'locX' in item ? item : null;
  if (!locProp) return;

  switch (position) {
    case 'nw':
      locProp.locX += dx;
      locProp.locY += dy;
      locProp.width -= dx;
      locProp.height -= dy;
      break;
    case 'n':
      locProp.locY += dy;
      locProp.height -= dy;
      break;
    case 'ne':
      locProp.locY += dy;
      locProp.width += dx;
      locProp.height -= dy;
      break;
    case 'w':
      locProp.locX += dx;
      locProp.width -= dx;
      break;
    case 'e':
      locProp.width += dx;
      break;
    case 'sw':
      locProp.locX += dx;
      locProp.width -= dx;
      locProp.height += dy;
      break;
    case 's':
      locProp.height += dy;
      break;
    case 'se':
      locProp.width += dx;
      locProp.height += dy;
      break;
  }

  locProp.width = Math.max(10, locProp.width);
  locProp.height = Math.max(10, locProp.height);

  if (commit) {
    undoManager.endUndo();
    storeCurrentSettings();
    render();
  } else {
    markDirty();
    requestRender();
  }
  updatePropertiesPanel();
}
