/** @type {Detox.DetoxConfig} */
module.exports = {
  testRunner: {
    args: {
      $0: 'jest',
      config: 'e2e/jest.config.js',
    },
    jest: {
      setupTimeout: 240000,
    },
  },
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath:
        'example/ios/build/Build/Products/Debug-iphonesimulator/IvsBroadcastExample.app',
      build:
        'xcodebuild -workspace example/ios/IvsBroadcastExample.xcworkspace -scheme IvsBroadcastExample -configuration Debug -sdk iphonesimulator -derivedDataPath example/ios/build',
    },
    'ios.release': {
      type: 'ios.app',
      binaryPath:
        'example/ios/build/Build/Products/Release-iphonesimulator/IvsBroadcastExample.app',
      build:
        'export RCT_NO_LAUNCH_PACKAGER=true && xcodebuild -workspace example/ios/IvsBroadcastExample.xcworkspace -scheme IvsBroadcastExample -configuration Release -sdk iphonesimulator -derivedDataPath example/ios/build',
    },
    'android.debug': {
      type: 'android.apk',
      binaryPath: 'example/android/app/build/outputs/apk/debug/app-debug.apk',
      testBinaryPath:
        'example/android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk',
      build:
        'cd example/android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug && cd -',
      reversePorts: [8081],
    },
    'android.release': {
      type: 'android.apk',
      binaryPath:
        'example/android/app/build/outputs/apk/release/app-release.apk',
      testBinaryPath:
        'example/android/app/build/outputs/apk/androidTest/release/app-release-androidTest.apk',
      build:
        'export RCT_NO_LAUNCH_PACKAGER=true && cd example/android && ./gradlew assembleRelease assembleAndroidTest -DtestBuildType=release && cd -',
    },
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: { type: process.env.DETOX_IOS_DEVICE || 'iPhone 17 Pro' },
    },
    emulator: {
      type: 'android.emulator',
      device: { avdName: process.env.DETOX_AVD_NAME || 'Pixel_8_Pro' },
    },
  },
  configurations: {
    'ios.sim.debug': { device: 'simulator', app: 'ios.debug' },
    'ios.sim.release': { device: 'simulator', app: 'ios.release' },
    'android.emu.debug': { device: 'emulator', app: 'android.debug' },
    'android.emu.release': { device: 'emulator', app: 'android.release' },
  },
};
