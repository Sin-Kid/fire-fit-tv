// End-to-end run of the FitCoach TV web build against the local backend.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = new URL('./shots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const URL_ = process.env.APP_URL ?? 'http://localhost:8090/';
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const errors = [];

async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()} @ ${m.location().url}`));
  return page;
}
const text = (page, t) => page.getByText(t, { exact: true });
const clock = async (page) => (await page.locator('text=/^\\d+:\\d{2}$/').first().textContent())?.trim();
const shot = (page, n) => page.screenshot({ path: `${OUT}${n}.png` });
/** Open the app and accept the default body data on the "About you" screen. */
async function open(page) {
  await page.goto(URL_);
  await text(page, 'Save and continue').waitFor({ timeout: 15000 });
  await text(page, 'Save and continue').click();
}

// ---------- 1. Main flow ----------
{
  const page = await newPage();
  await page.goto(URL_);
  await text(page, 'Save and continue').waitFor({ timeout: 15000 });
  check('"About you" screen comes first', await page.getByText("Let's set up your calorie counter").isVisible());
  await shot(page, '00-profile');
  await text(page, '+5').first().click(); // weight 70 → 75
  await text(page, '+1').nth(1).click(); // height 170 → 171
  await text(page, 'Male').click();
  check('Weight and height steppers change the values', (await text(page, '75').isVisible()) && (await text(page, '171').isVisible()));
  const saveBtn = await text(page, 'Save and continue').boundingBox();
  check('"About you" fits on a 1080p screen', saveBtn && saveBtn.y + saveBtn.height <= 1080, `bottom at ${Math.round(saveBtn.y + saveBtn.height)}px`);
  await text(page, 'Save and continue').click();
  await text(page, 'Build my workout').waitFor({ timeout: 15000 });
  check('Setup shows the saved body data', await page.getByText(/^You: 75 kg · 171 cm · 25 y$/).isVisible());
  check('Setup screen renders', await page.getByText('FitCoach').first().isVisible());
  await shot(page, '01-setup');

  for (const label of ['Fat Burn', '15 min', 'Intermediate', 'Dumbbells', 'Quiet / no jumping']) await text(page, label).click();
  await shot(page, '02-setup-selected');
  const btn = await text(page, 'Build my workout').boundingBox();
  check('"Build my workout" fits on a 1080p screen without scrolling', btn && btn.y + btn.height <= 1080, `bottom at ${Math.round(btn.y + btn.height)}px`);

  // Keyboard focus: Tab onto a control and confirm the focused style (lime border) is applied.
  await page.keyboard.press('Tab');
  const focusedBorder = await page.evaluate(() => getComputedStyle(document.activeElement).borderTopColor);
  check('Focused control gets the lime focus border', focusedBorder === 'rgb(198, 244, 50)', focusedBorder);

  await text(page, 'Build my workout').click();
  await text(page, 'Start').waitFor({ timeout: 15000 });
  await shot(page, '03-preview');
  const title = await page.getByText(/-Minute Fat Burn/).first().textContent();
  check('Preview shows a generated workout', !!title, title);
  check('Preview badge shows source (backend reached)', await text(page, 'Standard workout').isVisible());
  const bodyText = await page.locator('body').innerText();
  check('Dumbbell moves included when dumbbells selected', bodyText.includes('Dumbbell'));
  check('Coach intro mentions equipment', /^An intermediate fat burn session using your dumbbells/m.test(bodyText));
  const est = Number(bodyText.match(/≈(\d+)\s*\n\s*kcal \(est\.\)/)?.[1]);
  check('Preview estimates calories for the whole workout (15 min: 60–250 kcal)', est >= 60 && est <= 250, String(est));

  await text(page, 'New version').click();
  await text(page, 'Start').waitFor({ timeout: 15000 });
  check('"New version" regenerates and returns to preview', true);

  await text(page, 'Start').click();
  await text(page, 'GET READY').waitFor({ timeout: 5000 });
  check('Player starts with a get-ready countdown', true);
  await shot(page, '04-get-ready');

  await page.getByText(/WARM-UP · 1 of \d+/).waitFor({ timeout: 6000 });
  check('Get-ready auto-advances to exercise 1', true);
  const total = Number((await page.getByText(/WARM-UP · 1 of \d+/).textContent()).match(/of (\d+)/)[1]);

  // Animated exercise demo
  const fig = page.locator('[aria-label$=" demonstration"]').first();
  check('Exercise animation is shown for the current move', await fig.isVisible(), await fig.getAttribute('aria-label'));
  const pathD = () => page.locator('[aria-label$=" demonstration"] path').nth(4).getAttribute('d');
  const d1 = await pathD(); await page.waitForTimeout(400); const d2 = await pathD();
  check('Exercise animation moves', d1 !== d2);
  await shot(page, '05b-animation');
  const kcalNow = async () => Number((await page.locator('body').innerText()).match(/(\d+)\s*\n?\s*KCAL/)?.[1]);
  const c1 = await clock(page);
  await page.waitForTimeout(2200);
  const c2 = await clock(page);
  check('Exercise timer counts down', c1 !== c2, `${c1} → ${c2}`);
  check('Calorie counter is shown in the player', Number.isFinite(await kcalNow()));
  await shot(page, '05-exercise');

  await text(page, 'Make it easier').click();
  check('"Make it easier" swaps the cue', await page.getByText(/^Easier: /).isVisible());
  await shot(page, '06-easier');
  await text(page, 'Standard move').click();
  check('"Standard move" swaps back', !(await page.getByText(/^Easier: /).isVisible()));

  await text(page, 'Pause').click();
  await text(page, 'PAUSED').waitFor();
  const p1 = await clock(page);
  await page.waitForTimeout(2000);
  const p2 = await clock(page);
  check('Pause freezes the timer', p1 === p2, `${p1} = ${p2}`);
  const pd1 = await pathD(); await page.waitForTimeout(500); const pd2 = await pathD();
  check('Animation freezes while paused', pd1 === pd2);
  await shot(page, '07-paused');
  await text(page, 'Resume').click();
  await page.waitForTimeout(1500);
  check('Resume restarts the timer', (await clock(page)) !== p2);

  await text(page, 'Skip').click();
  check('Skip moves to exercise 2', await page.getByText(new RegExp(`· 2 of ${total}$`)).isVisible());

  await text(page, 'End workout').click();
  await text(page, 'WORKOUT COMPLETE').waitFor({ timeout: 5000 });
  const sum = await page.locator('body').innerText();
  check('Summary: 0 completed before ending', sum.includes(`0/${total}`), `expected 0/${total}`);
  check('Summary: 1 skipped, 1 scaled down', /1\s*\n\s*scaled down/.test(sum) && /1\s*\n\s*skipped/.test(sum));
  check('Summary shows calories burned', /\d+\s*\n\s*kcal burned \(est\.\)/.test(sum));
  await page.getByText(/Great work|Next time/).first().waitFor({ timeout: 8000 });
  check('Coach recap loads from /recap', true);
  await shot(page, '08-summary');

  await text(page, 'Do it again').click();
  check('"Do it again" restarts the player', await text(page, 'GET READY').isVisible());
  await text(page, 'End workout').click();
  await text(page, 'New workout').click();
  await text(page, 'Build my workout').waitFor();
  check('"New workout" returns to setup', true);
  await page.close();
}

// ---------- 2. Offline fallback ----------
{
  const page = await newPage();
  await page.route('**/workout', (r) => r.abort());
  await page.route('**/recap', (r) => r.abort());
  await open(page);
  await text(page, 'Build my workout').click();
  await text(page, 'Start').waitFor({ timeout: 15000 });
  check('API down → on-device workout with "Offline workout" badge', await text(page, 'Offline workout').isVisible());
  await shot(page, '09-offline');
  await page.close();
}

// ---------- 3. Full run with a fake clock: every segment auto-advances ----------
{
  const page = await newPage();
  await page.clock.install();
  await open(page);
  await text(page, 'Build my workout').waitFor({ timeout: 15000 });
  await text(page, '10 min').click();
  await text(page, 'Build my workout').click();
  await text(page, 'Start').waitFor({ timeout: 15000 });
  const preview = await page.locator('body').innerText();
  const moves = Number(preview.match(/(\d+)\s*\n\s*moves/)[1]);
  await text(page, 'Start').click();
  let sawRest = false;
  for (let i = 0; i < 800 && !(await text(page, 'WORKOUT COMPLETE').isVisible()); i++) {
    await page.clock.runFor(1000);
    if (!sawRest && (await page.getByText('REST · BREATHE').isVisible())) {
      sawRest = true;
      await shot(page, '10-rest');
    }
  }
  const done = await text(page, 'WORKOUT COMPLETE').isVisible();
  check('Whole 10-min workout runs to the end on its own', done);
  check('Rest screens appear between moves', sawRest);
  if (done) {
    const sum = await page.locator('body').innerText();
    check(`Summary counts all ${moves} moves completed`, sum.includes(`${moves}/${moves}`));
    const active = sum.match(/(\d+:\d{2})\s*\n\s*active time/)?.[1];
    check('Active time is roughly the work time (8–10 min)', !!active && +active.split(':')[0] >= 7 && +active.split(':')[0] <= 10, active);
    const burned = Number(sum.match(/(\d+)\s*\n\s*kcal burned/)?.[1]);
    const planned = Number(preview.match(/≈(\d+)\s*\n\s*kcal/)?.[1]);
    check('Full run burns about what the preview estimated (±10%)', Math.abs(burned - planned) <= planned * 0.1 + 2, `${burned} vs ≈${planned}`);
    await shot(page, '11-full-summary');
  }
  await page.close();
}

// ---------- 5. Voice commands through the voice remote ----------
{
  const page = await newPage();
  await open(page);
  await text(page, '10 min').click();
  await text(page, 'Build my workout').click();
  await text(page, 'Start').waitFor({ timeout: 15000 });
  const body = await page.locator('body').innerText();
  const code = body.match(/enter code\s*(\d{4})/)?.[1];
  check('Preview shows the voice remote code', !!code, code);
  const API = 'http://localhost:8787';
  const say = (heard) => fetch(`${API}/session/${code}/voice`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(heard ? { heard } : {}) });
  await say();
  await page.getByText('Voice remote connected').waitFor({ timeout: 5000 });
  check('Preview shows "Voice remote connected"', true);
  const vr = await (await fetch(`${API}/voice?code=${code}`)).text();
  check('Voice remote page is served', /FitCoach <span>Voice Remote/.test(vr));

  await say('start');
  await page.getByText(/WARM-UP · 1 of \d+/).waitFor({ timeout: 10000 });
  check('"start" on the preview starts the workout', true);
  await say('wait');
  await text(page, 'PAUSED').waitFor({ timeout: 4000 });
  check('"wait" pauses the workout', true);
  await shot(page, '14-voice-paused');
  await say("let's go");
  await text(page, 'PAUSED').waitFor({ state: 'hidden', timeout: 4000 });
  check('"let\'s go" resumes', true);
  await say('make it easier');
  await page.getByText(/^Easier: /).waitFor({ timeout: 4000 });
  check('"make it easier" shows the easier version', true);
  await say('more rest');
  await page.getByText(/extra on your next rest/).waitFor({ timeout: 4000 });
  check('"more rest" during a move queues extra rest', true);
  for (let i = 0; i < 8 && !(await text(page, 'REST · BREATHE').isVisible()); i++) {
    await say('skip'); // warm-up moves often have no rest after them
    await page.waitForTimeout(1500);
  }
  await text(page, 'REST · BREATHE').waitFor({ timeout: 4000 });
  const restClock = await clock(page);
  const [m, sec] = restClock.split(':').map(Number);
  check('Next rest is 15 s longer', m * 60 + sec >= 25, restClock);
  await say('increase rest');
  await page.getByText(/Adding 15 seconds of rest/).waitFor({ timeout: 4000 });
  const rc2 = await clock(page);
  check('"increase rest" during rest adds 15 s', rc2.split(':').reduce((a, b) => a * 60 + +b, 0) > m * 60 + sec + 8, `${restClock} → ${rc2}`);
  await shot(page, '15-voice-more-rest');
  await say('slow down');
  await page.getByText(/Slowing down|slower demos/).waitFor({ timeout: 4000 });
  check('"slow down" is understood', true);
  await say('what a lovely day');
  await page.getByText(/Try “skip”/).waitFor({ timeout: 4000 });
  check('Unrecognised speech gets a hint, nothing happens', await text(page, 'REST · BREATHE').isVisible());
  await say('skip'); // to the next move
  await page.getByText(/WORKOUT · |WARM-UP · |COOL-DOWN · /).first().waitFor({ timeout: 4000 });
  await say('rest');
  await text(page, 'REST · BREATHE').waitFor({ timeout: 4000 });
  check('"rest" during a move starts a rest right away', true);
  await say('end workout');
  await text(page, 'WORKOUT COMPLETE').waitFor({ timeout: 4000 });
  check('"end workout" ends the session', true);
  await page.close();
}

// ---------- 4. TV-sized window (960×540, like Android/Fire TV dp): sharp native sizing, everything fits ----------
{
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await open(page);
  await text(page, 'Build my workout').waitFor({ timeout: 15000 });
  const scaled = await page.evaluate(() => [...document.querySelectorAll('div')].some((d) => /scale\(/.test(getComputedStyle(d).transform === 'none' ? '' : d.style.transform)));
  check('960×540: no scale transform on the canvas (text rendered at native size)', !scaled);
  const b = await text(page, 'Build my workout').boundingBox();
  check('960×540: setup fits', b && b.y + b.height <= 540, `bottom at ${Math.round(b.y + b.height)}`);
  const fs = await text(page, 'Build my workout').evaluate((el) => getComputedStyle(el).fontSize);
  check('960×540: fonts are halved (40px design → 20px)', fs === '20px', fs);
  await shot(page, '12-tv-960');
  await text(page, 'Build my workout').click();
  await text(page, 'Start').click({ timeout: 15000 });
  await page.getByText(/WARM-UP · 1 of \d+/).waitFor({ timeout: 8000 });
  await shot(page, '13-tv-960-player');
  const end = await text(page, 'End workout').boundingBox();
  check('960×540: player controls fit', end && end.y + end.height <= 540, `bottom at ${Math.round(end.y + end.height)}`);
  await ctx.close();
}

// Expected noise: favicon 404 from the static test server, and the requests the offline test aborts on purpose.
const real = errors.filter((e) => !/favicon\.ico/.test(e) && !/ERR_FAILED @ http:\/\/localhost:8787\/(workout|recap)/.test(e));
console.log('console errors seen:', errors);
check('No unexpected JS errors in the browser console', real.length === 0, real.slice(0, 5).join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
