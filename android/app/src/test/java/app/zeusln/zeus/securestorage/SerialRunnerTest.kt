package app.zeusln.zeus.securestorage

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Collections
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

class SerialRunnerTest {
    private val executor = Executors.newSingleThreadExecutor()
    private val runner = SerialRunner(executor)
    private val events = Collections.synchronizedList(mutableListOf<String>())

    private fun run(name: String, block: () -> Any?) =
        runner.run(
            block,
            { events.add("$name resolved $it") },
            { events.add("$name rejected ${it.message}") }
        )

    @Test
    fun resolvesWithTheResultAndRejectsWithTheError() {
        run("a") { "value" }
        // an Error too, or the JS caller waits forever
        run("b") { throw AssertionError("boom") }
        runner.shutdown()

        assertTrue(executor.awaitTermination(5, TimeUnit.SECONDS))
        assertEquals(listOf("a resolved value", "b rejected boom"), events)
    }

    @Test
    fun finishesQueuedCallsAfterShutdown() {
        val started = CountDownLatch(1)
        val release = CountDownLatch(1)
        run("write 1") {
            started.countDown()
            release.await()
            true
        }
        run("write 2") { true }
        started.await()

        runner.shutdown()
        release.countDown()

        assertTrue(executor.awaitTermination(5, TimeUnit.SECONDS))
        assertEquals(listOf("write 1 resolved true", "write 2 resolved true"), events)
    }

    @Test
    fun rejectsCallsAfterShutdown() {
        runner.shutdown()

        run("late") { "never" }

        assertEquals(listOf("late rejected Storage module is shut down"), events)
        assertTrue(executor.awaitTermination(5, TimeUnit.SECONDS))
    }
}
