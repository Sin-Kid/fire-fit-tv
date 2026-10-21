import { Platform } from 'react-native';

// Where the TV app finds the workout API.
//
// Option A (recommended for the demo): deploy ../../backend to AWS Lambda with SAM and
//   paste the Function URL here, e.g. 'https://abc123.lambda-url.us-east-1.on.aws'.
//   It's HTTPS, so it works on a real Fire TV with no extra Android config.
// Option B (local dev): run `npm run dev` in backend/ and use
//   - Android TV emulator:  'http://10.0.2.2:8787'  (10.0.2.2 = your computer)
//   - Browser (npx expo start --web): 'http://localhost:8787' (picked automatically)
//   - Fire TV stick on Wi-Fi: 'http://<your-computer-LAN-IP>:8787'
//   Plain http needs cleartext traffic enabled on Android (see README).
const LOCAL_API = Platform.OS === 'web' ? 'http://localhost:8787' : 'http://10.0.2.2:8787';

/**
 * The browser build hosted on the web (e.g. Netlify) has no backend: workouts are built
 * on the device, and there's no phone pairing (the browser's own mic still works).
 */
export const HOSTED_WEB_DEMO =
  Platform.OS === 'web' && typeof window !== 'undefined' && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location?.hostname ?? 'localhost');

/**
 * Where the API lives. Hosted on Netlify, the phone-pairing API is a Netlify Function on the
 * same site (workouts are still built on the device there); otherwise the local backend.
 */
export const API_BASE_URL = HOSTED_WEB_DEMO ? window.location.origin : LOCAL_API;

/** How long to wait for Bedrock before using the on-device fallback. */
export const REQUEST_TIMEOUT_MS = 25000;

/** Seconds of "Get ready" countdown before the first exercise. */
export const GET_READY_SEC = 5;

/**
 * Base URL the PHONE uses to open the form-camera page (shown as a QR code on the TV).
 * Usually the same as API_BASE_URL. The phone camera only works over https (or on
 * localhost), so use your Lambda Function URL or an https tunnel here.
 */
export const COACH_BASE_URL = API_BASE_URL;

/** How often the TV checks for new form cues from the phone. */
export const COACH_POLL_MS = 700;

/**
 * Phone form camera (MediaPipe pose detection → spoken form cues). Future scope:
 * the code is complete and tested, but it's switched off for the contest build.
 * Set to true to show the QR pairing panel and live form coaching again.
 */
export const FORM_CAMERA_ENABLED = true;
/** Voice commands ("skip", "wait", "more rest"…) through the voice remote page and, in browsers, the built-in mic. */
export const VOICE_REMOTE_ENABLED = true;
