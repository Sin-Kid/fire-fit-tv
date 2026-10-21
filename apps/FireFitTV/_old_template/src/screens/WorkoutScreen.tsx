import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { FocusableButton } from '../components/FocusableButton';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RootStackParamList = {
  Home: undefined;
  Workout: undefined;
};

type WorkoutScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Workout'>;

interface Props {
  navigation: WorkoutScreenNavigationProp;
}

export const WorkoutScreen: React.FC<Props> = ({ navigation }) => {
  const [reps, setReps] = useState(0);
  const [formFeedback, setFormFeedback] = useState('Waiting');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Full Body Basics</Text>
        <Text style={styles.subtitle}>Current: Squats</Text>
      </View>

      <View style={styles.main}>
        <View style={styles.videoArea}>
          <Text style={styles.placeholderText}>Trainer Video Placeholder</Text>
        </View>

        <View style={styles.statsArea}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>REPS</Text>
            <Text style={styles.statValue}>{reps}</Text>
          </View>
          
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>FORM FEEDBACK</Text>
            <Text style={[styles.statValue, { fontSize: 32, color: colors.primary }]}>
              {formFeedback}
            </Text>
          </View>

          <View style={styles.statBox}>
            <Text style={styles.statLabel}>TIME</Text>
            <Text style={styles.statValue}>00:00</Text>
          </View>

          <View style={styles.actions}>
            <FocusableButton title="Pause" onPress={() => console.log('Pause')} style={styles.actionBtn} />
            <FocusableButton title="End Workout" isPrimary={false} onPress={() => navigation.goBack()} style={styles.actionBtn} />
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 60,
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.text,
  },
  subtitle: {
    fontSize: 28,
    color: colors.primary,
    marginTop: 8,
  },
  main: {
    flexDirection: 'row',
    flex: 1,
    gap: 40,
  },
  videoArea: {
    flex: 2,
    backgroundColor: '#000000',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  placeholderText: {
    color: colors.textSecondary,
    fontSize: 24,
  },
  statsArea: {
    flex: 1,
    justifyContent: 'space-between',
  },
  statBox: {
    backgroundColor: colors.surface,
    padding: 24,
    borderRadius: 16,
    marginBottom: 20,
  },
  statLabel: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 64,
    fontWeight: 'bold',
    color: colors.text,
  },
  actions: {
    marginTop: 'auto',
  },
  actionBtn: {
    marginBottom: 16,
  },
});
