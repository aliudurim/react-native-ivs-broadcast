import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

export function Row({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

export function Button({
  title,
  testID,
  onPress,
}: {
  title: string;
  testID: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text style={styles.buttonText}>{title}</Text>
    </Pressable>
  );
}

export function Toggle({
  label,
  testID,
  value,
  onValueChange,
}: {
  label: string;
  testID: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.toggle}>
      <Text style={styles.label}>{label}</Text>
      <Switch testID={testID} value={value} onValueChange={onValueChange} />
    </View>
  );
}

export function Field({
  placeholder,
  testID,
  value,
  onChangeText,
}: {
  placeholder: string;
  testID: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <TextInput
      testID={testID}
      placeholder={placeholder}
      placeholderTextColor="#888"
      autoCapitalize="none"
      autoCorrect={false}
      value={value}
      onChangeText={onChangeText}
      style={styles.field}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  button: {
    backgroundColor: '#1f6feb',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  pressed: { opacity: 0.6 },
  buttonText: { color: 'white', fontWeight: '600' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { color: '#222' },
  field: {
    flexGrow: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#999',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: '#111',
  },
});
