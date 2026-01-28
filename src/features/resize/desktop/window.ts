import { initResizeComponent, type ResizeElements, type ResizeSettings } from '../shared/component';
import type { ResizeInitData, ResizeAPI } from './resize';

declare const window: Window & {
  resizeDialog?: ResizeAPI;
};

function getElements(): ResizeElements {
  return {
    percentageRadio: document.getElementById('resize-mode-percentage') as HTMLInputElement,
    absoluteRadio: document.getElementById('resize-mode-absolute') as HTMLInputElement,
    percentageSection: document.getElementById('percentage-section') as HTMLDivElement,
    absoluteSection: document.getElementById('absolute-section') as HTMLDivElement,
    percentageInput: document.getElementById('resize-percentage') as HTMLInputElement,
    widthInput: document.getElementById('resize-width') as HTMLInputElement,
    heightInput: document.getElementById('resize-height') as HTMLInputElement,
    aspectRatioCheckbox: document.getElementById('resize-aspect-ratio') as HTMLInputElement,
    okBtn: document.getElementById('resize-ok') as HTMLButtonElement,
    cancelBtn: document.getElementById('resize-cancel') as HTMLButtonElement,
  };
}

function init(): void {
  if (window.resizeDialog) {
    window.resizeDialog.onInit((data: ResizeInitData) => {
      if (data.theme) document.documentElement.setAttribute('data-theme', data.theme);

      const currentSizeEl = document.getElementById('resize-current-size');
      if (currentSizeEl) currentSizeEl.textContent = `${data.width} × ${data.height}`;

      const elements = getElements();
      elements.widthInput.value = String(data.width);
      elements.widthInput.max = String(data.width * 2);
      elements.heightInput.value = String(data.height);
      elements.heightInput.max = String(data.height * 2);

      initResizeComponent(elements, data.width, data.height, {
        onResize: (settings: ResizeSettings) => {
          window.resizeDialog!.resize(settings);
        },
        onCancel: () => {
          window.resizeDialog!.close();
        },
      });
    });

    window.resizeDialog.onThemeChanged(theme => {
      document.documentElement.setAttribute('data-theme', theme);
    });
  }
}

init();
