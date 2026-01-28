import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import type { ResizeSettings } from '../shared/component';

export interface ResizeInitData {
  width: number;
  height: number;
  theme?: string;
}

export interface ResizeAPI {
  onInit: (callback: (data: ResizeInitData) => void) => void;
  onThemeChanged: (callback: (theme: string) => void) => void;
  resize: (settings: ResizeSettings) => void;
  close: () => void;
}

const resizeAPI: ResizeAPI = {
  onInit: (callback): void => {
    ipcRenderer.on('init-resize', (_event: IpcRendererEvent, data) => callback(data));
  },
  onThemeChanged: (callback): void => {
    ipcRenderer.on('theme-changed', (_event: IpcRendererEvent, theme: string) => callback(theme));
  },
  resize: (settings): void => {
    ipcRenderer.send('resize-result', settings);
  },
  close: (): void => {
    ipcRenderer.send('close-resize');
  },
};

contextBridge.exposeInMainWorld('resizeDialog', resizeAPI);
