# Changelog

All notable changes to this project are documented here. This project follows [Semantic Versioning](https://semver.org/) and [Conventional Commits](https://www.conventionalcommits.org/).

## 0.1.0 (2026-10-16)

### Features

- `IvsBroadcastView`: RTMPS broadcast of the device camera and microphone to an Amazon IVS channel, with live camera switching, mute, camera on/off, preview aspect mode and mirroring.
- Encoder configuration through `videoConfig`: resolution, bitrate, frame rate, keyframe interval, B-frames, adaptive bitrate.
- Broadcast state, SDK error, library error and transmission-statistics callbacks.
- Background broadcasting: black frame plus live audio on iOS, a foreground service on Android.
- Real-Time Stages: `IvsStage`, `useIvsStage`, `IvsStageVideoView` and `stageStore`, with simulcast publishing and a camera-off initials card.
- Compatibility aliases `IVSBroadcastCameraView` / `IIVSBroadcastCameraView` for `amazon-ivs-react-native-broadcast`.
- Amazon IVS Broadcast SDK 1.47.0 (iOS xcframework fetched and checksum-verified at `pod install`).
