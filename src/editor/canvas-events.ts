import { state, elements, markDirty } from './state';
import { appendConsoleLine } from './console-panel';
import {
  render,
  requestRender,
  screenToWorld,
  hitTestAtPoint,
  hitTestResizeHandleAtPoint,
  hitTestGrillRemoveButton,
  hitTestDmdCopyArea,
  hitTestDmdDefaultLocationRemove,
  zoomAtPoint,
  updateCoordsDisplay,
  type DmdCopyAreaHit,
} from './canvas-renderer';
import { selectBulb, selectScore, clearSelection, isSelected } from './selection';
import { updatePropertiesPanel, updateAllLists } from './properties-panel';
import { deleteSelected, moveSelected, resizeItem } from './object-operations';
import { undoManager } from './undo';
import type { ResizeHandle } from './parts';

interface DragState {
  mode: 'none' | 'pan' | 'move' | 'resize' | 'marquee' | 'dmd-copy-move' | 'dmd-copy-resize';
  startScreenX: number;
  startScreenY: number;
  startWorldX: number;
  startWorldY: number;
  lastWorldX: number;
  lastWorldY: number;
  resizeHandle: ResizeHandle | null;
  resizeType: 'bulb' | 'score' | null;
  resizeId: number | null;
  originalPositions: Map<number, { x: number; y: number; w: number; h: number }>;
  undoStarted: boolean;
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
  resizeHandle: null,
  resizeType: null,
  resizeId: null,
  originalPositions: new Map(),
  undoStarted: false,
  dmdCopyHandle: null,
  dmdCopyOriginal: null,
};

export function setupCanvasEvents(): void {
  const { canvas } = elements;
  if (!canvas) return;

  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('mouseleave', onMouseLeave);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', onContextMenu);

  document.addEventListener('keydown', onKeyDown);
}

function onMouseDown(e: MouseEvent): void {
  const { canvas } = elements;
  if (!canvas) return;

  const world = screenToWorld(e.clientX, e.clientY);
  dragState.startScreenX = e.clientX;
  dragState.startScreenY = e.clientY;
  dragState.startWorldX = world.x;
  dragState.startWorldY = world.y;
  dragState.lastWorldX = world.x;
  dragState.lastWorldY = world.y;

  if (e.button === 1 || (e.button === 0 && e.altKey)) {
    dragState.mode = 'pan';
    state.isPanning = true;
    state.panStartX = e.clientX - state.panX;
    state.panStartY = e.clientY - state.panY;
    canvas.style.cursor = 'grabbing';
    return;
  }

  if (e.button === 0) {
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

    const resizeHit = hitTestResizeHandleAtPoint(world.x, world.y);
    if (resizeHit) {
      dragState.mode = 'resize';
      dragState.resizeHandle = resizeHit.handle;
      dragState.resizeType = resizeHit.type;
      dragState.resizeId = resizeHit.id;
      dragState.undoStarted = false;
      canvas.style.cursor = resizeHit.handle.cursor;
      return;
    }

    const hit = hitTestAtPoint(world.x, world.y);
    if (hit) {
      const alreadySelected = isSelected(hit.type, hit.id);

      if (!e.shiftKey && !alreadySelected) {
        clearSelection();
      }

      if (hit.type === 'bulb') {
        selectBulb(hit.id, e.shiftKey);
      } else {
        selectScore(hit.id, e.shiftKey);
      }

      dragState.mode = 'move';
      dragState.undoStarted = false;
      saveOriginalPositions();
      canvas.style.cursor = 'move';

      render();
      updatePropertiesPanel();
      updateAllLists();
      return;
    }

    clearSelection();
    render();
    updatePropertiesPanel();
    updateAllLists();
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
    render();
    return;
  }

  if (dragState.mode === 'move') {
    const dx = world.x - dragState.lastWorldX;
    const dy = world.y - dragState.lastWorldY;

    if (!dragState.undoStarted && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) {
      undoManager.beginUndo('Move');
      for (const id of state.selectedBulbIds) {
        undoManager.markBulbForUndo(id);
      }
      for (const id of state.selectedScoreIds) {
        undoManager.markScoreForUndo(id);
      }
      dragState.undoStarted = true;
    }

    if (dragState.undoStarted) {
      moveSelected(dx, dy, false);
      dragState.lastWorldX = world.x;
      dragState.lastWorldY = world.y;
    }
    return;
  }

  if (dragState.mode === 'resize') {
    const dx = world.x - dragState.lastWorldX;
    const dy = world.y - dragState.lastWorldY;

    if (!dragState.undoStarted && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) {
      undoManager.beginUndo('Resize');
      if (dragState.resizeType === 'bulb') {
        undoManager.markBulbForUndo(dragState.resizeId!);
      } else {
        undoManager.markScoreForUndo(dragState.resizeId!);
      }
      dragState.undoStarted = true;
    }

    if (dragState.undoStarted && dragState.resizeHandle) {
      resizeItem(dragState.resizeType!, dragState.resizeId!, dragState.resizeHandle.position, dx, dy, false);
      dragState.lastWorldX = world.x;
      dragState.lastWorldY = world.y;
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

        if (newW < 10) {
          if (h === 'nw' || h === 'w' || h === 'sw') newX = orig.x + orig.w - 10;
          newW = 10;
        }
        if (newH < 10) {
          if (h === 'nw' || h === 'n' || h === 'ne') newY = orig.y + orig.h - 10;
          newH = 10;
        }

        data.dmdCopyAreaX = Math.round(newX);
        data.dmdCopyAreaY = Math.round(newY);
        data.dmdCopyAreaWidth = Math.round(newW);
        data.dmdCopyAreaHeight = Math.round(newH);
      }

      dragState.lastWorldX = world.x;
      dragState.lastWorldY = world.y;
      render();
    }
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

    const resizeHit = hitTestResizeHandleAtPoint(world.x, world.y);
    if (resizeHit) {
      canvas.style.cursor = resizeHit.handle.cursor;
    } else {
      const hit = hitTestAtPoint(world.x, world.y);
      canvas.style.cursor = hit ? 'pointer' : 'default';
    }
  }
}

function onMouseUp(_e: MouseEvent): void {
  const { canvas } = elements;
  if (!canvas) return;

  if (dragState.mode === 'pan') {
    state.isPanning = false;
    canvas.style.cursor = 'default';
  }

  if (dragState.mode === 'move' || dragState.mode === 'resize') {
    if (dragState.undoStarted) {
      undoManager.endUndo();
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

function onMouseLeave(_e: MouseEvent): void {
  if (dragState.mode !== 'none') {
    onMouseUp(_e);
  }
}

function onWheel(e: WheelEvent): void {
  e.preventDefault();
  const factor = e.deltaY > 0 ? 0.9 : 1.1;
  zoomAtPoint(factor, e.clientX, e.clientY);
}

function onContextMenu(e: MouseEvent): void {
  e.preventDefault();
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
    return;
  }

  if (e.key === 'Escape') {
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
  }

  const ctrlOrCmd = e.ctrlKey || e.metaKey;

  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (state.selectedBulbIds.size > 0 || state.selectedScoreIds.size > 0) {
      e.preventDefault();
      deleteSelected();
    }
    return;
  }

  if (ctrlOrCmd && e.key === 'z') {
    e.preventDefault();
    if (e.shiftKey) {
      undoManager.redo();
    } else {
      undoManager.undo();
    }
    render();
    updatePropertiesPanel();
    updateAllLists();
    return;
  }

  if (ctrlOrCmd && e.key === 'y') {
    e.preventDefault();
    undoManager.redo();
    render();
    updatePropertiesPanel();
    updateAllLists();
    return;
  }

  if (ctrlOrCmd && e.key === 'a') {
    e.preventDefault();
    for (const bulb of state.currentData.illumination) {
      state.selectedBulbIds.add(bulb.id);
    }
    for (const score of state.currentData.scores) {
      state.selectedScoreIds.add(score.id);
    }
    if (state.currentData.illumination.length > 0) {
      state.primarySelection = { type: 'bulb', id: state.currentData.illumination[0].id };
    } else if (state.currentData.scores.length > 0) {
      state.primarySelection = { type: 'score', id: state.currentData.scores[0].id };
    }
    render();
    updatePropertiesPanel();
    updateAllLists();
    return;
  }

  const arrowStep = e.shiftKey ? 10 : 1;
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    moveSelected(-arrowStep, 0);
    return;
  }
  if (e.key === 'ArrowRight') {
    e.preventDefault();
    moveSelected(arrowStep, 0);
    return;
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    moveSelected(0, -arrowStep);
    return;
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    moveSelected(0, arrowStep);
    return;
  }
}

function saveOriginalPositions(): void {
  dragState.originalPositions.clear();

  for (const id of state.selectedBulbIds) {
    const bulb = state.currentData.illumination.find(b => b.id === id);
    if (bulb) {
      dragState.originalPositions.set(id, {
        x: bulb.locX,
        y: bulb.locY,
        w: bulb.width,
        h: bulb.height,
      });
    }
  }

  for (const id of state.selectedScoreIds) {
    const score = state.currentData.scores.find(s => s.id === id);
    if (score) {
      dragState.originalPositions.set(id + 10000, {
        x: score.locX,
        y: score.locY,
        w: score.width,
        h: score.height,
      });
    }
  }
}

function resetDragState(): void {
  dragState.mode = 'none';
  dragState.resizeHandle = null;
  dragState.resizeType = null;
  dragState.resizeId = null;
  dragState.undoStarted = false;
  dragState.originalPositions.clear();
  dragState.dmdCopyHandle = null;
  dragState.dmdCopyOriginal = null;
}

function handleGrillHeightClick(worldX: number, worldY: number): void {
  const grillHit = hitTestGrillRemoveButton(worldX, worldY);

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
    const { canvas } = elements;
    if (canvas) canvas.style.cursor = 'default';
    appendConsoleLine('Grill height removed', 'info');
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
    const { canvas } = elements;
    if (canvas) canvas.style.cursor = 'default';
    appendConsoleLine('Mini grill height removed', 'info');
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
    appendConsoleLine(`Grill height set to ${grillHeight}px`, 'info');
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
    appendConsoleLine(`Mini grill height set to ${grillHeight}px`, 'info');
  }

  const { canvas } = elements;
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
    const { canvas } = elements;
    if (canvas) canvas.style.cursor = 'default';
    appendConsoleLine('DMD default location removed', 'info');
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
  const { canvas } = elements;
  if (canvas) canvas.style.cursor = 'default';
  appendConsoleLine(`DMD default location set to (${Math.round(worldX)}, ${Math.round(worldY)})`, 'info');
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

  data.images.dmdImages = [
    {
      fileName: 'DMD from backglass',
      imageData,
    },
  ];

  data.dmdDefaultLocationX = data.dmdCopyAreaX;
  data.dmdDefaultLocationY = data.dmdCopyAreaY;

  undoManager.endUndo();
  markDirty();

  const img = new Image();
  img.onload = () => {
    state.dmdImage = img;
    render();
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
