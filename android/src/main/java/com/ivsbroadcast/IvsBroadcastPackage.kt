package com.ivsbroadcast

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.facebook.react.uimanager.ViewManager
import com.ivsbroadcast.solo.RNIvsBroadcastViewManager
import com.ivsbroadcast.stage.StageVideoViewManager
import com.ivsbroadcast.stage.RNIvsStageModule

class IvsBroadcastPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    if (name == NativeRNIvsStageSpec.NAME) RNIvsStageModule(reactContext) else null

  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
    mapOf(
      NativeRNIvsStageSpec.NAME to ReactModuleInfo(
        NativeRNIvsStageSpec.NAME,
        RNIvsStageModule::class.java.name,
        false,
        false,
        false,
        true,
      ),
    )
  }

  override fun createViewManagers(
    reactContext: ReactApplicationContext,
  ): List<ViewManager<in Nothing, in Nothing>> = listOf(RNIvsBroadcastViewManager(), StageVideoViewManager())
}
