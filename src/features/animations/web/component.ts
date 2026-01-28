import {
  initAnimationEditorComponent,
  createDefaultAnimation,
  type AnimationEditorElements,
  type AnimationEditorInstance,
} from '../shared/component';
import type { Animation } from '../../../types/data';
import templateHtml from './template.html?raw';

let templateInjected = false;

function injectTemplate(): void {
  if (templateInjected) return;
  const container = document.createElement('div');
  container.innerHTML = templateHtml;
  while (container.firstChild) {
    document.body.appendChild(container.firstChild);
  }
  templateInjected = true;
}

export interface WebAnimationEditorCallbacks {
  onSave: (animation: Animation, isNew: boolean) => void;
  onDelete: (name: string) => void;
}

export interface WebAnimationEditorInstance {
  open: (animation: Animation | null) => void;
  close: () => void;
  setTheme: (theme: string) => void;
}

export function initWebAnimationEditor(callbacks: WebAnimationEditorCallbacks): WebAnimationEditorInstance {
  injectTemplate();
  const modal = document.getElementById('animation-editor-modal')!;

  let editorInstance: AnimationEditorInstance | null = null;
  let isNewAnimation = false;

  function getElements(): AnimationEditorElements {
    return {
      nameInput: document.getElementById('web-anim-name') as HTMLInputElement,
      intervalInput: document.getElementById('web-anim-interval') as HTMLInputElement,
      loopsInput: document.getElementById('web-anim-loops') as HTMLInputElement,
      dualModeSelect: document.getElementById('web-anim-dual-mode') as HTMLSelectElement,
      idJoinInput: document.getElementById('web-anim-id-join') as HTMLInputElement,
      startAtRomStartCheck: document.getElementById('web-anim-start-at-rom') as HTMLInputElement,
      lightAtStartSelect: document.getElementById('web-anim-light-start') as HTMLSelectElement,
      lightAtEndSelect: document.getElementById('web-anim-light-end') as HTMLSelectElement,
      stopBehaviourSelect: document.getElementById('web-anim-stop-behaviour') as HTMLSelectElement,
      lockAtLastStepCheck: document.getElementById('web-anim-lock-last-step') as HTMLInputElement,
      hideAtStartCheck: document.getElementById('web-anim-hide-at-start') as HTMLInputElement,
      bringToFrontCheck: document.getElementById('web-anim-bring-to-front') as HTMLInputElement,
      randomStartCheck: document.getElementById('web-anim-random-start') as HTMLInputElement,
      randomQualityInput: document.getElementById('web-anim-random-quality') as HTMLInputElement,
      stepsTable: document.getElementById('web-anim-steps-tbody') as HTMLTableSectionElement,
      addStepBtn: document.getElementById('web-anim-add-step') as HTMLButtonElement,
      removeStepBtn: document.getElementById('web-anim-remove-step') as HTMLButtonElement,
      moveUpBtn: document.getElementById('web-anim-move-up') as HTMLButtonElement,
      moveDownBtn: document.getElementById('web-anim-move-down') as HTMLButtonElement,
      okBtn: document.getElementById('web-anim-ok') as HTMLButtonElement,
      cancelBtn: document.getElementById('web-anim-cancel') as HTMLButtonElement,
      deleteBtn: document.getElementById('web-anim-delete') as HTMLButtonElement,
    };
  }

  function open(animation: Animation | null): void {
    isNewAnimation = animation === null;
    const animToEdit = animation || createDefaultAnimation('New Animation');

    if (!editorInstance) {
      editorInstance = initAnimationEditorComponent(getElements(), {
        onSave: (anim, isNew) => {
          callbacks.onSave(anim, isNew);
          close();
        },
        onDelete: name => {
          callbacks.onDelete(name);
          close();
        },
        onCancel: close,
      });
    }

    editorInstance.setAnimation(animToEdit, isNewAnimation);
    modal.classList.remove('hidden');
  }

  function close(): void {
    modal.classList.add('hidden');
  }

  modal.querySelector('.modal-backdrop')?.addEventListener('click', close);

  return {
    open,
    close,
    setTheme: (theme: string) => modal.setAttribute('data-theme', theme),
  };
}
