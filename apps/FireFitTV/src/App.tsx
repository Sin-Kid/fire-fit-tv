// FitCoach TV: AI-generated follow-along workouts for Fire TV.
// Rendered from the project root App.tsx.

import React, { useEffect, useState } from 'react';
import { BackHandler, StatusBar, StyleSheet, View } from 'react-native';
import { fetchWorkout } from './lib/api';
import { DEFAULT_PROFILE } from './lib/calories';
import { createCoachSession, type CoachSession } from './lib/coachApi';
import { FORM_CAMERA_ENABLED, VOICE_REMOTE_ENABLED } from './lib/config';
import { TvStage } from './components/TvStage';
import { colors } from './lib/theme';
import type { Profile, Workout, WorkoutRequest } from './lib/types';
import { LoadingScreen } from './screens/LoadingScreen';
import { PlayerScreen, type SessionStats } from './screens/PlayerScreen';
import { PreviewScreen } from './screens/PreviewScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { SetupScreen } from './screens/SetupScreen';
import { SummaryScreen } from './screens/SummaryScreen';

type Screen =
  | { name: 'profile' }
  | { name: 'setup' }
  | { name: 'loading' }
  | { name: 'preview' }
  | { name: 'player'; runId: number }
  | { name: 'summary'; stats: SessionStats };

export const App = () => {
  const [screen, setScreen] = useState<Screen>({ name: 'profile' });
  /** Body data for the calorie counter; asked for first, editable from the setup screen. */
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [profileSet, setProfileSet] = useState(false);
  const [request, setRequest] = useState<WorkoutRequest | undefined>();
  const [workout, setWorkout] = useState<Workout | undefined>();
  const [offline, setOffline] = useState(false);
  /** Pairing session for the phone form camera (null when the backend is unreachable). */
  const [coach, setCoach] = useState<CoachSession | null>(null);

  const generate = async (req: WorkoutRequest) => {
    setRequest(req);
    setScreen({ name: 'loading' });
    const [out, session] = await Promise.all([
      fetchWorkout(req),
      !(FORM_CAMERA_ENABLED || VOICE_REMOTE_ENABLED) ? Promise.resolve(null) : coach ? Promise.resolve(coach) : createCoachSession(),
    ]);
    setWorkout(out.workout);
    setOffline(out.offline);
    setCoach(session);
    setScreen({ name: 'preview' });
  };

  // Remote "Back" button: step back one screen instead of leaving the app.
  useEffect(() => {
    const sub = BackHandler?.addEventListener?.('hardwareBackPress', () => {
      switch (screen.name) {
        case 'profile':
          if (!profileSet) return false;
          setScreen({ name: 'setup' });
          return true;
        case 'preview':
        case 'summary':
          setScreen({ name: 'setup' });
          return true;
        case 'player':
          setScreen({ name: 'preview' });
          return true;
        default:
          return false; // let the system handle Back on the setup screen
      }
    });
    return () => sub?.remove?.();
  }, [screen.name, profileSet]);

  let content: React.ReactNode = null;
  switch (screen.name) {
    case 'profile':
      content = (
        <ProfileScreen
          initial={profile}
          onSave={(p) => {
            setProfile(p);
            setProfileSet(true);
            setScreen({ name: 'setup' });
          }}
        />
      );
      break;
    case 'setup':
      content = <SetupScreen onGenerate={generate} initial={request} profile={profile} onEditProfile={() => setScreen({ name: 'profile' })} />;
      break;
    case 'loading':
      content = <LoadingScreen request={request!} />;
      break;
    case 'preview':
      content = (
        <PreviewScreen
          workout={workout!}
          profile={profile}
          offline={offline}
          coach={coach}
          onStart={() => setScreen({ name: 'player', runId: Date.now() })}
          onRegenerate={() => request && generate(request)}
          onBack={() => setScreen({ name: 'setup' })}
        />
      );
      break;
    case 'player':
      content = (
        <PlayerScreen
          key={screen.runId}
          workout={workout!}
          profile={profile}
          coachCode={coach?.code ?? null}
          onFinish={(stats) => setScreen({ name: 'summary', stats })}
        />
      );
      break;
    case 'summary':
      content = (
        <SummaryScreen
          workout={workout!}
          stats={screen.stats}
          goal={request?.goal}
          coachCode={coach?.code ?? null}
          onAgain={() => setScreen({ name: 'player', runId: Date.now() })}
          onNew={() => setScreen({ name: 'setup' })}
        />
      );
      break;
  }

  return (
    <View style={styles.root}>
      <StatusBar hidden />
      <TvStage>{content}</TvStage>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
