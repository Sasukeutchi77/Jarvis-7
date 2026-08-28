package com.openjarvis.android.communication.contacts

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.database.Cursor
import android.net.Uri
import android.provider.ContactsContract
import androidx.core.content.ContextCompat
import com.openjarvis.android.communication.model.ContactRecord
import com.openjarvis.android.communication.model.ContactResolutionResult
import com.openjarvis.android.logging.JarvisLogger
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.text.Normalizer
import java.util.Locale

/**
 * Robust Controller for Android Contacts Search, Querying and Disambiguation.
 * Operates strictly on Dispatchers.IO using official ContactsContract APIs.
 */
class ContactsController(private val context: Context) {

    fun hasPermission(): Boolean {
        return ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CONTACTS) == PackageManager.PERMISSION_GRANTED
    }

    /**
     * Search contacts with a query string. Returns all matches without arbitrary truncation.
     */
    suspend fun searchContacts(query: String): List<ContactRecord> = withContext(Dispatchers.IO) {
        if (!hasPermission() || query.isBlank()) return@withContext emptyList()

        val normalizedQuery = normalize(query)
        val contactsList = mutableListOf<ContactRecord>()

        val uri: Uri = ContactsContract.CommonDataKinds.Phone.CONTENT_URI
        val projection = arrayOf(
            ContactsContract.CommonDataKinds.Phone.CONTACT_ID,
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
            ContactsContract.CommonDataKinds.Phone.NUMBER,
            ContactsContract.CommonDataKinds.Phone.PHOTO_URI,
            ContactsContract.CommonDataKinds.Phone.ACCOUNT_TYPE_AND_DATA_SET
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
                val accountIndex = it.getColumnIndex(ContactsContract.CommonDataKinds.Phone.ACCOUNT_TYPE_AND_DATA_SET)

                while (it.moveToNext()) {
                    val id = if (idIndex >= 0) it.getString(idIndex) ?: "" else ""
                    val name = if (nameIndex >= 0) it.getString(nameIndex) ?: "" else ""
                    val rawNumber = if (numberIndex >= 0) it.getString(numberIndex) ?: "" else ""
                    val photo = if (photoIndex >= 0) it.getString(photoIndex) else null
                    val account = if (accountIndex >= 0) it.getString(accountIndex) else null

                    val cleanNumber = sanitizePhoneNumber(rawNumber)
                    if (name.isNotBlank() && cleanNumber.isNotBlank()) {
                        contactsList.add(
                            ContactRecord(
                                id = id,
                                displayName = name,
                                phoneNumber = cleanNumber,
                                rawNumber = rawNumber,
                                photoUri = photo,
                                accountType = account
                            )
                        )
                    }
                }
            }
        } catch (e: Exception) {
            JarvisLogger.e("ContactsController", "Error querying contacts", e)
        } finally {
            cursor?.close()
        }

        // If direct LIKE query found nothing or very few, perform fuzzy diacritic-insensitive search on all contacts
        if (contactsList.isEmpty()) {
            val all = getAllContacts()
            val fuzzyMatches = all.filter { contact ->
                val normName = normalize(contact.displayName)
                normName.contains(normalizedQuery) || normalizedQuery.contains(normName)
            }
            return@withContext fuzzyMatches.distinctBy { it.phoneNumber }
        }

        return@withContext contactsList.distinctBy { it.phoneNumber }
    }

    /**
     * Resolves a contact query and handles homonyms explicitly.
     */
    suspend fun resolveContactOrHomonyms(query: String): ContactResolutionResult {
        val cleaned = query.trim()
        if (cleaned.isBlank()) return ContactResolutionResult.NotFound(query)

        // If it's a raw numeric phone number, return instant record
        if (isPhoneNumber(cleaned)) {
            val clean = sanitizePhoneNumber(cleaned)
            return ContactResolutionResult.ExactMatch(
                ContactRecord(
                    id = "raw_number",
                    displayName = clean,
                    phoneNumber = clean,
                    rawNumber = cleaned
                )
            )
        }

        val matches = searchContacts(cleaned)
        if (matches.isEmpty()) {
            return ContactResolutionResult.NotFound(cleaned)
        }

        // Exact match check (case and diacritics normalized)
        val normalizedQuery = normalize(cleaned)
        val exactMatches = matches.filter { normalize(it.displayName) == normalizedQuery }

        if (exactMatches.size == 1) {
            return ContactResolutionResult.ExactMatch(exactMatches.first())
        }

        if (matches.size == 1) {
            return ContactResolutionResult.ExactMatch(matches.first())
        }

        // Multiple matches -> Homonyms
        return ContactResolutionResult.Homonyms(matches, cleaned)
    }

    /**
     * Match contact from homonyms list based on ordinal or name.
     */
    fun selectFromHomonyms(choiceUtterance: String, homonyms: List<ContactRecord>): ContactRecord? {
        val norm = normalize(choiceUtterance)
        if (homonyms.isEmpty()) return null

        // Ordinal / index check
        when {
            norm.contains("premier") || norm == "1" || norm == "le 1" || norm == "premier" -> return homonyms.getOrNull(0)
            norm.contains("deuxieme") || norm.contains("second") || norm == "2" || norm == "le 2" -> return homonyms.getOrNull(1)
            norm.contains("troisieme") || norm == "3" || norm == "le 3" -> return homonyms.getOrNull(2)
            norm.contains("quatrieme") || norm == "4" || norm == "le 4" -> return homonyms.getOrNull(3)
        }

        // Name partial match
        val matched = homonyms.firstOrNull { normalize(it.displayName).contains(norm) || norm.contains(normalize(it.displayName)) }
        return matched
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

                    val cleanNumber = sanitizePhoneNumber(number)
                    if (name.isNotBlank() && cleanNumber.isNotBlank()) {
                        list.add(ContactRecord(id, name, cleanNumber, number, photo))
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

    private fun isPhoneNumber(str: String): Boolean {
        val clean = str.replace(" ", "").replace("-", "").replace("(", "").replace(")", "").replace(".", "")
        return clean.matches(Regex("^\\+?[0-9]{3,15}$"))
    }

    private fun sanitizePhoneNumber(raw: String): String {
        return raw.replace(" ", "").replace("-", "").replace("(", "").replace(")", "").replace(".", "")
    }

    fun normalize(str: String): String {
        return Normalizer.normalize(str, Normalizer.Form.NFD)
            .replace(Regex("\\p{InCombiningDiacriticalMarks}+"), "")
            .lowercase(Locale.ROOT)
            .trim()
    }
}
