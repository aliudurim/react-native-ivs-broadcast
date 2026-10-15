package com.ivsbroadcast.stage

import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.viewmanagers.RNIvsStageVideoViewManagerDelegate
import com.facebook.react.viewmanagers.RNIvsStageVideoViewManagerInterface

@ReactModule(name = StageVideoViewManager.NAME)
class StageVideoViewManager :
  SimpleViewManager<StageVideoView>(),
  RNIvsStageVideoViewManagerInterface<StageVideoView> {

  private val delegate = RNIvsStageVideoViewManagerDelegate(this)

  override fun getDelegate(): ViewManagerDelegate<StageVideoView> = delegate

  override fun getName() = NAME

  override fun createViewInstance(context: ThemedReactContext) = StageVideoView(context)

  override fun setParticipantId(view: StageVideoView, value: String?) {
    view.participantId = value.orEmpty()
  }

  override fun setAspectMode(view: StageVideoView, value: String?) {
    view.fill = value != "fit"
  }

  override fun setMirrored(view: StageVideoView, value: Boolean) {
    view.mirrored = value
  }

  companion object {
    const val NAME = "RNIvsStageVideoView"
  }
}
