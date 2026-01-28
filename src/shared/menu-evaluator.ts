import type { MenuItemSchema } from './menu-schema';
import type { MenuState } from './menu-state';
import { getStateValue } from './menu-state';

export interface EvaluationContext {
  platform: 'electron' | 'web';
  isMac: boolean;
}

export interface MenuItemState {
  enabled: boolean;
  checked: boolean;
  visible: boolean;
  label: string;
}

export function evaluateMenuItem(item: MenuItemSchema, state: MenuState, context: EvaluationContext): MenuItemState {
  let visible = true;
  if (item.macOnly && !context.isMac) visible = false;
  if (item.electronOnly && context.platform !== 'electron') visible = false;
  if (item.webOnly && context.platform !== 'web') visible = false;

  let enabled = true;
  if (item.requires) {
    for (const key of item.requires) {
      if (!getStateValue(state, key)) {
        enabled = false;
        break;
      }
    }
  }

  if (enabled && item.disabledWhen) {
    for (const key of item.disabledWhen) {
      if (getStateValue(state, key)) {
        enabled = false;
        break;
      }
    }
  }

  let checked = false;
  if (item.checkedWhen) {
    checked = getStateValue(state, item.checkedWhen);
  }

  const label = item.label || '';

  return { enabled, checked, visible, label };
}

export function filterMenuForPlatform(schema: MenuItemSchema[], context: EvaluationContext): MenuItemSchema[] {
  return schema
    .filter(item => {
      if (item.macOnly && !context.isMac) return false;
      if (item.electronOnly && context.platform !== 'electron') return false;
      if (item.webOnly && context.platform !== 'web') return false;
      return true;
    })
    .map(item => {
      if (item.submenu) {
        return { ...item, submenu: filterMenuForPlatform(item.submenu, context) };
      }
      return item;
    });
}
