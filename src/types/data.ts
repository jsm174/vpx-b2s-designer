export const DIRECTB2S_VERSION = '1.27';

export interface DirectB2SData {
  version: string;
  name: string;
  tableType: TableType;
  dmdType: DMDType;
  dmdDefaultLocationX: number;
  dmdDefaultLocationY: number;
  dmdCopyAreaX: number;
  dmdCopyAreaY: number;
  dmdCopyAreaWidth: number;
  dmdCopyAreaHeight: number;
  commType: CommType;
  destType: DestType;
  projectGUID: string;
  projectGUID2: string;
  assemblyGUID: string;
  vsName: string;
  dualBackglass: boolean;
  author: string;
  artwork: string;
  gameName: string;
  addEMDefaults: boolean;
  grillHeight: number;
  smallGrillHeight: number;
  numberOfPlayers: number;
  b2sDataCount: number;

  reelTypes: string[];
  useDream7LEDs: boolean;
  d7Glow: number;
  d7Thickness: number;
  d7Shear: number;
  reelColor: Color | null;
  reelRollingDirection: ReelRollingDirection;
  reelRollingInterval: number;
  reelIntermediateImageCount: number;

  animations: Animation[];
  scores: ScoreInfo[];
  illumination: Bulb[];
  images: ImageCollection;
  reels: ReelCollection;
}

export type TableType = 'NotDefined' | 'EM' | 'SS' | 'SSDMD' | 'ORI';
export type DMDType =
  | 'NotDefined'
  | 'NoB2SDMD'
  | 'B2SAlwaysOnSecondMonitor'
  | 'B2SAlwaysOnThirdMonitor'
  | 'B2SOnSecondOrThirdMonitor';
export type CommType = 'NotDefined' | 'ROM' | 'B2S';
export type DestType = 'NotDefined' | 'DirectB2S' | 'VisualStudio2010';
export type RomIdType = 'NotUsed' | 'Lamp' | 'Solenoid' | 'GIString';
export type RotatingDirection = 'Clockwise' | 'AntiClockwise';
export type SnippetType = 'StandardImage' | 'SelfRotatingImage' | 'MechRotatingImage';
export type SnippetStopBehaviour = 'SpinOff' | 'StopImmediately' | 'RunAnimationTillEnd' | 'RunAnimationToFirstStep';
export type ReelIlluLocation = 'Off' | 'Above' | 'Below' | 'AboveAndBelow';
export type InitialState = 'Off' | 'On' | 'AlwaysOn';
export type DualMode = 'Both' | 'Authentic' | 'Fantasy';
export type IlluminationMode = 'Standard' | 'Flasher';
export type ReelRollingDirection = 'Up' | 'Down';

export const LIGHTS_STATE_AT_START = {
  Undefined: 0,
  InvolvedLightsOff: 1,
  InvolvedLightsOn: 2,
  LightsOff: 3,
  NoChange: 4,
} as const;

export const LIGHTS_STATE_AT_END = {
  Undefined: 0,
  InvolvedLightsOff: 1,
  InvolvedLightsOn: 2,
  LightsReseted: 3,
  NoChange: 4,
} as const;

export const ANIMATION_STOP_BEHAVIOUR = {
  Undefined: 0,
  StopImmediately: 1,
  RunAnimationTillEnd: 2,
  RunAnimationToFirstStep: 3,
} as const;

export const B2S_ID_TYPES: { value: number; label: string; id: number }[] = [
  { value: 0, label: '(not used)', id: 0 },
  { value: 1, label: 'Score 1 Rollover', id: 25 },
  { value: 2, label: 'Score 2 Rollover', id: 26 },
  { value: 3, label: 'Score 3 Rollover', id: 27 },
  { value: 4, label: 'Score 4 Rollover', id: 28 },
  { value: 5, label: 'Player Up', id: 30 },
  { value: 6, label: 'Can Play', id: 31 },
  { value: 7, label: 'Ball In Play', id: 32 },
  { value: 8, label: 'Tilt', id: 33 },
  { value: 9, label: 'Match', id: 34 },
  { value: 10, label: 'Game Over', id: 35 },
  { value: 11, label: 'Shoot Again', id: 36 },
];

export const B2S_SCORE_TYPE = { NotUsed: 0, Scores: 1, Credits: 2 } as const;

export const DEFAULT_EM_REELS = ['EMR_T1_0', 'EMR_T2_0', 'EMR_T3_0', 'EMR_T4_0', 'EMR_T5_0', 'EMR_T6_0'];
export const DEFAULT_EM_CREDIT_REELS = ['EMR_CT1_00', 'EMR_CT2_00', 'EMR_CT3_00'];
export const DEFAULT_LEDS = ['LED_0', 'LED_Blue_0'];
export const RENDERED_LEDS = ['RenderedLED8', 'RenderedLED10', 'RenderedLED14'];
export const IMPORTED_START_STRING = 'Imported';

export const DEFAULT_LIGHT_COLOR: Color = { r: 255, g: 254, b: 232, a: 255 };
export const DEFAULT_REEL_COLOR: Color = { r: 255, g: 69, b: 0, a: 255 };
export const MAX_BULB_INTENSITY = 5;

export interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface Bulb {
  id: number;
  name: string;
  parent: 'Backglass' | 'DMD';
  romId: number;
  romIdType: RomIdType;
  romInverted: boolean;
  b2sId: number;
  b2sIdType: number;
  b2sValue: number;
  lightColor: Color;
  dodgeColor?: Color;
  locX: number;
  locY: number;
  width: number;
  height: number;
  intensity: number;
  isImageSnippet: boolean;
  imageData: string;
  offImageData?: string;
  snippetType: SnippetType;
  snippetMechID: number;
  snippetRotatingSteps: number;
  snippetRotatingInterval: number;
  snippetRotatingDirection: RotatingDirection;
  snippetRotatingStopBehaviour: SnippetStopBehaviour;
  text: string;
  textAlignment: number;
  fontName: string;
  fontSize: number;
  fontStyle: number;
  visible: boolean;
  initialState: InitialState;
  dualMode: DualMode;
  illuminationMode: IlluminationMode;
  zOrder: number;
}

export interface Animation {
  name: string;
  dualMode: DualMode;
  interval: number;
  loops: number;
  idJoin: string;
  startAnimationAtBackglassStartup: boolean;
  lightsStateAtAnimationStart: number;
  lightsStateAtAnimationEnd: number;
  animationStopBehaviour: number;
  lockInvolvedLamps: boolean;
  hideScoreDisplays: boolean;
  bringToFront: boolean;
  randomStart: boolean;
  randomQuality: number;
  steps: AnimationStep[];
}

export interface AnimationStep {
  step: number;
  on: string;
  off: string;
  waitLoopsAfterOn: number;
  waitLoopsAfterOff: number;
  pulseSwitch: number;
}

export interface ScoreInfo {
  id: number;
  parent: 'Backglass' | 'DMD';
  reelType: string;
  digits: number;
  spacing: number;
  locX: number;
  locY: number;
  width: number;
  height: number;
  reelColor: Color;
  displayState: number;
  b2sStartDigit: number;
  b2sScoreType: number;
  b2sPlayerNo: number;

  reelIlluLocation: ReelIlluLocation;
  reelIlluIntensity: number;
  reelIlluB2SID: number;
  reelIlluB2SIDType: number;
  reelIlluB2SValue: number;
}

export interface ImageCollection {
  backgroundImages: BackgroundImage[];
  illuminatedImages: IlluminatedImage[];
  dmdImages: DMDImage[];
  thumbnailImage?: string;
}

export type BackgroundImageType = 'Main' | 'On' | 'Off';

export interface BackgroundImage {
  fileName: string;
  romId: number;
  romIdType: RomIdType;
  type: BackgroundImageType;
  imageData: string;
}

export interface IlluminatedImage {
  fileName: string;
  imageData: string;
}

export interface DMDImage {
  fileName: string;
  imageData: string;
}

export interface ReelCollection {
  images: ReelImage[];
  illuminatedSets: ReelIlluminatedSet[];
}

export interface ReelImage {
  name: string;
  countOfIntermediates: number;
  imageData: string;
  intermediates: string[];
}

export interface ReelIlluminatedSet {
  id: number;
  images: ReelImage[];
}

export function getMainBackgroundImage(images: ImageCollection): BackgroundImage | undefined {
  return images.backgroundImages.find(i => i.type !== 'Off');
}

export function getOffBackgroundImage(images: ImageCollection): BackgroundImage | undefined {
  return images.backgroundImages.find(i => i.type === 'Off');
}

export function newGuid(): string {
  return crypto.randomUUID().toUpperCase();
}

export function isReelImageRendered(reelType: string): boolean {
  return reelType.toLowerCase().startsWith('renderedled');
}

export function isReelImageDream7(reelType: string): boolean {
  return reelType.toLowerCase().startsWith('dream7');
}

export function isReelTypeRenderedOrDream7(reelType: string): boolean {
  return isReelImageRendered(reelType) || isReelImageDream7(reelType);
}

export function getRenderedLEDName(reel: string): string {
  const r = reel.replace('RenderedLED0', 'RenderedLED').replace('Dream7LED0', 'Dream7LED');
  if (r.toLowerCase().startsWith('renderedled')) return r;
  if (r.toLowerCase().startsWith('dream7led')) return 'RenderedLED' + r.substring(9);
  return '';
}

export function getReelBaseName(reelType: string): string {
  if (reelType.length < 3) return reelType;
  const length = reelType.charAt(reelType.length - 3) === '_' ? 3 : 2;
  return reelType.substring(0, reelType.length - length);
}

export function reelTypesToString(reelTypes: string[]): string {
  const list = reelTypes.filter(t => t.length > 0);
  return list.length === 0 ? '' : ',' + list.join(',') + ',';
}

export function parseReelTypes(value: string): string[] {
  return value
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

export function createEmptyDirectB2S(): DirectB2SData {
  return {
    version: DIRECTB2S_VERSION,
    name: '',
    tableType: 'NotDefined',
    dmdType: 'NotDefined',
    dmdDefaultLocationX: 0,
    dmdDefaultLocationY: 0,
    dmdCopyAreaX: 0,
    dmdCopyAreaY: 0,
    dmdCopyAreaWidth: 0,
    dmdCopyAreaHeight: 0,
    commType: 'NotDefined',
    destType: 'DirectB2S',
    projectGUID: newGuid(),
    projectGUID2: newGuid(),
    assemblyGUID: newGuid(),
    vsName: '',
    dualBackglass: false,
    author: '',
    artwork: '',
    gameName: '',
    addEMDefaults: false,
    grillHeight: 0,
    smallGrillHeight: 0,
    numberOfPlayers: 4,
    b2sDataCount: 5,
    reelTypes: [],
    useDream7LEDs: true,
    d7Glow: 0,
    d7Thickness: 0,
    d7Shear: 0,
    reelColor: null,
    reelRollingDirection: 'Up',
    reelRollingInterval: 0,
    reelIntermediateImageCount: 0,
    animations: [],
    scores: [],
    illumination: [],
    images: {
      backgroundImages: [],
      illuminatedImages: [],
      dmdImages: [],
    },
    reels: {
      images: [],
      illuminatedSets: [],
    },
  };
}

export function createDefaultBulb(id: number): Bulb {
  return {
    id,
    name: '',
    parent: 'Backglass',
    romId: 0,
    romIdType: 'NotUsed',
    romInverted: false,
    b2sId: 0,
    b2sIdType: 0,
    b2sValue: 0,
    lightColor: { ...DEFAULT_LIGHT_COLOR },
    locX: 50,
    locY: 50,
    width: 200,
    height: 100,
    intensity: 1,
    isImageSnippet: false,
    imageData: '',
    snippetType: 'StandardImage',
    snippetMechID: 0,
    snippetRotatingSteps: 0,
    snippetRotatingInterval: 0,
    snippetRotatingDirection: 'Clockwise',
    snippetRotatingStopBehaviour: 'SpinOff',
    text: '',
    textAlignment: 0,
    fontName: '',
    fontSize: 10,
    fontStyle: 0,
    visible: true,
    initialState: 'Off',
    dualMode: 'Both',
    illuminationMode: 'Standard',
    zOrder: 0,
  };
}

export function createDefaultScore(id: number): ScoreInfo {
  return {
    id,
    parent: 'Backglass',
    reelType: '',
    digits: 6,
    spacing: 5,
    locX: 100,
    locY: 100,
    width: 300,
    height: 100,
    reelColor: { ...DEFAULT_REEL_COLOR },
    displayState: 0,
    b2sStartDigit: 0,
    b2sScoreType: 0,
    b2sPlayerNo: 0,
    reelIlluLocation: 'Off',
    reelIlluIntensity: 1,
    reelIlluB2SID: 0,
    reelIlluB2SIDType: 0,
    reelIlluB2SValue: 0,
  };
}

export function createDefaultAnimation(name: string): Animation {
  return {
    name,
    dualMode: 'Both',
    interval: 0,
    loops: 0,
    idJoin: '',
    startAnimationAtBackglassStartup: false,
    lightsStateAtAnimationStart: LIGHTS_STATE_AT_START.NoChange,
    lightsStateAtAnimationEnd: LIGHTS_STATE_AT_END.InvolvedLightsOff,
    animationStopBehaviour: ANIMATION_STOP_BEHAVIOUR.StopImmediately,
    lockInvolvedLamps: false,
    hideScoreDisplays: false,
    bringToFront: false,
    randomStart: false,
    randomQuality: 1,
    steps: [],
  };
}
