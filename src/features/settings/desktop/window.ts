import { createSettingsHTML, initSettingsComponent, type EditorSettings } from '../shared/component.js';

declare const settingsDialog: {
  onInit: (callback: (data: { settings: EditorSettings; theme: string }) => void) => void;
  onThemeChanged: (callback: (theme: string) => void) => void;
  save: (settings: EditorSettings) => void;
  previewTheme: (theme: string) => void;
  cancel: () => void;
};

const container = document.getElementById('settings-container') as HTMLElement;
container.innerHTML = createSettingsHTML();

settingsDialog.onThemeChanged(theme => {
  document.documentElement.setAttribute('data-theme', theme);
});

settingsDialog.onInit(data => {
  initSettingsComponent(container, data.settings, {
    onSave: settings => {
      settingsDialog.save(settings);
    },
    onCancel: () => {
      settingsDialog.cancel();
    },
    onThemePreview: theme => {
      settingsDialog.previewTheme(theme);
    },
  });
});
