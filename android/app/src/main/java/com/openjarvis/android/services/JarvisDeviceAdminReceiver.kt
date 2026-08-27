package com.openjarvis.android.services

import android.app.admin.DeviceAdminReceiver
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.Toast
import com.openjarvis.android.logging.JarvisLogger

/**
 * JARVIS Super Administrator Receiver
 * Manages device-level security policies, remote lock, system wipe/factory reset,
 * and system update verifications.
 */
class JarvisDeviceAdminReceiver : DeviceAdminReceiver() {

    companion object {
        fun getComponentName(context: Context): ComponentName {
            return ComponentName(context.applicationContext, JarvisDeviceAdminReceiver::class.java)
        }

        fun isDeviceAdminActive(context: Context): Boolean {
            val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as? DevicePolicyManager
            return dpm?.isAdminActive(getComponentName(context)) == true
        }

        /**
         * Lock device screen immediately
         */
        fun lockNow(context: Context): Boolean {
            val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as? DevicePolicyManager
            return try {
                dpm?.lockNow()
                true
            } catch (e: Exception) {
                JarvisLogger.e("DeviceAdmin", "Failed to lock device", e)
                false
            }
        }

        /**
         * Perform Factory Reset / Wipe Data (When explicitly instructed by user)
         */
        fun executeFactoryReset(context: Context, flags: Int = 0): Boolean {
            val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as? DevicePolicyManager
            return try {
                JarvisLogger.w("DeviceAdmin", "Executing wipeData as commanded by user.")
                dpm?.wipeData(flags)
                true
            } catch (e: Exception) {
                JarvisLogger.e("DeviceAdmin", "Failed to execute wipeData", e)
                false
            }
        }
    }

    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
        JarvisLogger.i("DeviceAdmin", "JARVIS Device Admin permissions enabled.")
        Toast.makeText(context, "Privilèges Administrateur JARVIS Activés", Toast.LENGTH_SHORT).show()
    }

    override fun onDisabled(context: Context, intent: Intent) {
        super.onDisabled(context, intent)
        JarvisLogger.i("DeviceAdmin", "JARVIS Device Admin permissions disabled.")
    }
}
