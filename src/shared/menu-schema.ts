import type { MenuStateKey } from './menu-state';

export interface MenuItemSchema {
  id: string;
  label?: string;
  type?: 'normal' | 'separator' | 'submenu' | 'checkbox';
  accelerator?: string;
  action?: string;
  actionArg?: string;
  submenu?: MenuItemSchema[];
  role?: string;
  requires?: MenuStateKey[];
  disabledWhen?: MenuStateKey[];
  checkedWhen?: MenuStateKey;
  macOnly?: boolean;
  electronOnly?: boolean;
  webOnly?: boolean;
}

export const menuSchema: MenuItemSchema[] = [
  {
    id: 'file',
    label: 'File',
    type: 'submenu',
    submenu: [
      { id: 'new', label: 'New', accelerator: 'CmdOrCtrl+N', action: 'new-file' },
      { type: 'separator', id: 'sep-1' },
      { id: 'open', label: 'Open directB2S...', accelerator: 'CmdOrCtrl+O', action: 'open-file' },
      { type: 'separator', id: 'sep-2' },
      { id: 'save', label: 'Save', accelerator: 'CmdOrCtrl+S', action: 'save-file', requires: ['hasFile'] },
      {
        id: 'save-as',
        label: 'Save As...',
        accelerator: 'CmdOrCtrl+Shift+S',
        action: 'save-file-as',
        requires: ['hasFile'],
      },
      { type: 'separator', id: 'sep-close' },
      { id: 'close', label: 'Close', accelerator: 'CmdOrCtrl+W', action: 'close-file', requires: ['hasFile'] },
    ],
  },
  {
    id: 'edit',
    label: 'Edit',
    type: 'submenu',
    submenu: [
      { id: 'undo', label: 'Undo', accelerator: 'CmdOrCtrl+Z', action: 'undo', requires: ['canUndo'] },
      { id: 'redo', label: 'Redo', accelerator: 'CmdOrCtrl+Shift+Z', action: 'redo', requires: ['canRedo'] },
      { type: 'separator', id: 'sep-4' },
      { id: 'cut', label: 'Cut', accelerator: 'CmdOrCtrl+X', action: 'cut', requires: ['hasSelection'] },
      { id: 'copy', label: 'Copy', accelerator: 'CmdOrCtrl+C', action: 'copy', requires: ['hasSelection'] },
      { id: 'paste', label: 'Paste', accelerator: 'CmdOrCtrl+V', action: 'paste', requires: ['hasClipboard'] },
      { id: 'delete', label: 'Delete', accelerator: 'Delete', action: 'delete', requires: ['hasSelection'] },
      { type: 'separator', id: 'sep-5' },
      {
        id: 'select-all',
        label: 'Select All',
        accelerator: 'CmdOrCtrl+A',
        action: 'select-all',
        requires: ['hasFile'],
      },
      { id: 'deselect', label: 'Deselect', accelerator: 'Escape', action: 'deselect', requires: ['hasSelection'] },
    ],
  },
  {
    id: 'view',
    label: 'View',
    type: 'submenu',
    submenu: [
      { id: 'zoom-in', label: 'Zoom In', accelerator: 'CmdOrCtrl+Plus', action: 'zoom-in' },
      { id: 'zoom-out', label: 'Zoom Out', accelerator: 'CmdOrCtrl+Minus', action: 'zoom-out' },
      { id: 'zoom-fit', label: 'Fit to Window', accelerator: 'CmdOrCtrl+0', action: 'zoom-fit' },
      { id: 'zoom-100', label: 'Actual Size', accelerator: 'CmdOrCtrl+1', action: 'zoom-100' },
      { type: 'separator', id: 'sep-console' },
      { id: 'console', label: 'Console', accelerator: 'CmdOrCtrl+`', action: 'toggle-console' },
      { type: 'separator', id: 'sep-7', electronOnly: true },
      { id: 'reload', label: 'Reload', accelerator: 'CmdOrCtrl+R', role: 'reload', electronOnly: true },
      {
        id: 'devtools',
        label: 'Developer Tools',
        accelerator: 'CmdOrCtrl+Shift+I',
        role: 'toggleDevTools',
        electronOnly: true,
      },
    ],
  },
  {
    id: 'image',
    label: 'Image',
    type: 'submenu',
    submenu: [
      {
        id: 'import-images',
        label: 'Import Images',
        type: 'submenu',
        submenu: [
          {
            id: 'import-backglass-image',
            label: 'Import Backglass Image...',
            action: 'import-backglass-image',
            requires: ['hasFile'],
          },
          { type: 'separator', id: 'sep-img-1' },
          {
            id: 'import-illumination-image',
            label: 'Import Illumination Image...',
            action: 'import-illumination-image',
            requires: ['hasFile'],
          },
          { id: 'import-dmd-image', label: 'Import DMD Image...', action: 'import-dmd-image', requires: ['hasFile'] },
        ],
      },
      { type: 'separator', id: 'sep-img-2' },
      {
        id: 'dmd-area',
        label: 'DMD Area',
        type: 'submenu',
        submenu: [
          {
            id: 'copy-dmd-from-backglass',
            label: 'Copy DMD from Backglass',
            type: 'checkbox',
            action: 'copy-dmd-from-backglass',
            checkedWhen: 'copyDmdFromBackglass',
            requires: ['hasFile'],
          },
          { type: 'separator', id: 'sep-dmd-1' },
          {
            id: 'set-default-dmd-location',
            label: 'Set Default DMD Location',
            type: 'checkbox',
            action: 'set-default-dmd-location',
            checkedWhen: 'setDmdDefaultLocation',
            requires: ['hasFile'],
          },
        ],
      },
      {
        id: 'grill-height',
        label: 'Grill Height',
        type: 'submenu',
        submenu: [
          {
            id: 'set-grill-height',
            label: 'Set Grill Height',
            type: 'checkbox',
            action: 'set-grill-height',
            checkedWhen: 'setGrillHeight',
            requires: ['hasFile'],
          },
          { type: 'separator', id: 'sep-grill-1' },
          {
            id: 'set-mini-grill-height',
            label: 'Set Mini Grill Height',
            type: 'checkbox',
            action: 'set-mini-grill-height',
            checkedWhen: 'setSmallGrillHeight',
            requires: ['hasFile'],
          },
        ],
      },
      { type: 'separator', id: 'sep-img-3' },
      { id: 'resize-image', label: 'Resize...', action: 'resize-image', requires: ['hasFile'] },
      { type: 'separator', id: 'sep-img-4' },
      { id: 'brightness', label: 'Brightness...', action: 'adjust-brightness', requires: ['hasFile'] },
    ],
  },
  {
    id: 'reels-leds',
    label: 'Reels & LEDs',
    type: 'submenu',
    submenu: [
      { id: 'choose-reel-type', label: 'Choose Reel Type...', action: 'choose-reel-type', requires: ['hasFile'] },
      { type: 'separator', id: 'sep-reels-1' },
      {
        id: 'show-score-frames',
        label: 'Show Score Frames',
        type: 'checkbox',
        action: 'toggle-score-frames',
        checkedWhen: 'showScoreFrames',
        requires: ['hasFile'],
      },
      { type: 'separator', id: 'sep-reels-2' },
      { id: 'add-new-reel-frame', label: 'Add New Reel/LED Frame', action: 'add-score', requires: ['hasFile'] },
      { type: 'separator', id: 'sep-reels-3' },
      {
        id: 'show-scoring',
        label: 'Show Scoring',
        type: 'checkbox',
        action: 'toggle-scoring',
        checkedWhen: 'showScoring',
        requires: ['hasFile'],
      },
    ],
  },
  {
    id: 'illumination',
    label: 'Illumination',
    type: 'submenu',
    submenu: [
      {
        id: 'show-illumination-frames',
        label: 'Show Illumination Frames',
        type: 'checkbox',
        action: 'toggle-illumination-frames',
        checkedWhen: 'showIlluminationFrames',
        requires: ['hasFile'],
      },
      {
        id: 'select-all-illumination',
        label: 'Select All Illumination Frames',
        action: 'select-all-illumination',
        requires: ['hasFile'],
      },
      { type: 'separator', id: 'sep-illum-1' },
      { id: 'add-new-bulb-frame', label: 'Add New Bulb Frame', action: 'add-bulb', requires: ['hasFile'] },
      {
        id: 'add-illumination-snippet',
        label: 'Add Illumination Snippet...',
        action: 'add-illumination-snippet',
        requires: ['hasFile'],
      },
      { type: 'separator', id: 'sep-illum-2' },
      {
        id: 'show-illumination',
        label: 'Show Illumination',
        type: 'checkbox',
        action: 'toggle-illumination',
        checkedWhen: 'showIllumination',
        requires: ['hasFile'],
      },
      {
        id: 'show-illumination-intensity',
        label: 'Show Illumination with Accurate Intensity',
        type: 'checkbox',
        action: 'toggle-illumination-intensity',
        checkedWhen: 'showIlluminationIntensity',
        requires: ['hasFile'],
      },
      { type: 'separator', id: 'sep-illum-3' },
      { id: 'manage-animations', label: 'Manage Animations...', action: 'manage-animations', requires: ['hasFile'] },
      { type: 'separator', id: 'sep-illum-4' },
      { id: 'trim-all-snippets', label: 'Trim All Snippets', action: 'trim-all-snippets', requires: ['hasFile'] },
    ],
  },
  {
    id: 'backglass',
    label: 'Backglass',
    type: 'submenu',
    submenu: [
      {
        id: 'backglass-preview',
        label: 'Backglass Preview & Test...',
        action: 'backglass-preview',
        requires: ['hasFile'],
      },
      { type: 'separator', id: 'sep-bg-1' },
      {
        id: 'export-dark-backglass',
        label: 'Export Dark Backglass Image...',
        action: 'export-dark-backglass',
        requires: ['hasFile'],
      },
      {
        id: 'export-illuminated-backglass',
        label: 'Export Illuminated Backglass Image...',
        action: 'export-illuminated-backglass',
        requires: ['hasFile'],
      },
      { type: 'separator', id: 'sep-bg-2' },
      {
        id: 'create-directb2s',
        label: 'Create DirectB2S File...',
        action: 'create-directb2s',
        requires: ['hasFile'],
      },
    ],
  },
  {
    id: 'window',
    label: 'Window',
    type: 'submenu',
    submenu: [
      { id: 'show-backglass-tab', label: 'Backglass Image', accelerator: 'F3', action: 'show-backglass-tab' },
      { id: 'show-dmd-tab', label: 'DMD Image', accelerator: 'F4', action: 'show-dmd-tab' },
      { type: 'separator', id: 'sep-win-1' },
      { id: 'toggle-resources-panel', label: 'Resources', accelerator: 'F5', action: 'toggle-resources-panel' },
      { id: 'toggle-reels-panel', label: 'Reels && LEDs', accelerator: 'F6', action: 'toggle-reels-panel' },
      {
        id: 'toggle-illumination-panel',
        label: 'Illumination',
        accelerator: 'F7',
        action: 'toggle-illumination-panel',
      },
      { type: 'separator', id: 'sep-win-2' },
      {
        id: 'translucent',
        label: 'Translucent',
        type: 'checkbox',
        action: 'toggle-translucent',
        checkedWhen: 'isTranslucent',
        electronOnly: true,
      },
    ],
  },
  {
    id: 'preferences',
    label: 'Preferences',
    type: 'submenu',
    submenu: [{ id: 'settings', label: 'Editor / UI Options...', accelerator: 'CmdOrCtrl+,', action: 'open-settings' }],
  },
  {
    id: 'help',
    label: 'Help',
    type: 'submenu',
    submenu: [{ id: 'about', label: 'About VPX B2S Designer', action: 'show-about' }],
  },
];
