import type { DirectB2SData, TableType, DMDType, CommType, DestType } from '../types/data';
import { showModal, escapeHtml } from './modal';

export interface ProjectSettings {
  name: string;
  vsName: string;
  dualBackglass: boolean;
  author: string;
  artwork: string;
  tableType: TableType;
  addEMDefaults: boolean;
  numberOfPlayers: number;
  b2sDataCount: number;
  dmdType: DMDType;
  commType: CommType;
  destType: DestType;
}

export interface SettingsDialogOptions {
  mode: 'new' | 'edit' | 'saveas';
  data: DirectB2SData;
  latestAuthor?: string;
  onPickTableFile?: () => Promise<string | null>;
  onOk: (settings: ProjectSettings) => void;
  onCancel?: () => void;
}

export const MSG_ENTER_BACKGLASS_NAME =
  'Please enter a name for your backglass project, a backglass file name, a table type, the communication mode and the destination type.';
export const MSG_PROJECT_NAME_ENDS_WITH_B2S =
  "The project file name ends with 'B2S'. Please change this to avoid error messages with 'Hyperpin' or other tools.";

const TABLE_TYPES: { value: TableType; label: string }[] = [
  { value: 'NotDefined', label: '(choose a table type)' },
  { value: 'EM', label: 'EM - Electro Mechanical' },
  { value: 'SS', label: 'SS - Solid State Electronic' },
  { value: 'SSDMD', label: 'SS DMD - Solid State Electronic with DMD' },
  { value: 'ORI', label: 'OR - Original' },
];

const DMD_TYPES: { value: DMDType; label: string }[] = [
  { value: 'NotDefined', label: '(not set)' },
  { value: 'NoB2SDMD', label: "No 'B2S DMD'" },
  { value: 'B2SAlwaysOnSecondMonitor', label: "'B2S DMD' always on Backglass ('second monitor')" },
  { value: 'B2SAlwaysOnThirdMonitor', label: "'B2S DMD' only on DMD ('third monitor')" },
  { value: 'B2SOnSecondOrThirdMonitor', label: "'B2S DMD' on Backglass or DMD" },
];

const COMM_TYPES: { value: CommType; label: string }[] = [
  { value: 'NotDefined', label: '(choose a communication mode)' },
  { value: 'ROM', label: 'VPinMAME ROM communication' },
  { value: 'B2S', label: 'B2S data element communication' },
];

const DEST_TYPES: { value: DestType; label: string }[] = [
  { value: 'NotDefined', label: '(choose a destination type)' },
  { value: 'DirectB2S', label: "B2S.Server 'directB2S' backglass" },
  { value: 'VisualStudio2010', label: 'Microsoft Visual Studio 2010 project' },
];

function options<T extends string>(list: { value: T; label: string }[], current: T): string {
  return list
    .map(o => `<option value="${o.value}" ${o.value === current ? 'selected' : ''}>${escapeHtml(o.label)}</option>`)
    .join('');
}

export function showProjectSettingsDialog(opts: SettingsDialogOptions): void {
  const d = opts.data;
  const isNew = opts.mode === 'new';
  const isSaveAs = opts.mode === 'saveas';
  const blank = isNew || isSaveAs;
  const initialAuthor = blank ? opts.latestAuthor || '' : d.author;
  const initialArtwork = blank ? opts.latestAuthor || '' : d.artwork;

  const dataCountOptions = Array.from({ length: 51 }, (_, i) => i)
    .map(n => `<option value="${n}" ${(isNew ? 5 : d.b2sDataCount) === n ? 'selected' : ''}>${n}</option>`)
    .join('');
  const playerOptions = [0, 1, 2, 3, 4, 5, 6]
    .map(
      n =>
        `<option value="${n}" ${(isNew ? 4 : d.numberOfPlayers) === n ? 'selected' : ''}>${n === 0 ? '(not set)' : n}</option>`
    )
    .join('');

  const bodyHtml = `
    <div class="prop-group settings-dialog">
      <div class="prop-row">
        <label class="prop-label" id="ps-name-label">Project name:</label>
        <input type="text" class="prop-input" id="ps-name" value="${blank ? '' : escapeHtml(d.name)}">
      </div>
      <div class="prop-row">
        <label class="prop-label" id="ps-vsname-label">Backglass (file) name:</label>
        <input type="text" class="prop-input" id="ps-vsname" value="${blank ? '' : escapeHtml(d.vsName)}">
        <button class="win-btn" id="ps-pick-table" title="Choose a Visual Pinball table">...</button>
      </div>
      <div class="prop-row">
        <input type="checkbox" id="ps-dual" ${!blank && d.dualBackglass ? 'checked' : ''}>
        <label for="ps-dual" class="prop-label-inline">Dual backglass (contains Authentic and Fantasy)</label>
      </div>
      <div class="prop-row">
        <label class="prop-label">Author:</label>
        <input type="text" class="prop-input" id="ps-author" value="${escapeHtml(initialAuthor)}">
      </div>
      <div class="prop-row">
        <label class="prop-label">Artwork:</label>
        <input type="text" class="prop-input" id="ps-artwork" value="${escapeHtml(initialArtwork)}">
      </div>
      <div class="prop-row">
        <label class="prop-label" id="ps-tabletype-label">Table type:</label>
        <select class="prop-input" id="ps-tabletype">${options(TABLE_TYPES, isNew ? 'NotDefined' : d.tableType)}</select>
      </div>
      <div class="prop-row">
        <input type="checkbox" id="ps-emdefaults" ${!isNew && d.addEMDefaults ? 'checked' : ''}>
        <label for="ps-emdefaults" class="prop-label-inline">Create EM default code (24 reels, 4 rollover, ...)</label>
      </div>
      <div class="prop-row">
        <label class="prop-label">Number of players:</label>
        <select class="prop-input" id="ps-players">${playerOptions}</select>
      </div>
      <div class="prop-row">
        <label class="prop-label">B2S data count:</label>
        <select class="prop-input" id="ps-datacount">${dataCountOptions}</select>
      </div>
      <div class="prop-row">
        <label class="prop-label">'B2S DMD' location setting:</label>
        <select class="prop-input" id="ps-dmdtype">${options(DMD_TYPES, isNew ? 'NotDefined' : d.dmdType)}</select>
      </div>
      <div class="prop-row">
        <label class="prop-label" id="ps-comm-label">Communication mode:</label>
        <select class="prop-input" id="ps-comm">${options(COMM_TYPES, isNew ? 'NotDefined' : d.commType)}</select>
      </div>
      <div class="prop-row">
        <label class="prop-label" id="ps-dest-label">Destination type:</label>
        <select class="prop-input" id="ps-dest">${options(DEST_TYPES, isNew ? 'NotDefined' : d.destType)}</select>
      </div>
      <div class="prop-row prop-hint" id="ps-error"></div>
    </div>
  `;

  let okPressed = false;
  const handle = showModal({
    id: 'project-settings-modal',
    title: 'Settings',
    contentClass: 'project-settings-content',
    bodyHtml,
    onClose: () => {
      if (!okPressed) opts.onCancel?.();
    },
  });

  const el = handle.el;
  const q = <T extends HTMLElement>(id: string): T => el.querySelector(`#${id}`) as T;
  const nameIn = q<HTMLInputElement>('ps-name');
  const vsNameIn = q<HTMLInputElement>('ps-vsname');
  const dualChk = q<HTMLInputElement>('ps-dual');
  const authorIn = q<HTMLInputElement>('ps-author');
  const artworkIn = q<HTMLInputElement>('ps-artwork');
  const tableSel = q<HTMLSelectElement>('ps-tabletype');
  const emChk = q<HTMLInputElement>('ps-emdefaults');
  const playersSel = q<HTMLSelectElement>('ps-players');
  const dataCountSel = q<HTMLSelectElement>('ps-datacount');
  const dmdSel = q<HTMLSelectElement>('ps-dmdtype');
  const commSel = q<HTMLSelectElement>('ps-comm');
  const destSel = q<HTMLSelectElement>('ps-dest');
  const errorEl = q<HTMLElement>('ps-error');
  const okBtn = el.querySelector('[data-modal-action="ok"]') as HTMLButtonElement;

  const applyDependencies = (): void => {
    emChk.disabled = !(tableSel.value === 'EM' && destSel.value === 'VisualStudio2010');
    dataCountSel.disabled = !(commSel.value === 'B2S' && destSel.value === 'VisualStudio2010');
    if (commSel.value === 'ROM') {
      destSel.value = 'DirectB2S';
      destSel.disabled = true;
    } else {
      destSel.disabled = false;
    }
    const required: [HTMLElement, boolean][] = [
      [q('ps-name-label'), !nameIn.value.trim()],
      [q('ps-vsname-label'), !vsNameIn.value.trim()],
      [q('ps-tabletype-label'), tableSel.value === 'NotDefined'],
      [q('ps-comm-label'), commSel.value === 'NotDefined'],
      [q('ps-dest-label'), destSel.value === 'NotDefined'],
    ];
    for (const [label, missing] of required) label.classList.toggle('prop-label-error', missing);
  };

  tableSel.addEventListener('change', () => {
    const idx = tableSel.selectedIndex;
    if (idx === 0) {
      commSel.value = 'NotDefined';
      destSel.value = 'NotDefined';
    } else if (idx === 1 || idx === 4) {
      commSel.value = 'B2S';
    } else {
      commSel.value = 'ROM';
    }
    applyDependencies();
  });
  emChk.addEventListener('change', () => {
    if (emChk.checked) dataCountSel.value = '36';
  });
  commSel.addEventListener('change', applyDependencies);
  destSel.addEventListener('change', applyDependencies);
  nameIn.addEventListener('input', () => {
    nameIn.value = nameIn.value.replace(/\\/g, '');
    applyDependencies();
  });
  vsNameIn.addEventListener('input', applyDependencies);

  q<HTMLButtonElement>('ps-pick-table').addEventListener('click', async () => {
    if (!opts.onPickTableFile) return;
    const name = await opts.onPickTableFile();
    if (name) {
      vsNameIn.value = name;
      applyDependencies();
    }
  });

  okBtn.addEventListener(
    'click',
    e => {
      const missing =
        !nameIn.value.trim() ||
        !vsNameIn.value.trim() ||
        tableSel.value === 'NotDefined' ||
        commSel.value === 'NotDefined' ||
        destSel.value === 'NotDefined';
      if (missing) {
        e.stopImmediatePropagation();
        errorEl.textContent = MSG_ENTER_BACKGLASS_NAME;
        applyDependencies();
        return;
      }
      if (vsNameIn.value.trim().toUpperCase().endsWith('B2S')) {
        e.stopImmediatePropagation();
        errorEl.textContent = MSG_PROJECT_NAME_ENDS_WITH_B2S;
        return;
      }
      okPressed = true;
      opts.onOk({
        name: nameIn.value.trim(),
        vsName: vsNameIn.value.trim(),
        dualBackglass: dualChk.checked,
        author: authorIn.value,
        artwork: artworkIn.value,
        tableType: tableSel.value as TableType,
        addEMDefaults: emChk.checked,
        numberOfPlayers: parseInt(playersSel.value, 10) || 0,
        b2sDataCount: parseInt(dataCountSel.value, 10) || 0,
        dmdType: dmdSel.value as DMDType,
        commType: commSel.value as CommType,
        destType: destSel.value as DestType,
      });
    },
    true
  );

  applyDependencies();
  nameIn.focus();
}
