import type { FileSystemProvider } from '../types';

export class ElectronFileSystem implements FileSystemProvider {
  private get api() {
    if (typeof window !== 'undefined' && (window as unknown as { vpxB2sDesignerAPI?: unknown }).vpxB2sDesignerAPI) {
      return (window as unknown as { vpxB2sDesignerAPI: ElectronAPI }).vpxB2sDesignerAPI;
    }
    return null;
  }

  async readFile(path: string): Promise<string> {
    if (this.api?.readFile) {
      return this.api.readFile(path);
    }
    throw new Error('FileSystem not available');
  }

  async readBinaryFile(path: string): Promise<Uint8Array> {
    if (this.api?.readBinaryFile) {
      return this.api.readBinaryFile(path);
    }
    throw new Error('FileSystem not available');
  }

  async writeFile(path: string, content: string): Promise<void> {
    if (this.api?.writeFile) {
      await this.api.writeFile(path, content);
      return;
    }
    throw new Error('FileSystem not available');
  }

  async writeBinaryFile(path: string, content: Uint8Array): Promise<void> {
    if (this.api?.writeBinaryFile) {
      await this.api.writeBinaryFile(path, content);
      return;
    }
    throw new Error('FileSystem not available');
  }

  async deleteFile(path: string): Promise<void> {
    if (this.api?.deleteFile) {
      await this.api.deleteFile(path);
      return;
    }
    throw new Error('FileSystem not available');
  }

  async exists(path: string): Promise<boolean> {
    if (this.api?.exists) {
      return this.api.exists(path);
    }
    return false;
  }

  async listDir(path: string): Promise<string[]> {
    if (this.api?.listDir) {
      return this.api.listDir(path);
    }
    return [];
  }

  async mkdir(path: string): Promise<void> {
    if (this.api?.mkdir) {
      await this.api.mkdir(path);
    }
  }
}

interface ElectronAPI {
  readFile?(path: string): Promise<string>;
  readBinaryFile?(path: string): Promise<Uint8Array>;
  writeFile?(path: string, content: string): Promise<void>;
  writeBinaryFile?(path: string, content: Uint8Array): Promise<void>;
  deleteFile?(path: string): Promise<void>;
  exists?(path: string): Promise<boolean>;
  listDir?(path: string): Promise<string[]>;
  mkdir?(path: string): Promise<void>;
}
