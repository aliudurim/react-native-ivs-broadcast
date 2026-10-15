import { forwardRef, useImperativeHandle, useRef } from 'react';
import type { ComponentRef } from 'react';
import type { NativeSyntheticEvent } from 'react-native';
import NativeIvsBroadcastView, {
  Commands,
  type NativeProps,
} from '../specs/RNIvsBroadcastViewNativeComponent';
import type {
  BroadcastQuality,
  IvsBroadcastViewHandle,
  IvsBroadcastViewProps,
  IVideoConfig,
  NetworkHealth,
  StateStatusUnion,
} from './types';

type NativeEvent<K extends keyof NativeProps> =
  NonNullable<NativeProps[K]> extends (e: NativeSyntheticEvent<infer T>) => void
    ? T
    : never;

const triState = (v: boolean | undefined) => (v === undefined ? -1 : v ? 1 : 0);

/** Maps `videoConfig` onto the flat native props; unset fields keep the SDK default. */
export const flattenVideoConfig = (c: IVideoConfig = {}) => ({
  videoWidth: c.width ?? 0,
  videoHeight: c.height ?? 0,
  videoBitrate: c.bitrate ?? 0,
  videoTargetFrameRate: c.targetFrameRate ?? 0,
  videoKeyframeInterval: c.keyframeInterval ?? 0,
  videoBFrames: triState(c.isBFrames),
  videoAutoBitrate: triState(c.isAutoBitrate),
  videoAutoBitrateProfile: c.autoBitrateProfile ?? ('default' as const),
  videoMaxBitrate: c.maxBitrate ?? 0,
  videoMinBitrate: c.minBitrate ?? 0,
});

export const IvsBroadcastView = forwardRef<
  IvsBroadcastViewHandle,
  IvsBroadcastViewProps
>(function IvsBroadcastViewImpl(props, ref) {
  const {
    videoConfig,
    cameraPosition = 'back',
    cameraPreviewAspectMode = 'none',
    isCameraPreviewMirrored = false,
    isMuted = false,
    isCameraEnabled = true,
    onBroadcastStateChanged,
    onBroadcastError,
    onError,
    onTransmissionStatisticsChanged,
    ...rest
  } = props;

  const nativeRef = useRef<ComponentRef<typeof NativeIvsBroadcastView>>(null);

  useImperativeHandle(
    ref,
    () => ({
      start: (options = {}) => {
        if (nativeRef.current) {
          Commands.start(
            nativeRef.current,
            options.rtmpsUrl ?? '',
            options.streamKey ?? ''
          );
        }
      },
      stop: () => {
        if (nativeRef.current) Commands.stop(nativeRef.current);
      },
    }),
    []
  );

  const onState = (
    e: NativeSyntheticEvent<NativeEvent<'onBroadcastStateChanged'>>
  ) => {
    const { stateStatus, sessionId } = e.nativeEvent;
    onBroadcastStateChanged?.(
      stateStatus as StateStatusUnion,
      sessionId ? { sessionId } : undefined
    );
  };

  const onBroadcastErr = (
    e: NativeSyntheticEvent<NativeEvent<'onBroadcastError'>>
  ) => {
    const { code, type, source, detail, isFatal, sessionId } = e.nativeEvent;
    onBroadcastError?.({
      code: String(code),
      type: type || 'unknown',
      source: source || 'unknown',
      detail: detail ?? '',
      isFatal,
      sessionId: sessionId || 'unknown',
    });
  };

  const onStats = (
    e: NativeSyntheticEvent<NativeEvent<'onTransmissionStatisticsChanged'>>
  ) => {
    const s = e.nativeEvent;
    onTransmissionStatisticsChanged?.({
      rtt: s.rtt,
      measuredBitrate: s.measuredBitrate,
      recommendedBitrate: s.recommendedBitrate,
      networkHealth: s.networkHealth as NetworkHealth,
      broadcastQuality: s.broadcastQuality as BroadcastQuality,
    });
  };

  return (
    <NativeIvsBroadcastView
      {...rest}
      {...flattenVideoConfig(videoConfig)}
      ref={nativeRef}
      cameraPosition={cameraPosition}
      cameraPreviewAspectMode={cameraPreviewAspectMode}
      isCameraPreviewMirrored={isCameraPreviewMirrored}
      isMuted={isMuted}
      isCameraEnabled={isCameraEnabled}
      onBroadcastStateChanged={onState}
      onBroadcastError={onBroadcastErr}
      onNativeError={(e) => onError?.(e.nativeEvent.message)}
      onTransmissionStatisticsChanged={onStats}
    />
  );
});
