import type { DirectB2SData, ScoreInfo } from '../types/data';
import { B2S_SCORE_TYPE } from '../types/data';
import { isOverlappingB2SStartDigit, renumberB2SStartDigits, MSG_CHECK_B2S_START_DIGIT2 } from './export-checks';

export interface ScoreRuleDialogs {
  askYesNo(message: string): Promise<boolean>;
}

export async function applyScoreTypeRules(
  data: DirectB2SData,
  score: ScoreInfo,
  prop: string,
  dialogs: ScoreRuleDialogs
): Promise<boolean> {
  let changed = false;
  if (prop === 'b2sPlayerNo') {
    if (score.b2sPlayerNo > 0) {
      score.b2sScoreType = B2S_SCORE_TYPE.Scores;
      changed = true;
    }
    prop = 'b2sScoreType';
  }
  if (prop === 'b2sScoreType') {
    switch (score.b2sScoreType) {
      case B2S_SCORE_TYPE.Scores:
        if (isOverlappingB2SStartDigit(data.scores)) {
          renumberB2SStartDigits(data);
          changed = true;
        }
        break;
      case B2S_SCORE_TYPE.Credits:
        score.b2sPlayerNo = 0;
        score.b2sStartDigit = 29;
        changed = true;
        break;
      default:
        score.b2sPlayerNo = 0;
        changed = true;
        break;
    }
    return changed;
  }
  if (prop === 'b2sStartDigit') {
    if (isOverlappingB2SStartDigit(data.scores)) {
      const yes = await dialogs.askYesNo(MSG_CHECK_B2S_START_DIGIT2);
      if (yes) {
        renumberB2SStartDigits(data);
        changed = true;
      }
    }
  }
  return changed;
}
