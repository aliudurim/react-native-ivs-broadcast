#import <RNIvsBroadcastSpec/RNIvsBroadcastSpec.h>

#import "RNIvsStageController.h"

@interface RNIvsStageModule : NativeRNIvsStageSpecBase <NativeRNIvsStageSpec, RNIvsStageControllerDelegate>
@end

@implementation RNIvsStageModule

RCT_EXPORT_MODULE(RNIvsStage)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (dispatch_queue_t)methodQueue
{
  return dispatch_get_main_queue();
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeRNIvsStageSpecJSI>(params);
}

- (RNIvsStageController *)controller
{
  RNIvsStageController *controller = [RNIvsStageController shared];
  controller.delegate = self;
  return controller;
}

- (void)prepareLocalMedia:(NSString *)cameraPosition
                    width:(NSInteger)width
                   height:(NSInteger)height
          targetFrameRate:(NSInteger)targetFrameRate
               maxBitrate:(NSInteger)maxBitrate
               minBitrate:(NSInteger)minBitrate
                  resolve:(RCTPromiseResolveBlock)resolve
                   reject:(RCTPromiseRejectBlock)reject
{
  NSError *error = nil;
  if ([[self controller] prepareWithCameraPosition:cameraPosition
                                              size:CGSizeMake(width, height)
                                   targetFrameRate:targetFrameRate
                                        maxBitrate:maxBitrate
                                        minBitrate:minBitrate
                                             error:&error]) {
    resolve(nil);
  } else {
    reject(@"E_PREPARE", error.localizedDescription ?: @"Could not prepare local media.", error);
  }
}

- (void)releaseLocalMedia:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [[self controller] releaseLocalMedia];
  resolve(nil);
}

- (void)joinStage:(NSString *)token resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  NSError *error = nil;
  if ([[self controller] joinWithToken:token error:&error]) {
    resolve(nil);
  } else {
    reject(@"E_JOIN", error.localizedDescription ?: @"Could not join the stage.", error);
  }
}

- (void)leaveStage:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [[self controller] leave];
  resolve(nil);
}

- (void)setMicMuted:(BOOL)muted
{
  [[self controller] setMicMuted:muted];
}

- (void)setCameraEnabled:(BOOL)enabled
{
  [[self controller] setCameraEnabled:enabled];
}

- (void)setCameraPosition:(NSString *)position
{
  [[self controller] setCameraPosition:position];
}

- (void)setDisplayName:(NSString *)name
{
  [[self controller] setDisplayName:name];
}

- (void)getSnapshot:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  resolve([[self controller] snapshot]);
}

#pragma mark - RNIvsStageControllerDelegate

- (void)stageControllerDidEmit:(NSString *)event body:(NSDictionary *)body
{
  if ([event isEqualToString:@"connection"]) [self emitOnConnectionStateChanged:body];
  else if ([event isEqualToString:@"joined"]) [self emitOnParticipantJoined:body];
  else if ([event isEqualToString:@"left"]) [self emitOnParticipantLeft:body];
  else if ([event isEqualToString:@"publishState"]) [self emitOnParticipantPublishStateChanged:body];
  else if ([event isEqualToString:@"subscribeState"]) [self emitOnParticipantSubscribeStateChanged:body];
  else if ([event isEqualToString:@"media"]) [self emitOnParticipantMediaChanged:body];
  else if ([event isEqualToString:@"error"]) [self emitOnError:body];
}

@end
