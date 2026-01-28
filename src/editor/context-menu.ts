interface ConsoleContextMenuCallbacks {
  onCopy?: () => void;
  onSelectAll?: () => void;
  onClear?: () => void;
}

interface CanvasContextMenuCallbacks {
  onExportIlluminated?: (useIntensity: boolean) => void;
  onPickItem?: (type: 'bulb' | 'score', id: number) => void;
  onZOrder?: (op: 'front' | 'back' | 'forward' | 'backward') => void;
}

interface CanvasContextMenuItems {
  hits?: Array<{ type: 'bulb' | 'score'; id: number; label: string }>;
  hasBackgroundImage: boolean;
  hasSelection: boolean;
}

let activeMenu: HTMLElement | null = null;

function createMenuItem(label: string, onClick: () => void, disabled: boolean): HTMLElement {
  const item = document.createElement('div');
  item.className = 'context-menu-item';
  if (disabled) item.classList.add('disabled');
  item.textContent = label;
  if (!disabled) {
    item.addEventListener('click', () => {
      hideContextMenu();
      onClick();
    });
  }
  return item;
}

function createSeparator(): HTMLElement {
  const sep = document.createElement('div');
  sep.className = 'context-menu-separator';
  return sep;
}

function positionMenu(menu: HTMLElement, screenX: number, screenY: number): void {
  document.body.appendChild(menu);
  activeMenu = menu;

  const rect = menu.getBoundingClientRect();
  if (screenX + rect.width > window.innerWidth) {
    screenX = window.innerWidth - rect.width - 4;
  }
  if (screenY + rect.height > window.innerHeight) {
    screenY = window.innerHeight - rect.height - 4;
  }
  menu.style.left = `${Math.max(0, screenX)}px`;
  menu.style.top = `${Math.max(0, screenY)}px`;
}

export function hideContextMenu(): void {
  if (activeMenu) {
    activeMenu.remove();
    activeMenu = null;
  }
}

export function showCanvasContextMenu(
  screenX: number,
  screenY: number,
  items: CanvasContextMenuItems,
  callbacks: CanvasContextMenuCallbacks
): void {
  hideContextMenu();

  const menu = document.createElement('div');
  menu.className = 'context-menu';

  if (items.hits && items.hits.length > 0) {
    const header = document.createElement('div');
    header.className = 'context-menu-header';
    header.textContent = items.hits.length === 1 ? 'Select' : 'Select item';
    menu.appendChild(header);
    for (const hit of items.hits) {
      menu.appendChild(createMenuItem(hit.label, () => callbacks.onPickItem?.(hit.type, hit.id), false));
    }
    menu.appendChild(createSeparator());
  }

  if (items.hasSelection) {
    menu.appendChild(createMenuItem('Bring to Front', () => callbacks.onZOrder?.('front'), false));
    menu.appendChild(createMenuItem('Bring Forward', () => callbacks.onZOrder?.('forward'), false));
    menu.appendChild(createMenuItem('Send Backward', () => callbacks.onZOrder?.('backward'), false));
    menu.appendChild(createMenuItem('Send to Back', () => callbacks.onZOrder?.('back'), false));
    menu.appendChild(createSeparator());
  }

  menu.appendChild(
    createMenuItem('Export Illuminated Image', () => callbacks.onExportIlluminated?.(false), !items.hasBackgroundImage)
  );
  menu.appendChild(
    createMenuItem(
      'Export Illuminated Image (Accurate Intensity)',
      () => callbacks.onExportIlluminated?.(true),
      !items.hasBackgroundImage
    )
  );

  positionMenu(menu, screenX, screenY);
}

export interface SimpleMenuItem {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  separator?: boolean;
  onHover?: () => void;
  onLeave?: () => void;
  icon?: string;
}

export function showSimpleContextMenu(
  screenX: number,
  screenY: number,
  items: SimpleMenuItem[],
  onClose?: () => void
): void {
  hideContextMenu();
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  for (const it of items) {
    if (it.separator) {
      menu.appendChild(createSeparator());
      continue;
    }
    const el = createMenuItem(it.label, () => it.onClick?.(), !!it.disabled);
    if (it.icon) {
      const img = document.createElement('img');
      img.src = it.icon;
      img.className = 'context-menu-icon';
      el.prepend(img);
    }
    if (it.onHover) el.addEventListener('mouseenter', () => it.onHover?.());
    if (it.onLeave) el.addEventListener('mouseleave', () => it.onLeave?.());
    menu.appendChild(el);
  }
  if (onClose) {
    const observer = new MutationObserver(() => {
      if (!document.body.contains(menu)) {
        observer.disconnect();
        onClose();
      }
    });
    observer.observe(document.body, { childList: true });
  }
  positionMenu(menu, screenX, screenY);
}

export function showConsoleContextMenu(screenX: number, screenY: number, callbacks: ConsoleContextMenuCallbacks): void {
  hideContextMenu();

  const hasSelection = !!window.getSelection()?.toString();

  const menu = document.createElement('div');
  menu.className = 'context-menu';

  menu.appendChild(createMenuItem('Copy', () => callbacks.onCopy?.(), !hasSelection));
  menu.appendChild(createMenuItem('Select All', () => callbacks.onSelectAll?.(), false));
  menu.appendChild(createSeparator());
  menu.appendChild(createMenuItem('Clear', () => callbacks.onClear?.(), false));

  positionMenu(menu, screenX, screenY);
}

document.addEventListener('click', (e: MouseEvent) => {
  if (activeMenu && !activeMenu.contains(e.target as Node)) {
    hideContextMenu();
  }
});

document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    hideContextMenu();
  }
});
