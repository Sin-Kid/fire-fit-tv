import { FormCoach, LandmarkFilter } from '../src/coach/formRules.ts';
import { ANIMATIONS, framesFor } from '../test/helpers/poseFromAnimation.ts';
const keys = ['squat', 'pushup', 'jacks', 'lunge', 'highKnees'];
const pre = Object.fromEntries(keys.map((k) => [k, framesFor(ANIMATIONS.find((x: any) => x.key === k)!, 6)]));
let n = 0; const t0 = performance.now();
for (let rep = 0; rep < 40; rep++) for (const k of keys) {
  const a = ANIMATIONS.find((x: any) => x.key === k)!;
  const c = new FormCoach('p', k, { aspect: 1 }); const f = new LandmarkFilter();
  void a; for (const [t, l] of pre[k]) { c.update(f.apply(l, t), t); n++; }
}
const ms = performance.now() - t0;
console.log(n, 'frames', (ms / n * 1000).toFixed(1), 'us/frame');
