import React, { useState } from 'react';
import { Pressable, Text, StyleSheet, View, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';

interface WorkoutCardProps {
  title: string;
  duration: string;
  difficulty: string;
  exerciseCount: number;
  onPress: () => void;
  style?: ViewStyle;
}

export const WorkoutCard: React.FC<WorkoutCardProps> = ({
  title,
  duration,
  difficulty,
  exerciseCount,
  onPress,
  style,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      style={({ pressed }) => [
        styles.card,
        isFocused && styles.focused,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Text style={styles.title}>{title}</Text>
      <View style={styles.metaContainer}>
        <Text style={styles.meta}>{duration}</Text>
        <Text style={styles.meta}>•</Text>
        <Text style={styles.meta}>{difficulty}</Text>
        <Text style={styles.meta}>•</Text>
        <Text style={styles.meta}>{exerciseCount} Exercises</Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    padding: 24,
    borderRadius: 16,
    marginVertical: 12,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  focused: {
    borderColor: colors.primary,
    transform: [{ scale: 1.02 }],
    backgroundColor: '#2a362a',
  },
  pressed: {
    opacity: 0.9,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  meta: {
    fontSize: 18,
    color: colors.textSecondary,
  },
});
