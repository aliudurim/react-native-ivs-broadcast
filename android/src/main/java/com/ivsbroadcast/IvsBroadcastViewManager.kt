package com.ivsbroadcast

import android.graphics.Color
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.viewmanagers.IvsBroadcastViewManagerInterface
import com.facebook.react.viewmanagers.IvsBroadcastViewManagerDelegate

@ReactModule(name = IvsBroadcastViewManager.NAME)
class IvsBroadcastViewManager : SimpleViewManager<IvsBroadcastView>(),
  IvsBroadcastViewManagerInterface<IvsBroadcastView> {
  private val mDelegate: ViewManagerDelegate<IvsBroadcastView>

  init {
    mDelegate = IvsBroadcastViewManagerDelegate(this)
  }

  override fun getDelegate(): ViewManagerDelegate<IvsBroadcastView>? {
    return mDelegate
  }

  override fun getName(): String {
    return NAME
  }

  public override fun createViewInstance(context: ThemedReactContext): IvsBroadcastView {
    return IvsBroadcastView(context)
  }

  @ReactProp(name = "color")
  override fun setColor(view: IvsBroadcastView?, color: Int?) {
    view?.setBackgroundColor(color ?: Color.TRANSPARENT)
  }

  companion object {
    const val NAME = "IvsBroadcastView"
  }
}
