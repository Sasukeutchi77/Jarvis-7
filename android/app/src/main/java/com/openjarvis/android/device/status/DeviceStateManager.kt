package com.openjarvis.android.device.status

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.wifi.WifiManager
import android.os.BatteryManager
import android.os.Build
import android.os.Environment
import android.os.StatFs
import android.os.SystemClock
import android.provider.Settings
import com.openjarvis.android.device.model.ActionResultStatus
import com.openjarvis.android.device.model.DeviceActionResult
import com.openjarvis.android.device.model.DeviceActionType
import com.openjarvis.android.logging.JarvisLogger
import java.io.File
import kotlin.math.roundToInt

data class BatteryStatusReport(
    val levelPercent: Int,
    val isCharging: Boolean,
    val pluggedSource: String,
    val temperatureCelsius: Float,
    val health: String
)

data class NetworkStatusReport(
    val isConnected: Boolean,
    val isWifi: Boolean,
    val isCellular: Boolean,
    val wifiSsid: String?,
    val isBluetoothEnabled: Boolean
)

data class StorageStatusReport(
    val freeGigabytes: Float,
    val totalGigabytes: Float,
    val usedPercentage: Int
)

data class FullDeviceStateReport(
    val battery: BatteryStatusReport,
    val network: NetworkStatusReport,
    val storage: StorageStatusReport,
    val mediaVolumePercent: Int,
    val screenBrightnessPercent: Int,
    val deviceModel: String,
    val androidVersion: String,
    val uptimeHours: Float
)

/**
 * Manager providing certified, real-time Android hardware and system telemetry.
 */
class DeviceStateManager(private val context: Context) {

    fun getBatteryStatus(): BatteryStatusReport {
        val ifilter = IntentFilter(Intent.ACTION_BATTERY_CHANGED)
        val batteryStatus: Intent? = context.registerReceiver(null, ifilter)

        val level: Int = batteryStatus?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale: Int = batteryStatus?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
        val batteryPct: Int = if (level >= 0 && scale > 0) ((level / scale.toFloat()) * 100).roundToInt() else -1

        val status: Int = batteryStatus?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
        val isCharging: Boolean = status == BatteryManager.BATTERY_STATUS_CHARGING ||
                                 status == BatteryManager.BATTERY_STATUS_FULL

        val chargePlug: Int = batteryStatus?.getIntExtra(BatteryManager.EXTRA_PLUGGED, -1) ?: -1
        val pluggedSource = when (chargePlug) {
            BatteryManager.BATTERY_PLUGGED_AC -> "Secteur (AC)"
            BatteryManager.BATTERY_PLUGGED_USB -> "Port USB"
            BatteryManager.BATTERY_PLUGGED_WIRELESS -> "Induction sans fil"
            else -> "Batterie interne"
        }

        val tempTenths = batteryStatus?.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, 0) ?: 0
        val tempCelsius = tempTenths / 10.0f

        val healthCode = batteryStatus?.getIntExtra(BatteryManager.EXTRA_HEALTH, BatteryManager.BATTERY_HEALTH_UNKNOWN) ?: 0
        val health = when (healthCode) {
            BatteryManager.BATTERY_HEALTH_GOOD -> "Optimale (Bonne)"
            BatteryManager.BATTERY_HEALTH_OVERHEAT -> "Surchauffe"
            BatteryManager.BATTERY_HEALTH_DEAD -> "Dégradée"
            BatteryManager.BATTERY_HEALTH_OVER_VOLTAGE -> "Surtension"
            else -> "Normale"
        }

        return BatteryStatusReport(
            levelPercent = batteryPct,
            isCharging = isCharging,
            pluggedSource = pluggedSource,
            temperatureCelsius = tempCelsius,
            health = health
        )
    }

    fun getNetworkStatus(): NetworkStatusReport {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
        val activeNetwork = cm?.activeNetwork
        val caps = cm?.getNetworkCapabilities(activeNetwork)

        val isConnected = caps?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
        val isWifi = caps?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true
        val isCellular = caps?.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) == true

        var wifiSsid: String? = null
        if (isWifi) {
            val wm = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
            val connectionInfo = wm?.connectionInfo
            val rawSsid = connectionInfo?.ssid
            if (rawSsid != null && rawSsid != "<unknown ssid>" && rawSsid.isNotBlank()) {
                wifiSsid = rawSsid.replace("\"", "")
            }
        }

        val btManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
        val btAdapter = btManager?.adapter
        val isBtEnabled = btAdapter?.isEnabled == true

        return NetworkStatusReport(
            isConnected = isConnected,
            isWifi = isWifi,
            isCellular = isCellular,
            wifiSsid = wifiSsid,
            isBluetoothEnabled = isBtEnabled
        )
    }

    fun getStorageStatus(): StorageStatusReport {
        return try {
            val path: File = Environment.getDataDirectory()
            val stat = StatFs(path.path)
            val blockSize = stat.blockSizeLong
            val totalBlocks = stat.blockCountLong
            val availableBlocks = stat.availableBlocksLong

            val totalBytes = totalBlocks * blockSize
            val freeBytes = availableBlocks * blockSize
            val usedBytes = totalBytes - freeBytes

            val totalGb = (totalBytes.toFloat() / (1024f * 1024f * 1024f))
            val freeGb = (freeBytes.toFloat() / (1024f * 1024f * 1024f))
            val usedPct = if (totalBytes > 0) ((usedBytes.toFloat() / totalBytes.toFloat()) * 100f).roundToInt() else 0

            StorageStatusReport(
                freeGigabytes = ((freeGb * 10).roundToInt()) / 10.0f,
                totalGigabytes = ((totalGb * 10).roundToInt()) / 10.0f,
                usedPercentage = usedPct
            )
        } catch (e: Exception) {
            JarvisLogger.e("DeviceStateManager", "Error reading storage stats", e)
            StorageStatusReport(0f, 0f, 0)
        }
    }

    fun getFullDeviceState(): FullDeviceStateReport {
        val am = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
        val currentVol = am?.getStreamVolume(AudioManager.STREAM_MUSIC) ?: 0
        val maxVol = am?.getStreamMaxVolume(AudioManager.STREAM_MUSIC) ?: 1
        val volPct = ((currentVol.toFloat() / maxVol.toFloat()) * 100f).roundToInt()

        val brightnessRaw = try {
            Settings.System.getInt(context.contentResolver, Settings.System.SCREEN_BRIGHTNESS)
        } catch (e: Exception) {
            128
        }
        val brightnessPct = ((brightnessRaw.toFloat() / 255f) * 100f).roundToInt()

        val uptimeHours = (SystemClock.elapsedRealtime() / (1000f * 60f * 60f))

        return FullDeviceStateReport(
            battery = getBatteryStatus(),
            network = getNetworkStatus(),
            storage = getStorageStatus(),
            mediaVolumePercent = volPct,
            screenBrightnessPercent = brightnessPct,
            deviceModel = "${Build.MANUFACTURER} ${Build.MODEL}",
            androidVersion = "Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})",
            uptimeHours = ((uptimeHours * 10).roundToInt()) / 10.0f
        )
    }

    /**
     * Spoken response for battery status queries.
     */
    fun queryBatteryVoiceResponse(): DeviceActionResult {
        val batt = getBatteryStatus()
        val spoken = if (batt.levelPercent < 0) {
            "Je ne parviens pas à lire le niveau précis de votre batterie pour l'instant."
        } else if (batt.isCharging) {
            "Votre batterie est à ${batt.levelPercent} %, actuellement en charge sur ${batt.pluggedSource}."
        } else {
            "Il vous reste ${batt.levelPercent} % de batterie."
        }

        return DeviceActionResult(
            status = ActionResultStatus.SUCCESS,
            spokenMessage = spoken,
            actionType = DeviceActionType.BATTERY,
            details = mapOf(
                "level" to batt.levelPercent,
                "isCharging" to batt.isCharging,
                "plugged" to batt.pluggedSource,
                "temperature" to batt.temperatureCelsius
            )
        )
    }

    /**
     * Spoken response for full device state query.
     */
    fun queryFullStateVoiceResponse(): DeviceActionResult {
        val state = getFullDeviceState()
        val netDesc = if (state.network.isWifi) {
            val ssidPart = if (state.network.wifiSsid != null) " au réseau ${state.network.wifiSsid}" else ""
            "connecté en Wi-Fi$ssidPart"
        } else if (state.network.isCellular) {
            "connecté au réseau mobile cellulaire"
        } else {
            "hors ligne"
        }

        val spoken = "Votre ${state.deviceModel} est à ${state.battery.levelPercent} % de batterie, $netDesc. Il vous reste ${state.storage.freeGigabytes} Go d'espace libre."

        return DeviceActionResult(
            status = ActionResultStatus.SUCCESS,
            spokenMessage = spoken,
            actionType = DeviceActionType.DEVICE_STATUS,
            details = mapOf(
                "battery" to state.battery.levelPercent,
                "model" to state.deviceModel,
                "network" to netDesc,
                "freeStorageGb" to state.storage.freeGigabytes
            )
        )
    }
}
