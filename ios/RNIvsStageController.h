#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

@protocol RNIvsStageControllerDelegate <NSObject>
- (void)stageControllerDidEmit:(NSString *)event body:(NSDictionary *)body;
@end

/// One Stage per process: owns the local camera/mic streams, the Stage and the participant registry.
/// Every method must be called on the main thread; delegate callbacks arrive on the main thread.
@interface RNIvsStageController : NSObject

+ (instancetype)shared;

@property (nonatomic, weak, nullable) id<RNIvsStageControllerDelegate> delegate;

- (BOOL)prepareWithCameraPosition:(NSString *)position
                             size:(CGSize)size
                  targetFrameRate:(NSInteger)targetFrameRate
                       maxBitrate:(NSInteger)maxBitrate
                       minBitrate:(NSInteger)minBitrate
                            error:(NSError **)error;
- (void)releaseLocalMedia;
- (BOOL)joinWithToken:(NSString *)token error:(NSError **)error;
- (void)leave;
- (void)setMicMuted:(BOOL)muted;
- (void)setCameraEnabled:(BOOL)enabled;
- (void)setCameraPosition:(NSString *)position;
/// Name whose initials the camera-off card shows; falls back to the token's display_name.
- (void)setDisplayName:(NSString *)name;
- (NSDictionary *)snapshot;

/// Identity of the image device behind a participant's video; previews only need rebuilding when it changes.
- (nullable id)videoDeviceForParticipant:(NSString *)participantId;

/// Fresh preview for a participant ('' = local camera), or nil when no video is available yet.
- (nullable UIView *)previewForParticipant:(NSString *)participantId fill:(BOOL)fill;

/// Video views re-request their preview when streams change.
- (void)addVideoObserver:(id)observer selector:(SEL)selector;
- (void)removeVideoObserver:(id)observer;

@end

NS_ASSUME_NONNULL_END
