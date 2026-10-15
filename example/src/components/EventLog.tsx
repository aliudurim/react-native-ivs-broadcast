import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type Entry = { id: number; name: string; label: string };

let nextId = 0;

const describe = (value: unknown) =>
  value === undefined
    ? ''
    : typeof value === 'object'
      ? JSON.stringify(value)
      : String(value);

/**
 * Every entry renders with `testID={name}` and `accessibilityLabel="name ::: value"`,
 * which is what the Detox suites in /e2e match on.
 */
export function useEventLog() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const log = useCallback((name: string, value?: unknown) => {
    const label = `${name} ::: ${describe(value)}`.trim();
    console.log(label);
    setEntries((current) =>
      [{ id: nextId++, name, label }, ...current].slice(0, 100)
    );
  }, []);
  const clear = useCallback(() => setEntries([]), []);
  return { entries, log, clear };
}

export function EventLog({
  entries,
  onClear,
}: {
  entries: Entry[];
  onClear: () => void;
}) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Events</Text>
        <Pressable testID="clearLogs" onPress={onClear} hitSlop={8}>
          <Text style={styles.clear}>Clear</Text>
        </Pressable>
      </View>
      <ScrollView testID="eventLog" style={styles.list}>
        {entries.map((e) => (
          <Text
            key={e.id}
            testID={e.name}
            accessibilityLabel={e.label}
            style={styles.entry}
          >
            {e.label}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111', padding: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between' },
  title: { color: '#aaa', fontWeight: '600' },
  clear: { color: '#4da3ff' },
  list: { marginTop: 4 },
  entry: { color: '#ddd', fontFamily: 'Menlo', fontSize: 11 },
});
