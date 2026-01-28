import type { DirectB2SData, Bulb, Animation, ScoreInfo, Color } from '../types/data';

export function writeDirectB2S(data: DirectB2SData): string {
  const lines: string[] = [];

  lines.push('<?xml version="1.0"?>');
  lines.push(`<DirectB2SData Version="${escapeXml(data.version)}">`);

  writeElement(lines, 'Name', data.name);
  writeElement(lines, 'TableType', tableTypeToValue(data.tableType));
  writeElement(lines, 'DMDType', dmdTypeToValue(data.dmdType));
  lines.push(`  <DMDDefaultLocation LocX="${data.dmdDefaultLocationX}" LocY="${data.dmdDefaultLocationY}" />`);
  if (data.dmdCopyAreaWidth > 0 && data.dmdCopyAreaHeight > 0) {
    writeElement(lines, 'DMDCopyAreaX', data.dmdCopyAreaX.toString());
    writeElement(lines, 'DMDCopyAreaY', data.dmdCopyAreaY.toString());
    writeElement(lines, 'DMDCopyAreaWidth', data.dmdCopyAreaWidth.toString());
    writeElement(lines, 'DMDCopyAreaHeight', data.dmdCopyAreaHeight.toString());
  }
  if (data.smallGrillHeight > 0) {
    lines.push(`  <GrillHeight Value="${data.grillHeight}" Small="${data.smallGrillHeight}" />`);
  } else {
    lines.push(`  <GrillHeight Value="${data.grillHeight}" />`);
  }
  writeElement(lines, 'ProjectGUID', data.projectGUID);
  writeElement(lines, 'AssemblyGUID', data.assemblyGUID);
  writeElement(lines, 'VSName', data.vsName);
  writeElement(lines, 'DualBackglass', data.dualBackglass ? '1' : '0');
  writeElement(lines, 'Author', data.author);
  writeElement(lines, 'Artwork', data.artwork);
  writeElement(lines, 'GameName', data.gameName);
  writeElement(lines, 'AddEMDefaults', data.addEMDefaults ? '1' : '0');
  writeElement(lines, 'CommType', data.commType === 'B2S' ? '2' : '1');
  writeElement(lines, 'DestType', data.destType === 'Fantasy' ? '2' : '1');
  writeElement(lines, 'NumberOfPlayers', data.numberOfPlayers.toString());

  writeAnimations(lines, data.animations);
  writeScores(lines, data.scores);
  writeIllumination(lines, data.illumination);
  writeImages(lines, data.images);
  writeReels(lines, data.reels);

  lines.push('</DirectB2SData>');

  return lines.join('\n');
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function writeElement(lines: string[], name: string, value: string, indent = '  '): void {
  lines.push(`${indent}<${name} Value="${escapeXml(value)}" />`);
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
      return '2';
  }
}

function dmdTypeToValue(type: string): string {
  switch (type) {
    case 'BuiltIn':
      return '1';
    case 'External':
      return '2';
    default:
      return '0';
  }
}

function colorToString(color: Color): string {
  return `${color.r}.${color.g}.${color.b}`;
}

function writeAnimations(lines: string[], animations: Animation[]): void {
  if (animations.length === 0) return;

  lines.push('  <Animations>');
  for (const anim of animations) {
    const attrs = [
      `Name="${escapeXml(anim.name)}"`,
      `DualMode="${dualModeToValue(anim.dualMode)}"`,
      `Interval="${anim.interval}"`,
      `Loops="${anim.loops}"`,
      `IDJoin="${escapeXml(anim.idJoin)}"`,
    ];

    if (anim.startAnimationAtRomStart) attrs.push('StartAnimationAtRomStart="True"');
    if (anim.lightAtStart !== 'Off') attrs.push(`LightAtStart="${lightStateToValue(anim.lightAtStart)}"`);
    if (anim.lightAtEnd !== 'Off') attrs.push(`LightAtEnd="${lightStateToValue(anim.lightAtEnd)}"`);
    if (anim.animationStopBehaviour !== 'Immediate') {
      attrs.push(`AnimationStopBehaviour="${stopBehaviourToValue(anim.animationStopBehaviour)}"`);
    }
    if (anim.lockAtLastStep) attrs.push('LockAtLastStep="True"');
    if (anim.hideAtStart) attrs.push('HideAtStart="True"');
    if (anim.bringToFront) attrs.push('BringToFront="True"');
    if (anim.randomStart) attrs.push('RandomStart="True"');
    if (anim.randomQuality > 0) attrs.push(`RandomQuality="${anim.randomQuality}"`);

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

function lightStateToValue(state: string): string {
  switch (state) {
    case 'On':
      return '1';
    case 'NoChange':
      return '2';
    case 'Reset':
      return '3';
    default:
      return '0';
  }
}

function stopBehaviourToValue(behaviour: string): string {
  switch (behaviour) {
    case 'RunTillEnd':
      return '1';
    case 'ReturnToFirstStep':
      return '2';
    default:
      return '0';
  }
}

function writeScores(lines: string[], scores: ScoreInfo[]): void {
  if (scores.length === 0) return;

  lines.push('  <Scores>');
  for (const score of scores) {
    const litColor = score.reelLitColor || score.reelColor;
    const attrs = [
      `ID="${score.id}"`,
      `Parent="${score.parent}"`,
      `ReelType="${score.reelType}"`,
      `ReelLitColor="${colorToString(litColor)}"`,
    ];

    if (score.reelDarkColor) attrs.push(`ReelDarkColor="${colorToString(score.reelDarkColor)}"`);
    if (score.glow > 0) attrs.push(`Glow="${score.glow}"`);
    if (score.thickness > 0) attrs.push(`Thickness="${score.thickness}"`);
    if (score.shear > 0) attrs.push(`Shear="${score.shear}"`);
    attrs.push(`Digits="${score.digits}"`);
    attrs.push(`Spacing="${score.spacing}"`);
    attrs.push(`DisplayState="${score.displayState}"`);
    attrs.push(`LocX="${score.locX}"`);
    attrs.push(`LocY="${score.locY}"`);
    attrs.push(`Width="${score.width}"`);
    attrs.push(`Height="${score.height}"`);

    if (score.b2sStartDigit > 0) attrs.push(`B2SStartDigit="${score.b2sStartDigit}"`);
    if (score.b2sScoreType > 0) attrs.push(`B2SScoreType="${score.b2sScoreType}"`);
    if (score.b2sPlayerNo > 0) attrs.push(`B2SPlayerNo="${score.b2sPlayerNo}"`);
    if (!score.visible) attrs.push('Visible="0"');

    lines.push(`    <Score ${attrs.join(' ')} />`);
  }
  lines.push('  </Scores>');
}

function writeIllumination(lines: string[], bulbs: Bulb[]): void {
  if (bulbs.length === 0) return;

  lines.push('  <Illumination>');
  for (const bulb of bulbs) {
    const attrs = [
      `Parent="${bulb.parent}"`,
      `ID="${bulb.id}"`,
      `Name="${escapeXml(bulb.name)}"`,
      `RomID="${bulb.romId}"`,
      `RomIDType="${romIdTypeToValue(bulb.romIdType)}"`,
      `RomInverted="${bulb.romInverted ? '1' : '0'}"`,
      `InitialState="${initialStateToValue(bulb.initialState)}"`,
      `DualMode="${dualModeToValue(bulb.dualMode)}"`,
      `Intensity="${bulb.intensity}"`,
      `LightColor="${colorToString(bulb.lightColor)}"`,
      `DodgeColor="${bulb.dodgeColor ? colorToString(bulb.dodgeColor) : '0.0.0'}"`,
      `Visible="${bulb.visible ? '1' : '0'}"`,
      `LocX="${bulb.locX}"`,
      `LocY="${bulb.locY}"`,
      `Width="${bulb.width}"`,
      `Height="${bulb.height}"`,
      `IsImageSnippit="${bulb.isImageSnippet ? '1' : '0'}"`,
    ];

    if (bulb.imageData) attrs.push(`Image="${bulb.imageData}"`);
    if (bulb.b2sId > 0) attrs.push(`B2SID="${bulb.b2sId}"`);
    if (bulb.b2sIdType !== 'Straight') attrs.push(`B2SIDType="1"`);
    attrs.push(`Text="${escapeXml(bulb.text)}"`);
    attrs.push(`TextAlignment="${bulb.textAlignment}"`);
    attrs.push(`FontName="${escapeXml(bulb.fontName)}"`);
    attrs.push(`FontSize="${bulb.fontSize}"`);
    attrs.push(`FontStyle="${bulb.fontStyle}"`);
    if (bulb.snippetRotatingDirection !== 'None') {
      attrs.push(`SnippetRotatingDirection="${rotatingDirectionToValue(bulb.snippetRotatingDirection)}"`);
    }
    if (bulb.illuminationMode !== 'Standard') attrs.push('IlluminationMode="1"');
    if (bulb.zOrder > 0) attrs.push(`ZOrder="${bulb.zOrder}"`);

    lines.push(`    <Bulb ${attrs.join(' ')} />`);
  }
  lines.push('  </Illumination>');
}

function romIdTypeToValue(type: string): string {
  switch (type) {
    case 'Solenoid':
      return '2';
    case 'GIString':
      return '3';
    default:
      return '1';
  }
}

function rotatingDirectionToValue(dir: string): string {
  switch (dir) {
    case 'Clockwise':
      return '1';
    case 'CounterClockwise':
      return '2';
    default:
      return '0';
  }
}

function initialStateToValue(state: string): string {
  switch (state) {
    case 'On':
      return '1';
    case 'Undefined':
      return '2';
    default:
      return '0';
  }
}

function writeImages(lines: string[], images: DirectB2SData['images']): void {
  lines.push('  <Images>');

  if (images.thumbnailImage) {
    lines.push('    <ThumbnailImages>');
    lines.push(`      <MainImage Image="${images.thumbnailImage}" />`);
    lines.push('    </ThumbnailImages>');
  }

  if (images.backgroundImages.length > 0) {
    lines.push('    <BackgroundImages>');
    for (let i = 0; i < images.backgroundImages.length; i++) {
      const img = images.backgroundImages[i];
      const tag = i === 0 ? 'MainImage' : 'Image';
      const attrs = [
        `FileName="${escapeXml(img.fileName)}"`,
        `Image="${img.imageData}"`,
        `Type="${escapeXml(img.type || '0')}"`,
        `RomID="${img.romId}"`,
        `RomIDType="${romIdTypeToValue(img.romIdType)}"`,
      ];
      lines.push(`      <${tag} ${attrs.join(' ')} />`);
    }
    lines.push('    </BackgroundImages>');
  }

  if (images.illuminatedImages.length > 0) {
    lines.push('    <IlluminatedImages>');
    for (const img of images.illuminatedImages) {
      lines.push(`      <Image FileName="${escapeXml(img.fileName)}" Image="${img.imageData}" />`);
    }
    lines.push('    </IlluminatedImages>');
  }

  if (images.dmdImages.length > 0) {
    lines.push('    <DMDImages>');
    for (let i = 0; i < images.dmdImages.length; i++) {
      const img = images.dmdImages[i];
      const tag = i === 0 ? 'MainImage' : 'Image';
      lines.push(`      <${tag} FileName="${escapeXml(img.fileName)}" Image="${img.imageData}" />`);
    }
    lines.push('    </DMDImages>');
  }

  lines.push('  </Images>');
}

function writeReels(lines: string[], reels: DirectB2SData['reels']): void {
  if (reels.images.length === 0) return;

  const attrs = [
    `ReelCountOfIntermediates="${reels.countOfIntermediates}"`,
    `ReelRollingDirection="${reels.rollingDirection === 'Down' ? '1' : '0'}"`,
    `ReelRollingInterval="${reels.rollingInterval}"`,
  ];

  lines.push(`  <Reels ${attrs.join(' ')}>`);
  lines.push('    <Images>');

  for (const img of reels.images) {
    lines.push(
      `      <Image Name="${escapeXml(img.name)}" CountOfIntermediates="${img.countOfIntermediates}" Image="${img.imageData}" />`
    );
  }

  lines.push('    </Images>');
  lines.push('  </Reels>');
}
