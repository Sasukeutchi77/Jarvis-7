package com.openjarvis.android.hologram

import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.PixelFormat
import android.os.Build
import android.os.IBinder
import android.provider.Settings
import android.util.DisplayMetrics
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import com.openjarvis.android.JarvisApplication
import com.openjarvis.android.logging.JarvisLogger

/**
 * Real Android Overlay Window Service for JARVIS Floating Holographic Interface.
 * Manages the floating WindowManager layer with TYPE_APPLICATION_OVERLAY, allowing
 * JARVIS to appear above all third-party apps (WhatsApp, YouTube, Chrome, Settings, Home Screen).
 */
class HologramOverlayService : Service() {

    private var windowManager: WindowManager? = null
    private var hologramView: HologramView? = null
    private var layoutParams: WindowManager.LayoutParams? = null

    private var isViewAttached = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        JarvisLogger.i("HologramOverlayService", "Creating HologramOverlayService...")
        windowManager = getSystemService(Context.WINDOW_SERVICE) as? WindowManager

        if (!canDrawOverlays()) {
            JarvisLogger.w("HologramOverlayService", "SYSTEM_ALERT_WINDOW permission missing. Cannot mount overlay window.")
            stopSelf()
            return
        }

        initOverlayWindow()
        HologramController.instance.attachOverlayService(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        when (action) {
            ACTION_SHOW -> {
                showOverlay()
            }
            ACTION_HIDE -> {
                hideOverlay()
            }
            ACTION_DISMISS -> {
                dismissOverlay()
            }
        }
        return START_NOT_STICKY
    }

    private fun canDrawOverlays(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Settings.canDrawOverlays(this)
        } else {
            true
        }
    }

    private fun initOverlayWindow() {
        if (hologramView != null || windowManager == null) return

        val displayMetrics = resources.displayMetrics
        val density = displayMetrics.density
        val windowWidth = (280 * density).toInt()
        val windowHeight = (320 * density).toInt()

        val windowType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        var windowFlags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or
                WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH

        // Support for lock screen if configured
        if (HologramController.instance.config.lockScreenAllowed) {
            @Suppress("DEPRECATION")
            windowFlags = windowFlags or WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
        }

        layoutParams = WindowManager.LayoutParams(
            windowWidth,
            windowHeight,
            windowType,
            windowFlags,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.CENTER_HORIZONTAL or Gravity.BOTTOM
            y = (60 * density).toInt() // Slightly above navigation bar
            x = 0
        }

        hologramView = HologramView(this).apply {
            visualizer = HologramController.instance.visualizer
            theme = HologramController.instance.config.themeColor
            quality = HologramController.instance.config.quality

            onDragListener = { dx, dy ->
                layoutParams?.let { params ->
                    params.x += dx.toInt()
                    params.y -= dy.toInt() // WindowManager y increases upwards from bottom gravity

                    // Clamp to display bounds
                    val maxX = displayMetrics.widthPixels / 2 - windowWidth / 3
                    params.x = params.x.coerceIn(-maxX, maxX)

                    val maxY = displayMetrics.heightPixels - windowHeight
                    params.y = params.y.coerceIn(10, maxY)

                    if (isViewAttached && hologramView != null) {
                        try {
                            windowManager?.updateViewLayout(hologramView, params)
                        } catch (e: Exception) {
                            JarvisLogger.e("HologramOverlayService", "Error dragging overlay", e)
                        }
                    }
                }
            }

            onTapListener = {
                HologramController.instance.onHologramTapped()
            }

            onCloseListener = {
                HologramController.instance.dismissHologram()
            }
        }
    }

    fun showOverlay() {
        if (hologramView == null) {
            initOverlayWindow()
        }

        val view = hologramView ?: return
        val params = layoutParams ?: return

        if (!isViewAttached) {
            try {
                windowManager?.addView(view, params)
                isViewAttached = true
                JarvisLogger.i("HologramOverlayService", "Hologram Window attached to WindowManager.")
            } catch (e: Exception) {
                JarvisLogger.e("HologramOverlayService", "Failed to addView to WindowManager", e)
                return
            }
        }

        view.startAppearance(HologramController.instance.config.appearanceDurationMs)
    }

    fun updateHologramState(
        state: HologramState,
        statusText: String,
        transcriptText: String = "",
        theme: HologramThemeColor = HologramController.instance.config.themeColor,
        quality: HologramQuality = HologramController.instance.config.quality
    ) {
        hologramView?.let { view ->
            view.theme = theme
            view.quality = quality
            view.statusText = statusText
            view.transcriptText = transcriptText
            view.setState(state)
        }
    }

    fun dismissOverlay() {
        hologramView?.startDismiss(HologramController.instance.config.dismissDurationMs) {
            hideOverlay()
        }
    }

    fun hideOverlay() {
        if (isViewAttached && hologramView != null) {
            try {
                windowManager?.removeView(hologramView)
                isViewAttached = false
                JarvisLogger.i("HologramOverlayService", "Hologram Window detached from WindowManager.")
            } catch (e: Exception) {
                JarvisLogger.e("HologramOverlayService", "Error removing overlay view", e)
            }
        }
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        // Reset position safely on orientation changes
        layoutParams?.let { params ->
            params.x = 0
            params.y = (60 * resources.displayMetrics.density).toInt()
            if (isViewAttached && hologramView != null) {
                try {
                    windowManager?.updateViewLayout(hologramView, params)
                } catch (e: Exception) {
                    JarvisLogger.e("HologramOverlayService", "Error updating layout on orientation change", e)
                }
            }
        }
    }

    override fun onDestroy() {
        JarvisLogger.i("HologramOverlayService", "Destroying HologramOverlayService...")
        HologramController.instance.detachOverlayService()
        hideOverlay()
        hologramView = null
        layoutParams = null
        super.onDestroy()
    }

    companion object {
        const val ACTION_SHOW = "com.openjarvis.android.hologram.ACTION_SHOW"
        const val ACTION_HIDE = "com.openjarvis.android.hologram.ACTION_HIDE"
        const val ACTION_DISMISS = "com.openjarvis.android.hologram.ACTION_DISMISS"

        fun start(context: Context) {
            val intent = Intent(context, HologramOverlayService::class.java).apply {
                action = ACTION_SHOW
            }
            context.startService(intent)
        }

        fun stop(context: Context) {
            val intent = Intent(context, HologramOverlayService::class.java).apply {
                action = ACTION_HIDE
            }
            context.startService(intent)
        }
    }
}
