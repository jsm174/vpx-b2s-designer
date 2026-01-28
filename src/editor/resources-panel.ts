import { state } from './state';
import { addLongPressContextMenu } from '../shared/long-press';
import { showSimpleContextMenu } from './context-menu';
import { getPlatform } from '../platform';
import { getMainBackgroundImage } from '../types/data';

type ResourceType = 'background' | 'illumination' | 'dmd' | 'snippet';

interface ResourceItem {
  type: ResourceType;
  fileName: string;
  index: number;
  bulbId?: number;
  active?: boolean;
}

interface ResourceSection {
  title: string;
  type: ResourceType;
  items: ResourceItem[];
}

let resourcesElement: HTMLElement | null = null;
let selectedResource: { type: string; index: number } | null = null;

export function illuminationImageKey(fileName: string, index: number): string {
  return fileName || `#${index}`;
}

export function initResourcesPanel(): void {
  resourcesElement = document.getElementById('resources-list');
  if (resourcesElement) {
    resourcesElement.tabIndex = 0;
    addLongPressContextMenu(resourcesElement);
    resourcesElement.addEventListener('contextmenu', handleContextMenu);
    resourcesElement.addEventListener('keydown', handleKeyDown);
  }
}

function baseName(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

export function updateResourcesPanel(): void {
  if (!resourcesElement) return;
  if (!state.selectedResource) selectedResource = null;

  const sections: ResourceSection[] = [];
  const images = state.currentData.images;
  const main = getMainBackgroundImage(images);

  const bgItems: ResourceItem[] = images.backgroundImages.map((img, i) => ({
    type: 'background',
    fileName: img.fileName ? baseName(img.fileName) : 'Backglass',
    index: i,
    active: img === main,
  }));
  sections.push({ title: 'Background images', type: 'background', items: bgItems });

  const illumItems: ResourceItem[] = images.illuminatedImages.map((img, i) => ({
    type: 'illumination',
    fileName: img.fileName ? baseName(img.fileName) : `Illumination ${i + 1}`,
    index: i,
    active: state.selectedIlluminationImage === i,
  }));
  sections.push({ title: 'Illumination images', type: 'illumination', items: illumItems });

  const dmdItems: ResourceItem[] = images.dmdImages.map((img, i) => ({
    type: 'dmd',
    fileName: img.fileName ? baseName(img.fileName) : 'DMD',
    index: i,
    active: i === 0,
  }));
  sections.push({ title: 'DMD images', type: 'dmd', items: dmdItems });

  const snippetItems: ResourceItem[] = [];
  const seenNames = new Set<string>();
  state.currentData.illumination.forEach(bulb => {
    if (bulb.isImageSnippet && bulb.imageData) {
      const key = bulb.name || `#${bulb.id}`;
      if (!seenNames.has(key)) {
        seenNames.add(key);
        snippetItems.push({
          type: 'snippet',
          fileName: bulb.name || `Snippit ${bulb.id}`,
          index: snippetItems.length,
          bulbId: bulb.id,
        });
      }
    }
  });
  sections.push({ title: 'Illumination snippits', type: 'snippet', items: snippetItems });

  if (!state.hasFile) {
    resourcesElement.innerHTML = '<div class="empty-list">No project loaded</div>';
    return;
  }

  resourcesElement.innerHTML = sections
    .map(
      section => `
    <div class="resource-section">
      <div class="resource-section-title">${section.title}</div>
      ${section.items
        .map(r => {
          return `
        <div class="resource-item ${isSelected(r) ? 'selected' : ''} ${r.active ? 'active-image' : ''}"
             data-type="${r.type}" data-index="${r.index}" ${r.bulbId !== undefined ? `data-bulb-id="${r.bulbId}"` : ''} tabindex="-1">
          <div class="resource-thumbnail" data-type="${r.type}" data-index="${r.index}" ${r.bulbId !== undefined ? `data-bulb-id="${r.bulbId}"` : ''}></div>
          <div class="resource-info">
            <span class="resource-name">${escapeHtml(r.fileName)}</span>
          </div>
        </div>
      `;
        })
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

function loadBase64(base64: string, cb: (img: HTMLImageElement) => void): void {
  if (!base64) return;
  const img = new Image();
  img.onload = () => cb(img);
  let mime = 'image/png';
  if (base64.startsWith('/9j/')) mime = 'image/jpeg';
  img.src = `data:${mime};base64,${base64}`;
}

function generateThumbnails(): void {
  const thumbElements = resourcesElement?.querySelectorAll('.resource-thumbnail');
  thumbElements?.forEach(el => {
    const htmlEl = el as HTMLElement;
    const type = htmlEl.dataset.type;
    const index = parseInt(htmlEl.dataset.index || '0');

    if (type === 'background') {
      const entry = state.currentData.images.backgroundImages[index];
      if (entry === getMainBackgroundImage(state.currentData.images) && state.backgroundImage) {
        renderThumbnail(htmlEl, state.backgroundImage);
      } else if (entry) {
        loadBase64(entry.imageData, img => renderThumbnail(htmlEl, img));
      }
    } else if (type === 'dmd') {
      if (index === 0 && state.dmdImage) renderThumbnail(htmlEl, state.dmdImage);
      else {
        const entry = state.currentData.images.dmdImages[index];
        if (entry) loadBase64(entry.imageData, img => renderThumbnail(htmlEl, img));
      }
    } else if (type === 'illumination') {
      const illumImg = state.currentData.images.illuminatedImages[index];
      if (illumImg) {
        const cached = state.illuminationImages.get(illuminationImageKey(illumImg.fileName, index));
        if (cached) renderThumbnail(htmlEl, cached);
        else loadBase64(illumImg.imageData, img => renderThumbnail(htmlEl, img));
      }
    } else if (type === 'snippet') {
      const bulbId = parseInt(htmlEl.dataset.bulbId || '0');
      const bulb = state.currentData.illumination.find(b => b.id === bulbId);
      if (bulb?.imageData) loadBase64(bulb.imageData, img => renderThumbnail(htmlEl, img));
    }
  });
}

function renderThumbnail(container: HTMLElement, imgSrc: HTMLImageElement): void {
  container.innerHTML = '';
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 24;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const scale = Math.min(64 / imgSrc.width, 24 / imgSrc.height);
    const w = imgSrc.width * scale;
    const h = imgSrc.height * scale;
    ctx.drawImage(imgSrc, (64 - w) / 2, (24 - h) / 2, w, h);
  }
  container.appendChild(canvas);
}

function dispatch(action: string, detail: Record<string, unknown>): void {
  window.dispatchEvent(new CustomEvent('resource-action', { detail: { action, ...detail } }));
}

function setupClickHandlers(): void {
  const items = resourcesElement?.querySelectorAll('.resource-item');
  items?.forEach(item => {
    const el = item as HTMLElement;
    const type = (el.dataset.type || 'background') as ResourceType;
    const index = parseInt(el.dataset.index || '0');
    const bulbId = el.dataset.bulbId ? parseInt(el.dataset.bulbId, 10) : undefined;
    el.addEventListener('click', () => {
      selectedResource = { type, index };
      state.selectedResource = { type, index, bulbId };
      state.selectedBulbIds.clear();
      state.selectedScoreIds.clear();
      state.primarySelection = null;
      resourcesElement?.querySelectorAll('.resource-item').forEach(i => i.classList.remove('selected'));
      el.classList.add('selected');
      resourcesElement?.focus();
      dispatch('selected', { type, index, bulbId });
    });
    el.addEventListener('dblclick', () => {
      activateResource(type, index);
    });
  });
}

export function activateResource(type: string, index: number): void {
  if (type === 'background') dispatch('activate-background', { index });
  else if (type === 'dmd') dispatch('activate-dmd', { index });
  else if (type === 'illumination') {
    state.selectedIlluminationImage = state.selectedIlluminationImage === index ? null : index;
    dispatch('illumination-selected', { index: state.selectedIlluminationImage });
    updateResourcesPanel();
  } else if (type === 'snippet') {
    const el = resourcesElement?.querySelector(
      `.resource-item[data-type="snippet"][data-index="${index}"]`
    ) as HTMLElement | null;
    const bulbId = el?.dataset.bulbId ? parseInt(el.dataset.bulbId, 10) : undefined;
    if (bulbId !== undefined) dispatch('select-snippet', { bulbId });
  }
}

function handleKeyDown(e: KeyboardEvent): void {
  if (!selectedResource) return;
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    activateResource(selectedResource.type, selectedResource.index);
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    if (selectedResource.type !== 'snippet') {
      dispatch('delete', { type: selectedResource.type, index: selectedResource.index });
      selectedResource = null;
    }
  }
}

function handleContextMenu(e: MouseEvent): void {
  e.preventDefault();
  const target = (e.target as HTMLElement).closest('.resource-item');
  const sectionEl = (e.target as HTMLElement).closest('.resource-section');
  let type: string | undefined;
  let index = 0;
  let bulbId: number | undefined;
  if (target) {
    const el = target as HTMLElement;
    type = el.dataset.type;
    index = parseInt(el.dataset.index || '0');
    bulbId = el.dataset.bulbId ? parseInt(el.dataset.bulbId) : undefined;
    selectedResource = { type: type || '', index };
    updateResourcesPanel();
  } else if (sectionEl) {
    const title = sectionEl.querySelector('.resource-section-title')?.textContent || '';
    type = title.startsWith('Background')
      ? 'background'
      : title.startsWith('Illumination images')
        ? 'illumination'
        : title.startsWith('DMD')
          ? 'dmd'
          : 'snippet';
  }
  if (!type) return;

  const hasItem = !!target;
  showSimpleContextMenu(e.clientX, e.clientY, [
    { label: 'Import...', onClick: () => importResource(type!) },
    { label: 'Save image as...', disabled: !hasItem, onClick: () => void exportResourceImage(type!, index, bulbId) },
    { label: '', separator: true },
    {
      label: type === 'illumination' ? 'Select / deselect' : 'Use this image',
      disabled: !hasItem || type === 'snippet',
      onClick: () => activateResource(type!, index),
    },
    {
      label: 'Delete',
      disabled: !hasItem || type === 'snippet',
      onClick: () => dispatch('delete', { type: type!, index }),
    },
  ]);
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

export async function exportResourceImage(type: string, index: number, bulbId?: number): Promise<void> {
  let base64 = '';
  let fileName = '';

  switch (type) {
    case 'background': {
      const img = state.currentData.images.backgroundImages[index];
      if (img) {
        base64 = img.imageData;
        fileName = img.fileName ? baseName(img.fileName) : 'backglass.png';
      }
      break;
    }
    case 'illumination': {
      const img = state.currentData.images.illuminatedImages[index];
      if (img) {
        base64 = img.imageData;
        fileName = img.fileName ? baseName(img.fileName) : `illumination-${index + 1}.png`;
      }
      break;
    }
    case 'dmd': {
      const img = state.currentData.images.dmdImages[index];
      if (img) {
        base64 = img.imageData;
        fileName = img.fileName ? baseName(img.fileName) : 'dmd.png';
      }
      break;
    }
    case 'snippet': {
      const bulb = state.currentData.illumination.find(b => b.id === bulbId);
      if (bulb?.imageData) {
        base64 = bulb.imageData;
        fileName = bulb.name ? `${bulb.name}.png` : `snippit-${bulbId}.png`;
      }
      break;
    }
  }

  if (!base64) return;
  const ext = base64.startsWith('/9j/') ? 'jpg' : 'png';
  if (!/\.[a-z0-9]+$/i.test(fileName)) fileName += `.${ext}`;
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const platform = getPlatform();
  const result = await platform.dialogs.showSaveDialog({
    title: 'Save image',
    defaultPath: fileName,
    filters: [{ name: 'Image', extensions: [ext] }],
    binaryContent: bytes,
  });
  if (!result) return;
}
