# Migration guides

## From `amazon-ivs-react-native-broadcast`

[`amazon-ivs-react-native-broadcast`](https://www.npmjs.com/package/amazon-ivs-react-native-broadcast) is a community package for the old architecture. This package keeps its component and ref names as aliases, so most apps only change the import:

```diff
- import { IVSBroadcastCameraView, type IIVSBroadcastCameraView } from 'amazon-ivs-react-native-broadcast';
+ import { IVSBroadcastCameraView, type IIVSBroadcastCameraView } from 'react-native-ivs-broadcast';
```

New code should use the primary names: `IvsBroadcastView` and `IvsBroadcastViewHandle`.

### Steps

1. Enable the New Architecture if you haven't (default since React Native 0.76).
2. `yarn remove amazon-ivs-react-native-broadcast && yarn add react-native-ivs-broadcast`
3. `cd ios && pod install`. The first run downloads the IVS SDK (see the [usage guide](./usage-guide.md#what-pod-install-does)).
4. Apply the differences below.

### Differences

| `amazon-ivs-react-native-broadcast` | `react-native-ivs-broadcast` |
| --- | --- |
| `videoConfig` / `audioConfig` applied at init | `videoConfig` applied at mount; remount (change `key`) to apply new values. Audio uses the SDK defaults |
| `start()` / `stop()` on the ref | Same. `start()` also accepts `{ rtmpsUrl, streamKey }` |
| `onBroadcastStateChanged(state, metadata)` | Same signature |
| `onBroadcastError(error)` | Same shape (`code` is a string) |
| `onError(message)` | Same |
| `onTransmissionStatisticsChanged` | Same fields |
| `isMuted`, `cameraPosition`, `isCameraPreviewMirrored`, `cameraPreviewAspectMode` | Same |
| — | **New:** `isCameraEnabled` (camera off without ending the stream) |
| — | **New:** Real-Time Stages (`useIvsStage`, `IvsStageVideoView`) |
| Callbacks for audio stats / device changes | Not exposed. Open an issue if you need them |

## Upgrading the Amazon IVS SDK

The pinned SDK versions live in `package.json` → `ivsSdk`. To move this package to a new SDK release:

1. Read the IVS release notes for [iOS](https://docs.aws.amazon.com/ivs/latest/LowLatencyUserGuide/release-notes.html) and Android.
2. Update `ivsSdk.android` and `ivsSdk.ios.version` / `url`.
3. Download the iOS zip and set `ivsSdk.ios.sha256` to `shasum -a 256 AmazonIVSBroadcast-Stages.xcframework.zip`.
4. `rm -rf ios/Frameworks && yarn pods`, then build both example apps and run the e2e suites.
5. Update the version table in the README.
