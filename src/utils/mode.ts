/**
 * App "business mode" — one codebase, two products:
 *   - 'kirana'      → QuickBill Pro (retail / grocery, quick-cart billing)
 *   - 'restaurant'  → QuickServe POS (restaurant / hotel, table-based billing)
 *
 * The mode is fixed at BUILD time by app.config.js (driven by the APP_FLAVOR
 * env var / EAS build profile) and read here from Constants.extra.appMode.
 * Kirana is the default, so the retail app is unaffected.
 */
import Constants from 'expo-constants';

export type AppMode = 'kirana' | 'restaurant';

export const APP_MODE: AppMode =
  (Constants.expoConfig?.extra as any)?.appMode === 'restaurant' ? 'restaurant' : 'kirana';

export const isRestaurant = APP_MODE === 'restaurant';
export const isKirana = APP_MODE === 'kirana';

/** Product catalogue is called "Menu" in a restaurant, "Products" in a shop. */
export const catalogueLabel = isRestaurant ? 'Menu' : 'Products';
