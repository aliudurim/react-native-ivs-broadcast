package com.ivsbroadcast.stage

import android.graphics.Color
import android.widget.FrameLayout
import com.amazonaws.ivs.broadcast.BroadcastConfiguration
import com.amazonaws.ivs.broadcast.ImageDevice
import com.amazonaws.ivs.broadcast.ImagePreviewView
import com.facebook.react.uimanager.ThemedReactContext

class StageVideoView(context: ThemedReactContext) : FrameLayout(context) {
  var participantId = ""
    set(value) {
      if (field == value) return
      field = value
      rebuild()
    }
  var fill = true
    set(value) {
      if (field == value) return
      field = value
      rebuild()
    }
  var mirrored = false
    set(value) {
      field = value
      preview?.setMirrored(value)
    }

  private var preview: ImagePreviewView? = null
  private var device: ImageDevice? = null
  private val observer: () -> Unit = { refresh() }

  init {
    setBackgroundColor(Color.BLACK)
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    StageController.addVideoObserver(observer)
    rebuild()
  }

  override fun onDetachedFromWindow() {
    StageController.removeVideoObserver(observer)
    clear()
    super.onDetachedFromWindow()
  }

  private fun refresh() {
    if (preview != null && StageController.videoDeviceFor(participantId) === device) return
    rebuild()
  }

  private fun rebuild() {
    clear()
    if (!isAttachedToWindow) return
    val next = StageController.videoDeviceFor(participantId) ?: return
    val mode = if (fill) BroadcastConfiguration.AspectMode.FILL else BroadcastConfiguration.AspectMode.FIT
    val view = try {
      next.getPreviewView(mode)
    } catch (e: RuntimeException) {
      return
    }
    view.setMirrored(mirrored)
    device = next
    preview = view
    addView(view, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    requestLayout()
  }

  private fun clear() {
    removeAllViews()
    preview = null
    device = null
  }

  // Fabric never lays out native children it didn't create.
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
}
