import type { FileSystemProvider } from '../types';

export class OpfsFileSystem implements FileSystemProvider {
  private root: FileSystemDirectoryHandle | null = null;
  private pathMap: Map<string, string> = new Map();

  async init(): Promise<void> {
    this.root = await navigator.storage.getDirectory();
  }

  private normalizePath(path: string): string {
    return path.toLowerCase();
  }

  private getActualPath(path: string): string {
    return this.pathMap.get(this.normalizePath(path)) || path;
  }

  private storePath(path: string): void {
    this.pathMap.set(this.normalizePath(path), path);
  }

  private async getDirectoryHandle(
    dirPath: string,
    options: { create?: boolean } = {}
  ): Promise<FileSystemDirectoryHandle> {
    if (!this.root) throw new Error('OPFS not initialized');
    if (dirPath === '' || dirPath === '/') return this.root;

    const parts = dirPath.split('/').filter(p => p.length > 0);
    let current = this.root;

    for (const part of parts) {
      current = await current.getDirectoryHandle(part, { create: options.create });
    }
    return current;
  }

  private async getFileHandle(path: string, options: { create?: boolean } = {}): Promise<FileSystemFileHandle> {
    if (!this.root) throw new Error('OPFS not initialized');

    const parts = path.split('/').filter(p => p.length > 0);
    const fileName = parts.pop();
    if (!fileName) throw new Error('Invalid path');

    const dirPath = parts.join('/');
    const dir = await this.getDirectoryHandle(dirPath, { create: options.create });
    return dir.getFileHandle(fileName, { create: options.create });
  }

  async readFile(path: string): Promise<string> {
    const actualPath = this.getActualPath(path);
    const handle = await this.getFileHandle(actualPath);
    const file = await handle.getFile();
    return await file.text();
  }

  async readBinaryFile(path: string): Promise<Uint8Array> {
    const actualPath = this.getActualPath(path);
    const handle = await this.getFileHandle(actualPath);
    const file = await handle.getFile();
    const buffer = await file.arrayBuffer();
    return new Uint8Array(buffer);
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.storePath(path);
    const handle = await this.getFileHandle(path, { create: true });
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  async writeBinaryFile(path: string, content: Uint8Array): Promise<void> {
    this.storePath(path);
    const handle = await this.getFileHandle(path, { create: true });
    const writable = await handle.createWritable();
    const buffer = content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength) as ArrayBuffer;
    await writable.write(new Blob([buffer]));
    await writable.close();
  }

  async deleteFile(path: string): Promise<void> {
    const actualPath = this.getActualPath(path);
    const parts = actualPath.split('/').filter(p => p.length > 0);
    const fileName = parts.pop();
    if (!fileName) throw new Error('Invalid path');

    const dirPath = parts.join('/');
    const dir = await this.getDirectoryHandle(dirPath);
    await dir.removeEntry(fileName);
    this.pathMap.delete(this.normalizePath(path));
  }

  async exists(path: string): Promise<boolean> {
    try {
      const actualPath = this.getActualPath(path);
      await this.getFileHandle(actualPath);
      return true;
    } catch {
      return false;
    }
  }

  async listDir(path: string): Promise<string[]> {
    const dir = await this.getDirectoryHandle(path);
    const entries: string[] = [];
    for await (const entry of dir.keys()) {
      entries.push(entry);
    }
    return entries.sort();
  }

  async mkdir(path: string): Promise<void> {
    await this.getDirectoryHandle(path, { create: true });
  }
}
