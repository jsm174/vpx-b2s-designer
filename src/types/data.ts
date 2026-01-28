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

  animations: Animation[];
  scores: ScoreInfo[];
  illumination: Bulb[];
  images: ImageCollection;
  reels: ReelCollection;
}

export type TableType = 'EM' | 'SS' | 'SSDMD' | 'ORI';
export type DMDType = 'None' | 'BuiltIn' | 'External';
export type CommType = 'ROM' | 'B2S';
export type DestType = 'Authentic' | 'Fantasy';
export type RomIdType = 'Lamp' | 'Solenoid' | 'GIString';
export type B2SIdType = 'Cyclic' | 'Straight';
export type RotatingDirection = 'None' | 'Clockwise' | 'CounterClockwise';
export type InitialState = 'Off' | 'On' | 'Undefined';
export type DualMode = 'Both' | 'Authentic' | 'Fantasy';
export type IlluminationMode = 'Standard' | 'Flasher';
export type LightState = 'Off' | 'On' | 'NoChange' | 'Reset';
export type StopBehaviour = 'Immediate' | 'RunTillEnd' | 'ReturnToFirstStep';
export type ReelType =
  | 'Dream7LED8'
  | 'Dream7LED10'
  | 'Dream7LED14'
  | 'Dream7LED16'
  | 'RenderedLED8'
  | 'RenderedLED10'
  | 'RenderedLED14'
  | 'RenderedLED16'
  | 'EMR_T1_0'
  | 'EMR_T2_0'
  | 'EMR_T3_0'
  | 'EMR_T4_0'
  | 'EMR_T5_0'
  | 'EMR_T6_0'
  | 'EMR_CT1_00'
  | 'EMR_CT2_00'
  | 'EMR_CT3_00';

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
  b2sIdType: B2SIdType;
  lightColor: Color;
  dodgeColor?: Color;
  locX: number;
  locY: number;
  width: number;
  height: number;
  intensity: number;
  isImageSnippet: boolean;
  imageData: string;
  snippetRotatingDirection: RotatingDirection;
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
  startAnimationAtRomStart: boolean;
  lightAtStart: LightState;
  lightAtEnd: LightState;
  animationStopBehaviour: StopBehaviour;
  lockAtLastStep: boolean;
  hideAtStart: boolean;
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
  reelLitColor?: Color;
  reelDarkColor?: Color;
  glow: number;
  thickness: number;
  shear: number;
  displayState: number;
  b2sStartDigit: number;
  b2sScoreType: number;
  b2sPlayerNo: number;
  visible: boolean;
}

export interface ImageCollection {
  backgroundImages: BackgroundImage[];
  illuminatedImages: IlluminatedImage[];
  dmdImages: DMDImage[];
  thumbnailImage?: string;
}

export interface BackgroundImage {
  fileName: string;
  romId: number;
  romIdType: RomIdType;
  type: string;
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
  countOfIntermediates: number;
  rollingDirection: 'Up' | 'Down';
  rollingInterval: number;
  images: ReelImage[];
  illuminatedImages: Map<number, ReelImage[]>;
}

export interface ReelImage {
  name: string;
  countOfIntermediates: number;
  imageData: string;
}

export function createEmptyDirectB2S(): DirectB2SData {
  return {
    version: '1.27',
    name: '',
    tableType: 'SS',
    dmdType: 'None',
    dmdDefaultLocationX: 0,
    dmdDefaultLocationY: 0,
    dmdCopyAreaX: 0,
    dmdCopyAreaY: 0,
    dmdCopyAreaWidth: 0,
    dmdCopyAreaHeight: 0,
    commType: 'ROM',
    destType: 'Authentic',
    projectGUID: crypto.randomUUID(),
    assemblyGUID: crypto.randomUUID(),
    vsName: '',
    dualBackglass: false,
    author: '',
    artwork: '',
    gameName: '',
    addEMDefaults: false,
    grillHeight: 0,
    smallGrillHeight: 0,
    numberOfPlayers: 4,
    animations: [],
    scores: [],
    illumination: [],
    images: {
      backgroundImages: [],
      illuminatedImages: [],
      dmdImages: [],
    },
    reels: {
      countOfIntermediates: 10,
      rollingDirection: 'Up',
      rollingInterval: 30,
      images: [],
      illuminatedImages: new Map(),
    },
  };
}

export function createDefaultBulb(id: number): Bulb {
  return {
    id,
    name: `Bulb${id}`,
    parent: 'Backglass',
    romId: 0,
    romIdType: 'Lamp',
    romInverted: false,
    b2sId: 0,
    b2sIdType: 'Straight',
    lightColor: { r: 255, g: 255, b: 0, a: 255 },
    locX: 100,
    locY: 100,
    width: 50,
    height: 50,
    intensity: 3,
    isImageSnippet: false,
    imageData: '',
    snippetRotatingDirection: 'None',
    text: '',
    textAlignment: 0,
    fontName: 'Arial',
    fontSize: 12,
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
    reelType: 'Dream7LED8',
    digits: 7,
    spacing: 5,
    locX: 100,
    locY: 100,
    width: 200,
    height: 50,
    reelColor: { r: 255, g: 120, b: 0, a: 255 },
    reelDarkColor: { r: 15, g: 15, b: 15, a: 255 },
    glow: 1500,
    thickness: 2000,
    shear: 10,
    displayState: 0,
    b2sStartDigit: 0,
    b2sScoreType: 1,
    b2sPlayerNo: 1,
    visible: true,
  };
}
