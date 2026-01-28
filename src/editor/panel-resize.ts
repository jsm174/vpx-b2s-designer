import {
  LEFT_PANEL_MIN_WIDTH,
  LEFT_PANEL_MAX_WIDTH,
  RIGHT_PANEL_MIN_WIDTH,
  RIGHT_PANEL_MAX_WIDTH,
  SECTION_MIN_HEIGHT,
} from '../shared/constants';

export interface PanelSettings {
  leftPanelWidth?: number;
  rightPanelWidth?: number;
  sectionHeights?: Record<string, number>;
}

let panelSettings: PanelSettings = {};

function getSectionHeights(): Record<string, number> {
  const heights: Record<string, number> = {};
  const sections = ['resources', 'illumination', 'animations', 'scores'];
  sections.forEach(name => {
    const section = document.getElementById(`${name}-section`);
    if (section) {
      heights[name] = section.offsetHeight;
    }
  });
  return heights;
}

export function savePanelSettings(): void {
  panelSettings = {
    leftPanelWidth: document.getElementById('left-panel')?.offsetWidth,
    rightPanelWidth: document.getElementById('right-panel')?.offsetWidth,
    sectionHeights: getSectionHeights(),
  };

  window.vpxB2sDesignerAPI.savePanelSettings(panelSettings);
}

export async function loadPanelSettings(): Promise<void> {
  try {
    const panels = await window.vpxB2sDesignerAPI.getPanelSettings();
    if (!panels) return;

    if (panels.leftPanelWidth) {
      const panel = document.getElementById('left-panel');
      if (panel) panel.style.width = panels.leftPanelWidth + 'px';
    }
    if (panels.rightPanelWidth) {
      const panel = document.getElementById('right-panel');
      if (panel) panel.style.width = panels.rightPanelWidth + 'px';
    }
    if (panels.sectionHeights) {
      Object.entries(panels.sectionHeights).forEach(([name, height]) => {
        const section = document.getElementById(`${name}-section`);
        if (section && height > 0) {
          section.style.flex = 'none';
          section.style.height = height + 'px';
        }
      });
    }
  } catch {}
}

export function initLeftPanelResize(resizeCanvas: () => void): void {
  const handle = document.getElementById('left-resize-handle');
  const panel = document.getElementById('left-panel');
  if (!handle || !panel) return;

  let startX: number;
  let startWidth: number;
  let activePointerId: number | null = null;

  const onPointerMove = (e: PointerEvent): void => {
    if (e.pointerId !== activePointerId) return;
    const delta = e.clientX - startX;
    const newWidth = Math.min(LEFT_PANEL_MAX_WIDTH, Math.max(LEFT_PANEL_MIN_WIDTH, startWidth + delta));
    panel.style.width = newWidth + 'px';
    resizeCanvas();
  };

  const onPointerEnd = (e: PointerEvent): void => {
    if (e.pointerId !== activePointerId) return;
    activePointerId = null;
    handle.releasePointerCapture(e.pointerId);
    handle.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    handle.removeEventListener('pointermove', onPointerMove);
    handle.removeEventListener('pointerup', onPointerEnd);
    handle.removeEventListener('pointercancel', onPointerEnd);
    savePanelSettings();
  };

  handle.addEventListener('pointerdown', (e: PointerEvent) => {
    if (activePointerId !== null) return;
    activePointerId = e.pointerId;
    startX = e.clientX;
    startWidth = panel.offsetWidth;
    handle.setPointerCapture(e.pointerId);
    handle.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    handle.addEventListener('pointermove', onPointerMove);
    handle.addEventListener('pointerup', onPointerEnd);
    handle.addEventListener('pointercancel', onPointerEnd);
  });
}

export function initRightPanelResize(resizeCanvas: () => void): void {
  const handle = document.getElementById('right-resize-handle');
  const panel = document.getElementById('right-panel');
  if (!handle || !panel) return;

  let startX: number;
  let startWidth: number;
  let activePointerId: number | null = null;

  const onPointerMove = (e: PointerEvent): void => {
    if (e.pointerId !== activePointerId) return;
    const delta = startX - e.clientX;
    const newWidth = Math.min(RIGHT_PANEL_MAX_WIDTH, Math.max(RIGHT_PANEL_MIN_WIDTH, startWidth + delta));
    panel.style.width = newWidth + 'px';
    resizeCanvas();
  };

  const onPointerEnd = (e: PointerEvent): void => {
    if (e.pointerId !== activePointerId) return;
    activePointerId = null;
    handle.releasePointerCapture(e.pointerId);
    handle.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    handle.removeEventListener('pointermove', onPointerMove);
    handle.removeEventListener('pointerup', onPointerEnd);
    handle.removeEventListener('pointercancel', onPointerEnd);
    savePanelSettings();
  };

  handle.addEventListener('pointerdown', (e: PointerEvent) => {
    if (activePointerId !== null) return;
    activePointerId = e.pointerId;
    startX = e.clientX;
    startWidth = panel.offsetWidth;
    handle.setPointerCapture(e.pointerId);
    handle.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    handle.addEventListener('pointermove', onPointerMove);
    handle.addEventListener('pointerup', onPointerEnd);
    handle.addEventListener('pointercancel', onPointerEnd);
  });
}

export function initSectionResize(): void {
  const handles = document.querySelectorAll('.section-resize-handle');

  handles.forEach(handle => {
    const handleEl = handle as HTMLElement;
    const sectionName = handleEl.dataset.section;
    if (!sectionName) return;

    const section = document.getElementById(`${sectionName}-section`);
    const nextSection = handleEl.nextElementSibling as HTMLElement | null;
    if (!section) return;

    let startY: number;
    let startHeight: number;
    let nextStartHeight: number;
    let activePointerId: number | null = null;

    const onPointerMove = (e: PointerEvent): void => {
      if (e.pointerId !== activePointerId) return;
      const delta = e.clientY - startY;

      const newHeight = Math.max(SECTION_MIN_HEIGHT, startHeight + delta);
      section.style.flex = 'none';
      section.style.height = newHeight + 'px';

      if (nextSection?.classList.contains('resizable-section')) {
        const nextNewHeight = Math.max(SECTION_MIN_HEIGHT, nextStartHeight - delta);
        nextSection.style.flex = 'none';
        nextSection.style.height = nextNewHeight + 'px';
      }
    };

    const onPointerEnd = (e: PointerEvent): void => {
      if (e.pointerId !== activePointerId) return;
      activePointerId = null;
      handleEl.releasePointerCapture(e.pointerId);
      handleEl.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      handleEl.removeEventListener('pointermove', onPointerMove);
      handleEl.removeEventListener('pointerup', onPointerEnd);
      handleEl.removeEventListener('pointercancel', onPointerEnd);
      savePanelSettings();
    };

    handleEl.addEventListener('pointerdown', (e: PointerEvent) => {
      if (activePointerId !== null) return;
      activePointerId = e.pointerId;
      startY = e.clientY;
      startHeight = section.offsetHeight;
      nextStartHeight = nextSection?.offsetHeight || 0;
      handleEl.setPointerCapture(e.pointerId);
      handleEl.classList.add('dragging');
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
      handleEl.addEventListener('pointermove', onPointerMove);
      handleEl.addEventListener('pointerup', onPointerEnd);
      handleEl.addEventListener('pointercancel', onPointerEnd);
    });
  });
}

export function initPanelResize(resizeCanvas: () => void): void {
  initLeftPanelResize(resizeCanvas);
  initRightPanelResize(resizeCanvas);
  initSectionResize();
}
