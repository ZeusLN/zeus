# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.sifir.** { *;}
-keep interface com.sifir.** { *;}
-keep enum com.sifir.** { *;}
-keep public class com.horcrux.svg.** {*;}
-keep class com.swmansion.reanimated.** { *; }

-keep class org.torproject.jni.** { *; }

# Fresco animation cache classes (not included in public API)
-dontwarn com.facebook.imagepipeline.cache.AnimatedCache
-dontwarn com.facebook.imagepipeline.cache.AnimationFrames

# CashuDevKit - Keep all CDK FFI classes and native methods
-keep class org.cashudevkit.** { *; }
-keep interface org.cashudevkit.** { *; }
-keep enum org.cashudevkit.** { *; }
-keepclassmembers class org.cashudevkit.** {
    native <methods>;
}

# LDK Node and zeus_cashu_restore - the other two JNA-backed uniffi bindings.
# proguard-android-optimize.txt (required by AGP 9) drops the -dontoptimize
# that proguard-android.txt carried, so R8 optimization now runs on release
# builds; keep these whole like org.cashudevkit above.
-keep class org.lightningdevkit.** { *; }
-keep interface org.lightningdevkit.** { *; }
-keep enum org.lightningdevkit.** { *; }
-keep class uniffi.** { *; }
-keep interface uniffi.** { *; }
-keep enum uniffi.** { *; }
-keepclassmembers class org.lightningdevkit.**, uniffi.** {
    native <methods>;
}

# JNA - Required by all three uniffi FFI bindings
-keep class com.sun.jna.** { *; }
-keep class * implements com.sun.jna.** { *; }
-dontwarn com.sun.jna.**
