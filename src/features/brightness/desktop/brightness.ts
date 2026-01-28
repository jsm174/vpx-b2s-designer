import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import type { BrightnessSettings } from '../shared/component';

export interface BrightnessInitData {
  imageData: string;
  width: number;
  height: number;
  grillHeight: number;
  isDmd: boolean;
  theme?: string;
}

export interface BrightnessAPI {
  onInit: (callback: (data: BrightnessInitData) => void) => void;
  onThemeChanged: (callback: (theme: string) => void) => void;
  apply: (settings: BrightnessSettings) => void;
  close: () => void;
}

const brightnessAPI: BrightnessAPI = {
  onInit: (callback): void => {
    ipcRenderer.on('init-brightness', (_event: IpcRendererEvent, data) => callback(data));
  },
  onThemeChanged: (callback): void => {
    ipcRenderer.on('theme-changed', (_event: IpcRendererEvent, theme: string) => callback(theme));
  },
  apply: (settings): void => {
    ipcRenderer.send('brightness-result', settings);
  },
  close: (): void => {
    ipcRenderer.send('close-brightness');
  },
};

contextBridge.exposeInMainWorld('brightnessDialog', brightnessAPI);
