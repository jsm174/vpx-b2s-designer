import {
  initAnimationEditorComponent,
  createDefaultAnimation,
  type AnimationEditorElements,
  type AnimationEditorInstance,
} from '../shared/component';
import type { Animation } from '../../../types/data';

declare const window: Window & {
  animationEditor?: {
    onInit: (
      callback: (data: {
        animation: Animation | null;
        isNew: boolean;
        theme?: string;
        namedBulbs?: string[];
        dualBackglass?: boolean;
      }) => void
    ) => void;
    onThemeChanged: (callback: (theme: string) => void) => void;
    onBulbClicked: (callback: (name: string) => void) => void;
    saveAnimation: (animation: Animation, isNew: boolean) => Promise<void>;
    deleteAnimation: (name: string) => Promise<void>;
    close: () => void;
  };
};

let component: AnimationEditorInstance | null = null;

function getElements(): AnimationEditorElements {
  return {
    nameInput: document.getElementById('anim-name') as HTMLInputElement,
    intervalInput: document.getElementById('anim-interval') as HTMLInputElement,
    loopsInput: document.getElementById('anim-loops') as HTMLInputElement,
    dualModeSelect: document.getElementById('anim-dual-mode') as HTMLSelectElement,
    idJoinInput: document.getElementById('anim-id-join') as HTMLInputElement,
    startAtStartupCheck: document.getElementById('anim-start-at-rom') as HTMLInputElement,
    lightsStartSelect: document.getElementById('anim-light-start') as HTMLSelectElement,
    lightsEndSelect: document.getElementById('anim-light-end') as HTMLSelectElement,
    stopBehaviourSelect: document.getElementById('anim-stop-behaviour') as HTMLSelectElement,
    lockInvolvedCheck: document.getElementById('anim-lock-last-step') as HTMLInputElement,
    hideScoresCheck: document.getElementById('anim-hide-at-start') as HTMLInputElement,
    bringToFrontCheck: document.getElementById('anim-bring-to-front') as HTMLInputElement,
    randomStartCheck: document.getElementById('anim-random-start') as HTMLInputElement,
    randomQualityInput: document.getElementById('anim-random-quality') as HTMLInputElement,
    stepsTable: document.getElementById('anim-steps-tbody') as HTMLTableSectionElement,
    addStepBtn: document.getElementById('anim-add-step') as HTMLButtonElement,
    removeStepBtn: document.getElementById('anim-remove-step') as HTMLButtonElement,
    moveUpBtn: document.getElementById('anim-move-up') as HTMLButtonElement,
    moveDownBtn: document.getElementById('anim-move-down') as HTMLButtonElement,
    allBulbsOnBtn: document.getElementById('anim-all-on') as HTMLButtonElement,
    allBulbsOffBtn: document.getElementById('anim-all-off') as HTMLButtonElement,
    okBtn: document.getElementById('anim-ok') as HTMLButtonElement,
    cancelBtn: document.getElementById('anim-cancel') as HTMLButtonElement,
    deleteBtn: document.getElementById('anim-delete') as HTMLButtonElement,
  };
}

function init(): void {
  if (window.animationEditor) {
    window.animationEditor.onInit(data => {
      if (data.theme) document.documentElement.setAttribute('data-theme', data.theme);

      if (!component) {
        component = initAnimationEditorComponent(getElements(), {
          onSave: async (animation, isNew) => {
            await window.animationEditor!.saveAnimation(animation, isNew);
            window.animationEditor!.close();
          },
          onDelete: async name => {
            await window.animationEditor!.deleteAnimation(name);
            window.animationEditor!.close();
          },
          onCancel: () => {
            window.animationEditor!.close();
          },
        });
      }

      component.setAnimation(data.animation ?? createDefaultAnimation('New Animation'), data.isNew, {
        namedBulbs: data.namedBulbs,
        dualBackglass: data.dualBackglass,
      });
    });

    window.animationEditor.onBulbClicked(name => {
      component?.appendBulbName(name);
    });

    window.animationEditor.onThemeChanged(theme => {
      document.documentElement.setAttribute('data-theme', theme);
    });
  }
}

init();
