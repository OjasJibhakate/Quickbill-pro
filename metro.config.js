// Metro config — customized to support expo-sqlite on WEB.
// expo-sqlite's web build ships a WebAssembly module (wa-sqlite.wasm) and runs
// SQLite in a Web Worker over OPFS, which needs:
//   1. `.wasm` treated as a bundled asset, and
//   2. COOP/COEP headers so SharedArrayBuffer is available when served in dev.
// These changes are web-only; the native (Android/iOS) bundle is unaffected.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('wasm');

config.server = config.server || {};
const prevEnhance = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, server) => {
  const withHeaders = (req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    middleware(req, res, next);
  };
  return prevEnhance ? prevEnhance(withHeaders, server) : withHeaders;
};

module.exports = config;
