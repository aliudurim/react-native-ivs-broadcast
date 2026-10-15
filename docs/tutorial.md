# Tutorial: a "go live" screen

We'll build a screen that:

- asks for camera and microphone permission
- shows a full-screen camera preview
- gets ingest credentials from your backend and goes live
- shows connection state, a network-health badge and errors
- has mute, flip-camera and camera-off buttons

You'll need an IVS **channel** (low-latency). Create one in the [IVS console](https://console.aws.amazon.com/ivs/) and note its *ingest server* and *stream key*. In production your backend hands these to the app.

## 1. Permissions first

On Android the camera must be granted before the preview mounts. Render nothing until permissions resolve:

```tsx
import { useEffect, useState } from 'react';
import { PermissionsAndroid, Platform, Text } from 'react-native';

function usePermissions() {
  const [granted, setGranted] = useState<boolean | null>(null);
  useEffect(() => {
    if (Platform.OS !== 'android') return setGranted(true);
    PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.CAMERA,
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    ]).then((r) =>
      setGranted(Object.values(r).every((v) => v === 'granted'))
    );
  }, []);
  return granted;
}
```

## 2. The preview

```tsx
import { StyleSheet, View } from 'react-native';
import { IvsBroadcastView } from 'react-native-ivs-broadcast';

export function GoLiveScreen() {
  const granted = usePermissions();
  if (granted === null) return null;
  if (!granted) return <Text>Camera and microphone access are needed to go live.</Text>;

  return (
    <View style={styles.container}>
      <IvsBroadcastView
        style={StyleSheet.absoluteFill}
        cameraPosition="front"
        cameraPreviewAspectMode="fill"
        isCameraPreviewMirrored
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
});
```

Run the app and the preview appears. The session is running but nothing is being sent yet.

## 3. Encoder settings

Portrait 720p with adaptive bitrate is a good default for phones. `keyframeInterval: 2` is required by IVS low-latency channels.

```tsx
const VIDEO = {
  width: 720,
  height: 1280,
  bitrate: 1_500_000,
  targetFrameRate: 30,
  keyframeInterval: 2,
  isAutoBitrate: true,
  maxBitrate: 3_500_000,
  minBitrate: 300_000,
} as const;

<IvsBroadcastView videoConfig={VIDEO} /* … */ />;
```

## 4. Going live

Keep a ref to the view and call `start()` with the credentials:

```tsx
import { useRef, useState } from 'react';
import type {
  IvsBroadcastViewHandle,
  StateStatusUnion,
} from 'react-native-ivs-broadcast';

const broadcast = useRef<IvsBroadcastViewHandle>(null);
const [state, setState] = useState<StateStatusUnion>('DISCONNECTED');

async function goLive() {
  const { ingestServer, streamKey } = await fetch('https://api.example.com/live', {
    method: 'POST',
  }).then((r) => r.json());
  broadcast.current?.start({
    rtmpsUrl: `rtmps://${ingestServer}:443/app/`,
    streamKey,
  });
}

<IvsBroadcastView
  ref={broadcast}
  onBroadcastStateChanged={setState}
  /* … */
/>;
```

```tsx
{state === 'CONNECTED' ? (
  <Button title="End" onPress={() => broadcast.current?.stop()} />
) : (
  <Button title="Go live" onPress={goLive} disabled={state === 'CONNECTING'} />
)}
```

## 5. Errors and network health

```tsx
const [error, setError] = useState<string | null>(null);
const [health, setHealth] = useState<string | null>(null);

<IvsBroadcastView
  onBroadcastError={(e) => {
    if (e.isFatal) setError(`Stream ended: ${e.detail}`);
  }}
  onError={setError}
  onTransmissionStatisticsChanged={(s) =>
    setHealth(s.networkHealth === 'LOW' || s.networkHealth === 'BAD' ? 'Weak connection' : null)
  }
  /* … */
/>;
```

A fatal error ends the session; offer a retry that calls `goLive()` again.

## 6. Controls

These props apply live, without reconnecting:

```tsx
const [front, setFront] = useState(true);
const [muted, setMuted] = useState(false);
const [cameraOn, setCameraOn] = useState(true);

<IvsBroadcastView
  cameraPosition={front ? 'front' : 'back'}
  isCameraPreviewMirrored={front}
  isMuted={muted}
  isCameraEnabled={cameraOn}
  /* … */
/>

<Button title="Flip" onPress={() => setFront((f) => !f)} />
<Button title={muted ? 'Unmute' : 'Mute'} onPress={() => setMuted((m) => !m)} />
<Button title={cameraOn ? 'Camera off' : 'Camera on'} onPress={() => setCameraOn((c) => !c)} />
```

## 7. Background

- **iOS**: add the `audio` background mode (see the [usage guide](./usage-guide.md#background-behaviour)). Viewers keep hearing you while the app is in the background.
- **Android**: nothing to do. The library runs a foreground service while you're live.

## 8. Watch it

Open the channel in the IVS console's *Live stream* tab, or play the channel's playback URL with [`amazon-ivs-react-native-player`](https://github.com/aws/amazon-ivs-react-native-player).

The full working version of this screen is in [`example/src/screens/BroadcastExample.tsx`](../example/src/screens/BroadcastExample.tsx).
