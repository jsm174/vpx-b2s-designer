export interface ResizeSettings {
  originalWidth: number;
  originalHeight: number;
  newWidth: number;
  newHeight: number;
}

export interface ResizeElements {
  percentageRadio: HTMLInputElement;
  absoluteRadio: HTMLInputElement;
  percentageSection: HTMLDivElement;
  absoluteSection: HTMLDivElement;
  percentageInput: HTMLInputElement;
  widthInput: HTMLInputElement;
  heightInput: HTMLInputElement;
  aspectRatioCheckbox: HTMLInputElement;
  okBtn: HTMLButtonElement;
  cancelBtn: HTMLButtonElement;
}

export interface ResizeCallbacks {
  onResize: (settings: ResizeSettings) => void;
  onCancel: () => void;
}

export interface ResizeInstance {
  getNewSize: () => { width: number; height: number };
  destroy: () => void;
}

export function initResizeComponent(
  elements: ResizeElements,
  originalWidth: number,
  originalHeight: number,
  callbacks: ResizeCallbacks
): ResizeInstance {
  const {
    percentageRadio,
    absoluteRadio,
    percentageSection,
    absoluteSection,
    percentageInput,
    widthInput,
    heightInput,
    aspectRatioCheckbox,
    okBtn,
    cancelBtn,
  } = elements;

  const aspectRatio = originalWidth / originalHeight;
  let isUpdating = false;

  function updateMode(): void {
    const isPercentage = percentageRadio?.checked ?? true;
    if (percentageSection) percentageSection.classList.toggle('hidden', !isPercentage);
    if (absoluteSection) absoluteSection.classList.toggle('hidden', isPercentage);
  }

  function updateFromPercentage(): void {
    if (isUpdating) return;
    isUpdating = true;
    const pct = parseFloat(percentageInput?.value || '100') / 100;
    if (widthInput) widthInput.value = String(Math.round(originalWidth * pct));
    if (heightInput) heightInput.value = String(Math.round(originalHeight * pct));
    isUpdating = false;
  }

  function updateFromWidth(): void {
    if (isUpdating || !aspectRatioCheckbox?.checked) return;
    isUpdating = true;
    const w = parseFloat(widthInput?.value || String(originalWidth));
    if (heightInput) heightInput.value = String(Math.round(w / aspectRatio));
    isUpdating = false;
  }

  function updateFromHeight(): void {
    if (isUpdating || !aspectRatioCheckbox?.checked) return;
    isUpdating = true;
    const h = parseFloat(heightInput?.value || String(originalHeight));
    if (widthInput) widthInput.value = String(Math.round(h * aspectRatio));
    isUpdating = false;
  }

  function getNewSize(): { width: number; height: number } {
    const isPercentage = percentageRadio?.checked ?? true;
    if (isPercentage) {
      const pct = parseFloat(percentageInput?.value || '100') / 100;
      return {
        width: Math.round(originalWidth * pct),
        height: Math.round(originalHeight * pct),
      };
    } else {
      return {
        width: Math.max(1, parseInt(widthInput?.value || String(originalWidth), 10)),
        height: Math.max(1, parseInt(heightInput?.value || String(originalHeight), 10)),
      };
    }
  }

  percentageRadio?.addEventListener('change', updateMode);
  absoluteRadio?.addEventListener('change', updateMode);
  percentageInput?.addEventListener('input', updateFromPercentage);
  widthInput?.addEventListener('input', updateFromWidth);
  heightInput?.addEventListener('input', updateFromHeight);

  okBtn?.addEventListener('click', () => {
    const { width, height } = getNewSize();
    callbacks.onResize({
      originalWidth,
      originalHeight,
      newWidth: width,
      newHeight: height,
    });
  });

  cancelBtn?.addEventListener('click', () => {
    callbacks.onCancel();
  });

  return {
    getNewSize,
    destroy: () => {},
  };
}
