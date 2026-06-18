import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { subscribeRefresh } from '@/utils/syncbus';

/**
 * Runs `loader` every time the screen gains focus (e.g. after switching tabs)
 * and whenever a background Drive merge brings in new data, keeping screens
 * fresh. Returns a `reload` you can call imperatively after a mutation.
 */
export function useReload(loader: () => Promise<void> | void) {
  const [, setTick] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const run = useCallback(() => {
    Promise.resolve(loaderRef.current()).catch((e) => console.error('Reload error:', e));
  }, []);

  const reload = useCallback(() => {
    run();
    setTick((t) => t + 1);
  }, [run]);

  useFocusEffect(useCallback(() => run(), [run]));

  // Refresh when a background Drive merge updates the database.
  useEffect(() => subscribeRefresh(run), [run]);

  return reload;
}
