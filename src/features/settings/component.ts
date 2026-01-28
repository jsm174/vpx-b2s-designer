import { DEFAULT_THEME } from '../../shared/constants';

export interface EditorSettings {
  theme: string;
}

export const defaultEditorSettings: EditorSettings = {
  theme: DEFAULT_THEME,
};

export interface SettingsCallbacks {
  onSave: (settings: EditorSettings) => void;
  onCancel: () => void;
  onThemePreview?: (theme: string) => void;
}

export function createSettingsHTML(): string {
  return `
    <div class="modal-header">Settings</div>
    <div class="modal-body">
      <div class="settings-section">
        <div class="settings-field-row">
          <label>Theme</label>
          <select id="settings-theme" class="win-select">
            <option value="system">System</option>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </div>
      </div>
    </div>

    <div class="modal-footer">
      <button class="win-btn" id="settings-cancel">Cancel</button>
      <button class="win-btn primary" id="settings-ok">OK</button>
    </div>
  `;
}

export function initSettingsComponent(
  container: HTMLElement,
  settings: EditorSettings,
  callbacks: SettingsCallbacks
): { destroy: () => void } {
  const $ = <T extends HTMLElement>(id: string): T | null => container.querySelector(`#${id}`);

  const themeSelect = $<HTMLSelectElement>('settings-theme');
  const okBtn = $<HTMLButtonElement>('settings-ok');
  const cancelBtn = $<HTMLButtonElement>('settings-cancel');

  const originalTheme = settings.theme;

  if (themeSelect) themeSelect.value = settings.theme || DEFAULT_THEME;

  if (themeSelect) {
    themeSelect.addEventListener('change', () => {
      callbacks.onThemePreview?.(themeSelect.value);
    });
  }

  if (okBtn) {
    okBtn.addEventListener('click', () => {
      const newSettings: EditorSettings = {
        theme: themeSelect?.value || DEFAULT_THEME,
      };
      callbacks.onSave(newSettings);
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      callbacks.onThemePreview?.(originalTheme);
      callbacks.onCancel();
    });
  }

  return {
    destroy: () => {},
  };
}
