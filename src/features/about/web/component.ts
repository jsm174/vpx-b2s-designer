import { createAboutHTML, initAboutComponent } from '../shared/component.js';
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

export interface WebAboutDeps {
  getVersion: () => Promise<string>;
  onShowAbout: (callback: () => void) => void;
}

export function initWebAbout(deps: WebAboutDeps): void {
  injectTemplate();
  const modal = document.getElementById('about-modal')!;
  const content = modal.querySelector('.about-modal-content')!;
  const closeBtn = document.getElementById('about-modal-close')!;
  const backdrop = modal.querySelector('.about-modal-backdrop')!;

  let componentInstance: { destroy: () => void } | null = null;

  function closeAbout(): void {
    modal.classList.add('hidden');
    componentInstance?.destroy();
    componentInstance = null;
  }

  async function showAbout(): Promise<void> {
    const version = await deps.getVersion();

    content.innerHTML = createAboutHTML({
      version,
      platform: 'Web',
      iconSrc: 'icons/about-icon.png',
    });

    componentInstance = initAboutComponent(content as HTMLElement, {
      onClose: closeAbout,
    });

    modal.classList.remove('hidden');
  }

  closeBtn.addEventListener('click', closeAbout);
  backdrop.addEventListener('click', closeAbout);
  deps.onShowAbout(showAbout);
}
