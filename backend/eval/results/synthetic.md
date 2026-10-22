# Synthetic rep-counting benchmark

23 exercises × 6 conditions (noise/occlusion × 3 seeds) + distractors. 246 sequences, 6 cycles each, 30 fps.

| Configuration | clean MAE / OBOA | noise MAE / OBOA | occlusion MAE / OBOA | frontal MAE / OBOA | portrait MAE / OBOA | flicker MAE / OBOA | Phantom reps (shaking / wrong posture) |
|---|---|---|---|---|---|---|---|
| Full system | 0.040 / 96% | 0.144 / 83% | 0.064 / 88% | 0.051 / 94% | 0.040 / 96% | 0.040 / 96% | 0.0 / 0.0 |
| − world3d | 0.047 / 96% | 0.123 / 84% | 0.075 / 87% | 0.778 / 22% | 0.040 / 96% | 0.076 / 87% | 0.0 / 0.0 |
| − aspectFix | 0.040 / 96% | 0.144 / 83% | 0.064 / 88% | 0.051 / 94% | 0.170 / 83% | 0.040 / 96% | 0.0 / 0.0 |
| − frameGating | 0.040 / 96% | 0.144 / 83% | 0.064 / 88% | 0.051 / 94% | 0.040 / 96% | 0.040 / 96% | 0.0 / 0.0 |
| − postureGate | 0.040 / 96% | 0.144 / 83% | 0.064 / 88% | 0.051 / 94% | 0.040 / 96% | 0.040 / 96% | 0.0 / 0.0 |
| − stickySide | 0.040 / 96% | 0.144 / 83% | 0.064 / 88% | 0.051 / 94% | 0.040 / 96% | 0.330 / 70% | 0.0 / 0.0 |
| − startRule | 0.014 / 100% | 0.115 / 87% | 0.039 / 94% | 0.019 / 100% | 0.014 / 100% | 0.014 / 100% | 0.0 / 0.0 |
| − minDuration | 0.040 / 96% | 0.144 / 83% | 0.064 / 88% | 0.051 / 94% | 0.040 / 96% | 0.040 / 96% | 10.0 / 0.0 |
| − alternation | 0.040 / 96% | 0.142 / 83% | 0.064 / 88% | 0.051 / 94% | 0.040 / 96% | 0.040 / 96% | 0.0 / 0.0 |
| − landmarkFilter | 0.036 / 96% | 0.166 / 78% | 0.066 / 88% | 0.046 / 94% | 0.036 / 96% | 0.036 / 96% | 0.0 / 0.0 |
| Baseline (all off) | 0.004 / 100% | 0.103 / 87% | 0.034 / 94% | 0.713 / 28% | 0.105 / 91% | 0.312 / 70% | 10.0 / 2.7 |

**Averages over all positive conditions**

| Configuration | MAE | OBOA | Phantom reps |
|---|---|---|---|
| Full system | 0.063 | 92.1% | 0.0 |
| − world3d | 0.190 | 78.6% | 0.0 |
| − aspectFix | 0.085 | 89.9% | 0.0 |
| − frameGating | 0.063 | 92.1% | 0.0 |
| − postureGate | 0.063 | 92.1% | 0.0 |
| − stickySide | 0.111 | 87.7% | 0.0 |
| − startRule | 0.036 | 96.9% | 0.0 |
| − minDuration | 0.063 | 92.1% | 5.0 |
| − alternation | 0.063 | 92.1% | 0.0 |
| − landmarkFilter | 0.065 | 91.3% | 0.0 |
| Baseline (all off) | 0.212 | 78.3% | 6.3 |
