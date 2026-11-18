package app.zeusln.zeus

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.net.InetSocketAddress
import java.net.Proxy
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener

/**
 * WebSocket transport routed through the local Tor SOCKS proxy started by
 * react-native-nitro-tor. React Native's own WebSocket module builds its
 * OkHttp client without a proxy, so it cannot honor the app's Tor setting.
 *
 * OkHttp hands SOCKS proxies an unresolved hostname (RouteSelector creates
 * InetSocketAddress.createUnresolved for Proxy.Type.SOCKS), so DNS
 * resolution happens inside Tor and .onion hosts work. TLS for wss URLs is
 * negotiated end-to-end through the tunnel with standard certificate
 * validation, matching the direct WebSocket path's behavior.
 */
class TorWebSocketModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val sockets = ConcurrentHashMap<String, WebSocket>()
    private var client: OkHttpClient? = null
    private var clientSocksPort: Int = -1

    // Set when React tears this module down (JS reload, in-app restart).
    // A new module instance serves the next JS runtime, but under the new
    // architecture this instance's emits still reach that runtime through
    // the shared ReactHost, where socket ids restart and can collide.
    @Volatile private var invalidated = false

    override fun getName(): String = "TorWebSocketModule"

    @Synchronized
    private fun getClient(socksPort: Int): OkHttpClient {
        val existing = client
        if (existing != null && clientSocksPort == socksPort) return existing
        val created = OkHttpClient.Builder()
            .proxy(
                Proxy(
                    Proxy.Type.SOCKS,
                    InetSocketAddress.createUnresolved("127.0.0.1", socksPort)
                )
            )
            .connectTimeout(60, TimeUnit.SECONDS)
            // streams stay open indefinitely
            .readTimeout(0, TimeUnit.MILLISECONDS)
            .pingInterval(30, TimeUnit.SECONDS)
            // OkHttp follows a 3xx on the handshake and drops only the
            // Authorization header when the host changes, so the stream's
            // Grpc-Metadata-Macaroon header would go to whatever host the
            // node redirects to. Without redirects a 3xx fails the
            // handshake (onFailure), as MainApplication.kt does for React
            // Native's WebSocket and doTorRequest does for REST.
            .followRedirects(false)
            .followSslRedirects(false)
            .build()
        client = created
        clientSocksPort = socksPort
        return created
    }

    private fun emit(event: String, id: String, fill: (WritableMap) -> Unit = {}) {
        if (invalidated) return
        val map = Arguments.createMap()
        map.putString("id", id)
        fill(map)
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(event, map)
    }

    @ReactMethod
    fun connect(id: String, url: String, headers: ReadableMap, socksPort: Int) {
        if (invalidated) return
        val builder = Request.Builder().url(url)
        val iterator = headers.keySetIterator()
        while (iterator.hasNextKey()) {
            val key = iterator.nextKey()
            headers.getString(key)?.let { builder.addHeader(key, it) }
        }

        val socket = getClient(socksPort).newWebSocket(
            builder.build(),
            object : WebSocketListener() {
                override fun onOpen(webSocket: WebSocket, response: Response) {
                    emit("TorWebSocketOpen", id)
                }

                override fun onMessage(webSocket: WebSocket, text: String) {
                    emit("TorWebSocketMessage", id) { it.putString("data", text) }
                }

                override fun onFailure(
                    webSocket: WebSocket,
                    t: Throwable,
                    response: Response?
                ) {
                    if (sockets.remove(id) != null) {
                        emit("TorWebSocketError", id) {
                            it.putString("message", t.message ?: t.toString())
                        }
                        // mirror React Native's WebSocket, which emits
                        // close after error
                        emit("TorWebSocketClose", id)
                    }
                }

                override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                    webSocket.close(code, reason)
                }

                override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                    if (sockets.remove(id) != null) {
                        emit("TorWebSocketClose", id) {
                            it.putInt("code", code)
                            it.putString("reason", reason)
                        }
                    }
                }
            }
        )
        sockets[id] = socket
    }

    @ReactMethod
    fun send(id: String, message: String) {
        sockets[id]?.send(message)
    }

    @ReactMethod
    fun close(id: String) {
        sockets.remove(id)?.close(1000, null)
    }

    // Close every stream when React tears the module down, as React
    // Native's WebSocketModule does. Otherwise the streams outlive the JS
    // runtime that opened them: lnd keeps the orphaned channel acceptor
    // registered and rejects inbound channel opens once it times out
    // waiting for an answer that never comes.
    override fun invalidate() {
        invalidated = true
        for (socket in sockets.values) {
            socket.close(1001 /* endpoint is going away */, null)
        }
        sockets.clear()
        super.invalidate()
    }

    // Required stubs for NativeEventEmitter on the new architecture interop
    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}
}
