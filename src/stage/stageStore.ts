import type { StageEvent, StageParticipant, StageState } from './types';

export const initialStageState: StageState = {
  connection: 'disconnected',
  localParticipantId: null,
  participants: {},
  lastError: null,
};

const patch = (
  state: StageState,
  participantId: string,
  change: Partial<StageParticipant>
): StageState => {
  const current = state.participants[participantId];
  if (!current) return state;
  return {
    ...state,
    participants: {
      ...state.participants,
      [participantId]: { ...current, ...change },
    },
  };
};

export function reduceStage(state: StageState, event: StageEvent): StageState {
  switch (event.type) {
    case 'snapshot':
      return { ...event.state, lastError: state.lastError };
    case 'connection': {
      const participants =
        event.state === 'disconnected'
          ? Object.fromEntries(
              Object.entries(state.participants).filter(([, p]) => p.isLocal)
            )
          : state.participants;
      return {
        ...state,
        connection: event.state,
        participants,
        lastError:
          event.error ?? (event.state === 'connected' ? null : state.lastError),
      };
    }
    case 'joined': {
      const known = state.participants[event.participant.participantId];
      const participant = known
        ? {
            ...event.participant,
            hasVideo: known.hasVideo,
            hasAudio: known.hasAudio,
            videoMuted: known.videoMuted,
            audioMuted: known.audioMuted,
          }
        : event.participant;
      // Every join gets a new local participant id and the SDK never reports the
      // old local one as left, so a new local join replaces any earlier one.
      const others = participant.isLocal
        ? Object.fromEntries(
            Object.entries(state.participants).filter(([, p]) => !p.isLocal)
          )
        : state.participants;
      return {
        ...state,
        localParticipantId: participant.isLocal
          ? participant.participantId
          : state.localParticipantId,
        participants: { ...others, [participant.participantId]: participant },
      };
    }
    case 'left': {
      if (!state.participants[event.participantId]) return state;
      const participants = { ...state.participants };
      delete participants[event.participantId];
      return { ...state, participants };
    }
    case 'publishState':
      return patch(state, event.participantId, { publishState: event.state });
    case 'subscribeState':
      return patch(state, event.participantId, { subscribeState: event.state });
    case 'media':
      return patch(state, event.participantId, {
        hasVideo: event.hasVideo,
        hasAudio: event.hasAudio,
        videoMuted: event.videoMuted,
        audioMuted: event.audioMuted,
      });
    case 'error':
      return { ...state, lastError: event.error };
  }
}

export interface StageStore {
  getState(): StageState;
  dispatch(event: StageEvent): void;
  subscribe(listener: () => void): () => void;
}

export function createStageStore(
  initial: StageState = initialStageState
): StageStore {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    dispatch(event) {
      const next = reduceStage(state, event);
      if (next === state) return;
      state = next;
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
