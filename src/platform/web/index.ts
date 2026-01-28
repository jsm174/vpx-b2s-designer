import type { Platform, PlatformCapabilities } from '../types';
import { OpfsFileSystem } from './file-system';
import { WebDialogProvider } from './dialogs';
import { WebStorageProvider } from './storage';

class WebPlatform implements Platform {
  capabilities: PlatformCapabilities = {
    hasNativeMenus: false,
    hasNativeDialogs: false,
    hasNativeFileSystem: false,
    isOfflineCapable: true,
    platformName: 'web',
  };

  fileSystem = new OpfsFileSystem();
  dialogs = new WebDialogProvider();
  storage = new WebStorageProvider();

  private _workDir = '/b2s-work';
  private _tempDir = '/tmp';

  async init(): Promise<void> {
    try {
      await this.fileSystem.init?.();
      await this.fileSystem.mkdir(this._workDir);
      await this.fileSystem.mkdir(this._tempDir);
    } catch (e) {
      console.warn('OPFS initialization failed, some features may not work:', e);
    }
    console.log('Web platform initialized');
  }

  getWorkDir(): string {
    return this._workDir;
  }

  getTempDir(): string {
    return this._tempDir;
  }

  joinPath(...parts: string[]): string {
    return parts.join('/').replace(/\/+/g, '/');
  }

  dirname(path: string): string {
    const parts = path.split('/');
    parts.pop();
    return parts.join('/') || '/';
  }

  basename(path: string, ext?: string): string {
    const parts = path.split('/');
    let name = parts.pop() || '';
    if (ext && name.endsWith(ext)) {
      name = name.slice(0, -ext.length);
    }
    return name;
  }
}

export function createWebPlatform(): Platform {
  return new WebPlatform();
}
