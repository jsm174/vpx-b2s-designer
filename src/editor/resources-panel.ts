import { state } from './state';

interface ResourceItem {
  type: 'background' | 'illumination' | 'dmd' | 'snippet';
  fileName: string;
  index: number;
  bulbId?: number;
}

interface ResourceSection {
  title: string;
  type: 'background' | 'illumination' | 'dmd' | 'snippet';
  items: ResourceItem[];
}

let resourcesElement: HTMLElement | null = null;
let selectedResource: { type: string; index: number } | null = null;

export function initResourcesPanel(): void {
  resourcesElement = document.getElementById('resources-list');
  if (resourcesElement) {
    resourcesElement.addEventListener('contextmenu', handleContextMenu);
  }
}

export function updateResourcesPanel(): void {
  if (!resourcesElement) return;

  const sections: ResourceSection[] = [];

  const bgItems: ResourceItem[] = [];
  state.currentData.images.backgroundImages.forEach((img, i) => {
    bgItems.push({ type: 'background', fileName: img.fileName || 'Backglass', index: i });
  });
  if (bgItems.length > 0) {
    sections.push({ title: 'Background Images', type: 'background', items: bgItems });
  }

  const illumItems: ResourceItem[] = [];
  state.currentData.images.illuminatedImages.forEach((img, i) => {
    illumItems.push({ type: 'illumination', fileName: img.fileName || `Illumination ${i + 1}`, index: i });
  });
  if (illumItems.length > 0) {
    sections.push({ title: 'Illumination Images', type: 'illumination', items: illumItems });
  }

  const dmdItems: ResourceItem[] = [];
  state.currentData.images.dmdImages.forEach((img, i) => {
    dmdItems.push({ type: 'dmd', fileName: img.fileName || 'DMD', index: i });
  });
  if (dmdItems.length > 0) {
    sections.push({ title: 'DMD Images', type: 'dmd', items: dmdItems });
  }

  const snippetItems: ResourceItem[] = [];
  const seenSnippets = new Set<string>();
  state.currentData.illumination.forEach(bulb => {
    if (bulb.isImageSnippet && bulb.imageData) {
      const key = bulb.imageData.substring(0, 100);
      if (!seenSnippets.has(key)) {
        seenSnippets.add(key);
        snippetItems.push({
          type: 'snippet',
          fileName: bulb.name || `Snippet ${snippetItems.length + 1}`,
          index: snippetItems.length,
          bulbId: bulb.id,
        });
      }
    }
  });
  if (snippetItems.length > 0) {
    sections.push({ title: 'Illumination Snippets', type: 'snippet', items: snippetItems });
  }

  if (sections.length === 0) {
    resourcesElement.innerHTML = '<div class="empty-list">No images loaded</div>';
    return;
  }

  resourcesElement.innerHTML = sections
    .map(
      section => `
    <div class="resource-section">
      <div class="resource-section-title">${section.title}</div>
      ${section.items
        .map(
          r => `
        <div class="resource-item ${isSelected(r) ? 'selected' : ''}"
             data-type="${r.type}" data-index="${r.index}" ${r.bulbId !== undefined ? `data-bulb-id="${r.bulbId}"` : ''}>
          <div class="resource-thumbnail" data-type="${r.type}" data-index="${r.index}" ${r.bulbId !== undefined ? `data-bulb-id="${r.bulbId}"` : ''}></div>
          <div class="resource-info">
            <span class="resource-name">${escapeHtml(r.fileName)}</span>
          </div>
        </div>
      `
        )
        .join('')}
    </div>
  `
    )
    .join('');

  generateThumbnails();
  setupClickHandlers();
}

function isSelected(r: ResourceItem): boolean {
  return selectedResource?.type === r.type && selectedResource?.index === r.index;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function generateThumbnails(): void {
  const thumbElements = resourcesElement?.querySelectorAll('.resource-thumbnail');
  thumbElements?.forEach(el => {
    const htmlEl = el as HTMLElement;
    const type = htmlEl.dataset.type;
    const index = parseInt(htmlEl.dataset.index || '0');

    let imgSrc: HTMLImageElement | null = null;
    if (type === 'background' && state.backgroundImage) {
      imgSrc = state.backgroundImage;
    } else if (type === 'dmd' && state.dmdImage) {
      imgSrc = state.dmdImage;
    } else if (type === 'illumination') {
      const illumImg = state.currentData.images.illuminatedImages[index];
      if (illumImg?.fileName) {
        imgSrc = state.illuminationImages.get(illumImg.fileName) || null;
      }
    } else if (type === 'snippet') {
      const bulbId = parseInt(htmlEl.dataset.bulbId || '0');
      const bulb = state.currentData.illumination.find(b => b.id === bulbId);
      if (bulb?.imageData) {
        const img = new Image();
        img.onload = () => {
          renderThumbnail(el as HTMLElement, img);
        };
        img.src = `data:image/png;base64,${bulb.imageData}`;
        return;
      }
    }

    if (imgSrc) {
      renderThumbnail(htmlEl, imgSrc);
    }
  });
}

function renderThumbnail(container: HTMLElement, imgSrc: HTMLImageElement): void {
  container.innerHTML = '';
  const canvas = document.createElement('canvas');
  canvas.width = 40;
  canvas.height = 30;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const scale = Math.min(40 / imgSrc.width, 30 / imgSrc.height);
    const w = imgSrc.width * scale;
    const h = imgSrc.height * scale;
    ctx.drawImage(imgSrc, (40 - w) / 2, (30 - h) / 2, w, h);
  }
  container.appendChild(canvas);
}

function setupClickHandlers(): void {
  const items = resourcesElement?.querySelectorAll('.resource-item');
  items?.forEach(item => {
    item.addEventListener('click', () => {
      const type = (item as HTMLElement).dataset.type || '';
      const index = parseInt((item as HTMLElement).dataset.index || '0');
      selectedResource = { type, index };
      updateResourcesPanel();
    });
  });
}

function handleContextMenu(e: MouseEvent): void {
  e.preventDefault();
  const target = (e.target as HTMLElement).closest('.resource-item');
  if (!target) return;

  const el = target as HTMLElement;
  const type = el.dataset.type;
  const index = parseInt(el.dataset.index || '0');
  const bulbId = el.dataset.bulbId ? parseInt(el.dataset.bulbId) : undefined;

  showResourceContextMenu(e.clientX, e.clientY, type as string, index, bulbId);
}

function showResourceContextMenu(x: number, y: number, type: string, index: number, bulbId?: number): void {
  const existing = document.querySelector('.context-menu');
  if (existing) existing.remove();

  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  const items: { label: string; action: () => void }[] = [
    { label: 'Import...', action: () => importResource(type) },
    { label: 'Export...', action: () => exportResource(type, index, bulbId) },
  ];

  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'context-menu-item';
    div.textContent = item.label;
    div.addEventListener('click', () => {
      item.action();
      menu.remove();
    });
    menu.appendChild(div);
  });

  document.body.appendChild(menu);

  const closeHandler = (): void => {
    menu.remove();
    document.removeEventListener('click', closeHandler);
  };
  setTimeout(() => document.addEventListener('click', closeHandler), 0);
}

function importResource(type: string): void {
  let action = '';
  switch (type) {
    case 'background':
      action = 'import-backglass-image';
      break;
    case 'illumination':
      action = 'import-illumination-image';
      break;
    case 'dmd':
      action = 'import-dmd-image';
      break;
    case 'snippet':
      action = 'add-illumination-snippet';
      break;
  }
  if (action) {
    window.dispatchEvent(new CustomEvent('menu-action', { detail: action }));
  }
}

function exportResource(type: string, index: number, bulbId?: number): void {
  let base64 = '';
  let fileName = '';

  switch (type) {
    case 'background': {
      const img = state.currentData.images.backgroundImages[index];
      if (img) {
        base64 = img.imageData;
        fileName = img.fileName ? fileBaseName(img.fileName) : 'backglass.png';
      }
      break;
    }
    case 'illumination': {
      const img = state.currentData.images.illuminatedImages[index];
      if (img) {
        base64 = img.imageData;
        fileName = img.fileName ? fileBaseName(img.fileName) : `illumination-${index + 1}.png`;
      }
      break;
    }
    case 'dmd': {
      const img = state.currentData.images.dmdImages[index];
      if (img) {
        base64 = img.imageData;
        fileName = img.fileName ? fileBaseName(img.fileName) : 'dmd.png';
      }
      break;
    }
    case 'snippet': {
      const bulb = state.currentData.illumination.find(b => b.id === bulbId);
      if (bulb?.imageData) {
        base64 = bulb.imageData;
        fileName = bulb.name ? `${bulb.name}.png` : `snippet-${bulbId}.png`;
      }
      break;
    }
  }

  if (!base64) return;

  const mimeType = detectFormat(base64);
  const byteChars = atob(base64);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    bytes[i] = byteChars.charCodeAt(i);
  }

  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function fileBaseName(filePath: string): string {
  return filePath.split(/[\\/]/).pop() || filePath;
}

function detectFormat(base64: string): string {
  if (base64.startsWith('/9j/')) return 'image/jpeg';
  if (base64.startsWith('iVBORw0KGgo')) return 'image/png';
  if (base64.startsWith('R0lGOD')) return 'image/gif';
  if (base64.startsWith('UklGR')) return 'image/webp';
  return 'image/png';
}
