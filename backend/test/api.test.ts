import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.USE_BEDROCK = 'false'; // tests run offline

const { handle } = await import('../src/handler.js');
const { sanitizeExercises } = await import('../src/validate.js');

test('health reports status', async () => {
  const r = await handle('GET', '/health', undefined);
  assert.equal(r.status, 200);
  assert.equal((r.body as { ok: boolean }).ok, true);
});

for (const minutes of [10, 15, 20, 30, 45]) {
  for (const goal of ['strength', 'cardio', 'mobility', 'fat-burn']) {
    test(`fallback ${goal} ${minutes}min fits the time budget`, async () => {
      const r = await handle('POST', '/workout', JSON.stringify({ goal, minutes, level: 'intermediate', equipment: ['none'] }));
      assert.equal(r.status, 200);
      const w = r.body as { totalSec: number; exercises: { phase: string }[]; source: string };
      assert.equal(w.source, 'fallback');
      assert.ok(w.totalSec <= minutes * 60, `total ${w.totalSec} > ${minutes * 60}`);
      assert.ok(w.totalSec >= minutes * 60 * 0.7, `total ${w.totalSec} too short`);
      assert.equal(w.exercises[0].phase, 'warmup');
      assert.equal(w.exercises.at(-1)!.phase, 'cooldown');
    });
  }
}

test('equipment moves only appear when selected', async () => {
  const none = await handle('POST', '/workout', JSON.stringify({ goal: 'strength', minutes: 20, equipment: ['none'] }));
  const names = (none.body as { exercises: { name: string }[] }).exercises.map((e) => e.name);
  assert.ok(!names.some((n) => n.includes('Dumbbell')));
  const db = await handle('POST', '/workout', JSON.stringify({ goal: 'strength', minutes: 20, equipment: ['dumbbells'] }));
  const dbNames = (db.body as { exercises: { name: string }[] }).exercises.map((e) => e.name);
  assert.ok(dbNames.some((n) => n.includes('Dumbbell')));
});

for (const goal of ['strength', 'cardio', 'mobility', 'fat-burn']) {
  for (const [eq, word] of [['dumbbells', 'Dumbbell'], ['kettlebell', 'Kettlebell'], ['resistance-band', 'Band']] as const) {
    test(`fallback ${goal} uses selected ${eq}`, async () => {
      const r = await handle('POST', '/workout', JSON.stringify({ goal, minutes: 15, equipment: [eq] }));
      const names = (r.body as { exercises: { name: string }[] }).exercises.map((e) => e.name);
      assert.ok(names.some((n) => n.includes(word)), `${goal} + ${eq}: ${names.join(', ')}`);
    });
  }
}

test('rejects bad input', async () => {
  assert.equal((await handle('POST', '/workout', '{"goal":"yoga","minutes":20}')).status, 400);
  assert.equal((await handle('POST', '/workout', '{"goal":"cardio","minutes":7}')).status, 400);
  assert.equal((await handle('POST', '/workout', 'not json')).status, 400);
  assert.equal((await handle('GET', '/nope', undefined)).status, 404);
});

test('recap falls back offline', async () => {
  const r = await handle('POST', '/recap', JSON.stringify({ title: 'X', completed: 8, skipped: 0, easierUsed: 0, activeSec: 600 }));
  assert.equal(r.status, 200);
  assert.match((r.body as { text: string }).text, /8 exercises/);
});

test('sanitizer clamps untrusted model output', () => {
  const out = sanitizeExercises([
    { name: 'Cooldown thing', phase: 'cooldown', durationSec: 9999, restSec: -5, intensity: 99 },
    { name: 'Warm', phase: 'warmup', durationSec: 1 },
    { name: '', phase: 'main' },
    'garbage',
  ]);
  assert.equal(out.length, 2);
  assert.equal(out[0].phase, 'warmup');
  assert.equal(out[0].durationSec, 15);
  assert.equal(out[1].durationSec, 120);
  assert.equal(out[1].restSec, 0);
  assert.equal(out[1].intensity, 5);
});
