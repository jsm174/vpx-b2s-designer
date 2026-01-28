import {
  REEL_INFO,
  CREDIT_REEL_INFO,
  LED_INFO,
  REEL_TYPES,
  resourcePathForReelImage,
  type ReelType,
  type CreditReelType,
  type LEDType,
} from './index';

export interface LoadedReelResource {
  image: HTMLImageElement;
  base64: string;
}

const resourceCache: Map<string, LoadedReelResource> = new Map();
const loadingPromises: Map<string, Promise<LoadedReelResource | null>> = new Map();
const setLoadingPromises: Map<string, Promise<void>> = new Map();

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

export async function loadReelResource(name: string): Promise<LoadedReelResource | null> {
  const cached = resourceCache.get(name);
  if (cached) return cached;
  const pending = loadingPromises.get(name);
  if (pending) return pending;

  const path = resourcePathForReelImage(name);
  if (!path) return null;

  const promise = (async () => {
    try {
      const response = await fetch(path);
      if (!response.ok) return null;
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const base64 = bytesToBase64(bytes);
      const blob = new Blob([buffer]);
      const url = URL.createObjectURL(blob);
      try {
        const image = await loadImageElement(url);
        const res = { image, base64 };
        resourceCache.set(name, res);
        return res;
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch {
      return null;
    } finally {
      loadingPromises.delete(name);
    }
  })();
  loadingPromises.set(name, promise);
  return promise;
}

export function getReelResourceSync(name: string): LoadedReelResource | null {
  return resourceCache.get(name) ?? null;
}

export async function loadReelImage(reelType: string, digit: number | 'Empty'): Promise<HTMLImageElement> {
  const res = await loadReelResource(`${reelType}_${digit}`);
  if (!res) throw new Error(`Unknown reel image: ${reelType}_${digit}`);
  return res.image;
}

export async function loadCreditReelImage(reelType: string, value: number): Promise<HTMLImageElement> {
  const res = await loadReelResource(`${reelType}_${value.toString().padStart(2, '0')}`);
  if (!res) throw new Error(`Unknown credit reel image: ${reelType}_${value}`);
  return res.image;
}

export async function loadLEDImage(ledType: string, digit: number | 'Empty'): Promise<HTMLImageElement> {
  const res = await loadReelResource(`${ledType}_${digit}`);
  if (!res) throw new Error(`Unknown LED image: ${ledType}_${digit}`);
  return res.image;
}

async function preloadSet(key: string, names: string[]): Promise<void> {
  const pending = setLoadingPromises.get(key);
  if (pending) return pending;
  const promise = (async () => {
    await Promise.all(names.map(n => loadReelResource(n)));
    setLoadingPromises.delete(key);
  })();
  setLoadingPromises.set(key, promise);
  return promise;
}

export async function preloadReelType(reelType: string): Promise<void> {
  const info = REEL_INFO[reelType as ReelType];
  if (!info) return;
  const names: string[] = [];
  for (let i = 0; i < info.digits; i++) names.push(`${reelType}_${i}`);
  if (info.hasEmpty) names.push(`${reelType}_Empty`);
  return preloadSet(reelType, names);
}

export async function preloadCreditReelType(reelType: string): Promise<void> {
  const info = CREDIT_REEL_INFO[reelType as CreditReelType];
  if (!info) return;
  const names: string[] = [];
  for (let i = 0; i <= info.maxValue; i++) names.push(`${reelType}_${i.toString().padStart(2, '0')}`);
  return preloadSet(`credit_${reelType}`, names);
}

export async function preloadLEDType(ledType: string): Promise<void> {
  const info = LED_INFO[ledType as LEDType];
  if (!info) return;
  const names: string[] = [];
  for (let i = 0; i < info.digits; i++) names.push(`${ledType}_${i}`);
  if (info.hasEmpty) names.push(`${ledType}_Empty`);
  return preloadSet(`led_${ledType}`, names);
}

export async function preloadAllReels(): Promise<void> {
  await Promise.all(REEL_TYPES.map(type => preloadReelType(type)));
}

export function getReelImageSync(reelType: string, digit: number | 'Empty'): HTMLImageElement | null {
  return resourceCache.get(`${reelType}_${digit}`)?.image ?? null;
}

export function getLEDImageSync(ledType: string, digit: number | 'Empty'): HTMLImageElement | null {
  return resourceCache.get(`${ledType}_${digit}`)?.image ?? null;
}

export function getCreditReelImageSync(reelType: string, value: number): HTMLImageElement | null {
  return resourceCache.get(`${reelType}_${value.toString().padStart(2, '0')}`)?.image ?? null;
}

export function isReelTypeLoaded(reelType: string): boolean {
  const info = REEL_INFO[reelType as ReelType];
  if (!info) return false;
  for (let i = 0; i < info.digits; i++) {
    if (!resourceCache.has(`${reelType}_${i}`)) return false;
  }
  return true;
}

export function isCreditReelTypeLoaded(reelType: string): boolean {
  const info = CREDIT_REEL_INFO[reelType as CreditReelType];
  if (!info) return false;
  for (let i = 0; i <= info.maxValue; i++) {
    if (!resourceCache.has(`${reelType}_${i.toString().padStart(2, '0')}`)) return false;
  }
  return true;
}

export function isLEDTypeLoaded(ledType: string): boolean {
  const info = LED_INFO[ledType as LEDType];
  if (!info) return false;
  for (let i = 0; i < info.digits; i++) {
    if (!resourceCache.has(`${ledType}_${i}`)) return false;
  }
  return true;
}
