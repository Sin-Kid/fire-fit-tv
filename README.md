# Fire-Fit: AI personal trainer for Fire TV (Vega OS + Fire OS)

**Fire-Fit is a TV app first.** The main product runs on **Amazon Fire TV**: built for **Vega OS** (runs on the Vega Virtual Device) and **Fire OS** (Fire TV Stick / Android TV), from one React Native codebase. You control everything with the remote: pick a goal, time, level, equipment and any limits. **Amazon Bedrock** designs the workout, and the TV runs it: animated demo figures for 32 moves, big timers readable from across the room, form tips, a live calorie counter, an "easier" option for every move, and a coach recap at the end.

**Demo video (Vega OS + phone companion):** [Watch on YouTube](https://youtu.be/du_oGdhgtNg) · [docs/fire-fit-demo.mp4](docs/fire-fit-demo.mp4)

[![Fire-Fit demo video](https://img.youtube.com/vi/du_oGdhgtNg/hqdefault.jpg)](https://youtu.be/du_oGdhgtNg)

Everything else supports the TV:

- **Phone = the TV's camera and microphone (optional).** Fire TV apps get no camera or mic, so you scan a QR code on the TV and your phone becomes its sensor. MediaPipe in the phone browser counts reps and checks form, and listens for voice commands ("skip", "rest", "slow down"…). Results are **shown and spoken on the TV**. Video never leaves the phone.
- **Laptop / browser build (bonus).** The same TV app also runs in a browser (https://fire-fit-tv.netlify.app). On a laptop it detects the webcam and microphone and coaches you by itself.

Hackathon entry: **Fire TV track** (fitness, AI-enhanced viewing, computer vision, multi-modal UX) + **AWS Builder** (Amazon Bedrock, Lambda, DynamoDB). Bedrock is optional: without AWS credentials the backend and the TV use a built-in generator, so the TV never dead-ends.

```
                         ┌─────────────────────────────────────────┐
                         │  FIRE TV APP  (the main product)        │
                         │  Vega OS  (Vega Virtual Device)         │
                         │  Fire OS  (Expo + react-native-tvos)    │
                         │  setup → preview → workout → summary    │
                         └───────┬─────────────────────▲───────────┘
                    POST /workout│                     │ reps, form cues,
                    POST /recap  │                     │ voice commands (polled)
                         ┌───────▼─────────────────────┴───────────┐   Converse API   ┌──────────────────┐
                         │  Fire-Fit API (Node, AWS Lambda +       │ ───────────────▶ │ Amazon Bedrock   │
                         │  DynamoDB, or Netlify Functions)        │ ◀─────────────── │ Amazon Nova 2    │
                         │  validates + clamps model output        │  tool-use JSON   │ Lite             │
                         └───────▲─────────────────────────────────┘                  └──────────────────┘
                                 │ reps / cues / commands only (no video)
                         ┌───────┴─────────────────────────────────┐
                         │  Phone companion (optional): scan QR    │
                         │  MediaPipe Pose + speech in the browser │
                         └─────────────────────────────────────────┘
```

## Screenshots: running on Vega OS (Vega Virtual Device)

| | |
|---|---|
| ![Vega Virtual Device with the on-screen remote](docs/gallery/vega-4-simulator-remote.png) | ![About you: calorie counter setup](docs/gallery/vega-1-about-you.png) |
| **Fire-Fit in the Vega Virtual Device**, driven by the remote | **About you**: weight, height, age with big −/+ buttons |
| ![Setup: goal, time, level, equipment](docs/gallery/vega-2-setup.png) | ![Workout preview with the QR code](docs/gallery/vega-3-preview-qr.png) |
| **Tell the coach what you want**: one press per choice | **Workout ready**: scan the QR code to pair your phone |

## Repo layout

| Path | What it is |
|---|---|
| `apps/FireFitVega/` | **The TV app for Vega OS** / Vega Virtual Device (see its README) |
| `apps/FireFitTV/` | **The TV app for Fire OS** (Expo SDK 57, react-native-tvos); also builds for the web |
| `apps/FireFitTV/src/screens/` | Profile, Setup, Loading, Preview, Player, Summary |
| `apps/FireFitTV/src/components/FocusButton.tsx` | D-pad focusable button with a visible focus state |
| `apps/FireFitTV/src/lib/scale.ts` | Resolution-independent sizing: sharp on 720p, 1080p and 4K TVs |
| `apps/FireFitTV/src/lib/config.ts` | **Set the API URL here** |
| `backend/src/bedrock.ts` | **Amazon Bedrock integration**: Converse API, forced tool call for structured JSON, recap generation |
| `backend/src/coach/formRules.ts` | Rep counting and form checks from MediaPipe landmarks (same file on TV, phone and laptop) |
| `backend/public/coach.html` | Phone companion page (camera + mic for the TV) |
| `backend/src/handler.ts` | Routes `GET /health`, `POST /workout`, `POST /recap`, pairing sessions |
| `backend/src/validate.ts` | Request validation and clamping of model output |
| `backend/src/fallback.ts` | Deterministic offline generator |
| `backend/template.yaml` | AWS SAM template: Lambda + Function URL + DynamoDB + Bedrock IAM policy |
| `backend/test/` | 160 tests (run offline) |
| `backend/eval/` | Rep-counting benchmark (synthetic) and real-video evaluation tools |
| `docs/` | Devpost text, friction log, gallery images |

## Run it on the TV

### Vega OS (Vega Virtual Device)

Follow `apps/FireFitVega/README.md`. In short, with the Vega SDK installed:

```bash
cd apps/FireFitVega/project
npm run build:app
vega virtual-device start --timeout 180
vega run-app build/aarch64-release/fitcoachvega_aarch64.vpkg com.firefit.vega.main -d VirtualDevice
```

Use the arrow keys and Enter as the remote. Vega has no text-to-speech, so coaching lines appear as on-screen captions.

### Fire OS

See *2. TV app (Fire OS)* below.

## Backend and Fire OS setup

### 1. Backend

Requirements: Node 22+. For AI generation: an AWS account with Amazon Bedrock model access for Amazon Nova 2 Lite (or any Converse-compatible model).

```bash
cd backend
npm install
npm test                         # 160 offline tests
aws configure                    # or export AWS_PROFILE=...
AWS_REGION=us-east-1 npm run dev # http://0.0.0.0:8787
```

Check it: `curl localhost:8787/health`

| Env var | Default | Purpose |
|---|---|---|
| `AWS_REGION` | `us-east-1` | Bedrock region |
| `BEDROCK_MODEL_ID` | `global.amazon.nova-2-lite-v1:0` | Any Converse-compatible model or inference profile |
| `USE_BEDROCK` | `true` | `false` forces the offline generator |
| `PORT` | `8787` | Local server port |

**Deploy to AWS Lambda (recommended for the demo):**

```bash
cd backend
npm run bundle:lambda
sam deploy --guided --template-file template.yaml   # stack name e.g. fitcoach-tv
```

Copy the `ApiUrl` output (drop the trailing `/`) into `apps/FireFitTV/src/lib/config.ts`.

### 2. TV app (Fire OS)

```bash
cd apps/FireFitTV
npm install
npm run prebuild:tv     # Expo prebuild with TV modifications (EXPO_TV=1)
npm run android         # builds and installs on the connected device/emulator
```

**On a Fire TV stick:** turn on *Settings → My Fire TV → Developer options → ADB debugging*, find its IP under *About → Network*, then `adb connect <fire-tv-ip>:5555` before `npm run android`.

**On the Android TV emulator:** create an Android TV (1080p) device in Android Studio, start it, then `npm run android`. The emulator reaches your computer at `10.0.2.2`, which is the default in `config.ts`.

**Using the local backend over plain http?** Android blocks cleartext http by default. Either use the Lambda HTTPS URL, or run `npx expo install expo-build-properties` and add this to the `plugins` array in `app.json`, then prebuild again:

```json
["expo-build-properties", { "android": { "usesCleartextTraffic": true } }]
```

If the API can't be reached, the app shows an "Offline workout" badge and uses its on-device generator, so you can still demo the flow.

## Calorie counter

The app opens on **About you**: body weight, height, age and sex, set with big −/+ buttons (no typing on a remote). The data stays on the TV.

- Resting burn uses the **Mifflin-St Jeor** equation; each move gets a **MET** value from its phase and intensity (Compendium of Physical Activities ranges), with a quarter off when you press "Make it easier". Rest counts as light activity; pauses count as nothing.
- The preview shows the estimated total for the workout, the player shows a live **KCAL BURNED (EST.)** counter, and the summary shows the final number. Code: `src/lib/calories.ts`, `src/screens/ProfileScreen.tsx`.

## Voice commands

Say **"skip"**, **"wait"** / **"pause"**, **"go"**, **"rest"** (rest right now), **"more rest"** / **"increase rest"** (+15 s), **"less rest"**, **"slow down"** (slower demo + easier version) / **"speed up"**, **"easier"**, **"normal"**, **"mute"** or **"end workout"** during a workout. The TV confirms each one on screen ("VOICE: Adding 15 seconds of rest.") and out loud where it has a voice.

Fire OS and Vega OS don't give apps the microphone (Vega's supported libraries have no audio-capture or speech-recognition API), so a browser does the listening:

- **Voice remote (works with Vega, Fire OS and the emulators):** the workout preview shows a 4-digit code. On the computer running the backend, open **http://localhost:8787/voice** in Chrome, Edge or Safari, enter the code and press *Start listening*. The page uses the browser's speech recognition and sends each phrase to the TV through the backend (`POST /session/:code/voice`); the TV polls the session and runs the command. Tap buttons on the page do the same thing in a noisy room. (Brave and Firefox have no speech recognition.)
- **Browser build of the TV app:** a *Mic on* button in the player uses the browser's own microphone.

Parsing lives in `src/lib/voiceCommands.ts` (unit-tested in `backend/test/voice.test.ts`); the page is `backend/public/voice.html`.

## Sharp on any TV

Screens are designed at 1920×1080, but nothing is scaled with a transform. `src/lib/scale.ts` (`tvStyles`, `u()`) converts every size to the screen's units up front and snaps it to whole pixels, so text, numbers and the animated figures render natively sharp on 720p, 1080p and 4K TVs, including Android/Fire TVs that report 960×540 dp.

## Voice coaching

The TV announces every move with its length and a form tip, every rest with what's next, and reads the coach recap at the end, using Android's text-to-speech via `expo-speech`. A Voice on/off button sits in the player controls. If a device has no speech engine installed (some emulator images), the player says so and shows captions only. On the emulator, install "Speech Services by Google" from the Play Store and make sure its audio isn't muted.

## Exercise animations

Every move has an animated stick-figure demo: 32 in total, covering every move the offline generator uses plus common ones the AI coach picks (curls, deadlifts, burpees, crunches…).

- **In the app:** `src/components/ExerciseFigure.tsx` draws it with `react-native-svg`. The player shows the current move in its phase colour, and rest screens preview the next move at a slower pace. It pauses with the workout.
- **Pose data:** `src/lib/exerciseAnimations.ts` holds the keyframes, a small two-joint solver that keeps feet and hands planted, and the name matcher. AI names like "Goblet Squat" or "Bent-Over Row" map to the closest demo; anything unknown falls back to marching (or deep breathing in a cool-down).
- **Standalone files:** `assets/exercises/*.svg` are self-animating SVGs (they loop in any browser, `<img>` tag or GitHub README). Regenerate with `npm run animations:build`; check with `npm run animations:check`.
- **Bedrock** is told which moves have demos, so AI workouts use them where they fit.

## How the AI part works

1. The app sends `{goal, minutes, level, equipment[], notes}`. Notes come from one-press presets ("Knee friendly", "Quiet / no jumping", …) because typing on a remote is painful.
2. `bedrock.ts` calls **Bedrock Converse** with a system prompt for a TV-friendly trainer and one tool, `emit_workout`, whose JSON schema is the workout. `toolChoice: any` forces the model to answer through the tool, so the response is structured JSON, not prose to parse.
3. `validate.ts` treats the model output as untrusted: clamps every duration (15–120 s), rest (0–60 s) and intensity (1–5), drops malformed items, and re-sorts warm-up → main → cool-down.
4. After the session the app sends completion stats to `/recap`, and Bedrock writes a 2–3 sentence coach recap with one suggestion for next time.
5. Every Bedrock call has a fallback, so a throttled model or a flaky network never breaks the TV experience.

## Laptop mode (detected automatically)

Open the browser build on a computer with a webcam (e.g. https://fire-fit-tv.netlify.app) and the app coaches form by itself: it detects the camera, runs MediaPipe Pose Landmarker in the page (`src/lib/useLaptopCoach.web.ts`, same form rules as the phone), shows a live camera preview with your skeleton and rep count, and listens with the browser's mic for "start", "skip", "wait", "rest"… On a TV (Fire OS / Vega) there's no camera, so the phone companion below is used instead.

## Phone companion: form camera (MediaPipe) + voice

The TV runs the workout; the phone is only a sensor. TV apps get no camera and no microphone, so the phone lends them both: one page, `/coach`, with a single *Start camera + mic* button. It checks your position and form and listens for commands, and everything it finds is shown and spoken on the TV. (`FORM_CAMERA_ENABLED` and `VOICE_REMOTE_ENABLED` in `apps/FireFitTV/src/lib/config.ts` switch the two off.)

1. The workout preview shows a **QR code and 4-digit code**. Scan it and the phone opens `/coach` on the backend.
2. The phone runs **MediaPipe Pose Landmarker** (the full BlazePose model with a lite fallback, on-device in the browser) to find 33 body landmarks with 3D world coordinates, up to 30 times a second.
3. `backend/src/coach/formRules.ts` turns those landmarks into **rep counts and form cues** for the move currently on the TV: squat depth and chest position, push-up depth and hip sag, plank line, lunge depth, jumping-jack arms, knee height, curl elbow swing, press lockout, hinge vs squat, row hinge, band width. It also notices when you're out of frame or standing still. Cues are rate-limited (≥3 s apart, the same cue ≥8 s apart).
4. **Voice:** *Start listening* on the same page uses the phone browser's speech recognition; "skip", "wait", "more rest"… go to the TV through `POST /session/:code/voice` (see Voice commands above).
5. The phone posts reps and cues to a pairing session; the TV polls it, **captions the cue and speaks it** (Android text-to-speech via `expo-speech`), shows a live rep counter, and has a Voice on/off button.
6. At the end, the camera's per-exercise results go into the **Bedrock recap**, which is spoken too: best-form move plus one concrete tip.

Video never leaves the phone; only reps and short cue text are sent. Sessions live in memory locally and in **DynamoDB** (6-hour TTL) on Lambda.

**Phones only allow the camera and microphone on https pages.** Three ways to run it:

- **This computer's webcam (no setup):** open `http://localhost:8787/coach` on the computer running the backend and type the code from the TV.
- **Your phone, locally (one command, uses the Expo tunnel):**
  ```bash
  cd apps/FireFitTV && npm install   # once, installs @expo/ngrok for tunnels
  cd ../../backend && npm run phone  # starts `expo start --tunnel`, then the backend with PUBLIC_URL set
  ```
  The Expo tunnel gives the TV app's dev server an https address (`https://<random>.exp.direct`), and `apps/FireFitTV/metro.config.js` forwards `/coach`, `/voice` and `/session` from it to the backend. The TV's QR code then points at `https://<random>.exp.direct/coach`. Scan it, allow camera and microphone, prop the phone 2–3 m away side-on, press *Start camera* and *Start listening*.
- **Deployed:** with the Lambda Function URL as `API_BASE_URL`, the QR code is already https.

## License

MIT, see [LICENSE](LICENSE).
