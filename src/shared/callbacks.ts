type CallbackFunction = (...args: unknown[]) => void;

const callbacks: Map<string, CallbackFunction[]> = new Map();

export function registerCallback(name: string): void {
  if (!callbacks.has(name)) {
    callbacks.set(name, []);
  }
}

export function addCallback(name: string, fn: CallbackFunction): void {
  if (!callbacks.has(name)) {
    callbacks.set(name, []);
  }
  callbacks.get(name)!.push(fn);
}

export function removeCallback(name: string, fn: CallbackFunction): void {
  const fns = callbacks.get(name);
  if (fns) {
    const index = fns.indexOf(fn);
    if (index !== -1) {
      fns.splice(index, 1);
    }
  }
}

export function invokeCallback(name: string, ...args: unknown[]): void {
  const fns = callbacks.get(name);
  if (fns) {
    for (const fn of fns) {
      try {
        fn(...args);
      } catch (err) {
        console.error(`Error in callback '${name}':`, err);
      }
    }
  }
}

export function clearCallbacks(name: string): void {
  callbacks.set(name, []);
}

registerCallback('render');
registerCallback('selectionChanged');
registerCallback('dataChanged');
registerCallback('fileLoaded');
registerCallback('fileSaved');
registerCallback('undoStackChanged');
