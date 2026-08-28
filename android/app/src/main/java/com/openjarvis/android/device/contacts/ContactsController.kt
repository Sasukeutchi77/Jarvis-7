package com.openjarvis.android.device.contacts

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.database.Cursor
import android.net.Uri
import android.provider.ContactsContract
import androidx.core.content.ContextCompat
import com.openjarvis.android.logging.JarvisLogger
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.text.Normalizer
import java.util.Locale

data class ContactRecord(
    val id: String,
    val displayName: String,
    val phoneNumber: String,
    val photoUri: String? = null
)

/**
 * Controller for querying device contacts safely on Dispatchers.IO.
 */
class ContactsController(private val context: Context) {

    fun hasPermission(): Boolean {
        return ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CONTACTS) == PackageManager.PERMISSION_GRANTED
    }

    suspend fun searchContacts(query: String): List<ContactRecord> = withContext(Dispatchers.IO) {
        if (!hasPermission() || query.isBlank()) return@withContext emptyList()

        val normalizedQuery = normalize(query)
        val contactsList = mutableListOf<ContactRecord>()

        val uri: Uri = ContactsContract.CommonDataKinds.Phone.CONTENT_URI
        val projection = arrayOf(
            ContactsContract.CommonDataKinds.Phone.CONTACT_ID,
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
            ContactsContract.CommonDataKinds.Phone.NUMBER,
            ContactsContract.CommonDataKinds.Phone.PHOTO_URI
        )

        val selection = "${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} LIKE ?"
        val selectionArgs = arrayOf("%$query%")

        var cursor: Cursor? = null
        try {
            cursor = context.contentResolver.query(
                uri,
                projection,
                selection,
                selectionArgs,
                "${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} ASC"
            )

            cursor?.let {
                val idIndex = it.getColumnIndex(ContactsContract.CommonDataKinds.Phone.CONTACT_ID)
                val nameIndex = it.getColumnIndex(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME)
                val numberIndex = it.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER)
                val photoIndex = it.getColumnIndex(ContactsContract.CommonDataKinds.Phone.PHOTO_URI)

                while (it.moveToNext()) {
                    val id = if (idIndex >= 0) it.getString(idIndex) ?: "" else ""
                    val name = if (nameIndex >= 0) it.getString(nameIndex) ?: "" else ""
                    val rawNumber = if (numberIndex >= 0) it.getString(numberIndex) ?: "" else ""
                    val photo = if (photoIndex >= 0) it.getString(photoIndex) else null

                    val cleanNumber = rawNumber.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
                    if (name.isNotBlank() && cleanNumber.isNotBlank()) {
                        contactsList.add(ContactRecord(id, name, cleanNumber, photo))
                    }
                }
            }
        } catch (e: Exception) {
            JarvisLogger.e("ContactsController", "Error querying contacts", e)
        } finally {
            cursor?.close()
        }

        // If direct SQL LIKE returned nothing, perform in-memory fuzzy search across all contacts
        if (contactsList.isEmpty()) {
            val all = getAllContacts()
            return@withContext all.filter { contact ->
                val normName = normalize(contact.displayName)
                normName.contains(normalizedQuery) || normalizedQuery.contains(normName)
            }
        }

        return@withContext contactsList.distinctBy { it.phoneNumber }
    }

    suspend fun findFirstContactMatch(query: String): ContactRecord? {
        val matches = searchContacts(query)
        if (matches.isEmpty()) return null
        val normalizedQuery = normalize(query)

        // Prefer exact match
        val exact = matches.firstOrNull { normalize(it.displayName) == normalizedQuery }
        return exact ?: matches.first()
    }

    suspend fun getAllContacts(): List<ContactRecord> = withContext(Dispatchers.IO) {
        if (!hasPermission()) return@withContext emptyList()

        val list = mutableListOf<ContactRecord>()
        val uri: Uri = ContactsContract.CommonDataKinds.Phone.CONTENT_URI
        val projection = arrayOf(
            ContactsContract.CommonDataKinds.Phone.CONTACT_ID,
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
            ContactsContract.CommonDataKinds.Phone.NUMBER,
            ContactsContract.CommonDataKinds.Phone.PHOTO_URI
        )

        var cursor: Cursor? = null
        try {
            cursor = context.contentResolver.query(
                uri,
                projection,
                null,
                null,
                "${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} ASC"
            )

            cursor?.let {
                val idIndex = it.getColumnIndex(ContactsContract.CommonDataKinds.Phone.CONTACT_ID)
                val nameIndex = it.getColumnIndex(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME)
                val numberIndex = it.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER)
                val photoIndex = it.getColumnIndex(ContactsContract.CommonDataKinds.Phone.PHOTO_URI)

                while (it.moveToNext()) {
                    val id = if (idIndex >= 0) it.getString(idIndex) ?: "" else ""
                    val name = if (nameIndex >= 0) it.getString(nameIndex) ?: "" else ""
                    val number = if (numberIndex >= 0) it.getString(numberIndex) ?: "" else ""
                    val photo = if (photoIndex >= 0) it.getString(photoIndex) else null

                    val cleanNumber = number.replace(" ", "").replace("-", "")
                    if (name.isNotBlank() && cleanNumber.isNotBlank()) {
                        list.add(ContactRecord(id, name, cleanNumber, photo))
                    }
                }
            }
        } catch (e: Exception) {
            JarvisLogger.e("ContactsController", "Error querying all contacts", e)
        } finally {
            cursor?.close()
        }

        return@withContext list.distinctBy { it.phoneNumber }
    }

    private fun normalize(str: String): String {
        return Normalizer.normalize(str, Normalizer.Form.NFD)
            .replace(Regex("\\p{InCombiningDiacriticalMarks}+"), "")
            .lowercase(Locale.ROOT)
            .trim()
    }
}
