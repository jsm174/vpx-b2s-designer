import { state, markDirty, getBulbById, getScoreById } from './state';
import { undoManager } from './undo';
import { createDefaultBulb, type ScoreInfo, type Bulb } from '../types/data';
import { selectBulb, selectScore, clearSelection } from './selection';
import { render } from './canvas-renderer';
import { updatePropertiesPanel, updateAllLists } from './properties-panel';
import { invokeCallback } from '../shared/callbacks';

export function createBulb(locX?: number, locY?: number): Bulb {
  const id = state.nextBulbId++;
  const bulb = createDefaultBulb(id);

  if (locX !== undefined && locY !== undefined) {
    bulb.locX = locX;
    bulb.locY = locY;
  } else {
    bulb.locX = 100 + (state.currentData.illumination.length % 5) * 60;
    bulb.locY = 100 + Math.floor(state.currentData.illumination.length / 5) * 60;
  }

  undoManager.beginUndo('Add Bulb');
  undoManager.markBulbForCreate(id);
  state.currentData.illumination.push(bulb);
  undoManager.endUndo();

  selectBulb(id);
  render();
  updatePropertiesPanel();
  updateAllLists();

  return bulb;
}

export function createScore(locX?: number, locY?: number): ScoreInfo {
  const id = state.nextScoreId++;
  const parent = state.activeTab === 'dmd' ? 'DMD' : 'Backglass';
  const score: ScoreInfo = {
    id,
    parent,
    reelType: 'Dream7LED8',
    digits: 7,
    spacing: 5,
    locX: locX ?? 200,
    locY: locY ?? 50 + state.currentData.scores.length * 50,
    width: 200,
    height: 50,
    reelColor: { r: 255, g: 120, b: 0, a: 255 },
    reelDarkColor: { r: 15, g: 15, b: 15, a: 255 },
    glow: 1500,
    thickness: 2000,
    shear: 10,
    displayState: 0,
    b2sStartDigit: 0,
    b2sScoreType: 1,
    b2sPlayerNo: id,
    visible: true,
  };

  undoManager.beginUndo('Add Score');
  undoManager.markScoreForCreate(id);
  state.currentData.scores.push(score);
  undoManager.endUndo();

  selectScore(id);
  render();
  updatePropertiesPanel();
  updateAllLists();

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
        reelLitColor: original.reelLitColor ? { ...original.reelLitColor } : undefined,
        reelDarkColor: original.reelDarkColor ? { ...original.reelDarkColor } : undefined,
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

  for (const id of state.selectedBulbIds) {
    const bulb = getBulbById(id);
    if (bulb) {
      bulb.locX += dx;
      bulb.locY += dy;
    }
  }

  for (const id of state.selectedScoreIds) {
    const score = getScoreById(id);
    if (score) {
      score.locX += dx;
      score.locY += dy;
    }
  }

  if (commit) {
    undoManager.endUndo();
  } else {
    markDirty();
  }

  render();
  updatePropertiesPanel();
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
  } else {
    markDirty();
  }

  render();
  updatePropertiesPanel();
}
