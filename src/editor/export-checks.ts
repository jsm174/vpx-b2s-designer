import type { DirectB2SData, ScoreInfo } from '../types/data';
import { B2S_SCORE_TYPE } from '../types/data';

export const MSG_CHECK_B2S_START_DIGIT =
  "Please check the 'B2S start digit' of the reel and/or LED score displays. There are overlapping digits.\n\nBackglass can not be created right now.";
export const MSG_CHECK_B2S_START_DIGIT2 =
  "Please check the 'B2S start digit' of the reel and/or LED score displays. There are overlapping digits.\n\nDo you want to renumber all 'B2S start digit' right now?";
export const MSG_CHECK_B2S_SCORE_TYPES =
  "You have added score displays without reel or LED type. Please set this type.\n\nMaybe open menu item 'Reels & LEDs' -> 'Choose reel or LED types ...' first of all and select reel or LED types.";
export const MSG_CHECK_NO_GRILL_HEIGHT =
  "You haven't set the grill height. Do you still want to continue creating the backglass file?";

export function isOverlappingB2SStartDigit(scores: ScoreInfo[]): boolean {
  const used = new Set<number>();
  for (const score of scores) {
    if (score.b2sStartDigit > 0) {
      for (let i = 0; i < score.digits; i++) {
        const d = score.b2sStartDigit + i;
        if (used.has(d)) return true;
        used.add(d);
      }
    }
  }
  return false;
}

export function renumberB2SStartDigits(data: DirectB2SData): void {
  let startAt = 1;
  const all = [...data.scores.filter(s => s.parent !== 'DMD'), ...data.scores.filter(s => s.parent === 'DMD')];
  const withPlayer = all
    .filter(s => s.b2sScoreType !== B2S_SCORE_TYPE.Credits && s.b2sPlayerNo > 0)
    .sort((a, b) => a.b2sPlayerNo - b.b2sPlayerNo || a.id - b.id);
  const rest = all
    .filter(s => s.b2sScoreType !== B2S_SCORE_TYPE.Credits && s.b2sPlayerNo <= 0)
    .sort((a, b) => a.id - b.id);
  for (const score of [...withPlayer, ...rest]) {
    score.b2sStartDigit = startAt;
    startAt += score.digits;
  }
}

export interface ExportCheckDialogs {
  showError(message: string): Promise<void>;
  askYesNo(message: string): Promise<boolean>;
}

export async function checkDataBeforeExport(data: DirectB2SData, dialogs: ExportCheckDialogs): Promise<boolean> {
  if (isOverlappingB2SStartDigit(data.scores)) {
    await dialogs.showError(MSG_CHECK_B2S_START_DIGIT);
    return false;
  }
  for (const score of data.scores) {
    if (!score.reelType) {
      await dialogs.showError(MSG_CHECK_B2S_SCORE_TYPES);
      return false;
    }
  }
  if (data.dmdType === 'B2SAlwaysOnSecondMonitor' || data.dmdType === 'B2SOnSecondOrThirdMonitor') {
    if (data.grillHeight <= 0) {
      const ok = await dialogs.askYesNo(MSG_CHECK_NO_GRILL_HEIGHT);
      if (!ok) return false;
    }
  }
  return true;
}
