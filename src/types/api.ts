export interface VpxB2SDesignerAPI {
  openFile(): Promise<{ path: string; content: string } | null>;
  saveFile(path: string, content: string): Promise<boolean>;
  saveFileAs(content: string): Promise<{ path: string } | null>;

  showOpenDialog(options: OpenDialogOptions): Promise<OpenDialogResult | null>;
  showSaveDialog(options: SaveDialogOptions): Promise<string | null>;
  showMessageBox(options: MessageBoxOptions): Promise<number>;

  onFileOpened(callback: (data: { path: string; content: string }) => void): void;
  onNewFile(callback: () => void): void;
  onSaveRequested(callback: () => void): void;
  onSaveBeforeClose?(callback: () => void): void;
  closeAfterSave?(): void;

  setDirty(dirty: boolean): void;
  setTitle(title: string): void;

  getSettings(): Promise<AppSettings>;
  saveSettings(settings: Partial<AppSettings>): Promise<void>;

  getPanelSettings(): Promise<PanelSettings>;
  savePanelSettings(settings: PanelSettings): Promise<void>;

  getConsoleSettings(): Promise<ConsoleSettings>;
  saveConsoleSettings(settings: ConsoleSettings): Promise<void>;

  onShowSettings?(callback: () => void): void;
  onShowAbout?(callback: () => void): void;
  showAbout?(): Promise<void>;
  getTheme?(): Promise<'dark' | 'light'>;

  getVersion?(): Promise<string>;
}

export interface ConsoleSettings {
  visible?: boolean;
  height?: number;
}

export interface OpenDialogOptions {
  title?: string;
  filters?: FileFilter[];
  defaultPath?: string;
  multiSelections?: boolean;
  readContents?: boolean;
}

export interface OpenDialogResult {
  filePath: string;
  binaryContent?: Uint8Array;
}

export interface SaveDialogOptions {
  title?: string;
  filters?: FileFilter[];
  defaultPath?: string;
}

export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface MessageBoxOptions {
  type?: 'none' | 'info' | 'error' | 'question' | 'warning';
  title?: string;
  message: string;
  detail?: string;
  buttons?: string[];
  defaultId?: number;
}

export interface PanelSettings {
  leftPanelWidth?: number;
  rightPanelWidth?: number;
  sectionHeights?: Record<string, number>;
}

export interface AppSettings {
  recentFiles: string[];
  windowBounds?: { x: number; y: number; width: number; height: number };
  theme: 'system' | 'dark' | 'light';
  showScoreFrames?: boolean;
}

export const defaultSettings: AppSettings = {
  recentFiles: [],
  theme: 'system',
  showScoreFrames: true,
};

declare global {
  interface Window {
    vpxB2sDesignerAPI: VpxB2SDesignerAPI;
  }
}
