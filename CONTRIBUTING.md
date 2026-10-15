# Contributing

Contributions are always welcome, no matter how large or small!

We want this community to be friendly and respectful to each other. Please follow it in all your interactions with the project. Before contributing, please read the [code of conduct](./CODE_OF_CONDUCT.md).

## Development workflow

This project is a monorepo managed using [Yarn workspaces](https://yarnpkg.com/features/workspaces). It contains the following packages:

- The library package in the root directory.
- An example app in the `example/` directory.

To get started with the project, make sure you have the correct version of [Node.js](https://nodejs.org/) installed. See the [`.nvmrc`](./.nvmrc) file for the version used in this project.

Run `yarn` in the root directory to install the required dependencies for each package:

```sh
yarn
```

> Since the project relies on Yarn workspaces, you cannot use [`npm`](https://github.com/npm/cli) for development without manually migrating.

The [example app](/example/) demonstrates usage of the library. You need to run it to test any changes you make.

It is configured to use the local version of the library, so any changes you make to the library's source code will be reflected in the example app. Changes to the library's JavaScript code will be reflected in the example app without a rebuild, but native code changes will require a rebuild of the example app.

If you want to use Android Studio or Xcode to edit the native code, you can open the `example/android` or `example/ios` directories respectively in those editors. To edit the Objective-C or Swift files, open `example/ios/IvsBroadcastExample.xcworkspace` in Xcode and find the source files at `Pods > Development Pods > react-native-ivs-broadcast`.

To edit the Java or Kotlin files, open `example/android` in Android studio and find the source files at `react-native-ivs-broadcast` under `Android`.

You can use various commands from the root directory to work with the project.

To start the packager:

```sh
yarn example start
```

To run the example app on Android:

```sh
yarn example android
```

To run the example app on iOS:

```sh
yarn example ios
```

To confirm that the app is running with the new architecture, you can check the Metro logs for a message like this:

```sh
Running "IvsBroadcastExample" with {"fabric":true,"initialProps":{"concurrentRoot":true},"rootTag":1}
```

Note the `"fabric":true` and `"concurrentRoot":true` properties.

Make sure your code passes TypeScript:

```sh
yarn typecheck
```

To check for linting errors, run the following:

```sh
yarn lint
```

To fix formatting errors, run the following:

```sh
yarn lint --fix
```



### Example app

The example has a **Broadcast** screen and a **Stage** screen. Each exposes every prop and method as a control and writes every event to an on-screen log. The e2e tests drive the app through that log.

- **Broadcast**: paste a channel's ingest endpoint (`rtmps://…:443/app/`) and stream key, then tap *Start*.
- **Stage**: tap *Prepare*, paste a participant token from `aws ivs-realtime create-participant-token --stage-arn <arn>`, then tap *Join*. Join from a second device or the [IVS web sample](https://codepen.io/amazon-ivs/project/editor/ZzWobn) to see remote video.

Simulators have no camera, so *Prepare* rejects there and the broadcast preview stays black. Use a real device to see video.

The first `pod install` downloads the Amazon IVS SDK into `ios/Frameworks` (git-ignored). Delete that folder to force a fresh download.

### Unit tests

```sh
yarn test
```

Jest tests live in `src/__tests__`. They cover the JS layer: prop mapping, event reshaping, the stage reducer and store, the native-module bridge (with a mocked TurboModule) and the hook.

### End-to-end tests

[Detox](https://wix.github.io/Detox/) suites in [`e2e/`](./e2e) run against the example app in **release** mode, so no Metro is needed:

```sh
# iOS: requires applesimutils:
#   brew tap wix/brew && brew trust wix/brew && brew install applesimutils
yarn e2e:build:ios:release && yarn e2e:test:ios:release

# Android: boots the AVD named in DETOX_AVD_NAME (default Pixel_8_Pro)
yarn e2e:build:android:release && yarn e2e:test:android:release
```

Set `DETOX_IOS_DEVICE` / `DETOX_AVD_NAME` to pick a different simulator or emulator. The debug configurations (`yarn e2e:build:ios`, `yarn e2e:test:ios`, …) use Metro instead.

### Scripts

- `yarn`: install dependencies for the library and the example.
- `yarn typecheck`: type-check with TypeScript.
- `yarn lint`: lint with ESLint and Prettier (`yarn lint --fix` to fix).
- `yarn test`: run the unit tests.
- `yarn prepare`: build `lib/` with react-native-builder-bob.
- `yarn pods`: install the example's CocoaPods.
- `yarn example start | ios | android`: run the example app.
- `yarn e2e:*`: build and run the Detox suites (see above).
- `yarn release`: cut a release (see below).

### Commit messages

We follow [Conventional Commits](https://www.conventionalcommits.org/): `fix:`, `feat:`, `refactor:`, `docs:`, `test:`, `chore:`. [lefthook](https://github.com/evilmartians/lefthook) runs commitlint on each commit message, and ESLint plus TypeScript on staged files.

### Publishing to npm

[release-it](https://github.com/release-it/release-it) bumps the version, updates `CHANGELOG.md`, tags `vX.Y.Z`, publishes to npm and creates the GitHub release:

```sh
yarn release
```

Pushing a `vX.Y.Z` tag also triggers the [publish workflow](.github/workflows/publish.yml), which publishes with npm provenance. Use one route or the other.

### Sending a pull request

> **Working on your first pull request?** You can learn how from this _free_ series: [How to Contribute to an Open Source Project on GitHub](https://app.egghead.io/playlists/how-to-contribute-to-an-open-source-project-on-github).

When you're sending a pull request:

- Prefer small pull requests focused on one change.
- Verify that linters and tests are passing.
- Review the documentation to make sure it looks good.
- Follow the pull request template when opening a pull request.
- For pull requests that change the API or implementation, discuss with maintainers first by opening an issue.
