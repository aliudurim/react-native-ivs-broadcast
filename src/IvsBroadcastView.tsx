import type { ColorValue, ViewProps } from 'react-native';

type Props = ViewProps & {
  color?: ColorValue;
};

export function IvsBroadcastView(_props: Props): never {
  throw new Error(
    "'react-native-ivs-broadcast' is only supported on native platforms."
  );
}
