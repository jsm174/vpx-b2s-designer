export interface ModalOpts {
  id: string;
  title: string;
  bodyHtml: string;
  contentClass?: string;
  okLabel?: string | null;
  cancelLabel?: string;
  onOk?: (modal: HTMLElement) => void;
  onClose?: () => void;
}

export interface ModalHandle {
  el: HTMLElement;
  close(): void;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function showModal(opts: ModalOpts): ModalHandle {
  const existing = document.getElementById(opts.id);
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = opts.id;
  modal.className = 'modal';

  const okBtn =
    opts.okLabel === null
      ? ''
      : `<button class="modal-btn modal-btn-primary" data-modal-action="ok">${opts.okLabel || 'OK'}</button>`;

  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-content${opts.contentClass ? ' ' + opts.contentClass : ''}">
      <div class="modal-header">${escapeHtml(opts.title)}</div>
      <div class="modal-body">${opts.bodyHtml}</div>
      <div class="modal-footer">
        <button class="modal-btn modal-btn-cancel" data-modal-action="cancel">${opts.cancelLabel || 'Cancel'}</button>
        ${okBtn}
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const close = (): void => {
    modal.remove();
    opts.onClose?.();
  };

  modal.querySelector('.modal-backdrop')?.addEventListener('click', close);
  modal.querySelector('[data-modal-action="cancel"]')?.addEventListener('click', close);
  modal.querySelector('[data-modal-action="ok"]')?.addEventListener('click', () => {
    opts.onOk?.(modal);
    close();
  });

  return { el: modal, close };
}
