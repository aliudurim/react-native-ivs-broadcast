import { IvsBroadcastView } from './broadcast/IvsBroadcastView';
import type { IvsBroadcastViewHandle } from './broadcast/types';

export {
  IvsBroadcastView,
  flattenVideoConfig,
} from './broadcast/IvsBroadcastView';
export type * from './broadcast/types';

/** Alias matching `amazon-ivs-react-native-broadcast`, so migrating is an import change. */
export const IVSBroadcastCameraView = IvsBroadcastView;
/** Alias matching `amazon-ivs-react-native-broadcast`. */
export type IIVSBroadcastCameraView = IvsBroadcastViewHandle;

export { IvsStage, stageStore } from './stage/IvsStage';
export type { PrepareLocalMediaOptions } from './stage/IvsStage';
export { useIvsStage } from './stage/useIvsStage';
export type { UseIvsStageResult } from './stage/useIvsStage';
export { IvsStageVideoView } from './stage/IvsStageVideoView';
export type { IvsStageVideoViewProps } from './stage/IvsStageVideoView';
export {
  createStageStore,
  reduceStage,
  initialStageState,
} from './stage/stageStore';
export type { StageStore } from './stage/stageStore';
export type * from './stage/types';
