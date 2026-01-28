import { Menu, MenuItemConstructorOptions } from 'electron';
import { menuSchema, type MenuItemSchema } from './menu-schema';
import { evaluateMenuItem, filterMenuForPlatform, type EvaluationContext } from './menu-evaluator';
import type { MenuState } from './menu-state';

export interface ElectronMenuContext {
  getMenuState: () => MenuState;
  handleAction: (action: string) => void;
  getRecentFiles: () => string[];
  openRecentFile: (path: string) => void;
  clearRecentFiles: () => void;
  showAboutDialog: () => void;
  showSettings: () => void;
  appName: string;
}

function convertSchemaItem(
  item: MenuItemSchema,
  state: MenuState,
  context: EvaluationContext,
  menuContext: ElectronMenuContext
): MenuItemConstructorOptions | null {
  if (item.role) {
    const result: MenuItemConstructorOptions = { role: item.role as MenuItemConstructorOptions['role'] };
    if (item.label) result.label = item.label;
    return result;
  }

  if (item.type === 'separator') {
    return { type: 'separator' };
  }

  const itemState = evaluateMenuItem(item, state, context);
  if (!itemState.visible) return null;

  const result: MenuItemConstructorOptions = {};

  if (item.id) result.id = item.id;
  result.label = itemState.label || item.label;

  if (item.type === 'checkbox') {
    result.type = 'checkbox';
    result.checked = itemState.checked;
  }

  if (item.accelerator) {
    result.accelerator = item.accelerator;
  }

  result.enabled = itemState.enabled;

  if (item.action) {
    if (item.action === 'show-about') {
      result.click = () => menuContext.showAboutDialog();
    } else if (item.action === 'open-settings') {
      result.click = () => menuContext.showSettings();
    } else {
      result.click = () => menuContext.handleAction(item.action!);
    }
  }

  if (item.submenu && item.submenu.length > 0) {
    const submenuItems: MenuItemConstructorOptions[] = [];
    for (const subItem of item.submenu) {
      const converted = convertSchemaItem(subItem, state, context, menuContext);
      if (converted) {
        submenuItems.push(converted);
      }
    }
    if (submenuItems.length > 0) {
      result.submenu = submenuItems;
    }
  }

  return result;
}

function buildRecentFilesSubmenu(menuContext: ElectronMenuContext): MenuItemConstructorOptions[] {
  const recentFiles = menuContext.getRecentFiles();
  if (recentFiles.length === 0) {
    return [{ label: 'No Recent Files', enabled: false }];
  }

  return [
    ...recentFiles.map((filePath, index) => ({
      label: `${index + 1}. ${filePath.split('/').pop() || filePath.split('\\').pop() || filePath}`,
      click: () => menuContext.openRecentFile(filePath),
    })),
    { type: 'separator' as const },
    {
      label: 'Clear Recents',
      click: () => menuContext.clearRecentFiles(),
    },
  ];
}

function injectRecentFilesSubmenu(
  items: MenuItemConstructorOptions[],
  menuContext: ElectronMenuContext
): MenuItemConstructorOptions[] {
  return items.map(item => {
    if (item.id === 'open' && item.submenu === undefined) {
      return item;
    }

    if (item.submenu && Array.isArray(item.submenu)) {
      const hasOpenItem = item.submenu.some((sub: MenuItemConstructorOptions) => sub.id === 'open');
      if (hasOpenItem) {
        const newSubmenu: MenuItemConstructorOptions[] = [];
        for (const sub of item.submenu as MenuItemConstructorOptions[]) {
          newSubmenu.push(sub);
          if (sub.id === 'open') {
            newSubmenu.push({
              id: 'open-recent',
              label: 'Open Recent',
              submenu: buildRecentFilesSubmenu(menuContext),
            });
          }
        }
        return { ...item, submenu: newSubmenu };
      }
      return { ...item, submenu: injectRecentFilesSubmenu(item.submenu as MenuItemConstructorOptions[], menuContext) };
    }

    return item;
  });
}

export function createElectronMenu(menuContext: ElectronMenuContext): Menu {
  const isMac = process.platform === 'darwin';
  const context: EvaluationContext = { platform: 'electron', isMac };
  const filteredSchema = filterMenuForPlatform(menuSchema, context);
  const state = menuContext.getMenuState();

  let template: MenuItemConstructorOptions[] = [];

  if (isMac) {
    template.push({
      label: menuContext.appName,
      submenu: [
        { label: 'About ' + menuContext.appName, click: () => menuContext.showAboutDialog() },
        { type: 'separator' },
        { label: 'Settings...', accelerator: 'Cmd+,', click: () => menuContext.showSettings() },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    });
  }

  for (const item of filteredSchema) {
    const converted = convertSchemaItem(item, state, context, menuContext);
    if (converted) {
      template.push(converted);
    }
  }

  template = injectRecentFilesSubmenu(template, menuContext);

  return Menu.buildFromTemplate(template);
}

export function setApplicationMenu(menuContext: ElectronMenuContext): void {
  const menu = createElectronMenu(menuContext);
  Menu.setApplicationMenu(menu);
}
