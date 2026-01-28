import type { Platform, PlatformCapabilities } from '../types';
import { ElectronFileSystem } from './file-system';
import { ElectronDialogProvider } from './dialogs';
import { ElectronStorageProvider } from './storage';

class ElectronPlatform implements Platform {
  capabilities: PlatformCapabilities = {
    hasNativeMenus: true,
    hasNativeDialogs: true,
    hasNativeFileSystem: true,
    isOfflineCapable: true,
    platformName: 'electron',
  };

  fileSystem = new ElectronFileSystem();
  dialogs = new ElectronDialogProvider();
  storage = new ElectronStorageProvider();

  private _workDir = '';
  private _tempDir = '';

  async init(): Promise<void> {
    const api = this.getApi();
    if (api?.getWorkDir) {
      this._workDir = await api.getWorkDir();
    }
    if (api?.getTempDir) {
      this._tempDir = await api.getTempDir();
    }
    console.log('Electron platform initialized');
  }

  private getApi() {
    if (typeof window !== 'undefined' && (window as unknown as { vpxB2sDesignerAPI?: unknown }).vpxB2sDesignerAPI) {
      return (window as unknown as { vpxB2sDesignerAPI: ElectronAPI }).vpxB2sDesignerAPI;
    }
    return null;
  }

  getWorkDir(): string {
    return this._workDir || process.cwd?.() || '/';
  }

  getTempDir(): string {
    return this._tempDir || '/tmp';
  }

  joinPath(...parts: string[]): string {
    const sep = process.platform === 'win32' ? '\\' : '/';
    return parts.join(sep).replace(/[/\\]+/g, sep);
  }

  dirname(path: string): string {
    const sep = path.includes('\\') ? '\\' : '/';
    const parts = path.split(sep);
    parts.pop();
    return parts.join(sep) || sep;
  }

  basename(path: string, ext?: string): string {
    const sep = path.includes('\\') ? '\\' : '/';
    const parts = path.split(sep);
    let name = parts.pop() || '';
    if (ext && name.endsWith(ext)) {
      name = name.slice(0, -ext.length);
    }
    return name;
  }
}

interface ElectronAPI {
  getWorkDir?(): Promise<string>;
  getTempDir?(): Promise<string>;
}

export function createElectronPlatform(): Platform {
  return new ElectronPlatform();
}
