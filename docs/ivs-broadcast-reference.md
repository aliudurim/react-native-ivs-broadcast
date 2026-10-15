# `IvsBroadcastView` reference

A camera preview that broadcasts the device camera and microphone to an Amazon IVS channel over RTMPS. It wraps `IVSBroadcastSession` (iOS) and `BroadcastSession` (Android).

Amazon IVS documentation:

- [Low-latency streaming: Broadcast SDK guide](https://docs.aws.amazon.com/ivs/latest/LowLatencyUserGuide/broadcast.html)
- [iOS SDK reference](https://aws.github.io/amazon-ivs-broadcast-docs/latest/ios/)
- [Android SDK reference](https://aws.github.io/amazon-ivs-broadcast-docs/latest/android/)

```tsx
import { IvsBroadcastView } from 'react-native-ivs-broadcast';

<IvsBroadcastView
  style={{ flex: 1 }}
  rtmpsUrl="rtmps://a1b2c3d4e5f6.global-contribute.live-video.net:443/app/"
  streamKey="sk_us-west-2_abcd1234"
/>;
```

The native session starts when the view **mounts** (so the preview appears at once) and is torn down when it **unmounts**. The device does not sleep while a broadcast view is mounted. Only one broadcast view should be mounted at a time.

## Props

### style _(optional)_

Style of the preview container.

type: `StyleProp<ViewStyle>`

### testID _(optional)_

type: `string`

### rtmpsUrl _(optional)_

The channel's ingest endpoint, including scheme, port and the `/app/` path. Used by `start()` when it is called without arguments.

type: `string`
example: `rtmps://a1b2c3d4e5f6.global-contribute.live-video.net:443/app/`

### streamKey _(optional)_

The channel's stream key. Used by `start()` when it is called without arguments. Treat it as a secret.

type: `string`

### videoConfig _(optional)_

Encoder settings. **Read once, when the view mounts.** Remount the view (e.g. change its `key`) to apply new values. Any field left out uses the SDK default.

type: [`IVideoConfig`](./types.md#ivideoconfig)

| Field | Notes |
| --- | --- |
| `width`, `height` | Output resolution in pixels. Must be set together. |
| `bitrate` | Initial bitrate in bps. With auto-bitrate the encoder starts here. |
| `targetFrameRate` | Frames per second. |
| `keyframeInterval` | `1`–`5` seconds. Use `2` for IVS low-latency channels. |
| `isBFrames` | Enables B-frames. |
| `isAutoBitrate` | Lets the SDK adapt bitrate to the network. |
| `autoBitrateProfile` | `'conservative'` or `'fastIncrease'`. |
| `maxBitrate`, `minBitrate` | Bounds for auto-bitrate, in bps. |

### cameraPosition _(optional)_

Which camera to use. Changing it while live swaps cameras without reconnecting.

default: `'back'`
type: `'front' | 'back'`

### cameraPreviewAspectMode _(optional)_

How the preview fits the view. Affects the local preview only.

default: `'none'`
type: `'fit' | 'fill' | 'none'`

### isCameraPreviewMirrored _(optional)_

Mirrors the local preview. The broadcast itself is never mirrored.

default: `false`
type: `boolean`

### isMuted _(optional)_

Silences the microphone. Viewers hear silence; the connection is unaffected.

default: `false`
type: `boolean`

### isCameraEnabled _(optional)_

`false` detaches the camera (the hardware turns off). Viewers see black video and audio continues. `true` reattaches it.

default: `true`
type: `boolean`

## Callbacks

### onBroadcastStateChanged _(optional)_

Called on every session state change. `metadata.sessionId` is present on `CONNECTED`; include it when you contact AWS support.

type: `(state: StateStatusUnion, metadata?: { sessionId: string }) => void`

Typical sequence: `CONNECTING` → `CONNECTED` → (`stop()`) → `DISCONNECTED`. A failure goes `CONNECTING` → `ERROR` → `DISCONNECTED`, with an `onBroadcastError` in between.

### onBroadcastError _(optional)_

Errors reported by the IVS SDK (network, ingest, encoder, devices).

type: `(error: IBroadcastSessionError) => void`

| Field | Description |
| --- | --- |
| `code` | SDK error code, as a string (e.g. `"214"` for an unresolvable host) |
| `type` | Error domain (iOS) or error name (Android) |
| `source` | Component that raised the error, e.g. `"Net"` |
| `detail` | Human-readable description |
| `isFatal` | `true` means the session ended. Call `start()` to try again |
| `sessionId` | Session the error belongs to, or `"unknown"` |

### onError _(optional)_

Errors raised by this library rather than the SDK: `start()` without credentials, a camera that can't be opened, an invalid `videoConfig`.

type: `(message: string) => void`

### onTransmissionStatisticsChanged _(optional)_

Network health while connected, roughly once a second.

type: `(statistics: ITransmissionStatistics) => void`

| Field | Description |
| --- | --- |
| `rtt` | Round-trip time to the ingest server, in ms |
| `measuredBitrate` | Bitrate currently being sent, bps |
| `recommendedBitrate` | Bitrate the SDK would like to send, bps |
| `networkHealth` | `'EXCELLENT' \| 'HIGH' \| 'MEDIUM' \| 'LOW' \| 'BAD'` |
| `broadcastQuality` | `'NEAR_MAXIMUM' \| 'HIGH' \| 'MEDIUM' \| 'LOW' \| 'NEAR_MINIMUM'` |

## Ref methods

```tsx
const ref = useRef<IvsBroadcastViewHandle>(null);
<IvsBroadcastView ref={ref} />;
```

### start

Starts sending to IVS. Values you leave out fall back to the `rtmpsUrl` / `streamKey` props. Calling it with neither reports `onError("'rtmpsUrl' is empty.")`.

type: `(options?: { rtmpsUrl?: string; streamKey?: string }) => void`

### stop

Stops sending. The preview keeps running, so you can `start()` again.

type: `() => void`

## Compatibility aliases

For apps moving from `amazon-ivs-react-native-broadcast`:

| Alias | Same as |
| --- | --- |
| `IVSBroadcastCameraView` | `IvsBroadcastView` |
| `IIVSBroadcastCameraView` (type) | `IvsBroadcastViewHandle` |

See the [migration guide](./migration-guides.md).
