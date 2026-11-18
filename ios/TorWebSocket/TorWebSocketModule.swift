import Foundation

/**
 * WebSocket transport routed through the local Tor SOCKS proxy started by
 * react-native-nitro-tor. React Native's WebSocket implementation has no
 * proxy support, so it cannot honor the app's Tor setting.
 *
 * Uses NSURLSessionWebSocketTask with a SOCKS connectionProxyDictionary.
 * The dictionary uses the literal "SOCKSEnable"/"SOCKSProxy"/"SOCKSPort"
 * keys: the kCFNetworkProxiesSOCKS* symbols are macOS-only in the SDK
 * headers, but the CFNetwork proxy layer honors them on iOS (this is the
 * standard Tor integration approach). Hostnames are resolved by the proxy,
 * so .onion hosts work. TLS for wss URLs is negotiated end-to-end through
 * the tunnel with standard certificate validation, matching the direct
 * WebSocket path's behavior.
 */
@objc(TorWebSocketModule)
class TorWebSocketModule: RCTEventEmitter, URLSessionWebSocketDelegate {

    private var tasks = [String: URLSessionWebSocketTask]()
    private var idsByTask = [Int: String]()
    // status of a refused handshake redirect, by task identifier
    private var redirectStatusByTask = [Int: Int]()
    private var session: URLSession?
    private var sessionSocksPort: Int = -1
    private let lock = NSLock()
    // set when React tears this module down (JS reload, in-app restart)
    private var invalidated = false

    @objc
    override static func requiresMainQueueSetup() -> Bool {
        return false
    }

    override func supportedEvents() -> [String]! {
        return [
            "TorWebSocketOpen",
            "TorWebSocketMessage",
            "TorWebSocketError",
            "TorWebSocketClose"
        ]
    }

    private func emit(withName name: String, body: [String: Any]) {
        lock.lock()
        let isInvalidated = invalidated
        lock.unlock()
        if !isInvalidated {
            sendEvent(withName: name, body: body)
        }
    }

    // Close every stream when React tears the module down, as React
    // Native's RCTWebSocketModule does. An in-app restart on iOS is a JS
    // reload in the same process, and the session keeps this module alive
    // as its delegate, so without this the streams (with the macaroon)
    // outlive the JS runtime that opened them: lnd keeps the orphaned
    // channel acceptor registered and rejects inbound channel opens once
    // it times out waiting for an answer that never comes.
    override func invalidate() {
        lock.lock()
        invalidated = true
        let openTasks = Array(tasks.values)
        tasks.removeAll()
        idsByTask.removeAll()
        redirectStatusByTask.removeAll()
        let currentSession = session
        session = nil
        lock.unlock()

        for task in openTasks {
            task.cancel(with: .goingAway, reason: nil)
        }
        // releases the session's strong reference to this delegate once
        // the closing tasks finish
        currentSession?.finishTasksAndInvalidate()
        super.invalidate()
    }

    private func getSession(socksPort: Int) -> URLSession {
        if let existing = session, sessionSocksPort == socksPort {
            return existing
        }
        let config = URLSessionConfiguration.ephemeral
        config.connectionProxyDictionary = [
            "SOCKSEnable": 1,
            "SOCKSProxy": "127.0.0.1",
            "SOCKSPort": socksPort
        ]
        config.timeoutIntervalForRequest = 60
        let created = URLSession(
            configuration: config,
            delegate: self,
            delegateQueue: nil
        )
        session = created
        sessionSocksPort = socksPort
        return created
    }

    @objc(connect:url:headers:socksPort:)
    func connect(
        _ id: String,
        url: String,
        headers: NSDictionary,
        socksPort: NSNumber
    ) {
        guard let parsedUrl = URL(string: url) else {
            emit(
                withName: "TorWebSocketError",
                body: ["id": id, "message": "invalid URL"]
            )
            emit(withName: "TorWebSocketClose", body: ["id": id])
            return
        }

        var request = URLRequest(url: parsedUrl)
        for (key, value) in headers {
            if let headerName = key as? String,
                let headerValue = value as? String {
                request.setValue(headerValue, forHTTPHeaderField: headerName)
            }
        }

        lock.lock()
        if invalidated {
            lock.unlock()
            return
        }
        let task = getSession(socksPort: socksPort.intValue)
            .webSocketTask(with: request)
        tasks[id] = task
        idsByTask[task.taskIdentifier] = id
        lock.unlock()

        receiveLoop(id: id, task: task)
        task.resume()
    }

    private func receiveLoop(id: String, task: URLSessionWebSocketTask) {
        task.receive { [weak self] result in
            guard let self = self else { return }
            switch result {
            case .success(let message):
                var text: String?
                switch message {
                case .string(let value):
                    text = value
                case .data(let value):
                    text = String(data: value, encoding: .utf8)
                @unknown default:
                    break
                }
                if let text = text {
                    self.emit(
                        withName: "TorWebSocketMessage",
                        body: ["id": id, "data": text]
                    )
                }
                self.receiveLoop(id: id, task: task)
            case .failure(let error):
                let redirectStatus = self.takeRedirectStatus(task: task)
                if self.removeTask(id: id) != nil {
                    // a refused redirect fails the task with a generic "bad
                    // response" error, so name the cause
                    let message = redirectStatus.map {
                        "Expected HTTP 101 response but was \($0) (redirect not followed)"
                    } ?? error.localizedDescription
                    self.emit(
                        withName: "TorWebSocketError",
                        body: ["id": id, "message": message]
                    )
                    // mirror React Native's WebSocket, which emits close
                    // after error
                    self.emit(
                        withName: "TorWebSocketClose",
                        body: ["id": id]
                    )
                }
            }
        }
    }

    private func removeTask(id: String) -> URLSessionWebSocketTask? {
        lock.lock()
        defer { lock.unlock() }
        guard let task = tasks.removeValue(forKey: id) else { return nil }
        idsByTask.removeValue(forKey: task.taskIdentifier)
        redirectStatusByTask.removeValue(forKey: task.taskIdentifier)
        return task
    }

    private func takeRedirectStatus(task: URLSessionWebSocketTask) -> Int? {
        lock.lock()
        defer { lock.unlock() }
        return redirectStatusByTask.removeValue(forKey: task.taskIdentifier)
    }

    private func idFor(task: URLSessionWebSocketTask) -> String? {
        lock.lock()
        defer { lock.unlock() }
        return idsByTask[task.taskIdentifier]
    }

    // URLSessionWebSocketTask follows a 3xx on the handshake and sends the
    // request's headers, including Grpc-Metadata-Macaroon, to the new
    // host. Refusing the redirect fails the task instead (NSURLErrorDomain
    // -1011), as doTorRequest refuses redirects for REST and Android's
    // TorWebSocketModule does for its streams.
    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        willPerformHTTPRedirection response: HTTPURLResponse,
        newRequest request: URLRequest,
        completionHandler: @escaping (URLRequest?) -> Void
    ) {
        lock.lock()
        redirectStatusByTask[task.taskIdentifier] = response.statusCode
        lock.unlock()
        completionHandler(nil)
    }

    func urlSession(
        _ session: URLSession,
        webSocketTask: URLSessionWebSocketTask,
        didOpenWithProtocol protocolName: String?
    ) {
        if let id = idFor(task: webSocketTask) {
            emit(withName: "TorWebSocketOpen", body: ["id": id])
        }
    }

    func urlSession(
        _ session: URLSession,
        webSocketTask: URLSessionWebSocketTask,
        didCloseWith closeCode: URLSessionWebSocketTask.CloseCode,
        reason: Data?
    ) {
        if let id = idFor(task: webSocketTask),
            removeTask(id: id) != nil {
            emit(
                withName: "TorWebSocketClose",
                body: ["id": id, "code": closeCode.rawValue]
            )
        }
    }

    @objc(send:message:)
    func send(_ id: String, message: String) {
        lock.lock()
        let task = tasks[id]
        lock.unlock()
        task?.send(.string(message)) { [weak self] error in
            if let error = error, let self = self {
                self.emit(
                    withName: "TorWebSocketError",
                    body: ["id": id, "message": error.localizedDescription]
                )
            }
        }
    }

    @objc(close:)
    func close(_ id: String) {
        removeTask(id: id)?.cancel(with: .normalClosure, reason: nil)
    }
}
