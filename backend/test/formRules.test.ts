import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FormCoach, familyFor, type CoachEvent, type Landmark } from '../src/coach/formRules.ts';
import { ANIMATIONS, framesFor, landmarksFrom } from './helpers/poseFromAnimation.ts';
import { skeletonAt, cycleMs, type ExerciseAnimation } from '../../apps/FireFitTV/src/lib/exerciseAnimations.ts';

const anim = (key: string) => ANIMATIONS.find((a) => a.key === key)!;

function run(key: string, frames: [number, Landmark[] | null][], label = key) {
  const coach = new FormCoach(label, key);
  const events: (CoachEvent & { t: number })[] = [];
  for (const [t, l] of frames) for (const e of coach.update(l, t)) events.push({ ...e, t });
  const cues = events.filter((e): e is Extract<CoachEvent, { type: 'cue' }> & { t: number } => e.type === 'cue');
  return { coach, events, cues, summary: coach.summary() };
}

/** Oscillate between two poses of an animation (u from 0 to `depth`) to fake partial-range reps. */
function partial(a: ExerciseAnimation, depth: number, reps = 4, msPerRep = 1600, tweak?: (l: Landmark[]) => void) {
  const out: [number, Landmark[]][] = [];
  const [p0, p1] = [a.frames[0].p, a.frames[1].p];
  for (let t = 0; t <= reps * msPerRep; t += 33) {
    const u = depth * (0.5 - 0.5 * Math.cos((2 * Math.PI * t) / msPerRep));
    const l = landmarksFrom(skeletonAt(p0, p1, u));
    tweak?.(l);
    out.push([t, l]);
  }
  return out;
}

// ---------- good form on our own demos ----------

const REPS_PER_CYCLE: Record<string, number> = {
  squat: 1, thruster: 1, bandSquatPress: 1, lunge: 2, pushup: 1, bridge: 1, jacks: 1, highKnees: 2,
  march: 2, climbers: 2, curl: 1, press: 1, deadlift: 1, kbSwing: 1, row: 1, pullApart: 1,
  burpee: 1, skater: 2, crunch: 1, armCircles: 4, boxing: 2, dbHalo: 1, kbHalo: 1,
};

for (const [key, perCycle] of Object.entries(REPS_PER_CYCLE)) {
  test(`${key}: counts every rep of the demo and calls it good form`, () => {
    const { summary, cues } = run(key, framesFor(anim(key), 4));
    assert.equal(summary.reps, 4 * perCycle, `reps for ${key}`);
    assert.equal(summary.goodReps, summary.reps, `good reps for ${key}`);
    assert.ok(cues.every((c) => c.kind !== 'fix'), `unexpected fix cue: ${cues.map((c) => c.text).join(' | ')}`);
  });
}

test('every animation key maps to a rule family', () => {
  for (const a of ANIMATIONS) assert.ok(familyFor(a.key), a.key);
});

test('holds (plank, deep squat, stretches) accumulate time and get praise', () => {
  const plank = run('plank', framesFor(anim('plank'), 5));
  assert.ok(plank.summary.holdSec >= 14, `plank hold ${plank.summary.holdSec}`);
  assert.ok(plank.cues.some((c) => c.kind === 'good' && /plank/i.test(c.text)));
  const fold = run('forwardFold', framesFor(anim('forwardFold'), 4));
  assert.ok(fold.cues.some((c) => /breath/i.test(c.text)));
});

// ---------- bad form gets the right correction ----------

test('shallow squats: reps still count, coach says go deeper', () => {
  const { summary, cues } = run('squat', partial(anim('squat'), 0.55));
  assert.ok(summary.reps >= 3, `reps ${summary.reps}`);
  assert.equal(summary.goodReps, 0);
  assert.ok(cues.some((c) => c.kind === 'fix' && /deeper/.test(c.text)), cues.map((c) => c.text).join(' | '));
  assert.ok(summary.cues['Sit a little deeper. Aim for thighs parallel to the floor.'] >= 1);
});

test('push-ups with sagging hips: coach says tighten your core', () => {
  const sag = (l: Landmark[]) => {
    l[23].y += 0.07;
    l[24].y += 0.07;
  };
  const frames = framesFor(anim('pushup'), 4).map(([t, l]) => (sag(l), [t, l] as [number, Landmark[]]));
  const { cues, summary } = run('pushup', frames);
  assert.ok(summary.reps >= 3);
  assert.ok(cues.some((c) => /hips sag/.test(c.text)), cues.map((c) => c.text).join(' | '));
});

test('push-ups while standing: coach asks for a push-up position', () => {
  const { cues, summary } = run('pushup', framesFor(anim('march'), 3));
  assert.equal(summary.reps, 0);
  assert.ok(cues.some((c) => /push-up position/.test(c.text)));
});

test('plank with hips sagging: coach says lift your hips', () => {
  const frames = framesFor(anim('plank'), 3).map(([t, l]) => {
    l[23].y += 0.05;
    l[24].y += 0.05;
    return [t, l] as [number, Landmark[]];
  });
  assert.ok(run('plank', frames).cues.some((c) => /Lift your hips/.test(c.text)));
});

test('jumping jacks without the arms: coach says reach overhead', () => {
  const frames = framesFor(anim('jacks'), 4).map(([t, l]) => {
    l[15].y = l[16].y = l[11].y + 0.25;
    return [t, l] as [number, Landmark[]];
  });
  const { cues, summary } = run('jacks', frames);
  assert.equal(summary.reps, 4);
  assert.equal(summary.goodReps, 0);
  assert.ok(cues.some((c) => /overhead/.test(c.text)));
});

test('squatting during a deadlift: coach says hinge, not squat', () => {
  const { cues } = run('deadlift', framesFor(anim('squat'), 4));
  assert.ok(cues.some((c) => /hinge, not a squat/.test(c.text)), cues.map((c) => c.text).join(' | '));
});

test('rows while standing upright: coach says hinge forward', () => {
  assert.ok(run('row', framesFor(anim('curl'), 3)).cues.some((c) => /Hinge forward/.test(c.text)));
});

test('high knees that stay low: coach says drive your knees up', () => {
  const { cues, summary } = run('highKnees', framesFor(anim('march'), 3));
  assert.ok(summary.reps >= 4);
  assert.ok(cues.some((c) => /hip height/.test(c.text)));
});

// ---------- camera framing ----------

test('nobody in frame: coach asks you to step in after 2 s', () => {
  const frames: [number, null][] = Array.from({ length: 100 }, (_, i) => [i * 33, null]);
  const { cues } = run('squat', frames);
  assert.equal(cues.length, 1);
  assert.match(cues[0].text, /can't see you/);
  assert.ok(cues[0].t >= 2000);
});

test('legs out of frame: coach asks you to step back', () => {
  const frames = framesFor(anim('squat'), 2).map(([t, l]) => {
    for (const i of [25, 26, 27, 28]) l[i].visibility = 0.1;
    return [t, l] as [number, Landmark[]];
  });
  const { cues, summary } = run('squat', frames);
  assert.equal(summary.reps, 0);
  assert.ok(cues.some((c) => /Step back/.test(c.text)));
});

test('standing still during a cardio move: coach says keep moving', () => {
  const still = landmarksFrom(skeletonAt(anim('boxing').frames[0].p, anim('boxing').frames[0].p, 0));
  const frames: [number, Landmark[]][] = Array.from({ length: 240 }, (_, i) => [i * 33, still]);
  assert.ok(run('boxing', frames).cues.some((c) => /Keep moving/.test(c.text)));
});

// ---------- pacing ----------

test('cues are rate-limited: ≥3 s apart, same cue ≥8 s apart', () => {
  const { cues } = run('squat', partial(anim('squat'), 0.55, 20, 900));
  assert.ok(cues.length >= 2);
  for (let i = 1; i < cues.length; i++) assert.ok(cues[i].t - cues[i - 1].t >= 3000, 'gap between cues');
  const byText = new Map<string, number>();
  for (const c of cues) {
    const prev = byText.get(c.text);
    if (prev != null) assert.ok(c.t - prev >= 8000, `"${c.text}" repeated too soon`);
    byText.set(c.text, c.t);
  }
});

test('demo animations run long enough for these tests', () => {
  for (const k of Object.keys(REPS_PER_CYCLE)) assert.ok(cycleMs(anim(k)) >= 400);
});

// ---------- real-camera robustness ----------

/** The same movement seen from the front: 2D image landmarks barely show knee bend, but 3D world landmarks do. */
function frontView(key: string, cycles = 4) {
  const lateral = (i: number) => ([11, 13, 15, 23, 25, 27].includes(i) ? -0.09 : [12, 14, 16, 24, 26, 28].includes(i) ? 0.09 : 0);
  return framesFor(anim(key), cycles).map(([t, lm]) => {
    const hipX = (lm[23].x + lm[24].x) / 2;
    // World: forward motion (side-view x) becomes depth toward the camera (z negative).
    const world = lm.map((p, i) => ({ x: lateral(i), y: p.y - 0.6, z: -(p.x - hipX), visibility: 0.95 }));
    // Image from the front: lateral spread on x, no depth.
    const image = lm.map((p, i) => ({ x: 0.5 + lateral(i), y: p.y, z: 0, visibility: 0.95 }));
    return [t, image, world] as [number, Landmark[], Landmark[]];
  });
}

test('facing the camera: squats count from 3D world landmarks', () => {
  const frames = frontView('squat', 4);
  const coach = new FormCoach('Bodyweight Squats', 'squat');
  for (const [t, image, world] of frames) coach.update(image, t, world);
  assert.equal(coach.summary().reps, 4);
  const flat = new FormCoach('Bodyweight Squats', 'squat');
  for (const [t, image] of frames) flat.update(image, t);
  assert.ok(flat.summary().reps < 4, 'without 3D, a front-on squat is hard to see (this is what the world landmarks fix)');
});

test('portrait camera: aspect correction keeps angles true', () => {
  const aspect = 0.75; // 720×960 portrait
  const frames = framesFor(anim('squat'), 4).map(([t, l]) => [t, l.map((p) => ({ ...p, x: 0.5 + (p.x - 0.5) / aspect }))] as [number, Landmark[]]);
  const coach = new FormCoach('Bodyweight Squats', 'squat', { aspect });
  for (const [t, l] of frames) coach.update(l, t);
  assert.equal(coach.summary().reps, 4);
  assert.equal(coach.summary().goodReps, 4);
});

test('visibility flicker between left and right sides does not fake reps', () => {
  const frames = framesFor(anim('squat'), 4).map(([t, l], i) => {
    const c = l.map((p) => ({ ...p }));
    // Far side drawn a little off (as real far-side estimates are) and its visibility flickers above the near side.
    for (const j of [11, 13, 15, 23, 25, 27]) {
      c[j].x += 0.03 * Math.sin(i * 1.7);
      c[j].visibility = i % 2 ? 0.995 : 0.7;
    }
    return [t, c] as [number, Landmark[]];
  });
  assert.equal(run('squat', frames).summary.reps, 4);
});

test('LandmarkFilter: jitter while standing still never becomes a rep', async () => {
  const { LandmarkFilter } = await import('../src/coach/formRules.ts');
  const filter = new LandmarkFilter();
  const stand = framesFor(anim('squat'), 1)[0][1];
  let seed = 7;
  const noise = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280 - 0.5) * 0.06;
  const coach = new FormCoach('Bodyweight Squats', 'squat');
  for (let t = 0; t < 10000; t += 33) {
    const noisy = stand.map((p) => ({ ...p, x: p.x + noise(), y: p.y + noise() }));
    coach.update(filter.apply(noisy, t), t);
  }
  assert.equal(coach.summary().reps, 0);
});

test('fast jumping jacks at 30 fps all count', () => {
  const a = anim('jacks');
  const speedUp = 1.6;
  const frames = framesFor(a, 6).map(([t, l]) => [t / speedUp, l] as [number, Landmark[]]);
  assert.equal(run('jacks', frames).summary.reps, 6);
});

test('TV and phone agree on which moves count reps; unknown moves are never counted as marching', async () => {
  const { COUNTS_REPS } = await import('../src/coach/formRules.ts');
  const { countsReps, coachKeyFor } = await import('../../apps/FireFitTV/src/lib/exerciseAnimations.ts');
  for (const a of ANIMATIONS) assert.equal(countsReps(a.key), COUNTS_REPS(familyFor(a.key)), a.key);
  assert.equal(coachKeyFor('Bear Crawl'), 'other');
  assert.equal(coachKeyFor('Inchworm Walkout'), 'other');
  assert.equal(familyFor('other'), 'active');
  assert.equal(coachKeyFor('Goblet Squat'), 'squat');
});
