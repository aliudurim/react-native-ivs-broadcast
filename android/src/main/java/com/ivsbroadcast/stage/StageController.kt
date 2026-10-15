package com.ivsbroadcast.stage

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.Typeface
import android.os.Handler
import android.os.Looper
import com.amazonaws.ivs.broadcast.AudioLocalStageStream
import com.amazonaws.ivs.broadcast.BroadcastConfiguration
import com.amazonaws.ivs.broadcast.BroadcastException
import com.amazonaws.ivs.broadcast.CustomImageSource
import com.amazonaws.ivs.broadcast.Device
import com.amazonaws.ivs.broadcast.DeviceDiscovery
import com.amazonaws.ivs.broadcast.ImageDevice
import com.amazonaws.ivs.broadcast.ImageLocalStageStream
import com.amazonaws.ivs.broadcast.LocalStageStream
import com.amazonaws.ivs.broadcast.ParticipantInfo
import com.amazonaws.ivs.broadcast.Stage
import com.amazonaws.ivs.broadcast.StageAudioManager
import com.amazonaws.ivs.broadcast.StageRenderer
import com.amazonaws.ivs.broadcast.StageStream
import com.amazonaws.ivs.broadcast.StageVideoConfiguration
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.ivsbroadcast.solo.BroadcastForegroundService
import org.json.JSONObject
import kotlin.math.min
import kotlin.math.roundToInt

interface StageEventListener {
  fun onStageEvent(event: String, body: WritableMap)
}

private class ParticipantEntry(
  val participantId: String,
  val userId: String,
  val isLocal: Boolean,
  val attributesJson: String,
) {
  var publishState = "notPublished"
  var subscribeState = "notSubscribed"
}

/** One Stage per process. All methods run on the main thread; SDK callbacks are hopped onto it. */
object StageController : Stage.Strategy, StageRenderer {
  private const val SERVICE_OWNER = "stage"
  private const val CARD_FPS = 5

  var listener: StageEventListener? = null

  private val main = Handler(Looper.getMainLooper())
  private val videoObservers = mutableSetOf<() -> Unit>()

  private var discovery: DeviceDiscovery? = null
  private var cameras: List<Device> = emptyList()
  private var microphone: Device? = null
  private var videoConfig: StageVideoConfiguration? = null
  private var videoStream: ImageLocalStageStream? = null
  private var audioStream: AudioLocalStageStream? = null
  // Published in place of the camera while it is off: IVS compositions draw their own icon for muted video.
  private var cardSource: CustomImageSource? = null
  private var cardStream: ImageLocalStageStream? = null
  private var publishedVideo: ImageLocalStageStream? = null
  private var cardRunning = false
  private var displayName = ""
  private var tokenDisplayName = ""
  private val cardFrame = object : Runnable {
    override fun run() {
      paintCard()
      main.postDelayed(this, 1000L / CARD_FPS)
    }
  }
  private var stage: Stage? = null
  private var serviceContext: Context? = null
  private var connection = "disconnected"
  private var localParticipantId: String? = null
  private val participants = linkedMapOf<String, ParticipantEntry>()
  private val streams = mutableMapOf<String, List<StageStream>>()
  private var position = Device.Descriptor.Position.FRONT
  private var cameraEnabled = true
  private var micMuted = false

  @Volatile private var publishStreams: List<LocalStageStream> = emptyList()

  fun prepare(
    context: Context,
    cameraPosition: String,
    width: Int,
    height: Int,
    targetFrameRate: Int,
    maxBitrate: Int,
    minBitrate: Int,
  ) {
    position = positionFrom(cameraPosition)
    if (videoStream != null) {
      applyCameraPosition()
      return
    }

    // setPreset throws while a Stage or DeviceDiscovery is still alive.
    if (stage == null && discovery == null) {
      StageAudioManager.getInstance(context).setPreset(StageAudioManager.UseCasePreset.VIDEO_CHAT)
    }
    val found = DeviceDiscovery(context).also { discovery = it }
    val devices = found.listLocalDevices()
    cameras = devices.filter { it.descriptor.type == Device.Descriptor.DeviceType.CAMERA }
    microphone = devices.firstOrNull { it.descriptor.type == Device.Descriptor.DeviceType.MICROPHONE }
    val camera = cameraFor(position)
    val mic = microphone
    if (camera == null || mic == null) {
      releaseLocalMedia()
      throw IllegalStateException(if (camera == null) "No camera available." else "No microphone available.")
    }

    videoConfig = StageVideoConfiguration().apply {
      if (width > 0 && height > 0) size = BroadcastConfiguration.Vec2(width.toFloat(), height.toFloat())
      if (targetFrameRate > 0) this.targetFramerate = targetFrameRate
      if (maxBitrate > 0) this.maxBitrate = maxBitrate
      if (minBitrate > 0) this.minBitrate = minBitrate
      simulcast.isEnabled = true
    }
    videoStream = ImageLocalStageStream(camera, videoConfig)
    audioStream = AudioLocalStageStream(mic).apply { setMuted(micMuted) }
    applyVideoState()
    notifyVideoChanged()
  }

  fun releaseLocalMedia() {
    stopCardFrames()
    publishedVideo = null
    cardStream = null
    cardSource?.release()
    cardSource = null
    videoStream = null
    audioStream = null
    cameras = emptyList()
    microphone = null
    discovery?.release()
    discovery = null
    updateStrategy()
    notifyVideoChanged()
  }

  fun join(context: Context, token: String) {
    if (stage != null) leave()
    val next = Stage(context, token, this)
    next.addRenderer(this)
    stage = next
    updateStrategy()
    try {
      next.join()
    } catch (e: BroadcastException) {
      resetStage()
      throw e
    }
    // Keeps camera, mic and the Stage connection alive while the screen is locked.
    serviceContext = context.applicationContext.also { BroadcastForegroundService.start(it, SERVICE_OWNER) }
  }

  fun leave() {
    stage?.leave()
    resetStage()
    setConnection(Stage.ConnectionState.DISCONNECTED, null)
  }

  fun setMicMuted(muted: Boolean) {
    micMuted = muted
    audioStream?.setMuted(muted)
    localParticipantId?.let { mediaChanged(it) }
  }

  fun setCameraEnabled(enabled: Boolean) {
    cameraEnabled = enabled
    applyVideoState()
    localParticipantId?.let { mediaChanged(it) }
  }

  fun setDisplayName(name: String) {
    displayName = name
  }

  fun setCameraPosition(value: String) {
    position = positionFrom(value)
    applyCameraPosition()
  }

  fun snapshot(): WritableMap = Arguments.createMap().apply {
    putString("connection", connection)
    putString("localParticipantId", localParticipantId.orEmpty())
    putArray("participants", Arguments.createArray().apply {
      participants.values.forEach { pushMap(participantMap(it)) }
    })
  }

  fun videoDeviceFor(participantId: String): ImageDevice? {
    if (participantId.isEmpty() || participantId == localParticipantId) return videoStream?.device as? ImageDevice
    return streams[participantId]?.firstNotNullOfOrNull { it.device as? ImageDevice }
  }

  fun addVideoObserver(observer: () -> Unit) {
    videoObservers.add(observer)
  }

  fun removeVideoObserver(observer: () -> Unit) {
    videoObservers.remove(observer)
  }

  // region Strategy (called by the SDK)

  override fun stageStreamsToPublishForParticipant(stage: Stage, participantInfo: ParticipantInfo): List<LocalStageStream> =
    publishStreams

  override fun shouldPublishFromParticipant(stage: Stage, participantInfo: ParticipantInfo): Boolean =
    publishStreams.isNotEmpty()

  override fun shouldSubscribeToParticipant(stage: Stage, participantInfo: ParticipantInfo): Stage.SubscribeType =
    Stage.SubscribeType.AUDIO_VIDEO

  // endregion

  // region Renderer

  override fun onError(exception: BroadcastException) = onMain { emitError(exception) }

  override fun onConnectionStateChanged(stage: Stage, state: Stage.ConnectionState, exception: BroadcastException?) =
    onMain(stage) {
      setConnection(state, exception)
      // Kicked, token revoked or stage deleted: the SDK won't reconnect, so free the stage and the service.
      if (state == Stage.ConnectionState.DISCONNECTED && exception?.isFatal == true) {
        main.post { if (this.stage === stage) resetStage() }
      }
    }

  override fun onParticipantJoined(stage: Stage, info: ParticipantInfo) {
    val tokenName = if (info.isLocal) info.attributes["display_name"].orEmpty() else ""
    val entry = ParticipantEntry(
      participantId = info.participantId,
      userId = info.userId.orEmpty(),
      isLocal = info.isLocal,
      attributesJson = JSONObject(info.attributes as Map<*, *>).toString(),
    )
    onMain(stage) {
      if (entry.isLocal) {
        localParticipantId = entry.participantId
        if (tokenName.isNotEmpty()) tokenDisplayName = tokenName
      }
      participants[entry.participantId] = entry
      emit("joined", participantMap(entry))
    }
  }

  override fun onParticipantLeft(stage: Stage, info: ParticipantInfo) {
    val pid = info.participantId
    onMain(stage) {
      participants.remove(pid)
      streams.remove(pid)
      if (localParticipantId == pid) localParticipantId = null
      emit("left", Arguments.createMap().apply { putString("participantId", pid) })
      notifyVideoChanged()
    }
  }

  override fun onParticipantPublishStateChanged(stage: Stage, info: ParticipantInfo, state: Stage.PublishState) {
    val pid = info.participantId
    val name = when (state) {
      Stage.PublishState.NOT_PUBLISHED -> "notPublished"
      Stage.PublishState.ATTEMPTING_PUBLISH -> "attemptingPublish"
      Stage.PublishState.PUBLISHED -> "published"
    }
    onMain(stage) {
      participants[pid]?.publishState = name
      emit("publishState", stateMap(pid, name))
    }
  }

  override fun onParticipantSubscribeStateChanged(stage: Stage, info: ParticipantInfo, state: Stage.SubscribeState) {
    val pid = info.participantId
    val name = when (state) {
      Stage.SubscribeState.NOT_SUBSCRIBED -> "notSubscribed"
      Stage.SubscribeState.ATTEMPTING_SUBSCRIBE -> "attemptingSubscribe"
      Stage.SubscribeState.SUBSCRIBED -> "subscribed"
    }
    onMain(stage) {
      participants[pid]?.subscribeState = name
      emit("subscribeState", stateMap(pid, name))
    }
  }

  override fun onStreamsAdded(stage: Stage, info: ParticipantInfo, added: List<StageStream>) {
    val pid = info.participantId
    val copy = added.toList()
    onMain(stage) {
      streams[pid] = (streams[pid].orEmpty() + copy).distinct()
      mediaChanged(pid)
    }
  }

  override fun onStreamsRemoved(stage: Stage, info: ParticipantInfo, removed: List<StageStream>) {
    val pid = info.participantId
    val copy = removed.toSet()
    onMain(stage) {
      streams[pid] = streams[pid].orEmpty().filterNot { it in copy }
      mediaChanged(pid)
    }
  }

  override fun onStreamsMutedChanged(stage: Stage, info: ParticipantInfo, changed: List<StageStream>) {
    val pid = info.participantId
    onMain(stage) { mediaChanged(pid) }
  }

  // endregion

  private fun applyCameraPosition() {
    val current = videoStream ?: return
    if (current.device.descriptor.position == position) return
    val camera = cameraFor(position) ?: return
    videoStream = ImageLocalStageStream(camera, videoConfig)
    applyVideoState()
    notifyVideoChanged()
  }

  // region Camera-off card

  // Never unpublishes: the card replaces the camera as the published video, muting is only the fallback.
  private fun applyVideoState() {
    val cardWanted = videoStream != null && !cameraEnabled
    if (cardWanted && cardStream == null) createCard()
    val card = cardStream.takeIf { cardWanted }
    videoStream?.setMuted(!cameraEnabled)
    if (card != null) startCardFrames() else stopCardFrames()
    publishedVideo = card ?: videoStream
    updateStrategy()
  }

  private fun createCard() {
    val found = discovery ?: return
    val size = videoConfig?.size ?: return
    val source = try {
      found.createImageInputSource(size)
    } catch (e: RuntimeException) {
      return
    } ?: return
    cardSource = source
    cardStream = ImageLocalStageStream(source, videoConfig)
  }

  private fun startCardFrames() {
    if (cardRunning) return
    cardRunning = true
    main.post(cardFrame)
  }

  private fun stopCardFrames() {
    cardRunning = false
    main.removeCallbacks(cardFrame)
  }

  private fun paintCard() {
    val surface = cardSource?.inputSurface?.takeIf { it.isValid } ?: return
    val canvas = try {
      surface.lockCanvas(null)
    } catch (e: Exception) {
      return
    }
    try {
      drawCard(canvas)
    } finally {
      surface.unlockCanvasAndPost(canvas)
    }
  }

  private fun drawCard(canvas: Canvas) {
    val width = canvas.width.toFloat()
    val height = canvas.height.toFloat()
    canvas.drawColor(0xFF121212.toInt())
    val radius = (min(width, height) * 0.1f).roundToInt().toFloat()
    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFF2C2C2C.toInt() }
    canvas.drawCircle(width / 2, height / 2, radius, paint)

    val text = initials(displayName.ifEmpty { tokenDisplayName }).ifEmpty { "•" }
    paint.apply {
      color = 0xFFFFFFFF.toInt()
      typeface = Typeface.DEFAULT_BOLD
      textSize = (radius * 0.8f).roundToInt().toFloat()
      textAlign = Paint.Align.CENTER
    }
    val bounds = Rect().also { paint.getTextBounds(text, 0, text.length, it) }
    canvas.drawText(text, width / 2, height / 2 - bounds.exactCenterY(), paint)
  }

  private fun initials(name: String) =
    name.split(Regex("\\s+")).filter { it.isNotEmpty() }.take(2).joinToString("") { it.substring(0, it.offsetByCodePoints(0, 1)).uppercase() }

  // endregion

  private fun cameraFor(position: Device.Descriptor.Position): Device? {
    val matching = cameras.filter { it.descriptor.position == position }
    return matching.firstOrNull { it.descriptor.isDefault } ?: matching.firstOrNull() ?: cameras.firstOrNull()
  }

  private fun updateStrategy() {
    publishStreams = listOfNotNull(publishedVideo, audioStream)
    stage?.refreshStrategy()
  }

  private fun resetStage() {
    stage?.let {
      it.removeRenderer(this)
      it.release()
    }
    stage = null
    serviceContext?.let { BroadcastForegroundService.stop(it, SERVICE_OWNER) }
    serviceContext = null
    localParticipantId = null
    participants.clear()
    streams.clear()
    notifyVideoChanged()
  }

  private fun mediaChanged(pid: String) {
    if (!participants.containsKey(pid)) return
    emit("media", mediaMap(pid).apply { putString("participantId", pid) })
    notifyVideoChanged()
  }

  private fun mediaMap(pid: String): WritableMap {
    var list = streams[pid].orEmpty()
    if (pid == localParticipantId && list.isEmpty()) list = publishStreams
    val video = list.firstOrNull { it.streamType == StageStream.Type.VIDEO }
    val audio = list.firstOrNull { it.streamType == StageStream.Type.AUDIO }
    return Arguments.createMap().apply {
      putBoolean("hasVideo", video != null)
      putBoolean("hasAudio", audio != null)
      // Our own card is published unmuted, but the local UI still treats the camera as off.
      putBoolean("videoMuted", if (video != null && pid == localParticipantId) !cameraEnabled else video?.muted ?: false)
      putBoolean("audioMuted", audio?.muted ?: false)
    }
  }

  private fun participantMap(entry: ParticipantEntry): WritableMap = Arguments.createMap().apply {
    putString("participantId", entry.participantId)
    putString("userId", entry.userId)
    putBoolean("isLocal", entry.isLocal)
    putString("attributesJson", entry.attributesJson)
    putString("publishState", entry.publishState)
    putString("subscribeState", entry.subscribeState)
    merge(mediaMap(entry.participantId))
  }

  private fun stateMap(pid: String, state: String) = Arguments.createMap().apply {
    putString("participantId", pid)
    putString("state", state)
  }

  private fun setConnection(state: Stage.ConnectionState, exception: BroadcastException?) {
    connection = when (state) {
      Stage.ConnectionState.DISCONNECTED -> "disconnected"
      Stage.ConnectionState.CONNECTING -> "connecting"
      Stage.ConnectionState.CONNECTED -> "connected"
    }
    emit("connection", Arguments.createMap().apply {
      putString("state", connection)
      putInt("errorCode", exception?.code ?: 0)
      putString("errorMessage", exception?.detail.orEmpty())
    })
  }

  private fun emitError(exception: BroadcastException) {
    emit("error", Arguments.createMap().apply {
      putInt("code", exception.code)
      putString("message", exception.detail ?: exception.toString())
      putBoolean("isFatal", exception.isFatal)
    })
  }

  private fun emit(event: String, body: WritableMap) {
    listener?.onStageEvent(event, body)
  }

  private fun notifyVideoChanged() {
    videoObservers.toList().forEach { it() }
  }

  private fun onMain(block: () -> Unit) {
    if (Looper.myLooper() == Looper.getMainLooper()) block() else main.post(block)
  }

  private fun onMain(source: Stage, block: () -> Unit) = onMain { if (source === stage) block() }

  private fun positionFrom(value: String) =
    if (value == "back") Device.Descriptor.Position.BACK else Device.Descriptor.Position.FRONT
}
