// Real-video evaluation: runs the Fire-Fit counter on landmarks extracted from
// recorded videos (extract_landmarks.py) and compares with hand counts.
//
//   npx tsx eval/real/score.ts [labels.csv]   → eval/results/real.{json,md,tex}
//
// labels.csv columns: video,exercise,true_reps,view,device,notes
//   video     file name without extension (matches landmarks/<video>.json)
//   exercise  coach key (squat, pushup, lunge, jacks, … — see COUNTS_REPS in formRules.ts)
//   true_reps hand count, agreed by two people watching the video
//   view      side | front | angle      device  phone | laptop
// A video with true_reps = 0 is a distractor (walking about, stretching, the wrong exercise).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { FEATURES, FormCoach, LandmarkFilter, type Feature, type Landmark } from '../../src/coach/formRules.ts';

const here = new URL('./', import.meta.url).pathname;
const labelsPath = process.argv[2] ?? here + 'labels.csv';
const lmDir = process.env.LANDMARKS ?? here + 'landmarks/';

type Label = { video: string; exercise: string; truth: number; view: string; device: string };
const labels: Label[] = readFileSync(labelsPath, 'utf8')
  .split(/\r?\n/)
  .slice(1)
  .filter((l) => l.trim() && !l.startsWith('#'))
  .map((l) => {
    const [video, exercise, truth, view = '', device = ''] = l.split(',').map((s) => s.trim());
    return { video, exercise, truth: Number(truth), view, device };
  });

type Clip = { width: number; height: number; frames: { t: number; image: Landmark[] | null; world: Landmark[] | null }[] };
type Config = { name: string; features: Partial<Record<Feature, boolean>>; filter: boolean };
const CONFIGS: Config[] = [
  { name: 'Full system', features: {}, filter: true },
  ...FEATURES.map((f) => ({ name: `− ${f}`, features: { [f]: false }, filter: true })),
  { name: '− landmarkFilter', features: {}, filter: false },
  { name: 'Baseline (all off)', features: Object.fromEntries(FEATURES.map((f) => [f, false])), filter: false },
];

function count(clip: Clip, exercise: string, cfg: Config) {
  const coach = new FormCoach('eval', exercise, { aspect: clip.width / clip.height, features: cfg.features });
  const fi = new LandmarkFilter();
  const fw = new LandmarkFilter();
  for (const f of clip.frames) {
    coach.update(cfg.filter ? fi.apply(f.image, f.t) : f.image, f.t, cfg.filter ? fw.apply(f.world, f.t) : f.world);
  }
  return coach.summary().reps;
}

const missing = labels.filter((l) => !existsSync(lmDir + l.video + '.json'));
if (missing.length) console.warn(`No landmarks for: ${missing.map((m) => m.video).join(', ')} (run extract_landmarks.py)`);
const usable = labels.filter((l) => !missing.includes(l));
if (!usable.length) {
  console.error('Nothing to score.');
  process.exit(1);
}
const clips = new Map(usable.map((l) => [l.video, JSON.parse(readFileSync(lmDir + l.video + '.json', 'utf8')) as Clip]));

const per: { config: string; video: string; exercise: string; view: string; device: string; truth: number; pred: number }[] = [];
for (const cfg of CONFIGS) for (const l of usable) per.push({ config: cfg.name, ...l, pred: count(clips.get(l.video)!, l.exercise, cfg) });

const stats = (rs: typeof per) => {
  const pos = rs.filter((r) => r.truth > 0);
  const neg = rs.filter((r) => r.truth === 0);
  return {
    n: rs.length,
    mae: pos.length ? pos.reduce((a, r) => a + Math.abs(r.pred - r.truth) / r.truth, 0) / pos.length : NaN,
    oboa: rs.filter((r) => Math.abs(r.pred - r.truth) <= 1).length / rs.length,
    exact: rs.filter((r) => r.pred === r.truth).length / rs.length,
    phantom: neg.length ? neg.reduce((a, r) => a + r.pred, 0) / neg.length : NaN,
  };
};
const f3 = (v: number) => (Number.isNaN(v) ? '–' : v.toFixed(3));
const pc = (v: number) => (Number.isNaN(v) ? '–' : `${Math.round(v * 100)}%`);

let md = `# Real-video rep counting\n\n${usable.length} videos (${usable.filter((l) => l.truth === 0).length} distractors), ${new Set(usable.map((l) => l.exercise)).size} exercises.\n\n`;
md += '| Configuration | MAE | OBOA | Exact | Phantom reps / distractor |\n|---|---|---|---|---|\n';
let tex = '\\begin{tabular}{lcccc}\n\\toprule\nConfiguration & MAE $\\downarrow$ & OBOA $\\uparrow$ & Exact $\\uparrow$ & Phantom $\\downarrow$ \\\\\n\\midrule\n';
for (const cfg of CONFIGS) {
  const s = stats(per.filter((r) => r.config === cfg.name));
  md += `| ${cfg.name} | ${f3(s.mae)} | ${pc(s.oboa)} | ${pc(s.exact)} | ${Number.isNaN(s.phantom) ? '–' : s.phantom.toFixed(1)} |\n`;
  tex += `${cfg.name.replace('−', '$-$').replace(/([a-z])([A-Z0-9])/g, '$1$2')} & ${f3(s.mae)} & ${pc(s.oboa).replace('%', '\\%')} & ${pc(s.exact).replace('%', '\\%')} & ${Number.isNaN(s.phantom) ? '--' : s.phantom.toFixed(1)} \\\\\n`;
}
tex += '\\bottomrule\n\\end{tabular}\n';
md += '\n## Full system by view and device\n\n| Group | n | MAE | OBOA |\n|---|---|---|---|\n';
const full = per.filter((r) => r.config === 'Full system');
for (const [k, key] of [['view', 'view'], ['device', 'device'], ['exercise', 'exercise']] as const) {
  for (const g of [...new Set(full.map((r) => r[key]))].filter(Boolean)) {
    const s = stats(full.filter((r) => r[key] === g));
    md += `| ${k}: ${g} | ${s.n} | ${f3(s.mae)} | ${pc(s.oboa)} |\n`;
  }
}
md += '\n## Every video (full system)\n\n| Video | Exercise | True | Counted |\n|---|---|---|---|\n';
for (const r of full) md += `| ${r.video} | ${r.exercise} | ${r.truth} | ${r.pred} |\n`;

const out = new URL('../results/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
writeFileSync(out + 'real.json', JSON.stringify(per, null, 1));
writeFileSync(out + 'real.md', md);
writeFileSync(out + 'real_ablation.tex', tex);
console.log(md);
