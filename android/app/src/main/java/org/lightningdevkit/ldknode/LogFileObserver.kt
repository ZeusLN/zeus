package org.lightningdevkit.ldknode

import android.os.FileObserver
import android.util.Log
import java.io.*

class LogFileObserver(
    private val filePath: String,
    private val onNewLine: (String) -> Unit
) {
    private var fileObserver: FileObserver? = null
    private var reader: BufferedReader? = null

    fun startObserving() {
        // Open file, create if needed
        val file = File(filePath)
        file.parentFile?.mkdirs()
        if (!file.exists()) file.createNewFile()

        val stream = FileInputStream(file)
        reader = BufferedReader(InputStreamReader(stream))

        // Read to EOF without emitting (skip historical)
        readToEnd(emit = false)

        // Watch for MODIFY events
        fileObserver = object : FileObserver(filePath) {
            override fun onEvent(event: Int, path: String?) {
                if (event != MODIFY) return
                readToEnd(emit = true)
            }
        }
        fileObserver?.startWatching()
    }

    fun stopObserving() {
        fileObserver?.stopWatching()
        fileObserver = null
        reader?.close()
        reader = null
    }

    private fun readToEnd(emit: Boolean) {
        try {
            var line = reader?.readLine()
            while (line != null) {
                if (emit) onNewLine(line)
                line = reader?.readLine()
            }
        } catch (e: IOException) {
            Log.e("LogFileObserver", "Error reading from log file", e)
        }
    }

    companion object {
        fun tailFile(filePath: String, numLines: Int): String {
            val file = File(filePath)
            if (!file.exists() || file.length() == 0L) return ""

            // Read last chunk (256KB should be plenty for typical numLines)
            val chunkSize = minOf(262144L, file.length())
            val raf = RandomAccessFile(file, "r")
            raf.use {
                it.seek(file.length() - chunkSize)
                val bytes = ByteArray(chunkSize.toInt())
                it.readFully(bytes)
                val content = String(bytes, Charsets.UTF_8)
                val lines = content.split("\n")
                return lines.takeLast(numLines).joinToString("\n")
            }
        }
    }
}
