import type { StyleProp, ViewStyle } from 'react-native';

/** State of the RTMPS session, as reported by the IVS SDK. */
export type StateStatusUnion =
  'INVALID' | 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';

export type NetworkHealth = 'EXCELLENT' | 'HIGH' | 'MEDIUM' | 'LOW' | 'BAD';

export type BroadcastQuality =
  'NEAR_MAXIMUM' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NEAR_MINIMUM';

export type CameraPosition = 'front' | 'back';

export type CameraPreviewAspectMode = 'fit' | 'fill' | 'none';

export type AutomaticBitrateProfile = 'conservative' | 'fastIncrease';

/**
 * Encoder settings. Read once, when the native session is created (on mount):
 * changing them afterwards has no effect until the view is remounted.
 */
export interface IVideoConfig {
  /** Output width in pixels. Must be set together with `height`. */
  readonly width?: number;
  /** Output height in pixels. Must be set together with `width`. */
  readonly height?: number;
  /** Initial bitrate (bps). With auto-bitrate on, the encoder starts here and adapts. */
  readonly bitrate?: number;
  readonly targetFrameRate?: number;
  /** Seconds between keyframes. IVS requires 2 for low-latency channels. */
  readonly keyframeInterval?: 1 | 2 | 3 | 4 | 5;
  readonly isBFrames?: boolean;
  readonly isAutoBitrate?: boolean;
  readonly autoBitrateProfile?: AutomaticBitrateProfile;
  readonly maxBitrate?: number;
  readonly minBitrate?: number;
}

export interface StateChangedMetadata {
  readonly sessionId: string;
}

export interface IBroadcastSessionError {
  /** IVS SDK error code, as a string. */
  readonly code: string;
  readonly type: string;
  readonly source: string;
  readonly detail: string;
  /** A fatal error ends the session; call `start()` again to retry. */
  readonly isFatal: boolean;
  readonly sessionId: string;
}

export interface ITransmissionStatistics {
  /** Round-trip time to the ingest server, in milliseconds. */
  readonly rtt: number;
  readonly measuredBitrate: number;
  readonly recommendedBitrate: number;
  readonly networkHealth: NetworkHealth;
  readonly broadcastQuality: BroadcastQuality;
}

export interface IvsBroadcastViewProps {
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
  /** Ingest endpoint, e.g. `rtmps://<id>.global-contribute.live-video.net:443/app/`. */
  readonly rtmpsUrl?: string;
  readonly streamKey?: string;
  readonly videoConfig?: IVideoConfig;
  /** @default 'back' */
  readonly cameraPosition?: CameraPosition;
  /** @default 'none' */
  readonly cameraPreviewAspectMode?: CameraPreviewAspectMode;
  /** Mirrors the local preview only; the broadcast is never mirrored. @default false */
  readonly isCameraPreviewMirrored?: boolean;
  /** @default false */
  readonly isMuted?: boolean;
  /** `false` detaches the camera: viewers get black video, audio stays live. @default true */
  readonly isCameraEnabled?: boolean;
  onBroadcastStateChanged?(
    stateStatus: StateStatusUnion,
    metadata?: StateChangedMetadata
  ): void;
  onBroadcastError?(error: IBroadcastSessionError): void;
  /** Errors raised by this library (bad props, camera unavailable, …) rather than the SDK. */
  onError?(message: string): void;
  onTransmissionStatisticsChanged?(statistics: ITransmissionStatistics): void;
}

export interface IvsBroadcastViewHandle {
  /** Starts the RTMPS push; omitted values fall back to the `rtmpsUrl` / `streamKey` props. */
  start(options?: { rtmpsUrl?: string; streamKey?: string }): void;
  stop(): void;
}
