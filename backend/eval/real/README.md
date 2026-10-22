# Real-video evaluation

Measures how accurately Fire-Fit counts reps on real camera footage, and which parts of
the counter matter (ablation). Results go into the paper's real-video table.

## 1. Record

Aim for **at least 60 clips**: 6–8 exercises × 2 views × 2 devices × 2 people, plus about
10 distractor clips. More people and rooms make the result more convincing.

| Setting | What to do |
|---|---|
| Exercises | squat, pushup, lunge, jacks, highKnees, curl, press, bridge (keys from `COUNTS_REPS`) |
| Reps per clip | 8–15, at your normal pace; a few clips fast and a few slow |
| Views | `side` (side-on) and `front` (facing the camera); optionally `angle` (45°) |
| Devices | `phone` (propped 2–3 m away, portrait) and `laptop` (webcam, landscape) |
| Framing | whole body in frame, head to feet; normal room lighting |
| Distractors (`true_reps = 0`) | walking into frame and adjusting the phone, stretching, shaking out arms, doing a different exercise from the one labelled |
| Start and end | start standing still for 2 s; stop and stand still for 2 s |

Record 30 or 60 fps. Name each file `<exercise>_<view>_<device>_<person>_<n>.mp4`.
Everyone recorded must agree to it; don't publish the videos without consent (the
landmark JSON contains no images and is fine to share).

## 2. Label

Two people count each video independently. Where they disagree, watch again together.
Put the agreed count in `labels.csv` (copy `labels.example.csv`). Report the
inter-rater agreement (share of clips where both counts matched first time) in the paper.

## 3. Extract landmarks

```bash
pip install mediapipe opencv-python
curl -LO https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task
python eval/real/extract_landmarks.py --model pose_landmarker_full.task videos/*.mp4
```

This uses the same model as the phone companion and writes `eval/real/landmarks/*.json`.

## 4. Score

```bash
cd backend
npx tsx eval/real/score.ts eval/real/labels.csv
```

Writes `eval/results/real.md` (tables by configuration, view, device and exercise, plus
every video) and `eval/results/real_ablation.tex`, which the paper includes directly.
Metrics: MAE = mean |counted − true| / true, OBOA = share within ±1 rep, Exact, and
phantom reps per distractor clip.
