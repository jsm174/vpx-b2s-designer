export interface BrightnessSettings {
  brightness: number;
  ignoreGrill: boolean;
}

export interface BrightnessElements {
  slider: HTMLInputElement;
  numberInput: HTMLInputElement;
  ignoreGrillCheckbox: HTMLInputElement;
  preview: HTMLCanvasElement;
  okBtn: HTMLButtonElement;
  cancelBtn: HTMLButtonElement;
}

export interface BrightnessCallbacks {
  onApply: (settings: BrightnessSettings) => void;
  onCancel: () => void;
  onPreview?: (brightness: number, ignoreGrill: boolean) => void;
}

export interface BrightnessInstance {
  destroy: () => void;
}

export function applyBrightnessToImageData(imageData: ImageData, brightness: number, grillHeight = 0): void {
  const data = imageData.data;
  const amount = brightness / 100;
  const height = imageData.height;
  const effectiveHeight = grillHeight > 0 ? height - grillHeight : height;
  const rowBytes = imageData.width * 4;

  for (let y = 0; y < effectiveHeight; y++) {
    const rowOffset = y * rowBytes;
    for (let x = 0; x < imageData.width; x++) {
      const i = rowOffset + x * 4;
      if (amount > 0) {
        data[i] = Math.round(data[i] + amount * (255 - data[i]));
        data[i + 1] = Math.round(data[i + 1] + amount * (255 - data[i + 1]));
        data[i + 2] = Math.round(data[i + 2] + amount * (255 - data[i + 2]));
      } else {
        const absAmount = Math.abs(amount);
        data[i] = Math.round(data[i] - absAmount * data[i]);
        data[i + 1] = Math.round(data[i + 1] - absAmount * data[i + 1]);
        data[i + 2] = Math.round(data[i + 2] - absAmount * data[i + 2]);
      }
    }
  }
}

export function initBrightnessComponent(
  elements: BrightnessElements,
  originalImage: HTMLImageElement,
  grillHeight: number,
  isDmd: boolean,
  callbacks: BrightnessCallbacks
): BrightnessInstance {
  const { slider, numberInput, ignoreGrillCheckbox, preview, okBtn, cancelBtn } = elements;

  const canIgnoreGrill = grillHeight > 0 && !isDmd;
  if (ignoreGrillCheckbox) {
    ignoreGrillCheckbox.disabled = !canIgnoreGrill;
    ignoreGrillCheckbox.checked = canIgnoreGrill;
  }

  const ctx = preview.getContext('2d');
  if (!ctx) return { destroy: () => {} };

  const scale = Math.min(preview.width / originalImage.width, preview.height / originalImage.height);
  const scaledWidth = Math.round(originalImage.width * scale);
  const scaledHeight = Math.round(originalImage.height * scale);
  const offsetX = Math.round((preview.width - scaledWidth) / 2);
  const offsetY = Math.round((preview.height - scaledHeight) / 2);

  const scaledGrillHeight = Math.round(grillHeight * scale);

  const offscreen = document.createElement('canvas');
  offscreen.width = scaledWidth;
  offscreen.height = scaledHeight;
  const offCtx = offscreen.getContext('2d');
  if (!offCtx) return { destroy: () => {} };

  offCtx.drawImage(originalImage, 0, 0, scaledWidth, scaledHeight);
  const originalImageData = offCtx.getImageData(0, 0, scaledWidth, scaledHeight);

  function updatePreview(): void {
    if (!ctx || !offCtx) return;

    const brightness = parseFloat(slider?.value || '0');
    const ignoreGrill = ignoreGrillCheckbox?.checked && canIgnoreGrill;
    const effectiveGrillHeight = ignoreGrill ? scaledGrillHeight : 0;

    const workingData = new ImageData(
      new Uint8ClampedArray(originalImageData.data),
      originalImageData.width,
      originalImageData.height
    );

    applyBrightnessToImageData(workingData, brightness, effectiveGrillHeight);

    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, preview.width, preview.height);
    offCtx.putImageData(workingData, 0, 0);
    ctx.drawImage(offscreen, offsetX, offsetY);

    callbacks.onPreview?.(brightness, ignoreGrill);
  }

  function syncFromSlider(): void {
    if (numberInput) numberInput.value = slider?.value || '0';
    updatePreview();
  }

  function syncFromNumber(): void {
    let val = parseInt(numberInput?.value || '0', 10);
    if (isNaN(val)) val = 0;
    val = Math.max(-100, Math.min(100, val));
    if (slider) slider.value = String(val);
    updatePreview();
  }

  slider?.addEventListener('input', syncFromSlider);
  numberInput?.addEventListener('input', syncFromNumber);
  ignoreGrillCheckbox?.addEventListener('change', updatePreview);

  okBtn?.addEventListener('click', () => {
    const brightness = parseFloat(slider?.value || '0');
    const ignoreGrill = ignoreGrillCheckbox?.checked && canIgnoreGrill;
    callbacks.onApply({ brightness, ignoreGrill });
  });

  cancelBtn?.addEventListener('click', () => {
    callbacks.onCancel();
  });

  updatePreview();

  return {
    destroy: () => {},
  };
}
