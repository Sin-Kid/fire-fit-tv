// Sanity checks for the exercise animations:  npx tsx scripts/check-exercise-animations.ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ANIMATIONS, GROUND, HEAD_R, animationFor, cycleMs, hasDedicatedAnimation, shapesFor, skeletonAtTime,
} from '../src/lib/exerciseAnimations';

let failures = 0;
const check = (name: string, fn: () => void) => {
  try {
    fn();
    console.log(`PASS  ${name}`);
  } catch (e) {
    failures++;
    console.log(`FAIL  ${name}  — ${(e as Error).message}`);
  }
};

// 1. Every move the offline generator can produce has its own animation.
const fallbackSrc = readFileSync(join(__dirname, '..', 'src', 'lib', 'fallback.ts'), 'utf8');
const names = [...fallbackSrc.matchAll(/name: (['"])(.+?)\1/g)].map((m) => m[2]);
check(`all ${names.length} offline-generator moves have a dedicated animation`, () => {
  const missing = names.filter((n) => !hasDedicatedAnimation(n));
  assert.deepEqual(missing, []);
});
check('offline moves map to the animation with the same label where one exists', () => {
  const byLabel = new Map(ANIMATIONS.map((a) => [a.label, a.key]));
  const wrong = names.filter((n) => byLabel.has(n) && animationFor(n).key !== byLabel.get(n)).map((n) => `${n}→${animationFor(n).key}`);
  assert.deepEqual(wrong, []);
});

// 2. Common names Bedrock may generate.
const bedrockish: Record<string, string> = {
  'Goblet Squat': 'squat', 'Jump Squats': 'squat', 'Walking Lunges': 'lunge', 'Incline Push-Ups': 'pushup',
  'Side Plank': 'plank', 'Bicycle Crunches': 'crunch', 'Burpees': 'burpee', 'Overhead Press': 'press',
  'Bent-Over Row': 'row', 'Hammer Curls': 'curl', 'Romanian Deadlift': 'deadlift', 'Hip Thrusts': 'bridge',
  'Butt Kicks': 'highKnees', 'Lateral Shuffle': 'skater', 'Jab Cross': 'boxing', "Child's Pose": 'breathing',
  'Hamstring Stretch': 'forwardFold', 'Leg Swings': 'hipOpeners', 'Arm Swings': 'armCircles', 'Narrow Squat': 'squat',
  'Box Jumps': 'squat', 'Open Book Stretch': 'thoracic', 'Spiderman Lunge': 'wgs',
};
check('common Bedrock-style names map sensibly', () => {
  const wrong = Object.entries(bedrockish).filter(([n, k]) => animationFor(n).key !== k).map(([n, k]) => `${n}: got ${animationFor(n).key}, want ${k}`);
  assert.deepEqual(wrong, []);
});
check('unknown names fall back by phase', () => {
  assert.equal(animationFor('Zorblax 3000').key, 'march');
  assert.equal(animationFor('Zorblax 3000', 'cooldown').key, 'breathing');
});

// 3. Geometry is sane on every frame.
for (const a of ANIMATIONS) {
  check(`${a.key}: finite, on canvas, feet not below the floor`, () => {
    const total = cycleMs(a);
    assert.ok(total >= 400 && total <= 12000, `cycle ${total}ms`);
    const count = shapesFor(a, skeletonAtTime(a, 0)).length;
    for (let i = 0; i <= 120; i++) {
      const s = skeletonAtTime(a, (i / 120) * total);
      const shapes = shapesFor(a, s);
      assert.equal(shapes.length, count, 'shape count changes between frames');
      const pts = [s.head, ...s.farArm, ...s.nearArm, ...s.farLeg, ...s.nearLeg];
      for (const [x, y] of pts) {
        assert.ok(Number.isFinite(x) && Number.isFinite(y), 'NaN in skeleton');
        assert.ok(x >= -2 && x <= 202 && y >= -2, `off canvas at (${x.toFixed(1)}, ${y.toFixed(1)})`);
      }
      for (const [, y] of [s.farLeg[2], s.nearLeg[2], s.farLeg[1], s.nearLeg[1], s.farArm[2], s.nearArm[2]]) {
        assert.ok(y <= GROUND + 1.5, `limb below floor (y=${y.toFixed(1)})`);
      }
      assert.ok(s.head[1] + HEAD_R <= GROUND + 2, `head below floor (y=${s.head[1].toFixed(1)})`);
    }
  });
}

console.log(failures ? `\n${failures} check(s) failed` : `\nall checks passed (${ANIMATIONS.length} animations)`);
process.exit(failures ? 1 : 0);
