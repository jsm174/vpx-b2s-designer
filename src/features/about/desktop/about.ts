import { contextBridge, ipcRenderer } from 'electron';

export interface AboutAPI {
  onInit: (callback: (data: { version: string; platform: string }) => void) => void;
  close: () => void;
}

const aboutAPI: AboutAPI = {
  onInit: (callback): void => {
    ipcRenderer.on('init-about', (_event, data) => callback(data));
  },
  close: (): void => {
    window.close();
  },
};

contextBridge.exposeInMainWorld('aboutDialog', aboutAPI);
