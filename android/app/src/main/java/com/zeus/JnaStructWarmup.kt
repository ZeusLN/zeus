package app.zeusln.zeus

import android.util.Log
import com.sun.jna.Callback
import com.sun.jna.Native
import com.sun.jna.Pointer
import com.sun.jna.Structure
import java.lang.reflect.Modifier

/**
 * JNA builds one libffi type descriptor per by-value Structure class with
 * size 0, and libffi fills it in place, without a lock, the first time a
 * call uses it. Two threads making that first call at once can leave the
 * descriptor with a wrong size for the rest of the process, and every
 * later call with that struct then copies the wrong number of bytes
 * (java-native-access/jna#1752). On CDK this crashed in the getBalance
 * completion, which copied 72 bytes out of a 40-byte struct.
 *
 * Initializing each descriptor once, on one thread, before any binding
 * call, means libffi never takes that path. start() runs this off the main
 * thread at app launch, and the native modules that use the bindings call
 * await() when they are constructed. React Native builds those modules on
 * its background thread while it creates the ReactInstance, not on the
 * main thread.
 */
object JnaStructWarmup {
    private const val TAG = "JnaStructWarmup"

    // The uniffi bindings that cross the FFI through JNA
    private val PACKAGES = listOf(
        "org.cashudevkit",
        "org.lightningdevkit.ldknode",
        "uniffi.zeus_cashu_restore"
    )

    private val lock = Any()

    @Volatile
    private var done = false

    /** Starts the warm-up on a background thread. */
    fun start() {
        if (done) return
        Thread({ ensureWarm() }, TAG).start()
    }

    /**
     * Returns once the warm-up has finished. If it is still running, this
     * waits for it; if it never started, this runs it on the calling
     * thread. There is no timeout: continuing while the warm-up runs would
     * be the concurrent first use it exists to prevent.
     */
    fun await(caller: String) {
        val begin = System.nanoTime()
        ensureWarm()
        Log.i(
            TAG,
            "$caller waited ${(System.nanoTime() - begin) / 1_000_000}ms " +
                "on ${Thread.currentThread().name}"
        )
    }

    private fun ensureWarm() {
        if (done) return
        synchronized(lock) {
            if (done) return
            try {
                val begin = System.nanoTime()
                val count = warm(PACKAGES)
                Log.i(
                    TAG,
                    "initialized $count struct types in " +
                        "${(System.nanoTime() - begin) / 1_000_000}ms"
                )
            } catch (t: Throwable) {
                Log.w(TAG, "warm-up failed", t)
            } finally {
                done = true
            }
        }
    }

    /**
     * Finds the by-value Structure classes each binding passes across the
     * FFI by walking its UniffiLib: the parameter and return types of its
     * methods, the methods of every Callback type reached, and the fields
     * of every Structure reached. Returns how many it initialized.
     */
    private fun warm(packages: List<String>): Int {
        val loader = JnaStructWarmup::class.java.classLoader
        val found = linkedSetOf<Class<*>>()
        val visited = hashSetOf<Class<*>>()
        val pending = ArrayDeque<Class<*>>()

        for (pkg in packages) {
            for (name in listOf("UniffiLib", "IntegrityCheckingUniffiLib")) {
                // initialize = false: walking the methods must not load the
                // native library, which the binding does on first real use
                try {
                    pending.add(Class.forName("$pkg.$name", false, loader))
                } catch (_: ClassNotFoundException) {
                }
            }
        }

        while (pending.isNotEmpty()) {
            val cls = pending.removeFirst()
            // JNA's own and platform types carry no binding structs
            if (cls.isPrimitive || cls.`package`?.name !in packages) continue
            if (!visited.add(cls)) continue
            when {
                Structure::class.java.isAssignableFrom(cls) -> {
                    if (Structure.ByValue::class.java.isAssignableFrom(cls) &&
                        !Modifier.isAbstract(cls.modifiers)
                    ) {
                        found.add(cls)
                    }
                    // uniffi declares the fields on the base class and adds
                    // an empty ByValue subclass
                    cls.superclass?.let { pending.add(it) }
                    cls.declaredFields
                        .filter { !Modifier.isStatic(it.modifiers) }
                        .forEach { pending.add(it.type) }
                }
                Callback::class.java.isAssignableFrom(cls) || cls.isInterface ||
                    cls.declaredMethods.any { Modifier.isNative(it.modifiers) } -> {
                    for (m in cls.declaredMethods) {
                        m.parameterTypes.forEach { pending.add(it) }
                        pending.add(m.returnType)
                    }
                }
            }
        }

        // Package-private in JNA 5.18.1; kept by the com.sun.jna proguard rule
        val getTypeInfo = Structure::class.java
            .getDeclaredMethod("getTypeInfo")
            .apply { isAccessible = true }
        val initializeFfiType = Native::class.java
            .getDeclaredMethod("initialize_ffi_type", Long::class.javaPrimitiveType)
            .apply { isAccessible = true }

        var count = 0
        for (cls in found) {
            try {
                val struct = cls.getDeclaredConstructor().newInstance() as Structure
                val typeInfo = getTypeInfo.invoke(struct) as Pointer
                initializeFfiType.invoke(null, Pointer.nativeValue(typeInfo))
                count++
            } catch (e: Exception) {
                Log.w(TAG, "could not initialize ${cls.name}", e)
            }
        }
        return count
    }
}
