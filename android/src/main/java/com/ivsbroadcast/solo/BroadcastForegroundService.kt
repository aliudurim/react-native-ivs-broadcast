package com.ivsbroadcast.solo

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import com.ivsbroadcast.R

/**
 * Keeps the process, microphone and RTMPS connection alive while the app is backgrounded
 * or the screen is locked. Without it Android freezes the process within seconds, IVS sees
 * the broadcaster disconnect and ends the session.
 */
class BroadcastForegroundService : Service() {

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val notification = buildNotification()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(
        NOTIFICATION_ID,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE,
      )
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
    val idle = synchronized(owners) {
      foreground = true
      owners.isEmpty()
    }
    if (idle) stopSelf()
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    synchronized(owners) { foreground = false }
    super.onDestroy()
  }

  private fun buildNotification(): Notification {
    val manager = getSystemService(NotificationManager::class.java)
    if (manager.getNotificationChannel(CHANNEL_ID) == null) {
      manager.createNotificationChannel(
        NotificationChannel(
          CHANNEL_ID,
          getString(R.string.ivs_broadcast_notification_channel),
          NotificationManager.IMPORTANCE_LOW,
        ),
      )
    }
    val launch = packageManager.getLaunchIntentForPackage(packageName)?.let {
      PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }
    return Notification.Builder(this, CHANNEL_ID)
      .setSmallIcon(applicationInfo.icon)
      .setContentTitle(applicationInfo.loadLabel(packageManager))
      .setContentText(getString(R.string.ivs_broadcast_notification_text))
      .setOngoing(true)
      .setCategory(Notification.CATEGORY_SERVICE)
      .setContentIntent(launch)
      .build()
  }

  companion object {
    private const val TAG = "RNIvsBroadcast"
    private const val CHANNEL_ID = "ivs_broadcast"
    private const val NOTIFICATION_ID = 4711

    private val owners = mutableSetOf<String>()
    private var foreground = false

    // Must be called while the app is in the foreground: Android refuses to start a
    // camera/microphone foreground service from the background.
    fun start(context: Context, owner: String = "solo") {
      synchronized(owners) { owners.add(owner) }
      try {
        context.startForegroundService(Intent(context, BroadcastForegroundService::class.java))
      } catch (e: RuntimeException) {
        Log.w(TAG, "Could not start the broadcast foreground service", e)
      }
    }

    // Stopping a service before it has called startForeground() crashes the app, so a stop
    // that arrives first is left to onStartCommand, which sees no owners and stops itself.
    fun stop(context: Context, owner: String = "solo") {
      val stopNow = synchronized(owners) {
        owners.remove(owner)
        owners.isEmpty() && foreground
      }
      if (stopNow) context.stopService(Intent(context, BroadcastForegroundService::class.java))
    }
  }
}
