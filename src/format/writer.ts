import type { DirectB2SData, Bulb, Animation, ScoreInfo, Color, ReelImage } from '../types/data';
import {
  DIRECTB2S_VERSION,
  getMainBackgroundImage,
  getOffBackgroundImage,
  isReelTypeRenderedOrDream7,
  isReelImageRendered,
  getReelBaseName,
  reelTypesToString,
  IMPORTED_START_STRING,
} from '../types/data';
import {
  type ImageSource,
  bulbRect,
  clipRectToImage,
  createBulbSprite,
  createBulbOffSprite,
  bakeLightsIntoImage,
  drawIlluminatedReelImage,
  createIntermediates,
  canvasToBase64Png,
  ensureSnippetImagesLoaded,
} from '../editor/illumination-render';

export interface ReelResource {
  image: ImageSource;
  base64: string;
}

export interface WriterAssets {
  backgroundImage: ImageSource | null;
  offImage: ImageSource | null;
  dmdImage: ImageSource | null;
  loadReelImage(name: string): Promise<ReelResource | null>;
  onProgress?: (percent: number) => void;
}

export interface WriteOptions {
  includeImages?: boolean;
}

export async function writeDirectB2S(data: DirectB2SData, assets: WriterAssets): Promise<string> {
  const lines: string[] = [];
  const progress = (p: number): void => assets.onProgress?.(p);

  lines.push('<?xml version="1.0" encoding="utf-8"?>');
  lines.push(`<DirectB2SData Version="${DIRECTB2S_VERSION}">`);

  writeElement(lines, 'Name', data.name);
  writeElement(lines, 'TableType', tableTypeToValue(data.tableType));
  writeElement(lines, 'DMDType', dmdTypeToValue(data.dmdType));
  lines.push(`  <DMDDefaultLocation LocX="${data.dmdDefaultLocationX}" LocY="${data.dmdDefaultLocationY}" />`);
  if (data.smallGrillHeight > 0) {
    lines.push(`  <GrillHeight Value="${data.grillHeight}" Small="${data.smallGrillHeight - data.grillHeight}" />`);
  } else {
    lines.push(`  <GrillHeight Value="${data.grillHeight}" />`);
  }
  writeElement(lines, 'ProjectGUID', data.projectGUID);
  writeElement(lines, 'ProjectGUID2', data.projectGUID2);
  writeElement(lines, 'AssemblyGUID', data.assemblyGUID);
  writeElement(lines, 'VSName', data.vsName);
  writeElement(lines, 'DualBackglass', data.dualBackglass ? '1' : '0');
  writeElement(lines, 'Author', data.author);
  writeElement(lines, 'Artwork', data.artwork);
  writeElement(lines, 'GameName', data.gameName);
  writeElement(lines, 'AddEMDefaults', data.addEMDefaults ? '1' : '0');
  writeElement(lines, 'CommType', commTypeToValue(data.commType));
  writeElement(lines, 'DestType', destTypeToValue(data.destType));
  writeElement(lines, 'NumberOfPlayers', data.numberOfPlayers.toString());
  writeElement(lines, 'B2SDataCount', data.b2sDataCount.toString());
  writeElement(lines, 'ReelType', reelTypesToString(data.reelTypes));
  writeElement(lines, 'UseDream7LEDs', data.useDream7LEDs ? '1' : '0');
  writeElement(lines, 'D7Glow', Math.round(data.d7Glow * 100).toString());
  writeElement(lines, 'D7Thickness', Math.round(data.d7Thickness * 100).toString());
  writeElement(lines, 'D7Shear', Math.round(data.d7Shear * 100).toString());
  if (data.reelColor) {
    writeElement(lines, 'ReelColor', colorToString(data.reelColor));
  }
  writeElement(lines, 'ReelRollingDirection', data.reelRollingDirection === 'Down' ? '1' : '0');
  writeElement(lines, 'ReelRollingInterval', data.reelRollingInterval.toString());
  writeElement(lines, 'ReelIntermediateImageCount', data.reelIntermediateImageCount.toString());
  if (data.dmdCopyAreaWidth > 0 && data.dmdCopyAreaHeight > 0) {
    writeElement(lines, 'DMDCopyAreaX', data.dmdCopyAreaX.toString());
    writeElement(lines, 'DMDCopyAreaY', data.dmdCopyAreaY.toString());
    writeElement(lines, 'DMDCopyAreaWidth', data.dmdCopyAreaWidth.toString());
    writeElement(lines, 'DMDCopyAreaHeight', data.dmdCopyAreaHeight.toString());
  }

  writeAnimations(lines, data.animations);

  const sortedScores = sortById(data.scores);
  const scoreImageSets = new Map<string, number>();
  writeScores(lines, data, sortedScores, scoreImageSets);
  progress(10);

  await writeReels(lines, data, sortedScores, scoreImageSets, assets);
  progress(20);

  const backglassBulbs = data.illumination.filter(b => b.parent !== 'DMD');
  const dmdBulbs = data.illumination.filter(b => b.parent === 'DMD');
  await ensureSnippetImagesLoaded(data.illumination);

  const alwaysOnBackglass = backglassBulbs.filter(b => b.initialState === 'AlwaysOn');
  const alwaysOnDmd = dmdBulbs.filter(b => b.initialState === 'AlwaysOn');
  const bakedBg = assets.backgroundImage
    ? alwaysOnBackglass.length > 0
      ? bakeLightsIntoImage(assets.backgroundImage, alwaysOnBackglass)
      : assets.backgroundImage
    : null;
  const bakedDmd = assets.dmdImage
    ? alwaysOnDmd.length > 0
      ? bakeLightsIntoImage(assets.dmdImage, alwaysOnDmd)
      : assets.dmdImage
    : null;
  progress(40);

  writeIllumination(lines, data, sortById(data.illumination), bakedBg, bakedDmd, assets.offImage);
  progress(90);

  writeImages(lines, data, bakedBg, bakedDmd, assets);

  lines.push('</DirectB2SData>');
  progress(100);

  return lines.join('\n');
}

function sortById<T extends { id: number; parent: 'Backglass' | 'DMD' }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ka = a.id + (a.parent === 'DMD' ? 1000000 : 0);
    const kb = b.id + (b.parent === 'DMD' ? 1000000 : 0);
    return ka - kb;
  });
}

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\r/g, '&#xD;')
    .replace(/\n/g, '&#xA;');
}

function writeElement(lines: string[], name: string, value: string): void {
  lines.push(`  <${name} Value="${escapeXml(value)}" />`);
}

function tableTypeToValue(type: string): string {
  switch (type) {
    case 'EM':
      return '1';
    case 'SS':
      return '2';
    case 'SSDMD':
      return '3';
    case 'ORI':
      return '4';
    default:
      return '0';
  }
}

function dmdTypeToValue(type: string): string {
  switch (type) {
    case 'NoB2SDMD':
      return '1';
    case 'B2SAlwaysOnSecondMonitor':
      return '2';
    case 'B2SAlwaysOnThirdMonitor':
      return '3';
    case 'B2SOnSecondOrThirdMonitor':
      return '4';
    default:
      return '0';
  }
}

function commTypeToValue(type: string): string {
  switch (type) {
    case 'ROM':
      return '1';
    case 'B2S':
      return '2';
    default:
      return '0';
  }
}

function destTypeToValue(type: string): string {
  switch (type) {
    case 'DirectB2S':
      return '1';
    case 'VisualStudio2010':
      return '2';
    default:
      return '0';
  }
}

export function colorToString(color: Color): string {
  return `${color.r}.${color.g}.${color.b}`;
}

function dualModeToValue(mode: string): string {
  switch (mode) {
    case 'Authentic':
      return '1';
    case 'Fantasy':
      return '2';
    default:
      return '0';
  }
}

function writeAnimations(lines: string[], animations: Animation[]): void {
  lines.push('  <Animations>');
  for (const anim of animations) {
    if (!anim.name) continue;
    const attrs = [
      `Name="${escapeXml(anim.name)}"`,
      `Parent="Backglass"`,
      `DualMode="${dualModeToValue(anim.dualMode)}"`,
      `Interval="${anim.interval}"`,
      `Loops="${anim.loops}"`,
      `IDJoin="${escapeXml(anim.idJoin)}"`,
      `StartAnimationAtBackglassStartup="${anim.startAnimationAtBackglassStartup ? '1' : '0'}"`,
      `LightsStateAtAnimationStart="${anim.lightsStateAtAnimationStart}"`,
      `LightsStateAtAnimationEnd="${anim.lightsStateAtAnimationEnd}"`,
      `AnimationStopBehaviour="${anim.animationStopBehaviour}"`,
      `LockInvolvedLamps="${anim.lockInvolvedLamps ? '1' : '0'}"`,
      `HideScoreDisplays="${anim.hideScoreDisplays ? '1' : '0'}"`,
      `BringToFront="${anim.bringToFront ? '1' : '0'}"`,
    ];
    if (anim.randomStart) {
      attrs.push('RandomStart="1"');
      attrs.push(`RandomQuality="${anim.randomQuality}"`);
    }

    if (anim.steps.length === 0) {
      lines.push(`    <Animation ${attrs.join(' ')} />`);
      continue;
    }
    lines.push(`    <Animation ${attrs.join(' ')}>`);
    for (const step of anim.steps) {
      const stepAttrs = [
        `Step="${step.step}"`,
        `On="${escapeXml(step.on)}"`,
        `WaitLoopsAfterOn="${step.waitLoopsAfterOn}"`,
        `Off="${escapeXml(step.off)}"`,
        `WaitLoopsAfterOff="${step.waitLoopsAfterOff}"`,
      ];
      if (step.pulseSwitch > 0) stepAttrs.push(`PulseSwitch="${step.pulseSwitch}"`);
      lines.push(`      <AnimationStep ${stepAttrs.join(' ')} />`);
    }
    lines.push('    </Animation>');
  }
  lines.push('  </Animations>');
}

function reelIlluLocationToValue(loc: string): string {
  switch (loc) {
    case 'Above':
      return '1';
    case 'Below':
      return '2';
    case 'AboveAndBelow':
      return '3';
    default:
      return '0';
  }
}

export function exportReelTypeName(data: DirectB2SData, reelType: string): string {
  if (isReelTypeRenderedOrDream7(reelType)) {
    if (data.useDream7LEDs) {
      const base = isReelImageRendered(reelType) ? reelType.substring(8) : reelType.substring(6);
      return 'Dream7' + base;
    }
    return reelType;
  }
  return reelType;
}

function writeScores(
  lines: string[],
  data: DirectB2SData,
  scores: ScoreInfo[],
  scoreImageSets: Map<string, number>
): void {
  const attrsScores = [
    `ReelCountOfIntermediates="${data.reelIntermediateImageCount}"`,
    `ReelRollingDirection="${data.reelRollingDirection}"`,
    `ReelRollingInterval="${data.reelRollingInterval}"`,
  ];
  if (scores.length === 0) {
    lines.push(`  <Scores ${attrsScores.join(' ')} />`);
    return;
  }
  lines.push(`  <Scores ${attrsScores.join(' ')}>`);
  const glow = Math.round(data.d7Glow * 100);
  const thickness = Math.round(data.d7Thickness * 100);
  const shear = Math.round(data.d7Shear * 100);
  for (const score of scores) {
    const attrs = [`Parent="${score.parent}"`, `ID="${score.id}"`];
    if (data.commType === 'B2S') {
      attrs.push(`B2SStartDigit="${score.b2sStartDigit}"`);
      attrs.push(`B2SScoreType="${score.b2sScoreType}"`);
      attrs.push(`B2SPlayerNo="${score.b2sPlayerNo}"`);
    }
    if (isReelTypeRenderedOrDream7(score.reelType)) {
      attrs.push(`ReelType="${escapeXml(exportReelTypeName(data, score.reelType))}"`);
    } else {
      attrs.push(`ReelType="${escapeXml(score.reelType)}"`);
      if (score.reelIlluLocation !== 'Off') {
        const key = `${score.reelType}\u0001${score.reelIlluIntensity}\u0001${reelIlluLocationToValue(score.reelIlluLocation)}`;
        if (!scoreImageSets.has(key)) {
          scoreImageSets.set(key, scoreImageSets.size + 1);
        }
        attrs.push(`ReelIlluImageSet="${scoreImageSets.get(key)}"`);
      }
      attrs.push(`ReelIlluLocation="${reelIlluLocationToValue(score.reelIlluLocation)}"`);
      const intensity = score.reelIlluIntensity <= 0 ? 1 : score.reelIlluIntensity;
      attrs.push(`ReelIlluIntensity="${intensity}"`);
      attrs.push(`ReelIlluB2SID="${score.reelIlluB2SID}"`);
      attrs.push(`ReelIlluB2SIDType="${score.reelIlluB2SIDType}"`);
      attrs.push(`ReelIlluB2SValue="${score.reelIlluB2SValue}"`);
    }
    attrs.push(`ReelLitColor="${colorToString(score.reelColor)}"`);
    attrs.push(`ReelDarkColor="15.15.15"`);
    attrs.push(`Glow="${glow}"`);
    attrs.push(`Thickness="${thickness}"`);
    attrs.push(`Shear="${shear}"`);
    attrs.push(`Digits="${score.digits}"`);
    attrs.push(`Spacing="${score.spacing}"`);
    attrs.push(`DisplayState="${score.displayState}"`);
    attrs.push(`LocX="${Math.round(score.locX)}"`);
    attrs.push(`LocY="${Math.round(score.locY)}"`);
    attrs.push(`Width="${Math.round(score.width)}"`);
    attrs.push(`Height="${Math.round(score.height)}"`);
    attrs.push(`Sound3="10"`);
    attrs.push(`Sound4="100"`);
    attrs.push(`Sound5="1000"`);
    lines.push(`    <Score ${attrs.join(' ')} />`);
  }
  lines.push('  </Scores>');
}

interface CollectedReelImage {
  name: string;
  image: ImageSource;
  base64: string;
}

function loadImageFromBase64(base64: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    if (!base64) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    let mime = 'image/png';
    if (base64.startsWith('/9j/')) mime = 'image/jpeg';
    else if (base64.startsWith('R0lGOD')) mime = 'image/gif';
    else if (base64.startsWith('Qk')) mime = 'image/bmp';
    img.src = `data:${mime};base64,${base64}`;
  });
}

async function resolveReelImage(
  name: string,
  isImported: boolean,
  existing: Map<string, ReelImage>,
  assets: WriterAssets
): Promise<CollectedReelImage | null> {
  if (!isImported) {
    const res = await assets.loadReelImage(name);
    if (res) return { name, image: res.image, base64: res.base64 };
  }
  const prev = existing.get(name.toLowerCase());
  if (prev && prev.imageData) {
    const img = await loadImageFromBase64(prev.imageData);
    if (img) return { name, image: img, base64: prev.imageData };
  }
  return null;
}

async function collectReelImages(
  data: DirectB2SData,
  scores: ScoreInfo[],
  assets: WriterAssets
): Promise<Map<string, CollectedReelImage[]>> {
  const result = new Map<string, CollectedReelImage[]>();
  const existing = new Map<string, ReelImage>();
  for (const img of data.reels.images) existing.set(img.name.toLowerCase(), img);

  const candidates = new Set<string>(data.reelTypes);
  for (const s of scores) if (s.reelType) candidates.add(s.reelType);

  for (const reelTypeRaw of candidates) {
    const reelType = reelTypeRaw.trim();
    if (!reelType || reelType.length < 2) continue;
    if (!scores.some(s => s.reelType === reelType)) continue;
    if (isReelTypeRenderedOrDream7(reelType)) continue;
    const isImported = reelType.startsWith(IMPORTED_START_STRING);
    const plain = isImported ? reelType.substring(IMPORTED_START_STRING.length) : reelType;
    const isEMR_T = plain.startsWith('EMR_T');
    const isEMR_CT = plain.startsWith('EMR_CT');
    const isLED = plain.startsWith('LED');
    if (!isEMR_T && !isEMR_CT && !isLED) continue;

    const length = reelType.charAt(reelType.length - 3) === '_' ? 3 : 2;
    const reelName = reelType.substring(0, reelType.length - length);
    if (result.has(reelName)) continue;
    const images: CollectedReelImage[] = [];
    const seen = new Set<string>();

    let index = 0;
    while (true) {
      let currentName: string;
      if (isEMR_CT) {
        currentName = `${reelName}_${index.toString().padStart(2, '0')}`;
      } else {
        currentName = `${reelName}_${index < 10 ? index.toString().padStart(length - 1, '0') : 'Empty'}`;
      }
      const img = await resolveReelImage(currentName, isImported, existing, assets);
      if (img) {
        if (!seen.has(currentName)) {
          seen.add(currentName);
          images.push(img);
        }
        if (index < 0 || index > 25) break;
      } else if (index > 25) {
        break;
      } else {
        break;
      }
      index++;
    }
    result.set(reelName, images);
  }
  return result;
}

async function writeReels(
  lines: string[],
  data: DirectB2SData,
  scores: ScoreInfo[],
  scoreImageSets: Map<string, number>,
  assets: WriterAssets
): Promise<void> {
  const hasReelTypes = data.reelTypes.length > 0 || scores.some(s => s.reelType);
  if (!hasReelTypes) {
    return;
  }

  const reelImages = await collectReelImages(data, scores, assets);

  const intermediates = new Map<string, HTMLCanvasElement[]>();
  const count = data.reelIntermediateImageCount;
  if (count > 0) {
    for (const [reelName, images] of reelImages) {
      const isLED = reelName.startsWith('LED') || reelName.startsWith(IMPORTED_START_STRING + 'LED');
      if (isLED) continue;
      for (let i = 0; i < images.length; i++) {
        const current = images[i].image;
        const next = i >= images.length - 1 ? images[0].image : images[i + 1].image;
        intermediates.set(
          images[i].name,
          createIntermediates(next, current, count, data.reelRollingDirection === 'Up')
        );
      }
    }
  }

  lines.push('  <Reels>');
  const imageLines: string[] = [];
  for (const [reelName, images] of reelImages) {
    const isLED = reelName.startsWith('LED') || reelName.startsWith(IMPORTED_START_STRING + 'LED');
    for (const img of images) {
      const attrs = [
        `Name="${escapeXml(img.name)}"`,
        `CountOfIntermediates="${isLED ? 0 : count}"`,
        `Image="${img.base64}"`,
      ];
      if (!isLED) {
        const inter = intermediates.get(img.name);
        if (inter) {
          inter.forEach((c, i) => attrs.push(`IntermediateImage${i + 1}="${canvasToBase64Png(c)}"`));
        }
      }
      imageLines.push(`      <Image ${attrs.join(' ')} />`);
    }
  }
  if (imageLines.length === 0) {
    lines.push('    <Images />');
  } else {
    lines.push('    <Images>');
    lines.push(...imageLines);
    lines.push('    </Images>');
  }

  if (scoreImageSets.size === 0) {
    lines.push('    <IlluminatedImages />');
  } else {
    lines.push('    <IlluminatedImages>');
    for (const [key, setId] of scoreImageSets) {
      const [setReelType, intensityStr, locationStr] = key.split('\u0001');
      const setBase = getReelBaseName(setReelType).toLowerCase();
      const intensity = parseInt(intensityStr, 10) || 1;
      const location = valueToReelIlluLocation(locationStr);
      lines.push(`      <Set ID="${setId}">`);
      for (const [reelName, images] of reelImages) {
        const isLED = reelName.startsWith('LED') || reelName.startsWith(IMPORTED_START_STRING + 'LED');
        for (const img of images) {
          if (!img.name.toLowerCase().startsWith(setBase)) continue;
          const lit = drawIlluminatedReelImage(img.image, intensity, location);
          const attrs = [
            `Name="${escapeXml(img.name)}"`,
            `CountOfIntermediates="${isLED ? 0 : count}"`,
            `Image="${imageSourceToBase64(lit)}"`,
          ];
          if (!isLED) {
            const inter = intermediates.get(img.name);
            if (inter) {
              inter.forEach((c, i) =>
                attrs.push(
                  `IntermediateImage${i + 1}="${imageSourceToBase64(drawIlluminatedReelImage(c, intensity, location))}"`
                )
              );
            }
          }
          lines.push(`        <IlluminatedImage ${attrs.join(' ')} />`);
        }
      }
      lines.push('      </Set>');
    }
    lines.push('    </IlluminatedImages>');
  }
  lines.push('  </Reels>');
}

function valueToReelIlluLocation(v: string): 'Off' | 'Above' | 'Below' | 'AboveAndBelow' {
  switch (v) {
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

function imageSourceToBase64(img: ImageSource): string {
  if (img instanceof HTMLCanvasElement) return canvasToBase64Png(img);
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  c.getContext('2d')!.drawImage(img, 0, 0);
  return canvasToBase64Png(c);
}

function romIdTypeToValue(type: string): string {
  switch (type) {
    case 'Lamp':
      return '1';
    case 'Solenoid':
      return '2';
    case 'GIString':
      return '3';
    default:
      return '0';
  }
}

function initialStateToValue(state: string): string {
  switch (state) {
    case 'On':
      return '1';
    case 'AlwaysOn':
      return '2';
    default:
      return '0';
  }
}

function snippetTypeToValue(t: string): string {
  switch (t) {
    case 'SelfRotatingImage':
      return '1';
    case 'MechRotatingImage':
      return '2';
    default:
      return '0';
  }
}

function snippetStopBehaviourToValue(b: string): string {
  switch (b) {
    case 'StopImmediately':
      return '1';
    case 'RunAnimationTillEnd':
      return '2';
    case 'RunAnimationToFirstStep':
      return '3';
    default:
      return '0';
  }
}

function writeIllumination(
  lines: string[],
  data: DirectB2SData,
  bulbs: Bulb[],
  bakedBg: ImageSource | null,
  bakedDmd: ImageSource | null,
  offImage: ImageSource | null
): void {
  lines.push('  <Illumination>');
  for (const bulb of bulbs) {
    if (bulb.initialState === 'AlwaysOn') continue;
    const isDmd = bulb.parent === 'DMD';
    const bg = isDmd ? bakedDmd : bakedBg;
    const rect = bulbRect(bulb);
    const rectX = bg ? clipRectToImage(rect, bg.width, bg.height) : rect;

    let image = '';
    let offImageData = '';
    if (bulb.isImageSnippet && bulb.imageData) {
      image = bulb.imageData;
    } else if (bg) {
      if (rectX.w <= 0 || rectX.h <= 0) continue;
      const sprite = createBulbSprite(bg, bulb, bulb.intensity <= 0 ? 1 : bulb.intensity, true);
      if (!sprite) continue;
      image = canvasToBase64Png(sprite);
      if (!isDmd && offImage) {
        const off = createBulbOffSprite(offImage, bulb);
        if (off) offImageData = canvasToBase64Png(off);
      }
    }

    const attrs = [`Parent="${bulb.parent}"`, `ID="${bulb.id}"`, `Name="${escapeXml(bulb.name)}"`];
    if (data.commType === 'B2S') {
      attrs.push(`B2SID="${bulb.b2sId}"`);
      attrs.push(`B2SIDType="${bulb.b2sIdType}"`);
      attrs.push(`B2SValue="${bulb.b2sValue}"`);
    } else if (bulb.isImageSnippet && bulb.snippetType === 'MechRotatingImage') {
      attrs.push(`RomID="${bulb.snippetMechID}"`);
      attrs.push(`RomIDType="4"`);
    } else {
      attrs.push(`RomID="${bulb.romId}"`);
      attrs.push(`RomIDType="${romIdTypeToValue(bulb.romIdType)}"`);
      attrs.push(`RomInverted="${bulb.romInverted ? '1' : '0'}"`);
    }
    attrs.push(`InitialState="${initialStateToValue(bulb.initialState)}"`);
    attrs.push(`DualMode="${dualModeToValue(bulb.dualMode)}"`);
    attrs.push(`Intensity="${bulb.intensity <= 0 ? 1 : bulb.intensity}"`);
    attrs.push(`LightColor="${colorToString(bulb.lightColor)}"`);
    attrs.push(`DodgeColor="${bulb.dodgeColor ? colorToString(bulb.dodgeColor) : '0.0.0'}"`);
    attrs.push(`IlluMode="${bulb.illuminationMode === 'Flasher' ? '1' : '0'}"`);
    attrs.push(`Visible="${bulb.visible ? '1' : '0'}"`);
    attrs.push(`LocX="${rectX.x}"`);
    attrs.push(`LocY="${rectX.y}"`);
    attrs.push(`Width="${rectX.w}"`);
    attrs.push(`Height="${rectX.h}"`);
    if (bulb.zOrder > 0) {
      attrs.push(`ZOrder="${bulb.zOrder}"`);
    }
    attrs.push(`IsImageSnippit="${bulb.isImageSnippet ? '1' : '0'}"`);
    if (bulb.snippetType !== 'StandardImage') {
      attrs.push(`SnippitType="${snippetTypeToValue(bulb.snippetType)}"`);
      attrs.push(`SnippitRotatingSteps="${bulb.snippetRotatingSteps}"`);
      attrs.push(`SnippitRotatingDirection="${bulb.snippetRotatingDirection === 'AntiClockwise' ? '1' : '0'}"`);
      attrs.push(`SnippitRotatingStopBehaviour="${snippetStopBehaviourToValue(bulb.snippetRotatingStopBehaviour)}"`);
      if (bulb.snippetType === 'SelfRotatingImage') {
        attrs.push(`SnippitRotatingInterval="${bulb.snippetRotatingInterval}"`);
      }
    }
    attrs.push(`Image="${image}"`);
    if (offImageData) {
      attrs.push(`OffImage="${offImageData}"`);
    }
    attrs.push(`Text="${escapeXml(bulb.text)}"`);
    attrs.push(`TextAlignment="${bulb.textAlignment}"`);
    attrs.push(`FontName="${escapeXml(bulb.fontName)}"`);
    attrs.push(`FontSize="${Math.round(bulb.fontSize * 100)}"`);
    attrs.push(`FontStyle="${bulb.fontStyle}"`);

    lines.push(`    <Bulb ${attrs.join(' ')} />`);
  }
  lines.push('  </Illumination>');
}

function makeThumbnail(img: ImageSource): string {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, 32, 32);
  return canvasToBase64Png(c);
}

function writeImages(
  lines: string[],
  data: DirectB2SData,
  bakedBg: ImageSource | null,
  bakedDmd: ImageSource | null,
  assets: WriterAssets
): void {
  lines.push('  <Images>');
  const main = getMainBackgroundImage(data.images);
  const off = getOffBackgroundImage(data.images);
  const mainData = bakedBg && bakedBg !== assets.backgroundImage ? imageSourceToBase64(bakedBg) : main?.imageData || '';

  if (off && off.imageData) {
    lines.push(`    <BackglassOffImage Value="${off.imageData}" />`);
    const attrs = [`Value="${mainData}"`, `FileName="${escapeXml(main?.fileName || '')}"`];
    if (main && main.romId > 0) {
      attrs.push(`RomID="${main.romId}"`);
      attrs.push(`RomIDType="${romIdTypeToValue(main.romIdType)}"`);
    }
    lines.push(`    <BackglassOnImage ${attrs.join(' ')} />`);
  } else {
    lines.push(`    <BackglassImage Value="${mainData}" FileName="${escapeXml(main?.fileName || '')}" />`);
  }

  const dmd = data.images.dmdImages[0];
  if (dmd && dmd.imageData) {
    const dmdData = bakedDmd && bakedDmd !== assets.dmdImage ? imageSourceToBase64(bakedDmd) : dmd.imageData;
    lines.push(`    <DMDImage Value="${dmdData}" FileName="${escapeXml(dmd.fileName)}" />`);
  }

  const illu = data.images.illuminatedImages[0];
  if (illu && illu.imageData) {
    lines.push(`    <IlluminationImage Value="${illu.imageData}" />`);
  }

  let thumb = data.images.thumbnailImage || '';
  if (!thumb && assets.backgroundImage) {
    thumb = makeThumbnail(assets.backgroundImage);
    data.images.thumbnailImage = thumb;
  }
  if (thumb) {
    lines.push(`    <ThumbnailImage Value="${thumb}" />`);
  }

  lines.push('  </Images>');
}
