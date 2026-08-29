package com.openjarvis.android.storage.database

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.openjarvis.android.automation.storage.AutomationDao
import com.openjarvis.android.automation.storage.AutomationEntity
import com.openjarvis.android.automation.storage.AutomationExecutionEntity
import com.openjarvis.android.storage.database.dao.JarvisMemoryDao
import com.openjarvis.android.storage.database.dao.MemoryDao
import com.openjarvis.android.storage.database.entity.DocumentEntity
import com.openjarvis.android.storage.database.entity.DocumentFtsEntity
import com.openjarvis.android.storage.database.entity.MemoryEntity
import com.openjarvis.android.storage.database.entity.MemoryFtsEntity
import com.openjarvis.android.storage.database.entity.TraceEntity

@Database(
    entities = [
        DocumentEntity::class,
        DocumentFtsEntity::class,
        TraceEntity::class,
        MemoryEntity::class,
        MemoryFtsEntity::class,
        AutomationEntity::class,
        AutomationExecutionEntity::class
    ],
    version = 3,
    exportSchema = false
)
abstract class JarvisDatabase : RoomDatabase() {

    abstract fun memoryDao(): MemoryDao
    abstract fun jarvisMemoryDao(): JarvisMemoryDao
    abstract fun automationDao(): AutomationDao

    companion object {
        @Volatile
        private var INSTANCE: JarvisDatabase? = null

        fun getInstance(context: Context): JarvisDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    JarvisDatabase::class.java,
                    "jarvis_memory.db"
                ).fallbackToDestructiveMigration().build()
                INSTANCE = instance
                instance
            }
        }
    }
}
