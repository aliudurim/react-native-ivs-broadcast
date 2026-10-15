import { PermissionsAndroid, Platform, type Permission } from 'react-native';

/** iOS prompts on first capture; Android needs runtime grants before the camera opens. */
export async function requestAVPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const wanted: Permission[] = [
    PermissionsAndroid.PERMISSIONS.CAMERA,
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
  ];
  if (Number(Platform.Version) >= 33) {
    wanted.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  }
  const result = await PermissionsAndroid.requestMultiple(wanted);
  return (
    result[PermissionsAndroid.PERMISSIONS.CAMERA] === 'granted' &&
    result[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === 'granted'
  );
}
