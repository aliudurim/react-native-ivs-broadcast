import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import {
  IvsBroadcastView,
  flattenVideoConfig,
} from '../broadcast/IvsBroadcastView';
import type { IvsBroadcastViewHandle } from '../broadcast/types';
import { Commands } from '../specs/RNIvsBroadcastViewNativeComponent';
import { IVSBroadcastCameraView } from '../index';

jest.mock('../specs/RNIvsBroadcastViewNativeComponent', () => {
  const { forwardRef, createElement } =
    jest.requireActual<typeof import('react')>('react');
  const { View } =
    jest.requireActual<typeof import('react-native')>('react-native');
  const Native = forwardRef((props: object, ref: any) =>
    createElement(View, { ...props, ref, testID: 'native-broadcast' })
  );
  return {
    __esModule: true,
    default: Native,
    Commands: { start: jest.fn(), stop: jest.fn() },
  };
});

const commands = jest.mocked(Commands);

const renderView = (
  props: React.ComponentProps<typeof IvsBroadcastView> = {}
) => {
  const ref = createRef<IvsBroadcastViewHandle>();
  render(<IvsBroadcastView ref={ref} {...props} />);
  return { ref, native: screen.getByTestId('native-broadcast') };
};

beforeEach(() => jest.clearAllMocks());

describe('flattenVideoConfig', () => {
  it('keeps every unset field on the SDK default', () => {
    expect(flattenVideoConfig()).toEqual({
      videoWidth: 0,
      videoHeight: 0,
      videoBitrate: 0,
      videoTargetFrameRate: 0,
      videoKeyframeInterval: 0,
      videoBFrames: -1,
      videoAutoBitrate: -1,
      videoAutoBitrateProfile: 'default',
      videoMaxBitrate: 0,
      videoMinBitrate: 0,
    });
  });

  it('maps every field', () => {
    expect(
      flattenVideoConfig({
        width: 720,
        height: 1280,
        bitrate: 1_200_000,
        targetFrameRate: 30,
        keyframeInterval: 2,
        isBFrames: false,
        isAutoBitrate: true,
        autoBitrateProfile: 'fastIncrease',
        maxBitrate: 2_500_000,
        minBitrate: 200_000,
      })
    ).toEqual({
      videoWidth: 720,
      videoHeight: 1280,
      videoBitrate: 1_200_000,
      videoTargetFrameRate: 30,
      videoKeyframeInterval: 2,
      videoBFrames: 0,
      videoAutoBitrate: 1,
      videoAutoBitrateProfile: 'fastIncrease',
      videoMaxBitrate: 2_500_000,
      videoMinBitrate: 200_000,
    });
  });
});

describe('IvsBroadcastView', () => {
  it('renders the native view with default camera props', () => {
    const { native } = renderView();
    expect(native.props).toMatchObject({
      cameraPosition: 'back',
      cameraPreviewAspectMode: 'none',
      isCameraPreviewMirrored: false,
      isMuted: false,
      isCameraEnabled: true,
      videoBFrames: -1,
    });
  });

  it('forwards explicit props, credentials and the flattened video config', () => {
    const { native } = renderView({
      rtmpsUrl: 'rtmps://ingest',
      streamKey: 'sk',
      cameraPosition: 'front',
      cameraPreviewAspectMode: 'fill',
      isCameraPreviewMirrored: true,
      isMuted: true,
      isCameraEnabled: false,
      videoConfig: { width: 1080, height: 1920, keyframeInterval: 2 },
    });
    expect(native.props).toMatchObject({
      rtmpsUrl: 'rtmps://ingest',
      streamKey: 'sk',
      cameraPosition: 'front',
      cameraPreviewAspectMode: 'fill',
      isCameraPreviewMirrored: true,
      isMuted: true,
      isCameraEnabled: false,
      videoWidth: 1080,
      videoHeight: 1920,
      videoKeyframeInterval: 2,
    });
  });

  it('unwraps state events, with metadata only when a session id is present', () => {
    const onBroadcastStateChanged = jest.fn();
    const { native } = renderView({ onBroadcastStateChanged });
    fireEvent(native, 'onBroadcastStateChanged', {
      nativeEvent: { stateStatus: 'CONNECTING', sessionId: '' },
    });
    fireEvent(native, 'onBroadcastStateChanged', {
      nativeEvent: { stateStatus: 'CONNECTED', sessionId: 'abc' },
    });
    expect(onBroadcastStateChanged.mock.calls).toEqual([
      ['CONNECTING', undefined],
      ['CONNECTED', { sessionId: 'abc' }],
    ]);
  });

  it('reshapes broadcast errors with a string code and populated fields', () => {
    const onBroadcastError = jest.fn();
    const { native } = renderView({ onBroadcastError });
    fireEvent(native, 'onBroadcastError', {
      nativeEvent: {
        code: 10405,
        type: '',
        source: '',
        detail: 'too far behind',
        isFatal: true,
        sessionId: '',
      },
    });
    expect(onBroadcastError).toHaveBeenCalledWith({
      code: '10405',
      type: 'unknown',
      source: 'unknown',
      detail: 'too far behind',
      isFatal: true,
      sessionId: 'unknown',
    });
  });

  it('routes native errors and transmission statistics', () => {
    const onError = jest.fn();
    const onTransmissionStatisticsChanged = jest.fn();
    const { native } = renderView({ onError, onTransmissionStatisticsChanged });
    fireEvent(native, 'onNativeError', {
      nativeEvent: { message: 'no camera' },
    });
    const stats = {
      rtt: 40,
      measuredBitrate: 1,
      recommendedBitrate: 2,
      networkHealth: 'LOW',
      broadcastQuality: 'HIGH',
    };
    fireEvent(native, 'onTransmissionStatisticsChanged', {
      nativeEvent: stats,
    });
    expect(onError).toHaveBeenCalledWith('no camera');
    expect(onTransmissionStatisticsChanged).toHaveBeenCalledWith(stats);
  });

  it('does not throw when events arrive without handlers', () => {
    const { native } = renderView();
    expect(() =>
      fireEvent(native, 'onNativeError', { nativeEvent: { message: 'x' } })
    ).not.toThrow();
  });

  it('start() falls back to the props (empty args) and stop() dispatches', () => {
    const { ref } = renderView({ rtmpsUrl: 'rtmps://x', streamKey: 'k' });
    ref.current!.start();
    ref.current!.start({ rtmpsUrl: 'rtmps://y', streamKey: 'k2' });
    ref.current!.stop();
    expect(commands.start.mock.calls.map((c) => c.slice(1))).toEqual([
      ['', ''],
      ['rtmps://y', 'k2'],
    ]);
    expect(commands.stop).toHaveBeenCalledTimes(1);
  });

  it('exports the amazon-ivs-react-native-broadcast alias', () => {
    expect(IVSBroadcastCameraView).toBe(IvsBroadcastView);
  });
});
