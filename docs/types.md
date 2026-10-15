# Types

All types are exported from the package root:

```ts
import type { IVideoConfig, StageParticipant } from 'react-native-ivs-broadcast';
```

## Broadcast

### StateStatusUnion

```ts
type StateStatusUnion = 'INVALID' | 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';
```

### IVideoConfig

```ts
interface IVideoConfig {
  width?: number;
  height?: number;
  bitrate?: number;
  targetFrameRate?: number;
  keyframeInterval?: 1 | 2 | 3 | 4 | 5;
  isBFrames?: boolean;
  isAutoBitrate?: boolean;
  autoBitrateProfile?: 'conservative' | 'fastIncrease';
  maxBitrate?: number;
  minBitrate?: number;
}
```

### IBroadcastSessionError

```ts
interface IBroadcastSessionError {
  code: string;
  type: string;
  source: string;
  detail: string;
  isFatal: boolean;
  sessionId: string;
}
```

### ITransmissionStatistics

```ts
interface ITransmissionStatistics {
  rtt: number;
  measuredBitrate: number;
  recommendedBitrate: number;
  networkHealth: NetworkHealth;
  broadcastQuality: BroadcastQuality;
}

type NetworkHealth = 'EXCELLENT' | 'HIGH' | 'MEDIUM' | 'LOW' | 'BAD';
type BroadcastQuality = 'NEAR_MAXIMUM' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NEAR_MINIMUM';
```

### StateChangedMetadata

```ts
interface StateChangedMetadata {
  sessionId: string;
}
```

### CameraPosition, CameraPreviewAspectMode, AutomaticBitrateProfile

```ts
type CameraPosition = 'front' | 'back';
type CameraPreviewAspectMode = 'fit' | 'fill' | 'none';
type AutomaticBitrateProfile = 'conservative' | 'fastIncrease';
```

### IvsBroadcastViewHandle

```ts
interface IvsBroadcastViewHandle {
  start(options?: { rtmpsUrl?: string; streamKey?: string }): void;
  stop(): void;
}
```

## Stage

### StageState

```ts
interface StageState {
  connection: StageConnectionState;
  localParticipantId: string | null;
  participants: Record<string, StageParticipant>;
  lastError: StageError | null;
}

type StageConnectionState = 'disconnected' | 'connecting' | 'connected';
```

### StageParticipant

```ts
interface StageParticipant {
  participantId: string;
  userId: string;
  isLocal: boolean;
  attributes: Record<string, string>;
  publishState: PublishState;
  subscribeState: SubscribeState;
  hasVideo: boolean;
  hasAudio: boolean;
  videoMuted: boolean;
  audioMuted: boolean;
}

type PublishState = 'notPublished' | 'attemptingPublish' | 'published';
type SubscribeState = 'notSubscribed' | 'attemptingSubscribe' | 'subscribed';
```

### StageError

```ts
interface StageError {
  code: number;
  message: string;
  isFatal: boolean;
}
```

### PrepareLocalMediaOptions

```ts
interface PrepareLocalMediaOptions {
  cameraPosition?: CameraPosition; // 'front'
  width?: number; // 720
  height?: number; // 1280
  targetFrameRate?: number; // 30
  maxBitrate?: number; // 2_000_000
  minBitrate?: number; // 400_000
}
```

### StageEvent

The events `reduceStage` accepts. You only need these to replay events in tests.

```ts
type StageEvent =
  | { type: 'snapshot'; state: Omit<StageState, 'lastError'> }
  | { type: 'connection'; state: StageConnectionState; error: StageError | null }
  | { type: 'joined'; participant: StageParticipant }
  | { type: 'left'; participantId: string }
  | { type: 'publishState'; participantId: string; state: PublishState }
  | { type: 'subscribeState'; participantId: string; state: SubscribeState }
  | { type: 'media'; participantId: string; hasVideo: boolean; hasAudio: boolean; videoMuted: boolean; audioMuted: boolean }
  | { type: 'error'; error: StageError };
```
