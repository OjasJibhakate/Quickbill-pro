// Lightweight pub/sub so a background Drive merge can refresh open screens.
const listeners = new Set<() => void>();

export const subscribeRefresh = (cb: () => void): (() => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

export const emitRefresh = (): void => {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore */
    }
  });
};
