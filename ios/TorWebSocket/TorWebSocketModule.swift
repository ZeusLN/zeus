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
    private var session: URLSession?
    private var sessionSocksPort: Int = -1
    private let lock = NSLock()

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
            sendEvent(
                withName: "TorWebSocketError",
                body: ["id": id, "message": "invalid URL"]
            )
            sendEvent(withName: "TorWebSocketClose", body: ["id": id])
            return
        }

        var request = URLRequest(url: parsedUrl)
        for (key, value) in headers {
            if let headerName = key as? String,
                let headerValue = value as? String {
                request.setValue(headerValue, forHTTPHeaderField: headerName)
            }
        }

        let task = getSession(socksPort: socksPort.intValue)
            .webSocketTask(with: request)

        lock.lock()
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
                    self.sendEvent(
                        withName: "TorWebSocketMessage",
                        body: ["id": id, "data": text]
                    )
                }
                self.receiveLoop(id: id, task: task)
            case .failure(let error):
                if self.removeTask(id: id) != nil {
                    self.sendEvent(
                        withName: "TorWebSocketError",
                        body: ["id": id, "message": error.localizedDescription]
                    )
                    // mirror React Native's WebSocket, which emits close
                    // after error
                    self.sendEvent(
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
        return task
    }

    private func idFor(task: URLSessionWebSocketTask) -> String? {
        lock.lock()
        defer { lock.unlock() }
        return idsByTask[task.taskIdentifier]
    }

    func urlSession(
        _ session: URLSession,
        webSocketTask: URLSessionWebSocketTask,
        didOpenWithProtocol protocolName: String?
    ) {
        if let id = idFor(task: webSocketTask) {
            sendEvent(withName: "TorWebSocketOpen", body: ["id": id])
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
            sendEvent(
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
                self.sendEvent(
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
