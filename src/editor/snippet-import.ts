import type { Bulb, RomIdType } from '../types/data';
import { createDefaultBulb } from '../types/data';

export interface RomInfoFromName {
  romId: number;
  romIdType: RomIdType;
  romInverted: boolean;
}

export function romInfoFromSnippetName(name: string): RomInfoFromName {
  const result: RomInfoFromName = { romId: 0, romIdType: 'NotUsed', romInverted: false };
  const m = /^(.*?)(\d+)$/.exec(name);
  if (!m) return result;
  result.romId = parseInt(m[2], 10) || 0;
  const prefix = m[1];
  if (prefix.endsWith('L')) {
    result.romIdType = 'Lamp';
    result.romInverted = prefix.endsWith('iL');
  } else if (prefix.endsWith('S')) {
    result.romIdType = 'Solenoid';
    result.romInverted = prefix.endsWith('iS');
  } else if (prefix.endsWith('Gi')) {
    result.romIdType = 'GIString';
    result.romInverted = prefix.endsWith('iGi');
  }
  return result;
}

export function fileBaseName(path: string): string {
  const name = path.split(/[\\/]/).pop() || path;
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.substring(0, dot) : name;
}

export function createSnippetBulb(
  id: number,
  name: string,
  base64: string,
  width: number,
  height: number,
  locX: number,
  locY: number,
  parent: 'Backglass' | 'DMD'
): Bulb {
  const rom = romInfoFromSnippetName(name);
  return {
    ...createDefaultBulb(id),
    name,
    parent,
    locX: Math.round(locX),
    locY: Math.round(locY),
    width,
    height,
    isImageSnippet: true,
    imageData: base64,
    romId: rom.romId,
    romIdType: rom.romIdType,
    romInverted: rom.romInverted,
  };
}
