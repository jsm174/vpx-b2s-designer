# B2S Designer Porting Plan

This document outlines the plan to port the B2S Backglass Designer from VB.NET Windows Forms to a cross-platform TypeScript application running on Electron and web.

## Overview

**Source**: B2S Backglass Designer (VB.NET, Windows Forms)
**Target**: TypeScript + Electron + Web (dual-platform like VPX Editor)
**Architecture Template**: VPX Editor (`/Users/jmillard/vpx/vpx-editor`)

## Phase 1: Project Foundation

### 1.1 Project Setup

Create the base project structure following VPX Editor patterns:

```
b2s-designer/
├── .gitignore
├── .prettierrc
├── package.json
├── tsconfig.json
├── forge.config.ts              # Electron Forge config
├── vite.main.config.ts          # Electron main process
├── vite.preload.config.ts       # Preload scripts
├── vite.renderer.config.ts      # Electron renderer
├── vite.web.config.ts           # Web build
├── index.html                   # Shared entry (with @electron-only/@web-only markers)
├── CLAUDE.md
└── src/
    ├── build/
    │   └── vite-plugin-html-transform.ts
    ├── desktop/
    │   ├── main.ts
    │   ├── window-context.ts
    │   └── window-registry.ts
    ├── web/
    │   ├── index.ts
    │   └── api-stub.ts
    ├── preload/
    │   └── index.ts
    ├── platform/
    │   ├── types.ts             # Platform interfaces
    │   ├── index.ts             # Factory
    │   ├── desktop/
    │   │   ├── index.ts
    │   │   ├── file-system.ts
    │   │   ├── dialogs.ts
    │   │   └── storage.ts
    │   └── web/
    │       ├── index.ts
    │       ├── file-system.ts
    │       ├── dialogs.ts
    │       └── storage.ts
    ├── format/                  # DirectB2S file format
    │   ├── types.ts             # Data structures
    │   ├── parser.ts            # XML → TypeScript
    │   ├── writer.ts            # TypeScript → XML
    │   └── base64.ts            # Image encoding/decoding
    ├── editor/
    │   ├── main.ts              # Editor initialization
    │   ├── canvas/
    │   │   ├── renderer.ts      # 2D canvas rendering
    │   │   ├── interaction.ts   # Mouse/keyboard handling
    │   │   └── selection.ts     # Selection management
    │   ├── components/
    │   │   ├── toolbar.ts
    │   │   ├── status-bar.ts
    │   │   └── tabs.ts          # Backglass/DMD tabs
    │   └── undo/
    │       ├── undo-manager.ts
    │       └── commands.ts
    ├── features/
    │   ├── illumination/
    │   ├── animations/
    │   ├── scores/
    │   └── images/
    ├── shared/
    │   ├── constants.ts
    │   ├── utils.ts
    │   └── menu-schema.ts
    └── types/
        ├── api.ts               # B2SDesignerAPI interface
        ├── data.ts              # Domain types
        └── ipc.ts               # IPC channel definitions
```

### 1.2 Configuration Files

**package.json** - Key dependencies:
```json
{
  "dependencies": {
    "electron-store": "latest",
    "fs-extra": "latest"
  },
  "devDependencies": {
    "@electron-forge/cli": "latest",
    "@electron-forge/plugin-vite": "latest",
    "electron": "latest",
    "typescript": "latest",
    "vite": "latest"
  }
}
```

**tsconfig.json** - Strict mode, path aliases:
```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "moduleResolution": "bundler",
    "paths": { "@/*": ["src/*"] }
  }
}
```

### 1.3 Platform Abstraction Layer

Port from VPX Editor with B2S-specific capabilities:

```typescript
// src/platform/types.ts
export interface Platform {
  capabilities: PlatformCapabilities;
  fileSystem: FileSystemProvider;
  dialogs: DialogProvider;
  storage: StorageProvider;
  menu: MenuProvider;

  init(): Promise<void>;
  getWorkDir(): string;
  joinPath(...parts: string[]): string;
}

export interface PlatformCapabilities {
  hasNativeMenus: boolean;
  hasNativeDialogs: boolean;
  hasNativeFileSystem: boolean;
  isOfflineCapable: boolean;
  platformName: 'electron' | 'web';
}

export interface FileSystemProvider {
  readFile(path: string): Promise<ArrayBuffer>;
  writeFile(path: string, data: ArrayBuffer): Promise<void>;
  readTextFile(path: string): Promise<string>;
  writeTextFile(path: string, content: string): Promise<void>;
}
```

## Phase 2: DirectB2S File Format

### 2.1 Data Types

Port from VB.NET classes to TypeScript interfaces:

```typescript
// src/format/types.ts

export interface DirectB2SData {
  version: string;                    // "1.27"
  name: string;
  tableType: TableType;
  dmdType: DMDType;
  commType: CommType;
  destType: DestType;
  projectGUID: string;
  vsName: string;
  author: string;
  gameName: string;
  grillHeight: number;

  animations: Animation[];
  scores: ScoreInfo[];
  illumination: Bulb[];
  images: ImageCollection;
  reels: ReelCollection;
}

export type TableType = 'EM' | 'SS' | 'SSDMD' | 'ORI';
export type DMDType = 'None' | 'BuiltIn' | 'External';
export type CommType = 'ROM' | 'B2S';
export type DestType = 'Authentic' | 'Fantasy';

export interface Bulb {
  id: number;
  name: string;
  parent: 'Backglass' | 'DMD';
  romId: number;
  romIdType: RomIdType;
  b2sId: number;
  b2sIdType: B2SIdType;
  lightColor: Color;
  dodgeColor?: Color;
  locX: number;
  locY: number;
  width: number;
  height: number;
  intensity: number;              // 1-5
  isImageSnippet: boolean;
  snippetRotatingDirection: RotatingDirection;
  text: string;
  textAlignment: number;
  fontName: string;
  fontSize: number;
  fontStyle: number;
  visible: boolean;
  initialState: InitialState;
  dualMode: DualMode;
  illuminationMode: IlluminationMode;
  zOrder: number;
}

export interface Animation {
  name: string;
  dualMode: DualMode;
  interval: number;               // milliseconds
  loops: number;
  idJoin: string;
  startAnimationAtRomStart: boolean;
  lightAtStart: LightState;
  lightAtEnd: LightState;
  animationStopBehaviour: StopBehaviour;
  lockAtLastStep: boolean;
  hideAtStart: boolean;
  bringToFront: boolean;
  randomStart: boolean;
  randomQuality: number;
  steps: AnimationStep[];
}

export interface AnimationStep {
  step: number;
  on: string;                     // comma-separated bulb IDs/names
  off: string;
  waitLoopsAfterOn: number;
  waitLoopsAfterOff: number;
  pulseSwitch: number;
}

export interface ScoreInfo {
  id: number;
  parent: 'Backglass' | 'DMD';
  reelType: ReelType;
  digits: number;
  spacing: number;
  locX: number;
  locY: number;
  width: number;
  height: number;
  reelColor: Color;
  reelColorDark?: Color;
  illumination: ScoreIllumination;
  b2sParams: B2SScoreParams;
  visible: boolean;
  soundEnabled: boolean;
  soundPath: string;
}

export interface ImageCollection {
  backgroundImages: BackgroundImage[];
  illuminatedImages: IlluminatedImage[];
  dmdImages: DMDImage[];
  thumbnailImage?: string;        // base64
}

export interface BackgroundImage {
  fileName: string;
  romId: number;
  romIdType: RomIdType;
  type: string;
  imageData: string;              // base64
}

export type Color = { r: number; g: number; b: number; a: number };
```

### 2.2 XML Parser

Parse directB2S XML to TypeScript objects:

```typescript
// src/format/parser.ts

export async function parseDirectB2S(xmlContent: string): Promise<DirectB2SData> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, 'text/xml');

  const root = doc.querySelector('DirectB2SData');
  if (!root) throw new Error('Invalid directB2S file: missing DirectB2SData root');

  return {
    version: root.getAttribute('Version') || '1.27',
    name: getAttributeValue(root, 'Name'),
    tableType: getAttributeValue(root, 'TableType') as TableType,
    // ... parse all fields
    animations: parseAnimations(root.querySelector('Animations')),
    scores: parseScores(root.querySelector('Scores')),
    illumination: parseIllumination(root.querySelector('Illumination')),
    images: parseImages(root.querySelector('Images')),
  };
}
```

### 2.3 XML Writer

Generate directB2S XML from TypeScript objects:

```typescript
// src/format/writer.ts

export function writeDirectB2S(data: DirectB2SData): string {
  const doc = document.implementation.createDocument(null, 'DirectB2SData', null);
  const root = doc.documentElement;

  root.setAttribute('Version', data.version);

  appendElement(root, 'Name', data.name);
  appendElement(root, 'TableType', data.tableType);
  // ... write all fields

  writeAnimations(root, data.animations);
  writeScores(root, data.scores);
  writeIllumination(root, data.illumination);
  writeImages(root, data.images);

  const serializer = new XMLSerializer();
  return serializer.serializeToString(doc);
}
```

### 2.4 Base64 Image Handling

```typescript
// src/format/base64.ts

export async function imageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]); // Remove data URL prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function base64ToImageUrl(base64: string, mimeType = 'image/png'): string {
  return `data:${mimeType};base64,${base64}`;
}

export async function base64ToBlob(base64: string, mimeType = 'image/png'): Promise<Blob> {
  const response = await fetch(`data:${mimeType};base64,${base64}`);
  return response.blob();
}
```

## Phase 3: Editor Core

### 3.1 Canvas Rendering

2D canvas for backglass editing:

```typescript
// src/editor/canvas/renderer.ts

export class BackglassRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private data: DirectB2SData | null = null;

  private zoom = 1;
  private panX = 0;
  private panY = 0;

  private backgroundImage: HTMLImageElement | null = null;
  private illuminationImages: Map<number, HTMLImageElement> = new Map();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  async loadBackglass(data: DirectB2SData): Promise<void> {
    this.data = data;
    await this.loadImages();
    this.render();
  }

  render(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.save();
    ctx.translate(this.panX, this.panY);
    ctx.scale(this.zoom, this.zoom);

    this.renderBackground();
    this.renderBulbs();
    this.renderScores();
    this.renderSelection();

    ctx.restore();
  }

  private renderBulbs(): void {
    for (const bulb of this.data?.illumination ?? []) {
      this.renderBulb(bulb);
    }
  }

  private renderBulb(bulb: Bulb): void {
    const ctx = this.ctx;

    // Draw bulb bounds
    ctx.strokeStyle = this.isSelected(bulb) ? '#00ff00' : '#ffff00';
    ctx.strokeRect(bulb.locX, bulb.locY, bulb.width, bulb.height);

    // Draw bulb preview (color fill for now)
    ctx.fillStyle = `rgba(${bulb.lightColor.r}, ${bulb.lightColor.g}, ${bulb.lightColor.b}, 0.5)`;
    ctx.fillRect(bulb.locX, bulb.locY, bulb.width, bulb.height);
  }
}
```

### 3.2 Interaction Handling

Mouse and keyboard events:

```typescript
// src/editor/canvas/interaction.ts

export class InteractionManager {
  private canvas: HTMLCanvasElement;
  private renderer: BackglassRenderer;
  private selection: SelectionManager;

  private isDragging = false;
  private dragStart: { x: number; y: number } | null = null;
  private dragType: 'pan' | 'move' | 'resize' | null = null;

  constructor(canvas: HTMLCanvasElement, renderer: BackglassRenderer) {
    this.canvas = canvas;
    this.renderer = renderer;
    this.selection = new SelectionManager();

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
    this.canvas.addEventListener('wheel', this.onWheel.bind(this));

    document.addEventListener('keydown', this.onKeyDown.bind(this));
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    this.renderer.setZoom(this.renderer.getZoom() * delta);
  }
}
```

### 3.3 Selection Management

```typescript
// src/editor/canvas/selection.ts

export class SelectionManager {
  private selectedBulbs: Set<number> = new Set();
  private selectedScores: Set<number> = new Set();

  selectBulb(id: number, additive = false): void {
    if (!additive) this.clearSelection();
    this.selectedBulbs.add(id);
    this.emit('selectionChanged');
  }

  getSelectedBulbs(): number[] {
    return Array.from(this.selectedBulbs);
  }

  clearSelection(): void {
    this.selectedBulbs.clear();
    this.selectedScores.clear();
    this.emit('selectionChanged');
  }
}
```

### 3.4 Undo/Redo System

```typescript
// src/editor/undo/undo-manager.ts

export interface UndoableCommand {
  execute(): void;
  undo(): void;
  description: string;
}

export class UndoManager {
  private undoStack: UndoableCommand[] = [];
  private redoStack: UndoableCommand[] = [];
  private maxHistory = 100;

  execute(command: UndoableCommand): void {
    command.execute();
    this.undoStack.push(command);
    this.redoStack = [];

    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
  }

  undo(): boolean {
    const command = this.undoStack.pop();
    if (command) {
      command.undo();
      this.redoStack.push(command);
      return true;
    }
    return false;
  }

  redo(): boolean {
    const command = this.redoStack.pop();
    if (command) {
      command.execute();
      this.undoStack.push(command);
      return true;
    }
    return false;
  }
}
```

## Phase 4: Feature Modules

### 4.1 Illumination Editor

Properties panel for bulbs:

```typescript
// src/features/illumination/panel.ts

export class IlluminationPanel {
  private container: HTMLElement;
  private currentBulb: Bulb | null = null;

  render(bulb: Bulb): void {
    this.currentBulb = bulb;
    this.container.innerHTML = `
      <div class="panel-section">
        <h3>Bulb Properties</h3>

        <div class="property-row">
          <label>Name</label>
          <input type="text" id="bulb-name" value="${bulb.name}" />
        </div>

        <div class="property-row">
          <label>Position</label>
          <input type="number" id="bulb-x" value="${bulb.locX}" />
          <input type="number" id="bulb-y" value="${bulb.locY}" />
        </div>

        <div class="property-row">
          <label>Size</label>
          <input type="number" id="bulb-width" value="${bulb.width}" />
          <input type="number" id="bulb-height" value="${bulb.height}" />
        </div>

        <div class="property-row">
          <label>Light Color</label>
          <input type="color" id="bulb-color" value="${colorToHex(bulb.lightColor)}" />
        </div>

        <div class="property-row">
          <label>Intensity</label>
          <input type="range" id="bulb-intensity" min="1" max="5" value="${bulb.intensity}" />
        </div>

        <div class="property-row">
          <label>ROM ID</label>
          <input type="number" id="bulb-romid" value="${bulb.romId}" />
        </div>
      </div>
    `;

    this.setupEventListeners();
  }
}
```

### 4.2 Animation Editor

Timeline-style animation editor:

```typescript
// src/features/animations/editor.ts

export class AnimationEditor {
  private animation: Animation | null = null;

  render(animation: Animation): void {
    this.animation = animation;
    // Render animation properties and step timeline
  }

  addStep(): AnimationStep {
    const step: AnimationStep = {
      step: (this.animation?.steps.length ?? 0),
      on: '',
      off: '',
      waitLoopsAfterOn: 0,
      waitLoopsAfterOff: 0,
      pulseSwitch: 0,
    };
    this.animation?.steps.push(step);
    return step;
  }

  playPreview(): void {
    // Animate through steps for preview
  }
}
```

### 4.3 Score/Reel Editor

```typescript
// src/features/scores/editor.ts

export class ScoreEditor {
  renderScoreProperties(score: ScoreInfo): void {
    // Render properties panel for score display
  }

  getReelTypes(): ReelType[] {
    return [
      'EMR_T1', 'EMR_T2', 'EMR_T3', 'EMR_T4', 'EMR_T5', 'EMR_T6',
      'EMR_CT1', 'EMR_CT2', 'EMR_CT3',
      'Dream7',
    ];
  }
}
```

### 4.4 Image Manager

```typescript
// src/features/images/manager.ts

export class ImageManager {
  private images: Map<string, { data: string; element: HTMLImageElement }> = new Map();

  async addImage(file: File): Promise<string> {
    const base64 = await imageToBase64(file);
    const id = crypto.randomUUID();

    const element = new Image();
    element.src = base64ToImageUrl(base64);
    await element.decode();

    this.images.set(id, { data: base64, element });
    return id;
  }

  getImage(id: string): HTMLImageElement | undefined {
    return this.images.get(id)?.element;
  }
}
```

## Phase 5: UI Components

### 5.1 Main Layout

```html
<!-- index.html -->
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>B2S Designer</title>
  <!-- @web-only -->
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!-- @end-web-only -->
  <link rel="stylesheet" href="src/shared/styles.css">
</head>
<body>
  <div id="app">
    <!-- Toolbar -->
    <div id="toolbar">
      <button id="btn-new">New</button>
      <button id="btn-open">Open</button>
      <button id="btn-save">Save</button>
      <div class="separator"></div>
      <button id="btn-undo">Undo</button>
      <button id="btn-redo">Redo</button>
    </div>

    <!-- Main content -->
    <div id="main-content">
      <!-- Left panel: tools/tree -->
      <div id="left-panel">
        <div id="illumination-tree"></div>
        <div id="animations-list"></div>
      </div>

      <!-- Center: canvas -->
      <div id="canvas-container">
        <div id="tabs">
          <button class="tab active" data-tab="backglass">Backglass</button>
          <button class="tab" data-tab="dmd">DMD</button>
        </div>
        <canvas id="editor-canvas"></canvas>
      </div>

      <!-- Right panel: properties -->
      <div id="right-panel">
        <div id="properties-panel"></div>
      </div>
    </div>

    <!-- Status bar -->
    <div id="status-bar">
      <span id="status-zoom">100%</span>
      <span id="status-coords">X: 0, Y: 0</span>
      <span id="status-file">No file loaded</span>
    </div>
  </div>

  <!-- @electron-only -->
  <script type="module" src="src/editor/main.ts"></script>
  <!-- @end-electron-only -->
  <!-- @web-only -->
  <script type="module" src="src/web/main.ts"></script>
  <!-- @end-web-only -->
</body>
</html>
```

### 5.2 Styling

```css
/* src/shared/styles.css */

:root {
  --bg-primary: #1e1e1e;
  --bg-secondary: #252526;
  --bg-tertiary: #2d2d30;
  --text-primary: #cccccc;
  --text-secondary: #808080;
  --accent: #0078d4;
  --border: #3c3c3c;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 13px;
  background: var(--bg-primary);
  color: var(--text-primary);
  overflow: hidden;
}

#app {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

#toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
}

#main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

#left-panel,
#right-panel {
  width: 250px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border);
  overflow-y: auto;
}

#right-panel {
  border-right: none;
  border-left: 1px solid var(--border);
}

#canvas-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

#editor-canvas {
  flex: 1;
  background: #000;
}

#status-bar {
  display: flex;
  gap: 16px;
  padding: 4px 8px;
  background: var(--bg-tertiary);
  border-top: 1px solid var(--border);
  font-size: 12px;
}
```

## Phase 6: Platform Integration

### 6.1 Electron Main Process

```typescript
// src/desktop/main.ts

import { app, BrowserWindow, ipcMain } from 'electron';
import { WindowRegistry } from './window-registry';
import { setupFileHandlers } from './file-handlers';
import { setupMenus } from './menus';

const registry = new WindowRegistry();

app.whenReady().then(async () => {
  setupFileHandlers(registry);
  setupMenus(registry);

  const mainWindow = await createMainWindow();
  registry.add(mainWindow);
});

async function createMainWindow(): Promise<BrowserWindow> {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  await win.loadFile('index.html');
  return win;
}
```

### 6.2 Preload Bridge

```typescript
// src/preload/index.ts

import { contextBridge, ipcRenderer } from 'electron';
import type { B2SDesignerAPI } from '../types/api';

const api: B2SDesignerAPI = {
  // File operations
  openFile: () => ipcRenderer.invoke('open-file'),
  saveFile: (path: string, content: string) => ipcRenderer.invoke('save-file', path, content),

  // Events
  onFileOpened: (callback) => {
    ipcRenderer.on('file-opened', (_, data) => callback(data));
  },

  // Editor state
  setDirty: (dirty: boolean) => ipcRenderer.send('set-dirty', dirty),
};

contextBridge.exposeInMainWorld('b2sDesignerAPI', api);
```

### 6.3 Web Implementation

```typescript
// src/web/index.ts

import type { B2SDesignerAPI } from '../types/api';

const api: B2SDesignerAPI = {
  openFile: async () => {
    const [fileHandle] = await window.showOpenFilePicker({
      types: [{ description: 'DirectB2S Files', accept: { 'application/xml': ['.directb2s'] } }],
    });
    const file = await fileHandle.getFile();
    const content = await file.text();
    return { path: file.name, content };
  },

  saveFile: async (path: string, content: string) => {
    const handle = await window.showSaveFilePicker({
      suggestedName: path,
      types: [{ description: 'DirectB2S Files', accept: { 'application/xml': ['.directb2s'] } }],
    });
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
  },

  onFileOpened: () => {},
  setDirty: () => {},
};

(window as any).b2sDesignerAPI = api;
```

## Implementation Order

### Milestone 1: Hello World (Week 1)
1. Set up project structure
2. Configure Vite + Electron Forge
3. Create platform abstraction layer
4. Basic window with canvas

### Milestone 2: File Format (Week 2)
1. Implement DirectB2S parser
2. Implement DirectB2S writer
3. Base64 image handling
4. Load and display backglass image

### Milestone 3: Canvas Editor (Week 3)
1. Pan/zoom functionality
2. Render bulbs on canvas
3. Selection and highlighting
4. Basic interaction (click to select)

### Milestone 4: Properties Panel (Week 4)
1. Bulb properties editing
2. Two-way binding (edit → canvas update)
3. Color picker
4. Position/size inputs

### Milestone 5: Full Editing (Week 5-6)
1. Add/delete bulbs
2. Drag to move bulbs
3. Resize handles
4. Undo/redo system

### Milestone 6: Animations (Week 7)
1. Animation list panel
2. Animation step editor
3. Animation preview/playback

### Milestone 7: Scores/Reels (Week 8)
1. Score display editing
2. Reel type selection
3. Reel preview rendering

### Milestone 8: Polish (Week 9-10)
1. Keyboard shortcuts
2. Context menus
3. File dirty state
4. Recent files
5. Settings/preferences

## Testing Strategy

1. **File Format Tests**: Round-trip parsing (load → save → load)
2. **Rendering Tests**: Visual regression with snapshots
3. **Integration Tests**: Full workflows (open, edit, save)
4. **Cross-Platform Tests**: Verify web and Electron parity

## Reference Materials

- Original VB.NET source: `/Users/jmillard/vpx/b2s-backglass-master`
- VPX Editor architecture: `/Users/jmillard/vpx/vpx-editor`
- DirectB2S file samples: Look for `.directb2s` files in pinball table packages
