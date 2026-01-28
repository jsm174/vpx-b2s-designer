import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import type { Animation } from '../../../types/data';

export interface AnimationEditorAPI {
  onInit: (callback: (data: { animation: Animation | null; isNew: boolean; theme?: string }) => void) => void;
  onThemeChanged: (callback: (theme: string) => void) => void;
  saveAnimation: (animation: Animation, isNew: boolean) => Promise<void>;
  deleteAnimation: (name: string) => Promise<void>;
  close: () => void;
}

const animationEditorAPI: AnimationEditorAPI = {
  onInit: (callback): void => {
    ipcRenderer.on('init-animation-editor', (_event: IpcRendererEvent, data) => callback(data));
  },
  onThemeChanged: (callback): void => {
    ipcRenderer.on('theme-changed', (_event: IpcRendererEvent, theme: string) => callback(theme));
  },
  saveAnimation: (animation, isNew): Promise<void> => ipcRenderer.invoke('save-animation', animation, isNew),
  deleteAnimation: (name): Promise<void> => ipcRenderer.invoke('delete-animation', name),
  close: (): void => {
    ipcRenderer.send('close-animation-editor');
  },
};

contextBridge.exposeInMainWorld('animationEditor', animationEditorAPI);
