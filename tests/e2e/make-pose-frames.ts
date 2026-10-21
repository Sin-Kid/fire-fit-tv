// Writes pose-frames.json: MediaPipe-style landmark frames generated from the app's
// own exercise demos, used as a fake camera by coach.mjs.
//   npx tsx tests/e2e/make-pose-frames.ts
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ANIMATIONS, skeletonAt, cycleMs, skeletonAtTime } from '../../apps/FireFitTV/src/lib/exerciseAnimations.ts';
import { landmarksFrom } from '../../backend/test/helpers/poseFromAnimation.ts';

const r = (n: number) => Math.round(n * 1000) / 1000;
const pack = (lms: ReturnType<typeof landmarksFrom>) => lms.map((p) => [r(p.x), r(p.y), r(p.visibility ?? 1)]);
const out: Record<string, number[][][]> = {};
for (const a of ANIMATIONS) {
  const T = cycleMs(a);
  out[a.key] = Array.from({ length: Math.round(T / 33) }, (_, i) => pack(landmarksFrom(skeletonAtTime(a, i * 33))));
}
// Shallow squats (only ~55% of the way down) to trigger a form correction.
const sq = ANIMATIONS.find((a) => a.key === 'squat')!;
out.shallowSquat = Array.from({ length: 48 }, (_, i) => {
  const u = 0.55 * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / 48));
  return pack(landmarksFrom(skeletonAt(sq.frames[0].p, sq.frames[1].p, u)));
});
writeFileSync(join(import.meta.dirname, 'pose-frames.json'), JSON.stringify(out));
console.log('wrote', Object.keys(out).length, 'pose sequences');
