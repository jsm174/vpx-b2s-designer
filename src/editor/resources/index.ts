export const REEL_TYPES = ['EMR_T1', 'EMR_T2', 'EMR_T3', 'EMR_T4', 'EMR_T5', 'EMR_T6'] as const;
export const CREDIT_REEL_TYPES = ['EMR_CT1', 'EMR_CT2', 'EMR_CT3'] as const;
export const LED_TYPES = ['LED', 'LED_Blue'] as const;

export type ReelType = (typeof REEL_TYPES)[number];
export type CreditReelType = (typeof CREDIT_REEL_TYPES)[number];
export type LEDType = (typeof LED_TYPES)[number];

export const REEL_INFO: Record<ReelType, { digits: number; hasEmpty: boolean; extension: string }> = {
  EMR_T1: { digits: 10, hasEmpty: true, extension: 'jpg' },
  EMR_T2: { digits: 10, hasEmpty: true, extension: 'jpg' },
  EMR_T3: { digits: 10, hasEmpty: true, extension: 'jpg' },
  EMR_T4: { digits: 10, hasEmpty: true, extension: 'png' },
  EMR_T5: { digits: 10, hasEmpty: true, extension: 'png' },
  EMR_T6: { digits: 10, hasEmpty: false, extension: 'png' },
};

export const CREDIT_REEL_INFO: Record<CreditReelType, { maxValue: number; extension: string }> = {
  EMR_CT1: { maxValue: 15, extension: 'jpg' },
  EMR_CT2: { maxValue: 16, extension: 'jpg' },
  EMR_CT3: { maxValue: 25, extension: 'png' },
};

export const LED_INFO: Record<LEDType, { digits: number; hasEmpty: boolean; extension: string }> = {
  LED: { digits: 10, hasEmpty: true, extension: 'png' },
  LED_Blue: { digits: 10, hasEmpty: true, extension: 'png' },
};

export function resourcePathForReelImage(name: string): string | null {
  const m = /^(EMR_T\d|EMR_CT\d|LED_Blue|LED)_(\d{1,2}|Empty)$/.exec(name);
  if (!m) return null;
  const base = m[1];
  const idx = m[2];
  if (base.startsWith('EMR_CT')) {
    const info = CREDIT_REEL_INFO[base as CreditReelType];
    if (!info || idx === 'Empty') return null;
    const n = parseInt(idx, 10);
    if (n > info.maxValue) return null;
    return `reels/${base}_${n.toString().padStart(2, '0')}.${info.extension}`;
  }
  if (base.startsWith('EMR_T')) {
    const info = REEL_INFO[base as ReelType];
    if (!info) return null;
    if (idx === 'Empty') return info.hasEmpty ? `reels/${base}_Empty.${info.extension}` : null;
    const n = parseInt(idx, 10);
    if (n >= info.digits) return null;
    return `reels/${base}_${n}.${info.extension}`;
  }
  const info = LED_INFO[base as LEDType];
  if (!info) return null;
  if (idx === 'Empty') return info.hasEmpty ? `images/leds/${base}_Empty.${info.extension}` : null;
  const n = parseInt(idx, 10);
  if (n >= info.digits) return null;
  return `images/leds/${base}_${n}.${info.extension}`;
}

export function reelTypeDisplayName(reelType: string): string {
  let m = /^(Imported)?EMR_CT(\d+)/.exec(reelType);
  if (m) return `${m[1] ? 'Imported ' : ''}EM credit reel ${m[2]}`;
  m = /^(Imported)?EMR_T(\d+)/.exec(reelType);
  if (m) return `${m[1] ? 'Imported ' : ''}EM reel ${m[2]}`;
  m = /^ImportedLED_T(\d+)/.exec(reelType);
  if (m) return `Imported LED ${m[1]}`;
  if (reelType.startsWith('LED_Blue')) return 'LED 2';
  if (reelType.startsWith('LED')) return 'LED 1';
  if (reelType.startsWith('RenderedLED') || reelType.startsWith('Dream7LED')) {
    return `Rendered LED ${reelType.replace(/^(RenderedLED|Dream7LED)/, '')}`;
  }
  return reelType;
}

export {
  loadReelImage,
  loadCreditReelImage,
  loadLEDImage,
  loadReelResource,
  preloadReelType,
  preloadCreditReelType,
  preloadLEDType,
  preloadAllReels,
  getReelImageSync,
  getCreditReelImageSync,
  getLEDImageSync,
  getReelResourceSync,
  isReelTypeLoaded,
  isCreditReelTypeLoaded,
  isLEDTypeLoaded,
} from './resource-loader';
