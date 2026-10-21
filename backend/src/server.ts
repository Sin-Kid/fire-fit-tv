// Local development server. Run with `npm run dev`.
// The Android TV emulator reaches it at http://10.0.2.2:8787, a Fire TV stick at http://<your-computer-LAN-IP>:8787

import { createServer } from 'node:http';
import { handle } from './handler.js';

const PORT = Number(process.env.PORT ?? 8787);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS).end();
    return;
  }
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const path = new URL(req.url ?? '/', 'http://x').pathname;
  const out = await handle(req.method ?? 'GET', path, Buffer.concat(chunks).toString('utf8'));
  res.writeHead(out.status, { 'Content-Type': out.contentType ?? 'application/json', ...CORS });
  res.end(out.contentType ? String(out.body) : JSON.stringify(out.body));
}).listen(PORT, '0.0.0.0', () => {
  console.log(`[fitcoach] API listening on http://0.0.0.0:${PORT}`);
  console.log(`[fitcoach] Bedrock ${process.env.USE_BEDROCK === 'false' ? 'DISABLED (fallback only)' : 'enabled'}`);
  console.log(`[fitcoach] Form camera page: http://localhost:${PORT}/coach  (camera access needs localhost or https)`);
  if (process.env.PUBLIC_URL) console.log(`[fitcoach] Phone link in the TV's QR code: ${process.env.PUBLIC_URL.replace(/\/+$/, '')}/coach`);
  else console.log('[fitcoach] To use a phone camera, start an https tunnel and set PUBLIC_URL (see README).');
});
