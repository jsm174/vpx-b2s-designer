export const REEL_TYPES = ['EMR_T1', 'EMR_T2', 'EMR_T3', 'EMR_T4', 'EMR_T5', 'EMR_T6'] as const;
export const CREDIT_REEL_TYPES = ['EMR_CT1', 'EMR_CT2', 'EMR_CT3'] as const;
export const LED_TYPES = ['LED'] as const;

export type ReelType = (typeof REEL_TYPES)[number];
export type CreditReelType = (typeof CREDIT_REEL_TYPES)[number];
export type LEDType = (typeof LED_TYPES)[number];

export const REEL_INFO: Record<ReelType, { digits: number; hasEmpty: boolean; extension: string }> = {
  EMR_T1: { digits: 10, hasEmpty: true, extension: 'jpg' },
  EMR_T2: { digits: 10, hasEmpty: true, extension: 'jpg' },
  EMR_T3: { digits: 10, hasEmpty: true, extension: 'jpg' },
  EMR_T4: { digits: 10, hasEmpty: true, extension: 'png' },
  EMR_T5: { digits: 10, hasEmpty: false, extension: 'png' },
  EMR_T6: { digits: 10, hasEmpty: false, extension: 'png' },
};

export const CREDIT_REEL_INFO: Record<CreditReelType, { maxValue: number; extension: string }> = {
  EMR_CT1: { maxValue: 15, extension: 'jpg' },
  EMR_CT2: { maxValue: 16, extension: 'jpg' },
  EMR_CT3: { maxValue: 25, extension: 'png' },
};

export {
  loadReelImage,
  loadCreditReelImage,
  loadLEDImage,
  preloadReelType,
  preloadCreditReelType,
  preloadAllReels,
  getReelImageSync,
  getCreditReelImageSync,
  getLEDImageSync,
  isReelTypeLoaded,
  isCreditReelTypeLoaded,
} from './resource-loader';
