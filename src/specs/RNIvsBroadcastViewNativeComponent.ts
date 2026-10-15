import type * as React from 'react';
import type { CodegenTypes, HostComponent, ViewProps } from 'react-native';
import { codegenNativeCommands, codegenNativeComponent } from 'react-native';

type BroadcastStateEvent = Readonly<{
  stateStatus: string;
  sessionId: string;
}>;

type BroadcastErrorEvent = Readonly<{
  code: CodegenTypes.Int32;
  type: string;
  source: string;
  detail: string;
  isFatal: boolean;
  sessionId: string;
}>;

type NativeErrorEvent = Readonly<{
  message: string;
}>;

type TransmissionStatisticsEvent = Readonly<{
  rtt: CodegenTypes.Double;
  measuredBitrate: CodegenTypes.Double;
  recommendedBitrate: CodegenTypes.Double;
  networkHealth: string;
  broadcastQuality: string;
}>;

// Config props are flat because Codegen handles optional nested objects poorly.
// Numeric 0 means "SDK default"; the boolean-like Int32 props use -1 for "SDK default".
export interface NativeProps extends ViewProps {
  rtmpsUrl?: string;
  streamKey?: string;

  videoWidth?: CodegenTypes.WithDefault<CodegenTypes.Int32, 0>;
  videoHeight?: CodegenTypes.WithDefault<CodegenTypes.Int32, 0>;
  videoBitrate?: CodegenTypes.WithDefault<CodegenTypes.Int32, 0>;
  videoTargetFrameRate?: CodegenTypes.WithDefault<CodegenTypes.Int32, 0>;
  videoKeyframeInterval?: CodegenTypes.WithDefault<CodegenTypes.Int32, 0>;
  videoBFrames?: CodegenTypes.WithDefault<CodegenTypes.Int32, -1>;
  videoAutoBitrate?: CodegenTypes.WithDefault<CodegenTypes.Int32, -1>;
  videoAutoBitrateProfile?: CodegenTypes.WithDefault<
    'default' | 'conservative' | 'fastIncrease',
    'default'
  >;
  videoMaxBitrate?: CodegenTypes.WithDefault<CodegenTypes.Int32, 0>;
  videoMinBitrate?: CodegenTypes.WithDefault<CodegenTypes.Int32, 0>;

  cameraPosition?: CodegenTypes.WithDefault<'front' | 'back', 'back'>;
  cameraPreviewAspectMode?: CodegenTypes.WithDefault<
    'fit' | 'fill' | 'none',
    'none'
  >;
  isCameraPreviewMirrored?: CodegenTypes.WithDefault<boolean, false>;
  isMuted?: CodegenTypes.WithDefault<boolean, false>;
  isCameraEnabled?: CodegenTypes.WithDefault<boolean, true>;

  onBroadcastStateChanged?: CodegenTypes.DirectEventHandler<BroadcastStateEvent>;
  onBroadcastError?: CodegenTypes.DirectEventHandler<BroadcastErrorEvent>;
  onNativeError?: CodegenTypes.DirectEventHandler<NativeErrorEvent>;
  onTransmissionStatisticsChanged?: CodegenTypes.DirectEventHandler<TransmissionStatisticsEvent>;
}

type NativeComponentType = HostComponent<NativeProps>;

interface NativeCommands {
  start: (
    viewRef: React.ElementRef<NativeComponentType>,
    rtmpsUrl: string,
    streamKey: string
  ) => void;
  stop: (viewRef: React.ElementRef<NativeComponentType>) => void;
}

export const Commands: NativeCommands = codegenNativeCommands<NativeCommands>({
  supportedCommands: ['start', 'stop'],
});

export default codegenNativeComponent<NativeProps>(
  'RNIvsBroadcastView'
) as NativeComponentType;
