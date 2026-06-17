import * as Crypto from 'expo-crypto';

/**
 * Generates a unique id. React Native has no global `crypto.randomUUID`,
 * so we rely on expo-crypto which is available on device and web.
 */
export const newId = (prefix?: string): string => {
  const uuid = Crypto.randomUUID();
  return prefix ? `${prefix}-${uuid}` : uuid;
};
