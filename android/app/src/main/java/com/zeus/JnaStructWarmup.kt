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
 *
 * TODO(#5916): remove this once the app uses a JNA release with a fix for
 * jna#1752.
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
                val (initialized, found) = warm(PACKAGES)
                val ms = (System.nanoTime() - begin) / 1_000_000
                if (found > 0 && initialized == found) {
                    Log.i(TAG, "initialized $initialized struct types in ${ms}ms")
                } else {
                    Log.e(
                        TAG,
                        "initialized $initialized of $found struct types in ${ms}ms"
                    )
                }
            } catch (t: Throwable) {
                // The app then runs as it did without the warm-up
                Log.e(TAG, "warm-up failed", t)
            } finally {
                done = true
            }
        }
    }

    /**
     * Finds the by-value Structure classes each binding passes across the
     * FFI by walking its UniffiLib: the parameter and return types of its
     * methods, the methods of every Callback type reached, and the fields
     * of every Structure reached. Returns how many it initialized with the
     * size JNA expects, and how many it found.
     */
    private fun warm(packages: List<String>): Pair<Int, Int> {
        val loader = JnaStructWarmup::class.java.classLoader
        val found = linkedSetOf<Class<*>>()
        val visited = hashSetOf<Class<*>>()
        val pending = ArrayDeque<Class<*>>()

        for (pkg in packages) {
            var libs = 0
            for (name in listOf("UniffiLib", "IntegrityCheckingUniffiLib")) {
                // initialize = false: walking the methods must not load the
                // native library, which the binding does on first real use
                try {
                    pending.add(Class.forName("$pkg.$name", false, loader))
                    libs++
                } catch (_: ClassNotFoundException) {
                }
            }
            // uniffi may rename these classes in a later version
            if (libs == 0) Log.e(TAG, "$pkg: no UniffiLib class found")
        }

        while (pending.isNotEmpty()) {
            val cls = pending.removeFirst()
            // JNA's own and platform types carry no binding structs
            if (cls.isPrimitive || cls.`package`?.name !in packages) continue
            if (!visited.add(cls)) continue
            try {
                walk(cls, found, pending)
            } catch (t: Throwable) {
                Log.e(TAG, "could not walk ${cls.name}", t)
            }
        }

        for (pkg in packages) {
            val types = found.count { it.`package`?.name == pkg }
            if (types == 0) {
                Log.e(TAG, "$pkg: no struct types found")
            } else {
                Log.d(TAG, "$pkg: $types struct types")
            }
        }

        // Package-private in JNA 5.18.1; kept by the com.sun.jna proguard rule
        val getTypeInfo = Structure::class.java
            .getDeclaredMethod("getTypeInfo")
            .apply { isAccessible = true }
        // Returns the size libffi computed for the descriptor
        val initializeFfiType = Native::class.java
            .getDeclaredMethod("initialize_ffi_type", Long::class.javaPrimitiveType)
            .apply { isAccessible = true }

        var count = 0
        for (cls in found) {
            try {
                val struct = cls.getDeclaredConstructor().newInstance() as Structure
                val typeInfo = getTypeInfo.invoke(struct) as Pointer
                val size =
                    initializeFfiType.invoke(null, Pointer.nativeValue(typeInfo)) as Int
                // A descriptor that already had a wrong size keeps it
                if (size == struct.size()) {
                    Log.d(TAG, "${cls.name}: $size bytes")
                    count++
                } else {
                    Log.e(
                        TAG,
                        "${cls.name}: libffi size $size, JNA size ${struct.size()}"
                    )
                }
            } catch (t: Throwable) {
                Log.e(TAG, "could not initialize ${cls.name}", t)
            }
        }
        return Pair(count, found.size)
    }

    /**
     * Adds cls to found if it is a by-value Structure, and queues the types
     * it can pass across the FFI.
     */
    private fun walk(
        cls: Class<*>,
        found: MutableSet<Class<*>>,
        pending: ArrayDeque<Class<*>>
    ) {
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
}
