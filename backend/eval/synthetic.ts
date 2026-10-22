// Synthetic benchmark for the rep counter (paper Section V-A).
//
// Ground-truth movement comes from Fire-Fit's 32 keyframed exercise animations
// (apps/FireFitTV/src/lib/exerciseAnimations.ts) rendered to MediaPipe-style landmarks,
// then degraded the way real camera input is: landmark noise, occlusion glitches,
// a frontal camera, a portrait camera, left/right visibility flicker. Distractor
// sequences (shaking in place, the wrong posture) have a true count of zero.
//
// Each configuration of the counter is run on every sequence: the full system,
// the full system minus one feature (ablation), and a naive baseline with all
// robustness features off. Metrics follow RepNet (Dwibedi et al., CVPR 2020):
// MAE = mean |pred − true| / true, OBOA = share of sequences within ±1 rep.
//
//   npx tsx eval/synthetic.ts            → eval/results/synthetic.{json,md,tex}
import { mkdirSync, writeFileSync } from 'node:fs';
import { FEATURES, FormCoach, LandmarkFilter, type Feature, type Landmark } from '../src/coach/formRules.ts';
import { ANIMATIONS, cycleMs, skeletonAt, skeletonAtTime } from '../../apps/FireFitTV/src/lib/exerciseAnimations.ts';
import { landmarksFrom } from '../test/helpers/poseFromAnimation.ts';

const FPS = 30;
const CYCLES = 6;
const SEEDS = [1, 2, 3];
// Reps per animation cycle (bilateral moves count each side).
const PER_CYCLE: Record<string, number> = {
  squat: 1, thruster: 1, bandSquatPress: 1, lunge: 2, pushup: 1, bridge: 1, jacks: 1, highKnees: 2, march: 2,
  climbers: 2, curl: 1, press: 1, deadlift: 1, kbSwing: 1, row: 1, pullApart: 1, burpee: 1, skater: 2, crunch: 1,
  armCircles: 4, boxing: 2, dbHalo: 1, kbHalo: 1,
};
const anim = (k: string) => ANIMATIONS.find((a) => a.key === k)!;

type Frame = { t: number; image: Landmark[] | null; world: Landmark[] | null };
type Seq = { key: string; condition: string; truth: number; frames: Frame[]; aspect?: number };

function rng(seed: number) {
  let s = seed * 9301 + 49297;
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
}
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r());
const M_PER_UNIT = 1.8; // landmark units → metres for the synthetic world landmarks

function clean(key: string, cycles = CYCLES): Frame[] {
  const a = anim(key);
  const total = cycleMs(a) * cycles;
  const out: Frame[] = [];
  for (let t = 0; t <= total; t += 1000 / FPS) {
    const image = landmarksFrom(skeletonAtTime(a, t));
    const hip = { x: (image[23].x + image[24].x) / 2, y: (image[23].y + image[24].y) / 2 };
    const world = image.map((p) => ({ x: (p.x - hip.x) * M_PER_UNIT, y: (p.y - hip.y) * M_PER_UNIT, z: 0, visibility: p.visibility }));
    out.push({ t, image, world });
  }
  return out;
}

const CONDITIONS: Record<string, (key: string, seed: number) => Seq> = {
  clean: (key) => ({ key, condition: 'clean', truth: PER_CYCLE[key] * CYCLES, frames: clean(key) }),
  noise: (key, seed) => {
    const r = rng(seed);
    const frames = clean(key).map((f) => {
      const n = f.image!.map(() => ({ x: gauss(r) * 0.012, y: gauss(r) * 0.012 }));
      return {
        t: f.t,
        image: f.image!.map((p, i) => ({ ...p, x: p.x + n[i].x, y: p.y + n[i].y })),
        world: f.world!.map((p, i) => ({ ...p, x: p.x + n[i].x * M_PER_UNIT, y: p.y + n[i].y * M_PER_UNIT, z: (p.z ?? 0) + gauss(r) * 0.02 })),
      };
    });
    return { key, condition: 'noise', truth: PER_CYCLE[key] * CYCLES, frames };
  },
  occlusion: (key, seed) => {
    const r = rng(seed);
    const joints = [13, 14, 15, 16, 25, 26, 27, 28];
    const frames = clean(key).map((f) => {
      if (r() > 0.12) return f; // ~12% of frames have a "guessed" joint
      const j = joints[Math.floor(r() * joints.length)];
      const dx = (r() - 0.5) * 0.4, dy = (r() - 0.5) * 0.4;
      const image = f.image!.map((p, i) => (i === j ? { ...p, x: p.x + dx, y: p.y + dy, visibility: 0.25 } : p));
      const world = f.world!.map((p, i) => (i === j ? { ...p, x: p.x + dx * M_PER_UNIT, y: p.y + dy * M_PER_UNIT, visibility: 0.25 } : p));
      return { t: f.t, image, world };
    });
    return { key, condition: 'occlusion', truth: PER_CYCLE[key] * CYCLES, frames };
  },
  frontal: (key) => {
    const side = new Set([11, 13, 15, 23, 25, 27]);
    const lateral = (i: number) => (side.has(i) ? -0.09 : [12, 14, 16, 24, 26, 28].includes(i) ? 0.09 : 0);
    const frames = clean(key).map((f) => {
      const lm = f.image!;
      const hipX = (lm[23].x + lm[24].x) / 2, hipY = (lm[23].y + lm[24].y) / 2;
      return {
        t: f.t,
        image: lm.map((p, i) => ({ ...p, x: 0.5 + lateral(i), y: p.y })),
        world: lm.map((p, i) => ({ x: lateral(i) * M_PER_UNIT, y: (p.y - hipY) * M_PER_UNIT, z: -(p.x - hipX) * M_PER_UNIT, visibility: p.visibility })),
      };
    });
    return { key, condition: 'frontal', truth: PER_CYCLE[key] * CYCLES, frames };
  },
  portrait: (key) => {
    const aspect = 0.75;
    const frames = clean(key).map((f) => ({ t: f.t, image: f.image!.map((p) => ({ ...p, x: 0.5 + (p.x - 0.5) / aspect })), world: null }));
    return { key, condition: 'portrait', truth: PER_CYCLE[key] * CYCLES, frames, aspect };
  },
  flicker: (key) => {
    const far = [11, 13, 15, 23, 25, 27];
    const frames = clean(key).map((f, i) => {
      const image = f.image!.map((p) => ({ ...p }));
      for (const j of far) {
        image[j].x += 0.03 * Math.sin(i * 1.7);
        image[j].visibility = i % 2 ? 0.995 : 0.7;
      }
      return { t: f.t, image, world: f.world };
    });
    return { key, condition: 'flicker', truth: PER_CYCLE[key] * CYCLES, frames };
  },
};

/** Distractors: true count is 0. */
function distractors(seed: number): Seq[] {
  const out: Seq[] = [];
  const r = rng(seed);
  // Shaking: fast, physically impossible "squats" (5 Hz) and arm flaps.
  for (const key of ['squat', 'pushup', 'curl', 'jacks']) {
    const a = anim(key);
    const frames: Frame[] = [];
    for (let t = 0; t < 8000; t += 1000 / FPS) {
      const u = 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / 200);
      const image = landmarksFrom(skeletonAt(a.frames[0].p, a.frames[1].p, u)).map((p) => ({ ...p, x: p.x + gauss(r) * 0.004, y: p.y + gauss(r) * 0.004 }));
      frames.push({ t, image, world: null });
    }
    out.push({ key, condition: 'shaking', truth: 0, frames });
  }
  // Wrong posture: curling while the coach expects push-ups; marching when it expects crunches.
  for (const [key, src] of [['pushup', 'curl'], ['crunch', 'march'], ['bridge', 'squat']] as const) {
    out.push({ key, condition: 'wrongPosture', truth: 0, frames: clean(src, 4).map((f) => ({ ...f, world: null })) });
  }
  return out;
}

type Config = { name: string; features: Partial<Record<Feature, boolean>>; filter: boolean };
const ALL_CONFIGS: Config[] = [
  { name: 'Full system', features: {}, filter: true },
  ...FEATURES.map((f) => ({ name: `− ${f}`, features: { [f]: false }, filter: true })),
  { name: '− landmarkFilter', features: {}, filter: false },
  { name: 'Baseline (all off)', features: Object.fromEntries(FEATURES.map((f) => [f, false])), filter: false },
];
const CONFIGS = process.env.ONLY ? ALL_CONFIGS.filter((c) => process.env.ONLY!.split(',').includes(c.name)) : ALL_CONFIGS;
const FI = (process.env.FI ?? '').split(',').filter(Boolean).map(Number);
const FW = (process.env.FW ?? '').split(',').filter(Boolean).map(Number);

function run(seq: Seq, cfg: Config): number {
  const coach = new FormCoach('eval', seq.key, { aspect: seq.aspect ?? 1, features: cfg.features });
  const fi = new LandmarkFilter(...(FI as []));
  const fw = new LandmarkFilter(...(FW as []));
  for (const f of seq.frames) {
    const image = cfg.filter ? fi.apply(f.image, f.t) : f.image;
    const world = cfg.filter ? fw.apply(f.world, f.t) : f.world;
    coach.update(image, f.t, world);
  }
  return coach.summary().reps;
}

const seqs: Seq[] = [];
for (const seed of SEEDS) {
  for (const key of Object.keys(PER_CYCLE)) {
    for (const [name, make] of Object.entries(CONDITIONS)) {
      if (seed > 1 && !['noise', 'occlusion'].includes(name)) continue; // deterministic conditions once
      if (name === 'frontal' && anim(key).view === 'front') continue; // already a frontal animation: rotating it would hide the movement
      seqs.push(make(key, seed));
    }
  }
  seqs.push(...distractors(seed));
}

type Row = { config: string; condition: string; n: number; mae: number; oboa: number; phantom: number };
const rows: Row[] = [];
const conditions = [...Object.keys(CONDITIONS), 'shaking', 'wrongPosture'];
const perSeq: { config: string; key: string; condition: string; truth: number; pred: number }[] = [];
for (const cfg of CONFIGS) {
  for (const cond of conditions) {
    const set = seqs.filter((s) => s.condition === cond);
    let mae = 0, obo = 0, phantom = 0;
    for (const s of set) {
      const pred = run(s, cfg);
      perSeq.push({ config: cfg.name, key: s.key, condition: cond, truth: s.truth, pred });
      if (s.truth > 0) mae += Math.abs(pred - s.truth) / s.truth;
      else phantom += pred;
      if (Math.abs(pred - s.truth) <= 1) obo++;
    }
    const pos = set.filter((s) => s.truth > 0).length;
    rows.push({ config: cfg.name, condition: cond, n: set.length, mae: pos ? mae / pos : NaN, oboa: obo / set.length, phantom: set.length - pos ? phantom / (set.length - pos) : NaN });
  }
}

// ---- report ----
const dir = new URL('./results/', import.meta.url).pathname;
mkdirSync(dir, { recursive: true });
writeFileSync(dir + 'synthetic.json', JSON.stringify({ fps: FPS, cycles: CYCLES, seeds: SEEDS, exercises: Object.keys(PER_CYCLE), rows, perSeq }, null, 1));

const posConds = Object.keys(CONDITIONS);
const avg = (cfg: string, f: (r: Row) => number, conds: string[]) => {
  const rs = rows.filter((r) => r.config === cfg && conds.includes(r.condition));
  return rs.reduce((a, r) => a + f(r), 0) / rs.length;
};
let md = `# Synthetic rep-counting benchmark\n\n${Object.keys(PER_CYCLE).length} exercises × ${posConds.length} conditions (noise/occlusion × ${SEEDS.length} seeds) + distractors. ${seqs.length} sequences, ${CYCLES} cycles each, ${FPS} fps.\n\n`;
md += `| Configuration | ${posConds.map((c) => `${c} MAE / OBOA`).join(' | ')} | Phantom reps (shaking / wrong posture) |\n|---|${posConds.map(() => '---|').join('')}---|\n`;
for (const cfg of CONFIGS) {
  const cells = posConds.map((c) => {
    const r = rows.find((x) => x.config === cfg.name && x.condition === c)!;
    return `${r.mae.toFixed(3)} / ${(r.oboa * 100).toFixed(0)}%`;
  });
  const sh = rows.find((x) => x.config === cfg.name && x.condition === 'shaking')!;
  const wp = rows.find((x) => x.config === cfg.name && x.condition === 'wrongPosture')!;
  md += `| ${cfg.name} | ${cells.join(' | ')} | ${sh.phantom.toFixed(1)} / ${wp.phantom.toFixed(1)} |\n`;
}
md += `\n**Averages over all positive conditions**\n\n| Configuration | MAE | OBOA | Phantom reps |\n|---|---|---|---|\n`;
for (const cfg of CONFIGS) {
  md += `| ${cfg.name} | ${avg(cfg.name, (r) => r.mae, posConds).toFixed(3)} | ${(avg(cfg.name, (r) => r.oboa, posConds) * 100).toFixed(1)}% | ${avg(cfg.name, (r) => r.phantom, ['shaking', 'wrongPosture']).toFixed(1)} |\n`;
}
writeFileSync(dir + 'synthetic.md', md);

// LaTeX tables for the paper
const texName = (n: string) => n.replace('− ', '$-$\\,').replace(/([a-z])([A-Z])/g, '$1 $2').replace('world3d', '3D world landmarks').replace('aspect Fix', 'aspect correction').replace('frame Gating', 'frame gating').replace('posture Gate', 'posture gate').replace('sticky Side', 'sticky side').replace('start Rule', 'start rule').replace('min Duration', 'min. duration').replace('landmark Filter', 'One Euro filter');
let tex = '% generated by backend/eval/synthetic.ts\n\\begin{tabular}{lrrr}\n\\toprule\nConfiguration & MAE $\\downarrow$ & OBOA $\\uparrow$ & Phantom $\\downarrow$\\\\\n\\midrule\n';
for (const cfg of CONFIGS) tex += `${texName(cfg.name)} & ${avg(cfg.name, (r) => r.mae, posConds).toFixed(3)} & ${(avg(cfg.name, (r) => r.oboa, posConds) * 100).toFixed(1)}\\% & ${avg(cfg.name, (r) => r.phantom, ['shaking', 'wrongPosture']).toFixed(2)}\\\\\n`;
tex += '\\bottomrule\n\\end{tabular}\n';
writeFileSync(dir + 'synthetic_ablation.tex', tex);
let tex2 = '% generated by backend/eval/synthetic.ts\n\\begin{tabular}{l' + 'r'.repeat(posConds.length) + '}\n\\toprule\n & ' + posConds.map((c) => c[0].toUpperCase() + c.slice(1)).join(' & ') + '\\\\\n\\midrule\n';
for (const cfg of [CONFIGS[0], CONFIGS.at(-1)!]) tex2 += `${texName(cfg.name)} & ` + posConds.map((c) => { const r = rows.find((x) => x.config === cfg.name && x.condition === c)!; return `${r.mae.toFixed(3)} / ${(r.oboa * 100).toFixed(0)}\\%`; }).join(' & ') + '\\\\\n';
tex2 += '\\bottomrule\n\\end{tabular}\n';
writeFileSync(dir + 'synthetic_conditions.tex', tex2);
console.log(md);
