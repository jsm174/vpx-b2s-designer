import type {
  DirectB2SData,
  TableType,
  DMDType,
  CommType,
  DestType,
  Bulb,
  Animation,
  AnimationStep,
  ScoreInfo,
  ImageCollection,
  ReelCollection,
  Color,
  RomIdType,
  B2SIdType,
  RotatingDirection,
  InitialState,
  DualMode,
  LightState,
  StopBehaviour,
} from '../types/data';
import { createEmptyDirectB2S } from '../types/data';

export function parseDirectB2S(xmlContent: string): DirectB2SData {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, 'text/xml');

  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error(`XML parsing error: ${parserError.textContent}`);
  }

  const root = doc.querySelector('DirectB2SData');
  if (!root) {
    throw new Error('Invalid directB2S file: missing DirectB2SData root element');
  }

  const data = createEmptyDirectB2S();

  data.version = root.getAttribute('Version') || '1.27';
  data.name = getAttrValue(root, 'Name');
  data.tableType = parseTableType(getAttrValueInt(root, 'TableType'));
  data.dmdType = parseDMDType(getAttrValueInt(root, 'DMDType'));
  const dmdLoc = root.querySelector('DMDDefaultLocation');
  if (dmdLoc) {
    data.dmdDefaultLocationX = parseInt(dmdLoc.getAttribute('LocX') || '0', 10);
    data.dmdDefaultLocationY = parseInt(dmdLoc.getAttribute('LocY') || '0', 10);
  } else {
    data.dmdDefaultLocationX = getAttrValueInt(root, 'DMDDefaultLocationX');
    data.dmdDefaultLocationY = getAttrValueInt(root, 'DMDDefaultLocationY');
  }
  data.dmdCopyAreaX = getAttrValueInt(root, 'DMDCopyAreaX');
  data.dmdCopyAreaY = getAttrValueInt(root, 'DMDCopyAreaY');
  data.dmdCopyAreaWidth = getAttrValueInt(root, 'DMDCopyAreaWidth');
  data.dmdCopyAreaHeight = getAttrValueInt(root, 'DMDCopyAreaHeight');
  data.commType = parseCommType(getAttrValueInt(root, 'CommType'));
  data.destType = parseDestType(getAttrValueInt(root, 'DestType'));
  data.projectGUID = getAttrValue(root, 'ProjectGUID');
  data.assemblyGUID = getAttrValue(root, 'AssemblyGUID');
  data.vsName = getAttrValue(root, 'VSName');
  data.dualBackglass = getAttrValueInt(root, 'DualBackglass') === 1;
  data.author = getAttrValue(root, 'Author');
  data.artwork = getAttrValue(root, 'Artwork');
  data.gameName = getAttrValue(root, 'GameName');
  data.addEMDefaults = getAttrValueInt(root, 'AddEMDefaults') === 1;
  const grillEl = root.querySelector('GrillHeight');
  if (grillEl) {
    data.grillHeight = parseInt(grillEl.getAttribute('Value') || '0', 10);
    data.smallGrillHeight = parseInt(grillEl.getAttribute('Small') || '0', 10);
  }
  data.numberOfPlayers = getAttrValueInt(root, 'NumberOfPlayers') || 4;

  const animationsEl = root.querySelector('Animations');
  if (animationsEl) {
    data.animations = parseAnimations(animationsEl);
  }

  const scoresEl = root.querySelector('Scores');
  if (scoresEl) {
    data.scores = parseScores(scoresEl);
  }

  const illuminationEl = root.querySelector('Illumination');
  if (illuminationEl) {
    data.illumination = parseIllumination(illuminationEl);
  }

  const imagesEl = root.querySelector(':scope > Images');
  if (imagesEl) {
    data.images = parseImages(imagesEl);
  }

  const reelsEl = root.querySelector(':scope > Reels');
  if (reelsEl) {
    data.reels = parseReels(reelsEl);
  }

  return data;
}

function getAttrValue(parent: Element, name: string): string {
  const el = parent.querySelector(name);
  return el?.getAttribute('Value') || '';
}

function getAttrValueInt(parent: Element, name: string): number {
  const val = getAttrValue(parent, name);
  return parseInt(val, 10) || 0;
}

function parseTableType(value: number): TableType {
  switch (value) {
    case 1:
      return 'EM';
    case 2:
      return 'SS';
    case 3:
      return 'SSDMD';
    case 4:
      return 'ORI';
    default:
      return 'SS';
  }
}

function parseDMDType(value: number): DMDType {
  switch (value) {
    case 1:
      return 'BuiltIn';
    case 2:
      return 'External';
    case 3:
      return 'External';
    default:
      return 'None';
  }
}

function parseCommType(value: number): CommType {
  return value === 2 ? 'B2S' : 'ROM';
}

function parseDestType(value: number): DestType {
  return value === 2 ? 'Fantasy' : 'Authentic';
}

function parseColor(colorStr: string): Color {
  if (!colorStr) return { r: 255, g: 255, b: 255, a: 255 };
  const parts = colorStr.split(/[.,]/).map(s => parseInt(s.trim(), 10));
  if (parts.length === 4) {
    return { a: parts[0], r: parts[1], g: parts[2], b: parts[3] };
  } else if (parts.length === 3) {
    return { r: parts[0], g: parts[1], b: parts[2], a: 255 };
  }
  return { r: 255, g: 255, b: 255, a: 255 };
}

function parseAnimations(container: Element): Animation[] {
  const animations: Animation[] = [];
  for (const el of container.querySelectorAll('Animation')) {
    animations.push({
      name: el.getAttribute('Name') || '',
      dualMode: parseDualMode(el.getAttribute('DualMode')),
      interval: parseInt(el.getAttribute('Interval') || '100', 10),
      loops: parseInt(el.getAttribute('Loops') || '0', 10),
      idJoin: el.getAttribute('IDJoin') || '',
      startAnimationAtRomStart: el.getAttribute('StartAnimationAtRomStart') === 'True',
      lightAtStart: parseLightState(el.getAttribute('LightAtStart')),
      lightAtEnd: parseLightState(el.getAttribute('LightAtEnd')),
      animationStopBehaviour: parseStopBehaviour(el.getAttribute('AnimationStopBehaviour')),
      lockAtLastStep: el.getAttribute('LockAtLastStep') === 'True',
      hideAtStart: el.getAttribute('HideAtStart') === 'True',
      bringToFront: el.getAttribute('BringToFront') === 'True',
      randomStart: el.getAttribute('RandomStart') === 'True',
      randomQuality: parseInt(el.getAttribute('RandomQuality') || '0', 10),
      steps: parseAnimationSteps(el),
    });
  }
  return animations;
}

function parseAnimationSteps(animationEl: Element): AnimationStep[] {
  const steps: AnimationStep[] = [];
  for (const el of animationEl.querySelectorAll('AnimationStep')) {
    steps.push({
      step: parseInt(el.getAttribute('Step') || '0', 10),
      on: el.getAttribute('On') || '',
      off: el.getAttribute('Off') || '',
      waitLoopsAfterOn: parseInt(el.getAttribute('WaitLoopsAfterOn') || '0', 10),
      waitLoopsAfterOff: parseInt(el.getAttribute('WaitLoopsAfterOff') || '0', 10),
      pulseSwitch: parseInt(el.getAttribute('PulseSwitch') || '0', 10),
    });
  }
  return steps;
}

function parseDualMode(value: string | null): DualMode {
  switch (value) {
    case '1':
      return 'Authentic';
    case '2':
      return 'Fantasy';
    default:
      return 'Both';
  }
}

function parseLightState(value: string | null): LightState {
  switch (value) {
    case '1':
      return 'On';
    case '2':
      return 'NoChange';
    case '3':
      return 'Reset';
    default:
      return 'Off';
  }
}

function parseStopBehaviour(value: string | null): StopBehaviour {
  switch (value) {
    case '1':
      return 'RunTillEnd';
    case '2':
      return 'ReturnToFirstStep';
    default:
      return 'Immediate';
  }
}

function parseScores(container: Element): ScoreInfo[] {
  const scores: ScoreInfo[] = [];
  for (const el of container.querySelectorAll('Score')) {
    scores.push({
      id: parseInt(el.getAttribute('ID') || '0', 10),
      parent: el.getAttribute('Parent') === 'DMD' ? 'DMD' : 'Backglass',
      reelType: el.getAttribute('ReelType') || 'Dream7LED8',
      digits: parseInt(el.getAttribute('Digits') || '0', 10),
      spacing: parseInt(el.getAttribute('Spacing') || '0', 10),
      locX: parseInt(el.getAttribute('LocX') || '0', 10),
      locY: parseInt(el.getAttribute('LocY') || '0', 10),
      width: parseInt(el.getAttribute('Width') || '0', 10),
      height: parseInt(el.getAttribute('Height') || '0', 10),
      reelColor: parseColor(el.getAttribute('ReelColor') || el.getAttribute('ReelLitColor') || ''),
      reelLitColor: el.getAttribute('ReelLitColor') ? parseColor(el.getAttribute('ReelLitColor')!) : undefined,
      reelDarkColor: el.getAttribute('ReelDarkColor') ? parseColor(el.getAttribute('ReelDarkColor')!) : undefined,
      glow: parseInt(el.getAttribute('Glow') || '0', 10),
      thickness: parseInt(el.getAttribute('Thickness') || '0', 10),
      shear: parseInt(el.getAttribute('Shear') || '0', 10),
      displayState: parseInt(el.getAttribute('DisplayState') || '0', 10),
      b2sStartDigit: parseInt(el.getAttribute('B2SStartDigit') || '0', 10),
      b2sScoreType: parseInt(el.getAttribute('B2SScoreType') || '0', 10),
      b2sPlayerNo: parseInt(el.getAttribute('B2SPlayerNo') || '0', 10),
      visible: el.getAttribute('Visible') !== '0' && el.getAttribute('Visible') !== 'False',
    });
  }
  return scores;
}

function parseBoolean(value: string | null): boolean {
  if (!value) return false;
  return value === '1' || value.toLowerCase() === 'true';
}

function parseIllumination(container: Element): Bulb[] {
  const bulbs: Bulb[] = [];
  for (const el of container.querySelectorAll('Bulb')) {
    const isSnippet = el.getAttribute('IsImageSnippit') || el.getAttribute('IsImageSnippet');
    bulbs.push({
      id: parseInt(el.getAttribute('ID') || '0', 10),
      name: el.getAttribute('Name') || '',
      parent: el.getAttribute('Parent') === 'DMD' ? 'DMD' : 'Backglass',
      romId: parseInt(el.getAttribute('RomID') || '0', 10),
      romIdType: parseRomIdType(el.getAttribute('RomIDType')),
      romInverted: parseBoolean(el.getAttribute('RomInverted')),
      b2sId: parseInt(el.getAttribute('B2SID') || '0', 10),
      b2sIdType: parseB2SIdType(el.getAttribute('B2SIDType')),
      lightColor: parseColor(el.getAttribute('LightColor') || ''),
      dodgeColor: el.getAttribute('DodgeColor') ? parseColor(el.getAttribute('DodgeColor')!) : undefined,
      locX: parseInt(el.getAttribute('LocX') || '0', 10),
      locY: parseInt(el.getAttribute('LocY') || '0', 10),
      width: parseInt(el.getAttribute('Width') || '0', 10),
      height: parseInt(el.getAttribute('Height') || '0', 10),
      intensity: parseInt(el.getAttribute('Intensity') || '1', 10),
      isImageSnippet: parseBoolean(isSnippet),
      imageData: cleanBase64(el.getAttribute('Image')),
      snippetRotatingDirection: parseRotatingDirection(el.getAttribute('SnippetRotatingDirection')),
      text: el.getAttribute('Text') || '',
      textAlignment: parseInt(el.getAttribute('TextAlignment') || '0', 10),
      fontName: el.getAttribute('FontName') || 'Arial',
      fontSize: parseInt(el.getAttribute('FontSize') || '12', 10),
      fontStyle: parseInt(el.getAttribute('FontStyle') || '0', 10),
      visible: el.getAttribute('Visible') !== '0' && el.getAttribute('Visible') !== 'False',
      initialState: parseInitialState(el.getAttribute('InitialState')),
      dualMode: parseDualMode(el.getAttribute('DualMode')),
      illuminationMode: el.getAttribute('IlluminationMode') === '1' ? 'Flasher' : 'Standard',
      zOrder: parseInt(el.getAttribute('ZOrder') || '0', 10),
    });
  }
  return bulbs;
}

function parseRomIdType(value: string | null): RomIdType {
  switch (value) {
    case '2':
      return 'Solenoid';
    case '3':
      return 'GIString';
    default:
      return 'Lamp';
  }
}

function parseB2SIdType(value: string | null): B2SIdType {
  return value === '1' ? 'Cyclic' : 'Straight';
}

function parseRotatingDirection(value: string | null): RotatingDirection {
  switch (value) {
    case '1':
      return 'Clockwise';
    case '2':
      return 'CounterClockwise';
    default:
      return 'None';
  }
}

function parseInitialState(value: string | null): InitialState {
  switch (value) {
    case '1':
      return 'On';
    case '2':
      return 'Undefined';
    default:
      return 'Off';
  }
}

function cleanBase64(value: string | null): string {
  if (!value) return '';
  return value.replace(/[\s\r\n]+/g, '');
}

function parseImages(container: Element): ImageCollection {
  const collection: ImageCollection = {
    backgroundImages: [],
    illuminatedImages: [],
    dmdImages: [],
  };

  const bgImageEl = container.querySelector('BackglassImage');
  if (bgImageEl) {
    collection.backgroundImages.push({
      fileName: bgImageEl.getAttribute('FileName') || '',
      romId: 0,
      romIdType: 'Lamp',
      type: '',
      imageData: cleanBase64(bgImageEl.getAttribute('Value')),
    });
  }

  const bgImagesEl = container.querySelector('BackgroundImages');
  if (bgImagesEl) {
    for (const el of bgImagesEl.querySelectorAll('MainImage, Image')) {
      collection.backgroundImages.push({
        fileName: el.getAttribute('FileName') || '',
        romId: parseInt(el.getAttribute('RomID') || '0', 10),
        romIdType: parseRomIdType(el.getAttribute('RomIDType')),
        type: el.getAttribute('Type') || '',
        imageData: cleanBase64(el.getAttribute('Image') || el.getAttribute('Value')),
      });
    }
  }

  const illumImagesEl = container.querySelector('IlluminatedImages');
  if (illumImagesEl) {
    for (const el of illumImagesEl.querySelectorAll('Image')) {
      collection.illuminatedImages.push({
        fileName: el.getAttribute('FileName') || '',
        imageData: cleanBase64(el.getAttribute('Image') || el.getAttribute('Value')),
      });
    }
  }

  const dmdImageEl = container.querySelector('DMDImage');
  if (dmdImageEl) {
    collection.dmdImages.push({
      fileName: dmdImageEl.getAttribute('FileName') || '',
      imageData: cleanBase64(dmdImageEl.getAttribute('Value')),
    });
  }

  const dmdImagesEl = container.querySelector('DMDImages');
  if (dmdImagesEl) {
    for (const el of dmdImagesEl.querySelectorAll('MainImage, Image')) {
      collection.dmdImages.push({
        fileName: el.getAttribute('FileName') || '',
        imageData: cleanBase64(el.getAttribute('Image') || el.getAttribute('Value')),
      });
    }
  }

  const thumbEl = container.querySelector('ThumbnailImage');
  if (thumbEl) {
    collection.thumbnailImage = cleanBase64(thumbEl.getAttribute('Value')) || undefined;
  }
  const thumbEl2 = container.querySelector('ThumbnailImages > MainImage');
  if (thumbEl2) {
    collection.thumbnailImage = cleanBase64(thumbEl2.getAttribute('Image')) || collection.thumbnailImage;
  }

  return collection;
}

function parseReels(container: Element): ReelCollection {
  const reels: ReelCollection = {
    countOfIntermediates: parseInt(container.getAttribute('ReelCountOfIntermediates') || '10', 10),
    rollingDirection: container.getAttribute('ReelRollingDirection') === '1' ? 'Down' : 'Up',
    rollingInterval: parseInt(container.getAttribute('ReelRollingInterval') || '30', 10),
    images: [],
    illuminatedImages: new Map(),
  };

  const imagesEl = container.querySelector('Images');
  if (imagesEl) {
    for (const el of imagesEl.querySelectorAll('Image')) {
      reels.images.push({
        name: el.getAttribute('Name') || '',
        countOfIntermediates: parseInt(el.getAttribute('CountOfIntermediates') || '10', 10),
        imageData: el.getAttribute('Image') || '',
      });
    }
  }

  return reels;
}
