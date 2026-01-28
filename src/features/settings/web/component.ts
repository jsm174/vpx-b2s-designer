import {
  createSettingsHTML,
  initSettingsComponent,
  defaultEditorSettings,
  type EditorSettings,
} from '../shared/component.js';
import templateHtml from './template.html?raw';

let templateInjected = false;

function injectTemplate(): void {
  if (templateInjected) return;
  const container = document.createElement('div');
  container.innerHTML = templateHtml;
  while (container.firstChild) {
    document.body.appendChild(container.firstChild);
  }
  templateInjected = true;
}

export interface WebSettingsDeps {
  getSettings: () => Promise<EditorSettings>;
  saveSettings: (settings: EditorSettings) => Promise<void>;
  applyTheme: (theme: string) => void;
  onShowSettings: (callback: () => void) => void;
}

export function initWebSettings(deps: WebSettingsDeps): void {
  injectTemplate();
  const modal = document.getElementById('settings-modal')!;
  const content = modal.querySelector('.settings-modal-content')!;
  const closeBtn = document.getElementById('settings-modal-close')!;
  const backdrop = modal.querySelector('.settings-modal-backdrop')!;

  let componentInstance: { destroy: () => void } | null = null;
  let originalTheme: string | undefined;

  function closeSettings(): void {
    if (originalTheme !== undefined) {
      deps.applyTheme(originalTheme);
      originalTheme = undefined;
    }
    modal.classList.add('hidden');
    componentInstance?.destroy();
    componentInstance = null;
  }

  async function showSettings(): Promise<void> {
    const settings = await deps.getSettings();
    originalTheme = settings.theme;

    content.innerHTML = createSettingsHTML();

    componentInstance = initSettingsComponent(content as HTMLElement, settings, {
      onSave: async newSettings => {
        originalTheme = undefined;
        await deps.saveSettings(newSettings);
        deps.applyTheme(newSettings.theme);
        modal.classList.add('hidden');
        componentInstance?.destroy();
        componentInstance = null;
      },
      onCancel: () => {
        closeSettings();
      },
      onThemePreview: theme => {
        deps.applyTheme(theme);
      },
    });

    modal.classList.remove('hidden');
  }

  closeBtn.addEventListener('click', closeSettings);
  backdrop.addEventListener('click', closeSettings);
  deps.onShowSettings(showSettings);
}

export { defaultEditorSettings, type EditorSettings };
