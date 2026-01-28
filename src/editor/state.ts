import type { DirectB2SData, Bulb, ScoreInfo } from '../types/data';
import { createEmptyDirectB2S } from '../types/data';

export type SelectionType = 'bulb' | 'score';

export interface PrimarySelection {
  type: SelectionType;
  id: number;
}

export interface EditorState {
  currentData: DirectB2SData;
  currentFilePath: string | null;
  isDirty: boolean;

  zoom: number;
  panX: number;
  panY: number;
  activeTab: 'backglass' | 'dmd';

  selectedBulbIds: Set<number>;
  selectedScoreIds: Set<number>;
  primarySelection: PrimarySelection | null;

  tool: 'select' | 'pan' | 'create-bulb' | 'create-score';
  isDragging: boolean;
  isResizing: boolean;
  isPanning: boolean;
  dragStartWorld: { x: number; y: number } | null;
  panStartX: number;
  panStartY: number;

  backgroundImage: HTMLImageElement | null;
  dmdImage: HTMLImageElement | null;
  illuminationImages: Map<string, HTMLImageElement>;

  lampFilter: string;

  hasFile: boolean;
  nextBulbId: number;
  nextScoreId: number;

  showScoreFrames: boolean;
  showScoring: boolean;
  showIlluminationFrames: boolean;
  showIllumination: boolean;
  showIlluminationIntensity: boolean;

  setGrillHeight: boolean;
  setSmallGrillHeight: boolean;
  mouseWorldY: number | null;

  copyDmdFromBackglass: boolean;
  setDmdDefaultLocation: boolean;
  mouseWorldX: number | null;
}

export interface EditorElements {
  canvas: HTMLCanvasElement | null;
  ctx: CanvasRenderingContext2D | null;
  propertiesPanel: HTMLElement | null;
  illuminationList: HTMLElement | null;
  scoresList: HTMLElement | null;
  animationsList: HTMLElement | null;
  zoomLevel: HTMLElement | null;
  statusCoords: HTMLElement | null;
  statusFile: HTMLElement | null;
}

export const state: EditorState = {
  currentData: createEmptyDirectB2S(),
  currentFilePath: null,
  isDirty: false,

  zoom: 1,
  panX: 0,
  panY: 0,
  activeTab: 'backglass',

  selectedBulbIds: new Set(),
  selectedScoreIds: new Set(),
  primarySelection: null,

  tool: 'select',
  isDragging: false,
  isResizing: false,
  isPanning: false,
  dragStartWorld: null,
  panStartX: 0,
  panStartY: 0,

  backgroundImage: null,
  dmdImage: null,
  illuminationImages: new Map(),

  lampFilter: 'all',

  hasFile: false,
  nextBulbId: 1,
  nextScoreId: 1,

  showScoreFrames: false,
  showScoring: true,
  showIlluminationFrames: false,
  showIllumination: false,
  showIlluminationIntensity: false,

  setGrillHeight: false,
  setSmallGrillHeight: false,
  mouseWorldY: null,

  copyDmdFromBackglass: false,
  setDmdDefaultLocation: false,
  mouseWorldX: null,
};

export const elements: EditorElements = {
  canvas: null,
  ctx: null,
  propertiesPanel: null,
  illuminationList: null,
  scoresList: null,
  animationsList: null,
  zoomLevel: null,
  statusCoords: null,
  statusFile: null,
};

export function initElements(): void {
  elements.canvas = document.getElementById('editor-canvas') as HTMLCanvasElement;
  elements.ctx = elements.canvas?.getContext('2d') ?? null;
  elements.propertiesPanel = document.getElementById('properties-panel');
  elements.illuminationList = document.getElementById('illumination-list');
  elements.scoresList = document.getElementById('scores-list');
  elements.animationsList = document.getElementById('animations-list');
  elements.zoomLevel = document.getElementById('zoom-level');
  elements.statusCoords = document.getElementById('status-coords');
  elements.statusFile = document.getElementById('status-file');
}

export function resetState(): void {
  state.currentData = createEmptyDirectB2S();
  state.currentFilePath = null;
  state.isDirty = false;
  state.zoom = 1;
  state.panX = 0;
  state.panY = 0;
  state.selectedBulbIds.clear();
  state.selectedScoreIds.clear();
  state.primarySelection = null;
  state.backgroundImage = null;
  state.dmdImage = null;
  state.illuminationImages.clear();
  state.activeTab = 'backglass';
  state.lampFilter = 'all';
  state.hasFile = false;
  state.nextBulbId = 1;
  state.nextScoreId = 1;
  state.showScoreFrames = false;
  state.showScoring = true;
  state.showIlluminationFrames = false;
  state.showIllumination = false;
  state.showIlluminationIntensity = false;
  state.setGrillHeight = false;
  state.setSmallGrillHeight = false;
  state.mouseWorldY = null;
  state.copyDmdFromBackglass = false;
  state.setDmdDefaultLocation = false;
  state.mouseWorldX = null;
}

export function markDirty(): void {
  state.isDirty = true;
  if (window.vpxB2sDesignerAPI) {
    window.vpxB2sDesignerAPI.setDirty(true);
  }
}

export function markClean(): void {
  state.isDirty = false;
  if (window.vpxB2sDesignerAPI) {
    window.vpxB2sDesignerAPI.setDirty(false);
  }
}

export function getBulbById(id: number): Bulb | undefined {
  return state.currentData.illumination.find(b => b.id === id);
}

export function getScoreById(id: number): ScoreInfo | undefined {
  return state.currentData.scores.find(s => s.id === id);
}

export function getSelectedBulbs(): Bulb[] {
  return state.currentData.illumination.filter(b => state.selectedBulbIds.has(b.id));
}

export function getSelectedScores(): ScoreInfo[] {
  return state.currentData.scores.filter(s => state.selectedScoreIds.has(s.id));
}

export function getPrimarySelectedItem(): Bulb | ScoreInfo | null {
  if (!state.primarySelection) return null;
  if (state.primarySelection.type === 'bulb') {
    return getBulbById(state.primarySelection.id) ?? null;
  }
  return getScoreById(state.primarySelection.id) ?? null;
}

export function updateNextIds(): void {
  if (state.currentData.illumination.length > 0) {
    state.nextBulbId = Math.max(...state.currentData.illumination.map(b => b.id)) + 1;
  } else {
    state.nextBulbId = 1;
  }
  if (state.currentData.scores.length > 0) {
    state.nextScoreId = Math.max(...state.currentData.scores.map(s => s.id)) + 1;
  } else {
    state.nextScoreId = 1;
  }
}
