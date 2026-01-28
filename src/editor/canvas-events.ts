import { state, elements, markDirty, getBulbById, getScoreById } from './state';
import { addLongPressContextMenu } from '../shared/long-press';
import { appendConsoleLine } from './console-panel';
import {
  render,
  requestRender,
  screenToWorld,
  hitTestGrillRemoveButton,
  hitTestDmdCopyArea,
  hitTestDmdDefaultLocationRemove,
  hitTestItemsAtPoint,
  hitTestEdge,
  zoomByWheel,
  updateCoordsDisplay,
  type DmdCopyAreaHit,
  type EdgeHit,
} from './canvas-renderer';
import { selectBulb, selectScore, clearSelection, isSelected } from './selection';
import { updatePropertiesPanel, updateAllLists } from './properties-panel';
import {
  deleteSelected,
  moveSelected,
  resizeSelectedBy,
  bringToTopOfStack,
  storeCurrentSettings,
} from './object-operations';
import { undoManager } from './undo';
import { showSimpleContextMenu, type SimpleMenuItem } from './context-menu';
import { hitTestRemoveBox, dodgeColorFromIndex, dodgeColorToIndex } from './parts/bulb';
import { romInfoToString, b2sInfoToString } from './bulb-filter';
import { getPlatform } from '../platform';
import { invalidateSpriteCache } from './illumination-render';
import { invokeCallback } from '../shared/callbacks';

interface DragState {
  mode: 'none' | 'pan' | 'move' | 'resize' | 'marquee' | 'dmd-copy-move' | 'dmd-copy-resize';
  startScreenX: number;
  startScreenY: number;
  startWorldX: number;
  startWorldY: number;
  lastWorldX: number;
  lastWorldY: number;
  edge: EdgeHit | null;
  itemType: 'bulb' | 'score' | null;
  itemId: number | null;
  startRect: { x: number; y: number; w: number; h: number } | null;
  undoStarted: boolean;
  removeBoxArmed: boolean;
  dmdCopyHandle: DmdCopyAreaHit | null;
  dmdCopyOriginal: { x: number; y: number; w: number; h: number } | null;
}

const dragState: DragState = {
  mode: 'none',
  startScreenX: 0,
  startScreenY: 0,
  startWorldX: 0,
  startWorldY: 0,
  lastWorldX: 0,
  lastWorldY: 0,
  edge: null,
  itemType: null,
  itemId: null,
  startRect: null,
  undoStarted: false,
  removeBoxArmed: false,
  dmdCopyHandle: null,
  dmdCopyOriginal: null,
};

const MIN_SIZE = 10;

export function setupCanvasEvents(): void {
  const { canvas } = elements;
  if (!canvas) return;

  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('mouseleave', onMouseLeave);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  addLongPressContextMenu(canvas);
  canvas.addEventListener('contextmenu', onContextMenu);

  document.addEventListener('keydown', onKeyDown);
}

function activeImage(): HTMLImageElement | null {
  return state.activeTab === 'dmd' ? state.dmdImage : state.backgroundImage;
}

function getItem(
  type: 'bulb' | 'score',
  id: number
): { locX: number; locY: number; width: number; height: number } | undefined {
  return type === 'bulb' ? getBulbById(id) : getScoreById(id);
}

function cursorForEdge(edge: EdgeHit | null): string {
  switch (edge) {
    case 'nw':
    case 'se':
      return 'nwse-resize';
    case 'ne':
    case 'sw':
      return 'nesw-resize';
    case 'w':
    case 'e':
      return 'ew-resize';
    case 'n':
    case 's':
      return 'ns-resize';
    default:
      return 'default';
  }
}

function refreshAfterSelection(): void {
  render();
  updatePropertiesPanel();
  updateAllLists();
}

function onMouseDown(e: MouseEvent): void {
  const { canvas } = elements;
  if (!canvas || !state.hasFile) return;

  const world = screenToWorld(e.clientX, e.clientY);
  dragState.startScreenX = e.clientX;
  dragState.startScreenY = e.clientY;
  dragState.startWorldX = world.x;
  dragState.startWorldY = world.y;
  dragState.lastWorldX = world.x;
  dragState.lastWorldY = world.y;
  dragState.removeBoxArmed = false;

  if (e.button === 1) {
    dragState.mode = 'pan';
    state.isPanning = true;
    state.panStartX = e.clientX - state.panX;
    state.panStartY = e.clientY - state.panY;
    canvas.style.cursor = 'grabbing';
    return;
  }

  if (e.button !== 0) return;

  if (state.setGrillHeight || state.setSmallGrillHeight) {
    handleGrillHeightClick(world.x, world.y);
    return;
  }

  if (state.copyDmdFromBackglass) {
    handleDmdCopyAreaClick(world.x, world.y, canvas);
    return;
  }

  if (state.setDmdDefaultLocation) {
    handleDmdDefaultLocationClick(world.x, world.y);
    return;
  }

  if (state.addSnippet) {
    state.snippetDrag = { startX: world.x, startY: world.y, curX: world.x, curY: world.y };
    dragState.mode = 'marquee';
    requestRender();
    return;
  }

  const primary = state.primarySelection;
  if (primary) {
    const item = getItem(primary.type, primary.id);
    if (item && hitTestRemoveBox(item, world.x, world.y)) {
      dragState.removeBoxArmed = true;
      dragState.itemType = primary.type;
      dragState.itemId = primary.id;
      return;
    }
  }

  const hits = hitTestItemsAtPoint(world.x, world.y);
  const pickIndex = e.ctrlKey && e.shiftKey ? 1 : 0;
  const hit = hits[Math.min(pickIndex, hits.length - 1)];
  if (hit) {
    const alreadySelected = isSelected(hit.type, hit.id);
    if (!e.shiftKey && !alreadySelected) {
      clearSelection();
    }
    if (hit.type === 'bulb') {
      selectBulb(hit.id, e.shiftKey && !e.ctrlKey);
      const bulb = getBulbById(hit.id);
      if (bulb?.name) {
        window.dispatchEvent(new CustomEvent('animation-bulb-clicked', { detail: bulb.name }));
      }
    } else {
      selectScore(hit.id, e.shiftKey && !e.ctrlKey);
    }
    bringToTopOfStack(hit.type, hit.id);

    const item = getItem(hit.type, hit.id)!;
    dragState.startRect = { x: item.locX, y: item.locY, w: item.width, h: item.height };
    dragState.itemType = hit.type;
    dragState.itemId = hit.id;
    dragState.undoStarted = false;

    const edge = hitTestEdge(hit.type, hit.id, world.x, world.y);
    if (edge) {
      dragState.mode = 'resize';
      dragState.edge = edge;
      canvas.style.cursor = cursorForEdge(edge);
    } else {
      dragState.mode = 'move';
      dragState.edge = null;
      canvas.style.cursor = 'grab';
    }

    refreshAfterSelection();
    return;
  }

  if (e.altKey) {
    dragState.mode = 'pan';
    state.isPanning = true;
    state.panStartX = e.clientX - state.panX;
    state.panStartY = e.clientY - state.panY;
    canvas.style.cursor = 'grabbing';
    return;
  }

  clearSelection();
  refreshAfterSelection();
}

function clampMove(item: { locX: number; locY: number; width: number; height: number }): void {
  const image = activeImage();
  if (item.locX < -item.width / 2) item.locX = Math.round(-item.width / 2);
  if (item.locY < -item.height / 2) item.locY = Math.round(-item.height / 2);
  if (image) {
    if (item.locX > image.width - item.width / 2) item.locX = Math.round(image.width - item.width / 2);
    if (item.locY > image.height - item.height / 2) item.locY = Math.round(image.height - item.height / 2);
  }
}

function onMouseMove(e: MouseEvent): void {
  const { canvas } = elements;
  if (!canvas) return;

  const world = screenToWorld(e.clientX, e.clientY);
  updateCoordsDisplay(Math.round(world.x), Math.round(world.y));

  if (dragState.mode === 'pan') {
    state.panX = e.clientX - state.panStartX;
    state.panY = e.clientY - state.panStartY;
    requestRender();
    return;
  }

  if (dragState.mode === 'move' && dragState.itemType && dragState.itemId !== null && dragState.startRect) {
    const totalDx = Math.round(world.x - dragState.startWorldX);
    const totalDy = Math.round(world.y - dragState.startWorldY);
    if (!dragState.undoStarted && (Math.abs(totalDx) >= 1 || Math.abs(totalDy) >= 1)) {
      undoManager.beginUndo('Move');
      for (const id of state.selectedBulbIds) undoManager.markBulbForUndo(id);
      for (const id of state.selectedScoreIds) undoManager.markScoreForUndo(id);
      dragState.undoStarted = true;
    }
    if (dragState.undoStarted) {
      const primary = getItem(dragState.itemType, dragState.itemId);
      if (primary) {
        const beforeX = primary.locX;
        const beforeY = primary.locY;
        primary.locX = dragState.startRect.x + totalDx;
        primary.locY = dragState.startRect.y + totalDy;
        clampMove(primary);
        const dx = primary.locX - beforeX;
        const dy = primary.locY - beforeY;
        if (state.selectedBulbIds.size + state.selectedScoreIds.size > 1 && (dx !== 0 || dy !== 0)) {
          for (const id of state.selectedBulbIds) {
            if (dragState.itemType === 'bulb' && id === dragState.itemId) continue;
            const b = getBulbById(id);
            if (b) {
              b.locX += dx;
              b.locY += dy;
            }
          }
          for (const id of state.selectedScoreIds) {
            if (dragState.itemType === 'score' && id === dragState.itemId) continue;
            const s = getScoreById(id);
            if (s) {
              s.locX += dx;
              s.locY += dy;
            }
          }
        }
        markDirty();
        requestRender();
        updatePropertiesPanel();
      }
    }
    return;
  }

  if (dragState.mode === 'resize' && dragState.itemType && dragState.itemId !== null && dragState.startRect) {
    const totalDx = Math.round(world.x - dragState.startWorldX);
    const totalDy = Math.round(world.y - dragState.startWorldY);
    if (!dragState.undoStarted && (Math.abs(totalDx) >= 1 || Math.abs(totalDy) >= 1)) {
      undoManager.beginUndo('Resize');
      if (dragState.itemType === 'bulb') undoManager.markBulbForUndo(dragState.itemId);
      else undoManager.markScoreForUndo(dragState.itemId);
      dragState.undoStarted = true;
    }
    if (dragState.undoStarted && dragState.edge) {
      const item = getItem(dragState.itemType, dragState.itemId);
      if (item) {
        const start = dragState.startRect;
        const edge = dragState.edge;
        let x = start.x;
        let y = start.y;
        let w = start.w;
        let h = start.h;
        if (edge.includes('w')) {
          x = start.x + totalDx;
          w = start.w - totalDx;
        }
        if (edge.includes('e')) w = start.w + totalDx;
        if (edge.includes('n')) {
          y = start.y + totalDy;
          h = start.h - totalDy;
        }
        if (edge.includes('s')) h = start.h + totalDy;
        if (x > start.x + start.w - MIN_SIZE) x = start.x + start.w - MIN_SIZE;
        if (y > start.y + start.h - MIN_SIZE) y = start.y + start.h - MIN_SIZE;
        item.locX = x;
        item.locY = y;
        item.width = Math.max(MIN_SIZE, w);
        item.height = Math.max(MIN_SIZE, h);
        markDirty();
        requestRender();
        updatePropertiesPanel();
      }
    }
    return;
  }

  if (dragState.mode === 'dmd-copy-move' || dragState.mode === 'dmd-copy-resize') {
    const dx = world.x - dragState.lastWorldX;
    const dy = world.y - dragState.lastWorldY;

    if (!dragState.undoStarted && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) {
      undoManager.beginUndo(dragState.mode === 'dmd-copy-move' ? 'Move DMD copy area' : 'Resize DMD copy area');
      undoManager.markDmdAreaForUndo();
      dragState.undoStarted = true;
    }

    if (dragState.undoStarted && dragState.dmdCopyOriginal) {
      const data = state.currentData;
      const orig = dragState.dmdCopyOriginal;
      const totalDx = world.x - dragState.startWorldX;
      const totalDy = world.y - dragState.startWorldY;

      if (dragState.mode === 'dmd-copy-move') {
        data.dmdCopyAreaX = Math.round(orig.x + totalDx);
        data.dmdCopyAreaY = Math.round(orig.y + totalDy);
      } else if (dragState.dmdCopyHandle) {
        const h = dragState.dmdCopyHandle;
        let newX = orig.x;
        let newY = orig.y;
        let newW = orig.w;
        let newH = orig.h;

        if (h === 'nw' || h === 'w' || h === 'sw') {
          newX = orig.x + totalDx;
          newW = orig.w - totalDx;
        }
        if (h === 'ne' || h === 'e' || h === 'se') {
          newW = orig.w + totalDx;
        }
        if (h === 'nw' || h === 'n' || h === 'ne') {
          newY = orig.y + totalDy;
          newH = orig.h - totalDy;
        }
        if (h === 'sw' || h === 's' || h === 'se') {
          newH = orig.h + totalDy;
        }

        if (newW < MIN_SIZE) {
          if (h === 'nw' || h === 'w' || h === 'sw') newX = orig.x + orig.w - MIN_SIZE;
          newW = MIN_SIZE;
        }
        if (newH < MIN_SIZE) {
          if (h === 'nw' || h === 'n' || h === 'ne') newY = orig.y + orig.h - MIN_SIZE;
          newH = MIN_SIZE;
        }

        data.dmdCopyAreaX = Math.round(newX);
        data.dmdCopyAreaY = Math.round(newY);
        data.dmdCopyAreaWidth = Math.round(newW);
        data.dmdCopyAreaHeight = Math.round(newH);
      }

      dragState.lastWorldX = world.x;
      dragState.lastWorldY = world.y;
      requestRender();
    }
    return;
  }

  if (state.addSnippet && state.snippetDrag && dragState.mode === 'marquee') {
    state.snippetDrag.curX = world.x;
    state.snippetDrag.curY = world.y;
    requestRender();
    return;
  }

  if (dragState.mode === 'none') {
    if (state.setGrillHeight || state.setSmallGrillHeight) {
      const oldY = state.mouseWorldY;
      state.mouseWorldY = world.y;
      if (oldY !== world.y) {
        requestRender();
      }
      const grillHit = hitTestGrillRemoveButton(world.x, world.y);
      canvas.style.cursor = grillHit ? 'pointer' : 'crosshair';
      return;
    }

    if (state.copyDmdFromBackglass) {
      const dmdHit = hitTestDmdCopyArea(world.x, world.y);
      if (dmdHit === 'camera') {
        canvas.style.cursor = 'pointer';
      } else if (dmdHit === 'move') {
        canvas.style.cursor = 'move';
      } else if (dmdHit === 'n' || dmdHit === 's') {
        canvas.style.cursor = 'ns-resize';
      } else if (dmdHit === 'e' || dmdHit === 'w') {
        canvas.style.cursor = 'ew-resize';
      } else if (dmdHit === 'nw' || dmdHit === 'se') {
        canvas.style.cursor = 'nwse-resize';
      } else if (dmdHit === 'ne' || dmdHit === 'sw') {
        canvas.style.cursor = 'nesw-resize';
      } else {
        canvas.style.cursor = 'default';
      }
      return;
    }

    if (state.setDmdDefaultLocation) {
      state.mouseWorldX = world.x;
      state.mouseWorldY = world.y;
      requestRender();
      const removeHit = hitTestDmdDefaultLocationRemove(world.x, world.y);
      canvas.style.cursor = removeHit ? 'pointer' : 'crosshair';
      return;
    }

    if (state.addSnippet) {
      canvas.style.cursor = 'crosshair';
      return;
    }

    const primary = state.primarySelection;
    if (primary) {
      const item = getItem(primary.type, primary.id);
      if (item && hitTestRemoveBox(item, world.x, world.y)) {
        canvas.style.cursor = 'pointer';
        return;
      }
    }

    const hits = hitTestItemsAtPoint(world.x, world.y);
    const hit = hits[0];
    if (hit) {
      const edge = hitTestEdge(hit.type, hit.id, world.x, world.y);
      canvas.style.cursor = edge ? cursorForEdge(edge) : 'pointer';
    } else {
      canvas.style.cursor = 'default';
    }
  }
}

function onMouseUp(e: MouseEvent): void {
  const { canvas } = elements;
  if (!canvas) return;

  if (state.addSnippet && state.snippetDrag && dragState.mode === 'marquee') {
    const drag = state.snippetDrag;
    state.snippetDrag = null;
    state.addSnippet = false;
    canvas.style.cursor = 'default';
    dragState.mode = 'none';
    window.dispatchEvent(
      new CustomEvent('snippet-region-captured', {
        detail: {
          x: Math.min(drag.startX, drag.curX),
          y: Math.min(drag.startY, drag.curY),
          w: Math.abs(drag.curX - drag.startX),
          h: Math.abs(drag.curY - drag.startY),
        },
      })
    );
    render();
    return;
  }

  if (dragState.removeBoxArmed && dragState.itemType && dragState.itemId !== null && e.button === 0) {
    const world = screenToWorld(e.clientX, e.clientY);
    const item = getItem(dragState.itemType, dragState.itemId);
    if (item && hitTestRemoveBox(item, world.x, world.y)) {
      if (dragState.itemType === 'bulb') {
        state.selectedBulbIds.clear();
        state.selectedScoreIds.clear();
        state.selectedBulbIds.add(dragState.itemId);
      } else {
        state.selectedBulbIds.clear();
        state.selectedScoreIds.clear();
        state.selectedScoreIds.add(dragState.itemId);
      }
      deleteSelected();
      appendConsoleLine(dragState.itemType === 'bulb' ? 'Illu frame removed' : 'Reel/LED frame removed', 'info');
    }
    resetDragState();
    canvas.style.cursor = 'default';
    return;
  }

  if (dragState.mode === 'pan') {
    state.isPanning = false;
    canvas.style.cursor = 'default';
  }

  if (dragState.mode === 'move' || dragState.mode === 'resize') {
    if (dragState.undoStarted) {
      undoManager.endUndo();
      storeCurrentSettings();
      invokeCallback('dataChanged');
    }
    canvas.style.cursor = 'default';
    updatePropertiesPanel();
    updateAllLists();
  }

  if (dragState.mode === 'dmd-copy-move' || dragState.mode === 'dmd-copy-resize') {
    if (dragState.undoStarted) {
      undoManager.endUndo();
    }
    canvas.style.cursor = 'default';
  }

  resetDragState();
}

function onMouseLeave(e: MouseEvent): void {
  if (dragState.mode !== 'none') {
    onMouseUp(e);
  }
}

function onWheel(e: WheelEvent): void {
  e.preventDefault();
  if (!state.hasFile) return;
  if (e.altKey || e.metaKey) {
    zoomByWheel(e.deltaY < 0 ? 1 : -1, e.clientX, e.clientY);
    return;
  }
  const delta = e.deltaMode === 1 ? e.deltaY * 20 : e.deltaY;
  if (e.ctrlKey || e.shiftKey) {
    state.panX -= delta;
  } else {
    state.panY -= delta;
    state.panX -= e.deltaMode === 1 ? e.deltaX * 20 : e.deltaX;
  }
  requestRender();
}

function onContextMenu(e: MouseEvent): void {
  e.preventDefault();
  if (!state.hasFile) return;

  const world = screenToWorld(e.clientX, e.clientY);
  const hits = hitTestItemsAtPoint(world.x, world.y, true);
  if (hits.length === 0) return;

  const sortKey = (h: { type: 'bulb' | 'score'; id: number }): string => {
    if (h.type === 'score') return ' ' + h.id;
    const bulb = getBulbById(h.id);
    return bulb && bulb.name ? bulb.name + bulb.id : 'ZZZZZZZZ' + h.id;
  };
  const sorted = [...hits].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

  const items: SimpleMenuItem[] = sorted.map(h => {
    let label: string;
    let icon: string;
    if (h.type === 'bulb') {
      const b = getBulbById(h.id)!;
      const idText = romInfoToString(b) || b2sInfoToString(b);
      label = `Name='${b.name}', ID='${idText}${b.b2sValue > 0 ? '/' + b.b2sValue : ''}', text='${b.text}', location='${b.locX}, ${b.locY}', size='${b.width}x${b.height}'`;
      icon = 'icons/illumination2.png';
    } else {
      const s = getScoreById(h.id)!;
      label = `Index='${s.id}', startdigit='${s.b2sStartDigit}', location='${s.locX}, ${s.locY}', size='${s.width}x${s.height}'`;
      icon = 'icons/led_small.png';
    }
    return {
      label,
      icon,
      onHover: () => {
        state.previewedItem = { type: h.type, id: h.id };
        requestRender();
      },
      onLeave: () => {
        state.previewedItem = null;
        requestRender();
      },
      onClick: () => {
        state.previewedItem = null;
        state.selectedBulbIds.clear();
        state.selectedScoreIds.clear();
        if (h.type === 'bulb') state.selectedBulbIds.add(h.id);
        else state.selectedScoreIds.add(h.id);
        state.primarySelection = { type: h.type, id: h.id };
        bringToTopOfStack(h.type, h.id);
        storeCurrentSettings();
        window.dispatchEvent(new CustomEvent('selection-from-context'));
      },
    };
  });

  showSimpleContextMenu(e.clientX, e.clientY, items, () => {
    if (state.previewedItem) {
      state.previewedItem = null;
      requestRender();
    }
  });
}

function setBulbIntensity(intensity: number): void {
  if (state.selectedBulbIds.size === 0) return;
  undoManager.beginUndo('Change intensity');
  for (const id of state.selectedBulbIds) {
    undoManager.markBulbForUndo(id);
    const bulb = getBulbById(id);
    if (bulb) bulb.intensity = intensity;
  }
  undoManager.endUndo();
  storeCurrentSettings();
  invalidateSpriteCache();
  render();
  updatePropertiesPanel();
}

function toggleDodgeColor(index: number): void {
  if (state.selectedBulbIds.size === 0) return;
  undoManager.beginUndo('Change dodge color');
  for (const id of state.selectedBulbIds) {
    undoManager.markBulbForUndo(id);
    const bulb = getBulbById(id);
    if (!bulb) continue;
    if (dodgeColorToIndex(bulb.dodgeColor) === index) bulb.dodgeColor = undefined;
    else bulb.dodgeColor = dodgeColorFromIndex(index);
  }
  undoManager.endUndo();
  storeCurrentSettings();
  invalidateSpriteCache();
  render();
  updatePropertiesPanel();
}

function onKeyDown(e: KeyboardEvent): void {
  if (
    e.target instanceof HTMLInputElement ||
    e.target instanceof HTMLTextAreaElement ||
    e.target instanceof HTMLSelectElement ||
    (e.target instanceof HTMLElement && e.target.isContentEditable)
  ) {
    return;
  }
  if (document.querySelector('.modal:not(.hidden)')) return;

  if (e.key === 'Escape') {
    if (state.addSnippet) {
      e.preventDefault();
      state.addSnippet = false;
      state.snippetDrag = null;
      const { canvas: c } = elements;
      if (c) c.style.cursor = 'default';
      render();
      return;
    }
    if (state.setGrillHeight || state.setSmallGrillHeight) {
      e.preventDefault();
      state.setGrillHeight = false;
      state.setSmallGrillHeight = false;
      state.mouseWorldY = null;
      window.dispatchEvent(
        new CustomEvent('update-menu-state', { detail: { setGrillHeight: false, setSmallGrillHeight: false } })
      );
      render();
      const { canvas } = elements;
      if (canvas) canvas.style.cursor = 'default';
      return;
    }
    if (state.copyDmdFromBackglass) {
      e.preventDefault();
      state.copyDmdFromBackglass = false;
      window.dispatchEvent(new CustomEvent('update-menu-state', { detail: { copyDmdFromBackglass: false } }));
      render();
      const { canvas } = elements;
      if (canvas) canvas.style.cursor = 'default';
      return;
    }
    if (state.setDmdDefaultLocation) {
      e.preventDefault();
      state.setDmdDefaultLocation = false;
      state.mouseWorldX = null;
      state.mouseWorldY = null;
      window.dispatchEvent(new CustomEvent('update-menu-state', { detail: { setDmdDefaultLocation: false } }));
      render();
      const { canvas } = elements;
      if (canvas) canvas.style.cursor = 'default';
      return;
    }
    return;
  }

  if (!state.hasFile) return;
  const ctrlOrCmd = e.ctrlKey || e.metaKey;
  const hasSelection = state.selectedBulbIds.size > 0 || state.selectedScoreIds.size > 0;

  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (hasSelection) {
      e.preventDefault();
      deleteSelected();
    }
    return;
  }

  if (ctrlOrCmd && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    if (e.shiftKey) undoManager.redo();
    else undoManager.undo();
    render();
    updatePropertiesPanel();
    updateAllLists();
    return;
  }

  if (ctrlOrCmd && e.key.toLowerCase() === 'y') {
    e.preventDefault();
    undoManager.redo();
    render();
    updatePropertiesPanel();
    updateAllLists();
    return;
  }

  if (ctrlOrCmd && e.key.toLowerCase() === 'a' && !e.shiftKey) {
    e.preventDefault();
    const parent = state.activeTab === 'dmd' ? 'DMD' : 'Backglass';
    state.selectedBulbIds.clear();
    state.selectedScoreIds.clear();
    if (state.showIlluminationFrames) {
      for (const bulb of state.currentData.illumination) {
        if (bulb.parent === parent) state.selectedBulbIds.add(bulb.id);
      }
    }
    if (state.showScoreFrames) {
      for (const score of state.currentData.scores) {
        if (score.parent === parent) state.selectedScoreIds.add(score.id);
      }
    }
    const firstBulb = state.selectedBulbIds.values().next().value;
    const firstScore = state.selectedScoreIds.values().next().value;
    state.primarySelection =
      firstBulb !== undefined
        ? { type: 'bulb', id: firstBulb }
        : firstScore !== undefined
          ? { type: 'score', id: firstScore }
          : null;
    refreshAfterSelection();
    return;
  }

  if (!hasSelection) return;

  const arrowStep = e.shiftKey ? 10 : 1;
  const arrows: Record<string, [number, number]> = {
    ArrowLeft: [-arrowStep, 0],
    ArrowRight: [arrowStep, 0],
    ArrowUp: [0, -arrowStep],
    ArrowDown: [0, arrowStep],
  };
  const arrow = arrows[e.key];
  if (arrow) {
    e.preventDefault();
    if (e.ctrlKey) {
      resizeSelectedBy(arrow[0], arrow[1]);
    } else {
      moveSelected(arrow[0], arrow[1]);
    }
    return;
  }

  if (ctrlOrCmd || e.altKey) return;

  if (e.key >= '1' && e.key <= '5') {
    e.preventDefault();
    setBulbIntensity(parseInt(e.key, 10));
    return;
  }

  const dodgeKeys: Record<string, number> = { o: 0, r: 1, g: 2, b: 3, y: 4, m: 5, p: 6, w: 7 };
  const dodge = dodgeKeys[e.key.toLowerCase()];
  if (dodge !== undefined) {
    e.preventDefault();
    if (dodge === 0) {
      undoManager.beginUndo('Clear dodge color');
      for (const id of state.selectedBulbIds) {
        undoManager.markBulbForUndo(id);
        const bulb = getBulbById(id);
        if (bulb) bulb.dodgeColor = undefined;
      }
      undoManager.endUndo();
      invalidateSpriteCache();
      render();
      updatePropertiesPanel();
    } else {
      toggleDodgeColor(dodge);
    }
  }
}

function resetDragState(): void {
  dragState.mode = 'none';
  dragState.edge = null;
  dragState.itemType = null;
  dragState.itemId = null;
  dragState.startRect = null;
  dragState.undoStarted = false;
  dragState.removeBoxArmed = false;
  dragState.dmdCopyHandle = null;
  dragState.dmdCopyOriginal = null;
}

async function showInfo(message: string): Promise<void> {
  await getPlatform().dialogs.showMessageBox({ type: 'info', message, buttons: ['OK'] });
}

function handleGrillHeightClick(worldX: number, worldY: number): void {
  const grillHit = hitTestGrillRemoveButton(worldX, worldY);
  const { canvas } = elements;

  if (grillHit === 'grill') {
    undoManager.beginUndo('Remove grill height');
    undoManager.markGrillHeightsForUndo();
    state.currentData.grillHeight = 0;
    undoManager.endUndo();
    markDirty();
    state.setGrillHeight = false;
    state.setSmallGrillHeight = false;
    state.mouseWorldY = null;
    window.dispatchEvent(
      new CustomEvent('update-menu-state', { detail: { setGrillHeight: false, setSmallGrillHeight: false } })
    );
    render();
    updatePropertiesPanel();
    if (canvas) canvas.style.cursor = 'default';
    void showInfo("'Standard grill' location settings are removed.");
    return;
  }

  if (grillHit === 'smallGrill') {
    undoManager.beginUndo('Remove mini grill height');
    undoManager.markGrillHeightsForUndo();
    state.currentData.smallGrillHeight = 0;
    undoManager.endUndo();
    markDirty();
    state.setGrillHeight = false;
    state.setSmallGrillHeight = false;
    state.mouseWorldY = null;
    window.dispatchEvent(
      new CustomEvent('update-menu-state', { detail: { setGrillHeight: false, setSmallGrillHeight: false } })
    );
    render();
    updatePropertiesPanel();
    if (canvas) canvas.style.cursor = 'default';
    void showInfo("'Mini grill' location settings are removed.");
    return;
  }

  const image = state.backgroundImage;
  if (!image) return;

  const imageHeight = image.height;
  const grillHeight = Math.round(imageHeight - worldY);

  if (grillHeight < 0 || grillHeight > imageHeight) return;

  if (state.setGrillHeight) {
    undoManager.beginUndo('Set grill height');
    undoManager.markGrillHeightsForUndo();
    state.currentData.grillHeight = grillHeight;
    undoManager.endUndo();
    markDirty();
    state.setGrillHeight = false;
    state.mouseWorldY = null;
    window.dispatchEvent(new CustomEvent('update-menu-state', { detail: { setGrillHeight: false } }));
    render();
    updatePropertiesPanel();
    void showInfo(`'Standard grill' top location is set to ${Math.round(worldY)} pixel.`);
  } else if (state.setSmallGrillHeight) {
    undoManager.beginUndo('Set mini grill height');
    undoManager.markGrillHeightsForUndo();
    state.currentData.smallGrillHeight = grillHeight;
    undoManager.endUndo();
    markDirty();
    state.setSmallGrillHeight = false;
    state.mouseWorldY = null;
    window.dispatchEvent(new CustomEvent('update-menu-state', { detail: { setSmallGrillHeight: false } }));
    render();
    updatePropertiesPanel();
    void showInfo(`'Mini grill' top location is set to ${Math.round(worldY)} pixel.`);
  }

  if (canvas) {
    canvas.style.cursor = 'default';
  }
}

function handleDmdCopyAreaClick(worldX: number, worldY: number, canvas: HTMLCanvasElement): void {
  const dmdHit = hitTestDmdCopyArea(worldX, worldY);

  if (dmdHit === 'camera') {
    copyDmdFromBackglassArea();
    return;
  }

  if (dmdHit === 'move') {
    dragState.mode = 'dmd-copy-move';
    dragState.dmdCopyHandle = 'move';
    dragState.undoStarted = false;
    dragState.dmdCopyOriginal = {
      x: state.currentData.dmdCopyAreaX,
      y: state.currentData.dmdCopyAreaY,
      w: state.currentData.dmdCopyAreaWidth,
      h: state.currentData.dmdCopyAreaHeight,
    };
    canvas.style.cursor = 'move';
    return;
  }

  if (dmdHit) {
    dragState.mode = 'dmd-copy-resize';
    dragState.dmdCopyHandle = dmdHit;
    dragState.undoStarted = false;
    dragState.dmdCopyOriginal = {
      x: state.currentData.dmdCopyAreaX,
      y: state.currentData.dmdCopyAreaY,
      w: state.currentData.dmdCopyAreaWidth,
      h: state.currentData.dmdCopyAreaHeight,
    };
  }
}

function handleDmdDefaultLocationClick(worldX: number, worldY: number): void {
  const { canvas } = elements;
  if (hitTestDmdDefaultLocationRemove(worldX, worldY)) {
    undoManager.beginUndo('Remove DMD default location');
    undoManager.markDmdAreaForUndo();
    state.currentData.dmdDefaultLocationX = 0;
    state.currentData.dmdDefaultLocationY = 0;
    undoManager.endUndo();
    markDirty();
    state.setDmdDefaultLocation = false;
    state.mouseWorldX = null;
    state.mouseWorldY = null;
    window.dispatchEvent(new CustomEvent('update-menu-state', { detail: { setDmdDefaultLocation: false } }));
    render();
    if (canvas) canvas.style.cursor = 'default';
    void showInfo("The 'B2S DMD' default location is removed.");
    return;
  }

  undoManager.beginUndo('Set DMD default location');
  undoManager.markDmdAreaForUndo();
  state.currentData.dmdDefaultLocationX = Math.round(worldX);
  state.currentData.dmdDefaultLocationY = Math.round(worldY);
  undoManager.endUndo();
  markDirty();
  state.setDmdDefaultLocation = false;
  state.mouseWorldX = null;
  state.mouseWorldY = null;
  window.dispatchEvent(new CustomEvent('update-menu-state', { detail: { setDmdDefaultLocation: false } }));
  render();
  if (canvas) canvas.style.cursor = 'default';
  void showInfo(`The 'B2S DMD' default location is set to point (${Math.round(worldX)},${Math.round(worldY)}).`);
}

function copyDmdFromBackglassArea(): void {
  const data = state.currentData;
  if (data.dmdCopyAreaWidth <= 0 || data.dmdCopyAreaHeight <= 0) return;
  if (!state.backgroundImage) return;

  const offscreen = document.createElement('canvas');
  offscreen.width = data.dmdCopyAreaWidth;
  offscreen.height = data.dmdCopyAreaHeight;
  const offCtx = offscreen.getContext('2d');
  if (!offCtx) return;

  offCtx.drawImage(
    state.backgroundImage,
    data.dmdCopyAreaX,
    data.dmdCopyAreaY,
    data.dmdCopyAreaWidth,
    data.dmdCopyAreaHeight,
    0,
    0,
    data.dmdCopyAreaWidth,
    data.dmdCopyAreaHeight
  );

  const imageData = offscreen.toDataURL('image/png').replace('data:image/png;base64,', '');

  undoManager.beginUndo('Copy DMD from backglass');
  undoManager.markImagesForUndo();
  undoManager.markDmdAreaForUndo();

  data.images.dmdImages.unshift({
    fileName: '',
    imageData,
  });

  data.dmdDefaultLocationX = data.dmdCopyAreaX;
  data.dmdDefaultLocationY = data.dmdCopyAreaY;

  undoManager.endUndo();
  markDirty();

  const img = new Image();
  img.onload = () => {
    state.dmdImage = img;
    window.dispatchEvent(new CustomEvent('menu-action', { detail: 'show-dmd-tab' }));
  };
  img.src = `data:image/png;base64,${imageData}`;

  state.copyDmdFromBackglass = false;
  window.dispatchEvent(new CustomEvent('update-menu-state', { detail: { copyDmdFromBackglass: false } }));
  render();
  updatePropertiesPanel();
  const { canvas } = elements;
  if (canvas) canvas.style.cursor = 'default';
  appendConsoleLine('DMD image copied from backglass', 'info');
}
