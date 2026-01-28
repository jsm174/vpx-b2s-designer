import type {
  DialogProvider,
  OpenDialogOptions,
  OpenDialogResult,
  SaveDialogOptions,
  SaveDialogResult,
  MessageBoxOptions,
} from '../types';

export class WebDialogProvider implements DialogProvider {
  async showOpenDialog(options: OpenDialogOptions): Promise<OpenDialogResult | null> {
    try {
      if ('showOpenFilePicker' in window) {
        const accept: Record<string, string[]> = {};
        if (options.filters && options.filters.length > 0) {
          for (const filter of options.filters) {
            const mimeType = this.getMimeType(filter.extensions);
            accept[mimeType] = filter.extensions.map(ext => `.${ext}`);
          }
        }

        const [fileHandle] = await window.showOpenFilePicker({
          types: options.filters?.map(f => ({
            description: f.name,
            accept: { [this.getMimeType(f.extensions)]: f.extensions.map(e => `.${e}`) },
          })),
        });

        const file = await fileHandle.getFile();
        const result: OpenDialogResult = { filePath: file.name };

        if (options.readContents !== false) {
          result.content = await file.text();
        }

        return result;
      }

      return new Promise(resolve => {
        const input = document.createElement('input');
        input.type = 'file';
        if (options.filters && options.filters.length > 0) {
          input.accept = options.filters.flatMap(f => f.extensions.map(ext => `.${ext}`)).join(',');
        }
        input.onchange = async () => {
          if (input.files && input.files.length > 0) {
            const file = input.files[0];
            const result: OpenDialogResult = { filePath: file.name };
            if (options.readContents !== false) {
              result.content = await file.text();
            }
            resolve(result);
          } else {
            resolve(null);
          }
        };
        input.click();
      });
    } catch {
      return null;
    }
  }

  async showSaveDialog(options: SaveDialogOptions): Promise<SaveDialogResult | null> {
    try {
      if ('showSaveFilePicker' in window) {
        const handle = await window.showSaveFilePicker({
          suggestedName: options.defaultPath || 'file',
          types: options.filters?.map(f => ({
            description: f.name,
            accept: { [this.getMimeType(f.extensions)]: f.extensions.map(e => `.${e}`) },
          })),
        });

        if (options.content !== undefined || options.binaryContent !== undefined) {
          const writable = await handle.createWritable();
          if (options.binaryContent) {
            const data = options.binaryContent;
            const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
            await writable.write(new Blob([buffer]));
          } else if (options.content) {
            await writable.write(options.content);
          }
          await writable.close();
        }

        return { filePath: handle.name };
      }

      if (options.content !== undefined || options.binaryContent !== undefined) {
        let blob: Blob;
        if (options.binaryContent) {
          const data = options.binaryContent;
          const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
          blob = new Blob([buffer]);
        } else {
          blob = new Blob([options.content!], { type: 'text/plain' });
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = options.defaultPath || 'file';
        a.click();
        URL.revokeObjectURL(url);
        return { filePath: options.defaultPath || 'file' };
      }

      return null;
    } catch {
      return null;
    }
  }

  async showMessageBox(options: MessageBoxOptions): Promise<number> {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100000;
      `;

      const dialog = document.createElement('div');
      dialog.style.cssText = `
        background: var(--bg-secondary, #252526);
        border: 1px solid var(--border, #3c3c3c);
        border-radius: 8px;
        padding: 20px;
        min-width: 300px;
        max-width: 400px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      `;

      const title = document.createElement('div');
      title.style.cssText = `
        font-weight: 600;
        margin-bottom: 12px;
        color: var(--text-primary, #ccc);
      `;
      title.textContent = options.title || 'Message';

      const message = document.createElement('div');
      message.style.cssText = `
        margin-bottom: 8px;
        color: var(--text-primary, #ccc);
      `;
      message.textContent = options.message;

      dialog.appendChild(title);
      dialog.appendChild(message);

      if (options.detail) {
        const detail = document.createElement('div');
        detail.style.cssText = `
          margin-bottom: 16px;
          color: var(--text-secondary, #888);
          font-size: 12px;
        `;
        detail.textContent = options.detail;
        dialog.appendChild(detail);
      }

      const buttons = document.createElement('div');
      buttons.style.cssText = `
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 16px;
      `;

      const buttonLabels = options.buttons || ['OK'];
      buttonLabels.forEach((label, index) => {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.style.cssText = `
          padding: 6px 14px;
          background: ${index === (options.defaultId ?? 0) ? 'var(--accent, #0078d4)' : 'var(--bg-tertiary, #2d2d30)'};
          border: 1px solid ${index === (options.defaultId ?? 0) ? 'var(--accent, #0078d4)' : 'var(--border, #3c3c3c)'};
          border-radius: 4px;
          color: ${index === (options.defaultId ?? 0) ? 'white' : 'var(--text-primary, #ccc)'};
          cursor: pointer;
          font-size: 12px;
        `;
        btn.onclick = () => {
          overlay.remove();
          resolve(index);
        };
        buttons.appendChild(btn);
      });

      dialog.appendChild(buttons);
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);
    });
  }

  private getMimeType(extensions: string[]): string {
    const ext = extensions[0]?.toLowerCase();
    if (ext === 'directb2s' || ext === 'xml') return 'application/xml';
    if (ext === 'png') return 'image/png';
    if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
    return 'application/octet-stream';
  }
}
