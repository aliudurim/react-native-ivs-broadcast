import type { CodegenTypes, TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export type NativeParticipant = {
  participantId: string;
  userId: string;
  isLocal: boolean;
  attributesJson: string;
  publishState: string;
  subscribeState: string;
  hasVideo: boolean;
  hasAudio: boolean;
  videoMuted: boolean;
  audioMuted: boolean;
};

export type NativeStageSnapshot = {
  connection: string;
  localParticipantId: string;
  participants: NativeParticipant[];
};

type ConnectionEvent = {
  state: string;
  errorCode: CodegenTypes.Int32;
  errorMessage: string;
};
type ParticipantIdEvent = { participantId: string };
type StateEvent = { participantId: string; state: string };
type MediaEvent = {
  participantId: string;
  hasVideo: boolean;
  hasAudio: boolean;
  videoMuted: boolean;
  audioMuted: boolean;
};
type ErrorEvent = {
  code: CodegenTypes.Int32;
  message: string;
  isFatal: boolean;
};

export interface Spec extends TurboModule {
  prepareLocalMedia(
    cameraPosition: string,
    width: CodegenTypes.Int32,
    height: CodegenTypes.Int32,
    targetFrameRate: CodegenTypes.Int32,
    maxBitrate: CodegenTypes.Int32,
    minBitrate: CodegenTypes.Int32
  ): Promise<void>;
  releaseLocalMedia(): Promise<void>;
  joinStage(token: string): Promise<void>;
  leaveStage(): Promise<void>;
  setMicMuted(muted: boolean): void;
  setCameraEnabled(enabled: boolean): void;
  setCameraPosition(position: string): void;
  setDisplayName(name: string): void;
  getSnapshot(): Promise<NativeStageSnapshot>;

  readonly onConnectionStateChanged: CodegenTypes.EventEmitter<ConnectionEvent>;
  readonly onParticipantJoined: CodegenTypes.EventEmitter<NativeParticipant>;
  readonly onParticipantLeft: CodegenTypes.EventEmitter<ParticipantIdEvent>;
  readonly onParticipantPublishStateChanged: CodegenTypes.EventEmitter<StateEvent>;
  readonly onParticipantSubscribeStateChanged: CodegenTypes.EventEmitter<StateEvent>;
  readonly onParticipantMediaChanged: CodegenTypes.EventEmitter<MediaEvent>;
  readonly onError: CodegenTypes.EventEmitter<ErrorEvent>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('RNIvsStage');
