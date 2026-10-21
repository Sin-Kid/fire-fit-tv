# Fire-Fit friction log

Issues hit while building Fire-Fit for the Amazon Developer hackathon, with workarounds and suggestions.

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

```
Task attempted: Build the Vega app with the Vega SDK 0.24 (npm run build:app)
Steps taken: vega project generate (helloWorld template), copied our src, npm install, npm run build:app
Expected: Build completes
Actual: Metro stuck forever on "Waiting for Watchman `watch-project` (10s)... (90s)..." on macOS
Severity: Blocker
Workaround: resolver.useWatchman = false in metro.config.js, then `watchman shutdown-server`
Suggestion: Ship the Vega template with useWatchman: false, or detect the hang and fall back to Metro's file crawler with a clear message
```

```
Task attempted: Install and launch the app (vega run-app ... -d VirtualDevice)
Steps taken: Built successfully, ran vega run-app right after closing the simulator window
Expected: Simulator starts and the app launches
Actual: "Vega operation FAILED due to an irrecoverable error: Couldn't find device 'VirtualDevice'"; after
        `vega virtual-device start`, run-app reported "Successfully launched the app" while the device was still on its boot animation, so nothing appeared
Severity: Major
Workaround: `vega virtual-device start --timeout 180 && vega run-app ...`, then run-app a second time once the home screen is up
Suggestion: Let run-app start/wait for the Virtual Device itself, and only report success once the app is in the foreground
```

```
Task attempted: Voice commands and spoken coaching in a Vega React Native app
Steps taken: Looked for TTS / speech-recognition / microphone APIs in the Vega supported-libraries list
Expected: A way to speak and listen (fitness apps are used hands-free)
Actual: No text-to-speech, audio capture or speech-recognition library for Vega React Native apps
Severity: Major
Workaround: On-screen captions on the TV; a phone (or laptop) browser does the listening and relays commands through our backend
Suggestion: Expose TTS and a speech/mic API (or route Alexa voice intents to the foreground app)
```

```
Task attempted: First Amazon Bedrock call (Nova 2 Lite via the Converse API) from an 8-month-old AWS account
Steps taken: aws login (browser sign-in), started the backend, generated a workout
Expected: Model responds (model access is now automatic)
Actual: "Your account is currently being verified. Verification normally takes less than 2 hours..." The real cause appeared to be
        that the account had no payment method; the message doesn't say so, and it resolved itself about an hour later
Severity: Major
Workaround: Kept an on-device fallback generator so the app never blocks on Bedrock
Suggestion: Say what is being verified and what the user can do (e.g. "add a payment method")
```
