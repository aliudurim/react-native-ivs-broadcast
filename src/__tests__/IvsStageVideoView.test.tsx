import { render, screen } from '@testing-library/react-native';
import { IvsStageVideoView } from '../stage/IvsStageVideoView';

jest.mock('../specs/RNIvsStageVideoViewNativeComponent', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const { View } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    default: (props: object) =>
      createElement(View, { ...props, testID: 'native-stage-video' }),
  };
});

describe('IvsStageVideoView', () => {
  it('defaults to the local preview, filled and unmirrored', () => {
    render(<IvsStageVideoView />);
    expect(screen.getByTestId('native-stage-video').props).toMatchObject({
      participantId: '',
      aspectMode: 'fill',
      mirrored: false,
    });
  });

  it('forwards a remote participant and display options', () => {
    render(<IvsStageVideoView participantId="p1" aspectMode="fit" mirrored />);
    expect(screen.getByTestId('native-stage-video').props).toMatchObject({
      participantId: 'p1',
      aspectMode: 'fit',
      mirrored: true,
    });
  });
});
