package com.openjarvis.android.services

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.openjarvis.android.R
import com.openjarvis.android.logging.JarvisLogger
import java.io.ByteArrayOutputStream

/**
 * JARVIS Screen Capture & Vision Foreground Service
 * Streams and captures live on-screen frames across any active application
 * for real-time multimodal reasoning and visual assistance.
 */
class JarvisScreenCaptureService : Service() {

    companion object {
        const val CHANNEL_ID = "jarvis_screen_vision_channel"
        const val NOTIFICATION_ID = 2002
        const val ACTION_STOP = "com.openjarvis.android.ACTION_STOP_SCREEN_CAPTURE"

        var mediaProjection: MediaProjection? = null
        var lastCapturedFrameBase64: String? = null
            private set
    }

    private var virtualDisplay: VirtualDisplay? = null
    private var imageReader: ImageReader? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification())
        JarvisLogger.i("ScreenCaptureService", "JARVIS Screen Vision Service initialized.")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopProjection()
            stopSelf()
            return START_NOT_STICKY
        }
        return START_STICKY
    }

    fun setupVirtualDisplay(width: Int, height: Int, density: Int) {
        val proj = mediaProjection ?: return
        imageReader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2)
        virtualDisplay = proj.createVirtualDisplay(
            "JarvisScreenCapture",
            width, height, density,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            imageReader?.surface, null, null
        )

        imageReader?.setOnImageAvailableListener({ reader ->
            val image = reader.acquireLatestImage() ?: return@setOnImageAvailableListener
            try {
                val planes = image.planes
                val buffer = planes[0].buffer
                val pixelStride = planes[0].pixelStride
                val rowStride = planes[0].rowStride
                val rowPadding = rowStride - pixelStride * width

                val bitmap = Bitmap.createBitmap(
                    width + rowPadding / pixelStride,
                    height,
                    Bitmap.Config.ARGB_8888
                )
                bitmap.copyPixelsFromBuffer(buffer)

                // Convert to compressed Base64 JPEG for AI Vision analysis
                val outputStream = ByteArrayOutputStream()
                bitmap.compress(Bitmap.CompressFormat.JPEG, 75, outputStream)
                val bytes = outputStream.toByteArray()
                lastCapturedFrameBase64 = android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP)
                bitmap.recycle()
            } catch (e: Exception) {
                JarvisLogger.e("ScreenCaptureService", "Error capturing screen frame", e)
            } finally {
                image.close()
            }
        }, null)
    }

    private fun stopProjection() {
        virtualDisplay?.release()
        virtualDisplay = null
        imageReader?.close()
        imageReader = null
        mediaProjection?.stop()
        mediaProjection = null
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "JARVIS Vision & Analyse d'écran",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Permet à JARVIS d'analyser l'écran en temps réel par-dessus vos applications."
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("JARVIS Vision Active")
            .setContentText("Analyse contextuelle de l'écran en cours...")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    override fun onDestroy() {
        stopProjection()
        JarvisLogger.i("ScreenCaptureService", "JARVIS Screen Vision Service terminated.")
        super.onDestroy()
    }
}
