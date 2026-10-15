import { TurboModuleRegistry } from 'react-native';
import type {
  NativeParticipant,
  Spec as NativeStageSpec,
} from '../specs/NativeRNIvsStage';
import { createStageStore } from './stageStore';
import type { CameraPosition } from '../broadcast/types';
import type {
  PublishState,
  StageConnectionState,
  StageError,
  StageParticipant,
  SubscribeState,
} from './types';

export interface PrepareLocalMediaOptions {
  /** @default 'front' */
  cameraPosition?: CameraPosition;
  /** @default 720 */
  width?: number;
  /** @default 1280 */
  height?: number;
  /** @default 30 */
  targetFrameRate?: number;
  /** @default 2_000_000 */
  maxBitrate?: number;
  /** @default 400_000 */
  minBitrate?: number;
}

// Resolved on first use so that importing the package never throws (e.g. under Jest).
let nativeModule: NativeStageSpec | null = null;
const native = (): NativeStageSpec =>
  (nativeModule ??=
    TurboModuleRegistry.getEnforcing<NativeStageSpec>('RNIvsStage'));

const parseAttributes = (json: string): Record<string, string> => {
  try {
    const parsed: unknown = JSON.parse(json || '{}');
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, string>)
      : {};
  } catch {
    return {};
  }
};

export const toParticipant = (p: NativeParticipant): StageParticipant => ({
  participantId: p.participantId,
  userId: p.userId,
  isLocal: p.isLocal,
  attributes: parseAttributes(p.attributesJson),
  publishState: p.publishState as PublishState,
  subscribeState: p.subscribeState as SubscribeState,
  hasVideo: p.hasVideo,
  hasAudio: p.hasAudio,
  videoMuted: p.videoMuted,
  audioMuted: p.audioMuted,
});

export const stageStore = createStageStore();

let subscribed = false;

/** Wires native events into the store once, then reconciles with a snapshot (fast refresh, late mount). */
export function ensureStageEvents(): void {
  if (subscribed) return;
  subscribed = true;
  const { dispatch } = stageStore;
  const module = native();

  module.onConnectionStateChanged((e) => {
    const error: StageError | null = e.errorCode
      ? { code: e.errorCode, message: e.errorMessage, isFatal: true }
      : null;
    dispatch({
      type: 'connection',
      state: e.state as StageConnectionState,
      error,
    });
  });
  module.onParticipantJoined((p) =>
    dispatch({ type: 'joined', participant: toParticipant(p) })
  );
  module.onParticipantLeft((e) =>
    dispatch({ type: 'left', participantId: e.participantId })
  );
  module.onParticipantPublishStateChanged((e) =>
    dispatch({
      type: 'publishState',
      participantId: e.participantId,
      state: e.state as PublishState,
    })
  );
  module.onParticipantSubscribeStateChanged((e) =>
    dispatch({
      type: 'subscribeState',
      participantId: e.participantId,
      state: e.state as SubscribeState,
    })
  );
  module.onParticipantMediaChanged((e) => dispatch({ type: 'media', ...e }));
  module.onError((e) => dispatch({ type: 'error', error: e }));

  module
    .getSnapshot()
    .then((snapshot) => {
      dispatch({
        type: 'snapshot',
        state: {
          connection: snapshot.connection as StageConnectionState,
          localParticipantId: snapshot.localParticipantId || null,
          participants: Object.fromEntries(
            snapshot.participants.map((p) => [
              p.participantId,
              toParticipant(p),
            ])
          ),
        },
      });
    })
    .catch(() => {});
}

/** Imperative API for IVS Real-Time Stages. One stage per app process. */
export const IvsStage = {
  /** Creates the camera + microphone streams; the preview works before any stage token exists. */
  prepareLocalMedia(o: PrepareLocalMediaOptions = {}): Promise<void> {
    ensureStageEvents();
    return native().prepareLocalMedia(
      o.cameraPosition ?? 'front',
      o.width ?? 720,
      o.height ?? 1280,
      o.targetFrameRate ?? 30,
      o.maxBitrate ?? 2_000_000,
      o.minBitrate ?? 400_000
    );
  },
  /** Stops the camera and microphone. Call after `leaveStage()` when the screen goes away. */
  releaseLocalMedia: (): Promise<void> => native().releaseLocalMedia(),
  /** Resolves once the join has started; connection progress arrives as events. */
  joinStage(token: string): Promise<void> {
    ensureStageEvents();
    return native().joinStage(token);
  },
  leaveStage: (): Promise<void> => native().leaveStage(),
  setMicMuted: (muted: boolean): void => native().setMicMuted(muted),
  /** While off, a card with the participant's initials is published in place of the camera. */
  setCameraEnabled: (enabled: boolean): void =>
    native().setCameraEnabled(enabled),
  setCameraPosition: (position: CameraPosition): void =>
    native().setCameraPosition(position),
  /** Name whose initials the camera-off card shows. Defaults to the token's `display_name` attribute. */
  setDisplayName: (name: string): void => native().setDisplayName(name),
};
