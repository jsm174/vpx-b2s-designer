import { initBrightnessComponent, type BrightnessElements, type BrightnessSettings } from '../shared/component';
import type { BrightnessInitData, BrightnessAPI } from './brightness';

declare const window: Window & {
  brightnessDialog?: BrightnessAPI;
};

function getElements(): BrightnessElements {
  return {
    slider: document.getElementById('brightness-slider') as HTMLInputElement,
    numberInput: document.getElementById('brightness-number') as HTMLInputElement,
    ignoreGrillCheckbox: document.getElementById('brightness-ignore-grill') as HTMLInputElement,
    preview: document.getElementById('brightness-preview') as HTMLCanvasElement,
    okBtn: document.getElementById('brightness-ok') as HTMLButtonElement,
    cancelBtn: document.getElementById('brightness-cancel') as HTMLButtonElement,
  };
}

function init(): void {
  if (window.brightnessDialog) {
    window.brightnessDialog.onInit((data: BrightnessInitData) => {
      if (data.theme) document.documentElement.setAttribute('data-theme', data.theme);

      const ignoreGrillRow = document.getElementById('ignore-grill-row');
      if (ignoreGrillRow) {
        ignoreGrillRow.style.display = data.grillHeight > 0 && !data.isDmd ? '' : 'none';
      }

      const img = new Image();
      img.onload = () => {
        const elements = getElements();
        initBrightnessComponent(elements, img, data.grillHeight, data.isDmd, {
          onApply: (settings: BrightnessSettings) => {
            window.brightnessDialog!.apply(settings);
          },
          onCancel: () => {
            window.brightnessDialog!.close();
          },
        });
      };
      img.src = `data:image/png;base64,${data.imageData}`;
    });

    window.brightnessDialog.onThemeChanged(theme => {
      document.documentElement.setAttribute('data-theme', theme);
    });
  }
}

init();
