import type { Bulb, ScoreInfo, Animation, ImageCollection, DirectB2SData } from '../../types/data';

export type GeneralSnapshot = Omit<DirectB2SData, 'animations' | 'scores' | 'illumination' | 'images' | 'reels'>;

export function cloneGeneral(data: DirectB2SData): GeneralSnapshot {
  const { animations, scores, illumination, images, reels, ...general } = data;
  void animations;
  void scores;
  void illumination;
  void images;
  void reels;
  return {
    ...general,
    reelTypes: [...general.reelTypes],
    reelColor: general.reelColor ? { ...general.reelColor } : null,
  };
}

export function applyGeneral(data: DirectB2SData, snapshot: GeneralSnapshot): void {
  Object.assign(data, cloneGeneral(snapshot as DirectB2SData));
}

export interface ItemSnapshot<T> {
  before: T | null;
  after: T | null;
}

export interface GrillHeights {
  grillHeight: number;
  smallGrillHeight: number;
}

export interface DmdArea {
  dmdDefaultLocationX: number;
  dmdDefaultLocationY: number;
  dmdCopyAreaX: number;
  dmdCopyAreaY: number;
  dmdCopyAreaWidth: number;
  dmdCopyAreaHeight: number;
}

export interface UndoRecord {
  description: string;
  bulbSnapshots: Map<number, ItemSnapshot<Bulb>>;
  scoreSnapshots: Map<number, ItemSnapshot<ScoreInfo>>;
  animationSnapshots: Map<string, ItemSnapshot<Animation>>;
  imagesBefore: ImageCollection | null;
  imagesAfter: ImageCollection | null;
  grillHeightsBefore: GrillHeights | null;
  grillHeightsAfter: GrillHeights | null;
  dmdAreaBefore: DmdArea | null;
  dmdAreaAfter: DmdArea | null;
  generalBefore: GeneralSnapshot | null;
  generalAfter: GeneralSnapshot | null;
}

export function createUndoRecord(description: string): UndoRecord {
  return {
    description,
    bulbSnapshots: new Map(),
    scoreSnapshots: new Map(),
    animationSnapshots: new Map(),
    imagesBefore: null,
    imagesAfter: null,
    grillHeightsBefore: null,
    grillHeightsAfter: null,
    dmdAreaBefore: null,
    dmdAreaAfter: null,
    generalBefore: null,
    generalAfter: null,
  };
}

export function cloneBulb(bulb: Bulb): Bulb {
  return {
    ...bulb,
    lightColor: { ...bulb.lightColor },
    dodgeColor: bulb.dodgeColor ? { ...bulb.dodgeColor } : undefined,
  };
}

export function cloneScore(score: ScoreInfo): ScoreInfo {
  return {
    ...score,
    reelColor: { ...score.reelColor },
  };
}

export function cloneAnimation(animation: Animation): Animation {
  return {
    ...animation,
    steps: animation.steps.map(step => ({ ...step })),
  };
}

export function cloneImages(images: ImageCollection): ImageCollection {
  return {
    backgroundImages: images.backgroundImages.map(img => ({ ...img })),
    illuminatedImages: images.illuminatedImages.map(img => ({ ...img })),
    dmdImages: images.dmdImages.map(img => ({ ...img })),
    thumbnailImage: images.thumbnailImage,
  };
}
