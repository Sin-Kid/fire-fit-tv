// Vega build: Vega OS has no text-to-speech library for React Native apps, so the
// player shows every coaching line as an on-screen caption instead (see PlayerScreen).
// Same API as the Fire OS version (expo-speech), so the screens are identical.

let enabled = true;

export const setVoiceEnabled = (on: boolean) => {
  enabled = on;
};

export function say(_text: string) {
  // no speech engine on Vega
}

export async function hasVoice(): Promise<boolean> {
  return false;
}

export const isVoiceEnabled = () => enabled;

/** Nothing is ever spoken on Vega, so a microphone never needs to ignore the TV. */
export const speakingRecently = () => false;
