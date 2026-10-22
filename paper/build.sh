#!/usr/bin/env bash
# Rebuild the paper: refresh result tables from the benchmark, then compile.
#   ./build.sh            (uses existing results)
#   RERUN=1 ./build.sh    (re-runs the synthetic benchmark and, if labels exist, the real-video scorer)
set -euo pipefail
cd "$(dirname "$0")"
B=../backend
if [ "${RERUN:-0}" = 1 ]; then
  (cd $B && npx tsx eval/synthetic.ts)
  [ -f $B/eval/real/labels.csv ] && (cd $B && npx tsx eval/real/score.ts eval/real/labels.csv) || true
fi
mkdir -p results
cp $B/eval/results/synthetic_ablation.tex $B/eval/results/synthetic_conditions.tex results/
[ -f $B/eval/results/real_ablation.tex ] && cp $B/eval/results/real_ablation.tex results/ || rm -f results/real_ablation.tex
python3 - <<'PY'
import json
d = json.load(open('../backend/eval/results/synthetic.json'))
conds = ['clean', 'noise', 'occlusion', 'frontal', 'portrait', 'flicker']
cfgs = {'Full system': 'full', '− world3d': 'noworld', 'Baseline (all off)': 'base'}
with open('results/conditions.csv', 'w') as f:
    f.write('cond,' + ','.join(cfgs.values()) + '\n')
    for c in conds:
        row = {r['config']: r['mae'] for r in d['rows'] if r['condition'] == c}
        f.write(c + ',' + ','.join(f"{row[k]:.3f}" for k in cfgs) + '\n')
PY
latexmk -pdf -interaction=nonstopmode -halt-on-error main.tex >/dev/null
echo "built $(pwd)/main.pdf"
