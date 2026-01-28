import { undoManager } from './undo';
import { render } from './canvas-renderer';
import { updatePropertiesPanel, updateAllLists } from './properties-panel';
import { showModal, escapeHtml } from './modal';

export function showUndoHistoryDialog(): void {
  const existing = document.getElementById('undo-history-modal');
  if (existing) {
    refreshList();
    return;
  }

  showModal({
    id: 'undo-history-modal',
    title: 'History',
    contentClass: 'undo-history-content',
    bodyHtml: `<div class="undo-history-list" id="undo-history-list"></div>`,
    okLabel: null,
    cancelLabel: 'Close',
  });

  refreshList();
}

function refreshList(): void {
  const list = document.getElementById('undo-history-list');
  if (!list) return;

  const undoStack = undoManager.getUndoStack();
  const redoStack = undoManager.getRedoStack();

  const undoEntries = undoStack
    .map(
      (desc, idx) => `<div class="undo-history-item" data-action="undo" data-index="${idx}">
        <span class="undo-history-icon">↶</span>${escapeHtml(desc)}
      </div>`
    )
    .reverse()
    .join('');

  const currentMarker = `<div class="undo-history-current">— current —</div>`;

  const redoEntries = redoStack
    .map(
      (desc, idx) => `<div class="undo-history-item undo-history-redo" data-action="redo" data-index="${idx}">
        <span class="undo-history-icon">↷</span>${escapeHtml(desc)}
      </div>`
    )
    .reverse()
    .join('');

  list.innerHTML = redoEntries + currentMarker + undoEntries;

  list.querySelectorAll('.undo-history-item').forEach(item => {
    item.addEventListener('click', () => {
      const action = (item as HTMLElement).dataset.action;
      const index = parseInt((item as HTMLElement).dataset.index || '0', 10);
      if (action === 'undo') {
        const stepsBack = undoManager.getUndoStack().length - index;
        for (let i = 0; i < stepsBack; i++) undoManager.undo();
      } else if (action === 'redo') {
        const stepsForward = undoManager.getRedoStack().length - index;
        for (let i = 0; i < stepsForward; i++) undoManager.redo();
      }
      render();
      updatePropertiesPanel();
      updateAllLists();
      refreshList();
    });
  });
}
