import { menuSchema, type MenuItemSchema } from './menu-schema';
import type { MenuState } from './menu-state';
import { createDefaultMenuState } from './menu-state';
import { evaluateMenuItem, filterMenuForPlatform, type EvaluationContext } from './menu-evaluator';

export interface WebMenuCallbacks {
  onAction: (action: string, arg?: string) => void;
}

export interface WebMenuRenderer {
  render: (container: HTMLElement) => void;
  updateState: (state: MenuState) => void;
  destroy: () => void;
}

function formatAccelerator(accel: string, isMac: boolean): string {
  let result = accel;
  result = result.replace('CmdOrCtrl', isMac ? '⌘' : 'Ctrl');
  result = result.replace('Cmd', '⌘');
  result = result.replace('Ctrl', isMac ? '⌃' : 'Ctrl');
  result = result.replace('Alt', isMac ? '⌥' : 'Alt');
  result = result.replace('Shift', isMac ? '⇧' : 'Shift');
  result = result.replace('Delete', isMac ? '⌫' : 'Del');
  result = result.replace('Plus', '+');
  result = result.replace('Minus', '-');
  if (isMac) {
    result = result.replace(/\+/g, '');
  }
  return result;
}

function menuHasCheckbox(items: MenuItemSchema[]): boolean {
  return items.some(item => item.type === 'checkbox');
}

export function createWebMenuRenderer(callbacks: WebMenuCallbacks): WebMenuRenderer {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const context: EvaluationContext = { platform: 'web', isMac };
  const filteredSchema = filterMenuForPlatform(menuSchema, context);

  let currentState: MenuState = createDefaultMenuState();
  let menuContainer: HTMLElement | null = null;

  function closeMenu(): void {
    if (menuContainer) {
      menuContainer.classList.remove('show');
      menuContainer.querySelectorAll('.menu-submenu.expanded').forEach(el => {
        el.classList.remove('expanded');
      });
    }
  }

  function createMenuItem(
    item: MenuItemSchema,
    state: MenuState,
    parentHasCheckbox: boolean = false
  ): HTMLElement | null {
    if (item.type === 'separator') {
      const sep = document.createElement('div');
      sep.className = 'menu-separator';
      return sep;
    }

    const itemState = evaluateMenuItem(item, state, context);
    if (!itemState.visible) return null;

    const div = document.createElement('div');
    div.className = 'menu-item';
    div.dataset.menuId = item.id;

    if (!itemState.enabled) {
      div.classList.add('disabled');
    }

    if (item.submenu && item.submenu.length > 0) {
      div.classList.add('menu-submenu');

      const labelSpan = document.createElement('span');
      labelSpan.textContent = itemState.label;
      div.appendChild(labelSpan);

      const arrow = document.createElement('span');
      arrow.className = 'menu-submenu-arrow';
      arrow.textContent = '▸';
      div.appendChild(arrow);

      const submenu = document.createElement('div');
      submenu.className = 'submenu';

      const hasCheckbox = menuHasCheckbox(item.submenu);
      for (const subItem of item.submenu) {
        const subMenuItem = createMenuItem(subItem, state, hasCheckbox);
        if (subMenuItem) {
          submenu.appendChild(subMenuItem);
        }
      }

      div.appendChild(submenu);

      div.addEventListener('pointerenter', e => {
        if ((e as PointerEvent).pointerType === 'touch') {
          if (div.classList.contains('disabled')) return;
          const parent = div.parentElement;
          if (parent) {
            parent.querySelectorAll(':scope > .menu-submenu.expanded').forEach(el => {
              if (el !== div) el.classList.remove('expanded');
            });
          }
          div.classList.add('expanded');
        }
      });

      div.addEventListener('click', e => {
        e.stopPropagation();
        if (div.classList.contains('disabled')) return;

        const wasExpanded = div.classList.contains('expanded');
        const parent = div.parentElement;
        if (parent) {
          parent.querySelectorAll(':scope > .menu-submenu.expanded').forEach(el => {
            if (el !== div) el.classList.remove('expanded');
          });
        }

        if (!wasExpanded) {
          div.classList.add('expanded');
        } else {
          div.classList.remove('expanded');
        }
      });
    } else {
      let labelHtml = '';

      if (parentHasCheckbox) {
        const checkMark = item.type === 'checkbox' && itemState.checked ? '✓' : '';
        labelHtml += `<span class="menu-check">${checkMark}</span>`;
      }

      labelHtml += `<span class="menu-label">${itemState.label}</span>`;

      if (item.accelerator) {
        labelHtml += `<span class="menu-shortcut">${formatAccelerator(item.accelerator, isMac)}</span>`;
      }

      div.innerHTML = labelHtml;

      div.addEventListener('click', e => {
        e.stopPropagation();
        if (div.classList.contains('disabled')) return;

        closeMenu();

        if (item.action) {
          callbacks.onAction(item.action, item.actionArg);
        }
      });
    }

    return div;
  }

  function render(container: HTMLElement): void {
    menuContainer = container;
    container.innerHTML = '';
    container.className = 'menu-dropdown';

    for (const item of filteredSchema) {
      const menuItem = createMenuItem(item, currentState);
      if (menuItem) {
        container.appendChild(menuItem);
      }
    }
  }

  function updateMenuItem(element: HTMLElement, item: MenuItemSchema, state: MenuState): void {
    const itemState = evaluateMenuItem(item, state, context);

    if (itemState.enabled) {
      element.classList.remove('disabled');
    } else {
      element.classList.add('disabled');
    }

    if (item.type === 'checkbox') {
      const checkEl = element.querySelector('.menu-check');
      if (checkEl) {
        checkEl.textContent = itemState.checked ? '✓' : '';
      }
    }
  }

  function updateState(state: MenuState): void {
    currentState = state;
    if (!menuContainer) return;

    function processItems(items: MenuItemSchema[]): void {
      for (const item of items) {
        const element = menuContainer!.querySelector(`[data-menu-id="${item.id}"]`) as HTMLElement;
        if (element) {
          updateMenuItem(element, item, state);
        }
        if (item.submenu) {
          processItems(item.submenu);
        }
      }
    }

    processItems(filteredSchema);
  }

  function destroy(): void {
    if (menuContainer) {
      menuContainer.innerHTML = '';
      menuContainer = null;
    }
  }

  return { render, updateState, destroy };
}
