# FitCoach TV on Vega OS (Vega Virtual Device)

The same app as `apps/FireFitTV` (setup → preview → animated player → summary), packaged for
Vega OS so it runs in the **Vega Virtual Device**, the Fire TV simulator the contest rules accept.

Differences from the Fire OS build, applied automatically by `scripts/sync-from-firefittv.sh`:

- SVG animations use `@amazon-devices/react-native-svg` (Vega's system-deployed build).
- Vega has no text-to-speech library, so every coaching line ("Jumping Jacks. 30 seconds. Land softly…",
  "Rest. Next up: …") is shown as an on-screen **COACH** caption instead of spoken.

## Run it

1. **Install the Vega SDK** (includes Vega Studio for VS Code and the Vega Virtual Device):
   https://developer.amazon.com/docs/vega/latest/install-vega-sdk.html

2. **Generate a Vega project** from the React Native 0.83 template, then put FitCoach's source in it:
   ```bash
   cd ~/1Pavan/Fire-Fit/apps/FireFitVega
   vega project generate --template helloWorld --name fitcoachvega --packageId com.firefit.vega --outputDir project
   cp -R src/. project/src/
   cd project
   npm install
   npm install @amazon-devices/react-native-svg@~3.0.0 qrcode@1.5.4
   ```
   `src/App.tsx` replaces the template's App and exports `App` both as a named and a default export,
   so it works with the template's `index.js` either way.

3. **Build:**
   ```bash
   npm run build:app
   ```
   If the build says the OS version is missing: `vega project update-manifest --os-min 1.2 --os-version 1.2`

4. **Run in the simulator:** open the `project` folder in VS Code → **Vega Studio** panel →
   **Devices** → press ▶ next to **VirtualDevice:Tv** → wait for it to boot → press ▶ next to the project.
   Use the arrow keys and Enter as the remote.

## Backend (optional)

The app asks the backend at `http://10.0.2.2:8787` for workouts. If it can't reach it, it shows an
**Offline workout** badge and builds the workout on the device, so the demo still works. To use your
running backend, set `API_BASE_URL` in `src/fitcoach/lib/config.ts` to your Mac's address
(`ipconfig getifaddr en0` → `http://<that-ip>:8787`) and rebuild.

## Keeping it in sync

After changing the main app in `apps/FireFitTV/src`, run `scripts/sync-from-firefittv.sh`, then repeat
the `cp -R src/. project/src/` step.
