import {
  createStageStore,
  initialStageState,
  reduceStage,
} from '../stage/stageStore';
import type { StageParticipant } from '../stage/types';

const participant = (
  over: Partial<StageParticipant> = {}
): StageParticipant => ({
  participantId: 'p1',
  userId: 'u1',
  isLocal: false,
  attributes: {},
  publishState: 'notPublished',
  subscribeState: 'notSubscribed',
  hasVideo: false,
  hasAudio: false,
  videoMuted: false,
  audioMuted: false,
  ...over,
});

describe('reduceStage', () => {
  it('tracks the connection and clears a stale error on reconnect', () => {
    const err = { code: 1300, message: 'network', isFatal: true };
    let s = reduceStage(initialStageState, {
      type: 'connection',
      state: 'connecting',
      error: null,
    });
    expect(s.connection).toBe('connecting');
    s = reduceStage(s, {
      type: 'connection',
      state: 'disconnected',
      error: err,
    });
    expect(s.lastError).toEqual(err);
    s = reduceStage(s, { type: 'connection', state: 'connected', error: null });
    expect(s).toMatchObject({ connection: 'connected', lastError: null });
  });

  it('drops remote participants on disconnect but keeps the local one', () => {
    let s = reduceStage(initialStageState, {
      type: 'joined',
      participant: participant({ participantId: 'me', isLocal: true }),
    });
    s = reduceStage(s, {
      type: 'joined',
      participant: participant({ participantId: 'guest' }),
    });
    s = reduceStage(s, {
      type: 'connection',
      state: 'disconnected',
      error: null,
    });
    expect(Object.keys(s.participants)).toEqual(['me']);
  });

  it('records the local participant id on join', () => {
    const s = reduceStage(initialStageState, {
      type: 'joined',
      participant: participant({ participantId: 'me', isLocal: true }),
    });
    expect(s.localParticipantId).toBe('me');
    expect(s.participants.me?.isLocal).toBe(true);
  });

  it('a new local join replaces the previous local participant', () => {
    let s = reduceStage(initialStageState, {
      type: 'joined',
      participant: participant({ participantId: 'me-1', isLocal: true }),
    });
    s = reduceStage(s, {
      type: 'connection',
      state: 'disconnected',
      error: null,
    });
    s = reduceStage(s, {
      type: 'joined',
      participant: participant({ participantId: 'me-2', isLocal: true }),
    });
    s = reduceStage(s, {
      type: 'joined',
      participant: participant({ participantId: 'guest' }),
    });
    expect(Object.keys(s.participants).sort()).toEqual(['guest', 'me-2']);
    expect(s.localParticipantId).toBe('me-2');
  });

  it('a re-join replaces info but keeps known media state', () => {
    let s = reduceStage(initialStageState, {
      type: 'joined',
      participant: participant(),
    });
    s = reduceStage(s, {
      type: 'media',
      participantId: 'p1',
      hasVideo: true,
      hasAudio: true,
      videoMuted: false,
      audioMuted: true,
    });
    s = reduceStage(s, {
      type: 'joined',
      participant: participant({ attributes: { name: 'Mia' } }),
    });
    expect(s.participants.p1).toMatchObject({
      attributes: { name: 'Mia' },
      hasVideo: true,
      audioMuted: true,
    });
  });

  it('updates publish, subscribe and media state for known participants only', () => {
    let s = reduceStage(initialStageState, {
      type: 'joined',
      participant: participant(),
    });
    s = reduceStage(s, {
      type: 'publishState',
      participantId: 'p1',
      state: 'published',
    });
    s = reduceStage(s, {
      type: 'subscribeState',
      participantId: 'p1',
      state: 'subscribed',
    });
    s = reduceStage(s, {
      type: 'media',
      participantId: 'p1',
      hasVideo: true,
      hasAudio: true,
      videoMuted: true,
      audioMuted: false,
    });
    expect(s.participants.p1).toMatchObject({
      publishState: 'published',
      subscribeState: 'subscribed',
      hasVideo: true,
      videoMuted: true,
    });
    const unchanged = reduceStage(s, {
      type: 'publishState',
      participantId: 'ghost',
      state: 'published',
    });
    expect(unchanged).toBe(s);
  });

  it('removes a participant that left', () => {
    let s = reduceStage(initialStageState, {
      type: 'joined',
      participant: participant(),
    });
    s = reduceStage(s, { type: 'left', participantId: 'p1' });
    expect(s.participants).toEqual({});
  });

  it('a snapshot replaces everything but the last error', () => {
    const err = { code: 1, message: 'x', isFatal: false };
    let s = reduceStage(initialStageState, { type: 'error', error: err });
    s = reduceStage(s, {
      type: 'snapshot',
      state: {
        connection: 'connected',
        localParticipantId: 'me',
        participants: {
          me: participant({ participantId: 'me', isLocal: true }),
        },
      },
    });
    expect(s).toMatchObject({
      connection: 'connected',
      localParticipantId: 'me',
      lastError: err,
    });
  });
});

describe('createStageStore', () => {
  it('notifies subscribers only when state changes', () => {
    const store = createStageStore();
    const listener = jest.fn();
    const unsubscribe = store.subscribe(listener);
    store.dispatch({ type: 'left', participantId: 'nobody' });
    expect(listener).not.toHaveBeenCalled();
    store.dispatch({ type: 'connection', state: 'connecting', error: null });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getState().connection).toBe('connecting');
    unsubscribe();
    store.dispatch({ type: 'connection', state: 'connected', error: null });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
