package com.openjarvis.android.lifecycle

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Build
import android.os.PowerManager
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.ProcessLifecycleOwner
import com.openjarvis.android.logging.JarvisLogger
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class SystemHealthState(
    val isAppInForeground: Boolean = true,
    val batteryPercentage: Int = 100,
    val isCharging: Boolean = false,
    val isThermalThrottling: Boolean = false,
    val availableMemoryMb: Long = 1024L
)

class AppLifecycleManager(private val context: Context) : DefaultLifecycleObserver {

    private val _healthState = MutableStateFlow(SystemHealthState())
    val healthState: StateFlow<SystemHealthState> = _healthState.asStateFlow()

    private val powerManager = context.getSystemService(Context.POWER_SERVICE) as? PowerManager

    private val batteryReceiver = object : BroadcastReceiver() {
        override fun onReceive(ctx: Context?, intent: Intent?) {
            intent?.let { updateBatteryState(it) }
        }
    }

    fun initialize() {
        ProcessLifecycleOwner.get().lifecycle.addObserver(this)

        val filter = IntentFilter(Intent.ACTION_BATTERY_CHANGED)
        val initialStatus = context.registerReceiver(batteryReceiver, filter)
        initialStatus?.let { updateBatteryState(it) }

        JarvisLogger.i("AppLifecycleManager", "Lifecycle and hardware telemetry initialized.")
    }

    override fun onStart(owner: LifecycleOwner) {
        _healthState.value = _healthState.value.copy(isAppInForeground = true)
        JarvisLogger.d("AppLifecycleManager", "App entered foreground.")
    }

    override fun onStop(owner: LifecycleOwner) {
        _healthState.value = _healthState.value.copy(isAppInForeground = false)
        JarvisLogger.d("AppLifecycleManager", "App entered background.")
    }

    private fun updateBatteryState(intent: Intent) {
        val level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
        val scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
        val status = intent.getIntExtra(BatteryManager.EXTRA_STATUS, -1)

        val pct = if (level >= 0 && scale > 0) (level * 100) / scale else 100
        val isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL

        var isThermalThrottling = false
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && powerManager != null) {
            val statusVal = powerManager.currentThermalStatus
            isThermalThrottling = statusVal >= PowerManager.THERMAL_STATUS_SEVERE
        }

        _healthState.value = _healthState.value.copy(
            batteryPercentage = pct,
            isCharging = isCharging,
            isThermalThrottling = isThermalThrottling
        )
    }
}
