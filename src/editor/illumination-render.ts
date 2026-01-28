import type { Bulb, Color, ReelIlluLocation } from '../types/data';
import { DEFAULT_LIGHT_COLOR } from '../types/data';
import { detectImageFormat, bulbImageCache } from './parts/bulb';

export const C_OVERLAYS = 2;
const C_BULBRADIUS = 0.15;

export type ImageSource = HTMLImageElement | HTMLCanvasElement;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface IlluminationRenderOpts {
  useIntensity: boolean;
  litFilter?: Set<number> | null;
}

export function colorOverlay(a: number, b: number): number {
  const c = a < 128 ? (2 * b * a) / 255 : 255 - (2 * (255 - b) * (255 - a)) / 255;
  return c > 255 ? 255 : Math.round(c);
}

export function colorDodge(a: number, b: number): number {
  if (b === 255) return 255;
  const c = (a << 8) / (255 - b);
  return c > 255 ? 255 : Math.round(c);
}

export function clipRectToImage(rect: Rect, imgW: number, imgH: number): Rect {
  let x = rect.x;
  let y = rect.y;
  let w = rect.w;
  let h = rect.h;
  if (rect.x < 0) {
    w = w + rect.x;
    x = 0;
  } else if (rect.x > imgW) {
    x = imgW;
    w = 0;
  } else if (rect.x + w > imgW) {
    w = imgW - rect.x;
  }
  if (w < 0) w = 0;
  if (w > imgW) w = imgW;
  if (rect.y < 0) {
    h = h + rect.y;
    y = 0;
  } else if (rect.y > imgH) {
    y = imgH;
    h = 0;
  } else if (rect.y + h > imgH) {
    h = imgH - rect.y;
  }
  if (h < 0) h = 0;
  if (h > imgH) h = imgH;
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
}

export function bulbRect(bulb: Bulb): Rect {
  return { x: Math.round(bulb.locX), y: Math.round(bulb.locY), w: Math.round(bulb.width), h: Math.round(bulb.height) };
}

function createCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  return c;
}

const bgCanvasCache = new WeakMap<ImageSource, HTMLCanvasElement>();

export function getBgCanvas(bg: ImageSource): HTMLCanvasElement {
  if (bg instanceof HTMLCanvasElement) return bg;
  const cached = bgCanvasCache.get(bg);
  if (cached && cached.width === bg.width && cached.height === bg.height) return cached;
  const c = createCanvas(bg.width, bg.height);
  c.getContext('2d')!.drawImage(bg, 0, 0);
  bgCanvasCache.set(bg, c);
  return c;
}

export function fontToCss(fontName: string, fontSize: number, fontStyle: number): string {
  const bold = fontStyle & 1 ? 'bold ' : '';
  const italic = fontStyle & 2 ? 'italic ' : '';
  const px = Math.max(1, (fontSize * 96) / 72);
  const family = fontName ? `"${fontName}", sans-serif` : 'sans-serif';
  return `${italic}${bold}${px}px ${family}`;
}

function fillEllipseGradient(ctx: CanvasRenderingContext2D, rect: Rect, centerAlpha: number): void {
  const cx = rect.x + rect.w / 2 - 5;
  const cy = rect.y + rect.h / 2;
  const rx = Math.max(1, rect.w / 2);
  const ry = Math.max(1, rect.h / 2);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(rect.x + rect.w / 2, rect.y + rect.h / 2, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.scale(rx, ry);
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  grad.addColorStop(0, `rgba(255,255,255,${centerAlpha})`);
  grad.addColorStop(C_BULBRADIUS, `rgba(255,255,255,${centerAlpha})`);
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(-rx * 2, -ry * 2, rx * 4, ry * 4);
  ctx.restore();
}

function fillStarGradient(ctx: CanvasRenderingContext2D, rect: Rect, centerAlpha: number): void {
  const f = 5;
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w / f, y + h / 2);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x + w / 2, y + (h / f) * (f - 1));
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ctx.moveTo(x + w, y + h);
  ctx.lineTo(x + (w / f) * (f - 1), y + h / 2);
  ctx.lineTo(x + w, y);
  ctx.closePath();
  ctx.moveTo(x + w, y);
  ctx.lineTo(x + w / 2, y + h / f);
  ctx.lineTo(x, y);
  ctx.closePath();
  ctx.clip();
  const cx = x + w / 2 - 5;
  const cy = y + h / 2;
  const rx = Math.max(1, w / 2);
  const ry = Math.max(1, h / 2);
  ctx.translate(cx, cy);
  ctx.scale(rx, ry);
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  grad.addColorStop(0, `rgba(255,255,255,${centerAlpha})`);
  grad.addColorStop(C_BULBRADIUS, `rgba(255,255,255,${centerAlpha})`);
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(-2, -2, 4, 4);
  ctx.restore();
}

export interface LightTextOpts {
  text: string;
  fontName: string;
  fontSize: number;
  fontStyle: number;
  textAlignment: number;
}

export function drawLight(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  text: LightTextOpts | null,
  illuMode: 'Standard' | 'Flasher'
): void {
  const hasText = !!(text && text.text);
  const centerAlpha = hasText ? 30 / 255 : 1;

  if (illuMode === 'Flasher') {
    fillStarGradient(ctx, rect, centerAlpha);
    fillEllipseGradient(ctx, rect, centerAlpha);
  } else {
    fillEllipseGradient(ctx, rect, centerAlpha);
  }

  if (hasText && text) {
    ctx.save();
    ctx.font = fontToCss(text.fontName, text.fontSize, text.fontStyle);
    ctx.textBaseline = 'top';
    const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w - 1, rect.y + rect.h - 1);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    const lines = text.text.split(/\r\n|\n|\r/).map(l => l.trim());
    const px = Math.max(1, (text.fontSize * 96) / 72);
    const lineHeight = px * 1.2;
    const totalHeight = lineHeight * lines.length;
    let y = rect.y + (rect.h - totalHeight) / 2;
    for (const line of lines) {
      const width = ctx.measureText(line).width;
      let x = rect.x + (rect.w - width) / 2 + 2;
      if (text.textAlignment === 1) x = 2;
      else if (text.textAlignment === 2) x = rect.x + rect.w - width + 2;
      ctx.fillText(line, x, y);
      y += lineHeight;
    }
    ctx.restore();
  }
}

export function mergeLayers(
  bgData: ImageData,
  lightData: ImageData,
  overlays: number,
  lightColor: Color | null,
  dodgeColor: Color | null | undefined
): void {
  const lc = lightColor || DEFAULT_LIGHT_COLOR;
  const n = overlays > 0 ? overlays : C_OVERLAYS;
  const bg = bgData.data;
  const out = lightData.data;
  const len = Math.min(bg.length, out.length);
  for (let i = 0; i < len; i += 4) {
    let r = bg[i];
    let g = bg[i + 1];
    let b = bg[i + 2];
    for (let j = 0; j < n; j++) {
      r = colorOverlay(r, lc.r);
      g = colorOverlay(g, lc.g);
      b = colorOverlay(b, lc.b);
    }
    if (dodgeColor) {
      r = colorDodge(r, dodgeColor.r);
      g = colorDodge(g, dodgeColor.g);
      b = colorDodge(b, dodgeColor.b);
    }
    out[i] = r;
    out[i + 1] = g;
    out[i + 2] = b;
  }
}

export interface OverlayOpts {
  intensity: number;
  lightColor: Color | null;
  dodgeColor?: Color | null;
  text: LightTextOpts | null;
  illuMode: 'Standard' | 'Flasher';
}

export function createOverlayImage(
  bg: ImageSource,
  rect: Rect,
  rectX: Rect,
  opts: OverlayOpts
): HTMLCanvasElement | null {
  if (rectX.w <= 0 || rectX.h <= 0 || rect.w <= 0 || rect.h <= 0) return null;
  const bgCanvas = getBgCanvas(bg);
  const bgCtx = bgCanvas.getContext('2d')!;
  const bgData = bgCtx.getImageData(rectX.x, rectX.y, rectX.w, rectX.h);

  const light = createCanvas(rect.w, rect.h);
  const lctx = light.getContext('2d')!;
  drawLight(lctx, { x: 0, y: 0, w: rect.w, h: rect.h }, opts.text, opts.illuMode);

  let srcX = 0;
  let srcY = 0;
  if (rect.x !== rectX.x || rect.y !== rectX.y || rect.w !== rectX.w || rect.h !== rectX.h) {
    srcX = rect.x < 0 ? -rect.x : 0;
    srcY = rect.y < 0 ? -rect.y : 0;
  }
  const lightData = lctx.getImageData(srcX, srcY, rectX.w, rectX.h);
  mergeLayers(bgData, lightData, opts.intensity, opts.lightColor, opts.dodgeColor);

  const out = createCanvas(rectX.w, rectX.h);
  out.getContext('2d')!.putImageData(lightData, 0, 0);
  return out;
}

export function createImageWithOverlay(
  image: ImageSource,
  rect: Rect,
  rectX: Rect,
  opts: OverlayOpts
): HTMLCanvasElement {
  const out = createCanvas(image.width, image.height);
  const ctx = out.getContext('2d')!;
  ctx.drawImage(image, 0, 0);
  const overlay = createOverlayImage(image, rect, rectX, opts);
  if (overlay) ctx.drawImage(overlay, rectX.x, rectX.y);
  return out;
}

export function bulbTextOpts(bulb: Bulb): LightTextOpts | null {
  if (!bulb.text) return null;
  return {
    text: bulb.text,
    fontName: bulb.fontName,
    fontSize: bulb.fontSize,
    fontStyle: bulb.fontStyle,
    textAlignment: bulb.textAlignment,
  };
}

export function createBulbSprite(
  bg: ImageSource,
  bulb: Bulb,
  intensity: number,
  useDodge: boolean
): HTMLCanvasElement | null {
  const rect = bulbRect(bulb);
  const rectX = clipRectToImage(rect, bg.width, bg.height);
  return createOverlayImage(bg, rect, rectX, {
    intensity,
    lightColor: bulb.lightColor,
    dodgeColor: useDodge ? bulb.dodgeColor : null,
    text: bulbTextOpts(bulb),
    illuMode: bulb.illuminationMode,
  });
}

export function createBulbOffSprite(offBg: ImageSource, bulb: Bulb): HTMLCanvasElement | null {
  const rect = bulbRect(bulb);
  const rectX = clipRectToImage(rect, offBg.width, offBg.height);
  let lowerIntensity = Math.max(bulb.intensity - 2, 1);
  if (bulb.dodgeColor) lowerIntensity = 3;
  return createOverlayImage(offBg, rect, rectX, {
    intensity: lowerIntensity,
    lightColor: bulb.lightColor,
    dodgeColor: null,
    text: bulbTextOpts(bulb),
    illuMode: bulb.illuminationMode,
  });
}

export function drawIlluminatedReelImage(
  reelImage: ImageSource,
  intensity: number,
  location: ReelIlluLocation
): ImageSource {
  if (location === 'Off') return reelImage;
  const w = reelImage.width;
  const h = reelImage.height;
  let halfHeight: number;
  if (location === 'Above' || location === 'AboveAndBelow') {
    halfHeight = Math.round(h / 2) + Math.round(h / 10);
  } else {
    halfHeight = Math.max(4, Math.round(h / 13));
  }
  const opts: OverlayOpts = { intensity, lightColor: null, dodgeColor: null, text: null, illuMode: 'Standard' };
  const top = createImageWithOverlay(
    reelImage,
    { x: 0, y: -halfHeight, w, h: 2 * halfHeight },
    { x: 0, y: 0, w, h: halfHeight },
    opts
  );
  if (location === 'Below' || location === 'AboveAndBelow') {
    halfHeight = Math.round(h / 2) + Math.round(h / 10);
  } else {
    halfHeight = Math.max(4, Math.round(h / 13));
  }
  return createImageWithOverlay(
    top,
    { x: 0, y: top.height - halfHeight, w: top.width, h: 2 * halfHeight },
    { x: 0, y: top.height - halfHeight, w: top.width, h: halfHeight },
    opts
  );
}

export function createIntermediates(
  nextImage: ImageSource,
  currentImage: ImageSource,
  count: number,
  rollingUp: boolean
): HTMLCanvasElement[] {
  const out: HTMLCanvasElement[] = [];
  if (count <= 0) return out;
  const w = Math.max(nextImage.width, currentImage.width);
  const h = Math.max(nextImage.height, currentImage.height);
  const nextCut = nextImage.height / (count + 1);
  const curCut = currentImage.height / (count + 1);
  let nextCutLoc = nextCut;
  let curCutLoc = curCut;
  for (let i = 0; i < count; i++) {
    const nextCutI = Math.trunc(nextCutLoc);
    const curCutI = Math.trunc(curCutLoc);
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (rollingUp) {
      const lastH = currentImage.height - curCutI;
      ctx.drawImage(currentImage, 0, curCutI, currentImage.width, lastH, 0, 0, currentImage.width, lastH);
      ctx.drawImage(nextImage, 0, 0, nextImage.width, nextCutI, 0, lastH, nextImage.width, nextCutI);
    } else {
      const curPartY = nextImage.height - nextCutI;
      ctx.drawImage(nextImage, 0, curPartY, nextImage.width, nextCutI, 0, 0, nextImage.width, nextCutI);
      const lastH = currentImage.height - curCutI;
      ctx.drawImage(currentImage, 0, 0, currentImage.width, lastH, 0, nextCutI, currentImage.width, lastH);
    }
    out.push(canvas);
    nextCutLoc += nextCut;
    curCutLoc += curCut;
  }
  return out;
}

export function bakeLightsIntoImage(bg: ImageSource, bulbs: Bulb[]): HTMLCanvasElement {
  const out = createCanvas(bg.width, bg.height);
  const ctx = out.getContext('2d')!;
  ctx.drawImage(bg, 0, 0);
  for (const bulb of bulbs) {
    if (bulb.isImageSnippet) {
      const img = bulbImageCache.get(bulb.id);
      if (img) ctx.drawImage(img, bulb.locX, bulb.locY, bulb.width, bulb.height);
      continue;
    }
    const sprite = createBulbSprite(bg, bulb, bulb.intensity, true);
    if (sprite) {
      const rectX = clipRectToImage(bulbRect(bulb), bg.width, bg.height);
      ctx.drawImage(sprite, rectX.x, rectX.y);
    }
  }
  return out;
}

export function createWholeLightLayer(bg: ImageSource, bulbs: Bulb[]): HTMLCanvasElement | null {
  const lights = bulbs.filter(b => !b.isImageSnippet);
  if (lights.length === 0) return null;
  const layer = createCanvas(bg.width, bg.height);
  const lctx = layer.getContext('2d')!;
  for (const bulb of lights) {
    drawLight(lctx, bulbRect(bulb), bulbTextOpts(bulb), bulb.illuminationMode);
  }
  const bgCanvas = getBgCanvas(bg);
  const bgData = bgCanvas.getContext('2d')!.getImageData(0, 0, bg.width, bg.height);
  const lightData = lctx.getImageData(0, 0, bg.width, bg.height);
  mergeLayers(bgData, lightData, C_OVERLAYS, null, null);
  lctx.putImageData(lightData, 0, 0);
  return layer;
}

export function canvasToBase64Png(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png').split(',')[1] || '';
}

export async function ensureSnippetImagesLoaded(bulbs: Bulb[]): Promise<void> {
  const toLoad = bulbs.filter(b => b.isImageSnippet && b.imageData && !bulbImageCache.has(b.id));
  if (toLoad.length === 0) return;
  await Promise.all(
    toLoad.map(
      bulb =>
        new Promise<void>(resolve => {
          const img = new Image();
          img.onload = () => {
            bulbImageCache.set(bulb.id, img);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = `data:${detectImageFormat(bulb.imageData)};base64,${bulb.imageData}`;
        })
    )
  );
}

function spriteKey(bulb: Bulb, intensity: number): string {
  const lc = bulb.lightColor;
  const dc = bulb.dodgeColor;
  return [
    intensity,
    lc.r,
    lc.g,
    lc.b,
    dc ? `${dc.r},${dc.g},${dc.b}` : '-',
    bulb.locX,
    bulb.locY,
    bulb.width,
    bulb.height,
    bulb.illuminationMode,
    bulb.text,
    bulb.fontName,
    bulb.fontSize,
    bulb.fontStyle,
    bulb.textAlignment,
  ].join('|');
}

const spriteCache = new Map<number, { key: string; sprite: HTMLCanvasElement | null }>();
let lastBg: ImageSource | null = null;
let wholeLayerCache: { key: string; layer: HTMLCanvasElement | null } | null = null;

export function invalidateSpriteCache(): void {
  spriteCache.clear();
  wholeLayerCache = null;
}

export function getCachedBulbSprite(bg: ImageSource, bulb: Bulb, intensity: number): HTMLCanvasElement | null {
  if (bg !== lastBg) {
    invalidateSpriteCache();
    lastBg = bg;
  }
  const key = spriteKey(bulb, intensity);
  let entry = spriteCache.get(bulb.id);
  if (!entry || entry.key !== key) {
    entry = { key, sprite: createBulbSprite(bg, bulb, intensity, true) };
    spriteCache.set(bulb.id, entry);
  }
  return entry.sprite;
}

export function compositeIllumination(
  ctx: CanvasRenderingContext2D,
  bg: ImageSource,
  bulbs: Bulb[],
  opts: IlluminationRenderOpts
): void {
  if (bg !== lastBg) {
    invalidateSpriteCache();
    lastBg = bg;
  }

  const visible = bulbs.filter(b => (opts.litFilter ? opts.litFilter.has(b.id) : true));

  if (!opts.useIntensity && !opts.litFilter) {
    const key = visible
      .filter(b => !b.isImageSnippet)
      .map(b => spriteKey(b, C_OVERLAYS))
      .join('#');
    if (!wholeLayerCache || wholeLayerCache.key !== key) {
      wholeLayerCache = { key, layer: createWholeLightLayer(bg, visible) };
    }
    if (wholeLayerCache.layer) ctx.drawImage(wholeLayerCache.layer, 0, 0);
    for (const bulb of visible) {
      if (bulb.isImageSnippet && bulb.imageData) {
        const cached = bulbImageCache.get(bulb.id);
        if (cached) ctx.drawImage(cached, bulb.locX, bulb.locY, bulb.width, bulb.height);
      }
    }
    return;
  }

  const sorted = [...visible].sort((a, b) => a.zOrder - b.zOrder);
  for (const bulb of sorted) {
    if (bulb.isImageSnippet) {
      if (bulb.imageData) {
        const cached = bulbImageCache.get(bulb.id);
        if (cached) ctx.drawImage(cached, bulb.locX, bulb.locY, bulb.width, bulb.height);
      }
      continue;
    }
    const intensity = opts.useIntensity ? bulb.intensity : C_OVERLAYS;
    const sprite = getCachedBulbSprite(bg, bulb, intensity);
    if (sprite) {
      const rectX = clipRectToImage(bulbRect(bulb), bg.width, bg.height);
      ctx.drawImage(sprite, rectX.x, rectX.y);
    }
  }
}
