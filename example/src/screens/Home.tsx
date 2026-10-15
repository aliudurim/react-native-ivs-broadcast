import { Pressable, StyleSheet, Text, View } from 'react-native';

export type Route = 'Home' | 'Broadcast' | 'Stage';

const EXAMPLES: { route: Route; title: string; description: string }[] = [
  {
    route: 'Broadcast',
    title: 'Broadcast (RTMPS)',
    description: 'Camera + microphone pushed to an IVS low-latency channel.',
  },
  {
    route: 'Stage',
    title: 'Real-Time Stage',
    description:
      'Join an IVS stage, publish your camera, render other participants.',
  },
];

export function Home({ navigate }: { navigate: (route: Route) => void }) {
  return (
    <View style={styles.container}>
      {EXAMPLES.map((e) => (
        <Pressable
          key={e.route}
          testID={e.route}
          style={styles.card}
          onPress={() => navigate(e.route)}
        >
          <Text style={styles.title}>{e.title}</Text>
          <Text style={styles.description}>{e.description}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, gap: 12 },
  card: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  title: { fontSize: 17, fontWeight: '600', color: '#111' },
  description: { marginTop: 4, color: '#555' },
});
