interface ConsoleContextMenuCallbacks {
  onCopy?: () => void;
  onSelectAll?: () => void;
  onClear?: () => void;
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
