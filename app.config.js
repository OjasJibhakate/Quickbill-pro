/**
 * Dynamic Expo config — ONE codebase, TWO flavors.
 *
 * Default build           → QuickBill Pro   (kirana / retail)     package com.quickbill.pro
 * APP_FLAVOR=restaurant    → QuickServe POS  (restaurant / hotel)  package com.quickbill.resto
 *
 * The base values live in app.json; this file only overrides what differs per
 * flavor, so the kirana app is byte-for-byte unchanged. Build the restaurant
 * APK with:   eas build -p android --profile restaurant
 * or locally: APP_FLAVOR=restaurant npx expo start
 */
module.exports = ({ config }) => {
  const flavor = process.env.APP_FLAVOR === 'restaurant' ? 'restaurant' : 'kirana';

  if (flavor === 'restaurant') {
    return {
      ...config,
      name: 'QuickServe POS',
      android: { ...config.android, package: 'com.quickbill.resto' },
      ios: { ...config.ios, bundleIdentifier: 'com.quickbill.resto' },
      extra: { ...config.extra, appMode: 'restaurant' },
    };
  }

  return {
    ...config,
    extra: { ...config.extra, appMode: 'kirana' },
  };
};
