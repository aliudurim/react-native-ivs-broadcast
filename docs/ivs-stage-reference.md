# Real-Time Stage reference

APIs for [Amazon IVS Real-Time Streaming](https://docs.aws.amazon.com/ivs/latest/RealTimeUserGuide/what-is.html): join a stage, publish your camera and microphone, and render other participants.

The app process holds **one stage** at a time, and all three APIs below share it.

- [`IvsStage`](#ivsstage): imperative actions
- [`useIvsStage`](#useivsstage): reactive state plus the same actions
- [`IvsStageVideoView`](#ivsstagevideoview): renders one participant's video
- [`stageStore`](#stagestore): the store behind the hook

## `IvsStage`

```ts
import { IvsStage } from 'react-native-ivs-broadcast';
```

### prepareLocalMedia

Opens the camera and microphone and creates the streams you'll publish. The local preview (`<IvsStageVideoView />`) works as soon as this resolves, even before joining. Calling it again only applies a new `cameraPosition`.

Rejects if no camera or microphone is available (e.g. the iOS simulator has no camera) or the permissions were denied.

type: `(options?: PrepareLocalMediaOptions) => Promise<void>`

| Option | Default | Description |
| --- | --- | --- |
| `cameraPosition` | `'front'` | `'front' \| 'back'` |
| `width` | `720` | Published video width |
| `height` | `1280` | Published video height |
| `targetFrameRate` | `30` | |
| `maxBitrate` | `2_000_000` | bps |
| `minBitrate` | `400_000` | bps |

Simulcast is always on, so viewers on poor networks get a lower layer.

### releaseLocalMedia

Stops the camera and microphone. Call it after `leaveStage()` when the stage screen goes away.

type: `() => Promise<void>`

### joinStage

Joins the stage the token belongs to. Resolves when the join **starts**; follow `connection` for progress. Rejects for a malformed or expired token. Joining while already in a stage leaves the old one first.

You publish whatever `prepareLocalMedia()` created. If you join without preparing, you join as a subscriber only.

type: `(token: string) => Promise<void>`

### leaveStage

Leaves the stage. Your local media stays prepared.

type: `() => Promise<void>`

### setMicMuted

Mutes or unmutes your published audio. Others see `audioMuted: true`.

type: `(muted: boolean) => void`

### setCameraEnabled

`false` turns your camera off and publishes a dark card with your initials in its place. You stay published, so other participants' layouts don't change. Locally, your participant reports `videoMuted: true`.

type: `(enabled: boolean) => void`

### setCameraPosition

Switches between front and back camera, live.

type: `(position: 'front' | 'back') => void`

### setDisplayName

The name whose initials the camera-off card shows. Defaults to the `display_name` attribute of your participant token.

type: `(name: string) => void`

## `useIvsStage`

```ts
const stage = useIvsStage();
```

Returns the current [`StageState`](./types.md#stagestate) merged with every `IvsStage` action, and re-renders whenever the state changes.

| Field | Type | Description |
| --- | --- | --- |
| `connection` | `'disconnected' \| 'connecting' \| 'connected'` | |
| `localParticipantId` | `string \| null` | Your id in the current stage |
| `participants` | `Record<string, StageParticipant>` | Everyone in the stage, including you (`isLocal: true`) |
| `lastError` | `StageError \| null` | Most recent error. Reset when the stage reconnects |
| …actions | | Same as `IvsStage` |

Mounting the hook late (or after a fast refresh) is safe: it reads a snapshot of the native state on first use.

### `StageParticipant`

| Field | Description |
| --- | --- |
| `participantId` | Pass to `IvsStageVideoView` |
| `userId` | `userId` from the participant token |
| `isLocal` | `true` for you |
| `attributes` | Token attributes (string values only, an IVS limit) |
| `publishState` | `'notPublished' \| 'attemptingPublish' \| 'published'` |
| `subscribeState` | `'notSubscribed' \| 'attemptingSubscribe' \| 'subscribed'` |
| `hasVideo` / `hasAudio` | They are publishing that track |
| `videoMuted` / `audioMuted` | That track is muted |

When the connection drops, remote participants are cleared; your own entry stays.

## `IvsStageVideoView`

```tsx
<IvsStageVideoView participantId={p.participantId} style={{ flex: 1 }} />
```

Renders a participant's video. It switches automatically when their stream appears, changes or goes away. While there's nothing to show it renders black.

### Props

#### participantId _(optional)_

Omit for **your own** camera preview. Otherwise use an id from `useIvsStage().participants`.

default: `''` (local preview)
type: `string`

#### aspectMode _(optional)_

default: `'fill'`
type: `'fit' | 'fill'`

#### mirrored _(optional)_

Mirrors the rendered video. Usually `true` for your own front-camera preview.

default: `false`
type: `boolean`

#### style, testID _(optional)_

## `stageStore`

```ts
import { stageStore } from 'react-native-ivs-broadcast';

stageStore.getState(); // StageState
const unsubscribe = stageStore.subscribe(() => {/* … */});
```

The store `useIvsStage` reads. Native events update it; treat it as read-only. `createStageStore`, `reduceStage` and `initialStageState` are exported for tests.

## Errors

| Where | How it surfaces |
| --- | --- |
| `prepareLocalMedia` / `joinStage` | The promise rejects with the native message |
| Device or SDK errors while running | `lastError` (`isFatal` from the SDK) |
| Disconnect with an error | `connection: 'disconnected'` and `lastError` with `isFatal: true`. Fetch a new token and `joinStage` again |
