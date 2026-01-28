import type { VpxB2SDesignerAPI, AppSettings, ConsoleSettings, PanelSettings } from '../types/api';
import { defaultSettings } from '../types/api';
import { WebStorageProvider } from '../platform/web/storage';

declare const __APP_VERSION__: string;
import { createWebMenuRenderer } from '../shared/menu-renderer-web';
import { createDefaultMenuState, type MenuState } from '../shared/menu-state';
import { applyTheme, watchSystemTheme } from '../shared/theme';
import { defaultEditorSettings, type EditorSettings } from '../features/settings/shared/component';
import { initWebSettings } from '../features/settings/web/component';
import '../features/settings/web/styles.css';
import { initWebAnimationEditor, type WebAnimationEditorInstance } from '../features/animations/web/component';
import type { Animation } from '../types/data';
import '../features/animations/shared/styles.css';
import '../features/animations/web/styles.css';
import '../features/about/web/styles.css';
import { initWebAbout } from '../features/about/web/component';

const fileOpenCallbacks: ((data: { path: string; content: string }) => void)[] = [];
const newFileCallbacks: (() => void)[] = [];
const saveRequestedCallbacks: (() => void)[] = [];
let isFileDirty = false;

let currentMenuState: MenuState = createDefaultMenuState();
let menuRenderer: ReturnType<typeof createWebMenuRenderer> | null = null;
let animationEditor: WebAnimationEditorInstance | null = null;
const storage = new WebStorageProvider();

const api: VpxB2SDesignerAPI = {
  async openFile(): Promise<{ path: string; content: string } | null> {
    if ('showOpenFilePicker' in window) {
      try {
        const [fileHandle] = await (
          window as Window & { showOpenFilePicker: (options?: object) => Promise<FileSystemFileHandle[]> }
        ).showOpenFilePicker({
          types: [
            {
              description: 'DirectB2S Files',
              accept: { 'application/xml': ['.directb2s'] },
            },
          ],
        });
        const file = await fileHandle.getFile();
        const content = await file.text();
        const result = { path: file.name, content };

        for (const callback of fileOpenCallbacks) {
          callback(result);
        }

        return result;
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Failed to open file:', err);
        }
        return null;
      }
    }

    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.directb2s';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (file) {
          const content = await file.text();
          const result = { path: file.name, content };
          for (const callback of fileOpenCallbacks) {
            callback(result);
          }
          resolve(result);
        } else {
          resolve(null);
        }
      };
      input.click();
    });
  },

  async saveFile(_path: string, content: string): Promise<boolean> {
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (
          window as Window & { showSaveFilePicker: (options?: object) => Promise<FileSystemFileHandle> }
        ).showSaveFilePicker({
          suggestedName: 'backglass.directb2s',
          types: [
            {
              description: 'DirectB2S Files',
              accept: { 'application/xml': ['.directb2s'] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
        return true;
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Failed to save file:', err);
        }
        return false;
      }
    }

    const blob = new Blob([content], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = _path || 'backglass.directb2s';
    a.click();
    URL.revokeObjectURL(url);
    return true;
  },

  async saveFileAs(content: string): Promise<{ path: string } | null> {
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (
          window as Window & { showSaveFilePicker: (options?: object) => Promise<FileSystemFileHandle> }
        ).showSaveFilePicker({
          suggestedName: 'backglass.directb2s',
          types: [
            {
              description: 'DirectB2S Files',
              accept: { 'application/xml': ['.directb2s'] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
        return { path: handle.name };
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Failed to save file:', err);
        }
        return null;
      }
    }

    const filename = 'backglass.directb2s';
    const blob = new Blob([content], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return { path: filename };
  },

  async showOpenDialog(options): Promise<{ filePath: string; binaryContent?: Uint8Array } | null> {
    if ('showOpenFilePicker' in window) {
      try {
        const [handle] = await (
          window as Window & { showOpenFilePicker: (options?: object) => Promise<FileSystemFileHandle[]> }
        ).showOpenFilePicker({
          types: options?.filters?.map((f: { name: string; extensions: string[] }) => ({
            description: f.name,
            accept: { 'application/octet-stream': f.extensions.map((e: string) => `.${e}`) },
          })),
        });
        const file = await handle.getFile();
        if (options?.readContents) {
          const buffer = await file.arrayBuffer();
          return { filePath: file.name, binaryContent: new Uint8Array(buffer) };
        }
        return { filePath: file.name };
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Failed to show open dialog:', err);
        }
        return null;
      }
    }

    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      if (options?.filters) {
        input.accept = options.filters
          .flatMap((f: { extensions: string[] }) => f.extensions.map((e: string) => `.${e}`))
          .join(',');
      }
      input.onchange = async () => {
        if (input.files && input.files.length > 0) {
          const file = input.files[0];
          if (options?.readContents) {
            const buffer = await file.arrayBuffer();
            resolve({ filePath: file.name, binaryContent: new Uint8Array(buffer) });
          } else {
            resolve({ filePath: file.name });
          }
        } else {
          resolve(null);
        }
      };
      input.click();
    });
  },

  async showSaveDialog(): Promise<string | null> {
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (
          window as Window & { showSaveFilePicker: (options?: object) => Promise<FileSystemFileHandle> }
        ).showSaveFilePicker();
        return handle.name;
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Failed to show save dialog:', err);
        }
        return null;
      }
    }

    return 'backglass.directb2s';
  },

  async showMessageBox(options): Promise<number> {
    if (options.buttons && options.buttons.length > 1) {
      return confirm(options.message) ? 0 : 1;
    }
    alert(options.message);
    return 0;
  },

  onFileOpened(callback: (data: { path: string; content: string }) => void): void {
    fileOpenCallbacks.push(callback);
  },

  onNewFile(callback: () => void): void {
    newFileCallbacks.push(callback);
  },

  onSaveRequested(callback: () => void): void {
    saveRequestedCallbacks.push(callback);
  },

  setDirty(dirty: boolean): void {
    isFileDirty = dirty;
    const baseTitle = 'VPX B2S Designer';
    document.title = dirty ? `VPX B2S Designer •` : baseTitle;
    updateMenuState({ isDirty: dirty });
  },

  setTitle(title: string): void {
    document.title = title;
  },

  async getSettings(): Promise<AppSettings> {
    return (await storage.get<AppSettings>('settings')) || { ...defaultSettings };
  },

  async saveSettings(settings: Partial<AppSettings>): Promise<void> {
    const current = await api.getSettings();
    await storage.set('settings', { ...current, ...settings });
  },

  async getPanelSettings(): Promise<PanelSettings> {
    return (await storage.get<PanelSettings>('panelSettings')) || {};
  },

  async savePanelSettings(settings: PanelSettings): Promise<void> {
    await storage.set('panelSettings', settings);
  },

  async getConsoleSettings(): Promise<ConsoleSettings> {
    return (await storage.get<ConsoleSettings>('consoleSettings')) || {};
  },

  async saveConsoleSettings(settings: ConsoleSettings): Promise<void> {
    const current = await api.getConsoleSettings();
    await storage.set('consoleSettings', { ...current, ...settings });
  },

  async getVersion(): Promise<string> {
    return __APP_VERSION__;
  },
};

(window as unknown as { vpxB2sDesignerAPI: VpxB2SDesignerAPI }).vpxB2sDesignerAPI = api;

export function updateMenuState(updates: Partial<MenuState>): void {
  currentMenuState = { ...currentMenuState, ...updates };
  if (menuRenderer) {
    menuRenderer.updateState(currentMenuState);
  }
}

let showAboutCallback: (() => void) | null = null;
let showSettingsCallback: (() => void) | null = null;

async function getEditorSettings(): Promise<EditorSettings> {
  const settings = await api.getSettings();
  return {
    theme: settings.theme || defaultEditorSettings.theme,
  };
}

function handleMenuAction(action: string): void {
  switch (action) {
    case 'new-file':
      for (const cb of newFileCallbacks) cb();
      break;
    case 'open-file':
      api.openFile();
      break;
    case 'save-file':
    case 'save-file-as':
      for (const cb of saveRequestedCallbacks) cb();
      break;
    case 'open-settings':
      showSettingsCallback?.();
      break;
    case 'show-about':
      showAboutCallback?.();
      break;
    case 'toggle-console':
      window.dispatchEvent(new CustomEvent('toggle-console'));
      break;
    case 'close-file':
      handleCloseFile();
      break;
    default:
      window.dispatchEvent(new CustomEvent('menu-action', { detail: action }));
  }
}

function setupMenu(): void {
  const menuDropdown = document.getElementById('menu-dropdown');
  const hamburgerBtn = document.getElementById('hamburger-btn');

  if (!menuDropdown || !hamburgerBtn) return;

  menuRenderer = createWebMenuRenderer({
    onAction: handleMenuAction,
  });

  menuRenderer.render(menuDropdown);
  menuRenderer.updateState(currentMenuState);

  hamburgerBtn.addEventListener('click', e => {
    e.stopPropagation();
    menuDropdown.classList.toggle('show');
  });

  document.addEventListener('click', () => {
    menuDropdown.classList.remove('show');
    menuDropdown.querySelectorAll('.menu-submenu.expanded').forEach(el => {
      el.classList.remove('expanded');
    });
  });
}

function setupModals(): void {
  window.addEventListener('show-settings-dialog', () => {
    showSettingsCallback?.();
  });
}

function handleCloseFile(): void {
  if (isFileDirty) {
    const confirmed = confirm('You have unsaved changes. Are you sure you want to close?');
    if (!confirmed) return;
  }

  window.dispatchEvent(new CustomEvent('close-file'));
  isFileDirty = false;
  updateMenuState({ isDirty: false, hasFile: false });
}

function setupAnimationEditor(): void {
  animationEditor = initWebAnimationEditor({
    onSave: (animation: Animation, isNew: boolean) => {
      window.dispatchEvent(new CustomEvent('animation-saved', { detail: { animation, isNew } }));
    },
    onDelete: (name: string) => {
      window.dispatchEvent(new CustomEvent('animation-deleted', { detail: { name } }));
    },
  });

  window.addEventListener('open-animation-editor', ((e: CustomEvent) => {
    const { animation } = e.detail || {};
    animationEditor?.open(animation || null);
  }) as EventListener);
}

function setupMenuStateListener(): void {
  window.addEventListener('update-menu-state', ((e: CustomEvent) => {
    updateMenuState(e.detail);
  }) as EventListener);
}

async function initWeb(): Promise<void> {
  const settings = await getEditorSettings();
  applyTheme(settings.theme);

  currentMenuState = createDefaultMenuState();

  setupMenu();
  setupModals();
  setupAnimationEditor();
  setupMenuStateListener();

  initWebSettings({
    getSettings: getEditorSettings,
    saveSettings: async (s: EditorSettings) => {
      await api.saveSettings({ theme: s.theme as 'system' | 'dark' | 'light' });
    },
    applyTheme,
    onShowSettings: callback => {
      showSettingsCallback = callback;
    },
  });

  initWebAbout({
    getVersion: () => api.getVersion?.() ?? Promise.resolve('0.0.1'),
    onShowAbout: callback => {
      showAboutCallback = callback;
    },
  });

  watchSystemTheme(async () => {
    const currentSettings = await getEditorSettings();
    if (currentSettings.theme === 'system') {
      applyTheme('system');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initWeb();
  import('../editor/main');
});
