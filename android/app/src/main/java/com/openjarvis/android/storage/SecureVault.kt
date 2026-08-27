package com.openjarvis.android.storage

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.openjarvis.android.logging.JarvisLogger

/**
 * Hardware-backed encrypted key-value vault using Android Keystore.
 */
class SecureVault(context: Context) {

    private val sharedPreferences: SharedPreferences

    init {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()

        sharedPreferences = EncryptedSharedPreferences.create(
            context,
            "openjarvis_secure_vault",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
        JarvisLogger.i("SecureVault", "Initialized Android Keystore backed vault.")
    }

    fun putSecret(key: String, value: String) {
        sharedPreferences.edit().putString(key, value).apply()
    }

    fun getSecret(key: String, defaultValue: String = ""): String {
        return sharedPreferences.getString(key, defaultValue) ?: defaultValue
    }

    fun removeSecret(key: String) {
        sharedPreferences.edit().remove(key).apply()
    }

    fun hasSecret(key: String): Boolean {
        return sharedPreferences.contains(key) && !getSecret(key).isBlank()
    }

    companion object {
        const val KEY_OPENAI = "api_key_openai"
        const val KEY_ANTHROPIC = "api_key_anthropic"
        const val KEY_GEMINI = "api_key_gemini"
        const val KEY_DEEPGRAM = "api_key_deepgram"
        const val KEY_OPENROUTER = "api_key_openrouter"
        const val KEY_CARTESIA = "api_key_cartesia"
        const val KEY_NOTION = "api_key_notion"
        const val KEY_SLACK_BOT = "api_key_slack_bot"
        const val KEY_SLACK_APP = "api_key_slack_app"
    }
}
