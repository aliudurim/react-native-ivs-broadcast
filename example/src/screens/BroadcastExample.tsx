import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  IvsBroadcastView,
  type CameraPreviewAspectMode,
  type IvsBroadcastViewHandle,
} from 'react-native-ivs-broadcast';
import { Button, Field, Row, Toggle } from '../components/Controls';
import { EventLog, useEventLog } from '../components/EventLog';
import { requestAVPermissions } from '../permissions';

const ASPECT_MODES: CameraPreviewAspectMode[] = ['fill', 'fit', 'none'];

export function BroadcastExample() {
  const ref = useRef<IvsBroadcastViewHandle>(null);
  const { entries, log, clear } = useEventLog();
  const [granted, setGranted] = useState<boolean | null>(null);
  const [rtmpsUrl, setRtmpsUrl] = useState('');
  const [streamKey, setStreamKey] = useState('');
  const [front, setFront] = useState(true);
  const [muted, setMuted] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [mirrored, setMirrored] = useState(true);
  const [aspect, setAspect] = useState(0);

  useEffect(() => {
    requestAVPermissions().then(setGranted);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.preview}>
        {granted !== null && (
          <IvsBroadcastView
            ref={ref}
            testID="broadcastView"
            style={StyleSheet.absoluteFill}
            rtmpsUrl={rtmpsUrl}
            streamKey={streamKey}
            cameraPosition={front ? 'front' : 'back'}
            cameraPreviewAspectMode={ASPECT_MODES[aspect]}
            isCameraPreviewMirrored={mirrored}
            isMuted={muted}
            isCameraEnabled={cameraEnabled}
            videoConfig={{
              width: 720,
              height: 1280,
              bitrate: 1_500_000,
              targetFrameRate: 30,
              keyframeInterval: 2,
              isAutoBitrate: true,
              autoBitrateProfile: 'fastIncrease',
              maxBitrate: 3_500_000,
              minBitrate: 300_000,
            }}
            onBroadcastStateChanged={(state, meta) =>
              log(
                'onBroadcastStateChanged',
                meta ? `${state} ${meta.sessionId}` : state
              )
            }
            onBroadcastError={(e) => log('onBroadcastError', e)}
            onError={(message) => log('onError', message)}
            onTransmissionStatisticsChanged={(s) =>
              log(
                'onTransmissionStatisticsChanged',
                `${s.networkHealth} ${s.broadcastQuality}`
              )
            }
          />
        )}
      </View>
      <ScrollView style={styles.controls} keyboardShouldPersistTaps="handled">
        <Row>
          <Field
            testID="rtmpsUrl"
            placeholder="rtmps://…global-contribute.live-video.net:443/app/"
            value={rtmpsUrl}
            onChangeText={setRtmpsUrl}
          />
        </Row>
        <Row>
          <Field
            testID="streamKey"
            placeholder="Stream key"
            value={streamKey}
            onChangeText={setStreamKey}
          />
        </Row>
        <Row>
          <Button
            testID="start"
            title="Start"
            onPress={() => ref.current?.start()}
          />
          <Button
            testID="stop"
            title="Stop"
            onPress={() => ref.current?.stop()}
          />
          <Button
            testID="aspect"
            title={`Aspect: ${ASPECT_MODES[aspect]}`}
            onPress={() => setAspect((a) => (a + 1) % ASPECT_MODES.length)}
          />
        </Row>
        <Row>
          <Toggle
            testID="front"
            label="Front"
            value={front}
            onValueChange={setFront}
          />
          <Toggle
            testID="muted"
            label="Muted"
            value={muted}
            onValueChange={setMuted}
          />
          <Toggle
            testID="camera"
            label="Camera"
            value={cameraEnabled}
            onValueChange={setCameraEnabled}
          />
          <Toggle
            testID="mirrored"
            label="Mirror"
            value={mirrored}
            onValueChange={setMirrored}
          />
        </Row>
      </ScrollView>
      <EventLog entries={entries} onClear={clear} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  preview: { flex: 3, backgroundColor: 'black' },
  controls: { flexGrow: 0, maxHeight: 220 },
});
