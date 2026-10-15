#import "RNIvsStageVideoComponentView.h"

#import <AmazonIVSBroadcast/AmazonIVSBroadcast.h>
#import <react/renderer/components/RNIvsBroadcastSpec/ComponentDescriptors.h>
#import <react/renderer/components/RNIvsBroadcastSpec/Props.h>
#import <react/renderer/components/RNIvsBroadcastSpec/RCTComponentViewHelpers.h>

#import "RCTFabricComponentsPlugins.h"
#import "RNIvsStageController.h"

using namespace facebook::react;

@interface RNIvsStageVideoComponentView () <RCTRNIvsStageVideoViewViewProtocol>
@end

@implementation RNIvsStageVideoComponentView {
  NSString *_participantId;
  BOOL _fill;
  BOOL _mirrored;
  UIView *_preview;
  __weak id _device;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<RNIvsStageVideoViewComponentDescriptor>();
}

+ (BOOL)shouldBeRecycled
{
  return NO;
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const RNIvsStageVideoViewProps>();
    _props = defaultProps;
    _participantId = @"";
    _fill = YES;
    self.clipsToBounds = YES;
    self.backgroundColor = UIColor.blackColor;
    [[RNIvsStageController shared] addVideoObserver:self selector:@selector(refreshPreview)];
  }
  return self;
}

- (void)dealloc
{
  [[RNIvsStageController shared] removeVideoObserver:self];
}

- (void)updateProps:(const Props::Shared &)props oldProps:(const Props::Shared &)oldProps
{
  const auto &next = *std::static_pointer_cast<const RNIvsStageVideoViewProps>(props);
  NSString *participantId = [NSString stringWithUTF8String:next.participantId.c_str()];
  BOOL fill = next.aspectMode == RNIvsStageVideoViewAspectMode::Fill;
  BOOL changed = ![participantId isEqualToString:_participantId] || fill != _fill;
  _participantId = participantId;
  _fill = fill;
  _mirrored = next.mirrored;

  [super updateProps:props oldProps:oldProps];

  if (changed || !_preview) {
    [self rebuildPreview];
  } else if ([_preview isKindOfClass:[IVSImagePreviewView class]]) {
    [(IVSImagePreviewView *)_preview setMirrored:_mirrored];
  }
}

- (void)refreshPreview
{
  if (_preview && [[RNIvsStageController shared] videoDeviceForParticipant:_participantId] == _device) return;
  [self rebuildPreview];
}

- (void)rebuildPreview
{
  [_preview removeFromSuperview];
  _preview = nil;
  _device = nil;
  if (!self.window && !self.superview) return;

  RNIvsStageController *controller = [RNIvsStageController shared];
  _device = [controller videoDeviceForParticipant:_participantId];
  UIView *preview = [controller previewForParticipant:_participantId fill:_fill];
  if (!preview) return;
  if ([preview isKindOfClass:[IVSImagePreviewView class]]) {
    [(IVSImagePreviewView *)preview setMirrored:_mirrored];
  }
  preview.frame = self.bounds;
  preview.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
  [self insertSubview:preview atIndex:0];
  _preview = preview;
}

- (void)didMoveToWindow
{
  [super didMoveToWindow];
  if (self.window && !_preview) [self rebuildPreview];
}

@end

Class<RCTComponentViewProtocol> RNIvsStageVideoViewCls(void)
{
  return RNIvsStageVideoComponentView.class;
}
