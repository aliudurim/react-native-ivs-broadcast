#import "RNIvsBroadcastComponentView.h"

#import <AmazonIVSBroadcast/AmazonIVSBroadcast.h>
#import <React/RCTConversions.h>
#import <react/renderer/components/RNIvsBroadcastSpec/ComponentDescriptors.h>
#import <react/renderer/components/RNIvsBroadcastSpec/EventEmitters.h>
#import <react/renderer/components/RNIvsBroadcastSpec/Props.h>
#import <react/renderer/components/RNIvsBroadcastSpec/RCTComponentViewHelpers.h>

#import "RCTFabricComponentsPlugins.h"
#import "RNIvsBroadcastSession.h"

using namespace facebook::react;

static NSString *ToNSString(const std::string &value)
{
  return [NSString stringWithUTF8String:value.c_str()];
}

static std::string ToStdString(NSString *_Nullable value)
{
  return value ? std::string([value UTF8String]) : std::string();
}

static NSString *NetworkHealthName(IVSTransmissionStatisticsNetworkHealth health)
{
  switch (health) {
    case IVSTransmissionStatisticsNetworkHealthExcellent: return @"EXCELLENT";
    case IVSTransmissionStatisticsNetworkHealthHigh: return @"HIGH";
    case IVSTransmissionStatisticsNetworkHealthMedium: return @"MEDIUM";
    case IVSTransmissionStatisticsNetworkHealthLow: return @"LOW";
    case IVSTransmissionStatisticsNetworkHealthBad: return @"BAD";
  }
  return @"MEDIUM";
}

static NSString *BroadcastQualityName(IVSTransmissionStatisticsBroadcastQuality quality)
{
  switch (quality) {
    case IVSTransmissionStatisticsBroadcastQualityNearMaximum: return @"NEAR_MAXIMUM";
    case IVSTransmissionStatisticsBroadcastQualityHigh: return @"HIGH";
    case IVSTransmissionStatisticsBroadcastQualityMedium: return @"MEDIUM";
    case IVSTransmissionStatisticsBroadcastQualityLow: return @"LOW";
    case IVSTransmissionStatisticsBroadcastQualityNearMinimum: return @"NEAR_MINIMUM";
  }
  return @"MEDIUM";
}

@interface RNIvsBroadcastComponentView () <RCTRNIvsBroadcastViewViewProtocol, RNIvsBroadcastSessionDelegate>
@end

@implementation RNIvsBroadcastComponentView {
  RNIvsBroadcastSession *_session;
  NSString *_rtmpsUrl;
  NSString *_streamKey;
  UIView *_preview;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<RNIvsBroadcastViewComponentDescriptor>();
}

// A recycled view would keep its camera and RTMPS session alive for the next mount.
+ (BOOL)shouldBeRecycled
{
  return NO;
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const RNIvsBroadcastViewProps>();
    _props = defaultProps;
    _session = [RNIvsBroadcastSession new];
    _session.delegate = self;
    self.clipsToBounds = YES;
  }
  return self;
}

- (void)dealloc
{
  [_session teardown];
  [UIApplication sharedApplication].idleTimerDisabled = NO;
}

- (void)updateProps:(const Props::Shared &)props oldProps:(const Props::Shared &)oldProps
{
  const auto &next = *std::static_pointer_cast<const RNIvsBroadcastViewProps>(props);

  _rtmpsUrl = ToNSString(next.rtmpsUrl);
  _streamKey = ToNSString(next.streamKey);

  RNIvsVideoSettings *video = [RNIvsVideoSettings new];
  video.width = next.videoWidth;
  video.height = next.videoHeight;
  video.initialBitrate = next.videoBitrate;
  video.targetFrameRate = next.videoTargetFrameRate;
  video.keyframeInterval = next.videoKeyframeInterval;
  video.bFrames = next.videoBFrames;
  video.autoBitrate = next.videoAutoBitrate;
  video.autoBitrateProfile = ToNSString(toString(next.videoAutoBitrateProfile));
  video.maxBitrate = next.videoMaxBitrate;
  video.minBitrate = next.videoMinBitrate;
  [_session setVideoSettings:video];

  [_session setCameraPosition:ToNSString(toString(next.cameraPosition))];
  [_session setAspectMode:ToNSString(toString(next.cameraPreviewAspectMode))];
  [_session setMirrored:next.isCameraPreviewMirrored];
  [_session setMuted:next.isMuted];
  [_session setCameraEnabled:next.isCameraEnabled];

  [super updateProps:props oldProps:oldProps];
}

- (void)didMoveToWindow
{
  [super didMoveToWindow];
  if (!self.window || _session.isInitialized) return;

  NSError *error = nil;
  if (![_session initiateWithError:&error]) {
    [self emitNativeError:error.localizedDescription ?: @"Could not start the broadcast session."];
    return;
  }
  // A sleeping device interrupts the broadcast.
  [UIApplication sharedApplication].idleTimerDisabled = YES;
}

- (void)handleCommand:(const NSString *)commandName args:(const NSArray *)args
{
  RCTRNIvsBroadcastViewHandleCommand(self, commandName, args);
}

#pragma mark - RCTRNIvsBroadcastViewViewProtocol

- (void)start:(NSString *)rtmpsUrl streamKey:(NSString *)streamKey
{
  NSString *url = rtmpsUrl.length ? rtmpsUrl : _rtmpsUrl;
  NSString *key = streamKey.length ? streamKey : _streamKey;
  if (!url.length) {
    [self emitNativeError:@"'rtmpsUrl' is empty."];
    return;
  }
  if (!key.length) {
    [self emitNativeError:@"'streamKey' is empty."];
    return;
  }
  NSError *error = nil;
  if (![_session startWithURL:url streamKey:key error:&error]) {
    [self emitNativeError:error.localizedDescription ?: @"Could not start the broadcast."];
  }
}

- (void)stop
{
  [_session stop];
}

#pragma mark - RNIvsBroadcastSessionDelegate

- (void)broadcastSessionDidReceivePreview:(UIView *)preview
{
  [_preview removeFromSuperview];
  _preview = preview;
  preview.frame = self.bounds;
  preview.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
  [self insertSubview:preview atIndex:0];
}

- (void)broadcastSessionDidChangeState:(NSString *)state sessionId:(NSString *)sessionId
{
  auto emitter = std::static_pointer_cast<const RNIvsBroadcastViewEventEmitter>(_eventEmitter);
  if (!emitter) return;
  emitter->onBroadcastStateChanged(RNIvsBroadcastViewEventEmitter::OnBroadcastStateChanged{
    .stateStatus = ToStdString(state),
    .sessionId = ToStdString(sessionId),
  });
}

- (void)broadcastSessionDidEmitError:(NSError *)error sessionId:(NSString *)sessionId
{
  auto emitter = std::static_pointer_cast<const RNIvsBroadcastViewEventEmitter>(_eventEmitter);
  if (!emitter) return;
  id source = error.userInfo[IVSBroadcastSourceDescriptionErrorKey];
  id fatal = error.userInfo[IVSBroadcastErrorIsFatalKey];
  emitter->onBroadcastError(RNIvsBroadcastViewEventEmitter::OnBroadcastError{
    .code = (int)error.code,
    .type = ToStdString(error.domain),
    .source = ToStdString([source isKindOfClass:[NSString class]] ? source : nil),
    .detail = ToStdString(error.localizedDescription),
    .isFatal = [fatal respondsToSelector:@selector(boolValue)] ? (bool)[fatal boolValue] : false,
    .sessionId = ToStdString(sessionId),
  });
}

- (void)broadcastSessionDidUpdateStatistics:(IVSTransmissionStatistics *)statistics
{
  auto emitter = std::static_pointer_cast<const RNIvsBroadcastViewEventEmitter>(_eventEmitter);
  if (!emitter) return;
  emitter->onTransmissionStatisticsChanged(RNIvsBroadcastViewEventEmitter::OnTransmissionStatisticsChanged{
    .rtt = statistics.rtt,
    .measuredBitrate = statistics.measuredBitrate,
    .recommendedBitrate = statistics.recommendedBitrate,
    .networkHealth = ToStdString(NetworkHealthName(statistics.networkHealth)),
    .broadcastQuality = ToStdString(BroadcastQualityName(statistics.broadcastQuality)),
  });
}

- (void)broadcastSessionDidFail:(NSString *)message
{
  [self emitNativeError:message];
}

- (void)emitNativeError:(NSString *)message
{
  auto emitter = std::static_pointer_cast<const RNIvsBroadcastViewEventEmitter>(_eventEmitter);
  if (!emitter) return;
  emitter->onNativeError(RNIvsBroadcastViewEventEmitter::OnNativeError{.message = ToStdString(message)});
}

@end

Class<RCTComponentViewProtocol> RNIvsBroadcastViewCls(void)
{
  return RNIvsBroadcastComponentView.class;
}
