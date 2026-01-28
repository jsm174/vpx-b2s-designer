import { DEFAULT_THEME } from '../../../shared/constants';

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
    <div class="settings-body">
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
    <div class="settings-footer">
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

  const handleThemeChange = (): void => {
    if (themeSelect) callbacks.onThemePreview?.(themeSelect.value);
  };

  const handleOk = (): void => {
    callbacks.onSave({
      theme: themeSelect?.value || DEFAULT_THEME,
    });
  };

  const handleCancel = (): void => {
    callbacks.onThemePreview?.(originalTheme);
    callbacks.onCancel();
  };

  const handleKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') handleCancel();
    if (e.key === 'Enter') handleOk();
  };

  themeSelect?.addEventListener('change', handleThemeChange);
  okBtn?.addEventListener('click', handleOk);
  cancelBtn?.addEventListener('click', handleCancel);
  document.addEventListener('keydown', handleKeydown);

  return {
    destroy: () => {
      themeSelect?.removeEventListener('change', handleThemeChange);
      okBtn?.removeEventListener('click', handleOk);
      cancelBtn?.removeEventListener('click', handleCancel);
      document.removeEventListener('keydown', handleKeydown);
    },
  };
}
