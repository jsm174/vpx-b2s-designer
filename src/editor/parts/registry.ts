export interface ResizeHandle {
  x: number;
  y: number;
  cursor: string;
  position: 'nw' | 'n' | 'ne' | 'w' | 'e' | 'sw' | 's' | 'se';
}

export interface IEditable<T = unknown> {
  render(item: T, ctx: CanvasRenderingContext2D, isSelected: boolean): void;
  hitTest(item: T, worldX: number, worldY: number): boolean;
  getProperties(item: T): string;
  getResizeHandles(item: T): ResizeHandle[];
  getBounds(item: T): { x: number; y: number; width: number; height: number };
}

const editables: Map<string, IEditable> = new Map();

export function registerEditable<T>(type: string, editable: IEditable<T>): void {
  editables.set(type, editable as IEditable);
}

export function getEditable(type: string): IEditable | undefined {
  return editables.get(type);
}

export function getAllEditableTypes(): string[] {
  return Array.from(editables.keys());
}

export function getResizeHandlesForBounds(
  x: number,
  y: number,
  width: number,
  height: number,
  handleSize = 6
): ResizeHandle[] {
  const hw = handleSize / 2;
  return [
    { x: x - hw, y: y - hw, cursor: 'nwse-resize', position: 'nw' },
    { x: x + width / 2 - hw, y: y - hw, cursor: 'ns-resize', position: 'n' },
    { x: x + width - hw, y: y - hw, cursor: 'nesw-resize', position: 'ne' },
    { x: x - hw, y: y + height / 2 - hw, cursor: 'ew-resize', position: 'w' },
    { x: x + width - hw, y: y + height / 2 - hw, cursor: 'ew-resize', position: 'e' },
    { x: x - hw, y: y + height - hw, cursor: 'nesw-resize', position: 'sw' },
    { x: x + width / 2 - hw, y: y + height - hw, cursor: 'ns-resize', position: 's' },
    { x: x + width - hw, y: y + height - hw, cursor: 'nwse-resize', position: 'se' },
  ];
}

export function hitTestResizeHandle(
  handles: ResizeHandle[],
  worldX: number,
  worldY: number,
  hitSize = 6,
  visualSize = 6
): ResizeHandle | null {
  const offset = (hitSize - visualSize) / 2;
  for (const handle of handles) {
    const inX = worldX >= handle.x - offset && worldX <= handle.x + visualSize + offset;
    const inY = worldY >= handle.y - offset && worldY <= handle.y + visualSize + offset;
    if (inX && inY) {
      return handle;
    }
  }
  return null;
}
