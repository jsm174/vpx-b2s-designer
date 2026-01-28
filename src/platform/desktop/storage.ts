import type { StorageProvider } from '../types';

export class ElectronStorageProvider implements StorageProvider {
  private cache: Map<string, unknown> = new Map();

  private get api() {
    if (typeof window !== 'undefined' && (window as unknown as { vpxB2sDesignerAPI?: unknown }).vpxB2sDesignerAPI) {
      return (window as unknown as { vpxB2sDesignerAPI: ElectronAPI }).vpxB2sDesignerAPI;
    }
    return null;
  }

  async get<T>(key: string, defaultValue?: T): Promise<T | undefined> {
    if (this.cache.has(key)) {
      return this.cache.get(key) as T;
    }
    if (this.api?.getSetting) {
      const result = await this.api.getSetting(key);
      if (result !== undefined) {
        this.cache.set(key, result);
        return result as T;
      }
    }
    return defaultValue;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.cache.set(key, value);
    if (this.api?.saveSetting) {
      await this.api.saveSetting(key, value);
    }
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
    if (this.api?.deleteSetting) {
      await this.api.deleteSetting(key);
    }
  }
}

interface ElectronAPI {
  getSetting?(key: string): Promise<unknown>;
  saveSetting?(key: string, value: unknown): Promise<void>;
  deleteSetting?(key: string): Promise<void>;
}
