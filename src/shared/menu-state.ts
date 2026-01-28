export interface MenuState {
  hasFile: boolean;
  hasSelection: boolean;
  hasClipboard: boolean;
  canUndo: boolean;
  canRedo: boolean;
  isDirty: boolean;
  consoleVisible: boolean;
  inDMD: boolean;
  inBackglass: boolean;
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
  hasBackgroundImage: boolean;
  dmdAllowed: boolean;
  canCreateDirectB2S: boolean;
  hasAnimations: boolean;
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
    inBackglass: true,
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
    hasBackgroundImage: false,
    dmdAllowed: true,
    canCreateDirectB2S: true,
    hasAnimations: false,
  };
}

export function getStateValue(state: MenuState, key: MenuStateKey): boolean {
  return state[key];
}
