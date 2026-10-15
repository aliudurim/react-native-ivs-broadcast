import { useEffect, useSyncExternalStore } from 'react';
import { ensureStageEvents, IvsStage, stageStore } from './IvsStage';
import type { StageState } from './types';

export type UseIvsStageResult = StageState & typeof IvsStage;

/** Live stage state (connection, participants, last error) plus the `IvsStage` actions. */
export function useIvsStage(): UseIvsStageResult {
  useEffect(() => ensureStageEvents(), []);
  const state = useSyncExternalStore(
    stageStore.subscribe,
    stageStore.getState,
    stageStore.getState
  );
  return { ...state, ...IvsStage };
}
