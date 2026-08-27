package com.openjarvis.android.core.tools

import android.content.Context
import android.os.BatteryManager
import android.os.Build
import com.openjarvis.android.logging.JarvisLogger
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

interface JarvisNativeTool {
    val name: String
    val description: String
    val parametersSchema: String
    suspend fun execute(argsJson: String): ToolResult
}

data class ToolResult(
    val success: Boolean,
    val output: String,
    val error: String? = null
)

/**
 * Registry of native Android device tools accessible to JARVIS agents.
 */
class ToolRegistry(private val context: Context) {

    private val tools = mutableMapOf<String, JarvisNativeTool>()

    init {
        register(SystemInfoTool(context))
        register(BatteryStatusTool(context))
        register(TimeDateTool())
    }

    fun register(tool: JarvisNativeTool) {
        tools[tool.name] = tool
    }

    fun getAllTools(): List<JarvisNativeTool> = tools.values.toList()

    fun getTool(name: String): JarvisNativeTool? = tools[name]

    suspend fun executeTool(name: String, argsJson: String): ToolResult {
        val tool = tools[name] ?: return ToolResult(false, "", "Outil inconnu: $name")
        return try {
            tool.execute(argsJson)
        } catch (e: Exception) {
            JarvisLogger.e("ToolRegistry", "Error executing $name", e)
            ToolResult(false, "", "Erreur d'exécution: ${e.message}")
        }
    }
}

class SystemInfoTool(private val context: Context) : JarvisNativeTool {
    override val name = "get_system_info"
    override val description = "Obtient les informations matérielles, système et mémoire de l'appareil Android."
    override val parametersSchema = "{}"

    override suspend fun execute(argsJson: String): ToolResult {
        val runtime = Runtime.getRuntime()
        val totalMemMb = runtime.totalMemory() / (1024 * 1024)
        val freeMemMb = runtime.freeMemory() / (1024 * 1024)
        val maxMemMb = runtime.maxMemory() / (1024 * 1024)

        val info = JSONObject().apply {
            put("device_model", "${Build.MANUFACTURER} ${Build.MODEL}")
            put("android_version", Build.VERSION.RELEASE)
            put("sdk_int", Build.VERSION.SDK_INT)
            put("available_processors", runtime.availableProcessors())
            put("jvm_memory_used_mb", totalMemMb - freeMemMb)
            put("jvm_memory_max_mb", maxMemMb)
        }
        return ToolResult(true, info.toString(2))
    }
}

class BatteryStatusTool(private val context: Context) : JarvisNativeTool {
    override val name = "get_battery_status"
    override val description = "Vérifie le niveau de charge et l'état de la batterie de l'appareil."
    override val parametersSchema = "{}"

    override suspend fun execute(argsJson: String): ToolResult {
        val bm = context.getSystemService(Context.BATTERY_SERVICE) as? BatteryManager
        val level = bm?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) ?: -1
        val isCharging = bm?.isCharging ?: false

        val res = JSONObject().apply {
            put("level_percent", level)
            put("is_charging", isCharging)
        }
        return ToolResult(true, res.toString(2))
    }
}

class TimeDateTool : JarvisNativeTool {
    override val name = "get_current_time"
    override val description = "Donne la date, l'heure exacte et le fuseau horaire de l'utilisateur."
    override val parametersSchema = "{}"

    override suspend fun execute(argsJson: String): ToolResult {
        val sdf = SimpleDateFormat("EEEE d MMMM yyyy, HH:mm:ss (z)", Locale.FRENCH)
        val out = JSONObject().apply {
            put("formatted_time", sdf.format(Date()))
            put("timestamp_ms", System.currentTimeMillis())
        }
        return ToolResult(true, out.toString(2))
    }
}
