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
  ReelImage,
  Color,
  RomIdType,
  RotatingDirection,
  SnippetType,
  SnippetStopBehaviour,
  ReelIlluLocation,
  InitialState,
  DualMode,
} from '../types/data';
import {
  createEmptyDirectB2S,
  parseReelTypes,
  LIGHTS_STATE_AT_START,
  LIGHTS_STATE_AT_END,
  ANIMATION_STOP_BEHAVIOUR,
  MAX_BULB_INTENSITY,
  DIRECTB2S_VERSION,
} from '../types/data';

export const DIRECTB2S_MIN_IMPORT_VERSION = '0.85';
export const DIRECTB2S_MAYBE_DATA_LOST_VERSION = '1.3';

export interface ParseResult {
  data: DirectB2SData;
  warnings: string[];
}

export function parseDirectB2S(xmlContent: string): DirectB2SData {
  return parseDirectB2SWithWarnings(xmlContent).data;
}

export function parseDirectB2SWithWarnings(xmlContent: string): ParseResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, 'text/xml');

  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error(`XML parsing error: ${parserError.textContent}`);
  }

  const root = doc.documentElement;
  if (!root || root.tagName !== 'DirectB2SData') {
    throw new Error('Invalid directB2S file: missing DirectB2SData root element');
  }

  const warnings: string[] = [];
  const version = root.getAttribute('Version') || DIRECTB2S_VERSION;
  if (compareVersion(version, DIRECTB2S_MIN_IMPORT_VERSION) < 0) {
    throw new Error(`This directB2S file (version ${version}) is too old to be imported.`);
  }
  if (compareVersion(version, DIRECTB2S_MAYBE_DATA_LOST_VERSION) >= 0) {
    warnings.push(
      `This directB2S file (version ${version}) was created with a newer designer version. Some data may be lost.`
    );
  }

  const data = createEmptyDirectB2S();
  data.version = version;

  data.name = getAttrValue(root, 'Name');
  data.tableType = parseTableType(getAttrValueInt(root, 'TableType'));
  data.dmdType = parseDMDType(getAttrValueInt(root, 'DMDType'));
  const dmdLoc = childElement(root, 'DMDDefaultLocation');
  if (dmdLoc) {
    data.dmdDefaultLocationX = intAttr(dmdLoc, 'LocX');
    data.dmdDefaultLocationY = intAttr(dmdLoc, 'LocY');
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
  data.projectGUID = getAttrValue(root, 'ProjectGUID') || data.projectGUID;
  data.projectGUID2 = getAttrValue(root, 'ProjectGUID2') || data.projectGUID2;
  data.assemblyGUID = getAttrValue(root, 'AssemblyGUID') || data.assemblyGUID;
  data.vsName = getAttrValue(root, 'VSName');
  data.dualBackglass = getAttrValue(root, 'DualBackglass') === '1';
  data.author = getAttrValue(root, 'Author');
  data.artwork = getAttrValue(root, 'Artwork');
  data.gameName = getAttrValue(root, 'GameName');
  data.addEMDefaults = getAttrValue(root, 'AddEMDefaults') === '1';
  const grillEl = childElement(root, 'GrillHeight');
  if (grillEl) {
    data.grillHeight = Math.max(0, intAttr(grillEl, 'Value'));
    if (grillEl.hasAttribute('Small')) {
      const small = Math.max(0, intAttr(grillEl, 'Small'));
      data.smallGrillHeight = small > 0 ? small + data.grillHeight : 0;
    }
  }
  data.numberOfPlayers = getAttrValueInt(root, 'NumberOfPlayers');
  data.b2sDataCount = childElement(root, 'B2SDataCount') ? getAttrValueInt(root, 'B2SDataCount') : 5;
  data.reelTypes = parseReelTypes(getAttrValue(root, 'ReelType'));
  data.useDream7LEDs = childElement(root, 'UseDream7LEDs') ? getAttrValue(root, 'UseDream7LEDs') === '1' : true;
  data.d7Glow = getAttrValueFloat(root, 'D7Glow') / 100;
  data.d7Thickness = getAttrValueFloat(root, 'D7Thickness') / 100;
  data.d7Shear = getAttrValueFloat(root, 'D7Shear') / 100;
  const reelColorStr = getAttrValue(root, 'ReelColor');
  data.reelColor = reelColorStr ? parseColor(reelColorStr) : null;
  data.reelRollingDirection = getAttrValueInt(root, 'ReelRollingDirection') === 1 ? 'Down' : 'Up';
  data.reelRollingInterval = getAttrValueInt(root, 'ReelRollingInterval');
  data.reelIntermediateImageCount = getAttrValueInt(root, 'ReelIntermediateImageCount');

  const animationsEl = childElement(root, 'Animations');
  if (animationsEl) {
    data.animations = parseAnimations(animationsEl);
  }

  const scoresEl = childElement(root, 'Scores');
  if (scoresEl) {
    data.scores = parseScores(scoresEl, data);
  }

  const illuminationEl = childElement(root, 'Illumination');
  if (illuminationEl) {
    data.illumination = parseIllumination(illuminationEl);
  }

  const imagesEl = childElement(root, 'Images');
  if (imagesEl) {
    data.images = parseImages(imagesEl);
  }

  const reelsEl = childElement(root, 'Reels');
  if (reelsEl) {
    data.reels = parseReels(reelsEl);
  }

  return { data, warnings };
}

function compareVersion(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function childElement(parent: Element, name: string): Element | null {
  for (const child of Array.from(parent.children)) {
    if (child.tagName === name) return child;
  }
  return null;
}

function childElements(parent: Element, name: string): Element[] {
  return Array.from(parent.children).filter(c => c.tagName === name);
}

function getAttrValue(parent: Element, name: string): string {
  const el = childElement(parent, name);
  return el?.getAttribute('Value') || '';
}

function getAttrValueInt(parent: Element, name: string): number {
  return parseInt(getAttrValue(parent, name), 10) || 0;
}

function getAttrValueFloat(parent: Element, name: string): number {
  return parseFloat(getAttrValue(parent, name)) || 0;
}

function intAttr(el: Element, name: string, def = 0): number {
  const v = el.getAttribute(name);
  if (v === null || v === '') return def;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? def : n;
}

function floatAttr(el: Element, name: string, def = 0): number {
  const v = el.getAttribute(name);
  if (v === null || v === '') return def;
  const n = parseFloat(v);
  return Number.isNaN(n) ? def : n;
}

function boolAttr(el: Element, name: string, def = false): boolean {
  const v = el.getAttribute(name);
  if (v === null) return def;
  return v === '1' || v.toLowerCase() === 'true';
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
      return 'NotDefined';
  }
}

function parseDMDType(value: number): DMDType {
  switch (value) {
    case 1:
      return 'NoB2SDMD';
    case 2:
      return 'B2SAlwaysOnSecondMonitor';
    case 3:
      return 'B2SAlwaysOnThirdMonitor';
    case 4:
      return 'B2SOnSecondOrThirdMonitor';
    default:
      return 'NotDefined';
  }
}

function parseCommType(value: number): CommType {
  switch (value) {
    case 1:
      return 'ROM';
    case 2:
      return 'B2S';
    default:
      return 'NotDefined';
  }
}

function parseDestType(value: number): DestType {
  switch (value) {
    case 2:
      return 'VisualStudio2010';
    case 1:
      return 'DirectB2S';
    default:
      return 'NotDefined';
  }
}

export function parseColor(colorStr: string): Color {
  if (!colorStr) return { r: 255, g: 255, b: 255, a: 255 };
  const parts = colorStr
    .replace(/;/g, '.')
    .split(/[.,]/)
    .map(s => parseInt(s.trim(), 10));
  if (parts.length === 4 && parts.every(n => !Number.isNaN(n))) {
    return { a: parts[0], r: parts[1], g: parts[2], b: parts[3] };
  }
  if (parts.length === 3 && parts.every(n => !Number.isNaN(n))) {
    return { r: parts[0], g: parts[1], b: parts[2], a: 255 };
  }
  return { r: 255, g: 255, b: 255, a: 255 };
}

function parseAnimations(container: Element): Animation[] {
  const animations: Animation[] = [];
  for (const el of childElements(container, 'Animation')) {
    let lightsStateAtStart = LIGHTS_STATE_AT_START.Undefined as number;
    if (el.hasAttribute('LightsStateAtAnimationStart')) {
      lightsStateAtStart = intAttr(el, 'LightsStateAtAnimationStart');
    } else if (el.hasAttribute('AllLightsOffAtAnimationStart')) {
      lightsStateAtStart = boolAttr(el, 'AllLightsOffAtAnimationStart')
        ? LIGHTS_STATE_AT_START.LightsOff
        : LIGHTS_STATE_AT_START.NoChange;
    }

    let lightsStateAtEnd = LIGHTS_STATE_AT_END.Undefined as number;
    if (el.hasAttribute('LightsStateAtAnimationEnd')) {
      lightsStateAtEnd = intAttr(el, 'LightsStateAtAnimationEnd');
    } else if (el.hasAttribute('ResetLightsAtAnimationEnd')) {
      lightsStateAtEnd = boolAttr(el, 'ResetLightsAtAnimationEnd')
        ? LIGHTS_STATE_AT_END.LightsReseted
        : LIGHTS_STATE_AT_END.Undefined;
    }

    let stopBehaviour = ANIMATION_STOP_BEHAVIOUR.Undefined as number;
    if (el.hasAttribute('RunAnimationTilEnd')) {
      stopBehaviour = boolAttr(el, 'RunAnimationTilEnd')
        ? ANIMATION_STOP_BEHAVIOUR.RunAnimationTillEnd
        : ANIMATION_STOP_BEHAVIOUR.StopImmediately;
    } else if (el.hasAttribute('AnimationStopBehaviour')) {
      stopBehaviour = intAttr(el, 'AnimationStopBehaviour');
    }

    let idJoin = el.hasAttribute('B2SJoin') ? el.getAttribute('B2SJoin') || '' : el.getAttribute('IDJoin') || '';
    if (idJoin === '0') idJoin = '';

    const randomStart = boolAttr(el, 'RandomStart');

    animations.push({
      name: el.getAttribute('Name') || '',
      dualMode: parseDualMode(el.getAttribute('DualMode')),
      interval: intAttr(el, 'Interval'),
      loops: intAttr(el, 'Loops'),
      idJoin,
      startAnimationAtBackglassStartup: boolAttr(el, 'StartAnimationAtBackglassStartup'),
      lightsStateAtAnimationStart: lightsStateAtStart,
      lightsStateAtAnimationEnd: lightsStateAtEnd,
      animationStopBehaviour: stopBehaviour,
      lockInvolvedLamps: boolAttr(el, 'LockInvolvedLamps'),
      hideScoreDisplays: boolAttr(el, 'HideScoreDisplays'),
      bringToFront: boolAttr(el, 'BringToFront'),
      randomStart,
      randomQuality: randomStart ? intAttr(el, 'RandomQuality', 1) : 1,
      steps: parseAnimationSteps(el),
    });
  }
  return animations;
}

function parseAnimationSteps(animationEl: Element): AnimationStep[] {
  const steps: AnimationStep[] = [];
  for (const el of childElements(animationEl, 'AnimationStep')) {
    steps.push({
      step: intAttr(el, 'Step'),
      on: el.getAttribute('On') || '',
      off: el.getAttribute('Off') || '',
      waitLoopsAfterOn: intAttr(el, 'WaitLoopsAfterOn'),
      waitLoopsAfterOff: intAttr(el, 'WaitLoopsAfterOff'),
      pulseSwitch: intAttr(el, 'PulseSwitch'),
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

function parseScores(container: Element, data: DirectB2SData): ScoreInfo[] {
  const scores: ScoreInfo[] = [];
  if (container.hasAttribute('ReelCountOfIntermediates') && !data.reelIntermediateImageCount) {
    data.reelIntermediateImageCount = intAttr(container, 'ReelCountOfIntermediates');
  }
  if (container.hasAttribute('ReelRollingDirection')) {
    const dir = container.getAttribute('ReelRollingDirection') || '';
    if (dir === 'Down' || dir === '1') data.reelRollingDirection = 'Down';
  }
  if (container.hasAttribute('ReelRollingInterval') && !data.reelRollingInterval) {
    data.reelRollingInterval = intAttr(container, 'ReelRollingInterval');
  }

  let glowSeen = false;
  for (const el of childElements(container, 'Score')) {
    const rawReelType = el.getAttribute('ReelType') || '';
    const reelType = rawReelType.replace('Dream7', 'Rendered');
    const colorStr = el.getAttribute('ReelColor') || el.getAttribute('ReelLitColor') || '';
    const reelColor = colorStr ? parseColor(colorStr) : data.reelColor ? { ...data.reelColor } : parseColor('255.69.0');

    if (!glowSeen && el.hasAttribute('Glow')) {
      glowSeen = true;
      if (!data.d7Glow) data.d7Glow = floatAttr(el, 'Glow') / 100;
      if (!data.d7Thickness) data.d7Thickness = floatAttr(el, 'Thickness') / 100;
      if (!data.d7Shear) data.d7Shear = floatAttr(el, 'Shear') / 100;
    }

    const score: ScoreInfo = {
      id: intAttr(el, 'ID'),
      parent: el.getAttribute('Parent') === 'DMD' ? 'DMD' : 'Backglass',
      reelType,
      digits: intAttr(el, 'Digits', intAttr(el, 'NumberOfReels')),
      spacing: intAttr(el, 'Spacing', intAttr(el, 'SpaceBetweenReels')),
      locX: intAttr(el, 'LocX'),
      locY: intAttr(el, 'LocY'),
      width: Math.max(10, intAttr(el, 'Width')),
      height: Math.max(10, intAttr(el, 'Height')),
      reelColor,
      displayState: intAttr(el, 'DisplayState'),
      b2sStartDigit: intAttr(el, 'B2SStartDigit'),
      b2sScoreType: intAttr(el, 'B2SScoreType'),
      b2sPlayerNo: intAttr(el, 'B2SPlayerNo'),
      reelIlluLocation: parseReelIlluLocation(el.getAttribute('ReelIlluLocation')),
      reelIlluIntensity: Math.max(1, intAttr(el, 'ReelIlluIntensity', 1)),
      reelIlluB2SID: intAttr(el, 'ReelIlluB2SID'),
      reelIlluB2SIDType: intAttr(el, 'ReelIlluB2SIDType'),
      reelIlluB2SValue: intAttr(el, 'ReelIlluB2SValue'),
    };
    scores.push(score);
    if (rawReelType && !data.reelTypes.includes(reelType) && !data.reelTypes.includes(rawReelType)) {
      data.reelTypes.push(reelType);
    }
  }
  return scores;
}

function parseIllumination(container: Element): Bulb[] {
  const bulbs: Bulb[] = [];
  for (const el of childElements(container, 'Bulb')) {
    const isSnippet = boolAttr(el, 'IsImageSnippit') || boolAttr(el, 'IsImageSnippet');
    const romIdTypeRaw = intAttr(el, 'RomIDType');
    const isMechSnippet = isSnippet && romIdTypeRaw === 4;

    let fontSize = floatAttr(el, 'FontSize', 10);
    if (fontSize >= 100) fontSize = fontSize / 100;

    let rotatingSteps = intAttr(el, 'SnippitRotatingSteps');
    if (!rotatingSteps && el.hasAttribute('SnippitRotatingAngle')) {
      const angle = intAttr(el, 'SnippitRotatingAngle');
      if (angle > 0) rotatingSteps = Math.round(360 / angle);
    }

    const intensity = Math.min(MAX_BULB_INTENSITY, Math.max(1, intAttr(el, 'Intensity', 1)));
    const dodgeStr = el.getAttribute('DodgeColor');
    const dodgeColor = dodgeStr ? parseColor(dodgeStr) : undefined;
    const lightColorStr = el.getAttribute('LightColor');
    const imageData = cleanBase64(el.getAttribute('Image'));
    const offImageData = cleanBase64(el.getAttribute('OffImage'));

    const bulb: Bulb = {
      id: intAttr(el, 'ID'),
      name: el.getAttribute('Name') || '',
      parent: el.getAttribute('Parent') === 'DMD' ? 'DMD' : 'Backglass',
      romId: isMechSnippet ? 0 : intAttr(el, 'RomID'),
      romIdType: isMechSnippet ? 'NotUsed' : parseRomIdType(romIdTypeRaw),
      romInverted: boolAttr(el, 'RomInverted'),
      b2sId: intAttr(el, 'B2SID'),
      b2sIdType: intAttr(el, 'B2SIDType'),
      b2sValue: intAttr(el, 'B2SValue'),
      lightColor: lightColorStr ? parseColor(lightColorStr) : { r: 255, g: 254, b: 232, a: 255 },
      dodgeColor: dodgeColor && (dodgeColor.r || dodgeColor.g || dodgeColor.b) ? dodgeColor : undefined,
      locX: intAttr(el, 'LocX'),
      locY: intAttr(el, 'LocY'),
      width: Math.max(10, intAttr(el, 'Width')),
      height: Math.max(10, intAttr(el, 'Height')),
      intensity,
      isImageSnippet: isSnippet,
      imageData: isSnippet ? imageData : '',
      offImageData: offImageData || undefined,
      snippetType: parseSnippetType(el.getAttribute('SnippitType')),
      snippetMechID: isMechSnippet ? intAttr(el, 'RomID') : intAttr(el, 'SnippitMechID'),
      snippetRotatingSteps: rotatingSteps,
      snippetRotatingInterval: intAttr(el, 'SnippitRotatingInterval'),
      snippetRotatingDirection: parseRotatingDirection(el.getAttribute('SnippitRotatingDirection')),
      snippetRotatingStopBehaviour: parseSnippetStopBehaviour(el.getAttribute('SnippitRotatingStopBehaviour')),
      text: el.getAttribute('Text') || '',
      textAlignment: intAttr(el, 'TextAlignment'),
      fontName: el.getAttribute('FontName') || '',
      fontSize,
      fontStyle: intAttr(el, 'FontStyle'),
      visible: boolAttr(el, 'Visible', true),
      initialState: parseInitialState(intAttr(el, 'InitialState')),
      dualMode: parseDualMode(el.getAttribute('DualMode')),
      illuminationMode:
        (el.hasAttribute('IlluMode') ? intAttr(el, 'IlluMode') : intAttr(el, 'IlluminationMode')) === 1
          ? 'Flasher'
          : 'Standard',
      zOrder: intAttr(el, 'ZOrder'),
    };
    bulbs.push(bulb);
  }
  return bulbs;
}

function parseRomIdType(value: number): RomIdType {
  switch (value) {
    case 1:
      return 'Lamp';
    case 2:
      return 'Solenoid';
    case 3:
      return 'GIString';
    default:
      return 'NotUsed';
  }
}

function parseRotatingDirection(value: string | null): RotatingDirection {
  return value === '1' ? 'AntiClockwise' : 'Clockwise';
}

function parseSnippetType(value: string | null): SnippetType {
  switch (value) {
    case '1':
      return 'SelfRotatingImage';
    case '2':
      return 'MechRotatingImage';
    default:
      return 'StandardImage';
  }
}

function parseReelIlluLocation(value: string | null): ReelIlluLocation {
  switch (value) {
    case '1':
      return 'Above';
    case '2':
      return 'Below';
    case '3':
      return 'AboveAndBelow';
    default:
      return 'Off';
  }
}

function parseSnippetStopBehaviour(value: string | null): SnippetStopBehaviour {
  switch (value) {
    case '1':
      return 'StopImmediately';
    case '2':
      return 'RunAnimationTillEnd';
    case '3':
      return 'RunAnimationToFirstStep';
    default:
      return 'SpinOff';
  }
}

function parseInitialState(value: number): InitialState {
  switch (value) {
    case 1:
    case 3:
      return 'On';
    case 2:
      return 'AlwaysOn';
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

  const bgImageEl = childElement(container, 'BackglassImage');
  const onImageEl = childElement(container, 'BackglassOnImage');
  const offImageEl = childElement(container, 'BackglassOffImage');
  if (bgImageEl) {
    collection.backgroundImages.push({
      fileName: bgImageEl.getAttribute('FileName') || '',
      romId: 0,
      romIdType: 'NotUsed',
      type: 'Main',
      imageData: cleanBase64(bgImageEl.getAttribute('Value')),
    });
  } else if (onImageEl) {
    collection.backgroundImages.push({
      fileName: onImageEl.getAttribute('FileName') || '',
      romId: intAttr(onImageEl, 'RomID'),
      romIdType: parseRomIdType(intAttr(onImageEl, 'RomIDType')),
      type: 'On',
      imageData: cleanBase64(onImageEl.getAttribute('Value')),
    });
  }
  if (offImageEl) {
    collection.backgroundImages.push({
      fileName: offImageEl.getAttribute('FileName') || '',
      romId: intAttr(offImageEl, 'RomID'),
      romIdType: parseRomIdType(intAttr(offImageEl, 'RomIDType')),
      type: 'Off',
      imageData: cleanBase64(offImageEl.getAttribute('Value')),
    });
  }

  const bgImagesEl = childElement(container, 'BackgroundImages');
  if (bgImagesEl && collection.backgroundImages.length === 0) {
    for (const el of Array.from(bgImagesEl.children)) {
      const typeRaw = el.getAttribute('Type') || '';
      const type = typeRaw === '1' || typeRaw === 'Off' ? 'Off' : typeRaw === '2' || typeRaw === 'On' ? 'On' : 'Main';
      collection.backgroundImages.push({
        fileName: el.getAttribute('FileName') || '',
        romId: intAttr(el, 'RomID'),
        romIdType: parseRomIdType(intAttr(el, 'RomIDType')),
        type,
        imageData: cleanBase64(el.getAttribute('Image') || el.getAttribute('Value')),
      });
    }
  }

  const illumImageEl = childElement(container, 'IlluminationImage');
  if (illumImageEl) {
    collection.illuminatedImages.push({
      fileName: illumImageEl.getAttribute('FileName') || '',
      imageData: cleanBase64(illumImageEl.getAttribute('Value')),
    });
  }
  const illumImagesEl = childElement(container, 'IlluminatedImages');
  if (illumImagesEl) {
    for (const el of Array.from(illumImagesEl.children)) {
      collection.illuminatedImages.push({
        fileName: el.getAttribute('FileName') || '',
        imageData: cleanBase64(el.getAttribute('Image') || el.getAttribute('Value')),
      });
    }
  }

  const dmdImageEl = childElement(container, 'DMDImage');
  if (dmdImageEl) {
    collection.dmdImages.push({
      fileName: dmdImageEl.getAttribute('FileName') || '',
      imageData: cleanBase64(dmdImageEl.getAttribute('Value')),
    });
  }
  const dmdImagesEl = childElement(container, 'DMDImages');
  if (dmdImagesEl && collection.dmdImages.length === 0) {
    for (const el of Array.from(dmdImagesEl.children)) {
      collection.dmdImages.push({
        fileName: el.getAttribute('FileName') || '',
        imageData: cleanBase64(el.getAttribute('Image') || el.getAttribute('Value')),
      });
    }
  }

  const thumbEl = childElement(container, 'ThumbnailImage');
  if (thumbEl) {
    collection.thumbnailImage = cleanBase64(thumbEl.getAttribute('Value')) || undefined;
  }
  const thumbsEl = childElement(container, 'ThumbnailImages');
  if (thumbsEl && thumbsEl.children.length > 0) {
    collection.thumbnailImage = cleanBase64(thumbsEl.children[0].getAttribute('Image')) || collection.thumbnailImage;
  }

  return collection;
}

function parseReelImage(el: Element): ReelImage {
  const count = intAttr(el, 'CountOfIntermediates');
  const intermediates: string[] = [];
  for (let i = 1; i <= count; i++) {
    const v = el.getAttribute(`IntermediateImage${i}`);
    if (!v) break;
    intermediates.push(cleanBase64(v));
  }
  return {
    name: el.getAttribute('Name') || '',
    countOfIntermediates: count,
    imageData: cleanBase64(el.getAttribute('Image')),
    intermediates,
  };
}

function parseReels(container: Element): ReelCollection {
  const reels: ReelCollection = {
    images: [],
    illuminatedSets: [],
  };

  const imagesEl = childElement(container, 'Images');
  if (imagesEl) {
    for (const el of childElements(imagesEl, 'Image')) {
      reels.images.push(parseReelImage(el));
    }
  } else {
    for (const el of childElements(container, 'Image')) {
      reels.images.push(parseReelImage(el));
    }
  }

  const illuEl = childElement(container, 'IlluminatedImages');
  if (illuEl) {
    const sets = childElements(illuEl, 'Set');
    if (sets.length > 0) {
      for (const setEl of sets) {
        reels.illuminatedSets.push({
          id: intAttr(setEl, 'ID'),
          images: childElements(setEl, 'IlluminatedImage').map(parseReelImage),
        });
      }
    } else {
      const direct = childElements(illuEl, 'IlluminatedImage');
      if (direct.length > 0) {
        reels.illuminatedSets.push({ id: 1, images: direct.map(parseReelImage) });
      }
    }
  }

  return reels;
}
