#import "RNIvsStageController.h"

#import <AmazonIVSBroadcast/AmazonIVSBroadcast.h>
#import <CoreMedia/CoreMedia.h>

static NSString *const RNIvsStageErrorDomain = @"RNIvsStage";
static NSString *const RNIvsStageVideoChanged = @"RNIvsStageVideoChanged";
static const int64_t CardFramesPerSecond = 5;

static NSError *StageError(NSInteger code, NSString *message)
{
  return [NSError errorWithDomain:RNIvsStageErrorDomain code:code userInfo:@{NSLocalizedDescriptionKey: message}];
}

static NSString *ConnectionName(IVSStageConnectionState state)
{
  switch (state) {
    case IVSStageConnectionStateDisconnected: return @"disconnected";
    case IVSStageConnectionStateConnecting: return @"connecting";
    case IVSStageConnectionStateConnected: return @"connected";
  }
  return @"disconnected";
}

static NSString *PublishName(IVSParticipantPublishState state)
{
  switch (state) {
    case IVSParticipantPublishStateNotPublished: return @"notPublished";
    case IVSParticipantPublishStateAttemptingPublish: return @"attemptingPublish";
    case IVSParticipantPublishStatePublished: return @"published";
  }
  return @"notPublished";
}

static NSString *SubscribeName(IVSParticipantSubscribeState state)
{
  switch (state) {
    case IVSParticipantSubscribeStateNotSubscribed: return @"notSubscribed";
    case IVSParticipantSubscribeStateAttemptingSubscribe: return @"attemptingSubscribe";
    case IVSParticipantSubscribeStateSubscribed: return @"subscribed";
  }
  return @"notSubscribed";
}

static IVSDevicePosition PositionFrom(NSString *position)
{
  return [position isEqualToString:@"back"] ? IVSDevicePositionBack : IVSDevicePositionFront;
}

static NSString *Initials(NSString *name)
{
  NSMutableString *initials = [NSMutableString new];
  NSInteger count = 0;
  for (NSString *part in [name componentsSeparatedByCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]]) {
    if (part.length == 0) continue;
    [initials appendString:[[part substringWithRange:[part rangeOfComposedCharacterSequenceAtIndex:0]] uppercaseString]];
    if (++count == 2) break;
  }
  return initials;
}

static UIColor *Hex(uint32_t rgb)
{
  return [UIColor colorWithRed:((rgb >> 16) & 0xff) / 255.0 green:((rgb >> 8) & 0xff) / 255.0 blue:(rgb & 0xff) / 255.0 alpha:1];
}

static void SubmitFrame(id<IVSCustomImageSource> source, CVPixelBufferRef buffer)
{
  CMVideoFormatDescriptionRef format = NULL;
  if (CMVideoFormatDescriptionCreateForImageBuffer(kCFAllocatorDefault, buffer, &format) != noErr) return;
  CMSampleTimingInfo timing = {
    .duration = CMTimeMake(1, (int32_t)CardFramesPerSecond),
    .presentationTimeStamp = CMClockGetTime(CMClockGetHostTimeClock()),
    .decodeTimeStamp = kCMTimeInvalid,
  };
  CMSampleBufferRef sample = NULL;
  if (CMSampleBufferCreateReadyWithImageBuffer(kCFAllocatorDefault, buffer, format, &timing, &sample) == noErr) {
    [source onSampleBuffer:sample];
    CFRelease(sample);
  }
  CFRelease(format);
}

static BOOL IsFatal(NSError *error)
{
  id fatal = error.userInfo[IVSBroadcastErrorIsFatalKey];
  return [fatal respondsToSelector:@selector(boolValue)] && [fatal boolValue];
}

@interface RNIvsStageController () <IVSStageStrategy, IVSStageRenderer, IVSErrorDelegate>
// Read by the strategy on SDK threads.
@property (atomic, copy) NSArray<IVSLocalStageStream *> *publishStreams;
@property (atomic) BOOL shouldPublish;
@property (atomic) IVSStageSubscribeType subscribeType;
@end

@implementation RNIvsStageController {
  IVSDeviceDiscovery *_discovery;
  id<IVSCamera> _camera;
  id<IVSMicrophone> _microphone;
  IVSLocalStageStream *_videoStream;
  IVSLocalStageStream *_audioStream;
  IVSLocalStageStreamConfiguration *_config;
  // Published in place of the camera while it is off: IVS compositions draw their own icon for muted video.
  id<IVSCustomImageSource> _cardSource;
  IVSLocalStageStream *_cardStream;
  IVSLocalStageStream *_publishedVideo;
  dispatch_source_t _cardTimer;
  dispatch_queue_t _cardQueue;
  NSString *_displayName;
  NSString *_tokenDisplayName;
  IVSStage *_stage;
  NSString *_connection;
  NSString *_localParticipantId;
  NSMutableDictionary<NSString *, NSMutableDictionary *> *_participants;
  NSMutableDictionary<NSString *, NSArray<IVSStageStream *> *> *_streams;
  IVSDevicePosition _position;
  BOOL _cameraEnabled;
  BOOL _micMuted;
  BOOL _backgrounded;
}

+ (instancetype)shared
{
  static RNIvsStageController *instance;
  static dispatch_once_t once;
  dispatch_once(&once, ^{ instance = [RNIvsStageController new]; });
  return instance;
}

- (instancetype)init
{
  if (self = [super init]) {
    _connection = @"disconnected";
    _participants = [NSMutableDictionary new];
    _streams = [NSMutableDictionary new];
    _position = IVSDevicePositionFront;
    _cameraEnabled = YES;
    _publishStreams = @[];
    _subscribeType = IVSStageSubscribeTypeAudioVideo;
    _cardQueue = dispatch_queue_create("com.ivsbroadcast.card", DISPATCH_QUEUE_SERIAL);
    NSNotificationCenter *center = [NSNotificationCenter defaultCenter];
    [center addObserver:self selector:@selector(appDidEnterBackground) name:UIApplicationDidEnterBackgroundNotification object:nil];
    [center addObserver:self selector:@selector(appWillEnterForeground) name:UIApplicationWillEnterForegroundNotification object:nil];
  }
  return self;
}

#pragma mark - Local media

- (BOOL)prepareWithCameraPosition:(NSString *)position
                             size:(CGSize)size
                  targetFrameRate:(NSInteger)targetFrameRate
                       maxBitrate:(NSInteger)maxBitrate
                       minBitrate:(NSInteger)minBitrate
                            error:(NSError **)error
{
  _position = PositionFrom(position);
  if (_videoStream) {
    [self applyCameraPosition];
    return YES;
  }

  [[IVSStageAudioManager sharedInstance] setPreset:IVSStageAudioManagerUseCasePresetVideoChat];

  _discovery = [IVSDeviceDiscovery new];
  for (id<IVSDevice> device in [_discovery listLocalDevices]) {
    if (!_camera && [device conformsToProtocol:@protocol(IVSCamera)]) _camera = (id<IVSCamera>)device;
    if (!_microphone && [device conformsToProtocol:@protocol(IVSMicrophone)]) _microphone = (id<IVSMicrophone>)device;
  }
  if (!_camera || !_microphone) {
    if (error) *error = StageError(1, _camera ? @"No microphone available." : @"No camera available.");
    [self releaseLocalMedia];
    return NO;
  }

  IVSLocalStageStreamConfiguration *config = [IVSLocalStageStreamConfiguration new];
  IVSLocalStageStreamVideoConfiguration *video = config.video;
  if ((size.width > 0 && ![video setSize:size error:error]) ||
      (targetFrameRate > 0 && ![video setTargetFramerate:targetFrameRate error:error]) ||
      (maxBitrate > 0 && ![video setMaxBitrate:maxBitrate error:error]) ||
      (minBitrate > 0 && ![video setMinBitrate:minBitrate error:error])) {
    [self releaseLocalMedia];
    return NO;
  }
  video.simulcast.enabled = YES;

  _camera.errorDelegate = self;
  _microphone.errorDelegate = self;
  [self applyCameraPosition];
  _config = config;
  _videoStream = [[IVSLocalStageStream alloc] initWithDevice:_camera config:config];
  _audioStream = [[IVSLocalStageStream alloc] initWithDevice:_microphone config:config];
  [_audioStream setMuted:_micMuted];
  [self applyVideoState];
  [self notifyVideoChanged];
  return YES;
}

- (void)releaseLocalMedia
{
  [self stopCardFrames];
  _cardStream = nil;
  _cardSource = nil;
  _publishedVideo = nil;
  _config = nil;
  _videoStream = nil;
  _audioStream = nil;
  _camera = nil;
  _microphone = nil;
  _discovery = nil;
  [self updateStrategy];
  [self notifyVideoChanged];
}

- (void)applyCameraPosition
{
  if (!_camera || [_camera descriptor].position == _position) return;
  IVSDeviceDescriptor *target = nil;
  for (IVSDeviceDescriptor *d in [_camera listAvailableInputSources]) {
    if (d.position != _position) continue;
    if (d.isDefault || !target) target = d;
  }
  if (!target) return;
  __weak __typeof(self) weakSelf = self;
  [_camera setPreferredInputSource:target onComplete:^(NSError *error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      __typeof(self) s = weakSelf;
      if (!s) return;
      if (error) [s emitError:error];
      [s notifyVideoChanged];
    });
  }];
}

- (void)setMicMuted:(BOOL)muted
{
  _micMuted = muted;
  [_audioStream setMuted:muted];
  if (_localParticipantId) [self mediaChangedForParticipant:_localParticipantId];
}

- (void)setCameraEnabled:(BOOL)enabled
{
  _cameraEnabled = enabled;
  [self applyVideoState];
  if (_localParticipantId) [self mediaChangedForParticipant:_localParticipantId];
}

- (void)setDisplayName:(NSString *)name
{
  if ([name isEqualToString:_displayName]) return;
  _displayName = [name copy];
  [self redrawCard];
}

#pragma mark - Camera-off card

// Never unpublishes: the card replaces the camera as the published video, muting is only the fallback.
- (void)applyVideoState
{
  BOOL cardWanted = _videoStream && !_cameraEnabled;
  if (cardWanted && !_cardStream && _discovery && _config) {
    _cardSource = [_discovery createImageSourceWithName:@"camera-off-card"];
    if (_cardSource) _cardStream = [[IVSLocalStageStream alloc] initWithDevice:_cardSource config:_config];
  }
  BOOL showCard = cardWanted && _cardStream;
  [_videoStream setMuted:!_cameraEnabled || _backgrounded];
  [_cardStream setMuted:_backgrounded];
  // The encoder is unavailable in the background, so frames only flow in the foreground.
  if (showCard && !_backgrounded) [self startCardFrames];
  else [self stopCardFrames];
  _publishedVideo = showCard ? _cardStream : _videoStream;
  [self updateStrategy];
}

- (void)redrawCard
{
  if (!_cardTimer) return;
  [self stopCardFrames];
  [self startCardFrames];
}

- (void)startCardFrames
{
  if (_cardTimer || !_cardSource) return;
  CVPixelBufferRef buffer = [self renderCard];
  if (!buffer) return;
  id<IVSCustomImageSource> source = _cardSource;
  dispatch_source_t timer = dispatch_source_create(DISPATCH_SOURCE_TYPE_TIMER, 0, 0, _cardQueue);
  dispatch_source_set_timer(timer, DISPATCH_TIME_NOW, NSEC_PER_SEC / CardFramesPerSecond, 10 * NSEC_PER_MSEC);
  dispatch_source_set_event_handler(timer, ^{ SubmitFrame(source, buffer); });
  dispatch_source_set_cancel_handler(timer, ^{ CVPixelBufferRelease(buffer); });
  dispatch_resume(timer);
  _cardTimer = timer;
}

- (void)stopCardFrames
{
  if (!_cardTimer) return;
  dispatch_source_cancel(_cardTimer);
  _cardTimer = nil;
}

- (CVPixelBufferRef)renderCard CF_RETURNS_RETAINED
{
  CGSize size = _config.video.size;
  size_t width = MAX((size_t)size.width, 2), height = MAX((size_t)size.height, 2);
  NSDictionary *attributes = @{
    (id)kCVPixelBufferIOSurfacePropertiesKey: @{},
    (id)kCVPixelBufferCGBitmapContextCompatibilityKey: @YES,
  };
  CVPixelBufferRef buffer = NULL;
  if (CVPixelBufferCreate(kCFAllocatorDefault, width, height, kCVPixelFormatType_32BGRA,
                          (__bridge CFDictionaryRef)attributes, &buffer) != kCVReturnSuccess) {
    return NULL;
  }
  CVPixelBufferLockBaseAddress(buffer, 0);
  CGColorSpaceRef rgb = CGColorSpaceCreateDeviceRGB();
  CGContextRef context = CGBitmapContextCreate(CVPixelBufferGetBaseAddress(buffer), width, height, 8,
                                               CVPixelBufferGetBytesPerRow(buffer), rgb,
                                               kCGImageAlphaPremultipliedFirst | kCGBitmapByteOrder32Little);
  CGColorSpaceRelease(rgb);
  if (context) {
    CGContextTranslateCTM(context, 0, height);
    CGContextScaleCTM(context, 1, -1);
    UIGraphicsPushContext(context);
    [self drawCardWithSize:CGSizeMake(width, height)];
    UIGraphicsPopContext();
    CGContextRelease(context);
  }
  CVPixelBufferUnlockBaseAddress(buffer, 0);
  return buffer;
}

- (void)drawCardWithSize:(CGSize)size
{
  [Hex(0x121212) setFill];
  UIRectFill(CGRectMake(0, 0, size.width, size.height));

  CGFloat radius = round(MIN(size.width, size.height) * 0.1);
  CGPoint center = CGPointMake(size.width / 2, size.height / 2);
  [Hex(0x2c2c2c) setFill];
  [[UIBezierPath bezierPathWithOvalInRect:CGRectMake(center.x - radius, center.y - radius, radius * 2, radius * 2)] fill];

  NSString *name = _displayName.length ? _displayName : _tokenDisplayName;
  NSString *text = Initials(name ?: @"");
  if (text.length == 0) text = @"•";
  CGFloat fontSize = round(radius * 0.8);
  UIFont *font = [UIFont boldSystemFontOfSize:fontSize];
  NSDictionary *attributes = @{NSFontAttributeName: font, NSForegroundColorAttributeName: UIColor.whiteColor};
  CGSize textSize = [text sizeWithAttributes:attributes];
  // Initials are capitals, so centre the cap height rather than the line box.
  CGFloat top = center.y + font.capHeight / 2 - font.ascender;
  [text drawAtPoint:CGPointMake(center.x - textSize.width / 2, top) withAttributes:attributes];
}

- (void)setCameraPosition:(NSString *)position
{
  _position = PositionFrom(position);
  [self applyCameraPosition];
}

#pragma mark - Stage

- (BOOL)joinWithToken:(NSString *)token error:(NSError **)error
{
  if (_stage) [self leave];

  IVSStage *stage = [[IVSStage alloc] initWithToken:token strategy:self error:error];
  if (!stage) return NO;
  stage.errorDelegate = self;
  [stage addRenderer:self];
  _stage = stage;
  [self updateStrategy];
  if (![stage joinWithError:error]) {
    [self resetStage];
    return NO;
  }
  return YES;
}

- (void)leave
{
  [_stage leave];
  [self resetStage];
  [self setConnection:IVSStageConnectionStateDisconnected error:nil];
}

- (void)resetStage
{
  [_stage removeRenderer:self];
  _stage = nil;
  _localParticipantId = nil;
  [_participants removeAllObjects];
  [_streams removeAllObjects];
  [self notifyVideoChanged];
}

- (void)updateStrategy
{
  NSMutableArray<IVSLocalStageStream *> *streams = [NSMutableArray new];
  if (_publishedVideo) [streams addObject:_publishedVideo];
  if (_audioStream) [streams addObject:_audioStream];
  self.publishStreams = streams;
  // Publishing never stops while joined: camera-off swaps in the card, so viewers never see the participant drop.
  self.shouldPublish = streams.count > 0;
  self.subscribeType = _backgrounded ? IVSStageSubscribeTypeAudioOnly : IVSStageSubscribeTypeAudioVideo;
  [_stage refreshStrategy];
}

// iOS suspends the camera in the background; the audio background mode keeps the mic live.
- (void)appDidEnterBackground
{
  _backgrounded = YES;
  [self applyVideoState];
  if (_localParticipantId) [self mediaChangedForParticipant:_localParticipantId];
}

- (void)appWillEnterForeground
{
  _backgrounded = NO;
  [self applyVideoState];
  if (_localParticipantId) [self mediaChangedForParticipant:_localParticipantId];
}

#pragma mark - IVSStageStrategy

- (NSArray<IVSLocalStageStream *> *)stage:(IVSStage *)stage streamsToPublishForParticipant:(IVSParticipantInfo *)participant
{
  return self.publishStreams;
}

- (BOOL)stage:(IVSStage *)stage shouldPublishParticipant:(IVSParticipantInfo *)participant
{
  return self.shouldPublish;
}

- (IVSStageSubscribeType)stage:(IVSStage *)stage shouldSubscribeToParticipant:(IVSParticipantInfo *)participant
{
  return self.subscribeType;
}

#pragma mark - IVSStageRenderer

- (void)stage:(IVSStage *)stage didChangeConnectionState:(IVSStageConnectionState)connectionState withError:(NSError *)error
{
  dispatch_async(dispatch_get_main_queue(), ^{
    if (stage != self->_stage) return;
    [self setConnection:connectionState error:error];
    // Kicked, token revoked or stage deleted: the SDK won't reconnect.
    if (connectionState == IVSStageConnectionStateDisconnected && error && IsFatal(error)) [self resetStage];
  });
}

- (void)stage:(IVSStage *)stage participantDidJoin:(IVSParticipantInfo *)participant
{
  NSMutableDictionary *entry = [@{
    @"participantId": participant.participantId,
    @"userId": participant.userId ?: @"",
    @"isLocal": @(participant.isLocal),
    @"attributesJson": [self attributesJson:participant.attributes],
    @"publishState": @"notPublished",
    @"subscribeState": @"notSubscribed",
  } mutableCopy];
  NSString *tokenName = participant.isLocal ? participant.attributes[@"display_name"] : nil;
  dispatch_async(dispatch_get_main_queue(), ^{
    if (stage != self->_stage) return;
    NSString *pid = entry[@"participantId"];
    if ([entry[@"isLocal"] boolValue]) {
      self->_localParticipantId = pid;
      if (tokenName.length && ![tokenName isEqualToString:self->_tokenDisplayName]) {
        self->_tokenDisplayName = tokenName;
        if (self->_displayName.length == 0) [self redrawCard];
      }
    }
    self->_participants[pid] = entry;
    [entry addEntriesFromDictionary:[self mediaForParticipant:pid]];
    [self emit:@"joined" body:[entry copy]];
  });
}

- (void)stage:(IVSStage *)stage participantDidLeave:(IVSParticipantInfo *)participant
{
  NSString *pid = participant.participantId;
  dispatch_async(dispatch_get_main_queue(), ^{
    if (stage != self->_stage) return;
    [self->_participants removeObjectForKey:pid];
    [self->_streams removeObjectForKey:pid];
    if ([self->_localParticipantId isEqualToString:pid]) self->_localParticipantId = nil;
    [self emit:@"left" body:@{@"participantId": pid}];
    [self notifyVideoChanged];
  });
}

- (void)stage:(IVSStage *)stage participant:(IVSParticipantInfo *)participant didChangePublishState:(IVSParticipantPublishState)publishState
{
  NSString *pid = participant.participantId;
  NSString *state = PublishName(publishState);
  dispatch_async(dispatch_get_main_queue(), ^{
    if (stage != self->_stage) return;
    self->_participants[pid][@"publishState"] = state;
    [self emit:@"publishState" body:@{@"participantId": pid, @"state": state}];
  });
}

- (void)stage:(IVSStage *)stage participant:(IVSParticipantInfo *)participant didChangeSubscribeState:(IVSParticipantSubscribeState)subscribeState
{
  NSString *pid = participant.participantId;
  NSString *state = SubscribeName(subscribeState);
  dispatch_async(dispatch_get_main_queue(), ^{
    if (stage != self->_stage) return;
    self->_participants[pid][@"subscribeState"] = state;
    [self emit:@"subscribeState" body:@{@"participantId": pid, @"state": state}];
  });
}

- (void)stage:(IVSStage *)stage participant:(IVSParticipantInfo *)participant didAddStreams:(NSArray<IVSStageStream *> *)streams
{
  NSString *pid = participant.participantId;
  dispatch_async(dispatch_get_main_queue(), ^{
    if (stage != self->_stage) return;
    NSMutableArray *next = [NSMutableArray arrayWithArray:self->_streams[pid] ?: @[]];
    for (IVSStageStream *s in streams) {
      if (![next containsObject:s]) [next addObject:s];
    }
    self->_streams[pid] = next;
    [self mediaChangedForParticipant:pid];
  });
}

- (void)stage:(IVSStage *)stage participant:(IVSParticipantInfo *)participant didRemoveStreams:(NSArray<IVSStageStream *> *)streams
{
  NSString *pid = participant.participantId;
  dispatch_async(dispatch_get_main_queue(), ^{
    if (stage != self->_stage) return;
    NSMutableArray *next = [NSMutableArray arrayWithArray:self->_streams[pid] ?: @[]];
    [next removeObjectsInArray:streams];
    self->_streams[pid] = next;
    [self mediaChangedForParticipant:pid];
  });
}

- (void)stage:(IVSStage *)stage participant:(IVSParticipantInfo *)participant didChangeMutedStreams:(NSArray<IVSStageStream *> *)streams
{
  NSString *pid = participant.participantId;
  dispatch_async(dispatch_get_main_queue(), ^{
    if (stage != self->_stage) return;
    [self mediaChangedForParticipant:pid];
  });
}

#pragma mark - IVSErrorDelegate

- (void)source:(id<IVSErrorSource>)source didEmitError:(NSError *)error
{
  dispatch_async(dispatch_get_main_queue(), ^{ [self emitError:error]; });
}

#pragma mark - Snapshot & previews

- (NSDictionary *)snapshot
{
  NSMutableArray *participants = [NSMutableArray new];
  for (NSString *pid in _participants) {
    NSMutableDictionary *entry = [_participants[pid] mutableCopy];
    [entry addEntriesFromDictionary:[self mediaForParticipant:pid]];
    [participants addObject:entry];
  }
  return @{
    @"connection": _connection,
    @"localParticipantId": _localParticipantId ?: @"",
    @"participants": participants,
  };
}

- (id)videoDeviceForParticipant:(NSString *)participantId
{
  if (participantId.length == 0 || [participantId isEqualToString:_localParticipantId]) return _camera;
  for (IVSStageStream *s in _streams[participantId]) {
    if ([s.device conformsToProtocol:@protocol(IVSImageDevice)]) return s.device;
  }
  return nil;
}

- (UIView *)previewForParticipant:(NSString *)participantId fill:(BOOL)fill
{
  id<IVSImageDevice> device = [self videoDeviceForParticipant:participantId];
  if (!device) return nil;
  NSError *error = nil;
  UIView *preview = [device previewViewWithAspectMode:fill ? IVSAspectModeFill : IVSAspectModeFit error:&error];
  if (!preview && error) [self emitError:error];
  return preview;
}

- (void)addVideoObserver:(id)observer selector:(SEL)selector
{
  [[NSNotificationCenter defaultCenter] addObserver:observer selector:selector name:RNIvsStageVideoChanged object:self];
}

- (void)removeVideoObserver:(id)observer
{
  [[NSNotificationCenter defaultCenter] removeObserver:observer name:RNIvsStageVideoChanged object:self];
}

#pragma mark - Helpers

- (NSDictionary *)mediaForParticipant:(NSString *)pid
{
  NSArray<IVSStageStream *> *streams = _streams[pid];
  if ([pid isEqualToString:_localParticipantId] && streams.count == 0) {
    streams = self.publishStreams;
  }
  BOOL hasVideo = NO, hasAudio = NO, videoMuted = NO, audioMuted = NO;
  for (IVSStageStream *s in streams) {
    if ([s.device conformsToProtocol:@protocol(IVSImageDevice)]) {
      hasVideo = YES;
      videoMuted = s.isMuted;
    } else if ([s.device conformsToProtocol:@protocol(IVSAudioDevice)]) {
      hasAudio = YES;
      audioMuted = s.isMuted;
    }
  }
  // Our own card is published unmuted, but the local UI still treats the camera as off.
  if (hasVideo && [pid isEqualToString:_localParticipantId]) videoMuted = !_cameraEnabled || _backgrounded;
  return @{
    @"hasVideo": @(hasVideo),
    @"hasAudio": @(hasAudio),
    @"videoMuted": @(videoMuted),
    @"audioMuted": @(audioMuted),
  };
}

- (void)mediaChangedForParticipant:(NSString *)pid
{
  if (!_participants[pid]) return;
  NSMutableDictionary *body = [[self mediaForParticipant:pid] mutableCopy];
  body[@"participantId"] = pid;
  [self emit:@"media" body:body];
  [self notifyVideoChanged];
}

- (void)setConnection:(IVSStageConnectionState)state error:(NSError *)error
{
  _connection = ConnectionName(state);
  [self emit:@"connection" body:@{
    @"state": _connection,
    @"errorCode": @(error ? error.code : 0),
    @"errorMessage": error.localizedDescription ?: @"",
  }];
}

- (NSString *)attributesJson:(NSDictionary<NSString *, NSString *> *)attributes
{
  if (attributes.count == 0) return @"{}";
  NSData *data = [NSJSONSerialization dataWithJSONObject:attributes options:0 error:nil];
  return data ? [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding] : @"{}";
}

- (void)emitError:(NSError *)error
{
  [self emit:@"error" body:@{
    @"code": @(error.code),
    @"message": error.localizedDescription ?: @"",
    @"isFatal": @(IsFatal(error)),
  }];
}

- (void)emit:(NSString *)event body:(NSDictionary *)body
{
  [self.delegate stageControllerDidEmit:event body:body];
}

- (void)notifyVideoChanged
{
  [[NSNotificationCenter defaultCenter] postNotificationName:RNIvsStageVideoChanged object:self];
}

@end
