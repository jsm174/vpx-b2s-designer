import type {
  DialogProvider,
  OpenDialogOptions,
  OpenDialogResult,
  SaveDialogOptions,
  SaveDialogResult,
  MessageBoxOptions,
} from '../types';

export class ElectronDialogProvider implements DialogProvider {
  private get api() {
    if (typeof window !== 'undefined' && (window as unknown as { vpxB2sDesignerAPI?: unknown }).vpxB2sDesignerAPI) {
      return (window as unknown as { vpxB2sDesignerAPI: ElectronAPI }).vpxB2sDesignerAPI;
    }
    return null;
  }

  async showOpenDialog(options: OpenDialogOptions): Promise<OpenDialogResult | null> {
    if (this.api?.showOpenDialog) {
      return this.api.showOpenDialog(options);
    }
    return null;
  }

  async showSaveDialog(options: SaveDialogOptions): Promise<SaveDialogResult | null> {
    if (this.api?.showSaveDialog) {
      return this.api.showSaveDialog(options);
    }
    return null;
  }

  async showMessageBox(options: MessageBoxOptions): Promise<number> {
    if (this.api?.showMessageBox) {
      return this.api.showMessageBox(options);
    }
    return 0;
  }
}

interface ElectronAPI {
  showOpenDialog?(options: OpenDialogOptions): Promise<OpenDialogResult | null>;
  showSaveDialog?(options: SaveDialogOptions): Promise<SaveDialogResult | null>;
  showMessageBox?(options: MessageBoxOptions): Promise<number>;
}
