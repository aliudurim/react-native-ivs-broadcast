package com.ivsbroadcast.solo

import android.view.View
import android.widget.FrameLayout
import com.amazonaws.ivs.broadcast.BroadcastException
import com.amazonaws.ivs.broadcast.TransmissionStats
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.events.Event

class RNIvsBroadcastView(private val reactContext: ThemedReactContext) :
  FrameLayout(reactContext), LifecycleEventListener, SoloSessionListener {

  val session = SoloSession(reactContext, this)
  var rtmpsUrl: String = ""
  var streamKey: String = ""
  var video = VideoSettings()

  init {
    reactContext.addLifecycleEventListener(this)
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    if (session.isInitialized) return
    try {
      session.setVideoSettings(video)
      session.initiate()
    } catch (e: RuntimeException) {
      emitNativeError(e.message ?: e.toString())
    }
  }

  fun start(url: String, key: String) {
    val finalUrl = url.ifEmpty { rtmpsUrl }
    val finalKey = key.ifEmpty { streamKey }
    if (finalUrl.isEmpty()) return emitNativeError("'rtmpsUrl' is empty.")
    if (finalKey.isEmpty()) return emitNativeError("'streamKey' is empty.")
    try {
      session.start(finalUrl, finalKey)
    } catch (e: RuntimeException) {
      emitNativeError(e.message ?: e.toString())
    }
  }

  fun stop() {
    try {
      session.stop()
    } catch (e: RuntimeException) {
      emitNativeError(e.message ?: e.toString())
    }
  }

  fun cleanUp() {
    reactContext.removeLifecycleEventListener(this)
    removeAllViews()
    session.release()
  }

  private var paused = false

  override fun onHostResume() {
    if (!paused) return
    paused = false
    if (session.isInitialized) session.reattachCameraIfLost()
  }

  override fun onHostPause() {
    paused = true
  }

  override fun onHostDestroy() = cleanUp()

  // Fabric never lays out native children it didn't create, so the SDK's preview
  // stays 0x0 unless it is measured and laid out by hand.
  override fun requestLayout() {
    super.requestLayout()
    post(measureAndLayout)
  }

  private val measureAndLayout = Runnable {
    measure(
      MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
      MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY),
    )
    layout(left, top, right, bottom)
  }

  override fun onPreview(preview: View) {
    removeAllViews()
    addView(preview, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    requestLayout()
  }

  override fun onStateChanged(state: String, sessionId: String) {
    dispatch("topBroadcastStateChanged", Arguments.createMap().apply {
      putString("stateStatus", state)
      putString("sessionId", sessionId)
    })
  }

  override fun onBroadcastError(exception: BroadcastException, sessionId: String) {
    dispatch("topBroadcastError", Arguments.createMap().apply {
      putInt("code", exception.code)
      putString("type", exception.error.name)
      putString("source", exception.source.orEmpty())
      putString("detail", exception.detail.orEmpty())
      putBoolean("isFatal", exception.isFatal)
      putString("sessionId", sessionId)
    })
  }

  override fun onStatistics(stats: TransmissionStats) {
    dispatch("topTransmissionStatisticsChanged", Arguments.createMap().apply {
      putDouble("rtt", stats.roundTripTime)
      putDouble("measuredBitrate", stats.measuredBitrate)
      putDouble("recommendedBitrate", stats.recommendedBitrate)
      putString("networkHealth", stats.networkHealth.name)
      putString("broadcastQuality", stats.broadcastQuality.name)
    })
  }

  override fun onFailure(message: String) = emitNativeError(message)

  private fun emitNativeError(message: String) {
    dispatch("topNativeError", Arguments.createMap().apply { putString("message", message) })
  }

  private fun dispatch(name: String, payload: WritableMap) {
    val surfaceId = UIManagerHelper.getSurfaceId(reactContext)
    UIManagerHelper.getEventDispatcher(reactContext)
      ?.dispatchEvent(BroadcastEvent(surfaceId, id, name, payload))
  }

  private class BroadcastEvent(
    surfaceId: Int,
    viewTag: Int,
    private val name: String,
    private val payload: WritableMap,
  ) : Event<BroadcastEvent>(surfaceId, viewTag) {
    override fun getEventName() = name

    override fun getEventData() = payload

    override fun canCoalesce() = false
  }
}
