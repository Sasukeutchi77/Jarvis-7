package com.openjarvis.android.storage.database.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.openjarvis.android.storage.database.entity.DocumentEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface MemoryDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertDocument(document: DocumentEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertDocuments(documents: List<DocumentEntity>)

    @Update
    suspend fun updateDocument(document: DocumentEntity)

    @Query("DELETE FROM documents WHERE id = :id")
    suspend fun deleteDocument(id: String)

    @Query("DELETE FROM documents")
    suspend fun deleteAllDocuments()

    @Query("SELECT * FROM documents ORDER BY updatedAt DESC")
    fun getAllDocumentsFlow(): Flow<List<DocumentEntity>>

    @Query("SELECT * FROM documents ORDER BY updatedAt DESC")
    suspend fun getAllDocuments(): List<DocumentEntity>

    @Query("SELECT * FROM documents WHERE id = :id LIMIT 1")
    suspend fun getDocumentById(id: String): DocumentEntity?

    @Query("SELECT * FROM documents WHERE category = :category ORDER BY updatedAt DESC")
    suspend fun getDocumentsByCategory(category: String): List<DocumentEntity>

    @Query("SELECT * FROM documents WHERE content LIKE '%' || :query || '%' OR source LIKE '%' || :query || '%' ORDER BY updatedAt DESC")
    suspend fun searchDocuments(query: String): List<DocumentEntity>

    @Query("""
        SELECT d.* FROM documents d
        JOIN documents_fts fts ON d.id = fts.rowid
        WHERE documents_fts MATCH :searchQuery
        ORDER BY d.updatedAt DESC
        LIMIT :limit
    """)
    suspend fun searchFts(searchQuery: String, limit: Int = 5): List<DocumentEntity>

    @Query("SELECT COUNT(*) FROM documents")
    fun getDocumentCountFlow(): Flow<Int>
}
