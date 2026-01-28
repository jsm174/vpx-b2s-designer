import type { Animation, AnimationStep, DualMode, LightState, StopBehaviour } from '../../../types/data';

export interface AnimationEditorElements {
  nameInput: HTMLInputElement;
  intervalInput: HTMLInputElement;
  loopsInput: HTMLInputElement;
  dualModeSelect: HTMLSelectElement;
  idJoinInput: HTMLInputElement;
  startAtRomStartCheck: HTMLInputElement;
  lightAtStartSelect: HTMLSelectElement;
  lightAtEndSelect: HTMLSelectElement;
  stopBehaviourSelect: HTMLSelectElement;
  lockAtLastStepCheck: HTMLInputElement;
  hideAtStartCheck: HTMLInputElement;
  bringToFrontCheck: HTMLInputElement;
  randomStartCheck: HTMLInputElement;
  randomQualityInput: HTMLInputElement;
  stepsTable: HTMLTableSectionElement;
  addStepBtn: HTMLButtonElement;
  removeStepBtn: HTMLButtonElement;
  moveUpBtn: HTMLButtonElement;
  moveDownBtn: HTMLButtonElement;
  okBtn: HTMLButtonElement;
  cancelBtn: HTMLButtonElement;
  deleteBtn?: HTMLButtonElement;
}

export interface AnimationEditorCallbacks {
  onSave: (animation: Animation, isNew: boolean) => void;
  onDelete?: (animationName: string) => void;
  onCancel: () => void;
}

export interface AnimationEditorInstance {
  setAnimation: (animation: Animation | null, isNew: boolean) => void;
  destroy: () => void;
}

function createDefaultStep(stepNum: number): AnimationStep {
  return {
    step: stepNum,
    on: '',
    off: '',
    waitLoopsAfterOn: 1,
    waitLoopsAfterOff: 1,
    pulseSwitch: 0,
  };
}

export function createDefaultAnimation(name: string): Animation {
  return {
    name,
    dualMode: 'Both',
    interval: 100,
    loops: 0,
    idJoin: '',
    startAnimationAtRomStart: false,
    lightAtStart: 'NoChange',
    lightAtEnd: 'NoChange',
    animationStopBehaviour: 'Immediate',
    lockAtLastStep: false,
    hideAtStart: false,
    bringToFront: false,
    randomStart: false,
    randomQuality: 50,
    steps: [createDefaultStep(1)],
  };
}

export function initAnimationEditorComponent(
  elements: AnimationEditorElements,
  callbacks: AnimationEditorCallbacks
): AnimationEditorInstance {
  let currentAnimation: Animation | null = null;
  let isNewAnimation = false;
  let selectedStepIndex = -1;

  function updateFromAnimation(): void {
    if (!currentAnimation) return;

    elements.nameInput.value = currentAnimation.name;
    elements.intervalInput.value = String(currentAnimation.interval);
    elements.loopsInput.value = String(currentAnimation.loops);
    elements.dualModeSelect.value = currentAnimation.dualMode;
    elements.idJoinInput.value = currentAnimation.idJoin;
    elements.startAtRomStartCheck.checked = currentAnimation.startAnimationAtRomStart;
    elements.lightAtStartSelect.value = currentAnimation.lightAtStart;
    elements.lightAtEndSelect.value = currentAnimation.lightAtEnd;
    elements.stopBehaviourSelect.value = currentAnimation.animationStopBehaviour;
    elements.lockAtLastStepCheck.checked = currentAnimation.lockAtLastStep;
    elements.hideAtStartCheck.checked = currentAnimation.hideAtStart;
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
          <td><input type="number" class="step-input" data-field="pulseSwitch" value="${step.pulseSwitch}" min="0" /></td>
        </tr>
      `
      )
      .join('');

    elements.stepsTable.querySelectorAll('tr').forEach(row => {
      row.addEventListener('click', e => {
        if ((e.target as HTMLElement).tagName === 'INPUT') return;
        const idx = parseInt((row as HTMLElement).dataset.index!, 10);
        selectStep(idx);
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
    const hasSelection = selectedStepIndex >= 0;
    const canMoveUp = hasSelection && selectedStepIndex > 0;
    const canMoveDown = hasSelection && currentAnimation && selectedStepIndex < currentAnimation.steps.length - 1;

    elements.removeStepBtn.disabled = !hasSelection || (currentAnimation?.steps.length || 0) <= 1;
    elements.moveUpBtn.disabled = !canMoveUp;
    elements.moveDownBtn.disabled = !canMoveDown;

    if (elements.deleteBtn) {
      elements.deleteBtn.disabled = isNewAnimation;
    }
  }

  function addStep(): void {
    if (!currentAnimation) return;
    const newStep = createDefaultStep(currentAnimation.steps.length + 1);
    currentAnimation.steps.push(newStep);
    selectedStepIndex = currentAnimation.steps.length - 1;
    renderSteps();
  }

  function removeStep(): void {
    if (!currentAnimation || selectedStepIndex < 0 || currentAnimation.steps.length <= 1) return;
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

  function collectFormData(): Animation | null {
    if (!currentAnimation) return null;

    return {
      ...currentAnimation,
      name: elements.nameInput.value.trim(),
      interval: parseInt(elements.intervalInput.value, 10) || 100,
      loops: parseInt(elements.loopsInput.value, 10) || 0,
      dualMode: elements.dualModeSelect.value as DualMode,
      idJoin: elements.idJoinInput.value.trim(),
      startAnimationAtRomStart: elements.startAtRomStartCheck.checked,
      lightAtStart: elements.lightAtStartSelect.value as LightState,
      lightAtEnd: elements.lightAtEndSelect.value as LightState,
      animationStopBehaviour: elements.stopBehaviourSelect.value as StopBehaviour,
      lockAtLastStep: elements.lockAtLastStepCheck.checked,
      hideAtStart: elements.hideAtStartCheck.checked,
      bringToFront: elements.bringToFrontCheck.checked,
      randomStart: elements.randomStartCheck.checked,
      randomQuality: parseInt(elements.randomQualityInput.value, 10) || 50,
    };
  }

  elements.addStepBtn.addEventListener('click', addStep);
  elements.removeStepBtn.addEventListener('click', removeStep);
  elements.moveUpBtn.addEventListener('click', moveStepUp);
  elements.moveDownBtn.addEventListener('click', moveStepDown);

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

  function setAnimation(animation: Animation | null, isNew: boolean): void {
    currentAnimation = animation ? JSON.parse(JSON.stringify(animation)) : null;
    isNewAnimation = isNew;
    selectedStepIndex = currentAnimation && currentAnimation.steps.length > 0 ? 0 : -1;
    updateFromAnimation();
    updateButtons();
  }

  function destroy(): void {
    document.removeEventListener('keydown', handleKeydown);
  }

  return {
    setAnimation,
    destroy,
  };
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
