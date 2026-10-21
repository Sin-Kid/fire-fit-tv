// Spoken coaching cues. expo-speech uses Android's text-to-speech on Fire OS and
// the browser's speech synthesis on web.
import * as Speech from 'expo-speech';

let enabled = true;

export const setVoiceEnabled = (on: boolean) => {
  enabled = on;
  if (!on) Speech.stop();
};

export function say(text: string) {
  if (!enabled || !text) return;
  try {
    Speech.stop(); // the newest cue wins; never queue stale advice
    Speech.speak(text, { rate: 1.0, pitch: 1.0, language: 'en-US' });
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
