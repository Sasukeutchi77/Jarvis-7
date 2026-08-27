# OpenJarvis Android ProGuard & R8 Optimization Rules
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod

# Room Database & FTS5
-keep class * extends androidx.room.RoomDatabase
-dontwarn androidx.room.paging.**
-keepclassmembers class * {
    @androidx.room.* <methods>;
}

# AndroidX Security Crypto & MasterKey
-keepclassmembers class androidx.security.crypto.** { *; }

# OkHttp3 & SSE Client
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }

# Kotlin Coroutines
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}

# Compose Runtime
-keepclassmembers class * extends androidx.compose.runtime.** { *; }
