import type { Bulb, RotatingDirection, SnippetType, SnippetStopBehaviour } from '../types/data';
import { showModal, escapeHtml } from './modal';
import { state } from './state';

export const MSG_ENTER_SNIPPIT_NAME = 'Please enter a name for the snippit and choose a snippit type.';
export const MSG_ALREADY_ONE_SELF_ROTATING =
  'There is already one self rotating snippit. Only one self rotating snippit is allowed per backglass.';

export interface SnippetSettingsCallbacks {
  onSave: (changes: Partial<Bulb>) => void;
  onChangeImage: () => Promise<{ name: string; base64: string; width: number; height: number } | null>;
  onTrimImage: () => Promise<boolean>;
}

export function isThereAlreadyOneSelfRotatingSnippet(bulbId: number): boolean {
  return state.currentData.illumination.some(
    b => b.isImageSnippet && b.id !== bulbId && b.snippetType === 'SelfRotatingImage'
  );
}

export function showSnippetSettingsDialog(bulb: Bulb, callbacks: SnippetSettingsCallbacks): void {
  const typeIndex = (t: SnippetType): number => (t === 'SelfRotatingImage' ? 1 : t === 'MechRotatingImage' ? 2 : 0);
  const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));
  const zOrder = bulb.zOrder < 0 || bulb.zOrder > 9 ? 0 : bulb.zOrder;
  const mechId = clamp(bulb.snippetMechID, 1, 5);
  const steps = clamp(bulb.snippetRotatingSteps, 2, 90);
  const interval = clamp(bulb.snippetRotatingInterval, 10, 500);

  const bodyHtml = `
    <div class="prop-group">
      <div class="prop-row">
        <label class="prop-label">Name</label>
        <input type="text" class="prop-input" id="snip-name" value="${escapeHtml(bulb.name)}">
      </div>
      <div class="prop-row">
        <label class="prop-label">Type</label>
        <select class="prop-input" id="snip-type">
          <option value="0" ${typeIndex(bulb.snippetType) === 0 ? 'selected' : ''}>Standard image</option>
          <option value="1" ${typeIndex(bulb.snippetType) === 1 ? 'selected' : ''}>Self rotating image</option>
          <option value="2" ${typeIndex(bulb.snippetType) === 2 ? 'selected' : ''}>Mech rotating image</option>
        </select>
      </div>
      <div class="prop-row">
        <label class="prop-label">Z-Order</label>
        <input type="number" class="prop-input" id="snip-zorder" min="0" max="19" value="${zOrder}">
      </div>
      <div class="prop-row">
        <label class="prop-label">Mech ID</label>
        <input type="number" class="prop-input" id="snip-mech-id" min="1" max="5" value="${mechId}">
      </div>
      <div class="prop-row">
        <label class="prop-label">Rotating steps</label>
        <input type="number" class="prop-input" id="snip-steps" min="2" max="90" value="${steps}">
      </div>
      <div class="prop-row">
        <label class="prop-label">Rotating interval (ms)</label>
        <input type="number" class="prop-input" id="snip-interval" min="10" max="500" value="${interval}">
      </div>
      <div class="prop-row">
        <label class="prop-label">Rotating direction</label>
        <select class="prop-input" id="snip-direction">
          <option value="Clockwise" ${bulb.snippetRotatingDirection === 'Clockwise' ? 'selected' : ''}>Clockwise</option>
          <option value="AntiClockwise" ${bulb.snippetRotatingDirection === 'AntiClockwise' ? 'selected' : ''}>Anti-clockwise</option>
        </select>
      </div>
      <div class="prop-row">
        <label class="prop-label">Stop behaviour</label>
        <select class="prop-input" id="snip-stop">
          <option value="SpinOff" ${bulb.snippetRotatingStopBehaviour === 'SpinOff' ? 'selected' : ''}>Spin off</option>
          <option value="StopImmediately" ${bulb.snippetRotatingStopBehaviour === 'StopImmediately' ? 'selected' : ''}>Stop immediately</option>
          <option value="RunAnimationTillEnd" ${bulb.snippetRotatingStopBehaviour === 'RunAnimationTillEnd' ? 'selected' : ''}>Run animation till end</option>
          <option value="RunAnimationToFirstStep" ${bulb.snippetRotatingStopBehaviour === 'RunAnimationToFirstStep' ? 'selected' : ''}>Run animation to first step</option>
        </select>
      </div>
      <div class="prop-row prop-row-buttons">
        <button class="win-btn" id="snip-change-image">Change image...</button>
        <button class="win-btn" id="snip-trim-image">Trim image</button>
      </div>
      <div class="prop-row prop-hint" id="snip-error"></div>
    </div>
  `;

  let okPressed = false;
  let pendingImage: { name: string; base64: string; width: number; height: number } | null = null;

  const handle = showModal({
    id: 'snippet-settings-modal',
    title: 'Snippit settings',
    contentClass: 'snippet-settings-content',
    bodyHtml,
    onOk: modal => {
      okPressed = true;
      const typeSel = modal.querySelector('#snip-type') as HTMLSelectElement;
      const types: SnippetType[] = ['StandardImage', 'SelfRotatingImage', 'MechRotatingImage'];
      const changes: Partial<Bulb> = {
        name: (modal.querySelector('#snip-name') as HTMLInputElement).value,
        zOrder: clamp(parseInt((modal.querySelector('#snip-zorder') as HTMLInputElement).value, 10) || 0, 0, 19),
        snippetType: types[parseInt(typeSel.value, 10)] || 'StandardImage',
        snippetMechID: clamp(parseInt((modal.querySelector('#snip-mech-id') as HTMLInputElement).value, 10) || 1, 1, 5),
        snippetRotatingSteps: clamp(
          parseInt((modal.querySelector('#snip-steps') as HTMLInputElement).value, 10) || 2,
          2,
          90
        ),
        snippetRotatingInterval: clamp(
          parseInt((modal.querySelector('#snip-interval') as HTMLInputElement).value, 10) || 10,
          10,
          500
        ),
        snippetRotatingDirection: (modal.querySelector('#snip-direction') as HTMLSelectElement)
          .value as RotatingDirection,
        snippetRotatingStopBehaviour: (modal.querySelector('#snip-stop') as HTMLSelectElement)
          .value as SnippetStopBehaviour,
      };
      if (pendingImage) {
        changes.imageData = pendingImage.base64;
        changes.name = pendingImage.name;
        changes.width = pendingImage.width;
        changes.height = pendingImage.height;
      }
      callbacks.onSave(changes);
    },
  });

  const el = handle.el;
  const q = <T extends HTMLElement>(id: string): T => el.querySelector(`#${id}`) as T;
  const typeSel = q<HTMLSelectElement>('snip-type');
  const nameIn = q<HTMLInputElement>('snip-name');
  const errorEl = q<HTMLElement>('snip-error');
  const okBtn = el.querySelector('[data-modal-action="ok"]') as HTMLButtonElement;

  const enableDisable = (): void => {
    const t = parseInt(typeSel.value, 10);
    q<HTMLInputElement>('snip-mech-id').disabled = t !== 2;
    q<HTMLInputElement>('snip-steps').disabled = t === 0;
    q<HTMLInputElement>('snip-interval').disabled = t !== 1;
    q<HTMLSelectElement>('snip-direction').disabled = t === 0;
    q<HTMLSelectElement>('snip-stop').disabled = t !== 1;
  };

  let currentType = typeSel.value;
  typeSel.addEventListener('focus', () => {
    currentType = typeSel.value;
  });
  typeSel.addEventListener('change', () => {
    if (typeSel.value === '1' && isThereAlreadyOneSelfRotatingSnippet(bulb.id)) {
      errorEl.textContent = MSG_ALREADY_ONE_SELF_ROTATING;
      typeSel.value = currentType !== '1' ? currentType : '0';
    } else {
      errorEl.textContent = '';
    }
    currentType = typeSel.value;
    enableDisable();
  });

  okBtn.addEventListener(
    'click',
    e => {
      if (!nameIn.value.trim()) {
        e.stopImmediatePropagation();
        errorEl.textContent = MSG_ENTER_SNIPPIT_NAME;
        nameIn.focus();
      }
    },
    true
  );

  q<HTMLButtonElement>('snip-change-image').addEventListener('click', async () => {
    const result = await callbacks.onChangeImage();
    if (result) {
      pendingImage = result;
      nameIn.value = result.name;
      errorEl.textContent = `New image: ${result.width} x ${result.height}`;
    }
  });

  q<HTMLButtonElement>('snip-trim-image').addEventListener('click', async () => {
    const trimmed = await callbacks.onTrimImage();
    errorEl.textContent = trimmed ? 'Image trimmed.' : 'Nothing to trim.';
  });

  void okPressed;
  enableDisable();
  nameIn.focus();
}
