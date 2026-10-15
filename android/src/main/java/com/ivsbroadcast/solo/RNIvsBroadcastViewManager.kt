package com.ivsbroadcast.solo

import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.viewmanagers.RNIvsBroadcastViewManagerDelegate
import com.facebook.react.viewmanagers.RNIvsBroadcastViewManagerInterface

@ReactModule(name = RNIvsBroadcastViewManager.NAME)
class RNIvsBroadcastViewManager :
  SimpleViewManager<RNIvsBroadcastView>(),
  RNIvsBroadcastViewManagerInterface<RNIvsBroadcastView> {

  private val delegate = RNIvsBroadcastViewManagerDelegate(this)

  override fun getDelegate(): ViewManagerDelegate<RNIvsBroadcastView> = delegate

  override fun getName() = NAME

  override fun createViewInstance(context: ThemedReactContext) = RNIvsBroadcastView(context)

  override fun onDropViewInstance(view: RNIvsBroadcastView) {
    view.cleanUp()
    super.onDropViewInstance(view)
  }

  override fun getExportedCustomDirectEventTypeConstants(): MutableMap<String, Any> =
    mutableMapOf(
      "topBroadcastStateChanged" to mapOf("registrationName" to "onBroadcastStateChanged"),
      "topBroadcastError" to mapOf("registrationName" to "onBroadcastError"),
      "topNativeError" to mapOf("registrationName" to "onNativeError"),
      "topTransmissionStatisticsChanged" to mapOf("registrationName" to "onTransmissionStatisticsChanged"),
    )

  override fun setRtmpsUrl(view: RNIvsBroadcastView, value: String?) {
    view.rtmpsUrl = value.orEmpty()
  }

  override fun setStreamKey(view: RNIvsBroadcastView, value: String?) {
    view.streamKey = value.orEmpty()
  }

  override fun setVideoWidth(view: RNIvsBroadcastView, value: Int) {
    view.video = view.video.copy(width = value)
  }

  override fun setVideoHeight(view: RNIvsBroadcastView, value: Int) {
    view.video = view.video.copy(height = value)
  }

  override fun setVideoBitrate(view: RNIvsBroadcastView, value: Int) {
    view.video = view.video.copy(initialBitrate = value)
  }

  override fun setVideoTargetFrameRate(view: RNIvsBroadcastView, value: Int) {
    view.video = view.video.copy(targetFrameRate = value)
  }

  override fun setVideoKeyframeInterval(view: RNIvsBroadcastView, value: Int) {
    view.video = view.video.copy(keyframeInterval = value)
  }

  override fun setVideoBFrames(view: RNIvsBroadcastView, value: Int) {
    view.video = view.video.copy(bFrames = value)
  }

  override fun setVideoAutoBitrate(view: RNIvsBroadcastView, value: Int) {
    view.video = view.video.copy(autoBitrate = value)
  }

  override fun setVideoAutoBitrateProfile(view: RNIvsBroadcastView, value: String?) {
    view.video = view.video.copy(autoBitrateProfile = value ?: "default")
  }

  override fun setVideoMaxBitrate(view: RNIvsBroadcastView, value: Int) {
    view.video = view.video.copy(maxBitrate = value)
  }

  override fun setVideoMinBitrate(view: RNIvsBroadcastView, value: Int) {
    view.video = view.video.copy(minBitrate = value)
  }

  override fun setCameraPosition(view: RNIvsBroadcastView, value: String?) {
    view.session.setCameraPosition(value ?: "back")
  }

  override fun setCameraPreviewAspectMode(view: RNIvsBroadcastView, value: String?) {
    view.session.setAspectMode(value ?: "none")
  }

  override fun setIsCameraPreviewMirrored(view: RNIvsBroadcastView, value: Boolean) {
    view.session.setMirrored(value)
  }

  override fun setIsMuted(view: RNIvsBroadcastView, value: Boolean) {
    view.session.setMuted(value)
  }

  override fun setIsCameraEnabled(view: RNIvsBroadcastView, value: Boolean) {
    view.session.setCameraEnabled(value)
  }

  override fun start(view: RNIvsBroadcastView, rtmpsUrl: String, streamKey: String) {
    view.start(rtmpsUrl, streamKey)
  }

  override fun stop(view: RNIvsBroadcastView) {
    view.stop()
  }

  companion object {
    const val NAME = "RNIvsBroadcastView"
  }
}
