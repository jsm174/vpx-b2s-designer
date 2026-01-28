import type { Animation, AnimationStep } from '../types/data';
import { createDefaultAnimation } from '../types/data';
import { escapeXml } from '../format/writer';

function safeInt(value: string | null | undefined, def: number): number {
  if (value === null || value === undefined) return def;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? def : n;
}

function safeBool(value: string | null | undefined, def: boolean): boolean {
  if (value === null || value === undefined) return def;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? def : n === 1;
}

export function importAnimationsXml(xml: string): Animation[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error('The file is not valid XML.');
  }
  const root = doc.documentElement;
  if (!root || root.tagName !== 'Animations') {
    throw new Error('The file does not have a valid <Animations> root element.');
  }
  const result: Animation[] = [];
  for (const node of Array.from(root.children)) {
    if (node.tagName !== 'Animation') continue;
    const anim = createDefaultAnimation(node.getAttribute('Name') || '');
    anim.dualMode = (['Both', 'Authentic', 'Fantasy'] as const)[safeInt(node.getAttribute('DualMode'), 0)] || 'Both';
    anim.interval = safeInt(node.getAttribute('Interval'), 0);
    anim.loops = safeInt(node.getAttribute('Loops'), 0);
    anim.idJoin = node.getAttribute('IDJoin') || '';
    anim.startAnimationAtBackglassStartup = safeBool(node.getAttribute('StartAnimationAtBackglassStartup'), false);
    anim.lightsStateAtAnimationStart = safeInt(node.getAttribute('LightsStateAtAnimationStart'), 0);
    anim.lightsStateAtAnimationEnd = safeInt(node.getAttribute('LightsStateAtAnimationEnd'), 0);
    anim.animationStopBehaviour = safeInt(node.getAttribute('AnimationStopBehaviour'), 0);
    anim.lockInvolvedLamps = safeBool(node.getAttribute('LockInvolvedLamps'), false);
    anim.hideScoreDisplays = safeBool(node.getAttribute('HideScoreDisplays'), false);
    anim.bringToFront = safeBool(node.getAttribute('BringToFront'), false);
    anim.randomStart = safeBool(node.getAttribute('RandomStart'), false);
    anim.randomQuality = safeInt(node.getAttribute('RandomQuality'), 1);
    anim.steps = [];
    for (const stepNode of Array.from(node.children)) {
      if (stepNode.tagName !== 'AnimationStep') continue;
      const step: AnimationStep = {
        step: safeInt(stepNode.getAttribute('Step'), 0),
        on: stepNode.getAttribute('On') || '',
        waitLoopsAfterOn: safeInt(stepNode.getAttribute('WaitLoopsAfterOn'), 0),
        off: stepNode.getAttribute('Off') || '',
        waitLoopsAfterOff: safeInt(stepNode.getAttribute('WaitLoopsAfterOff'), 0),
        pulseSwitch: 0,
      };
      anim.steps.push(step);
    }
    result.push(anim);
  }
  return result;
}

export function exportAnimationXml(anim: Animation): string {
  const dualMode = anim.dualMode === 'Authentic' ? 1 : anim.dualMode === 'Fantasy' ? 2 : 0;
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="utf-8"?>');
  lines.push('<Animations>');
  const attrs = [
    `Name="${escapeXml(anim.name)}"`,
    `DualMode="${dualMode}"`,
    `Interval="${anim.interval}"`,
    `Loops="${anim.loops}"`,
    `IDJoin="${escapeXml(anim.idJoin || '')}"`,
    `StartAnimationAtBackglassStartup="${anim.startAnimationAtBackglassStartup ? 1 : 0}"`,
    `LightsStateAtAnimationStart="${anim.lightsStateAtAnimationStart}"`,
    `LightsStateAtAnimationEnd="${anim.lightsStateAtAnimationEnd}"`,
    `AnimationStopBehaviour="${anim.animationStopBehaviour}"`,
    `LockInvolvedLamps="${anim.lockInvolvedLamps ? 1 : 0}"`,
    `HideScoreDisplays="${anim.hideScoreDisplays ? 1 : 0}"`,
    `BringToFront="${anim.bringToFront ? 1 : 0}"`,
    `RandomStart="${anim.randomStart ? 1 : 0}"`,
    `RandomQuality="${anim.randomQuality}"`,
  ];
  lines.push(`  <Animation ${attrs.join(' ')}>`);
  for (const step of anim.steps) {
    const stepAttrs = [
      `Step="${step.step}"`,
      `On="${escapeXml(step.on)}"`,
      `WaitLoopsAfterOn="${step.waitLoopsAfterOn}"`,
      `Off="${escapeXml(step.off)}"`,
      `WaitLoopsAfterOff="${step.waitLoopsAfterOff}"`,
    ];
    lines.push(`    <AnimationStep ${stepAttrs.join(' ')} />`);
  }
  lines.push('  </Animation>');
  lines.push('</Animations>');
  return lines.join('\n');
}
