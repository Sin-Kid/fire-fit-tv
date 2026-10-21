// TVs (Fire OS, Vega) have no webcam: the phone companion is the camera there.
// The browser build uses useLaptopCoach.web.ts instead (Metro picks it by platform).
import type { CueKind } from './formRules';
import type { formNotes } from './coachApi';

export type LaptopStatus = 'off' | 'starting' | 'live' | 'error';

export async function detectLaptopCamera(): Promise<boolean> {
  return false;
}

export function useLaptopCoach(_opts: {
  enabled: boolean;
  hostId: string;
  exercise: { name: string; key: string } | null;
  onCue: (text: string, kind: CueKind) => void;
}): { status: LaptopStatus; error: string | null; reps: number; notes: () => ReturnType<typeof formNotes> } {
  return { status: 'off', error: null, reps: 0, notes: () => [] };
}
