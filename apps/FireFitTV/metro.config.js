// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// When enabled, the optional code below will allow Metro to resolve
// and bundle source files with TV-specific extensions
// (e.g., *.ios.tv.tsx, *.android.tv.tsx, *.tv.tsx)
//
// Metro will still resolve source files with standard extensions
// as usual if TV-specific files are not found for a module.
//
/*
if (process.env?.EXPO_TV === '1') {
  const originalSourceExts = config.resolver.sourceExts;
  const tvSourceExts = [
    ...originalSourceExts.map((e) => `tv.${e}`),
    ...originalSourceExts,
  ];
  config.resolver.sourceExts = tvSourceExts;
}
 */

// Phone companion over the Expo tunnel.
// `npx expo start --tunnel` gives this dev server a public https address. Phones only
// allow the camera and microphone on https pages, so Metro also forwards the phone
// page and its API (/coach, /voice, /session) to the FitCoach backend on this computer.
// The phone then opens https://<tunnel>.exp.direct/coach and everything just works.
const http = require('http');
const BACKEND_PORT = Number(process.env.FITCOACH_BACKEND_PORT ?? 8787);
const PHONE_PATHS = /^\/(coach|voice|session)(\/|\?|$)/;

function proxyToBackend(req, res) {
  const upstream = http.request(
    { host: '127.0.0.1', port: BACKEND_PORT, method: req.method, path: req.url, headers: { ...req.headers, host: `localhost:${BACKEND_PORT}` } },
    (r) => {
      res.writeHead(r.statusCode ?? 502, r.headers);
      r.pipe(res);
    },
  );
  upstream.on('error', () => {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('FitCoach backend is not running. Start it with: cd backend && npm run dev');
  });
  req.pipe(upstream);
}

const prevEnhance = config.server?.enhanceMiddleware;
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware, server) => {
    const base = prevEnhance ? prevEnhance(middleware, server) : middleware;
    return (req, res, next) => (PHONE_PATHS.test(req.url ?? '') ? proxyToBackend(req, res) : base(req, res, next));
  },
};

module.exports = config;
