// npm run phone: start the backend with an https link the phone can use, via the Expo tunnel.
//
// Phones only allow the camera and microphone on https pages. `expo start --tunnel`
// gives the TV app's dev server a public https address (https://….exp.direct), and
// apps/FireFitTV/metro.config.js forwards /coach, /voice and /session from it to this
// backend. This script starts the tunnel, waits for its address, then starts the
// backend with PUBLIC_URL set so the QR code on the TV points the phone at it.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const TV_APP = fileURLToPath(new URL('../../apps/FireFitTV/', import.meta.url));
// A port of its own, so it never clashes with a Metro you already have open on 8081.
const free = (port) => new Promise((ok) => {
  const srv = createServer().once('error', () => ok(false)).once('listening', () => srv.close(() => ok(true)));
  srv.listen(port);
});
let METRO_PORT = process.env.METRO_PORT;
for (let p = 8091; !METRO_PORT && p < 8200; p++) if (await free(p)) METRO_PORT = String(p);

const BACKEND_PORT = Number(process.env.PORT ?? 8787);
if (!(await free(BACKEND_PORT))) {
  console.error(`[phone] port ${BACKEND_PORT} is in use: another FitCoach backend is still running. Stop it first:\n  lsof -ti tcp:${BACKEND_PORT} | xargs kill\nthen run npm run phone again.`);
  process.exit(1);
}
console.log('[phone] starting the Expo tunnel (first run can take a minute)…');
const expo = spawn('npx', ['expo', 'start', '--tunnel', '--port', METRO_PORT], {
  cwd: TV_APP,
  env: { ...process.env, CI: '1', DEBUG: 'expo:start:server:ngrok', FITCOACH_BACKEND_PORT: process.env.PORT ?? '8787' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let server;
const stop = () => { expo.kill(); server?.kill(); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

const timeout = setTimeout(() => {
  console.error('[phone] the Expo tunnel did not start within 120 s. Expo said:\n' + log.slice(-2000));
  stop();
}, 120000);

let log = '';
const onOutput = (chunk) => {
  const text = String(chunk).replace(/\x1b\[[0-9;]*m/g, '');
  log += text;
  try { writeFileSync(new URL('../expo-tunnel.log', import.meta.url), log); } catch {}
  process.stdout.write(text.split('\n').filter(Boolean).map((l) => '[expo] ' + l + '\n').join(''));
  const host = log.match(/([a-z0-9-]+\.exp\.direct)/i)?.[1];
  if (!host || server) return;
  clearTimeout(timeout);
  const url = `https://${host}`;
  console.log(`[phone] tunnel ready: ${url}`);
  console.log(`[phone] phone companion (camera + voice): ${url}/coach   — the TV's QR code links here`);
  server = spawn('npm', ['run', 'dev'], { stdio: 'inherit', env: { ...process.env, PUBLIC_URL: url } });
  server.on('exit', (code) => { expo.kill(); process.exit(code ?? 0); });
};
expo.stdout.on('data', onOutput);
expo.stderr.on('data', onOutput);
expo.on('exit', (code) => {
  if (!server) console.error(`[phone] Expo exited (${code}).\n${log.slice(-1500)}`);
  server?.kill();
  process.exit(code ?? 1);
});
