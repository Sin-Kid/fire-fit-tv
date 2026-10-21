// The browser build's own microphone (Web Speech API). Fire OS and Vega apps don't
// get a microphone, so on those the voice remote page plays this role instead.
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

type Rec = { lang: string; continuous: boolean; interimResults: boolean; start(): void; stop(): void; onresult: ((e: any) => void) | null; onend: (() => void) | null; onerror: ((e: any) => void) | null };

function recognizer(): (new () => Rec) | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const webMicAvailable = () => !!recognizer();

/** Listens while `on` is true and calls onHeard with each final phrase. */
export function useWebMic(on: boolean, onHeard: (text: string) => void) {
  const cb = useRef(onHeard);
  useEffect(() => {
    cb.current = onHeard;
  });
  useEffect(() => {
    const SR = recognizer();
    if (!on || !SR) return;
    let alive = true;
    const rec = new SR();
    rec.lang = 'en-US';
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) cb.current(String(e.results[i][0].transcript));
    };
    rec.onerror = () => undefined;
    rec.onend = () => {
      if (alive) try { rec.start(); } catch { /* already running */ }
    };
    try { rec.start(); } catch { /* ignore */ }
    return () => {
      alive = false;
      try { rec.stop(); } catch { /* ignore */ }
    };
  }, [on]);
}
