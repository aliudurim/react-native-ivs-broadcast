# React Native IVS Broadcast

[![npm](https://img.shields.io/npm/v/react-native-ivs-broadcast.svg)](https://www.npmjs.com/package/react-native-ivs-broadcast)
[![CI](https://github.com/aliudurim/react-native-ivs-broadcast/actions/workflows/ci.yml/badge.svg)](https://github.com/aliudurim/react-native-ivs-broadcast/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/react-native-ivs-broadcast.svg)](./LICENSE)

Native bindings for the **Amazon IVS Broadcast SDK** on iOS and Android, built for the React Native **New Architecture** (Fabric + TurboModules).

- **Low-latency broadcasting**: push the device camera and microphone to an IVS channel over RTMPS, with adaptive bitrate, live transmission statistics and background audio.
- **Real-Time Stages**: join an IVS stage, publish your camera and microphone, and render every other participant's video, with a reactive participant list.

AWS publishes an official React Native [player](https://github.com/aws/amazon-ivs-react-native-player) but no broadcast SDK binding. This package fills that gap and follows the player's conventions.

| Android | iOS | New Architecture | Old Architecture | Expo Go |
| :-----: | :-: | :--------------: | :--------------: | :-----: |
| SDK >= 24 | >= 15.1 | ✅ required | ❌ | ❌ (use a dev build) |

> Not affiliated with or endorsed by Amazon Web Services. "Amazon IVS" is a trademark of Amazon.com, Inc. or its affiliates.

## Installation

```sh
npm install react-native-ivs-broadcast
# or
yarn add react-native-ivs-broadcast
# or
pnpm add react-native-ivs-broadcast
```

### iOS

```sh
cd ios && pod install
```

AWS no longer publishes `AmazonIVSBroadcast` to CocoaPods (the last pod is 1.38.0). On the first `pod install` the podspec downloads the pinned SDK xcframework (about 170 MB) from AWS, verifies its SHA-256 and vendors it. Later installs reuse it.

Add the camera and microphone usage descriptions to `Info.plist`. To keep broadcasting audio while the app is in the background, also enable the `audio` background mode:

```xml
<key>NSCameraUsageDescription</key>
<string>The camera is used to broadcast live video.</string>
<key>NSMicrophoneUsageDescription</key>
<string>The microphone is used to broadcast live audio.</string>
<key>UIBackgroundModes</key>
<array>
  <string>audio</string>
</array>
```

### Android

No extra build steps. The library declares the foreground service that keeps a broadcast alive while the screen is locked. Your app requests the runtime permissions before mounting a broadcast view or preparing stage media:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<!-- Android 13+: lets the "You're live" notification show -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

See the [usage guide](./docs/usage-guide.md#permissions) for a runtime-permission snippet, and for how to localize the notification.

## Usage

### Broadcast to an IVS channel

```tsx
import { useRef } from 'react';
import { Button, View } from 'react-native';
import {
  IvsBroadcastView,
  type IvsBroadcastViewHandle,
} from 'react-native-ivs-broadcast';

export function GoLive() {
  const broadcast = useRef<IvsBroadcastViewHandle>(null);

  return (
    <View style={{ flex: 1 }}>
      <IvsBroadcastView
        ref={broadcast}
        style={{ flex: 1 }}
        rtmpsUrl="rtmps://a1b2c3d4e5f6.global-contribute.live-video.net:443/app/"
        streamKey="sk_us-west-2_abcd1234"
        cameraPosition="front"
        isCameraPreviewMirrored
        videoConfig={{ width: 720, height: 1280, keyframeInterval: 2 }}
        onBroadcastStateChanged={(state) => console.log(state)}
        onBroadcastError={(error) => console.warn(error.detail)}
      />
      <Button title="Go live" onPress={() => broadcast.current?.start()} />
      <Button title="End" onPress={() => broadcast.current?.stop()} />
    </View>
  );
}
```

### Join a Real-Time Stage

```tsx
import { useEffect } from 'react';
import { View } from 'react-native';
import { IvsStageVideoView, useIvsStage } from 'react-native-ivs-broadcast';

export function Stage({ token }: { token: string }) {
  const stage = useIvsStage();

  useEffect(() => {
    stage.prepareLocalMedia().then(() => stage.joinStage(token));
    return () => {
      stage.leaveStage().then(() => stage.releaseLocalMedia());
    };
  }, [token]);

  const remotes = Object.values(stage.participants).filter((p) => !p.isLocal);

  return (
    <View style={{ flex: 1 }}>
      <IvsStageVideoView style={{ flex: 1 }} mirrored />
      {remotes.map((p) => (
        <IvsStageVideoView
          key={p.participantId}
          participantId={p.participantId}
          style={{ flex: 1 }}
        />
      ))}
    </View>
  );
}
```

## Documentation

- [Usage guide](./docs/usage-guide.md): setup, permissions, background behaviour, common recipes
- [Tutorial](./docs/tutorial.md): build a complete "go live" screen step by step
- [`IvsBroadcastView` reference](./docs/ivs-broadcast-reference.md): props, callbacks, ref methods
- [Stage reference](./docs/ivs-stage-reference.md): `IvsStage`, `useIvsStage`, `IvsStageVideoView`
- [Types](./docs/types.md)
- [Migration guides](./docs/migration-guides.md): from `amazon-ivs-react-native-broadcast`, and between SDK versions

## Example app

[`example/`](./example) has a broadcast screen and a stage screen that exercise every prop and method and log every event. The e2e suite drives those screens. See [CONTRIBUTING](./CONTRIBUTING.md#example-app) to run it.

## Amazon IVS SDK versions

| react-native-ivs-broadcast | Amazon IVS Broadcast SDK (iOS / Android) |
| :------------------------: | :--------------------------------------: |
| 0.1.x | 1.47.0 |

To pin a different SDK build, see [overriding the SDK version](./docs/usage-guide.md#overriding-the-amazon-ivs-sdk-version).

## Troubleshooting

- **`pod install` fails with "could not fetch the Amazon IVS Broadcast SDK"**: the machine needs network access to `broadcast.live-video.net` on the first install. Behind a proxy, download the zip yourself and point `IVS_BROADCAST_SDK_URL` at a `file://` URL.
- **Black preview on Android**: the camera permission was not granted before the view mounted. Request it first, then render `IvsBroadcastView`.
- **Broadcast drops when the app is backgrounded on iOS**: add the `audio` background mode. Viewers then get a black frame plus live audio until the app comes back to the foreground. iOS forbids camera capture in the background.
- **pnpm**: React Native autolinking needs a hoisted `node_modules`. Add `node-linker=hoisted` to `.npmrc`.

## Contributing

See the [contributing guide](CONTRIBUTING.md) to learn how to contribute to the repository and the development workflow.

## License

MIT. The Amazon IVS Broadcast SDK this package downloads is licensed separately by AWS under the [Amazon IVS SDK license](https://aws.amazon.com/service-terms/).
