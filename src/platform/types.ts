export interface Platform {
  capabilities: PlatformCapabilities;
  fileSystem: FileSystemProvider;
  dialogs: DialogProvider;
  storage: StorageProvider;

  init(): Promise<void>;
  getWorkDir(): string;
  getTempDir(): string;
  joinPath(...parts: string[]): string;
  dirname(path: string): string;
  basename(path: string, ext?: string): string;
}

export interface PlatformCapabilities {
  hasNativeMenus: boolean;
  hasNativeDialogs: boolean;
  hasNativeFileSystem: boolean;
  isOfflineCapable: boolean;
  platformName: 'electron' | 'web';
}

export interface FileSystemProvider {
  init?(): Promise<void>;
  readFile(path: string): Promise<string>;
  readBinaryFile(path: string): Promise<Uint8Array>;
  writeFile(path: string, content: string): Promise<void>;
  writeBinaryFile(path: string, content: Uint8Array): Promise<void>;
  deleteFile(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  listDir(path: string): Promise<string[]>;
  mkdir(path: string): Promise<void>;
}

export interface DialogProvider {
  showOpenDialog(options: OpenDialogOptions): Promise<OpenDialogResult | null>;
  showSaveDialog(options: SaveDialogOptions): Promise<SaveDialogResult | null>;
  showMessageBox(options: MessageBoxOptions): Promise<number>;
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
  content?: string;
  binaryContent?: Uint8Array;
}

export interface SaveDialogOptions {
  title?: string;
  filters?: FileFilter[];
  defaultPath?: string;
  content?: string;
  binaryContent?: Uint8Array;
}

export interface SaveDialogResult {
  filePath: string;
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

export interface StorageProvider {
  get<T>(key: string, defaultValue?: T): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
}
