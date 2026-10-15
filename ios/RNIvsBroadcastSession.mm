#import "RNIvsBroadcastSession.h"

#import <AmazonIVSBroadcast/AmazonIVSBroadcast.h>

@implementation RNIvsVideoSettings
- (instancetype)init
{
  if (self = [super init]) {
    _bFrames = -1;
    _autoBitrate = -1;
    _autoBitrateProfile = @"default";
  }
  return self;
}
@end

static NSString *StateName(IVSBroadcastSessionState state)
{
  switch (state) {
    case IVSBroadcastSessionStateInvalid: return @"INVALID";
    case IVSBroadcastSessionStateDisconnected: return @"DISCONNECTED";
    case IVSBroadcastSessionStateConnecting: return @"CONNECTING";
    case IVSBroadcastSessionStateConnected: return @"CONNECTED";
    case IVSBroadcastSessionStateError: return @"ERROR";
  }
  return @"INVALID";
}

static IVSAspectMode AspectModeFrom(NSString *name)
{
  if ([name isEqualToString:@"fit"]) return IVSAspectModeFit;
  if ([name isEqualToString:@"fill"]) return IVSAspectModeFill;
  return IVSAspectModeNone;
}

static IVSDevicePosition PositionFrom(NSString *name)
{
  return [name isEqualToString:@"front"] ? IVSDevicePositionFront : IVSDevicePositionBack;
}

@interface RNIvsBroadcastSession () <IVSBroadcastSessionDelegate>
@end

@implementation RNIvsBroadcastSession {
  IVSBroadcastSession *_session;
  RNIvsVideoSettings *_video;
  IVSDevicePosition _position;
  IVSAspectMode _aspectMode;
  BOOL _mirrored;
  BOOL _muted;
  BOOL _cameraEnabled;
  BOOL _exchangingCamera;
  id<IVSBackgroundImageSource> _backgroundSource;
}

- (instancetype)init
{
  if (self = [super init]) {
    _video = [RNIvsVideoSettings new];
    _position = IVSDevicePositionBack;
    _aspectMode = IVSAspectModeNone;
    _cameraEnabled = YES;
    // Re-applied on foreground in case the SDK restores its devices after a background stint.
    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(applicationDidBecomeActive)
                                                 name:UIApplicationDidBecomeActiveNotification
                                               object:nil];
  }
  return self;
}

- (void)dealloc
{
  [[NSNotificationCenter defaultCenter] removeObserver:self];
}

- (void)applicationDidBecomeActive
{
  if (_session && !_cameraEnabled) [self applyCameraEnabled];
}

- (BOOL)isInitialized
{
  return _session != nil;
}

#pragma mark - Settings

- (void)setVideoSettings:(RNIvsVideoSettings *)settings
{
  _video = settings;
}

- (void)setCameraPosition:(NSString *)position
{
  IVSDevicePosition next = PositionFrom(position);
  if (next == _position) return;
  _position = next;
  if (_session) [self exchangeCamera];
}

- (void)setAspectMode:(NSString *)aspectMode
{
  IVSAspectMode next = AspectModeFrom(aspectMode);
  if (next == _aspectMode) return;
  _aspectMode = next;
  if (_session) [self refreshPreview];
}

- (void)setMirrored:(BOOL)mirrored
{
  if (mirrored == _mirrored) return;
  _mirrored = mirrored;
  if (_session) [self refreshPreview];
}

- (void)setMuted:(BOOL)muted
{
  _muted = muted;
  if (_session) [self applyMute];
}

- (void)setCameraEnabled:(BOOL)enabled
{
  if (enabled == _cameraEnabled) return;
  _cameraEnabled = enabled;
  if (_session) [self applyCameraEnabled];
}

#pragma mark - Lifecycle

- (BOOL)applyVideoSettings:(IVSBroadcastConfiguration *)config error:(NSError **)error
{
  IVSVideoConfiguration *v = config.video;
  if (_video.width > 0 || _video.height > 0) {
    if (_video.width <= 0 || _video.height <= 0) {
      if (error) {
        *error = [NSError errorWithDomain:@"RNIvsBroadcast" code:1 userInfo:@{
          NSLocalizedDescriptionKey: @"videoConfig width and height must be set together."
        }];
      }
      return NO;
    }
    if (![v setSize:CGSizeMake(_video.width, _video.height) error:error]) return NO;
  }
  if (_video.initialBitrate > 0 && ![v setInitialBitrate:_video.initialBitrate error:error]) return NO;
  if (_video.targetFrameRate > 0 && ![v setTargetFramerate:_video.targetFrameRate error:error]) return NO;
  if (_video.keyframeInterval > 0 && ![v setKeyframeInterval:(float)_video.keyframeInterval error:error]) return NO;
  if (_video.maxBitrate > 0 && ![v setMaxBitrate:_video.maxBitrate error:error]) return NO;
  if (_video.minBitrate > 0 && ![v setMinBitrate:_video.minBitrate error:error]) return NO;
  if (_video.bFrames >= 0) v.usesBFrames = _video.bFrames == 1;
  if (_video.autoBitrate >= 0) v.useAutoBitrate = _video.autoBitrate == 1;
  if ([_video.autoBitrateProfile isEqualToString:@"conservative"]) {
    v.autoBitrateProfile = IVSAutomaticBitrateProfileConservative;
  } else if ([_video.autoBitrateProfile isEqualToString:@"fastIncrease"]) {
    v.autoBitrateProfile = IVSAutomaticBitrateProfileFastIncrease;
  }
  return YES;
}

- (BOOL)initiateWithError:(NSError **)error
{
  if (_session) return YES;

  IVSBroadcastConfiguration *config = [IVSBroadcastConfiguration new];
  if (![self applyVideoSettings:config error:error]) return NO;

  NSArray<IVSDeviceDescriptor *> *descriptors = _position == IVSDevicePositionFront
    ? [[IVSPresets devices] frontCamera]
    : [[IVSPresets devices] backCamera];
  if (!_cameraEnabled) {
    descriptors = [descriptors filteredArrayUsingPredicate:
      [NSPredicate predicateWithBlock:^BOOL(IVSDeviceDescriptor *d, NSDictionary *bindings) {
        return d.type != IVSDeviceTypeCamera;
      }]];
  }

  IVSBroadcastSession *session = [[IVSBroadcastSession alloc] initWithConfiguration:config
                                                                        descriptors:descriptors
                                                                           delegate:self
                                                                              error:error];
  if (!session) return NO;
  _session = session;

  if (_muted) [self applyMute];
  [self refreshPreview];
  [self setUpBackgroundFrame:config.video.size];
  return YES;
}

- (BOOL)startWithURL:(NSString *)url streamKey:(NSString *)streamKey error:(NSError **)error
{
  NSURL *endpoint = [NSURL URLWithString:url];
  if (!_session || !endpoint) {
    if (error) {
      *error = [NSError errorWithDomain:@"RNIvsBroadcast" code:2 userInfo:@{
        NSLocalizedDescriptionKey: _session ? [NSString stringWithFormat:@"Invalid rtmpsUrl: %@", url]
                                            : @"Broadcast session is not initialized."
      }];
    }
    return NO;
  }
  return [_session startWithURL:endpoint streamKey:streamKey error:error];
}

- (void)stop
{
  [_session stop];
}

- (void)teardown
{
  if (_backgroundSource) [_session removeImageSourceOnAppBackgroundedWithError:nil];
  _backgroundSource = nil;
  [_session stop];
  _session.delegate = nil;
  _session = nil;
}

#pragma mark - Background

// iOS forbids camera capture in the background, and by default the SDK stops the whole
// broadcast when the app is backgrounded. With a background image source (plus the app's
// `audio` background mode) the RTMPS push stays up: viewers get a black frame and live audio
// until the app is foregrounded. The SDK requires this to be set up in the foreground.
- (void)setUpBackgroundFrame:(CGSize)size
{
  id<IVSBackgroundImageSource> source =
    [_session createAppBackgroundImageSourceWithAttemptTrim:YES OnComplete:^(NSError *error) {
      if (error) NSLog(@"[RNIvsBroadcast] background frame setup failed: %@", error);
    }];
  if (!source) return;

  CVPixelBufferRef frame = NULL;
  NSDictionary *attrs = @{(id)kCVPixelBufferIOSurfacePropertiesKey: @{}};
  if (CVPixelBufferCreate(kCFAllocatorDefault, (size_t)size.width, (size_t)size.height,
                          kCVPixelFormatType_32BGRA, (__bridge CFDictionaryRef)attrs, &frame) != kCVReturnSuccess) {
    return;
  }
  CVPixelBufferLockBaseAddress(frame, 0);
  uint8_t *base = (uint8_t *)CVPixelBufferGetBaseAddress(frame);
  size_t bytesPerRow = CVPixelBufferGetBytesPerRow(frame);
  size_t height = CVPixelBufferGetHeight(frame);
  size_t width = CVPixelBufferGetWidth(frame);
  for (size_t y = 0; y < height; y++) {
    uint8_t *row = base + y * bytesPerRow;
    memset(row, 0, bytesPerRow);
    for (size_t x = 0; x < width; x++) row[x * 4 + 3] = 0xFF;
  }
  CVPixelBufferUnlockBaseAddress(frame, 0);

  [source addPixelBuffer:frame];
  [source finish];
  CVPixelBufferRelease(frame);
  _backgroundSource = source;
}

#pragma mark - Devices

- (nullable id<IVSDevice>)attachedDeviceOfType:(IVSDeviceType)type
{
  for (id<IVSDevice> device in [_session listAttachedDevices]) {
    if ([device descriptor].type == type) return device;
  }
  return nil;
}

- (void)applyMute
{
  __weak __typeof(self) weakSelf = self;
  [_session awaitDeviceChanges:^{
    dispatch_async(dispatch_get_main_queue(), ^{
      __typeof(self) strongSelf = weakSelf;
      if (!strongSelf) return;
      id<IVSDevice> mic = [strongSelf attachedDeviceOfType:IVSDeviceTypeMicrophone];
      if ([mic conformsToProtocol:@protocol(IVSAudioDevice)]) {
        [(id<IVSAudioDevice>)mic setGain:strongSelf->_muted ? 0 : 1];
      }
    });
  }];
}

- (nullable IVSDeviceDescriptor *)cameraDescriptorForPosition:(IVSDevicePosition)position
{
  IVSDeviceDescriptor *fallback = nil;
  for (IVSDeviceDescriptor *d in [IVSBroadcastSession listAvailableDevices]) {
    if (d.type != IVSDeviceTypeCamera || d.position != position) continue;
    if (d.isDefault) return d;
    if (!fallback) fallback = d;
  }
  return fallback;
}

// Detaching (rather than muting) turns the camera hardware off; with no image device the
// broadcast sends black video while audio stays live.
- (void)applyCameraEnabled
{
  __weak __typeof(self) weakSelf = self;
  [_session awaitDeviceChanges:^{
    dispatch_async(dispatch_get_main_queue(), ^{
      __typeof(self) s = weakSelf;
      if (!s || !s->_session) return;
      id<IVSDevice> camera = [s attachedDeviceOfType:IVSDeviceTypeCamera];
      if (!s->_cameraEnabled) {
        if (!camera) return;
        [s->_session detachDevice:camera onComplete:^{
          dispatch_async(dispatch_get_main_queue(), ^{ [weakSelf refreshPreview]; });
        }];
        return;
      }
      if (camera) return;
      IVSDeviceDescriptor *descriptor = [s cameraDescriptorForPosition:s->_position];
      if (!descriptor) {
        [s.delegate broadcastSessionDidFail:@"Camera unavailable."];
        return;
      }
      [s->_session attachDeviceDescriptor:descriptor toSlotWithName:nil onComplete:^(id<IVSDevice> device, NSError *error) {
        dispatch_async(dispatch_get_main_queue(), ^{
          __typeof(self) strongSelf = weakSelf;
          if (!strongSelf) return;
          if (error) [strongSelf.delegate broadcastSessionDidFail:error.localizedDescription];
          [strongSelf refreshPreview];
        });
      }];
    });
  }];
}

- (void)exchangeCamera
{
  if (!_cameraEnabled || _exchangingCamera) return;
  _exchangingCamera = YES;
  __weak __typeof(self) weakSelf = self;
  [_session awaitDeviceChanges:^{
    dispatch_async(dispatch_get_main_queue(), ^{
      __typeof(self) strongSelf = weakSelf;
      if (!strongSelf || !strongSelf->_session) return;
      id<IVSDevice> camera = [strongSelf attachedDeviceOfType:IVSDeviceTypeCamera];
      IVSDeviceDescriptor *next = [strongSelf cameraDescriptorForPosition:strongSelf->_position];
      if (!camera || !next || [camera descriptor].position == strongSelf->_position) {
        strongSelf->_exchangingCamera = NO;
        return;
      }
      [strongSelf->_session exchangeOldDevice:camera withNewDevice:next onComplete:^(id<IVSDevice> newDevice, NSError *error) {
        dispatch_async(dispatch_get_main_queue(), ^{
          __typeof(self) s = weakSelf;
          if (!s) return;
          s->_exchangingCamera = NO;
          if (newDevice) {
            [s refreshPreview];
            // The position prop may have flipped again while the exchange was in flight.
            if ([newDevice descriptor].position != s->_position) [s exchangeCamera];
          } else if (error) {
            [s.delegate broadcastSessionDidFail:error.localizedDescription];
          }
        });
      }];
    });
  }];
}

- (void)refreshPreview
{
  __weak __typeof(self) weakSelf = self;
  [_session awaitDeviceChanges:^{
    dispatch_async(dispatch_get_main_queue(), ^{
      __typeof(self) strongSelf = weakSelf;
      if (!strongSelf || !strongSelf->_session) return;
      NSError *error = nil;
      IVSImagePreviewView *preview = [strongSelf->_session previewViewWithAspectMode:strongSelf->_aspectMode error:&error];
      if (!preview) {
        [strongSelf.delegate broadcastSessionDidFail:error.localizedDescription ?: @"Camera preview unavailable."];
        return;
      }
      [preview setMirrored:strongSelf->_mirrored];
      [strongSelf.delegate broadcastSessionDidReceivePreview:preview];
    });
  }];
}

#pragma mark - IVSBroadcastSessionDelegate

- (void)broadcastSession:(IVSBroadcastSession *)session didChangeState:(IVSBroadcastSessionState)state
{
  NSString *sessionId = state == IVSBroadcastSessionStateConnected ? (session.sessionId ?: @"") : @"";
  dispatch_async(dispatch_get_main_queue(), ^{
    [self.delegate broadcastSessionDidChangeState:StateName(state) sessionId:sessionId];
  });
}

- (void)broadcastSession:(IVSBroadcastSession *)session didEmitError:(NSError *)error
{
  NSString *sessionId = session.sessionId ?: @"";
  dispatch_async(dispatch_get_main_queue(), ^{
    [self.delegate broadcastSessionDidEmitError:error sessionId:sessionId];
  });
}

- (void)broadcastSession:(IVSBroadcastSession *)session
transmissionStatisticsChanged:(IVSTransmissionStatistics *)statistics
{
  dispatch_async(dispatch_get_main_queue(), ^{
    [self.delegate broadcastSessionDidUpdateStatistics:statistics];
  });
}

@end
