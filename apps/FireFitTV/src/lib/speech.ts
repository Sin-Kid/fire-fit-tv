// Spoken coaching cues. expo-speech uses Android's text-to-speech on Fire OS and
// the browser's speech synthesis on web.
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

let enabled = true;
let lastSpokeEnd = 0;

// ---------- browser: pick the most natural voice available ----------
// Browsers default to a robotic voice. Natural/neural voices (Edge "… Online (Natural)",
// Chrome "Google US English", macOS/iOS Samantha) sound like a coach.
type WebSynth = { getVoices(): { name: string; lang: string; localService: boolean }[]; speak(u: unknown): void; cancel(): void; speaking: boolean; addEventListener?: (e: string, f: () => void) => void };
const synth: WebSynth | null = Platform.OS === 'web' && typeof window !== 'undefined' ? ((window as unknown as { speechSynthesis?: WebSynth }).speechSynthesis ?? null) : null;
let bestVoice: ReturnType<WebSynth['getVoices']>[number] | null = null;
function pickVoice() {
  if (!synth) return;
  const voices = synth.getVoices().filter((v) => /^en(-|_|$)/i.test(v.lang));
  const score = (v: { name: string; lang: string; localService: boolean }) =>
    (/natural|neural/i.test(v.name) ? 100 : 0) +
    (/google us english|samantha|aria|jenny|guy|ava|allison|zira/i.test(v.name) ? 40 : 0) +
    (/^en[-_]us/i.test(v.lang) ? 20 : /^en[-_](gb|in|au)/i.test(v.lang) ? 10 : 0) +
    (/enhanced|premium/i.test(v.name) ? 15 : 0) -
    (/compact|espeak|novelty|whisper|bells|bad news|boing|bubbles|cellos|zarvox|trinoids|albert|jester|organ|superstar|wobble/i.test(v.name) ? 200 : 0);
  bestVoice = voices.sort((a, b) => score(b) - score(a))[0] ?? null;
}
if (synth) {
  pickVoice();
  synth.addEventListener?.('voiceschanged', pickVoice);
}

/** True while the TV is talking (or just finished), so a microphone can ignore its own coach. */
export const speakingRecently = () => (synth ? synth.speaking : false) || Date.now() - lastSpokeEnd < 800;

export const setVoiceEnabled = (on: boolean) => {
  enabled = on;
  if (!on) {
    synth?.cancel();
    Speech.stop();
  }
};

export function say(text: string) {
  if (!enabled || !text) return;
  try {
    if (synth && typeof SpeechSynthesisUtterance !== 'undefined') {
      synth.cancel(); // the newest cue wins; never queue stale advice
      if (!bestVoice) pickVoice();
      const u = new SpeechSynthesisUtterance(text);
      try {
        if (bestVoice) u.voice = bestVoice as SpeechSynthesisVoice;
      } catch {
        // not a real voice object: keep the default
      }
      u.lang = bestVoice?.lang ?? 'en-US';
      u.rate = 1.0;
      u.pitch = 1.0;
      u.onend = () => {
        lastSpokeEnd = Date.now();
      };
      synth.speak(u);
      return;
    }
    Speech.stop(); // the newest cue wins; never queue stale advice
    Speech.speak(text, { rate: 1.0, pitch: 1.0, language: 'en-US', onDone: () => {
      lastSpokeEnd = Date.now();
    } });
  } catch {
    // no TTS engine available: captions still show the cue
  }
}

/** False when the device has no text-to-speech voice installed (common on emulators). */
export async function hasVoice(): Promise<boolean> {
  try {
    // Some engines never report their voice list; treat "no answer" as "no voice".
    const voices = await Promise.race([
      Speech.getAvailableVoicesAsync(),
      new Promise<never[]>((resolve) => setTimeout(() => resolve([]), 1500)),
    ]);
    return voices.length > 0;
  } catch {
    return false;
  }
}

export const isVoiceEnabled = () => enabled;
