import type { Animation, AnimationStep, DualMode } from '../../../types/data';
import { createDefaultAnimation } from '../../../types/data';

export { createDefaultAnimation };

export interface AnimationEditorElements {
  nameInput: HTMLInputElement;
  intervalInput: HTMLInputElement;
  loopsInput: HTMLInputElement;
  dualModeSelect: HTMLSelectElement;
  idJoinInput: HTMLInputElement;
  startAtStartupCheck: HTMLInputElement;
  lightsStartSelect: HTMLSelectElement;
  lightsEndSelect: HTMLSelectElement;
  stopBehaviourSelect: HTMLSelectElement;
  lockInvolvedCheck: HTMLInputElement;
  hideScoresCheck: HTMLInputElement;
  bringToFrontCheck: HTMLInputElement;
  randomStartCheck: HTMLInputElement;
  randomQualityInput: HTMLInputElement;
  stepsTable: HTMLTableSectionElement;
  addStepBtn: HTMLButtonElement;
  removeStepBtn: HTMLButtonElement;
  moveUpBtn: HTMLButtonElement;
  moveDownBtn: HTMLButtonElement;
  allBulbsOnBtn?: HTMLButtonElement;
  allBulbsOffBtn?: HTMLButtonElement;
  okBtn: HTMLButtonElement;
  cancelBtn: HTMLButtonElement;
  deleteBtn?: HTMLButtonElement;
}

export interface AnimationEditorCallbacks {
  onSave: (animation: Animation, isNew: boolean) => void;
  onDelete?: (animationName: string) => void;
  onCancel: () => void;
}

export interface AnimationEditorContext {
  namedBulbs?: string[];
  dualBackglass?: boolean;
}

export interface AnimationEditorInstance {
  setAnimation: (animation: Animation | null, isNew: boolean, context?: AnimationEditorContext) => void;
  appendBulbName: (name: string) => void;
  destroy: () => void;
}

function createStep(stepNum: number, waitOn: number, waitOff: number): AnimationStep {
  return {
    step: stepNum,
    on: '',
    off: '',
    waitLoopsAfterOn: waitOn,
    waitLoopsAfterOff: waitOff,
    pulseSwitch: 0,
  };
}

function appendToken(csv: string, token: string): string {
  const parts = csv
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0);
  parts.push(token);
  return parts.join(',');
}

export function initAnimationEditorComponent(
  elements: AnimationEditorElements,
  callbacks: AnimationEditorCallbacks
): AnimationEditorInstance {
  let currentAnimation: Animation | null = null;
  let isNewAnimation = false;
  let selectedStepIndex = -1;
  let namedBulbs: string[] = [];

  function updateFromAnimation(): void {
    if (!currentAnimation) return;

    elements.nameInput.value = currentAnimation.name;
    elements.intervalInput.value = String(currentAnimation.interval);
    elements.loopsInput.value = String(currentAnimation.loops);
    elements.dualModeSelect.value = currentAnimation.dualMode;
    elements.idJoinInput.value = currentAnimation.idJoin;
    elements.startAtStartupCheck.checked = currentAnimation.startAnimationAtBackglassStartup;
    elements.lightsStartSelect.value = String(currentAnimation.lightsStateAtAnimationStart);
    elements.lightsEndSelect.value = String(currentAnimation.lightsStateAtAnimationEnd);
    elements.stopBehaviourSelect.value = String(currentAnimation.animationStopBehaviour);
    elements.lockInvolvedCheck.checked = currentAnimation.lockInvolvedLamps;
    elements.hideScoresCheck.checked = currentAnimation.hideScoreDisplays;
    elements.bringToFrontCheck.checked = currentAnimation.bringToFront;
    elements.randomStartCheck.checked = currentAnimation.randomStart;
    elements.randomQualityInput.value = String(currentAnimation.randomQuality);

    renderSteps();
  }

  function renderSteps(): void {
    if (!currentAnimation) return;

    elements.stepsTable.innerHTML = currentAnimation.steps
      .map(
        (step, idx) => `
        <tr class="${idx === selectedStepIndex ? 'selected' : ''}" data-index="${idx}">
          <td>${step.step}</td>
          <td><input type="text" class="step-input" data-field="on" value="${escapeHtml(step.on)}" /></td>
          <td><input type="number" class="step-input" data-field="waitLoopsAfterOn" value="${step.waitLoopsAfterOn}" min="0" /></td>
          <td><input type="text" class="step-input" data-field="off" value="${escapeHtml(step.off)}" /></td>
          <td><input type="number" class="step-input" data-field="waitLoopsAfterOff" value="${step.waitLoopsAfterOff}" min="0" /></td>
          <td><input type="number" class="step-input" data-field="pulseSwitch" value="${step.pulseSwitch > 0 ? step.pulseSwitch : ''}" min="0" /></td>
        </tr>
      `
      )
      .join('');

    elements.stepsTable.querySelectorAll('tr').forEach(row => {
      row.addEventListener('click', () => {
        const idx = parseInt((row as HTMLElement).dataset.index!, 10);
        if (idx !== selectedStepIndex) selectStep(idx);
      });
      row.addEventListener('focusin', () => {
        const idx = parseInt((row as HTMLElement).dataset.index!, 10);
        if (idx !== selectedStepIndex) {
          selectedStepIndex = idx;
          elements.stepsTable.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
          row.classList.add('selected');
          updateButtons();
        }
      });
    });

    elements.stepsTable.querySelectorAll('.step-input').forEach(input => {
      input.addEventListener('change', e => {
        const target = e.target as HTMLInputElement;
        const row = target.closest('tr') as HTMLElement;
        const idx = parseInt(row.dataset.index!, 10);
        const field = target.dataset.field as keyof AnimationStep;
        const step = currentAnimation!.steps[idx];

        if (field === 'on' || field === 'off') {
          step[field] = target.value;
        } else if (field === 'waitLoopsAfterOn' || field === 'waitLoopsAfterOff' || field === 'pulseSwitch') {
          step[field] = parseInt(target.value, 10) || 0;
          if (field === 'pulseSwitch' && step.pulseSwitch <= 0) target.value = '';
        }
      });
    });

    updateButtons();
  }

  function selectStep(index: number): void {
    selectedStepIndex = index;
    renderSteps();
  }

  function updateButtons(): void {
    const hasSelection =
      selectedStepIndex >= 0 && !!currentAnimation && selectedStepIndex < currentAnimation.steps.length;
    const canMoveUp = hasSelection && selectedStepIndex > 0;
    const canMoveDown = hasSelection && !!currentAnimation && selectedStepIndex < currentAnimation.steps.length - 1;

    elements.removeStepBtn.disabled = !hasSelection;
    elements.moveUpBtn.disabled = !canMoveUp;
    elements.moveDownBtn.disabled = !canMoveDown;
    if (elements.allBulbsOnBtn) elements.allBulbsOnBtn.disabled = !hasSelection || namedBulbs.length === 0;
    if (elements.allBulbsOffBtn) elements.allBulbsOffBtn.disabled = !hasSelection || namedBulbs.length === 0;

    if (elements.deleteBtn) {
      elements.deleteBtn.disabled = isNewAnimation;
    }
  }

  function addStep(): void {
    if (!currentAnimation) return;
    const ref = selectedStepIndex >= 0 ? currentAnimation.steps[selectedStepIndex] : null;
    const newStep = createStep(
      currentAnimation.steps.length + 1,
      ref ? ref.waitLoopsAfterOn : 0,
      ref ? ref.waitLoopsAfterOff : 0
    );
    currentAnimation.steps.push(newStep);
    selectedStepIndex = currentAnimation.steps.length - 1;
    renderSteps();
  }

  function removeStep(): void {
    if (!currentAnimation || selectedStepIndex < 0) return;
    currentAnimation.steps.splice(selectedStepIndex, 1);
    renumberSteps();
    if (selectedStepIndex >= currentAnimation.steps.length) {
      selectedStepIndex = currentAnimation.steps.length - 1;
    }
    renderSteps();
  }

  function moveStepUp(): void {
    if (!currentAnimation || selectedStepIndex <= 0) return;
    const steps = currentAnimation.steps;
    [steps[selectedStepIndex - 1], steps[selectedStepIndex]] = [steps[selectedStepIndex], steps[selectedStepIndex - 1]];
    selectedStepIndex--;
    renumberSteps();
    renderSteps();
  }

  function moveStepDown(): void {
    if (!currentAnimation || selectedStepIndex < 0 || selectedStepIndex >= currentAnimation.steps.length - 1) return;
    const steps = currentAnimation.steps;
    [steps[selectedStepIndex], steps[selectedStepIndex + 1]] = [steps[selectedStepIndex + 1], steps[selectedStepIndex]];
    selectedStepIndex++;
    renumberSteps();
    renderSteps();
  }

  function renumberSteps(): void {
    if (!currentAnimation) return;
    currentAnimation.steps.forEach((step, idx) => {
      step.step = idx + 1;
    });
  }

  function fillAllNamedBulbs(field: 'on' | 'off'): void {
    if (!currentAnimation || selectedStepIndex < 0) return;
    const step = currentAnimation.steps[selectedStepIndex];
    if (!step) return;
    const names = Array.from(new Set(namedBulbs)).sort((a, b) => a.localeCompare(b));
    step[field] = names.join(',');
    renderSteps();
  }

  function appendBulbName(name: string): void {
    if (!currentAnimation || !name) return;
    if (selectedStepIndex < 0 || selectedStepIndex >= currentAnimation.steps.length) return;
    const step = currentAnimation.steps[selectedStepIndex];
    step.on = appendToken(step.on, name);
    step.off = appendToken(step.off, name);
    renderSteps();
  }

  function parseIntOr(value: string, fallback: number): number {
    const n = parseInt(value, 10);
    return Number.isNaN(n) ? fallback : n;
  }

  function collectFormData(): Animation | null {
    if (!currentAnimation) return null;

    return {
      ...currentAnimation,
      name: elements.nameInput.value.trim(),
      interval: parseIntOr(elements.intervalInput.value, 50),
      loops: parseIntOr(elements.loopsInput.value, 1),
      dualMode: elements.dualModeSelect.value as DualMode,
      idJoin: elements.idJoinInput.value.trim(),
      startAnimationAtBackglassStartup: elements.startAtStartupCheck.checked,
      lightsStateAtAnimationStart: parseIntOr(elements.lightsStartSelect.value, 4),
      lightsStateAtAnimationEnd: parseIntOr(elements.lightsEndSelect.value, 1),
      animationStopBehaviour: parseIntOr(elements.stopBehaviourSelect.value, 1),
      lockInvolvedLamps: elements.lockInvolvedCheck.checked,
      hideScoreDisplays: elements.hideScoresCheck.checked,
      bringToFront: elements.bringToFrontCheck.checked,
      randomStart: elements.randomStartCheck.checked,
      randomQuality: parseIntOr(elements.randomQualityInput.value, 1),
    };
  }

  elements.addStepBtn.addEventListener('click', addStep);
  elements.removeStepBtn.addEventListener('click', removeStep);
  elements.moveUpBtn.addEventListener('click', moveStepUp);
  elements.moveDownBtn.addEventListener('click', moveStepDown);
  elements.allBulbsOnBtn?.addEventListener('click', () => fillAllNamedBulbs('on'));
  elements.allBulbsOffBtn?.addEventListener('click', () => fillAllNamedBulbs('off'));

  elements.okBtn.addEventListener('click', () => {
    const animation = collectFormData();
    if (animation && animation.name) {
      callbacks.onSave(animation, isNewAnimation);
    }
  });

  elements.cancelBtn.addEventListener('click', () => {
    callbacks.onCancel();
  });

  if (elements.deleteBtn) {
    elements.deleteBtn.addEventListener('click', () => {
      if (currentAnimation && !isNewAnimation && callbacks.onDelete) {
        callbacks.onDelete(currentAnimation.name);
      }
    });
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      callbacks.onCancel();
    }
  }

  document.addEventListener('keydown', handleKeydown);

  function setAnimation(animation: Animation | null, isNew: boolean, context?: AnimationEditorContext): void {
    currentAnimation = animation ? JSON.parse(JSON.stringify(animation)) : null;
    isNewAnimation = isNew;
    namedBulbs = context?.namedBulbs ?? [];
    elements.dualModeSelect.disabled = !(context?.dualBackglass ?? true);
    selectedStepIndex = currentAnimation && currentAnimation.steps.length > 0 ? 0 : -1;
    updateFromAnimation();
    updateButtons();
  }

  function destroy(): void {
    document.removeEventListener('keydown', handleKeydown);
  }

  return {
    setAnimation,
    appendBulbName,
    destroy,
  };
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
