import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

/**
 * Runs `loader` every time the screen gains focus (e.g. after switching tabs),
 * keeping data fresh without a manual refresh. Returns a `reload` you can call
 * imperatively after a mutation.
 */
export function useReload(loader: () => Promise<void> | void) {
  const [, setTick] = useState(0);

  const reload = useCallback(() => {
    Promise.resolve(loader()).catch((e) => console.error('Reload error:', e));
    setTick((t) => t + 1);
  }, [loader]);

  useFocusEffect(
    useCallback(() => {
      Promise.resolve(loader()).catch((e) => console.error('Reload error:', e));
    }, [loader])
  );

  return reload;
}
