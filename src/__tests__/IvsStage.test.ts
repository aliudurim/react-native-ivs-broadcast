import { TurboModuleRegistry } from 'react-native';
import type { NativeParticipant } from '../specs/NativeRNIvsStage';

type Listener = (payload: any) => void;

const nativeParticipant = (
  over: Partial<NativeParticipant> = {}
): NativeParticipant => ({
  participantId: 'p1',
  userId: 'u1',
  isLocal: false,
  attributesJson: '{"display_name":"Mia Wong"}',
  publishState: 'published',
  subscribeState: 'subscribed',
  hasVideo: true,
  hasAudio: true,
  videoMuted: false,
  audioMuted: false,
  ...over,
});

function createNativeMock() {
  const listeners: Record<string, Listener> = {};
  const emitter = (name: string) =>
    jest.fn((listener: Listener) => {
      listeners[name] = listener;
      return { remove: jest.fn() };
    });
  const module = {
    prepareLocalMedia: jest.fn(() => Promise.resolve()),
    releaseLocalMedia: jest.fn(() => Promise.resolve()),
    joinStage: jest.fn(() => Promise.resolve()),
    leaveStage: jest.fn(() => Promise.resolve()),
    setMicMuted: jest.fn(),
    setCameraEnabled: jest.fn(),
    setCameraPosition: jest.fn(),
    setDisplayName: jest.fn(),
    getSnapshot: jest.fn(() =>
      Promise.resolve({
        connection: 'connected',
        localParticipantId: 'me',
        participants: [
          nativeParticipant({ participantId: 'me', isLocal: true }),
        ],
      })
    ),
    onConnectionStateChanged: emitter('connection'),
    onParticipantJoined: emitter('joined'),
    onParticipantLeft: emitter('left'),
    onParticipantPublishStateChanged: emitter('publishState'),
    onParticipantSubscribeStateChanged: emitter('subscribeState'),
    onParticipantMediaChanged: emitter('media'),
    onError: emitter('error'),
  };
  const emit = (name: string, payload: unknown) => listeners[name]!(payload);
  return { module, emit };
}

let native: ReturnType<typeof createNativeMock>;
let stage: typeof import('../stage/IvsStage');

beforeEach(() => {
  jest.resetModules();
  native = createNativeMock();
  jest
    .spyOn(TurboModuleRegistry, 'getEnforcing')
    .mockReturnValue(native.module as any);
  stage = require('../stage/IvsStage');
});

afterEach(() => jest.restoreAllMocks());

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('toParticipant', () => {
  it('parses the attributes JSON and tolerates junk', () => {
    expect(stage.toParticipant(nativeParticipant()).attributes).toEqual({
      display_name: 'Mia Wong',
    });
    expect(
      stage.toParticipant(nativeParticipant({ attributesJson: '{oops' }))
        .attributes
    ).toEqual({});
    expect(
      stage.toParticipant(nativeParticipant({ attributesJson: '' })).attributes
    ).toEqual({});
  });
});

describe('IvsStage', () => {
  it('does not touch the native module until first use', () => {
    expect(TurboModuleRegistry.getEnforcing).not.toHaveBeenCalled();
  });

  it('prepareLocalMedia applies defaults and subscribes to events once', async () => {
    await stage.IvsStage.prepareLocalMedia();
    await stage.IvsStage.prepareLocalMedia({
      cameraPosition: 'back',
      width: 1080,
      height: 1920,
      targetFrameRate: 24,
      maxBitrate: 3_000_000,
      minBitrate: 500_000,
    });
    expect(native.module.prepareLocalMedia.mock.calls).toEqual([
      ['front', 720, 1280, 30, 2_000_000, 400_000],
      ['back', 1080, 1920, 24, 3_000_000, 500_000],
    ]);
    expect(native.module.onParticipantJoined).toHaveBeenCalledTimes(1);
    expect(native.module.getSnapshot).toHaveBeenCalledTimes(1);
  });

  it('forwards the remaining actions', async () => {
    await stage.IvsStage.joinStage('token');
    await stage.IvsStage.leaveStage();
    await stage.IvsStage.releaseLocalMedia();
    stage.IvsStage.setMicMuted(true);
    stage.IvsStage.setCameraEnabled(false);
    stage.IvsStage.setCameraPosition('back');
    stage.IvsStage.setDisplayName('Mia');
    expect(native.module.joinStage).toHaveBeenCalledWith('token');
    expect(native.module.leaveStage).toHaveBeenCalled();
    expect(native.module.releaseLocalMedia).toHaveBeenCalled();
    expect(native.module.setMicMuted).toHaveBeenCalledWith(true);
    expect(native.module.setCameraEnabled).toHaveBeenCalledWith(false);
    expect(native.module.setCameraPosition).toHaveBeenCalledWith('back');
    expect(native.module.setDisplayName).toHaveBeenCalledWith('Mia');
  });

  it('propagates native rejections', async () => {
    native.module.joinStage.mockReturnValueOnce(
      Promise.reject(new Error('bad token'))
    );
    await expect(stage.IvsStage.joinStage('x')).rejects.toThrow('bad token');
  });
});

describe('stage events', () => {
  it('reconciles with the native snapshot', async () => {
    stage.ensureStageEvents();
    await flush();
    expect(stage.stageStore.getState()).toMatchObject({
      connection: 'connected',
      localParticipantId: 'me',
    });
    expect(stage.stageStore.getState().participants.me?.isLocal).toBe(true);
  });

  it('ignores a failed snapshot', async () => {
    native.module.getSnapshot.mockReturnValueOnce(
      Promise.reject(new Error('gone'))
    );
    stage.ensureStageEvents();
    await flush();
    expect(stage.stageStore.getState().connection).toBe('disconnected');
  });

  it('feeds every native event into the store', async () => {
    stage.ensureStageEvents();
    await flush();
    native.emit('joined', nativeParticipant({ publishState: 'notPublished' }));
    native.emit('publishState', { participantId: 'p1', state: 'published' });
    native.emit('subscribeState', {
      participantId: 'p1',
      state: 'attemptingSubscribe',
    });
    native.emit('media', {
      participantId: 'p1',
      hasVideo: true,
      hasAudio: true,
      videoMuted: true,
      audioMuted: false,
    });
    expect(stage.stageStore.getState().participants.p1).toMatchObject({
      attributes: { display_name: 'Mia Wong' },
      publishState: 'published',
      subscribeState: 'attemptingSubscribe',
      videoMuted: true,
    });

    native.emit('left', { participantId: 'p1' });
    expect(stage.stageStore.getState().participants.p1).toBeUndefined();

    native.emit('error', { code: 7, message: 'camera', isFatal: false });
    expect(stage.stageStore.getState().lastError).toEqual({
      code: 7,
      message: 'camera',
      isFatal: false,
    });

    native.emit('connection', {
      state: 'disconnected',
      errorCode: 1300,
      errorMessage: 'kicked',
    });
    expect(stage.stageStore.getState()).toMatchObject({
      connection: 'disconnected',
      lastError: { code: 1300, message: 'kicked', isFatal: true },
    });

    native.emit('connection', {
      state: 'connected',
      errorCode: 0,
      errorMessage: '',
    });
    expect(stage.stageStore.getState().lastError).toBeNull();
  });
});
