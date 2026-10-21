// Laptop mode: the browser build with a (scripted) webcam coaches form by itself, no phone.
//   1. backend: USE_BEDROCK=false npm run dev   2. TV web build served on :8091
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';

const TV = process.env.TV_URL ?? 'http://localhost:8091/';
const OUT = new URL('./shots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const frames = JSON.parse(readFileSync(new URL('./pose-frames.json', import.meta.url), 'utf8'));
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
await ctx.addInitScript((march) => {
  // Scripted webcam: someone marching in place.
  window.__poseSource = (now) => march[Math.floor(now / 33) % march.length].map(([x, y, v]) => ({ x, y, z: 0, visibility: v }));
}, frames.march);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const txt = (s) => page.getByText(s, { exact: true });

await page.goto(TV);
await txt('Save and continue').click({ timeout: 15000 });
await txt('Build my workout').click();
await txt('Start').waitFor({ timeout: 15000 });
check('Laptop with a camera is detected automatically', await page.getByText('LAPTOP MODE · CAMERA + MIC').isVisible());
check('No phone QR panel in laptop mode', !(await page.getByText('Scan with your phone').isVisible()));
await page.screenshot({ path: `${OUT}laptop-01-preview.png` });

await txt('Start').click();
await page.getByText(/WARM-UP · 1 of/).waitFor({ timeout: 10000 });
await txt('Form camera live').waitFor({ timeout: 8000 });
check('Webcam coach goes live in the player', true);
await page.waitForTimeout(5000);
const body = await page.locator('body').innerText();
const reps = Number(body.match(/(\d+)\s*\n?\s*reps?\b/)?.[1] ?? 0);
check('Reps are counted from the laptop camera', reps >= 2, `${reps} reps`);
check('Mic is on automatically in laptop mode', await txt('Mic on').isVisible());
await page.screenshot({ path: `${OUT}laptop-02-player.png` });

await txt('End workout').click();
await txt('WORKOUT COMPLETE').waitFor({ timeout: 5000 });
await txt('LAPTOP CAMERA').waitFor({ timeout: 8000 });
check('Summary lists the laptop-camera results', true);
await page.screenshot({ path: `${OUT}laptop-03-summary.png` });
check('No page errors', errors.length === 0, errors.join(' | '));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
