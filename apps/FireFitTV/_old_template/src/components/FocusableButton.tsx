import React, { useState } from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors } from '../theme/colors';

interface FocusableButtonProps {
  title: string;
  onPress: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
  isPrimary?: boolean;
}

export const FocusableButton: React.FC<FocusableButtonProps> = ({
  title,
  onPress,
  style,
  textStyle,
  isPrimary = true,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      style={({ pressed }) => [
        styles.button,
        isPrimary ? styles.primary : styles.secondary,
        isFocused && styles.focused,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          !isPrimary && styles.secondaryText,
          isFocused && styles.focusedText,
          textStyle,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginVertical: 8,
    borderWidth: 3,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.surface,
  },
  focused: {
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.05 }],
    elevation: 5,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  text: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
  },
  secondaryText: {
    color: colors.text,
  },
  focusedText: {
    // additional focused text styles if needed
  },
});
