import { showConsoleContextMenu } from './context-menu';
import { resizeCanvas } from './canvas-renderer';
import './components/console-panel.css';

type ConsoleLineType = 'info' | 'success' | 'error' | 'warn';

const consoleOutput = document.getElementById('console-output') as HTMLElement | null;
const consoleResizeHandle = document.getElementById('console-resize-handle') as HTMLElement | null;
const consolePanel = document.getElementById('console-panel') as HTMLElement | null;
let consolePinned = false;
let consoleStartY = 0;
let consoleStartHeight = 0;

function formatTimestamp(): string {
  const now = new Date();
  const pad = (n: number, len = 2): string => String(n).padStart(len, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${pad(now.getMilliseconds(), 3)}`;
}

function clearConsole(): void {
  if (consoleOutput) {
    consoleOutput.innerHTML = '';
  }
}

function showConsole(): void {
  consolePanel?.classList.remove('hidden');
  consoleResizeHandle?.classList.remove('hidden');
  window.vpxB2sDesignerAPI.saveConsoleSettings({ visible: true });
  setTimeout(resizeCanvas, 0);
}

function hideConsole(): void {
  consolePanel?.classList.add('hidden');
  consoleResizeHandle?.classList.add('hidden');
  window.vpxB2sDesignerAPI.saveConsoleSettings({ visible: false });
  setTimeout(resizeCanvas, 0);
}

function appendConsoleLine(text: string, type: ConsoleLineType = 'info'): void {
  if (!consoleOutput) return;
  const lines = text.split('\n');
  const timestamp = formatTimestamp();
  for (const lineText of lines) {
    const line = document.createElement('div');
    line.className = `line ${type}`;
    line.textContent = `${timestamp}: ${lineText || ' '}`;
    consoleOutput.appendChild(line);
  }
  if (!consolePinned) {
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
  }
}

document.getElementById('console-pin')?.addEventListener('click', () => {
  consolePinned = !consolePinned;
  document.getElementById('console-pin')?.classList.toggle('active', consolePinned);
  if (!consolePinned && consoleOutput) {
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
  }
});

document.getElementById('console-clear')?.addEventListener('click', () => {
  clearConsole();
});

document.getElementById('console-close')?.addEventListener('click', () => {
  hideConsole();
});

consoleOutput?.addEventListener('contextmenu', (e: MouseEvent) => {
  e.preventDefault();
  showConsoleContextMenu(e.clientX, e.clientY, {
    onCopy: () => {
      const selectedText = window.getSelection()?.toString();
      if (selectedText) {
        navigator.clipboard.writeText(selectedText);
      }
    },
    onSelectAll: () => {
      const range = document.createRange();
      if (consoleOutput) {
        range.selectNodeContents(consoleOutput);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    },
    onClear: () => {
      clearConsole();
    },
  });
});

let consoleActivePointerId: number | null = null;

const onConsolePointerMove = (e: PointerEvent): void => {
  if (e.pointerId !== consoleActivePointerId || !consolePanel) return;
  const delta = consoleStartY - e.clientY;
  const newHeight = Math.max(100, Math.min(window.innerHeight * 0.5, consoleStartHeight + delta));
  consolePanel.style.height = `${newHeight}px`;
  resizeCanvas();
};

const onConsolePointerEnd = (e: PointerEvent): void => {
  if (e.pointerId !== consoleActivePointerId || !consoleResizeHandle) return;
  consoleActivePointerId = null;
  consoleResizeHandle.releasePointerCapture(e.pointerId);
  document.body.style.cursor = '';
  consoleResizeHandle.removeEventListener('pointermove', onConsolePointerMove);
  consoleResizeHandle.removeEventListener('pointerup', onConsolePointerEnd);
  consoleResizeHandle.removeEventListener('pointercancel', onConsolePointerEnd);
  if (consolePanel) {
    window.vpxB2sDesignerAPI.saveConsoleSettings({ height: consolePanel.offsetHeight });
  }
};

consoleResizeHandle?.addEventListener('pointerdown', (e: PointerEvent) => {
  if (consoleActivePointerId !== null || !consoleResizeHandle) return;
  consoleActivePointerId = e.pointerId;
  consoleStartY = e.clientY;
  consoleStartHeight = consolePanel?.offsetHeight || 0;
  consoleResizeHandle.setPointerCapture(e.pointerId);
  document.body.style.cursor = 'ns-resize';
  e.preventDefault();
  consoleResizeHandle.addEventListener('pointermove', onConsolePointerMove);
  consoleResizeHandle.addEventListener('pointerup', onConsolePointerEnd);
  consoleResizeHandle.addEventListener('pointercancel', onConsolePointerEnd);
});

function toggleConsole(): void {
  if (consolePanel?.classList.contains('hidden')) {
    showConsole();
  } else {
    hideConsole();
  }
}

window.addEventListener('toggle-console', toggleConsole);

async function initConsole(): Promise<void> {
  const api = window.vpxB2sDesignerAPI as unknown as {
    onToggleConsole?: (cb: () => void) => void;
  };

  api?.onToggleConsole?.(toggleConsole);

  const settings = await window.vpxB2sDesignerAPI.getConsoleSettings();
  if (settings && consolePanel && consoleResizeHandle) {
    if (settings.height) {
      consolePanel.style.height = `${settings.height}px`;
    }
    if (settings.visible === false) {
      consolePanel.classList.add('hidden');
      consoleResizeHandle.classList.add('hidden');
    }
  }

  let version = '0.1.0';
  if (window.vpxB2sDesignerAPI.getVersion) {
    version = await window.vpxB2sDesignerAPI.getVersion();
  }
  const isElectron = navigator.userAgent.includes('Electron');
  const platform = isElectron ? 'Desktop' : 'Web';
  appendConsoleLine(`B2S Designer ${version} [${platform}]`, 'info');
}

export { clearConsole, showConsole, hideConsole, appendConsoleLine, initConsole };
