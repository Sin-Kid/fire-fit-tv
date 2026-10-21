## Inspiration
Home workouts on a TV are usually a library of fixed videos: you scroll until something is roughly the right length, and nobody tells you when your squat is too shallow. We wanted the TV to act like a personal trainer instead: build a session around *you*, coach you through it from across the room, and notice how you're moving.

## What it does
**Fire-Fit turns a Fire TV into an AI personal trainer, with your phone as its eyes and ears.**

- **Builds your workout.** With the remote you pick a goal, length, level, the equipment you own and any limits ("knee friendly", "quiet, no jumping"). **Amazon Bedrock (Amazon Nova 2 Lite)** designs the session in seconds.
- **Coaches you on the TV.** An animated demo figure for every move (32 hand-built animations), huge countdowns, one-line form cues, warm-up / workout / cool-down phases, and an "easier" option one press away. The coach announces each move and reads a recap at the end (captions on Vega, which has no text-to-speech).
- **Counts calories.** You enter weight, height, age and sex once with big −/+ buttons (no typing). Calories are estimated live from your resting burn (Mifflin-St Jeor) and each move's MET value.
- **Your phone is the TV's camera and microphone.** Scan the QR code on the TV. The phone runs **MediaPipe Pose Landmarker** in the browser (video never leaves the phone), counts reps and checks form: squat depth, push-up hip sag, plank line and more. Corrections appear and are spoken **on the TV**. The same phone listens for **voice commands**: "start", "wait", "skip", "rest", "slow down", "more rest", "easier", "end workout".

## How we built it
- **TV app:** React Native for TV, one codebase built for **Vega OS** (Vega Virtual Device) and **Fire OS** (Expo + react-native-tvos). Every screen is designed at 1920×1080 and every size is converted to the TV's own units before rendering, so text stays sharp on 720p, 1080p and 4K TVs.
- **Backend:** Node.js / TypeScript. Bedrock's Converse API is called with a forced `emit_workout` tool and a JSON schema, so the model returns structured workouts; every value is validated and clamped before the TV sees it. A deterministic fallback generator means the TV never dead-ends. Deployable to **AWS Lambda** with a SAM template.
- **Phone companion:** a web page served through the backend. MediaPipe's 3D world landmarks give joint angles that work whether you face the phone or stand side-on; a One Euro filter removes jitter; rule-based form checks per exercise family produce reps and cues. Phones only allow the camera and mic on https, so the page is reached through the **Expo tunnel**.
- **Tests:** 150+ backend tests (including form rules driven by our own animations), plus Playwright end-to-end runs of the TV app and the phone companion.

## Challenges we ran into
- **TV apps get no camera or microphone** (Vega has no speech-recognition or audio-capture API for apps), so we made the phone the TV's sensor and relayed voice commands and form cues through the backend.
- **Rep counting on a real camera:** angles measured on the flat image were skewed by the camera's aspect ratio and failed for front-on squats; moving to 3D world landmarks, sticky side selection and smoothing fixed it.
- **Android TV reports 960×540 dp**, so a 1080p layout rendered at double size; we built resolution-independent sizing.
- Build issues on a fresh setup: a JDK warning breaking CMake, and two copies of React Native in the bundle (details in our friction log).

## Accomplishments that we're proud of
A workout that is designed for you, runs entirely by remote or voice, and actually watches your form, on a device with no camera and no microphone of its own.

## What we learned
TV-first UX is its own discipline: no typing, visible focus everywhere, nothing that needs scrolling, and text readable from three metres. And structured tool-calling makes an LLM a dependable part of an app instead of a text generator.

## What's next for Fire-Fit
Progress history and weekly plans, Alexa voice control, multi-person form tracking, and a native phone companion app.
