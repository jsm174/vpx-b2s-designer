import type { Bulb } from '../types/data';
import { state, markDirty } from './state';
import { undoManager } from './undo';
import { detectImageFormat, bulbImageCache, invalidateBulbImage } from './parts/bulb';
import { render } from './canvas-renderer';
import { updatePropertiesPanel, updateAllLists } from './properties-panel';
import { appendConsoleLine } from './console-panel';

function loadImage(base64: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image decode failed'));
    img.src = `data:${detectImageFormat(base64)};base64,${base64}`;
  });
}

export function findOpaqueBounds(canvas: HTMLCanvasElement): { x: number; y: number; w: number; h: number } | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const w = canvas.width;
  const h = canvas.height;
  const data = ctx.getImageData(0, 0, w, h).data;

  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = data[(y * w + x) * 4 + 3];
      if (a > 0) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

export interface TrimResult {
  base64: string;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

export async function trimSnippetImage(base64: string): Promise<TrimResult | null> {
  const img = await loadImage(base64);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  const bounds = findOpaqueBounds(canvas);
  if (!bounds) return null;
  if (bounds.x === 0 && bounds.y === 0 && bounds.w === canvas.width && bounds.h === canvas.height) return null;

  const trimCanvas = document.createElement('canvas');
  trimCanvas.width = bounds.w;
  trimCanvas.height = bounds.h;
  trimCanvas.getContext('2d')!.drawImage(canvas, -bounds.x, -bounds.y);
  return {
    base64: trimCanvas.toDataURL('image/png').split(',')[1] || '',
    width: bounds.w,
    height: bounds.h,
    offsetX: bounds.x,
    offsetY: bounds.y,
  };
}

function applyTrimToBulb(bulb: Bulb, result: TrimResult): void {
  bulb.locX += result.offsetX;
  bulb.locY += result.offsetY;
  bulb.width = result.width;
  bulb.height = result.height;
  bulb.imageData = result.base64;
  invalidateBulbImage(bulb.id);
}

export async function trimSnippetBulb(selected: Bulb): Promise<boolean> {
  if (!selected.isImageSnippet || !selected.imageData) return false;
  const result = await trimSnippetImage(selected.imageData);
  if (!result) return false;
  undoManager.beginUndo('Trim snippit image');
  for (const bulb of state.currentData.illumination) {
    if (bulb.name === selected.name && bulb.isImageSnippet) {
      undoManager.markBulbForUndo(bulb.id);
      applyTrimToBulb(bulb, result);
    }
  }
  undoManager.endUndo();
  markDirty();
  render();
  updatePropertiesPanel();
  updateAllLists();
  return true;
}

export async function trimAllSnippets(): Promise<void> {
  if (!state.currentData) return;
  const snippets = state.currentData.illumination.filter(b => b.isImageSnippet && b.imageData);
  if (snippets.length === 0) {
    appendConsoleLine('No snippit bulbs to trim.', 'info');
    return;
  }

  let trimmed = 0;
  undoManager.beginUndo(`Trim ${snippets.length} snippits`);
  const done = new Set<number>();

  for (const bulb of snippets) {
    if (done.has(bulb.id)) continue;
    try {
      const result = await trimSnippetImage(bulb.imageData);
      if (!result) continue;
      for (const other of snippets) {
        if (other.name === bulb.name && other.imageData === bulb.imageData) {
          undoManager.markBulbForUndo(other.id);
          applyTrimToBulb(other, result);
          done.add(other.id);
          trimmed++;
        }
      }
    } catch {
      // skip undecodable images
    }
  }

  undoManager.endUndo();
  bulbImageCache.clear();
  if (trimmed > 0) {
    markDirty();
    render();
    updatePropertiesPanel();
    updateAllLists();
    appendConsoleLine(`Trimmed ${trimmed} snippit${trimmed === 1 ? '' : 's'}.`, 'info');
  } else {
    appendConsoleLine('No snippits needed trimming.', 'info');
  }
}
