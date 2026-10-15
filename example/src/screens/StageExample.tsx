import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { IvsStageVideoView, useIvsStage } from 'react-native-ivs-broadcast';
import { Button, Field, Row, Toggle } from '../components/Controls';
import { EventLog, useEventLog } from '../components/EventLog';
import { requestAVPermissions } from '../permissions';

export function StageExample() {
  const stage = useIvsStage();
  const { entries, log, clear } = useEventLog();
  const [token, setToken] = useState('');
  const [micMuted, setMicMuted] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [front, setFront] = useState(true);

  const { connection, lastError, participants } = stage;
  useEffect(() => log('connection', connection), [connection, log]);
  useEffect(() => {
    if (lastError) log('lastError', lastError);
  }, [lastError, log]);

  useEffect(
    () => () => {
      stage.leaveStage().then(() => stage.releaseLocalMedia());
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const run = (name: string, action: () => Promise<void>) =>
    action().then(
      () => log(name, 'ok'),
      (e: Error) => log(name, `error ${e.message}`)
    );

  const remotes = Object.values(participants).filter((p) => !p.isLocal);

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        <View style={styles.tile}>
          <IvsStageVideoView
            testID="localVideo"
            style={StyleSheet.absoluteFill}
            mirrored={front}
          />
          <Text style={styles.badge}>You</Text>
        </View>
        {remotes.map((p) => (
          <View key={p.participantId} style={styles.tile}>
            <IvsStageVideoView
              participantId={p.participantId}
              style={StyleSheet.absoluteFill}
              aspectMode="fit"
            />
            <Text style={styles.badge}>
              {p.attributes.display_name ?? p.userId} {p.audioMuted ? '🔇' : ''}
            </Text>
          </View>
        ))}
      </View>
      <Text testID="participantCount" style={styles.status}>
        {connection} · {remotes.length} remote participant(s)
      </Text>
      <ScrollView style={styles.controls} keyboardShouldPersistTaps="handled">
        <Row>
          <Field
            testID="stageToken"
            placeholder="Participant token"
            value={token}
            onChangeText={setToken}
          />
        </Row>
        <Row>
          <Button
            testID="prepare"
            title="Prepare"
            onPress={async () => {
              if (await requestAVPermissions())
                run('prepareLocalMedia', () => stage.prepareLocalMedia());
              else log('prepareLocalMedia', 'error permissions denied');
            }}
          />
          <Button
            testID="join"
            title="Join"
            onPress={() => run('joinStage', () => stage.joinStage(token))}
          />
          <Button
            testID="leave"
            title="Leave"
            onPress={() => run('leaveStage', stage.leaveStage)}
          />
          <Button
            testID="release"
            title="Release"
            onPress={() => run('releaseLocalMedia', stage.releaseLocalMedia)}
          />
        </Row>
        <Row>
          <Toggle
            testID="micMuted"
            label="Mic muted"
            value={micMuted}
            onValueChange={(v) => {
              setMicMuted(v);
              stage.setMicMuted(v);
            }}
          />
          <Toggle
            testID="stageCamera"
            label="Camera"
            value={cameraEnabled}
            onValueChange={(v) => {
              setCameraEnabled(v);
              stage.setCameraEnabled(v);
            }}
          />
          <Toggle
            testID="stageFront"
            label="Front"
            value={front}
            onValueChange={(v) => {
              setFront(v);
              stage.setCameraPosition(v ? 'front' : 'back');
            }}
          />
        </Row>
      </ScrollView>
      <EventLog entries={entries} onClear={clear} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  grid: {
    flex: 3,
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: 'black',
  },
  tile: { width: '50%', height: '50%', borderWidth: 1, borderColor: '#222' },
  badge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    color: 'white',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 4,
  },
  status: { paddingHorizontal: 12, paddingVertical: 4 },
  controls: { flexGrow: 0, maxHeight: 200 },
});
