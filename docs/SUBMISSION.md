# Devpost submission kit

Everything below is ready to paste. Items in `[brackets]` need your input. Only claim what your demo
actually shows.

---

## Tracks

- **Primary track:** Fire TV (fitness, AI-enhanced viewing)
- **Mini challenge:** none for AWS Builder (leave it unticked; see "About AWS" below).

## Project description

**FitCoach TV turns your Fire TV into a personal trainer that builds a fresh workout around you, then coaches you through it from across the room.**

Most TV fitness apps are a library of fixed videos: you scroll until something is roughly the right length and hope it suits the equipment you own. FitCoach TV works the other way. With the remote, you pick a goal (strength, cardio, fat burn, mobility), a length (10–45 min), your level, the equipment you have, and any limits ("knee friendly", "quiet, no jumping", "small space"). FitCoach builds a workout around those choices in a few seconds.

The TV then runs it as a follow-along session designed for the living room:

- **An animated demo figure for every move.** 32 hand-built stick-figure animations, from squats and push-ups to kettlebell swings and cat-cow, so you can see the movement without watching a video.
- **Big, readable coaching.** Huge countdown clocks, one-line form cues, an intensity meter, colour-coded warm-up / workout / cool-down phases and a timeline of the whole session.
- **A coach that talks.** It announces each move with its length and a form tip, calls out rests and what's next, and reads a recap at the end. On Vega OS, which has no text-to-speech, the same lines appear as large on-screen captions.
- **A calorie counter.** It asks your weight, height, age and sex once (big −/+ buttons, no typing), estimates the session up front, counts calories live during the workout (Mifflin-St Jeor resting burn × each move's MET value) and shows the total at the end.
- **Your phone as the TV's camera and microphone.** Scan the QR code on the workout preview. The phone runs MediaPipe Pose Landmarker in the browser (video never leaves the phone), counts reps and checks form (squat depth, push-up hip sag, plank line…), and the TV captions and speaks each correction. The same page listens for voice commands.
- **Voice commands.** Say "skip", "wait", "go", "more rest", "easier" or "end workout" mid-workout. Vega and Fire OS apps can't use the microphone, so the phone companion (or a laptop browser) listens (speech recognition) and relays the command to the TV through the backend; the TV confirms it on screen.
- **Scaling.** Every move has an "easier" variation one press away, and the summary tracks what you completed, skipped and scaled.

**How it works:** React Native for TV, in two builds from one codebase: Vega OS (demoed in the Vega Virtual Device) and Fire OS (Expo + react-native-tvos). Every screen is designed at 1920×1080 and every size is converted to the TV's own units before rendering (no transform scaling), so text and numbers stay sharp on any TV (Android TV reports 960×540). A small Node.js API generates workouts; it validates and clamps every value before the TV sees it, and if it's unreachable the app builds the workout on the device, so the experience never dead-ends.

**TV-first design decisions:**
- No text entry: every choice, including health limits, is a one-press chip.
- A visible focus state on every control, with initial focus set on each screen.
- The workout list always fits on screen (it switches to two or three columns for long workouts), because a remote can't scroll a list.
- 5% safe margins for TVs that overscan.
- Wall-clock timers held in a ref, so countdowns stay accurate on a busy TV stick.

## About AWS

This submission does **not** enter the AWS Builder mini challenge, and the demo uses the built-in workout generator
(preview badge: "Standard workout"). The repo still contains a working Amazon Bedrock integration
(`backend/src/bedrock.ts`, Converse API with a forced `emit_workout` tool call, Amazon Nova 2 Lite) that turns on when the
backend runs with AWS credentials. Mention it only as an optional extra, e.g. in Future scope.

## Future scope

- **AI-designed workouts with Amazon Bedrock:** the backend integration is in the repo (`backend/src/bedrock.ts`) and switches on with AWS credentials; it wasn't used in the demo.
- Progress history and weekly plans per Amazon account.
- Alexa voice control ("Alexa, pause FitCoach").

## Built during the hackathon

The Fire OS app started from Expo's TV example template (`apps/FireFitTV/_old_template` keeps the original screens). Everything else was built during the submission window: the FitCoach screens, workout generator, 32 animations, voice/caption coaching, TV scaling, Vega build, backend and tests. [Edit if this isn't accurate.]

---

## Demo video script (target 2:40, recorded in the Vega Virtual Device)

Record the simulator window with **Cmd+Shift+5 → Record Selected Portion**. Keep the arrow-key presses visible (focus rings move). Judges may stop at 3:00, so lead with the best part.

| Time | Show | Say |
|---|---|---|
| 0:00–0:15 | Player mid-workout: animated figure, big timer, COACH caption | "This is FitCoach TV: a personal trainer for Fire TV that builds a workout around you and coaches you through it." |
| 0:15–0:45 | Setup: move focus with the remote; pick Fat Burn, 15 min, Beginner, Dumbbells, "Quiet / no jumping" | "Everything's one press on the remote, even limits like no jumping for an apartment." |
| 0:45–1:05 | Build → Preview: show the badge and the full move list | "It built this 15-minute session around my dumbbells and the no-jumping rule. Every move fits on screen, because remotes can't scroll." |
| 1:05–1:50 | Start → get-ready → a move → rest → next move. Press "Make it easier", then Pause/Resume | "Every move has an animated demo, a big timer and a one-line cue. The coach calls out each move and what's next. Easier versions are one press away." |
| (insert, ~25 s) | Phone propped up, scanning the TV's QR code; a squat with the form cue on the TV; then say "wait", "go", "more rest" | "The TV has no camera or mic, so my phone lends them: it checks my form and hears my commands." |
| 1:50–2:15 | End workout → Summary + recap | "At the end I get a summary and a recap with one tip for next time." |
| 2:15–2:40 | Quick cut: `exerciseAnimations.ts`, `TvStage.tsx`, Vega + Fire OS folders | "One React Native codebase, built for Vega OS and Fire OS, laid out once at 1080p and scaled to any TV." |

---

## Product feedback (draft from what happened while building; edit and add your own)

**Vega SDK / Vega Virtual Device**
- Used for: running and recording the demo.
- Worked well: [ ]
- Needs work: no text-to-speech API and no microphone/speech-recognition API for React Native apps, so fitness and accessibility apps can't speak or listen. We fell back to captions and a browser-based voice remote. We fell back to captions. [Add your install/onboarding experience.]
- Would build again: [ ]

**React Native for TV on Fire OS (Expo + react-native-tvos)**
- Used for: the Fire OS build, tested in an Android TV emulator.
- Worked well: one codebase covered Fire OS, Vega and web; standard `Pressable` focus events worked for D-pad navigation.
- Needs work: see the friction log. A fresh TV template build failed twice (JDK warning, duplicate React Native) before the app ran.

## Feature requests (optional)

| Request | Why it matters | Urgency |
|---|---|---|
| Text-to-speech API for Vega React Native apps | Fitness, cooking and accessibility apps need to talk while users look away from the screen | Important |
| Microphone / speech-recognition API for Vega apps (or Alexa intents routed to the foreground app) | Hands-free control matters most when you're mid-exercise; we had to relay voice through a laptop browser | Important |
| Document the TV's dp size (960×540) in the TV design guides | Apps designed at 1920×1080 render at double size | Nice-to-have |

## Friction log (optional, up to a 10% judging bonus)

These happened while building today. Check each against your memory and edit freely.

```
Task attempted: First Android build of the Expo TV app (npm run android) from Android Studio's terminal
Steps taken: 1. npm run prebuild:tv  2. npm run android
Expected: App builds and installs on the TV emulator
Actual: BUILD FAILED in :expo-modules-core:configureCMakeDebug and :react-native-screens:configureCMakeDebug with
        "WARNING: A restricted method in java.lang.System has been called" (JDK bundled with Android Studio 2026.2)
Severity: Blocker
Workaround: Build with JDK 21 (brew install openjdk@21, set JAVA_HOME)
Suggestion: Pin a supported JDK in the template/docs, or have the build tolerate JDK 24+ native-access warnings
```

```
Task attempted: Launch the freshly built app on the Android TV emulator
Steps taken: npm run android (after the JDK fix)
Expected: App opens on the setup screen
Actual: Red screen "TypeError: property is not writable" in setUpDefaultReactNativeEnvironment
Severity: Blocker
Workaround: Found two copies of React Native in the bundle; @react-native/virtualized-lists asks for react-native 0.86.3
            exactly, which react-native-tvos 0.86.3-0 doesn't satisfy, so npm installed upstream react-native nested.
            Fixed with "overrides": { "react-native": "$react-native" } in package.json
Suggestion: Ship the override in the TV template, or align the virtualized-lists peer range with the -0 tvOS versions
```

```
Task attempted: Layout designed at 1920×1080 on an Android TV 4K emulator
Steps taken: Ran the app on "Television (4K) API 36"
Expected: Full-screen layout
Actual: Everything rendered at double size and ran off the screen; the TV reports 960×540 dp
Severity: Major
Workaround: Render on a fixed 1920×1080 canvas and scale it to the window (TvStage.tsx)
Suggestion: Call out TV dp dimensions prominently in the Fire TV / Vega design docs and templates
```

```
Task attempted: npm run prebuild:tv for an Android-only build
Steps taken: Ran the template's prebuild script
Expected: Generate the android folder
Actual: Also generated iOS and started installing CocoaPods through Homebrew, which took several minutes
Severity: Minor
Workaround: Ctrl+C, then npm run android
Suggestion: Offer a --platform android prebuild script in the TV template
```

[Add your Vega SDK install/run experience as more entries.]

---

## GitHub repo

From the Fire-Fit folder (public repo with the MIT license, the simplest option):

```bash
cd ~/1Pavan/Fire-Fit
git init && git add . && git commit -m "FitCoach TV: Fire TV hackathon submission"
gh repo create fitcoach-tv --public --source=. --push      # or create it on github.com and push
```

The `.gitignore` already excludes `node_modules`, builds and logs. If you'd rather keep it private, add
testing@devpost.com and the Amazon reviewers listed on the Devpost page as collaborators on the day you submit
(invitations expire after 7 days).

## Before you hit submit

- [ ] Video under 3 minutes, public on YouTube or Vimeo, English, no copyrighted music
- [ ] Shows the app running in the Vega Virtual Device
- [ ] Repo link works (public + LICENSE, or private + reviewers added)
- [ ] Description and AWS answer match what the video shows
- [ ] Product feedback filled in, friction log entries checked
