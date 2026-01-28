import { app, BrowserWindow, ipcMain, dialog, nativeTheme } from 'electron';
import * as path from 'path';
import * as fs from 'fs-extra';
import { setApplicationMenu, type ElectronMenuContext } from '../shared/menu-renderer-electron';
import { createDefaultMenuState, type MenuState } from '../shared/menu-state';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

interface EditorSettings {
  theme: string;
  panelSettings?: { leftPanelWidth?: number; rightPanelWidth?: number };
  recentFiles: string[];
  consoleHeight?: number;
  consoleVisible?: boolean;
}

const MAX_RECENT_FILES = 10;

interface WindowContext {
  window: BrowserWindow;
  filePath: string | null;
  isDirty: boolean;
  closeConfirmed: boolean;
  animationEditorWindow: BrowserWindow | null;
  resizeWindow: BrowserWindow | null;
  pendingFile: { path: string; content: string } | null;
  rendererMenuState: Partial<MenuState>;
}

const DEFAULT_SETTINGS: EditorSettings = {
  theme: 'system',
  recentFiles: [],
};

let settings: EditorSettings = { ...DEFAULT_SETTINGS };
const windowRegistry: Map<number, WindowContext> = new Map();

function getSettingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}

function loadSettings(): void {
  try {
    const data = fs.readFileSync(getSettingsPath(), 'utf-8');
    const saved = JSON.parse(data) as Partial<EditorSettings>;
    settings = { ...DEFAULT_SETTINGS, ...saved };
    settings.recentFiles = (settings.recentFiles || []).filter(f => fs.existsSync(f));
  } catch {
    settings = { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(): void {
  try {
    fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

function addToRecentFiles(filePath: string): void {
  settings.recentFiles = settings.recentFiles.filter(f => f.toLowerCase() !== filePath.toLowerCase());
  settings.recentFiles.unshift(filePath);
  if (settings.recentFiles.length > MAX_RECENT_FILES) {
    settings.recentFiles = settings.recentFiles.slice(0, MAX_RECENT_FILES);
  }
  saveSettings();
  setupMenu();
}

function removeFromRecentFiles(filePath: string): void {
  settings.recentFiles = settings.recentFiles.filter(f => f.toLowerCase() !== filePath.toLowerCase());
  saveSettings();
  setupMenu();
}

function clearRecentFiles(): void {
  settings.recentFiles = [];
  saveSettings();
  setupMenu();
}

async function openRecentFile(filePath: string): Promise<void> {
  if (!fs.existsSync(filePath)) {
    dialog.showErrorBox('File Not Found', `The file could not be found:\n${filePath}`);
    removeFromRecentFiles(filePath);
    return;
  }

  const existingCtx = findContextByFilePath(filePath);
  if (existingCtx) {
    existingCtx.window.focus();
    return;
  }

  await openFileInNewWindow(filePath);
}

function showAboutDialog(): void {
  dialog.showMessageBox({
    type: 'info',
    title: 'About VPX B2S Designer',
    message: 'VPX B2S Designer',
    detail: 'A cross-platform backglass editor for Visual Pinball.\n\nVersion 0.1.0',
    buttons: ['OK'],
  });
}

function getThemeForWindow(): 'dark' | 'light' {
  if (settings.theme === 'system') {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  }
  return settings.theme as 'dark' | 'light';
}

function getContextFromWindow(win: BrowserWindow | null): WindowContext | undefined {
  if (!win) return undefined;
  return windowRegistry.get(win.id);
}

function getFocusedContext(): WindowContext | undefined {
  const win = BrowserWindow.getFocusedWindow();
  return getContextFromWindow(win);
}

function findContextByFilePath(filePath: string): WindowContext | undefined {
  const normalized = filePath.toLowerCase();
  for (const ctx of windowRegistry.values()) {
    if (ctx.filePath && ctx.filePath.toLowerCase() === normalized) {
      return ctx;
    }
  }
  return undefined;
}

function closeChildWindows(ctx: WindowContext): void {
  if (ctx.animationEditorWindow && !ctx.animationEditorWindow.isDestroyed()) {
    ctx.animationEditorWindow.destroy();
    ctx.animationEditorWindow = null;
  }
  if (ctx.resizeWindow && !ctx.resizeWindow.isDestroyed()) {
    ctx.resizeWindow.destroy();
    ctx.resizeWindow = null;
  }
}

function getContextFromEvent(event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent): WindowContext | undefined {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return undefined;

  for (const ctx of windowRegistry.values()) {
    if (ctx.window.id === win.id) return ctx;
    if (ctx.animationEditorWindow?.id === win.id) return ctx;
    if (ctx.resizeWindow?.id === win.id) return ctx;
  }
  return undefined;
}

async function openAnimationEditorWindow(parentCtx: WindowContext, animation: unknown, isNew: boolean): Promise<void> {
  if (parentCtx.animationEditorWindow) {
    parentCtx.animationEditorWindow.focus();
    parentCtx.animationEditorWindow.webContents.send('init-animation-editor', {
      animation,
      isNew,
      theme: getThemeForWindow(),
    });
    return;
  }

  const theme = getThemeForWindow();
  const win = new BrowserWindow({
    width: 900,
    height: 600,
    minWidth: 700,
    minHeight: 400,
    parent: parentCtx.window,
    modal: false,
    show: false,
    backgroundColor: theme === 'dark' ? '#1e1e1e' : '#f3f3f3',
    webPreferences: {
      preload: path.join(__dirname, 'animation-editor.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  parentCtx.animationEditorWindow = win;

  win.once('ready-to-show', () => {
    win.show();
    win.webContents.send('init-animation-editor', {
      animation,
      isNew,
      theme: getThemeForWindow(),
    });
  });

  win.on('closed', () => {
    parentCtx.animationEditorWindow = null;
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    const devUrl = MAIN_WINDOW_VITE_DEV_SERVER_URL.replace(/\/$/, '');
    await win.loadURL(`${devUrl}/src/features/animations/desktop/window.html?theme=${theme}`);
  } else {
    await win.loadFile(path.join(__dirname, '../renderer/main_window/src/features/animations/desktop/window.html'), {
      query: { theme },
    });
  }
}

async function openResizeWindow(parentCtx: WindowContext, width: number, height: number): Promise<void> {
  if (parentCtx.resizeWindow) {
    parentCtx.resizeWindow.focus();
    parentCtx.resizeWindow.webContents.send('init-resize', {
      width,
      height,
      theme: getThemeForWindow(),
    });
    return;
  }

  const theme = getThemeForWindow();
  const win = new BrowserWindow({
    width: 320,
    height: 260,
    title: 'Resize Image',
    resizable: false,
    minimizable: false,
    maximizable: false,
    parent: parentCtx.window,
    modal: false,
    show: false,
    backgroundColor: theme === 'dark' ? '#1e1e1e' : '#f3f3f3',
    webPreferences: {
      preload: path.join(__dirname, 'resize.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  parentCtx.resizeWindow = win;
  parentCtx.window.webContents.send('set-input-disabled', true);

  win.once('ready-to-show', () => {
    win.show();
    win.webContents.send('init-resize', {
      width,
      height,
      theme: getThemeForWindow(),
    });
  });

  win.on('closed', () => {
    parentCtx.resizeWindow = null;
    parentCtx.window.webContents.send('set-input-disabled', false);
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    const devUrl = MAIN_WINDOW_VITE_DEV_SERVER_URL.replace(/\/$/, '');
    await win.loadURL(`${devUrl}/src/features/resize/desktop/window.html?theme=${theme}`);
  } else {
    await win.loadFile(path.join(__dirname, '../renderer/main_window/src/features/resize/desktop/window.html'), {
      query: { theme },
    });
  }
}

function updateWindowTitle(ctx: WindowContext): void {
  const fileName = ctx.filePath ? path.basename(ctx.filePath) : 'Untitled';
  const dirtyMark = ctx.isDirty ? ' •' : '';
  ctx.window.setTitle(`VPX B2S Designer - ${fileName}${dirtyMark}`);
}

function findEmptyContext(): WindowContext | undefined {
  for (const ctx of windowRegistry.values()) {
    if (!ctx.filePath && !ctx.isDirty) return ctx;
  }
  return undefined;
}

async function createWindow(): Promise<WindowContext> {
  const theme = getThemeForWindow();
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    show: false,
    backgroundColor: theme === 'dark' ? '#1e1e1e' : '#f3f3f3',
    webPreferences: {
      preload: path.join(__dirname, 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  const ctx: WindowContext = {
    window: win,
    filePath: null,
    isDirty: false,
    closeConfirmed: false,
    animationEditorWindow: null,
    resizeWindow: null,
    pendingFile: null,
    rendererMenuState: {},
  };

  windowRegistry.set(win.id, ctx);

  win.on('focus', () => {
    setupMenu();
  });

  win.on('close', async e => {
    if (ctx.isDirty && !ctx.closeConfirmed) {
      e.preventDefault();
      const result = await dialog.showMessageBox(win, {
        type: 'warning',
        message: 'Do you want to save the changes you made?',
        detail: "Your changes will be lost if you don't save them.",
        buttons: ['Save', "Don't Save", 'Cancel'],
        defaultId: 0,
        cancelId: 2,
      });

      if (result.response === 2) return;
      if (result.response === 0) {
        win.webContents.send('save-before-close');
        return;
      }
      ctx.closeConfirmed = true;
      win.close();
    }
  });

  win.on('closed', () => {
    closeChildWindows(ctx);
    windowRegistry.delete(win.id);
    setupMenu();
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    await win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    await win.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  return ctx;
}

function getMenuState(): MenuState {
  const focusedCtx = getFocusedContext();
  const hasFile = !!focusedCtx?.filePath || focusedCtx?.isDirty === true;

  return {
    ...createDefaultMenuState(),
    hasFile,
    hasSelection: false,
    hasClipboard: false,
    canUndo: false,
    canRedo: false,
    isDirty: focusedCtx?.isDirty ?? false,
    ...(focusedCtx?.rendererMenuState || {}),
  };
}

function getActiveContext(): WindowContext | undefined {
  const focused = getFocusedContext();
  if (focused) return focused;
  const contexts = Array.from(windowRegistry.values());
  return contexts.length > 0 ? contexts[0] : undefined;
}

function handleMenuAction(action: string): void {
  const ctx = getActiveContext();

  switch (action) {
    case 'new-file':
      handleNew();
      break;
    case 'open-file':
      handleOpen();
      break;
    case 'save-file':
      ctx?.window.webContents.send('save-requested');
      break;
    case 'save-file-as':
      ctx?.window.webContents.send('save-as-requested');
      break;
    case 'close-file':
      ctx?.window.close();
      break;
    case 'toggle-console':
      ctx?.window.webContents.send('toggle-console');
      break;
    default:
      ctx?.window.webContents.send('menu-action', action);
      break;
  }
}

function setupMenu(): void {
  const menuContext: ElectronMenuContext = {
    getMenuState,
    handleAction: handleMenuAction,
    getRecentFiles: () => settings.recentFiles,
    openRecentFile: (filePath: string) => openRecentFile(filePath),
    clearRecentFiles: () => clearRecentFiles(),
    showAboutDialog: () => showAboutDialog(),
    showSettings: () => {
      const ctx = getActiveContext();
      ctx?.window.webContents.send('show-settings');
    },
    appName: 'VPX B2S Designer',
  };

  setApplicationMenu(menuContext);
}

async function handleNew(): Promise<void> {
  const focusedCtx = getFocusedContext();
  if (focusedCtx && !focusedCtx.filePath && !focusedCtx.isDirty) {
    focusedCtx.window.webContents.send('new-file');
    return;
  }

  const emptyCtx = findEmptyContext();
  if (emptyCtx) {
    emptyCtx.window.webContents.send('new-file');
    emptyCtx.window.focus();
    return;
  }

  const ctx = await createWindow();
  ctx.window.webContents.once('did-finish-load', () => {
    ctx.window.webContents.send('new-file');
  });
}

async function handleOpen(targetWindow?: BrowserWindow): Promise<void> {
  const win = targetWindow || BrowserWindow.getFocusedWindow();

  const result = await dialog.showOpenDialog({
    title: 'Open DirectB2S File',
    filters: [
      { name: 'DirectB2S Files', extensions: ['directb2s'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });

  if (result.canceled || result.filePaths.length === 0) return;

  const filePath = result.filePaths[0];

  const existingCtx = findContextByFilePath(filePath);
  if (existingCtx) {
    existingCtx.window.focus();
    return;
  }

  try {
    const content = await fs.readFile(filePath, 'utf-8');

    let ctx = win ? getContextFromWindow(win) : undefined;
    const isNewWindow = !ctx || ctx.filePath || ctx.isDirty;
    if (isNewWindow) {
      ctx = await createWindow();
    }

    if (!ctx) return;

    ctx.pendingFile = { path: filePath, content };
    ctx.filePath = filePath;
    ctx.isDirty = false;
    ctx.closeConfirmed = false;
    updateWindowTitle(ctx);
    ctx.window.webContents.send('file-ready');
    ctx.window.focus();
    addToRecentFiles(filePath);
  } catch (err) {
    dialog.showErrorBox('Error', `Failed to open file: ${err}`);
  }
}

async function openFileInNewWindow(filePath: string): Promise<void> {
  const existingCtx = findContextByFilePath(filePath);
  if (existingCtx) {
    existingCtx.window.focus();
    return;
  }

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const emptyCtx = findEmptyContext();
    const ctx = emptyCtx || (await createWindow());

    ctx.pendingFile = { path: filePath, content };
    ctx.filePath = filePath;
    ctx.isDirty = false;
    updateWindowTitle(ctx);
    ctx.window.webContents.send('file-ready');
    ctx.window.focus();
    addToRecentFiles(filePath);
  } catch (err) {
    dialog.showErrorBox('Error', `Failed to open file: ${err}`);
  }
}

function setupIpcHandlers(): void {
  ipcMain.handle('open-file', async event => {
    const win = BrowserWindow.fromWebContents(event.sender);
    await handleOpen(win || undefined);
    return null;
  });

  ipcMain.handle('save-file', async (event, filePath: string, content: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const ctx = getContextFromWindow(win);

    try {
      await fs.writeFile(filePath, content, 'utf-8');
      if (ctx) {
        const isNewPath = ctx.filePath !== filePath;
        ctx.filePath = filePath;
        ctx.isDirty = false;
        ctx.closeConfirmed = false;
        updateWindowTitle(ctx);
        if (isNewPath) {
          addToRecentFiles(filePath);
        }
      }
      return true;
    } catch (err) {
      dialog.showErrorBox('Error', `Failed to save file: ${err}`);
      return false;
    }
  });

  ipcMain.handle('save-file-as', async (event, content: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const ctx = getContextFromWindow(win);

    const result = await dialog.showSaveDialog({
      title: 'Save DirectB2S File',
      defaultPath: ctx?.filePath || 'backglass.directb2s',
      filters: [{ name: 'DirectB2S Files', extensions: ['directb2s'] }],
    });

    if (result.canceled || !result.filePath) return null;

    try {
      await fs.writeFile(result.filePath, content, 'utf-8');
      if (ctx) {
        ctx.filePath = result.filePath;
        ctx.isDirty = false;
        ctx.closeConfirmed = false;
        updateWindowTitle(ctx);
      }
      addToRecentFiles(result.filePath);
      return { path: result.filePath };
    } catch (err) {
      dialog.showErrorBox('Error', `Failed to save file: ${err}`);
      return null;
    }
  });

  ipcMain.handle('show-open-dialog', async (_event, options) => {
    const dialogOptions: Electron.OpenDialogOptions = {
      title: options.title,
      filters: options.filters,
      defaultPath: options.defaultPath,
      properties: options.multiSelections ? ['openFile', 'multiSelections'] : ['openFile'],
    };
    const result = await dialog.showOpenDialog(dialogOptions);
    if (result.canceled || result.filePaths.length === 0) return null;

    const filePath = result.filePaths[0];
    if (options.readContents) {
      const binaryContent = await fs.promises.readFile(filePath);
      return { filePath, binaryContent: new Uint8Array(binaryContent) };
    }
    return { filePath };
  });

  ipcMain.handle('show-save-dialog', async (_event, options) => {
    const result = await dialog.showSaveDialog(options);
    if (result.canceled) return null;
    return result.filePath;
  });

  ipcMain.handle('show-message-box', async (_event, options) => {
    const result = await dialog.showMessageBox(options);
    return result.response;
  });

  ipcMain.on('set-dirty', (event, dirty: boolean) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const ctx = getContextFromWindow(win);
    if (ctx) {
      ctx.isDirty = dirty;
      ctx.closeConfirmed = false;
      updateWindowTitle(ctx);
    }
  });

  ipcMain.on('set-title', (event, title: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.setTitle(title);
  });

  ipcMain.on('close-after-save', event => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const ctx = getContextFromWindow(win);
    if (ctx) {
      ctx.closeConfirmed = true;
      win?.close();
    }
  });

  ipcMain.handle('get-settings', () => {
    return settings;
  });

  ipcMain.handle('save-settings', (_event, newSettings: Partial<EditorSettings>) => {
    settings = { ...settings, ...newSettings };
    saveSettings();
    return settings;
  });

  ipcMain.handle('show-about', () => {
    showAboutDialog();
  });

  ipcMain.handle('get-theme', () => {
    return getThemeForWindow();
  });

  ipcMain.handle('get-pending-file', event => {
    const ctx = getContextFromEvent(event);
    if (ctx?.pendingFile) {
      const file = ctx.pendingFile;
      ctx.pendingFile = null;
      return file;
    }
    return null;
  });

  ipcMain.on('open-animation-editor', (event, animation, isNew) => {
    const ctx = getContextFromEvent(event);
    if (ctx) {
      openAnimationEditorWindow(ctx, animation, isNew);
    }
  });

  ipcMain.handle('save-animation', (event, animation, isNew) => {
    const ctx = getContextFromEvent(event);
    if (ctx) {
      ctx.window.webContents.send('animation-saved', { animation, isNew });
    }
  });

  ipcMain.handle('delete-animation', (event, name) => {
    const ctx = getContextFromEvent(event);
    if (ctx) {
      ctx.window.webContents.send('animation-deleted', { name });
    }
  });

  ipcMain.on('close-animation-editor', event => {
    const ctx = getContextFromEvent(event);
    if (ctx?.animationEditorWindow) {
      ctx.animationEditorWindow.close();
    }
  });

  ipcMain.on('open-resize', (event, width: number, height: number) => {
    const ctx = getContextFromEvent(event);
    if (ctx) {
      openResizeWindow(ctx, width, height);
    }
  });

  ipcMain.on('resize-result', (event, settings) => {
    const ctx = getContextFromEvent(event);
    if (ctx) {
      ctx.window.webContents.send('resize-result', settings);
      if (ctx.resizeWindow) {
        ctx.resizeWindow.close();
      }
    }
  });

  ipcMain.on('close-resize', event => {
    const ctx = getContextFromEvent(event);
    if (ctx?.resizeWindow) {
      ctx.resizeWindow.close();
    }
  });

  ipcMain.handle('get-console-settings', () => {
    return {
      height: settings.consoleHeight,
      visible: settings.consoleVisible,
    };
  });

  ipcMain.handle('save-console-settings', (_event, consoleSettings: { visible?: boolean; height?: number }) => {
    if (consoleSettings.height !== undefined) {
      settings.consoleHeight = consoleSettings.height;
    }
    if (consoleSettings.visible !== undefined) {
      settings.consoleVisible = consoleSettings.visible;
    }
    saveSettings();
  });

  ipcMain.handle('get-version', () => {
    return app.getVersion();
  });

  ipcMain.on('update-menu-state', (event, partialState: Partial<MenuState>) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const ctx = getContextFromWindow(win);
    if (ctx) {
      ctx.rendererMenuState = { ...ctx.rendererMenuState, ...partialState };
      setupMenu();
    }
  });
}

app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (filePath.toLowerCase().endsWith('.directb2s')) {
    if (app.isReady()) {
      openFileInNewWindow(filePath);
    } else {
      app.whenReady().then(() => openFileInNewWindow(filePath));
    }
  }
});

app.whenReady().then(async () => {
  loadSettings();
  setupMenu();
  setupIpcHandlers();
  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
