import { useEffect, useState } from 'react';
import {
  BackHandler,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BroadcastExample } from './screens/BroadcastExample';
import { Home, type Route } from './screens/Home';
import { StageExample } from './screens/StageExample';

export default function App() {
  const [route, setRoute] = useState<Route>('Home');

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (route === 'Home') return false;
      setRoute('Home');
      return true;
    });
    return () => sub.remove();
  }, [route]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        {route !== 'Home' && (
          <Pressable
            testID="goBack"
            onPress={() => setRoute('Home')}
            hitSlop={12}
          >
            <Text style={styles.back}>‹ Back</Text>
          </Pressable>
        )}
        <Text style={styles.title}>
          {route === 'Home' ? 'IVS Broadcast examples' : route}
        </Text>
      </View>
      {route === 'Home' && <Home navigate={setRoute} />}
      {route === 'Broadcast' && <BroadcastExample />}
      {route === 'Stage' && <StageExample />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f2f2',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  back: { color: '#1f6feb', fontSize: 16 },
  title: { fontSize: 18, fontWeight: '700', color: '#111' },
});
