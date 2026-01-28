export interface MenuState {
  hasFile: boolean;
  hasSelection: boolean;
  hasClipboard: boolean;
  canUndo: boolean;
  canRedo: boolean;
  isDirty: boolean;
  consoleVisible: boolean;
  inDMD: boolean;
  dialogOpen: boolean;
  showScoreFrames: boolean;
  showScoring: boolean;
  showIlluminationFrames: boolean;
  showIllumination: boolean;
  showIlluminationIntensity: boolean;
  isTranslucent: boolean;
  setGrillHeight: boolean;
  setSmallGrillHeight: boolean;
  copyDmdFromBackglass: boolean;
  setDmdDefaultLocation: boolean;
}

export type MenuStateKey = keyof MenuState;

export function createDefaultMenuState(): MenuState {
  return {
    hasFile: false,
    hasSelection: false,
    hasClipboard: false,
    canUndo: false,
    canRedo: false,
    isDirty: false,
    consoleVisible: true,
    inDMD: false,
    dialogOpen: false,
    showScoreFrames: false,
    showScoring: true,
    showIlluminationFrames: false,
    showIllumination: false,
    showIlluminationIntensity: false,
    isTranslucent: false,
    setGrillHeight: false,
    setSmallGrillHeight: false,
    copyDmdFromBackglass: false,
    setDmdDefaultLocation: false,
  };
}

export function getStateValue(state: MenuState, key: MenuStateKey): boolean {
  return state[key];
}
