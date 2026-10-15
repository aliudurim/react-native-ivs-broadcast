# Usage guide

This package has two independent surfaces:

| You want to… | Use |
| --- | --- |
| Push one camera + microphone to an IVS **channel** (viewers watch with the IVS player, a few seconds of latency) | [`IvsBroadcastView`](./ivs-broadcast-reference.md) |
| Put several people on screen together in an IVS **stage** (WebRTC, sub-second latency) | [`IvsStage`, `useIvsStage`, `IvsStageVideoView`](./ivs-stage-reference.md) |

Both can live in the same app. They can't hold the camera at the same time, so unmount the broadcast view before preparing stage media, and release stage media before mounting a broadcast view.

## Installing

```sh
yarn add react-native-ivs-broadcast
cd ios && pod install
```

The library needs the New Architecture (the default since React Native 0.76).

### What `pod install` does

AWS distributes the iOS Broadcast SDK as a zip from `broadcast.live-video.net`; it is no longer on CocoaPods. The `RNIvsBroadcast` podspec runs [`scripts/fetch-ios-sdk.sh`](../scripts/fetch-ios-sdk.sh), which:

1. downloads the xcframework pinned in this package's `package.json` (`ivsSdk.ios`)
2. checks its SHA-256, and fails the install if it doesn't match
3. unpacks it into `node_modules/react-native-ivs-broadcast/ios/Frameworks`

Later installs skip the download if that exact build is already present. CI caches that cache `node_modules` get this for free.

### Overriding the Amazon IVS SDK version

**Android**: set `ivsBroadcastSdkVersion` in your root `android/build.gradle`:

```groovy
buildscript {
  ext {
    ivsBroadcastSdkVersion = "1.48.0"
  }
}
```

**iOS**: set both environment variables when running `pod install`:

```sh
IVS_BROADCAST_SDK_URL=https://broadcast.live-video.net/1.48.0/AmazonIVSBroadcast-Stages.xcframework.zip \
IVS_BROADCAST_SDK_SHA256=<sha256 of that zip> \
pod install
```

`IVS_BROADCAST_SDK_URL` can also be a `file://` URL to a zip you downloaded yourself, which helps on air-gapped CI.

Only the versions in the [README table](../README.md#amazon-ivs-sdk-versions) are tested. Others usually work within the same minor line.

## Permissions

### iOS

Add the usage strings to `Info.plist`. iOS shows the prompt the first time the SDK opens the camera or microphone.

```xml
<key>NSCameraUsageDescription</key>
<string>The camera is used to broadcast live video.</string>
<key>NSMicrophoneUsageDescription</key>
<string>The microphone is used to broadcast live audio.</string>
```

### Android

The camera only opens if the runtime permissions were granted **before** the broadcast view mounts or `prepareLocalMedia()` runs:

```ts
import { PermissionsAndroid, Platform, type Permission } from 'react-native';

export async function requestAVPermissions() {
  if (Platform.OS !== 'android') return true;
  const wanted: Permission[] = [
    PermissionsAndroid.PERMISSIONS.CAMERA,
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
  ];
  if (Number(Platform.Version) >= 33) {
    wanted.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  }
  const result = await PermissionsAndroid.requestMultiple(wanted);
  return (
    result['android.permission.CAMERA'] === 'granted' &&
    result['android.permission.RECORD_AUDIO'] === 'granted'
  );
}
```

```tsx
const [granted, setGranted] = useState(false);
useEffect(() => {
  requestAVPermissions().then(setGranted);
}, []);

return granted ? <IvsBroadcastView {...props} /> : <PermissionPrompt />;
```

## Background behaviour

| | iOS | Android |
| --- | --- | --- |
| **Broadcast**, app backgrounded | With the `audio` background mode, the RTMPS connection stays up. Viewers see a black frame and hear live audio until you return. | A foreground service ("You're live" notification) keeps the camera, microphone and connection alive. |
| **Stage**, app backgrounded | The camera pauses (`videoMuted` becomes `true` for you) and the microphone stays live. Remote video is unsubscribed until you return, to save bandwidth. | A foreground service keeps camera, microphone and the stage connection alive while the screen is locked. |

iOS forbids camera capture in the background. Without the `audio` background mode, the SDK ends the broadcast when the app is backgrounded.

### Localizing the Android notification

The foreground-service notification uses two string resources. Override them in your app's `android/app/src/main/res/values/strings.xml` (and in `values-xx/` for each language):

```xml
<string name="ivs_broadcast_notification_channel">Live broadcast</string>
<string name="ivs_broadcast_notification_text">You\'re live</string>
```

## Broadcasting to a channel

### 1. Render the preview

```tsx
<IvsBroadcastView
  ref={broadcastRef}
  style={{ flex: 1 }}
  rtmpsUrl={ingestEndpoint}
  streamKey={streamKey}
  cameraPosition="front"
  isCameraPreviewMirrored
  cameraPreviewAspectMode="fill"
/>
```

The native session (camera + microphone) starts when the view mounts, so the preview appears immediately. Nothing is sent until you call `start()`.

`rtmpsUrl` is your channel's ingest endpoint with the `rtmps://` scheme and `:443/app/` suffix, e.g. `rtmps://a1b2c3d4e5f6.global-contribute.live-video.net:443/app/`.

### 2. Go live and stop

```ts
broadcastRef.current?.start();
// …
broadcastRef.current?.stop();
```

`start()` can also take credentials directly. That's useful when your backend creates the channel just before going live:

```ts
const { ingestEndpoint, streamKey } = await api.createStream();
broadcastRef.current?.start({
  rtmpsUrl: `rtmps://${ingestEndpoint}:443/app/`,
  streamKey,
});
```

### 3. Track state, errors and network health

```tsx
<IvsBroadcastView
  onBroadcastStateChanged={(state, meta) => {
    // INVALID → CONNECTING → CONNECTED → DISCONNECTED, or → ERROR
    if (state === 'CONNECTED') console.log('live, session', meta?.sessionId);
  }}
  onBroadcastError={(error) => {
    if (error.isFatal) showRetry(error.detail);
  }}
  onError={(message) => {
    // problems raised by this library: empty credentials, camera unavailable…
  }}
  onTransmissionStatisticsChanged={({ networkHealth, broadcastQuality }) => {
    setBadge(networkHealth === 'BAD' ? 'Poor connection' : null);
  }}
/>
```

### 4. Choose encoder settings

`videoConfig` is read once, when the view mounts. Change it with a `key` to remount:

```tsx
<IvsBroadcastView
  key={quality}
  videoConfig={
    quality === 'hd'
      ? { width: 1080, height: 1920, bitrate: 3_500_000, maxBitrate: 6_000_000 }
      : { width: 720, height: 1280, bitrate: 1_500_000, maxBitrate: 3_500_000 }
  }
/>
```

For IVS low-latency channels keep `keyframeInterval: 2` (the IVS requirement). Basic channels max out at 1.5 Mbps / 480p, Standard at 8.5 Mbps / 1080p.

### 5. Runtime controls

These props apply live, without reconnecting:

| Prop | Effect |
| --- | --- |
| `cameraPosition` | Swaps between front and back camera mid-broadcast. |
| `isMuted` | Silences the microphone (gain 0). Viewers hear silence. |
| `isCameraEnabled` | `false` detaches the camera hardware. Viewers see black video, audio continues. |
| `isCameraPreviewMirrored` / `cameraPreviewAspectMode` | Local preview only. |

## Joining a Real-Time Stage

A stage participant needs a **participant token** created by your backend with [`CreateParticipantToken`](https://docs.aws.amazon.com/ivs/latest/RealTimeAPIReference/API_CreateParticipantToken.html). Add a `display_name` attribute to the token, and the camera-off card shows that person's initials.

```tsx
import { IvsStageVideoView, useIvsStage } from 'react-native-ivs-broadcast';

function StageScreen({ token }: { token: string }) {
  const stage = useIvsStage();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await stage.prepareLocalMedia({ cameraPosition: 'front' });
      if (!cancelled) await stage.joinStage(token);
    })().catch((e) => console.warn(e.message));
    return () => {
      cancelled = true;
      stage.leaveStage().then(() => stage.releaseLocalMedia());
    };
  }, [token]);

  const remotes = Object.values(stage.participants).filter((p) => !p.isLocal);

  return (
    <>
      <IvsStageVideoView style={styles.self} mirrored />
      {remotes.map((p) => (
        <View key={p.participantId} style={styles.tile}>
          {p.hasVideo && !p.videoMuted ? (
            <IvsStageVideoView participantId={p.participantId} style={StyleSheet.absoluteFill} />
          ) : (
            <Avatar name={p.attributes.display_name} />
          )}
          {p.audioMuted && <MutedIcon />}
        </View>
      ))}
    </>
  );
}
```

### Lifecycle

1. `prepareLocalMedia()` opens the camera and microphone. `<IvsStageVideoView />` (no `participantId`) shows your preview right away, before you have a token.
2. `joinStage(token)` resolves once the join *starts*. Watch `connection` go `connecting` → `connected`.
3. While connected you always publish. Turning the camera off with `setCameraEnabled(false)` publishes a card with your initials in place of the camera, so other people's layouts don't jump.
4. `leaveStage()` then `releaseLocalMedia()` when the screen goes away.

### Handling disconnects

`useIvsStage().lastError` holds the most recent error. Fatal disconnects (kicked, token revoked, stage deleted) come through as `connection: 'disconnected'` with `lastError.isFatal === true`. The SDK will not reconnect, so fetch a new token and call `joinStage` again. Network drops reconnect on their own, and `lastError` resets to `null` once `connected` comes back.

### Using the state outside React

`useIvsStage` reads from `stageStore`, which you can also subscribe to directly, for example from Redux middleware or analytics:

```ts
import { stageStore } from 'react-native-ivs-broadcast';

const unsubscribe = stageStore.subscribe(() => {
  const { connection, participants } = stageStore.getState();
  analytics.track('stage', { connection, size: Object.keys(participants).length });
});
```

Treat it as read-only: native events drive it. `reduceStage` and `createStageStore` are exported too, so you can replay recorded events in unit tests.

## Testing your app with Jest

Importing the package never touches native code, so component tests that render your screens work without mocks. Mock the native views if you want to assert on props:

```ts
jest.mock('react-native-ivs-broadcast', () => {
  const { View } = require('react-native');
  return {
    IvsBroadcastView: View,
    IvsStageVideoView: View,
    useIvsStage: () => ({
      connection: 'disconnected',
      localParticipantId: null,
      participants: {},
      lastError: null,
      prepareLocalMedia: jest.fn(() => Promise.resolve()),
      joinStage: jest.fn(() => Promise.resolve()),
      leaveStage: jest.fn(() => Promise.resolve()),
      releaseLocalMedia: jest.fn(() => Promise.resolve()),
      setMicMuted: jest.fn(),
      setCameraEnabled: jest.fn(),
      setCameraPosition: jest.fn(),
      setDisplayName: jest.fn(),
    }),
  };
});
```
