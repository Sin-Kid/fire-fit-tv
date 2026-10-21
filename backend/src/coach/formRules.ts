// Form coach: turns MediaPipe Pose Landmarker output (33 landmarks per frame)
// into rep counts and short spoken/captioned cues.
//
// Pure TypeScript with no dependencies. It runs in the phone's browser (bundled
// to public/form-rules.js) and in the Node tests.
//
// Input per frame:
//  - image landmarks: MediaPipe's normalized coordinates (x/y in 0..1 of the frame's
//    width/height, y down) with visibility. Used for "are you in view?" checks.
//  - world landmarks (optional, recommended): MediaPipe's 3D estimate in metres,
//    centred on the hips, same axes (y down). Joint angles are measured in 3D, so a
//    squat counts whether you face the phone or stand side-on.
//  Without world landmarks, image x is scaled by the frame's aspect ratio so angles
//  aren't skewed by a non-square camera.

export interface Landmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export type CueKind = 'good' | 'fix' | 'info';
export type CoachEvent =
  | { type: 'rep'; reps: number; good: boolean }
  | { type: 'cue'; text: string; kind: CueKind };

export interface CoachSummary {
  exercise: string;
  family: Family;
  reps: number;
  goodReps: number;
  holdSec: number;
  /** How often each correction was given. */
  cues: Record<string, number>;
}

// MediaPipe BlazePose indices
const NOSE = 0;
const SIDE = {
  left: { shoulder: 11, elbow: 13, wrist: 15, hip: 23, knee: 25, ankle: 27 },
  right: { shoulder: 12, elbow: 14, wrist: 16, hip: 24, knee: 26, ankle: 28 },
};

export type Family =
  | 'squat' | 'deepSquat' | 'lunge' | 'pushup' | 'plank' | 'climbers' | 'bridge'
  | 'jacks' | 'highKnees' | 'march' | 'curl' | 'press' | 'hinge' | 'row' | 'pullApart'
  | 'burpee' | 'skater' | 'crunch' | 'circles' | 'boxing' | 'halo'
  | 'active' | 'stretch';

/** Exercise animation key (see the TV app's exerciseAnimations.ts) → rule family. */
const FAMILY: Record<string, Family> = {
  squat: 'squat', thruster: 'squat', bandSquatPress: 'squat',
  deepSquat: 'deepSquat',
  lunge: 'lunge',
  pushup: 'pushup',
  plank: 'plank',
  climbers: 'climbers',
  bridge: 'bridge',
  jacks: 'jacks',
  highKnees: 'highKnees',
  march: 'march',
  curl: 'curl',
  press: 'press',
  deadlift: 'hinge', kbSwing: 'hinge',
  row: 'row',
  pullApart: 'pullApart',
  boxing: 'boxing', skater: 'skater', burpee: 'burpee', crunch: 'crunch',
  dbHalo: 'halo', kbHalo: 'halo', armCircles: 'circles',
  wgs: 'stretch', catCow: 'stretch', thoracic: 'stretch', quadStretch: 'stretch',
  forwardFold: 'stretch', breathing: 'stretch', hipOpeners: 'stretch',
};

export const familyFor = (key: string): Family => FAMILY[key] ?? 'active';

/** Families that count reps (the rest are timed holds or free movement). */
export const COUNTS_REPS = (f: Family) => !['plank', 'deepSquat', 'stretch', 'active'].includes(f);

// Joints each family needs to see clearly.
const NEEDS: Record<Family, ('shoulder' | 'elbow' | 'wrist' | 'hip' | 'knee' | 'ankle')[]> = {
  squat: ['shoulder', 'hip', 'knee', 'ankle'], deepSquat: ['hip', 'knee', 'ankle'], lunge: ['shoulder', 'hip', 'knee', 'ankle'],
  pushup: ['shoulder', 'elbow', 'wrist', 'hip', 'ankle'], plank: ['shoulder', 'hip', 'ankle'], climbers: ['shoulder', 'hip', 'knee'],
  bridge: ['shoulder', 'hip', 'knee'], jacks: ['shoulder', 'wrist', 'ankle'], highKnees: ['shoulder', 'hip', 'knee'],
  march: ['shoulder', 'hip', 'knee'], curl: ['shoulder', 'elbow', 'wrist'], press: ['shoulder', 'elbow', 'wrist'],
  hinge: ['shoulder', 'hip', 'knee'], row: ['shoulder', 'elbow', 'wrist', 'hip'], pullApart: ['shoulder', 'wrist'],
  burpee: ['shoulder', 'hip', 'ankle'], skater: ['shoulder', 'hip'], crunch: ['shoulder', 'hip', 'knee'],
  circles: ['shoulder', 'wrist'], boxing: ['shoulder', 'elbow', 'wrist'], halo: ['shoulder', 'wrist'],
  active: ['shoulder', 'hip'], stretch: ['shoulder', 'hip'],
};

const PRAISE = ['Good rep!', 'Nice form!', 'Strong. Keep it up!', 'That’s the one!', 'Looking solid!'];

// ---------- geometry (2D or 3D) ----------

type P = { x: number; y: number; z?: number };
const deg = (r: number) => (r * 180) / Math.PI;
const sub = (a: P, b: P) => ({ x: a.x - b.x, y: a.y - b.y, z: (a.z ?? 0) - (b.z ?? 0) });
const norm = (v: { x: number; y: number; z: number }) => Math.hypot(v.x, v.y, v.z);
/** Angle ABC in degrees (at B). */
export function angle(a: P, b: P, c: P): number {
  const v1 = sub(a, b);
  const v2 = sub(c, b);
  const m = norm(v1) * norm(v2) || 1e-9;
  return deg(Math.acos(Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y + v1.z * v2.z) / m))));
}
/** Angle of the segment from→to away from straight up, in degrees (0 = upright). y grows downward. */
const fromVertical = (from: P, to: P) => {
  const v = sub(to, from);
  return deg(Math.acos(Math.max(-1, Math.min(1, -v.y / (norm(v) || 1e-9)))));
};
const dist = (a: P, b: P) => norm(sub(a, b));

/**
 * One Euro filter for landmarks (Casiez et al., 2012): smooths jitter when you're
 * still but follows quick movement without lag. Call once per frame.
 */
export class LandmarkFilter {
  private prev: { x: number; y: number; z: number }[] | null = null;
  private dprev: { x: number; y: number; z: number }[] | null = null;
  private lastT: number | null = null;
  constructor(private minCutoff = 1.2, private beta = 0.5, private dCutoff = 1.0) {}
  reset() {
    this.prev = this.dprev = null;
    this.lastT = null;
  }
  apply<T extends P>(lms: T[] | null | undefined, t: number): T[] | null {
    if (!lms) {
      this.reset();
      return null;
    }
    const dt = this.lastT == null ? 0 : Math.max(1e-3, (t - this.lastT) / 1000);
    this.lastT = t;
    const alpha = (cutoff: number) => (dt ? 1 / (1 + 1 / (2 * Math.PI * cutoff * dt)) : 1);
    const out = lms.map((p, i) => {
      const cur = { x: p.x, y: p.y, z: p.z ?? 0 };
      const pr = this.prev?.[i];
      if (!pr || !dt) return { p, cur, d: { x: 0, y: 0, z: 0 } };
      const dp = this.dprev?.[i] ?? { x: 0, y: 0, z: 0 };
      const ad = alpha(this.dCutoff);
      const d = { x: 0, y: 0, z: 0 };
      const f = { x: 0, y: 0, z: 0 };
      for (const k of ['x', 'y', 'z'] as const) {
        d[k] = dp[k] + ad * ((cur[k] - pr[k]) / dt - dp[k]);
        const a = alpha(this.minCutoff + this.beta * Math.abs(d[k]));
        f[k] = pr[k] + a * (cur[k] - pr[k]);
      }
      return { p, cur: f, d };
    });
    this.prev = out.map((o) => o.cur);
    this.dprev = out.map((o) => o.d);
    return out.map(({ p, cur }) => ({ ...p, x: cur.x, y: cur.y, z: p.z == null ? p.z : cur.z }));
  }
}

/**
 * Hysteresis rep counter: a rep is "metric went past `low`, then came back past `high`".
 * Very short excursions (a glitchy frame or two) don't count.
 */
class RepCounter {
  private armed = false;
  private since = 0;
  extreme = NaN;
  constructor(private low: number, private high: number, private dir: 'down' | 'up' = 'down', private minMs = 180) {}
  /** Returns the most extreme value of the finished rep, or null. */
  feed(v: number, t = 0): number | null {
    const reached = this.dir === 'down' ? v < this.low : v > this.low;
    const back = this.dir === 'down' ? v > this.high : v < this.high;
    if (!this.armed && reached) {
      this.armed = true;
      this.since = t;
      this.extreme = v;
    } else if (this.armed) {
      this.extreme = this.dir === 'down' ? Math.min(this.extreme, v) : Math.max(this.extreme, v);
      if (back) {
        this.armed = false;
        return t - this.since >= this.minMs ? this.extreme : null;
      }
    }
    return null;
  }
  get inRep() {
    return this.armed;
  }
}

// ---------- the coach ----------

export interface CoachOptions {
  /** Minimum ms between any two cues. */
  cueGapMs?: number;
  /** Minimum ms before the same cue is repeated. */
  repeatGapMs?: number;
  /** Camera frame width ÷ height, used when no world landmarks are given. */
  aspect?: number;
}

export class FormCoach {
  readonly family: Family;
  private reps = 0;
  private goodReps = 0;
  private holdMs = 0;
  private cueCount: Record<string, number> = {};
  private lastCueAt = -Infinity;
  private lastByText: Record<string, number> = {};
  private lastT: number | null = null;
  private lostSince: number | null = null;
  private hiddenSince: number | null = null;
  private badSince: number | null = null;
  private lastGoodHoldCue: number | null = null;
  private stillSince: number | null = null;
  private prevPts: P[] | null = null;
  private smooth: Record<string, number> = {};
  private counters: Record<string, RepCounter> = {};
  private track: Record<string, number> = {};
  private stage: 'closed' | 'open' = 'closed';
  /** Unwrapped rotation (degrees) for circling moves, and its direction. */
  private spin = { last: NaN, total: 0, dir: 0 };
  private lastRepAt: number | null = null;
  private firstT: number | null = null;
  private cueGap: number;
  private repeatGap: number;
  private aspect: number;
  /** The side of the body we measure; only switches when the other side is clearly better for a while. */
  private side: 'left' | 'right' | null = null;
  private betterSince: number | null = null;

  constructor(readonly exercise: string, readonly key: string, opts: CoachOptions = {}) {
    this.family = familyFor(key);
    this.cueGap = opts.cueGapMs ?? 3000;
    this.repeatGap = opts.repeatGapMs ?? 8000;
    this.aspect = opts.aspect ?? 1;
  }

  summary(): CoachSummary {
    return {
      exercise: this.exercise, family: this.family, reps: this.reps, goodReps: this.goodReps,
      holdSec: Math.round(this.holdMs / 1000), cues: { ...this.cueCount },
    };
  }

  /**
   * Feed one frame. `lms` (image landmarks) is null when no person was detected. `t` in ms.
   * `world` is MediaPipe's 3D world landmarks for the same frame, when available.
   */
  update(lms: Landmark[] | null | undefined, t: number, world?: Landmark[] | null): CoachEvent[] {
    const out: CoachEvent[] = [];
    const dt = this.lastT == null ? 0 : Math.min(500, t - this.lastT);
    this.firstT ??= t;
    this.lastT = t;

    const cue = (text: string, kind: CueKind, count = kind === 'fix') => {
      if (t - this.lastCueAt < this.cueGap) return;
      if (t - (this.lastByText[text] ?? -Infinity) < this.repeatGap) return;
      this.lastCueAt = t;
      this.lastByText[text] = t;
      if (count) this.cueCount[text] = (this.cueCount[text] ?? 0) + 1;
      out.push({ type: 'cue', text, kind });
    };

    if (!lms || lms.length < 29) {
      this.lostSince ??= t;
      if (t - this.lostSince > 2000) cue("I can't see you. Step into the camera's view.", 'info');
      return out;
    }
    this.lostSince = null;

    const vis = (i: number) => lms[i].visibility ?? 1;
    const sideScore = (sd: typeof SIDE.left) => Object.values(sd).reduce((a, i) => a + vis(i), 0);
    // Sticky side choice: flipping sides between frames makes angles jump and fakes reps.
    const best = sideScore(SIDE.left) >= sideScore(SIDE.right) ? 'left' : 'right';
    if (this.side == null) this.side = best;
    else if (best !== this.side && sideScore(SIDE[best]) > sideScore(SIDE[this.side]) + 0.6) {
      this.betterSince ??= t;
      if (t - this.betterSince > 500) {
        this.side = best;
        this.betterSince = null;
      }
    } else this.betterSince = null;
    const s = SIDE[this.side];
    const o = this.side === 'left' ? SIDE.right : SIDE.left;
    // Geometry in 3D metres when world landmarks are available, else aspect-corrected image space.
    const useWorld = !!world && world.length >= 29;
    const L = (i: number): P => (useWorld ? world![i] : { x: lms[i].x * this.aspect, y: lms[i].y, z: 0 });

    // Is the body part this exercise needs in view?
    const hidden = NEEDS[this.family].some((j) => vis(s[j]) < 0.5);
    if (hidden) {
      this.hiddenSince ??= t;
      if (t - this.hiddenSince > 1500) cue('Step back so I can see your whole body.', 'info');
      return out;
    }
    this.hiddenSince = null;

    const ema = (k: string, v: number, a = 0.5) => (this.smooth[k] = this.smooth[k] == null ? v : this.smooth[k] + a * (v - this.smooth[k]));
    const counters = this.counters;
    const counter = (k: string, low: number, high: number, dir: 'down' | 'up' = 'down', minMs = 180) => {
      const c = (counters[k] ??= new RepCounter(low, high, dir, minMs));
      return { inRep: c.inRep, feed: (v: number) => c.feed(v, t) };
    };
    const rep = (good: boolean, fix?: string) => {
      this.lastRepAt = t;
      this.reps++;
      if (good) this.goodReps++;
      out.push({ type: 'rep', reps: this.reps, good });
      if (!good && fix) cue(fix, 'fix');
      else if (good && this.reps % 3 === 0) cue(PRAISE[(this.reps / 3) % PRAISE.length], 'good');
    };
    const maxTrack = (k: string, v: number) => (this.track[k] = Math.max(this.track[k] ?? -Infinity, v));
    const minTrack = (k: string, v: number) => (this.track[k] = Math.min(this.track[k] ?? Infinity, v));
    const takeTrack = (k: string) => {
      const v = this.track[k];
      delete this.track[k];
      return v;
    };
    const sustained = (bad: boolean, ms: number) => {
      if (!bad) {
        this.badSince = null;
        return false;
      }
      this.badSince ??= t;
      return t - this.badSince > ms;
    };
    const holdPraise = (text: string, every = 10000) => {
      this.lastGoodHoldCue ??= t;
      if (t - this.lastGoodHoldCue > every) {
        this.lastGoodHoldCue = t;
        cue(text, 'good');
      }
    };

    const knee = (side: typeof s) => angle(L(side.hip), L(side.knee), L(side.ankle));
    const elbow = (side: typeof s) => angle(L(side.shoulder), L(side.elbow), L(side.wrist));
    const lean = fromVertical(L(s.hip), L(s.shoulder));
    const bodyLine = angle(L(s.shoulder), L(s.hip), L(s.ankle));
    const hipBelowLine = () => {
      const a = L(s.shoulder);
      const b = L(s.ankle);
      const h = L(s.hip);
      const yOnLine = a.y + ((h.x - a.x) / ((b.x - a.x) || 1e-9)) * (b.y - a.y);
      return h.y > yOnLine;
    };
    const torso = dist(L(s.shoulder), L(s.hip)) || 1e-3;

    switch (this.family) {
      case 'squat': {
        const k = ema('knee', vis(o.knee) > 0.6 ? (knee(s) + knee(o)) / 2 : knee(s));
        const c = counter('squat', 130, 160);
        if (c.inRep) maxTrack('lean', lean);
        const bottom = c.feed(k);
        if (bottom != null) {
          const maxLean = takeTrack('lean') ?? 0;
          if (bottom > 100) rep(false, 'Sit a little deeper. Aim for thighs parallel to the floor.');
          else if (maxLean > 55) rep(false, 'Keep your chest up as you squat.');
          else rep(true);
        }
        break;
      }
      case 'deepSquat': {
        const k = ema('knee', knee(s));
        this.holdMs += dt;
        if (sustained(k > 100, 2000)) cue('Sink a little lower and keep your heels down.', 'fix');
        else if (k <= 100) holdPraise('Nice and deep. Breathe slowly.');
        break;
      }
      case 'lunge': {
        const k = ema('knee', Math.min(knee(s), vis(o.knee) > 0.5 ? knee(o) : 180));
        const c = counter('lunge', 125, 160);
        if (c.inRep) maxTrack('lean', lean);
        const bottom = c.feed(k);
        if (bottom != null) {
          const maxLean = takeTrack('lean') ?? 0;
          if (bottom > 105) rep(false, 'Lower until your back knee nearly touches the floor.');
          else if (maxLean > 30) rep(false, 'Stay tall. Keep your chest up through the lunge.');
          else rep(true);
        }
        break;
      }
      case 'pushup': {
        if (lean < 45) {
          cue('Get down into a push-up position, side-on to the camera.', 'info', false);
          break;
        }
        const e = ema('elbow', elbow(s));
        const c = counter('pushup', 110, 150);
        if (c.inRep) {
          minTrack('line', bodyLine);
          if (bodyLine < 155) this.track.sag = hipBelowLine() ? 1 : 0;
        }
        const bottom = c.feed(e);
        if (bottom != null) {
          const line = takeTrack('line') ?? 180;
          const sag = takeTrack('sag');
          if (line < 155) rep(false, sag ? "Tighten your core. Don't let your hips sag." : 'Lower your hips into one straight line.');
          else if (bottom > 95) rep(false, 'Lower your chest closer to the floor.');
          else rep(true);
        }
        break;
      }
      case 'plank': {
        this.holdMs += dt;
        const line = ema('line', bodyLine);
        if (sustained(line < 162, 1200)) cue(hipBelowLine() ? 'Lift your hips a little. Keep a straight line.' : 'Drop your hips a touch, in line with your shoulders.', 'fix');
        else if (line >= 162) holdPraise('Strong plank. Keep breathing.');
        break;
      }
      case 'climbers': {
        for (const [name, side] of [['a', s], ['b', o]] as const) {
          if (vis(side.knee) < 0.5) continue;
          const h = ema(`hip${name}`, angle(L(side.shoulder), L(side.hip), L(side.knee)));
          const c = counter(`climb${name}`, 110, 140);
          if (c.feed(h) != null) rep(true);
        }
        if (sustained(bodyLine < 145 && !hipBelowLine(), 1500)) cue('Keep your hips low, level with your shoulders.', 'fix');
        break;
      }
      case 'bridge': {
        const h = ema('hip', angle(L(s.shoulder), L(s.hip), L(s.knee)));
        const top = counter('bridge', 160, 150, 'up').feed(h);
        if (top != null) {
          if (top < 168) rep(false, 'Push your hips higher and squeeze your glutes at the top.');
          else rep(true);
        }
        break;
      }
      case 'jacks': {
        // Feet apart relative to torso length works from the front and at an angle.
        const feetW = dist(L(27), L(28)) / torso;
        const handsUp = Math.min(L(15).y, L(16).y) < L(NOSE).y;
        if (this.stage === 'closed' && feetW > 0.85) {
          this.stage = 'open';
          this.track.armsUp = handsUp ? 1 : 0;
        } else if (this.stage === 'open') {
          if (handsUp) this.track.armsUp = 1;
          if (feetW < 0.6) {
            this.stage = 'closed';
            const up = takeTrack('armsUp');
            if (up) rep(true);
            else rep(false, 'Reach your arms all the way overhead.');
          }
        }
        break;
      }
      case 'highKnees':
      case 'march': {
        const need = this.family === 'highKnees' ? -0.15 : -0.45;
        for (const [name, side] of [['a', s], ['b', o]] as const) {
          if (vis(side.knee) < 0.5) continue;
          const lift = ema(`lift${name}`, (L(side.hip).y - L(side.knee).y) / torso, 0.6);
          const c = counter(`knee${name}`, -0.5, -0.62, 'up');
          if (c.inRep) maxTrack(`peak${name}`, lift);
          if (c.feed(lift) != null) {
            const peak = takeTrack(`peak${name}`) ?? lift;
            if (peak < need) rep(false, this.family === 'highKnees' ? 'Drive your knees up to hip height.' : 'Lift your knees a little higher.');
            else rep(true);
          }
        }
        break;
      }
      case 'curl': {
        const e = ema('elbow', elbow(s));
        const c = counter('curl', 75, 145);
        if (c.inRep) maxTrack('swing', fromVertical(L(s.elbow), L(s.shoulder)));
        const top = c.feed(e);
        if (top != null) {
          const swing = takeTrack('swing') ?? 0;
          if (swing > 35) rep(false, 'Keep your elbows pinned to your sides.');
          else if (top > 60) rep(false, 'Curl all the way up to your shoulders.');
          else rep(true);
        }
        break;
      }
      case 'press': {
        const e = ema('elbow', elbow(s));
        const overhead = L(s.wrist).y < L(NOSE).y;
        const c = counter('press', 140, 105, 'up');
        if (c.inRep && overhead) maxTrack('top', e);
        const top = c.feed(overhead ? e : Math.min(e, 139));
        if (top != null) {
          const best = takeTrack('top') ?? top;
          if (best < 160) rep(false, 'Press all the way up until your arms are straight.');
          else rep(true);
        }
        break;
      }
      case 'hinge': {
        const h = ema('hip', angle(L(s.shoulder), L(s.hip), L(s.knee)));
        const c = counter('hinge', 135, 165);
        if (c.inRep) minTrack('knee', knee(s));
        const bottom = c.feed(h);
        if (bottom != null) {
          const k = takeTrack('knee') ?? 180;
          if (k < 120) rep(false, 'Push your hips back. This is a hinge, not a squat.');
          else rep(true);
        }
        break;
      }
      case 'row': {
        if (sustained(lean < 30, 1500)) {
          cue('Hinge forward more, chest toward the floor.', 'fix');
          break;
        }
        const e = ema('elbow', elbow(s));
        const bottom = counter('row', 110, 150).feed(e);
        if (bottom != null) {
          if (bottom > 95) rep(false, 'Pull your elbow back past your ribs.');
          else rep(true);
        }
        break;
      }
      case 'pullApart': {
        const w = dist(L(15), L(16)) / torso;
        const open = counter('pull', 1.2, 0.84, 'up').feed(ema('w', w));
        if (open != null) {
          if (open < 1.44) rep(false, 'Pull the band wider, all the way to your chest.');
          else rep(true);
        }
        break;
      }
      case 'burpee': {
        // Hips drop to the floor (plank/squat) and come back up to standing (or a jump).
        const height = ema('hipH', (L(s.ankle).y - L(s.hip).y) / torso, 0.6);
        const bottom = counter('burpee', 0.9, 1.2).feed(height);
        if (bottom != null) rep(true);
        break;
      }
      case 'skater': {
        // Side to side: one rep per landing on each side. Uses the image, since the
        // 3D estimate is centred on the hips and doesn't see them travel.
        const hipX = ((lms[s.hip].x + lms[o.hip].x) / 2) * this.aspect;
        const imgTorso = Math.hypot((lms[s.shoulder].x - lms[s.hip].x) * this.aspect, lms[s.shoulder].y - lms[s.hip].y) || 0.1;
        // Centre of the side-to-side range (the extremes slowly forget, so stepping around the room is fine).
        const lo = (this.track.skLo = Math.min(hipX, (this.track.skLo ?? hipX) + 0.002));
        const hi = (this.track.skHi = Math.max(hipX, (this.track.skHi ?? hipX) - 0.002));
        const off = ema('skOff', (hipX - (lo + hi) / 2) / imgTorso, 0.6);
        if (this.stage !== 'open' && off > 0.3) {
          this.stage = 'open';
          rep(true);
        } else if (this.stage !== 'closed' && off < -0.3) {
          this.stage = 'closed';
          rep(true);
        }
        break;
      }
      case 'crunch': {
        const h = ema('hip', angle(L(s.shoulder), L(s.hip), L(s.knee)));
        const top = counter('crunch', 122, 136).feed(h);
        if (top != null) rep(true);
        break;
      }
      case 'circles':
      case 'halo': {
        // Count full turns of the hands: around the shoulder (arm circles) or around the head (halos).
        const centre = this.family === 'circles' ? L(s.shoulder) : L(NOSE);
        const hand = this.family === 'circles' ? L(s.wrist) : { x: (L(15).x + L(16).x) / 2, y: (L(15).y + L(16).y) / 2, z: ((L(15).z ?? 0) + (L(16).z ?? 0)) / 2 };
        // Arm circles turn in the body's forward plane: x when side-on, depth (z) when facing the camera.
        const fwd = (hand.x - centre.x) - ((hand.z ?? 0) - (centre.z ?? 0));
        const a = deg(Math.atan2(fwd, centre.y - hand.y));
        const sp = this.spin;
        if (!Number.isNaN(sp.last)) {
          let d = a - sp.last;
          if (d > 180) d -= 360;
          if (d < -180) d += 360;
          const dir = Math.sign(d);
          if (Math.abs(d) > 3 && dir !== sp.dir) {
            if (sp.dir && Math.abs(sp.total) > 60) sp.total = 0; // changed direction: start counting afresh
            sp.dir = dir;
          }
          sp.total += d;
          if (Math.abs(sp.total) >= 330) {
            sp.total -= Math.sign(sp.total) * 360;
            rep(true);
          }
        }
        sp.last = a;
        break;
      }
      case 'boxing': {
        // A punch: the arm straightens out from a guard and comes back. Either arm.
        for (const [name, side] of [['a', s], ['b', o]] as const) {
          if (vis(side.wrist) < 0.4) continue;
          const reach = ema(`reach${name}`, dist(L(side.shoulder), L(side.wrist)) / (dist(L(side.shoulder), L(side.elbow)) + dist(L(side.elbow), L(side.wrist)) || 1), 0.6);
          if (counter(`punch${name}`, 0.75, 0.5, 'up', 60).feed(reach) != null) rep(true);
        }
        break;
      }
    }
    // Cardio moves that count reps: nudge if nothing has happened for a while.
    if (['burpee', 'skater', 'boxing', 'circles', 'halo', 'jacks', 'highKnees'].includes(this.family) && t - (this.lastRepAt ?? this.firstT ?? t) > 6000) {
      cue('Keep moving. Stay light on your feet.', 'info');
    }
    switch (this.family) {
      case 'active':
      case 'stretch': {
        const pts = [L(s.shoulder), L(s.hip), L(s.wrist), L(s.ankle), L(o.wrist), L(o.ankle)];
        const motion = this.prevPts ? pts.reduce((a, p, i) => a + dist(p, this.prevPts![i]), 0) / torso : 0;
        this.prevPts = pts;
        const speed = ema('motion', dt ? (motion * 1000) / dt : 0, 0.2);
        if (this.family === 'stretch') {
          this.holdMs += dt;
          holdPraise('Slow breaths. Ease a little deeper into the stretch.', 15000);
        } else if (speed < 0.25) {
          this.stillSince ??= t;
          if (t - this.stillSince > 5000) cue('Keep moving. Stay light on your feet.', 'info');
        } else {
          this.stillSince = null;
          holdPraise('Great energy. Keep it going!', 20000);
        }
        break;
      }
    }
    return out;
  }
}
