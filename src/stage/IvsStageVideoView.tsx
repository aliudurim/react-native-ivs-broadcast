import type { StyleProp, ViewStyle } from 'react-native';
import NativeStageVideoView from '../specs/RNIvsStageVideoViewNativeComponent';

export interface IvsStageVideoViewProps {
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** A participant's id from `useIvsStage().participants`. Omit for the local camera preview. */
  participantId?: string;
  /** @default 'fill' */
  aspectMode?: 'fit' | 'fill';
  /** @default false */
  mirrored?: boolean;
}

export function IvsStageVideoView({
  participantId = '',
  aspectMode = 'fill',
  mirrored = false,
  ...rest
}: IvsStageVideoViewProps) {
  return (
    <NativeStageVideoView
      {...rest}
      participantId={participantId}
      aspectMode={aspectMode}
      mirrored={mirrored}
    />
  );
}
