import type { CodegenTypes, HostComponent, ViewProps } from 'react-native';
import { codegenNativeComponent } from 'react-native';

export interface NativeProps extends ViewProps {
  /** Empty string renders the local camera preview (works before joining a stage). */
  participantId?: string;
  aspectMode?: CodegenTypes.WithDefault<'fit' | 'fill', 'fill'>;
  mirrored?: CodegenTypes.WithDefault<boolean, false>;
}

export default codegenNativeComponent<NativeProps>(
  'RNIvsStageVideoView'
) as HostComponent<NativeProps>;
