package com.ivsbroadcast.stage

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.bridge.WritableMap
import com.ivsbroadcast.NativeRNIvsStageSpec

class RNIvsStageModule(private val reactContext: ReactApplicationContext) :
  NativeRNIvsStageSpec(reactContext), StageEventListener {

  override fun prepareLocalMedia(
    cameraPosition: String,
    width: Double,
    height: Double,
    targetFrameRate: Double,
    maxBitrate: Double,
    minBitrate: Double,
    promise: Promise,
  ) = onUi(promise) {
    controller().prepare(
      reactContext.currentActivity ?: reactContext,
      cameraPosition,
      width.toInt(),
      height.toInt(),
      targetFrameRate.toInt(),
      maxBitrate.toInt(),
      minBitrate.toInt(),
    )
  }

  override fun releaseLocalMedia(promise: Promise) = onUi(promise) { controller().releaseLocalMedia() }

  // The SDK wants an Activity context for the Stage's audio routing.
  override fun joinStage(token: String, promise: Promise) = onUi(promise) {
    val activity = reactContext.currentActivity ?: throw IllegalStateException("No activity to join the stage from.")
    controller().join(activity, token)
  }

  override fun leaveStage(promise: Promise) = onUi(promise) { controller().leave() }

  override fun setMicMuted(muted: Boolean) = ui { controller().setMicMuted(muted) }

  override fun setCameraEnabled(enabled: Boolean) = ui { controller().setCameraEnabled(enabled) }

  override fun setCameraPosition(position: String) = ui { controller().setCameraPosition(position) }

  override fun setDisplayName(name: String) = ui { controller().setDisplayName(name) }

  override fun getSnapshot(promise: Promise) = ui { promise.resolve(controller().snapshot()) }

  override fun onStageEvent(event: String, body: WritableMap) {
    when (event) {
      "connection" -> emitOnConnectionStateChanged(body)
      "joined" -> emitOnParticipantJoined(body)
      "left" -> emitOnParticipantLeft(body)
      "publishState" -> emitOnParticipantPublishStateChanged(body)
      "subscribeState" -> emitOnParticipantSubscribeStateChanged(body)
      "media" -> emitOnParticipantMediaChanged(body)
      "error" -> emitOnError(body)
    }
  }

  override fun invalidate() {
    UiThreadUtil.runOnUiThread {
      if (StageController.listener === this) {
        StageController.leave()
        StageController.releaseLocalMedia()
        StageController.listener = null
      }
    }
    super.invalidate()
  }

  private fun controller() = StageController.also { it.listener = this }

  private fun ui(block: () -> Unit) {
    UiThreadUtil.runOnUiThread(block)
  }

  private fun onUi(promise: Promise, block: () -> Unit) = ui {
    try {
      block()
      promise.resolve(null)
    } catch (e: RuntimeException) {
      promise.reject("E_STAGE", e.message ?: e.toString(), e)
    }
  }
}
