import { useEffect, useRef, useState } from 'react';
import { COACH_POLL_MS } from './config';
import { getCoachState, type CoachState } from './coachApi';

/**
 * Polls the pairing session while `code` is set. `onCue` fires once per new cue
 * from the phone (cues already present when polling starts are ignored).
 */
export function useFormCoach(
  code: string | null | undefined,
  onCue?: (text: string, kind: 'good' | 'fix' | 'info') => void,
  /** Fires once per new phrase from the voice remote. */
  onVoice?: (text: string) => void,
) {
  const [state, setState] = useState<CoachState | null>(null);
  const lastCueId = useRef<number | null>(null);
  const cueRef = useRef(onCue);
  const voiceRef = useRef(onVoice);
  const lastVoiceId = useRef<number | null>(null);
  useEffect(() => {
    cueRef.current = onCue;
    voiceRef.current = onVoice;
  });

  useEffect(() => {
    if (!code) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const s = await getCoachState(code);
        if (!alive) return;
        setState(s);
        const id = s.feedback?.id ?? 0;
        if (lastCueId.current === null) lastCueId.current = id;
        else if (s.feedback && id > lastCueId.current) {
          lastCueId.current = id;
          cueRef.current?.(s.feedback.text, s.feedback.kind);
        }
        const heard = s.voice ?? [];
        const newest = heard.length ? heard[heard.length - 1].id : 0;
        if (lastVoiceId.current === null) lastVoiceId.current = newest;
        else {
          for (const h of heard) if (h.id > lastVoiceId.current) voiceRef.current?.(h.text);
          lastVoiceId.current = Math.max(lastVoiceId.current, newest);
        }
      } catch {
        // keep polling; the TV keeps working without the phone
      }
      if (alive) timer = setTimeout(tick, COACH_POLL_MS);
    };
    tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [code]);

  return state;
}
