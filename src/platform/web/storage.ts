import type { StorageProvider } from '../types';

export class WebStorageProvider implements StorageProvider {
  private prefix = 'vpx-b2s-designer-';

  async get<T>(key: string, defaultValue?: T): Promise<T | undefined> {
    try {
      const stored = localStorage.getItem(this.prefix + key);
      if (stored !== null) {
        return JSON.parse(stored) as T;
      }
    } catch {}
    return defaultValue;
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(value));
    } catch {}
  }

  async delete(key: string): Promise<void> {
    try {
      localStorage.removeItem(this.prefix + key);
    } catch {}
  }
}
