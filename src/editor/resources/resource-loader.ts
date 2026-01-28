import { REEL_INFO, CREDIT_REEL_INFO, REEL_TYPES, type ReelType, type CreditReelType } from './index';

const reelImageCache: Map<string, HTMLImageElement> = new Map();
const ledImageCache: Map<string, HTMLImageElement> = new Map();
const loadingPromises: Map<string, Promise<HTMLImageElement>> = new Map();
const reelTypeLoadingPromises: Map<string, Promise<void>> = new Map();

function getBasePath(): string {
  if (typeof window !== 'undefined' && (window as unknown as { __ELECTRON__?: boolean }).__ELECTRON__) {
    return '';
  }
  return '';
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

export async function loadReelImage(reelType: string, digit: number | 'Empty'): Promise<HTMLImageElement> {
  const info = REEL_INFO[reelType as ReelType];
  if (!info) {
    throw new Error(`Unknown reel type: ${reelType}`);
  }

  const digitStr = digit === 'Empty' ? 'Empty' : digit.toString();
  const cacheKey = `${reelType}_${digitStr}`;

  if (reelImageCache.has(cacheKey)) {
    return reelImageCache.get(cacheKey)!;
  }

  if (loadingPromises.has(cacheKey)) {
    return loadingPromises.get(cacheKey)!;
  }

  const basePath = getBasePath();
  const src = `${basePath}reels/${reelType}_${digitStr}.${info.extension}`;

  const promise = loadImage(src).then(img => {
    reelImageCache.set(cacheKey, img);
    loadingPromises.delete(cacheKey);
    return img;
  });

  loadingPromises.set(cacheKey, promise);
  return promise;
}

export async function loadCreditReelImage(reelType: string, value: number): Promise<HTMLImageElement> {
  const info = CREDIT_REEL_INFO[reelType as CreditReelType];
  if (!info) {
    throw new Error(`Unknown credit reel type: ${reelType}`);
  }

  const valueStr = value.toString().padStart(2, '0');
  const cacheKey = `${reelType}_${valueStr}`;

  if (reelImageCache.has(cacheKey)) {
    return reelImageCache.get(cacheKey)!;
  }

  if (loadingPromises.has(cacheKey)) {
    return loadingPromises.get(cacheKey)!;
  }

  const basePath = getBasePath();
  const src = `${basePath}reels/${reelType}_${valueStr}.${info.extension}`;

  const promise = loadImage(src).then(img => {
    reelImageCache.set(cacheKey, img);
    loadingPromises.delete(cacheKey);
    return img;
  });

  loadingPromises.set(cacheKey, promise);
  return promise;
}

export async function loadLEDImage(digit: number | 'Empty'): Promise<HTMLImageElement> {
  const digitStr = digit === 'Empty' ? 'Empty' : digit.toString();
  const cacheKey = `LED_${digitStr}`;

  if (ledImageCache.has(cacheKey)) {
    return ledImageCache.get(cacheKey)!;
  }

  if (loadingPromises.has(cacheKey)) {
    return loadingPromises.get(cacheKey)!;
  }

  const basePath = getBasePath();
  const src = `${basePath}images/leds/LED_${digitStr}.png`;

  const promise = loadImage(src).then(img => {
    ledImageCache.set(cacheKey, img);
    loadingPromises.delete(cacheKey);
    return img;
  });

  loadingPromises.set(cacheKey, promise);
  return promise;
}

export async function preloadReelType(reelType: string): Promise<void> {
  const info = REEL_INFO[reelType as ReelType];
  if (!info) return;

  if (reelTypeLoadingPromises.has(reelType)) {
    return reelTypeLoadingPromises.get(reelType)!;
  }

  const promise = (async () => {
    const promises: Promise<HTMLImageElement>[] = [];

    for (let i = 0; i < info.digits; i++) {
      promises.push(loadReelImage(reelType, i));
    }

    if (info.hasEmpty) {
      promises.push(loadReelImage(reelType, 'Empty'));
    }

    await Promise.all(promises);
    reelTypeLoadingPromises.delete(reelType);
  })();

  reelTypeLoadingPromises.set(reelType, promise);
  return promise;
}

export async function preloadAllReels(): Promise<void> {
  await Promise.all(REEL_TYPES.map(type => preloadReelType(type)));
}

export function getReelImageSync(reelType: string, digit: number | 'Empty'): HTMLImageElement | null {
  const digitStr = digit === 'Empty' ? 'Empty' : digit.toString();
  const cacheKey = `${reelType}_${digitStr}`;
  return reelImageCache.get(cacheKey) ?? null;
}

export function getLEDImageSync(digit: number | 'Empty'): HTMLImageElement | null {
  const digitStr = digit === 'Empty' ? 'Empty' : digit.toString();
  const cacheKey = `LED_${digitStr}`;
  return ledImageCache.get(cacheKey) ?? null;
}

export function isReelTypeLoaded(reelType: string): boolean {
  const info = REEL_INFO[reelType as ReelType];
  if (!info) return false;

  for (let i = 0; i < info.digits; i++) {
    if (!reelImageCache.has(`${reelType}_${i}`)) {
      return false;
    }
  }
  return true;
}

export async function preloadCreditReelType(reelType: string): Promise<void> {
  const info = CREDIT_REEL_INFO[reelType as CreditReelType];
  if (!info) return;

  const cacheKey = `credit_${reelType}`;
  if (reelTypeLoadingPromises.has(cacheKey)) {
    return reelTypeLoadingPromises.get(cacheKey)!;
  }

  const promise = (async () => {
    const promises: Promise<HTMLImageElement>[] = [];
    for (let i = 0; i <= info.maxValue; i++) {
      promises.push(loadCreditReelImage(reelType, i));
    }
    await Promise.all(promises);
    reelTypeLoadingPromises.delete(cacheKey);
  })();

  reelTypeLoadingPromises.set(cacheKey, promise);
  return promise;
}

export function getCreditReelImageSync(reelType: string, value: number): HTMLImageElement | null {
  const valueStr = value.toString().padStart(2, '0');
  const cacheKey = `${reelType}_${valueStr}`;
  return reelImageCache.get(cacheKey) ?? null;
}

export function isCreditReelTypeLoaded(reelType: string): boolean {
  const info = CREDIT_REEL_INFO[reelType as CreditReelType];
  if (!info) return false;

  for (let i = 0; i <= info.maxValue; i++) {
    const valueStr = i.toString().padStart(2, '0');
    if (!reelImageCache.has(`${reelType}_${valueStr}`)) {
      return false;
    }
  }
  return true;
}
