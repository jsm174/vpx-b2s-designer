import { contextBridge, ipcRenderer } from 'electron';
import type { EditorSettings } from '../shared/component';

export interface SettingsAPI {
  onInit: (callback: (data: { settings: EditorSettings; theme: string }) => void) => void;
  onThemeChanged: (callback: (theme: string) => void) => void;
  save: (settings: EditorSettings) => void;
  previewTheme: (theme: string) => void;
  cancel: () => void;
}

const settingsAPI: SettingsAPI = {
  onInit: (callback): void => {
    ipcRenderer.on('init-settings', (_event, data) => callback(data));
  },
  onThemeChanged: (callback): void => {
    ipcRenderer.on('theme-changed', (_event, theme: string) => callback(theme));
  },
  save: (settings): void => {
    ipcRenderer.send('settings-save', settings);
  },
  previewTheme: (theme): void => {
    ipcRenderer.send('settings-preview-theme', theme);
  },
  cancel: (): void => {
    ipcRenderer.send('settings-cancel');
  },
};

contextBridge.exposeInMainWorld('settingsDialog', settingsAPI);
