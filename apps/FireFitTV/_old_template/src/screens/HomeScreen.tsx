import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { FocusableButton } from '../components/FocusableButton';
import { WorkoutCard } from '../components/WorkoutCard';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RootStackParamList = {
  Home: undefined;
  Workout: undefined;
  Pairing: undefined;
};

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

interface Props {
  navigation: HomeScreenNavigationProp;
}

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>Fire-Fit</Text>
        <Text style={styles.status}>Phone Status: Disconnected</Text>
      </View>

      <Text style={styles.heading}>Your fitness, reimagined.</Text>
      <Text style={styles.description}>
        Guided workouts with real-time posture tracking right on your TV.
      </Text>

      <View style={styles.content}>
        <View style={styles.actions}>
          <FocusableButton
            title="Start Workout"
            onPress={() => navigation.navigate('Workout')}
          />
          <FocusableButton
            title="Connect Phone"
            isPrimary={false}
            onPress={() => console.log('Connect phone (Placeholder)')}
          />
        </View>

        <View style={styles.featured}>
          <Text style={styles.featuredTitle}>Featured</Text>
          <WorkoutCard
            title="Full Body Basics"
            duration="15 min"
            difficulty="Beginner"
            exerciseCount={5}
            onPress={() => navigation.navigate('Workout')}
          />
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    fontSize: 42,
    fontWeight: 'bold',
    color: colors.primary,
  },
  status: {
    fontSize: 20,
    color: colors.textSecondary,
  },
  heading: {
    fontSize: 64,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  description: {
    fontSize: 28,
    color: colors.textSecondary,
    marginBottom: 60,
  },
  content: {
    flexDirection: 'row',
    flex: 1,
  },
  actions: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: 40,
  },
  featured: {
    flex: 1.5,
    justifyContent: 'center',
  },
  featuredTitle: {
    fontSize: 24,
    color: colors.textSecondary,
    marginBottom: 16,
  },
});
