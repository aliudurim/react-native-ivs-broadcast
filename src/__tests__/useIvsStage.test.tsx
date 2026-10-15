import { act, renderHook } from '@testing-library/react-native';
import { TurboModuleRegistry } from 'react-native';

const module = {
  getSnapshot: jest.fn(() =>
    Promise.resolve({
      connection: 'disconnected',
      localParticipantId: '',
      participants: [],
    })
  ),
  joinStage: jest.fn(() => Promise.resolve()),
  onConnectionStateChanged: jest.fn(),
  onParticipantJoined: jest.fn(),
  onParticipantLeft: jest.fn(),
  onParticipantPublishStateChanged: jest.fn(),
  onParticipantSubscribeStateChanged: jest.fn(),
  onParticipantMediaChanged: jest.fn(),
  onError: jest.fn(),
};

jest.spyOn(TurboModuleRegistry, 'getEnforcing').mockReturnValue(module as any);

const { useIvsStage } = require('../stage/useIvsStage');
const { stageStore } = require('../stage/IvsStage');

describe('useIvsStage', () => {
  it('subscribes on mount and re-renders on store changes', async () => {
    const { result } = renderHook(() => useIvsStage());
    await act(async () => {});
    expect(module.onParticipantJoined).toHaveBeenCalledTimes(1);
    expect(result.current.connection).toBe('disconnected');

    act(() =>
      stageStore.dispatch({
        type: 'connection',
        state: 'connecting',
        error: null,
      })
    );
    expect(result.current.connection).toBe('connecting');
  });

  it('exposes the IvsStage actions', async () => {
    const { result } = renderHook(() => useIvsStage());
    await result.current.joinStage('t');
    expect(module.joinStage).toHaveBeenCalledWith('t');
  });
});
