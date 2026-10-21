// Turns the TV app's stick-figure demos into MediaPipe-style landmark frames,
// so the form coach can be tested on known-good movement.
import { ANIMATIONS, cycleMs, skeletonAtTime, type ExerciseAnimation, type Skeleton } from '../../../apps/FireFitTV/src/lib/exerciseAnimations.ts';
import type { Landmark } from '../../src/coach/formRules.ts';

export { ANIMATIONS };

/** The near side of the body (facing the camera) is seen more clearly than the far side, as with a real camera. */
export function landmarksFrom(s: Skeleton, vis = 0.99, farVis = 0.8): Landmark[] {
  const p = ([x, y]: [number, number], v = vis): Landmark => ({ x: x / 200, y: y / 200, z: 0, visibility: v });
  const f = (pt: [number, number]) => p(pt, farVis);
  const lms: Landmark[] = Array.from({ length: 33 }, () => p(s.head));
  lms[11] = f(s.farArm[0]); lms[13] = f(s.farArm[1]); lms[15] = f(s.farArm[2]);
  lms[12] = p(s.nearArm[0]); lms[14] = p(s.nearArm[1]); lms[16] = p(s.nearArm[2]);
  lms[23] = f(s.farLeg[0]); lms[25] = f(s.farLeg[1]); lms[27] = f(s.farLeg[2]);
  lms[24] = p(s.nearLeg[0]); lms[26] = p(s.nearLeg[1]); lms[28] = p(s.nearLeg[2]);
  return lms;
}

/** Frames at 30 fps for `cycles` loops of an animation: [tMs, landmarks]. */
export function framesFor(anim: ExerciseAnimation, cycles = 4, fps = 30): [number, Landmark[]][] {
  const total = cycleMs(anim) * cycles;
  const out: [number, Landmark[]][] = [];
  for (let t = 0; t <= total; t += 1000 / fps) out.push([t, landmarksFrom(skeletonAtTime(anim, t))]);
  return out;
}
