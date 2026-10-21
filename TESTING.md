# Testing

Last full run: 21 Oct 2026. Everything below passed.

| Layer | What | Result |
|---|---|---|
| Backend unit | Validation, offline generator fits every goal × length, equipment is used for every goal, model-output clamping, routes | 37 / 37 |
| Form coach | Rep counting on every rep-based demo with no false corrections; bad form (shallow squats, sagging push-ups and planks, jacks without arms, squatting a deadlift, upright rows, low high-knees) gets the right cue; out-of-frame and standing-still prompts; cue rate limits | 31 / 31 |
| Pairing sessions | Create/join/poll flow, phone timeout, rest clears the move, input limits, unique codes, phone page + bundle served (also from Lambda), bundle up to date, DynamoDB store commands (mocked) | 11 / 11 |
| Backend + Bedrock (mocked) | Converse request shape (model, forced `emit_workout` tool, prompt contents incl. animated move list), tool-output parsing and re-ordering, fallback on throttling / no tool call / too few moves, recap text with form-camera results and its fallback, Lambda Function URL events incl. base64 bodies | 11 / 11 |
| Backend live | Local HTTP server: health, CORS preflight, workout, recap, 400 / 404 / bad JSON; built Lambda bundle invoked directly | All OK |
| Infrastructure | `cfn-lint backend/template.yaml` | Clean |
| App static | `tsc --noEmit`, `expo lint`, `expo config`, `expo-doctor` | Clean (expo-doctor: 19/21; the 2 remaining checks need Expo's servers and couldn't run offline) |
| Exercise animations | Every offline move and 23 common AI move names map to a demo; all 32 animations checked on 121 frames each for bad numbers, off-canvas limbs and feet below the floor (`npm run animations:check`) | 36 / 36 |
| App end to end | Real app built for web, driven with Playwright at 1920×1080 against the local backend (`tests/e2e/run.mjs`) | 53 / 53 |
| Phone companion end to end (form camera + voice) | TV and phone in two browser windows with a scripted person in front of the camera (`tests/e2e/coach.mjs`): QR + code, wrong code rejected, pairing, camera live, phone follows the TV's move, reps counted and shown on TV, shallow squats → caption + spoken correction on TV and phone, phone voice commands pause/resume the TV, voice mute, pause stops coaching, summary form results, spoken form-aware recap | 27 / 27 |

## End-to-end checks

Setup renders and fits on a 1080p screen · D-pad/keyboard focus shows the lime border · workout generates, badge shows its source · selected equipment appears in the plan · "New version" regenerates · get-ready auto-advances · timer counts down · "Make it easier" / "Standard move" swap the cue · Pause freezes, Resume restarts · Skip advances · End workout → summary with correct completed / skipped / scaled counts · coach recap loads · "Do it again" and "New workout" work · API down → on-device "Offline workout" · the exercise demo shows, animates and freezes on pause · a full 10-minute workout runs to the end on its own (fake clock), through rest screens, counting 14/14 moves and 7:00 active time · no unexpected console errors.

## Bugs found and fixed during testing

1. **Exercises could be counted several times** when timer ticks bunched up before a re-render (likely on a busy Fire TV stick). A full run showed "24/14 moves" and a wrong active time. The timer state now lives in a ref that updates synchronously.
2. **Two React lint errors** in the player (impure call during render; setState inside an effect). Fixed by the same timer restructure.
3. **Fat Burn / Cardio / Mobility ignored your equipment** in the offline generator, while the intro said "using your dumbbells". Added equipment moves for every goal, plus tests for each goal × equipment pair.
4. **"Build my workout" was partly off-screen** at 1080p. Tightened the setup layout.
5. **"A intermediate"** in the coach intro, now "An intermediate".
6. **Lambda runtime `nodejs20.x` is deprecated.** Moved to `nodejs24.x`.

## Not tested here (needs your hardware or account)

- Real Amazon Bedrock calls (needs your AWS credentials and Nova 2 Lite model access). The request and response handling is covered by the mocked tests.
- The real MediaPipe model and a real camera. The model and its runtime load from Google/jsDelivr, which this test sandbox can't reach, so the form tests use landmarks generated from the app's own animations instead. Try `/coach` on your phone or laptop.
- The Android / Fire OS build and D-pad navigation on a real Fire TV (needs Android SDK + device).
- `sam deploy` to your AWS account.

## Re-running

```bash
# backend
cd backend && npm install && npm run typecheck && npm test

# app static checks
cd apps/FireFitTV && npx tsc --noEmit && npx expo lint

# form camera end to end (future scope: set FORM_CAMERA_ENABLED = true first)
#   npx tsx tests/e2e/make-pose-frames.ts && node tests/e2e/coach.mjs

# end to end (web build)
#   1. temporarily set API_BASE_URL = 'http://localhost:8787' in apps/FireFitTV/src/lib/config.ts
cd backend && USE_BEDROCK=false npm run dev            # terminal 1
cd apps/FireFitTV && npx expo export --platform web --output-dir /tmp/fitweb \
  && npx serve /tmp/fitweb -l 8090                     # terminal 2
cd tests/e2e && npm install && npx playwright install chromium && npm test   # terminal 3
#   2. set API_BASE_URL back afterwards
```
