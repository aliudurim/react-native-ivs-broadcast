#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

@class IVSTransmissionStatistics;

@interface RNIvsVideoSettings : NSObject
@property (nonatomic) NSInteger width;
@property (nonatomic) NSInteger height;
@property (nonatomic) NSInteger initialBitrate;
@property (nonatomic) NSInteger targetFrameRate;
@property (nonatomic) NSInteger keyframeInterval;
@property (nonatomic) NSInteger bFrames;      // -1 = SDK default
@property (nonatomic) NSInteger autoBitrate;  // -1 = SDK default
@property (nonatomic, copy) NSString *autoBitrateProfile;
@property (nonatomic) NSInteger maxBitrate;
@property (nonatomic) NSInteger minBitrate;
@end

@protocol RNIvsBroadcastSessionDelegate <NSObject>
- (void)broadcastSessionDidChangeState:(NSString *)state sessionId:(NSString *)sessionId;
- (void)broadcastSessionDidEmitError:(NSError *)error sessionId:(NSString *)sessionId;
- (void)broadcastSessionDidUpdateStatistics:(IVSTransmissionStatistics *)statistics;
- (void)broadcastSessionDidReceivePreview:(UIView *)preview;
- (void)broadcastSessionDidFail:(NSString *)message;
@end

// Solo RTMPS broadcast: one IVSBroadcastSession with the camera + microphone.
// Every method must be called on the main thread; delegate calls arrive on it.
@interface RNIvsBroadcastSession : NSObject

@property (nonatomic, weak, nullable) id<RNIvsBroadcastSessionDelegate> delegate;
@property (nonatomic, readonly) BOOL isInitialized;

- (void)setVideoSettings:(RNIvsVideoSettings *)settings;
- (void)setCameraPosition:(NSString *)position;
- (void)setAspectMode:(NSString *)aspectMode;
- (void)setMirrored:(BOOL)mirrored;
- (void)setMuted:(BOOL)muted;
- (void)setCameraEnabled:(BOOL)enabled;

- (BOOL)initiateWithError:(NSError **)error;
- (BOOL)startWithURL:(NSString *)url streamKey:(NSString *)streamKey error:(NSError **)error;
- (void)stop;
- (void)teardown;

@end

NS_ASSUME_NONNULL_END
