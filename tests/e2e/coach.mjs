// End-to-end test of the phone form camera with two browser windows:
// the TV app and the phone page, with a scripted "person" in front of the camera.
//
//   1. backend:  cd backend && USE_BEDROCK=false npm run dev
//   2. TV app:   web build with API_BASE_URL = 'http://localhost:8787', served on :8091
//   3. frames:   npx tsx tests/e2e/make-pose-frames.ts
//   4. run:      node tests/e2e/coach.mjs
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';

const TV = process.env.TV_URL ?? 'http://localhost:8091/';
const API = process.env.API_URL ?? 'http://localhost:8787';
const OUT = new URL('./shots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const frames = JSON.parse(readFileSync(new URL('./pose-frames.json', import.meta.url), 'utf8'));

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const errors = [];

// ---------- TV ----------
const tvCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
await tvCtx.addInitScript(() => {
  // Record what the TV says out loud.
  window.__spoken = [];
  const synth = window.speechSynthesis;
  if (synth) {
    const orig = synth.speak.bind(synth);
    synth.speak = (u) => { window.__spoken.push(u.text); try { orig(u); } catch {} };
    // Headless Chromium has no TTS voices; pretend one exists so the TV keeps its Voice button.
    synth.getVoices = () => [{ voiceURI: 'test', name: 'Test voice', lang: 'en-US', localService: true, default: true }];
  }
});
const tv = await tvCtx.newPage();
tv.on('pageerror', (e) => errors.push(`tv: ${e.message}`));
await tv.goto(TV);
const txt = (p, s) => p.getByText(s, { exact: true });
await txt(tv, 'Save and continue').click({ timeout: 15000 }); // "About you" (calorie counter) defaults

await txt(tv, 'Strength').click();
await txt(tv, 'Build my workout').click();
await txt(tv, 'Start').waitFor({ timeout: 15000 });
check('Preview shows the form-camera QR panel', await txt(tv, 'Scan with your phone').isVisible());
check('QR code is drawn', await tv.locator('[aria-label="QR code for the phone form camera"]').isVisible());
const body = await tv.locator('body').innerText();
const code = body.match(/enter code\s*(\d{4})/)?.[1];
check('Pairing code is shown', !!code, code);
check('TV waits for the phone', /Waiting for your phone/.test(body));
await tv.screenshot({ path: `${OUT}coach-01-tv-pairing.png` });

// ---------- phone ----------
const phoneCtx = await browser.newContext({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await phoneCtx.addInitScript((seq) => {
  // Fake camera: play the demo that matches the move on the TV; squats are done too shallow on purpose.
  const byName = { 'Bodyweight Squats': seq.shallowSquat };
  window.__poseSource = (now) => {
    const name = document.getElementById('exercise')?.textContent ?? '';
    const s = byName[name] ?? seq.march;
    const f = s[Math.floor(now / 33) % s.length];
    return f.map(([x, y, v]) => ({ x, y, z: 0, visibility: v }));
  };
}, { shallowSquat: frames.shallowSquat, march: frames.march });
const phone = await phoneCtx.newPage();
phone.on('pageerror', (e) => errors.push(`phone: ${e.message}`));
await phone.goto(`${API}/coach?code=${code}`);
check('Phone page prefills the code from the QR link', (await phone.locator('#code').inputValue()) === code);

await phone.locator('#code').fill('0000');
await phone.locator('#connect').click();
await phone.getByText(/Code not found|Can't reach/).waitFor({ timeout: 5000 });
check('Wrong code is rejected with a clear message', await phone.getByText('Code not found. Check your TV.').isVisible());

await phone.locator('#code').fill(code);
await phone.locator('#connect').click();
await phone.getByText(`Connected to TV ${code}`).waitFor({ timeout: 5000 });
check('Phone connects with the right code', true);
await tv.getByText('Phone connected. Tap Start camera + mic on it.').waitFor({ timeout: 5000 });
check('TV sees the phone connect', true);

await phone.locator('#start').click();
await phone.getByText('Watching your position and form').waitFor({ timeout: 5000 });
await tv.getByText('Camera on. Form coaching is live.').waitFor({ timeout: 6000 });
check('TV sees the camera go live', true);
await phone.screenshot({ path: `${OUT}coach-02-phone.png` });

// ---------- workout ----------
await txt(tv, 'Start').click();
await tv.getByText(/WARM-UP · 1 of/).waitFor({ timeout: 8000 });
await phone.locator('#exercise', { hasText: 'March in Place' }).waitFor({ state: 'attached', timeout: 6000 });
check('Phone learns the current move from the TV', true);
await tv.waitForTimeout(3500);
const marchReps = Number(await phone.locator('#reps').textContent());
check('Phone counts reps on the warm-up march', marchReps >= 2, `${marchReps} reps`);
// Voice commands from the same phone page (tap buttons go through the same path as speech).
check('Phone is a companion only: camera + mic status, no workout controls', (await phone.locator('#micChip').isVisible()) && (await phone.locator('#camChip').textContent()) === 'Camera on' && !(await phone.getByRole('button', { name: 'skip' }).count()));
// What the phone's speech recognition would send (headless Chromium has no speech service).
const phoneSays = (heard) => phone.evaluate(([api, c, h]) => fetch(`${api}/session/${c}/voice`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ heard: h }) }), [API, code, heard]);
await phoneSays('wait');
await txt(tv, 'PAUSED').waitFor({ timeout: 4000 });
check('Phone "wait" pauses the TV', true);
await phoneSays("let's go");
await txt(tv, 'PAUSED').waitFor({ state: 'hidden', timeout: 4000 });
check('Phone "go" resumes the TV', true);
check('TV shows the live rep count', await tv.getByText(/^\d+ $/).first().isVisible().catch(() => false) || /\d+\s+reps?/.test(await tv.locator('body').innerText()));
check('TV shows the "Form camera live" badge', await txt(tv, 'Form camera live').isVisible());

for (let i = 0; i < 3; i++) await txt(tv, 'Skip').click();
await txt(tv, 'Bodyweight Squats').waitFor({ timeout: 5000 });
await phone.locator('#exercise', { hasText: 'Bodyweight Squats' }).waitFor({ state: 'attached', timeout: 6000 });
await tv.getByText('Sit a little deeper. Aim for thighs parallel to the floor.').waitFor({ timeout: 15000 });
check('Shallow squats → TV captions the correction', true);
check('Caption is labelled as a form tip', await txt(tv, 'FORM TIP').isVisible());
const spoken = await tv.evaluate(() => window.__spoken);
check('TV speaks the correction out loud', spoken.some((s) => /Sit a little deeper/.test(s)), JSON.stringify(spoken.slice(-3)));
check('Phone shows the same caption', /Sit a little deeper/.test(await phone.locator('#caption').textContent()));
await tv.screenshot({ path: `${OUT}coach-03-tv-caption.png` });
await phone.screenshot({ path: `${OUT}coach-04-phone-cue.png` });

await txt(tv, 'Voice on').click();
check('Voice can be switched off', await txt(tv, 'Voice off').isVisible());
const before = (await tv.evaluate(() => window.__spoken)).length;
await tv.waitForTimeout(9000);
check('Muted voice stops speaking new cues', (await tv.evaluate(() => window.__spoken)).length === before);
await txt(tv, 'Voice off').click();

await txt(tv, 'Pause').click();
await tv.waitForTimeout(2500);
check('Pausing the TV pauses coaching on the phone', /Resting/.test(await phone.locator('#exercise').textContent()));
await txt(tv, 'Resume').click();

// ---------- summary ----------
await tv.waitForTimeout(2500);
await txt(tv, 'End workout').click();
await txt(tv, 'WORKOUT COMPLETE').waitFor({ timeout: 6000 });
await txt(tv, 'FORM CAMERA').waitFor({ timeout: 8000 });
const sum = await tv.locator('body').innerText();
check('Summary lists form-camera results', /Bodyweight Squats\s*\n?\s*0\/\d+ good/.test(sum), sum.match(/FORM CAMERA[\s\S]{0,120}/)?.[0]?.replace(/\n/g, ' | '));
await tv.getByText(/best form was on/).waitFor({ timeout: 8000 });
check('Recap mentions form', true);
const spokenEnd = await tv.evaluate(() => window.__spoken);
check('Recap is spoken', spokenEnd.some((s) => /best form was on/.test(s)));
await tv.screenshot({ path: `${OUT}coach-05-tv-summary.png` });

check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
