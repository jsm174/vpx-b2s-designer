import type { DirectB2SData, ScoreInfo, Color } from '../types/data';
import { isReelImageRendered, isReelImageDream7, IMPORTED_START_STRING, DEFAULT_REEL_COLOR } from '../types/data';
import { getReelResourceSync, loadReelResource, resourcePathForReelImage } from './resources';
import { renderDream7Digit } from './dream7';
import { renderLedDigit } from './rendered-led';

type ImageSource = HTMLImageElement | HTMLCanvasElement;

const pendingLoads = new Set<string>();

export function reelImageName(reelType: string): string {
  return reelType.endsWith('0') ? reelType : reelType + '_0';
}

export function ensureReelResourcesLoaded(reelType: string, onLoaded: () => void): void {
  if (!reelType || isReelImageRendered(reelType) || isReelImageDream7(reelType)) return;
  if (reelType.startsWith(IMPORTED_START_STRING)) return;
  const name = reelImageName(reelType);
  if (getReelResourceSync(name) || pendingLoads.has(name)) return;
  if (!resourcePathForReelImage(name)) return;
  pendingLoads.add(name);
  void loadReelResource(name).then(() => {
    pendingLoads.delete(name);
    onLoaded();
  });
}

const renderedCache = new Map<string, HTMLCanvasElement>();

function colorKey(c: Color): string {
  return `${c.r},${c.g},${c.b}`;
}

export function getRenderedLedImage(
  reelType: string,
  reelColor: Color,
  useDream7: boolean,
  d7Thickness: number,
  d7Shear: number,
  d7Glow: number,
  width: number,
  height: number
): HTMLCanvasElement | null {
  const type = reelType.replace(/^(RenderedLED|Dream7LED)/i, '');
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const key = useDream7
    ? `d7|${type}|${colorKey(reelColor)}|${d7Thickness}|${d7Shear}|${d7Glow}|${w}x${h}`
    : `led|${type}|${colorKey(reelColor)}`;
  const cached = renderedCache.get(key);
  if (cached) return cached;
  let canvas: HTMLCanvasElement;
  if (useDream7) {
    canvas = renderDream7Digit({
      type,
      width: w > 0 && h > 0 ? w : 90,
      height: w > 0 && h > 0 ? h : 120,
      reelColor,
      glow: d7Glow,
      shear: d7Shear,
      thickness: d7Thickness,
    });
  } else {
    canvas = renderLedDigit(type, reelColor);
  }
  if (renderedCache.size > 200) renderedCache.clear();
  renderedCache.set(key, canvas);
  return canvas;
}

export function getReelImage(
  score: ScoreInfo,
  data: DirectB2SData,
  width: number,
  height: number,
  colorOverride?: Color
): ImageSource | null {
  let reelType = score.reelType;
  if ((!reelType || reelType === '0' || reelType === '1' || reelType === '2') && data.reelTypes.length > 0) {
    reelType = data.reelTypes[0];
  }
  if (!reelType) return null;
  const color = colorOverride || score.reelColor || data.reelColor || DEFAULT_REEL_COLOR;
  if (isReelImageRendered(reelType) || isReelImageDream7(reelType)) {
    return getRenderedLedImage(
      reelType,
      color,
      data.useDream7LEDs,
      data.d7Thickness,
      data.d7Shear,
      data.d7Glow,
      width,
      height
    );
  }
  if (reelType.startsWith(IMPORTED_START_STRING)) {
    return getImportedReelImage(data, reelType);
  }
  const res = getReelResourceSync(reelImageName(reelType));
  return res ? res.image : null;
}

const importedImageCache = new Map<string, HTMLImageElement | null>();

function getImportedReelImage(data: DirectB2SData, reelType: string): HTMLImageElement | null {
  const name = reelImageName(reelType);
  const cached = importedImageCache.get(name);
  if (cached !== undefined) return cached;
  const entry = data.reels.images.find(i => i.name.toLowerCase() === name.toLowerCase());
  if (!entry || !entry.imageData) {
    importedImageCache.set(name, null);
    return null;
  }
  const img = new Image();
  img.src = `data:image/png;base64,${entry.imageData}`;
  importedImageCache.set(name, img);
  return img;
}

export function clearReelRenderCaches(): void {
  renderedCache.clear();
  importedImageCache.clear();
}
