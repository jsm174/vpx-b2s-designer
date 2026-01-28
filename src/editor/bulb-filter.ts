import type { Bulb, CommType } from '../types/data';

export function romInfoToString(bulb: Pick<Bulb, 'romId' | 'romIdType' | 'romInverted'>): string {
  if (bulb.romId > 0 && bulb.romIdType !== 'NotUsed') {
    let ret = bulb.romInverted ? 'I' : '';
    switch (bulb.romIdType) {
      case 'Solenoid':
        ret += 'S';
        break;
      case 'GIString':
        ret += 'GI';
        break;
      default:
        ret += 'L';
    }
    return ret + bulb.romId;
  }
  return '';
}

export function b2sInfoToString(bulb: Pick<Bulb, 'b2sId'>): string {
  return bulb.b2sId > 0 ? String(bulb.b2sId) : '';
}

export function bulbPassesFilter(bulb: Bulb, filter: string, commType: CommType): boolean {
  if (!filter) return true;
  if (filter === romInfoToString(bulb)) return true;
  if (filter === b2sInfoToString(bulb)) return true;
  switch (filter) {
    case 'withoutid':
      return commType === 'B2S' ? b2sInfoToString(bulb) === '' : romInfoToString(bulb) === '';
    case 'withname':
      return !!bulb.name;
    case 'off':
      return bulb.initialState === 'Off';
    case 'on':
      return bulb.initialState === 'On';
    case 'alwayson':
      return bulb.initialState === 'AlwaysOn';
    case 'authentic':
      return bulb.dualMode !== 'Fantasy';
    case 'fantasy':
      return bulb.dualMode !== 'Authentic';
    default:
      return false;
  }
}

export interface FilterPrefill {
  initialState?: Bulb['initialState'];
  dualMode?: Bulb['dualMode'];
  romIdType?: Bulb['romIdType'];
  romId?: number;
  romInverted?: boolean;
  b2sId?: number;
  b2sIdType?: number;
}

export function prefillFromFilter(filter: string): FilterPrefill {
  const out: FilterPrefill = {};
  if (!filter) return out;
  switch (filter) {
    case 'off':
      out.initialState = 'Off';
      return out;
    case 'on':
      out.initialState = 'On';
      return out;
    case 'alwayson':
      out.initialState = 'AlwaysOn';
      return out;
    case 'authentic':
      out.dualMode = 'Authentic';
      return out;
    case 'fantasy':
      out.dualMode = 'Fantasy';
      return out;
    case 'withoutid':
    case 'withname':
      return out;
  }
  const rom = /^(I?)(L|S|GI)(\d+)$/.exec(filter);
  if (rom) {
    out.romInverted = rom[1] === 'I';
    out.romIdType = rom[2] === 'S' ? 'Solenoid' : rom[2] === 'GI' ? 'GIString' : 'Lamp';
    out.romId = parseInt(rom[3], 10);
    return out;
  }
  const n = parseInt(filter, 10);
  if (!Number.isNaN(n)) {
    out.b2sId = n;
    const map: Record<number, number> = {
      25: 1,
      26: 2,
      27: 3,
      28: 4,
      30: 5,
      31: 6,
      32: 7,
      33: 8,
      34: 9,
      35: 10,
      36: 11,
    };
    out.b2sIdType = map[n] ?? 0;
  }
  return out;
}
