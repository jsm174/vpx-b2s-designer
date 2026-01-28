export interface AboutCallbacks {
  onClose: () => void;
}

export interface AboutData {
  version: string;
  platform: 'Web' | 'Desktop';
  iconSrc?: string;
}

export function createAboutHTML(data: AboutData): string {
  const iconSrc = data.iconSrc || '/icons/about-icon.png';
  return `
    <div class="about-container">
      <img class="about-icon" src="${iconSrc}" alt="VPX B2S Designer">
      <div class="about-name">VPX B2S Designer</div>
      <div class="about-version">Version ${data.version} [${data.platform}]</div>
      <div class="about-thanks">
        <div class="about-thanks-title">Special Thanks:</div>
        <a href="https://github.com/vpinball/vpinball" target="_blank" rel="noopener">Visual Pinball</a>
        <a href="https://github.com/vpinball/b2s-designer" target="_blank" rel="noopener">B2S Backglass Designer</a>
      </div>
    </div>
  `;
}

export function initAboutComponent(_container: HTMLElement, callbacks: AboutCallbacks): { destroy: () => void } {
  const handleKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' || e.key === 'Enter') {
      callbacks.onClose();
    }
  };

  document.addEventListener('keydown', handleKeydown);

  return {
    destroy: () => {
      document.removeEventListener('keydown', handleKeydown);
    },
  };
}
