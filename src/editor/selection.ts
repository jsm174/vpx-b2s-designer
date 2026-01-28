import { state, type SelectionType } from './state';
import { invokeCallback } from '../shared/callbacks';

export function selectBulb(id: number, addToSelection = false): void {
  if (!addToSelection) {
    state.selectedBulbIds.clear();
    state.selectedScoreIds.clear();
  }
  state.selectedBulbIds.add(id);
  state.primarySelection = { type: 'bulb', id };
  invokeCallback('selectionChanged');
}

export function selectScore(id: number, addToSelection = false): void {
  if (!addToSelection) {
    state.selectedBulbIds.clear();
    state.selectedScoreIds.clear();
  }
  state.selectedScoreIds.add(id);
  state.primarySelection = { type: 'score', id };
  invokeCallback('selectionChanged');
}

export function deselectBulb(id: number): void {
  state.selectedBulbIds.delete(id);
  if (state.primarySelection?.type === 'bulb' && state.primarySelection.id === id) {
    updatePrimarySelection();
  }
  invokeCallback('selectionChanged');
}

export function deselectScore(id: number): void {
  state.selectedScoreIds.delete(id);
  if (state.primarySelection?.type === 'score' && state.primarySelection.id === id) {
    updatePrimarySelection();
  }
  invokeCallback('selectionChanged');
}

export function clearSelection(): void {
  state.selectedBulbIds.clear();
  state.selectedScoreIds.clear();
  state.primarySelection = null;
  invokeCallback('selectionChanged');
}

export function selectAll(): void {
  for (const bulb of state.currentData.illumination) {
    state.selectedBulbIds.add(bulb.id);
  }
  for (const score of state.currentData.scores) {
    state.selectedScoreIds.add(score.id);
  }
  updatePrimarySelection();
  invokeCallback('selectionChanged');
}

export function hasSelection(): boolean {
  return state.selectedBulbIds.size > 0 || state.selectedScoreIds.size > 0;
}

export function getSelectionCount(): number {
  return state.selectedBulbIds.size + state.selectedScoreIds.size;
}

export function isSelected(type: SelectionType, id: number): boolean {
  if (type === 'bulb') {
    return state.selectedBulbIds.has(id);
  }
  return state.selectedScoreIds.has(id);
}

export function toggleSelection(type: SelectionType, id: number): void {
  if (type === 'bulb') {
    if (state.selectedBulbIds.has(id)) {
      deselectBulb(id);
    } else {
      selectBulb(id, true);
    }
  } else {
    if (state.selectedScoreIds.has(id)) {
      deselectScore(id);
    } else {
      selectScore(id, true);
    }
  }
}

function updatePrimarySelection(): void {
  if (state.selectedBulbIds.size > 0) {
    const firstBulbId = Array.from(state.selectedBulbIds)[0];
    state.primarySelection = { type: 'bulb', id: firstBulbId };
  } else if (state.selectedScoreIds.size > 0) {
    const firstScoreId = Array.from(state.selectedScoreIds)[0];
    state.primarySelection = { type: 'score', id: firstScoreId };
  } else {
    state.primarySelection = null;
  }
}

export function setSelection(
  bulbIds: number[],
  scoreIds: number[],
  primary?: { type: SelectionType; id: number }
): void {
  state.selectedBulbIds.clear();
  state.selectedScoreIds.clear();
  for (const id of bulbIds) {
    state.selectedBulbIds.add(id);
  }
  for (const id of scoreIds) {
    state.selectedScoreIds.add(id);
  }
  if (primary) {
    state.primarySelection = primary;
  } else {
    updatePrimarySelection();
  }
  invokeCallback('selectionChanged');
}
