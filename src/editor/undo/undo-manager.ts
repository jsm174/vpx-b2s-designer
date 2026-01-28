import { state, markDirty, getBulbById, getScoreById } from '../state';
import { invokeCallback } from '../../shared/callbacks';
import { appendConsoleLine } from '../console-panel';
import { type UndoRecord, createUndoRecord, cloneBulb, cloneScore, cloneAnimation, cloneImages } from './undo-record';

const MAX_UNDO_STACK = 100;

class UndoManager {
  private undoStack: UndoRecord[] = [];
  private redoStack: UndoRecord[] = [];
  private currentRecord: UndoRecord | null = null;
  private transactionDepth = 0;
  private savePointIndex = 0;

  beginUndo(description: string): void {
    if (this.transactionDepth === 0) {
      this.currentRecord = createUndoRecord(description);
    }
    this.transactionDepth++;
  }

  endUndo(): void {
    if (this.transactionDepth === 0) {
      console.warn('endUndo called without matching beginUndo');
      return;
    }

    this.transactionDepth--;

    if (this.transactionDepth === 0 && this.currentRecord) {
      const hasChanges =
        this.currentRecord.bulbSnapshots.size > 0 ||
        this.currentRecord.scoreSnapshots.size > 0 ||
        this.currentRecord.animationSnapshots.size > 0 ||
        this.currentRecord.imagesBefore !== null ||
        this.currentRecord.grillHeightsBefore !== null ||
        this.currentRecord.dmdAreaBefore !== null;

      if (hasChanges) {
        this.finalizeSnapshots();
        this.undoStack.push(this.currentRecord);
        this.redoStack = [];

        if (this.undoStack.length > MAX_UNDO_STACK) {
          this.undoStack.shift();
          if (this.savePointIndex > 0) {
            this.savePointIndex--;
          }
        }

        markDirty();
        invokeCallback('undoStackChanged');
      }

      this.currentRecord = null;
    }
  }

  cancelUndo(): void {
    if (this.transactionDepth > 0) {
      this.transactionDepth = 0;
      this.currentRecord = null;
    }
  }

  markBulbForUndo(id: number): void {
    if (!this.currentRecord) return;
    if (this.currentRecord.bulbSnapshots.has(id)) return;

    const bulb = getBulbById(id);
    this.currentRecord.bulbSnapshots.set(id, {
      before: bulb ? cloneBulb(bulb) : null,
      after: null,
    });
  }

  markBulbForCreate(id: number): void {
    if (!this.currentRecord) return;
    this.currentRecord.bulbSnapshots.set(id, {
      before: null,
      after: null,
    });
  }

  markBulbForDelete(id: number): void {
    if (!this.currentRecord) return;
    const bulb = getBulbById(id);
    if (bulb) {
      this.currentRecord.bulbSnapshots.set(id, {
        before: cloneBulb(bulb),
        after: null,
      });
    }
  }

  markScoreForUndo(id: number): void {
    if (!this.currentRecord) return;
    if (this.currentRecord.scoreSnapshots.has(id)) return;

    const score = getScoreById(id);
    this.currentRecord.scoreSnapshots.set(id, {
      before: score ? cloneScore(score) : null,
      after: null,
    });
  }

  markScoreForCreate(id: number): void {
    if (!this.currentRecord) return;
    this.currentRecord.scoreSnapshots.set(id, {
      before: null,
      after: null,
    });
  }

  markScoreForDelete(id: number): void {
    if (!this.currentRecord) return;
    const score = getScoreById(id);
    if (score) {
      this.currentRecord.scoreSnapshots.set(id, {
        before: cloneScore(score),
        after: null,
      });
    }
  }

  markAnimationForUndo(name: string): void {
    if (!this.currentRecord) return;
    if (this.currentRecord.animationSnapshots.has(name)) return;

    const animation = state.currentData.animations.find(a => a.name === name);
    this.currentRecord.animationSnapshots.set(name, {
      before: animation ? cloneAnimation(animation) : null,
      after: null,
    });
  }

  markAnimationsForUndo(): void {
    if (!this.currentRecord) return;
    for (const animation of state.currentData.animations) {
      if (!this.currentRecord.animationSnapshots.has(animation.name)) {
        this.currentRecord.animationSnapshots.set(animation.name, {
          before: cloneAnimation(animation),
          after: null,
        });
      }
    }
  }

  markImagesForUndo(): void {
    if (!this.currentRecord) return;
    if (this.currentRecord.imagesBefore) return;
    this.currentRecord.imagesBefore = cloneImages(state.currentData.images);
  }

  markAllBulbsForUndo(parent?: 'Backglass' | 'DMD'): void {
    if (!this.currentRecord) return;
    for (const bulb of state.currentData.illumination) {
      if (parent && bulb.parent !== parent) continue;
      if (!this.currentRecord.bulbSnapshots.has(bulb.id)) {
        this.currentRecord.bulbSnapshots.set(bulb.id, {
          before: cloneBulb(bulb),
          after: null,
        });
      }
    }
  }

  markAllScoresForUndo(parent?: 'Backglass' | 'DMD'): void {
    if (!this.currentRecord) return;
    for (const score of state.currentData.scores) {
      if (parent && score.parent !== parent) continue;
      if (!this.currentRecord.scoreSnapshots.has(score.id)) {
        this.currentRecord.scoreSnapshots.set(score.id, {
          before: cloneScore(score),
          after: null,
        });
      }
    }
  }

  markGrillHeightsForUndo(): void {
    if (!this.currentRecord) return;
    if (this.currentRecord.grillHeightsBefore) return;
    this.currentRecord.grillHeightsBefore = {
      grillHeight: state.currentData.grillHeight,
      smallGrillHeight: state.currentData.smallGrillHeight,
    };
  }

  markDmdAreaForUndo(): void {
    if (!this.currentRecord) return;
    if (this.currentRecord.dmdAreaBefore) return;
    this.currentRecord.dmdAreaBefore = {
      dmdDefaultLocationX: state.currentData.dmdDefaultLocationX,
      dmdDefaultLocationY: state.currentData.dmdDefaultLocationY,
      dmdCopyAreaX: state.currentData.dmdCopyAreaX,
      dmdCopyAreaY: state.currentData.dmdCopyAreaY,
      dmdCopyAreaWidth: state.currentData.dmdCopyAreaWidth,
      dmdCopyAreaHeight: state.currentData.dmdCopyAreaHeight,
    };
  }

  private finalizeSnapshots(): void {
    if (!this.currentRecord) return;

    for (const [id, snapshot] of this.currentRecord.bulbSnapshots) {
      const bulb = getBulbById(id);
      snapshot.after = bulb ? cloneBulb(bulb) : null;
    }

    for (const [id, snapshot] of this.currentRecord.scoreSnapshots) {
      const score = getScoreById(id);
      snapshot.after = score ? cloneScore(score) : null;
    }

    for (const [name, snapshot] of this.currentRecord.animationSnapshots) {
      const animation = state.currentData.animations.find(a => a.name === name);
      snapshot.after = animation ? cloneAnimation(animation) : null;
    }

    if (this.currentRecord.imagesBefore) {
      this.currentRecord.imagesAfter = cloneImages(state.currentData.images);
    }

    if (this.currentRecord.grillHeightsBefore) {
      this.currentRecord.grillHeightsAfter = {
        grillHeight: state.currentData.grillHeight,
        smallGrillHeight: state.currentData.smallGrillHeight,
      };
    }

    if (this.currentRecord.dmdAreaBefore) {
      this.currentRecord.dmdAreaAfter = {
        dmdDefaultLocationX: state.currentData.dmdDefaultLocationX,
        dmdDefaultLocationY: state.currentData.dmdDefaultLocationY,
        dmdCopyAreaX: state.currentData.dmdCopyAreaX,
        dmdCopyAreaY: state.currentData.dmdCopyAreaY,
        dmdCopyAreaWidth: state.currentData.dmdCopyAreaWidth,
        dmdCopyAreaHeight: state.currentData.dmdCopyAreaHeight,
      };
    }
  }

  undo(): boolean {
    if (this.undoStack.length === 0) return false;

    const record = this.undoStack.pop()!;
    this.applyRecord(record, true);
    this.redoStack.push(record);

    appendConsoleLine(`Undo: ${record.description}`, 'info');
    markDirty();
    invokeCallback('undoStackChanged');
    invokeCallback('dataChanged');
    return true;
  }

  redo(): boolean {
    if (this.redoStack.length === 0) return false;

    const record = this.redoStack.pop()!;
    this.applyRecord(record, false);
    this.undoStack.push(record);

    appendConsoleLine(`Redo: ${record.description}`, 'info');
    markDirty();
    invokeCallback('undoStackChanged');
    invokeCallback('dataChanged');
    return true;
  }

  private applyRecord(record: UndoRecord, isUndo: boolean): void {
    for (const [id, snapshot] of record.bulbSnapshots) {
      const target = isUndo ? snapshot.before : snapshot.after;
      const index = state.currentData.illumination.findIndex(b => b.id === id);

      if (target === null) {
        if (index !== -1) {
          state.currentData.illumination.splice(index, 1);
        }
      } else {
        if (index !== -1) {
          state.currentData.illumination[index] = cloneBulb(target);
        } else {
          state.currentData.illumination.push(cloneBulb(target));
        }
      }
    }

    for (const [id, snapshot] of record.scoreSnapshots) {
      const target = isUndo ? snapshot.before : snapshot.after;
      const index = state.currentData.scores.findIndex(s => s.id === id);

      if (target === null) {
        if (index !== -1) {
          state.currentData.scores.splice(index, 1);
        }
      } else {
        if (index !== -1) {
          state.currentData.scores[index] = cloneScore(target);
        } else {
          state.currentData.scores.push(cloneScore(target));
        }
      }
    }

    for (const [name, snapshot] of record.animationSnapshots) {
      const target = isUndo ? snapshot.before : snapshot.after;
      const index = state.currentData.animations.findIndex(a => a.name === name);

      if (target === null) {
        if (index !== -1) {
          state.currentData.animations.splice(index, 1);
        }
      } else {
        if (index !== -1) {
          state.currentData.animations[index] = cloneAnimation(target);
        } else {
          state.currentData.animations.push(cloneAnimation(target));
        }
      }
    }

    if (record.imagesBefore && record.imagesAfter) {
      state.currentData.images = cloneImages(isUndo ? record.imagesBefore : record.imagesAfter);
    }

    if (record.grillHeightsBefore && record.grillHeightsAfter) {
      const target = isUndo ? record.grillHeightsBefore : record.grillHeightsAfter;
      state.currentData.grillHeight = target.grillHeight;
      state.currentData.smallGrillHeight = target.smallGrillHeight;
    }

    if (record.dmdAreaBefore && record.dmdAreaAfter) {
      const target = isUndo ? record.dmdAreaBefore : record.dmdAreaAfter;
      state.currentData.dmdDefaultLocationX = target.dmdDefaultLocationX;
      state.currentData.dmdDefaultLocationY = target.dmdDefaultLocationY;
      state.currentData.dmdCopyAreaX = target.dmdCopyAreaX;
      state.currentData.dmdCopyAreaY = target.dmdCopyAreaY;
      state.currentData.dmdCopyAreaWidth = target.dmdCopyAreaWidth;
      state.currentData.dmdCopyAreaHeight = target.dmdCopyAreaHeight;
    }
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  getUndoDescription(): string | null {
    if (this.undoStack.length === 0) return null;
    return this.undoStack[this.undoStack.length - 1].description;
  }

  getRedoDescription(): string | null {
    if (this.redoStack.length === 0) return null;
    return this.redoStack[this.redoStack.length - 1].description;
  }

  getUndoStack(): string[] {
    return this.undoStack.map(r => r.description);
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.currentRecord = null;
    this.transactionDepth = 0;
    this.savePointIndex = 0;
    invokeCallback('undoStackChanged');
  }

  setSavePoint(): void {
    this.savePointIndex = this.undoStack.length;
  }

  isAtSavePoint(): boolean {
    return this.undoStack.length === this.savePointIndex;
  }
}

export const undoManager = new UndoManager();
