import { contextBridge, ipcRenderer } from 'electron';
import type {
  VpxB2SDesignerAPI,
  OpenDialogOptions,
  SaveDialogOptions,
  MessageBoxOptions,
  AppSettings,
  ConsoleSettings,
} from '../types/api';
import { defaultSettings } from '../types/api';

const api: VpxB2SDesignerAPI = {
  openFile: () => ipcRenderer.invoke('open-file'),

  saveFile: (path: string, content: string) => ipcRenderer.invoke('save-file', path, content),

  saveFileAs: (content: string) => ipcRenderer.invoke('save-file-as', content),

  showOpenDialog: (options: OpenDialogOptions) => ipcRenderer.invoke('show-open-dialog', options),

  showSaveDialog: (options: SaveDialogOptions) => ipcRenderer.invoke('show-save-dialog', options),

  showMessageBox: (options: MessageBoxOptions) => ipcRenderer.invoke('show-message-box', options),

  onFileOpened: (callback: (data: { path: string; content: string }) => void) => {
    ipcRenderer.on('file-opened', (_event, data) => callback(data));
  },

  onNewFile: (callback: () => void) => {
    ipcRenderer.on('new-file', () => callback());
  },

  onSaveRequested: (callback: () => void) => {
    ipcRenderer.on('save-requested', () => callback());
  },

  onSaveBeforeClose: (callback: () => void) => {
    ipcRenderer.on('save-before-close', () => callback());
  },

  closeAfterSave: () => {
    ipcRenderer.send('close-after-save');
  },

  setDirty: (dirty: boolean) => {
    ipcRenderer.send('set-dirty', dirty);
  },

  setTitle: (title: string) => {
    ipcRenderer.send('set-title', title);
  },

  getSettings: async (): Promise<AppSettings> => {
    const settings = await ipcRenderer.invoke('get-settings');
    return { ...defaultSettings, ...settings };
  },

  saveSettings: async (settings: Partial<AppSettings>): Promise<void> => {
    await ipcRenderer.invoke('save-settings', settings);
  },

  getPanelSettings: () => ipcRenderer.invoke('get-panel-settings'),

  savePanelSettings: (settings: Record<string, unknown>) => ipcRenderer.invoke('save-panel-settings', settings),

  getConsoleSettings: () => ipcRenderer.invoke('get-console-settings'),

  saveConsoleSettings: (settings: ConsoleSettings) => ipcRenderer.invoke('save-console-settings', settings),
};

interface ResizeSettings {
  originalWidth: number;
  originalHeight: number;
  newWidth: number;
  newHeight: number;
}

interface BrightnessSettings {
  brightness: number;
  ignoreGrill: boolean;
}

interface BrightnessInitData {
  imageData: string;
  width: number;
  height: number;
  grillHeight: number;
  isDmd: boolean;
}

interface ExtendedAPI extends VpxB2SDesignerAPI {
  onShowSettings: (callback: () => void) => void;
  onShowAbout: (callback: () => void) => void;
  showAbout: () => Promise<void>;
  getTheme: () => Promise<'dark' | 'light'>;
  onThemeChanged: (callback: (theme: string) => void) => void;
  openAnimationEditor: (animation: unknown, isNew: boolean) => void;
  onAnimationSaved: (callback: (data: { animation: unknown; isNew: boolean }) => void) => void;
  onAnimationDeleted: (callback: (data: { name: string }) => void) => void;
  openResize: (width: number, height: number) => void;
  onResizeResult: (callback: (settings: ResizeSettings) => void) => void;
  openBrightness: (data: BrightnessInitData) => void;
  onBrightnessResult: (callback: (settings: BrightnessSettings) => void) => void;
  getPendingFile: () => Promise<{ path: string; content: string } | null>;
  getPendingNewFile: () => Promise<boolean>;
  onFileReady: (callback: () => void) => void;
  getVersion: () => Promise<string>;
  onToggleConsole: (callback: () => void) => void;
  onMenuAction: (callback: (action: string) => void) => void;
  onSetInputDisabled: (callback: (disabled: boolean) => void) => void;
}

const extendedApi: ExtendedAPI = {
  ...api,

  onShowSettings: (callback: () => void) => {
    ipcRenderer.on('show-settings', () => callback());
  },

  onShowAbout: (callback: () => void) => {
    ipcRenderer.on('show-about', () => callback());
  },

  showAbout: () => ipcRenderer.invoke('show-about'),

  getTheme: () => ipcRenderer.invoke('get-theme'),

  onThemeChanged: (callback: (theme: string) => void) => {
    ipcRenderer.on('theme-changed', (_event, theme: string) => callback(theme));
  },

  openAnimationEditor: (animation: unknown, isNew: boolean) => {
    ipcRenderer.send('open-animation-editor', animation, isNew);
  },

  onAnimationSaved: (callback: (data: { animation: unknown; isNew: boolean }) => void) => {
    ipcRenderer.on('animation-saved', (_event, data) => callback(data));
  },

  onAnimationDeleted: (callback: (data: { name: string }) => void) => {
    ipcRenderer.on('animation-deleted', (_event, data) => callback(data));
  },

  openResize: (width: number, height: number) => {
    ipcRenderer.send('open-resize', width, height);
  },

  onResizeResult: (callback: (settings: ResizeSettings) => void) => {
    ipcRenderer.on('resize-result', (_event, settings) => callback(settings));
  },

  openBrightness: (data: BrightnessInitData) => {
    ipcRenderer.send('open-brightness', data);
  },

  onBrightnessResult: (callback: (settings: BrightnessSettings) => void) => {
    ipcRenderer.on('brightness-result', (_event, settings) => callback(settings));
  },

  getPendingFile: () => ipcRenderer.invoke('get-pending-file'),
  getPendingNewFile: () => ipcRenderer.invoke('get-pending-new-file'),

  onFileReady: (callback: () => void) => {
    ipcRenderer.on('file-ready', () => callback());
  },

  getVersion: () => ipcRenderer.invoke('get-version'),

  onToggleConsole: (callback: () => void) => {
    ipcRenderer.on('toggle-console', () => callback());
  },

  onMenuAction: (callback: (action: string) => void) => {
    ipcRenderer.on('menu-action', (_event, action) => callback(action));
  },

  onSetInputDisabled: (callback: (disabled: boolean) => void) => {
    ipcRenderer.on('set-input-disabled', (_event, disabled) => callback(disabled));
  },
};

contextBridge.exposeInMainWorld('vpxB2sDesignerAPI', extendedApi);

window.addEventListener('update-menu-state', ((event: CustomEvent) => {
  ipcRenderer.send('update-menu-state', event.detail);
}) as EventListener);
