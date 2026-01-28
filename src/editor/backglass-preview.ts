import { state } from './state';
import { compositeIllumination, ensureSnippetImagesLoaded } from './illumination-render';
import type { Animation, Bulb } from '../types/data';

interface RenderOpts {
  useIntensity: boolean;
  illumOn: boolean;
  litFilter?: Set<number> | null;
}

function renderIlluminated(canvas: HTMLCanvasElement, opts: RenderOpts): void {
  const isDmd = state.activeTab === 'dmd';
  const bg = isDmd ? state.dmdImage : state.backgroundImage;
  if (!bg) return;
  canvas.width = bg.width;
  canvas.height = bg.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bg, 0, 0);
  if (!opts.illumOn) return;

  const parent = isDmd ? 'DMD' : 'Backglass';
  const bulbs = state.currentData.illumination.filter(b => b.parent === parent);
  compositeIllumination(ctx, bg, bulbs, {
    useIntensity: opts.litFilter ? true : opts.useIntensity,
    litFilter: opts.litFilter,
  });
}

function tokens(csv: string): string[] {
  return csv
    .split(',')
    .map(t => t.trim().toLowerCase())
    .filter(t => t.length > 0);
}

function bulbsWithNames(names: Set<string>, bulbs: Bulb[]): Set<number> {
  const out = new Set<number>();
  for (const b of bulbs) {
    if (b.name && names.has(b.name.toLowerCase())) out.add(b.id);
  }
  return out;
}

export async function showBackglassPreview(): Promise<void> {
  if (!state.backgroundImage && !state.dmdImage) return;
  const isDmd = state.activeTab === 'dmd';
  const parent = isDmd ? 'DMD' : 'Backglass';
  await ensureSnippetImagesLoaded(state.currentData.illumination.filter(b => b.parent === parent));

  const existing = document.getElementById('preview-modal');
  if (existing) existing.remove();

  const animations = state.currentData.animations;
  const animOptions = animations
    .map((a, i) => `<option value="${i}">${a.name} (${a.steps.length} steps, ${a.interval}ms)</option>`)
    .join('');

  const modal = document.createElement('div');
  modal.id = 'preview-modal';
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-content preview-content">
      <div class="modal-header">
        Backglass Preview
        <span class="preview-controls">
          <label><input type="checkbox" id="preview-illum" checked> Illumination</label>
          <label><input type="checkbox" id="preview-intensity"> Accurate intensity</label>
          <select id="preview-anim" ${animations.length === 0 ? 'disabled' : ''}>
            <option value="-1">— animation —</option>
            ${animOptions}
          </select>
          <button class="modal-btn" id="preview-play" ${animations.length === 0 ? 'disabled' : ''}>Show animation</button>
          <button class="modal-btn modal-btn-cancel" id="preview-close">Close</button>
        </span>
      </div>
      <div class="modal-body preview-body">
        <canvas id="preview-canvas"></canvas>
      </div>
      <div class="preview-footer" id="preview-footer"></div>
    </div>
  `;
  document.body.appendChild(modal);

  const canvas = modal.querySelector('#preview-canvas') as HTMLCanvasElement;
  const illumChk = modal.querySelector('#preview-illum') as HTMLInputElement;
  const intensityChk = modal.querySelector('#preview-intensity') as HTMLInputElement;
  const animSel = modal.querySelector('#preview-anim') as HTMLSelectElement;
  const playBtn = modal.querySelector('#preview-play') as HTMLButtonElement;
  const footer = modal.querySelector('#preview-footer') as HTMLElement;

  let playTimer: number | null = null;
  let isPlaying = false;
  let currentAnim: Animation | null = null;
  let stepIndex = 0;
  let loopsLeft = 0;
  let ticks = 0;
  let offPhase = false;
  const animationOn = new Set<string>();

  const bulbs = (): Bulb[] => state.currentData.illumination.filter(b => b.parent === parent);

  const update = (filter?: Set<number> | null): void =>
    renderIlluminated(canvas, {
      useIntensity: intensityChk.checked,
      illumOn: illumChk.checked,
      litFilter: filter || null,
    });

  const stop = (): void => {
    if (playTimer !== null) {
      clearTimeout(playTimer);
      playTimer = null;
    }
    isPlaying = false;
    animationOn.clear();
    playBtn.textContent = 'Show animation';
    update(null);
    footer.textContent = '';
  };

  const tick = (): void => {
    if (!currentAnim || !isPlaying) return;
    const steps = currentAnim.steps;
    ticks -= 1;
    while (ticks <= 0) {
      const step = steps[stepIndex];
      if (!offPhase) {
        offPhase = true;
        ticks = step.waitLoopsAfterOn;
        for (const t of tokens(step.on)) animationOn.add(t);
      } else {
        offPhase = false;
        ticks = step.waitLoopsAfterOff;
        for (const t of tokens(step.off)) animationOn.delete(t);
        stepIndex += 1;
      }
      if (stepIndex >= steps.length) break;
    }
    update(bulbsWithNames(animationOn, bulbs()));
    footer.textContent = `Step ${Math.min(stepIndex + 1, steps.length)}/${steps.length}, loops left ${loopsLeft}`;

    if (stepIndex < steps.length) {
      playTimer = window.setTimeout(tick, Math.max(1, currentAnim.interval));
    } else if (loopsLeft > 1) {
      loopsLeft -= 1;
      stepIndex = 0;
      tick();
    } else {
      isPlaying = false;
      playBtn.textContent = 'Show animation';
      footer.textContent = 'Animation finished';
    }
  };

  const play = (): void => {
    const idx = parseInt(animSel.value, 10);
    if (idx < 0 || !animations[idx] || animations[idx].steps.length === 0) return;
    currentAnim = animations[idx];
    stepIndex = 0;
    loopsLeft = currentAnim.loops === 0 ? 1 : currentAnim.loops;
    ticks = 0;
    offPhase = false;
    animationOn.clear();
    isPlaying = true;
    playBtn.textContent = 'Stop';
    tick();
  };

  update();

  illumChk.addEventListener('change', () => update(isPlaying ? bulbsWithNames(animationOn, bulbs()) : null));
  intensityChk.addEventListener('change', () => update(isPlaying ? bulbsWithNames(animationOn, bulbs()) : null));
  animSel.addEventListener('change', () => stop());
  playBtn.addEventListener('click', () => (isPlaying ? stop() : play()));

  const close = (): void => {
    stop();
    modal.remove();
  };
  modal.querySelector('.modal-backdrop')?.addEventListener('click', close);
  modal.querySelector('#preview-close')?.addEventListener('click', close);
}
