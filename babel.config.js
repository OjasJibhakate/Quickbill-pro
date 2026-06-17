module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo (SDK 56) automatically adds the
    // react-native-worklets/reanimated Babel plugin when those packages
    // are installed, so we don't list it manually here.
    presets: ['babel-preset-expo'],
  };
};
