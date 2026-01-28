import { state } from './state';
import { getPlatform } from '../platform';
import { appendConsoleLine } from './console-panel';
import { getReelImage } from './reel-render';
import { singleReelSize } from './parts/score';
import { createWholeLightLayer, ensureSnippetImagesLoaded } from './illumination-render';
import { bulbImageCache } from './parts/bulb';
import { getMainBackgroundImage } from '../types/data';

function drawScores(ctx: CanvasRenderingContext2D, parent: 'Backglass' | 'DMD', dark: boolean): void {
  const data = state.currentData;
  for (const score of data.scores) {
    if (score.parent !== parent || score.digits <= 0) continue;
    const { width, height } = singleReelSize(score);
    if (width <= 0 || height <= 0) continue;
    const image = getReelImage(score, data, width, height, dark ? { r: 0, g: 0, b: 0, a: 255 } : undefined);
    if (!image) continue;
    let x = score.locX + 1;
    const y = score.locY + 1;
    for (let i = 0; i < score.digits; i++) {
      ctx.drawImage(image, x, y, width, height);
      x += width + score.spacing / 2;
    }
  }
}

function sourceImageExtension(): string {
  const main = getMainBackgroundImage(state.currentData.images);
  const name = main?.fileName || '';
  const m = /\.([a-z0-9]+)$/i.exec(name);
  const ext = m ? m[1].toLowerCase() : 'png';
  return ext === 'jpg' || ext === 'jpeg' ? 'jpg' : 'png';
}

async function saveCanvas(canvas: HTMLCanvasElement, suffix: string): Promise<void> {
  const ext = sourceImageExtension();
  const mime = ext === 'jpg' ? 'image/jpeg' : 'image/png';
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, mime, 0.95));
  if (!blob) return;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const baseName = state.currentData.name || 'Backglass';
  const fileName = `${baseName} ${suffix}.${ext}`;
  const platform = getPlatform();
  const result = await platform.dialogs.showSaveDialog({
    title: `Create ${suffix} Backglass Image`,
    defaultPath: fileName,
    filters: [{ name: `${ext.toUpperCase()} Image`, extensions: [ext] }],
    binaryContent: bytes,
  });
  if (result) {
    appendConsoleLine(`${suffix} backglass image saved: ${result.filePath}`, 'success');
  }
}

export async function createDarkBackglassImage(): Promise<void> {
  const isDmd = state.activeTab === 'dmd';
  const bg = isDmd ? state.dmdImage : state.backgroundImage;
  if (!bg) return;
  const canvas = document.createElement('canvas');
  canvas.width = bg.width;
  canvas.height = bg.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bg, 0, 0);
  drawScores(ctx, isDmd ? 'DMD' : 'Backglass', true);
  await saveCanvas(canvas, 'Dark');
}

export async function createIlluminatedBackglassImage(): Promise<void> {
  const isDmd = state.activeTab === 'dmd';
  const bg = isDmd ? state.dmdImage : state.backgroundImage;
  if (!bg) return;
  const parent = isDmd ? 'DMD' : 'Backglass';
  const bulbs = state.currentData.illumination.filter(b => b.parent === parent);
  await ensureSnippetImagesLoaded(bulbs);

  const canvas = document.createElement('canvas');
  canvas.width = bg.width;
  canvas.height = bg.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bg, 0, 0);
  const layer = createWholeLightLayer(bg, bulbs);
  if (layer) ctx.drawImage(layer, 0, 0);
  for (const bulb of bulbs) {
    if (bulb.isImageSnippet) {
      const img = bulbImageCache.get(bulb.id);
      if (img) ctx.drawImage(img, bulb.locX, bulb.locY, bulb.width, bulb.height);
    }
  }
  drawScores(ctx, parent, false);
  await saveCanvas(canvas, 'Illuminated');
}
