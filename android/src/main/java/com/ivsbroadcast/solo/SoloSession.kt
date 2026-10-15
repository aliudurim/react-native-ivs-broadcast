package com.ivsbroadcast.solo

import android.content.Context
import android.hardware.camera2.CameraManager
import android.os.Handler
import android.os.Looper
import android.view.View
import com.amazonaws.ivs.broadcast.AudioDevice
import com.amazonaws.ivs.broadcast.BroadcastConfiguration
import com.amazonaws.ivs.broadcast.BroadcastException
import com.amazonaws.ivs.broadcast.BroadcastSession
import com.amazonaws.ivs.broadcast.Device
import com.amazonaws.ivs.broadcast.Presets
import com.amazonaws.ivs.broadcast.TransmissionStats

data class VideoSettings(
  val width: Int = 0,
  val height: Int = 0,
  val initialBitrate: Int = 0,
  val targetFrameRate: Int = 0,
  val keyframeInterval: Int = 0,
  val bFrames: Int = -1,
  val autoBitrate: Int = -1,
  val autoBitrateProfile: String = "default",
  val maxBitrate: Int = 0,
  val minBitrate: Int = 0,
)

interface SoloSessionListener {
  fun onStateChanged(state: String, sessionId: String)
  fun onBroadcastError(exception: BroadcastException, sessionId: String)
  fun onStatistics(stats: TransmissionStats)
  fun onPreview(preview: View)
  fun onFailure(message: String)
}

/** Solo RTMPS broadcast: one BroadcastSession with the camera + microphone. Main thread only. */
class SoloSession(private val context: Context, private val listener: SoloSessionListener) {
  private var session: BroadcastSession? = null
  private var video = VideoSettings()
  private var position = Device.Descriptor.Position.BACK
  private var aspectMode = BroadcastConfiguration.AspectMode.NONE
  private var mirrored = false
  private var muted = false
  private var cameraEnabled = true
  private var exchangingCamera = false

  // Listener callbacks run on an SDK thread, and every BroadcastSession call off the
  // creating thread throws (reported back through onError), so the id is read on start().
  @Volatile private var sessionId = ""

  val isInitialized: Boolean get() = session != null

  private val cameraManager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
  private val mainHandler = Handler(Looper.getMainLooper())
  private val freeCameraIds = mutableSetOf<String>()

  // A camera id is "available" only while no client holds it, ours included.
  private val availability = object : CameraManager.AvailabilityCallback() {
    override fun onCameraAvailable(cameraId: String) {
      freeCameraIds.add(cameraId)
    }

    override fun onCameraUnavailable(cameraId: String) {
      freeCameraIds.remove(cameraId)
    }
  }

  private val sessionListener = object : BroadcastSession.Listener() {
    override fun onStateChanged(state: BroadcastSession.State) {
      listener.onStateChanged(stateName(state), if (state == BroadcastSession.State.CONNECTED) sessionId else "")
    }

    override fun onError(exception: BroadcastException) {
      listener.onBroadcastError(exception, sessionId)
    }

    override fun onTransmissionStatsChanged(statistics: TransmissionStats) {
      listener.onStatistics(statistics)
    }
  }

  fun setVideoSettings(settings: VideoSettings) {
    video = settings
  }

  fun setCameraPosition(name: String) {
    val next = if (name == "front") Device.Descriptor.Position.FRONT else Device.Descriptor.Position.BACK
    if (next == position) return
    position = next
    if (session != null) exchangeCamera()
  }

  fun setAspectMode(name: String) {
    val next = when (name) {
      "fit" -> BroadcastConfiguration.AspectMode.FIT
      "fill" -> BroadcastConfiguration.AspectMode.FILL
      else -> BroadcastConfiguration.AspectMode.NONE
    }
    if (next == aspectMode) return
    aspectMode = next
    if (session != null) refreshPreview()
  }

  fun setMirrored(value: Boolean) {
    if (value == mirrored) return
    mirrored = value
    if (session != null) refreshPreview()
  }

  fun setMuted(value: Boolean) {
    muted = value
    if (session != null) applyMute()
  }

  // Detaching (rather than muting) turns the camera hardware off; with no image device the
  // broadcast sends black video while audio stays live.
  fun setCameraEnabled(value: Boolean) {
    if (value == cameraEnabled) return
    cameraEnabled = value
    val s = session ?: return
    if (value) {
      reattachCamera()
    } else {
      mainHandler.removeCallbacksAndMessages(null)
      s.awaitDeviceChanges {
        attached(Device.Descriptor.DeviceType.CAMERA)?.let { s.detachDevice(it) }
        refreshPreview()
      }
    }
  }

  fun initiate() {
    if (session != null) return
    val config = BroadcastConfiguration().changing { c ->
      applyVideoSettings(c.video)
      c
    }
    val descriptors = if (position == Device.Descriptor.Position.FRONT) {
      Presets.Devices.FRONT_CAMERA(context)
    } else {
      Presets.Devices.BACK_CAMERA(context)
    }.filter { cameraEnabled || it.type != Device.Descriptor.DeviceType.CAMERA }.toTypedArray()
    session = BroadcastSession(context, sessionListener, config, descriptors)
    cameraManager.registerAvailabilityCallback(availability, mainHandler)
    if (muted) applyMute()
    refreshPreview()
  }

  fun start(url: String, streamKey: String) {
    val s = session ?: throw IllegalStateException("Broadcast session is not initialized.")
    s.start(url, streamKey)
    sessionId = s.sessionId.orEmpty()
    BroadcastForegroundService.start(context)
  }

  fun stop() {
    session?.stop()
    BroadcastForegroundService.stop(context)
  }

  fun release() {
    mainHandler.removeCallbacksAndMessages(null)
    cameraManager.unregisterAvailabilityCallback(availability)
    BroadcastForegroundService.stop(context)
    session?.release()
    session = null
  }

  private fun applyVideoSettings(v: BroadcastConfiguration.Video) {
    if (video.width > 0 || video.height > 0) {
      require(video.width > 0 && video.height > 0) {
        "videoConfig width and height must be set together."
      }
      v.setSize(video.width, video.height)
    }
    if (video.initialBitrate > 0) v.initialBitrate = video.initialBitrate
    if (video.targetFrameRate > 0) v.targetFramerate = video.targetFrameRate
    if (video.keyframeInterval > 0) v.keyframeInterval = video.keyframeInterval.toFloat()
    if (video.maxBitrate > 0) v.maxBitrate = video.maxBitrate
    if (video.minBitrate > 0) v.minBitrate = video.minBitrate
    if (video.bFrames >= 0) v.isUseBFrames = video.bFrames == 1
    if (video.autoBitrate >= 0) v.isUseAutoBitrate = video.autoBitrate == 1
    when (video.autoBitrateProfile) {
      "conservative" -> v.autoBitrateProfile = BroadcastConfiguration.AutomaticBitrateProfile.CONSERVATIVE
      "fastIncrease" -> v.autoBitrateProfile = BroadcastConfiguration.AutomaticBitrateProfile.FAST_INCREASE
    }
  }

  private fun attached(type: Device.Descriptor.DeviceType): Device? =
    session?.listAttachedDevices()?.firstOrNull { it.descriptor.type == type }

  private fun applyMute() {
    val s = session ?: return
    s.awaitDeviceChanges {
      (attached(Device.Descriptor.DeviceType.MICROPHONE) as? AudioDevice)?.setGain(if (muted) 0f else 1f)
    }
  }

  private fun exchangeCamera() {
    val s = session ?: return
    if (!cameraEnabled || exchangingCamera) return
    exchangingCamera = true
    s.awaitDeviceChanges {
      val camera = attached(Device.Descriptor.DeviceType.CAMERA)
      val candidates = BroadcastSession.listAvailableDevices(context).filter {
        it.type == Device.Descriptor.DeviceType.CAMERA && it.position == position
      }
      val next = candidates.firstOrNull { it.isDefault } ?: candidates.firstOrNull()
      if (camera == null || next == null || camera.descriptor.position == position) {
        exchangingCamera = false
        return@awaitDeviceChanges
      }
      s.exchangeDevices(camera, next) { newCamera: Device ->
        exchangingCamera = false
        refreshPreview()
        // The position prop may have flipped again while the exchange was in flight.
        if (newCamera.descriptor.position != position) exchangeCamera()
      }
    }
  }

  /**
   * After a background lock the SDK reopens the camera itself; after another app evicted
   * it (system camera, picker) it does not, and preview and stream freeze on the last frame.
   * So on resume, give the SDK a moment and reattach only if nobody holds our camera.
   */
  fun reattachCameraIfLost() {
    if (!cameraEnabled) return
    mainHandler.removeCallbacksAndMessages(null)
    mainHandler.postDelayed({
      val id = attached(Device.Descriptor.DeviceType.CAMERA)?.descriptor?.deviceId?.substringAfterLast(':')
      if (session != null && (id == null || id in freeCameraIds)) reattachCamera()
    }, CAMERA_RECLAIM_GRACE_MS)
  }

  private fun reattachCamera() {
    val s = session ?: return
    if (exchangingCamera) return
    exchangingCamera = true
    s.awaitDeviceChanges {
      attached(Device.Descriptor.DeviceType.CAMERA)?.let { s.detachDevice(it) }
      val candidates = BroadcastSession.listAvailableDevices(context).filter {
        it.type == Device.Descriptor.DeviceType.CAMERA && it.position == position
      }
      val next = candidates.firstOrNull { it.isDefault } ?: candidates.firstOrNull()
      if (next == null) {
        exchangingCamera = false
        listener.onFailure("Camera unavailable.")
        return@awaitDeviceChanges
      }
      s.attachDevice(next) { _: Device ->
        exchangingCamera = false
        refreshPreview()
      }
    }
  }

  private fun refreshPreview() {
    val s = session ?: return
    s.awaitDeviceChanges {
      try {
        val preview = s.getPreviewView(aspectMode)
        preview.setMirrored(mirrored)
        listener.onPreview(preview)
      } catch (e: RuntimeException) {
        listener.onFailure(e.message ?: "Camera preview unavailable.")
      }
    }
  }

  private companion object {
    const val CAMERA_RECLAIM_GRACE_MS = 1000L
  }

  private fun stateName(state: BroadcastSession.State) = when (state) {
    BroadcastSession.State.INVALID -> "INVALID"
    BroadcastSession.State.DISCONNECTED -> "DISCONNECTED"
    BroadcastSession.State.CONNECTING -> "CONNECTING"
    BroadcastSession.State.CONNECTED -> "CONNECTED"
    BroadcastSession.State.ERROR -> "ERROR"
  }
}
