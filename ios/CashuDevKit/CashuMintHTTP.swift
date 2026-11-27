import Foundation
import Network

enum CashuMintHTTPError: LocalizedError {
    case unsupportedURL
    case connectionFailed(reason: String)
    case invalidResponse
    case compressedResponse
    case responseTooLarge
    case tooManyRedirects
    case timedOut

    var errorDescription: String? {
        switch self {
        case .unsupportedURL: return "Unsupported mint URL"
        case .connectionFailed(let reason): return "Connection to the mint failed: \(reason)"
        case .invalidResponse: return "Mint sent an invalid HTTP response"
        case .compressedResponse: return "Mint sent a compressed response"
        case .responseTooLarge: return "Mint response too large"
        case .tooManyRedirects: return "Mint redirected too many times"
        case .timedOut: return "Mint request timed out"
        }
    }
}

/// GET for the mint endpoints ZEUS reads itself (`/v1/info` and the
/// external mint quote), with a limit on everything the mint can make the
/// app hold in memory.
///
/// This does not use URLSession. URLSession decompresses a response inside
/// CFNetwork, one network read at a time, before the app sees any of it,
/// and has no option to turn that off. A 329-byte brotli body is delivered
/// as one 400 MB chunk, so a limit on the delivered data does not limit
/// memory, and neither does cancelling when the response headers arrive
/// (ZeusLN/zeus#5690). Here the response is read from the connection at
/// most `readSize` bytes at a time, is never decompressed, and reading
/// stops at the limit.
///
/// The request is HTTP/1.1 and asks for an uncompressed body. CDK's own
/// mint transport (bitreq) is also an HTTP/1.1 client that does not
/// decompress, so a mint that works with CDK can answer this request.
enum CashuMintHTTP {
    /// Longest 2xx body accepted. Mint info and quote responses are a few KB.
    static let maxResponseBytes = 1024 * 1024
    /// An error body only goes into a rejection message
    static let maxErrorBodyBytes = 4096
    /// Longest status line plus header fields accepted, counting the
    /// empty line that ends them
    static let maxHeaderBytes = 64 * 1024
    /// Longest chunk-size line accepted, counting chunk extensions and
    /// the CRLF that ends it
    static let maxChunkLineBytes = 1024
    /// Redirects followed for one `get` before it gives up
    static let maxRedirects = 5
    /// Time allowed for one request, from connecting to the last body byte.
    /// Unlike URLSession's request timeout it does not restart whenever
    /// data arrives, so a mint that keeps sending slowly is still cut off.
    static let defaultTimeout: TimeInterval = 30
    /// Most bytes taken from the connection in one read
    static let readSize = 16 * 1024

    struct Response {
        let status: Int
        /// The body of a 2xx response. For any other status, at most the
        /// first `maxErrorBodyBytes` of it, or nil if it could not be read.
        let body: Data?
        /// For a status other than 2xx: the body is longer than `body`
        let truncated: Bool

        var isSuccess: Bool { (200...299).contains(status) }

        /// The body of a response that is not 2xx, for a rejection message
        var errorText: String {
            guard let body = body else { return "Unknown error" }
            // Lossy decoding: the cut can fall inside a UTF-8 sequence
            let text = String(decoding: body, as: UTF8.self)
            return truncated ? text + "... (truncated)" : text
        }
    }

    /// Sends a GET and returns the response. A 2xx response with a body
    /// over `maxResponseBytes`, or with a content or transfer coding this
    /// would have to decode, throws. With `followRedirects` off a 3xx is
    /// returned like any other status.
    static func get(_ url: URL, followRedirects: Bool,
                    timeout: TimeInterval = defaultTimeout) async throws -> Response {
        var url = url
        for _ in 0...maxRedirects {
            let exchange = try CashuMintHTTPExchange(url: url, timeout: timeout)
            let (response, location) = try await exchange.run()
            guard followRedirects,
                  [301, 302, 303, 307, 308].contains(response.status),
                  let location = location,
                  let next = URL(string: location, relativeTo: url)
            else {
                return response
            }
            url = next.absoluteURL
        }
        throw CashuMintHTTPError.tooManyRedirects
    }
}

/// One GET on one connection, which is closed when `run` returns.
///
/// `pending`, `consumed` and `ended` are only touched by `run`, which is
/// called once. `expired` is only touched on `queue`, where the deadline
/// and every connection callback run.
private final class CashuMintHTTPExchange: @unchecked Sendable {
    private static let crlf = Data("\r\n".utf8)

    private let connection: NWConnection
    private let request: Data
    private let timeout: TimeInterval
    private let queue = DispatchQueue(label: "app.zeusln.cashudevkit.mint-http")
    private var expired = false
    /// Bytes received from the mint. The first `consumed` have been parsed.
    private var pending = Data()
    private var consumed = 0
    /// The mint has closed its side of the connection
    private var ended = false

    init(url: URL, timeout: TimeInterval) throws {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: true),
              let scheme = components.scheme?.lowercased(),
              scheme == "https" || scheme == "http",
              let host = url.host?.trimmingCharacters(in: CharacterSet(charactersIn: "[]")),
              !host.isEmpty,
              // url.host is percent-decoded and goes into the Host field
              // as it is: "ex%0d%0aample.com" would add a line to the request
              host.rangeOfCharacter(from: CharacterSet.controlCharacters.union(.whitespacesAndNewlines)) == nil,
              let portNumber = UInt16(exactly: components.port ?? (scheme == "https" ? 443 : 80)),
              portNumber != 0,
              let port = NWEndpoint.Port(rawValue: portNumber)
        else {
            throw CashuMintHTTPError.unsupportedURL
        }

        var target = components.percentEncodedPath.isEmpty ? "/" : components.percentEncodedPath
        if let query = components.percentEncodedQuery {
            target += "?" + query
        }
        // An IPv6 literal goes back in brackets. The port is only named
        // when the URL names it.
        var hostField = host.contains(":") ? "[\(host)]" : host
        if let explicitPort = components.port {
            hostField += ":\(explicitPort)"
        }
        let lines = [
            "GET \(target) HTTP/1.1",
            "Host: \(hostField)",
            "User-Agent: zeus",
            "Accept: application/json",
            "Accept-Encoding: identity",
            "Connection: close",
            "",
            ""
        ]
        request = Data(lines.joined(separator: "\r\n").utf8)

        // Default TLS options: the system verifies the certificate chain
        // and the host name
        let parameters = NWParameters(
            tls: scheme == "https" ? NWProtocolTLS.Options() : nil,
            tcp: NWProtocolTCP.Options())
        connection = NWConnection(host: NWEndpoint.Host(host), port: port, using: parameters)
        self.timeout = timeout
    }

    func run() async throws -> (CashuMintHTTP.Response, location: String?) {
        let deadline = DispatchWorkItem { [weak self] in
            self?.expired = true
            self?.connection.cancel()
        }
        queue.asyncAfter(deadline: .now() + timeout, execute: deadline)
        defer {
            deadline.cancel()
            connection.cancel()
        }

        try await open()
        try await send(request)
        let head = try await readHead()
        let location = head.value("location")
        let success = (200...299).contains(head.status)
        do {
            let (body, more) = try await readBody(
                head,
                limit: success ? CashuMintHTTP.maxResponseBytes : CashuMintHTTP.maxErrorBodyBytes)
            if success && more {
                throw CashuMintHTTPError.responseTooLarge
            }
            return (CashuMintHTTP.Response(status: head.status, body: body, truncated: more), location)
        } catch _ where !success {
            // The status is still worth reporting without the body
            return (CashuMintHTTP.Response(status: head.status, body: nil, truncated: false), location)
        }
    }

    // MARK: Connection

    /// The error to report for a failed connection. NWError describes
    /// itself as "The operation couldn't be completed. (Network.NWError
    /// error 61 - Connection refused)", and AddMint shows the message to
    /// the user, so only the reason is kept.
    private static func failure(_ error: NWError) -> CashuMintHTTPError {
        switch error {
        case .posix(let code):
            return .connectionFailed(reason: String(cString: strerror(code.rawValue)))
        case .dns:
            return .connectionFailed(reason: "host name lookup failed")
        case .tls:
            return .connectionFailed(reason: "secure connection failed")
        default:
            return .connectionFailed(reason: error.debugDescription)
        }
    }

    private func open() async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            connection.stateUpdateHandler = { [self] state in
                let result: Result<Void, Error>
                switch state {
                case .ready:
                    result = .success(())
                // A refused connection or a missing route is reported as
                // waiting. Fail instead of waiting for the network to change.
                case .failed(let error), .waiting(let error):
                    result = .failure(Self.failure(error))
                // Only the deadline cancels a connection that is not ready
                case .cancelled:
                    result = .failure(CashuMintHTTPError.timedOut)
                default:
                    return
                }
                // From here on, failures arrive through send and receive
                connection.stateUpdateHandler = nil
                continuation.resume(with: result)
            }
            connection.start(queue: queue)
        }
    }

    private func send(_ data: Data) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            connection.send(content: data, completion: .contentProcessed { error in
                if let error = error {
                    continuation.resume(throwing: Self.failure(error))
                } else {
                    continuation.resume()
                }
            })
        }
    }

    /// Receives up to `readSize` more bytes into `pending`. Returns false
    /// once the mint has closed the connection.
    private func fill() async throws -> Bool {
        // A receive after the one that reported the end fails with ENODATA
        if ended {
            return false
        }
        let (received, isComplete): (Data?, Bool) = try await withCheckedThrowingContinuation { continuation in
            connection.receive(minimumIncompleteLength: 1,
                               maximumLength: CashuMintHTTP.readSize) { [self] data, _, isComplete, error in
                // A receive that the deadline cancelled completes with no
                // data and no error, which would read as the end of the body
                if expired {
                    continuation.resume(throwing: CashuMintHTTPError.timedOut)
                } else if let data = data {
                    continuation.resume(returning: (data, isComplete))
                } else if let error = error {
                    continuation.resume(throwing: Self.failure(error))
                } else {
                    continuation.resume(returning: (nil, true))
                }
            }
        }
        ended = isComplete
        guard let received = received else { return false }
        pending.removeSubrange(0..<consumed)
        consumed = 0
        pending.append(received)
        return true
    }

    // MARK: Reading

    /// Consumes the response through the next `delimiter` and returns the
    /// bytes before it. Throws if the delimiter does not end within the
    /// next `limit` bytes.
    private func take(through delimiter: Data, limit: Int) async throws -> Data {
        while true {
            let window = consumed..<min(pending.count, consumed + limit)
            if let found = pending.range(of: delimiter, in: window) {
                let taken = pending.subdata(in: consumed..<found.lowerBound)
                consumed = found.upperBound
                return taken
            }
            guard pending.count - consumed < limit, try await fill() else {
                throw CashuMintHTTPError.invalidResponse
            }
        }
    }

    /// Consumes and returns up to `count` bytes, or nil once the mint has
    /// closed the connection
    private func take(upTo count: Int) async throws -> Data? {
        if pending.count == consumed {
            guard try await fill() else { return nil }
        }
        let end = min(pending.count, consumed + count)
        let taken = pending.subdata(in: consumed..<end)
        consumed = end
        return taken
    }

    /// The status line and header fields of a response
    private struct Head {
        let status: Int
        /// Field values by lowercased name. A repeated field keeps every
        /// value, joined with ", ", so a repeated Content-Length does not
        /// parse as a number and is rejected.
        private var fields: [String: String] = [:]

        init?(_ block: Data) {
            var lines = String(decoding: block, as: UTF8.self).components(separatedBy: "\r\n")
            // "HTTP/1.1 200 OK": the reason phrase is optional
            let statusLine = lines.removeFirst().split(separator: " ", maxSplits: 2,
                                                       omittingEmptySubsequences: false)
            guard statusLine.count >= 2,
                  statusLine[0] == "HTTP/1.1" || statusLine[0] == "HTTP/1.0",
                  statusLine[1].count == 3,
                  let status = Int(statusLine[1]),
                  (100...599).contains(status)
            else {
                return nil
            }
            self.status = status
            for line in lines {
                guard let colon = line.firstIndex(of: ":") else { return nil }
                let name = line[..<colon].lowercased()
                let value = line[line.index(after: colon)...].trimmingCharacters(in: .whitespaces)
                fields[name] = fields[name].map { "\($0), \(value)" } ?? value
            }
        }

        func value(_ lowercasedName: String) -> String? {
            return fields[lowercasedName]
        }
    }

    private func readHead() async throws -> Head {
        let block = try await take(through: Data("\r\n\r\n".utf8), limit: CashuMintHTTP.maxHeaderBytes)
        guard let head = Head(block) else {
            throw CashuMintHTTPError.invalidResponse
        }
        return head
    }

    /// Reads at most `limit` bytes of the body. `more` is true when the
    /// body is longer than that, in which case the rest is not read.
    private func readBody(_ head: Head, limit: Int) async throws -> (Data, more: Bool) {
        if let coding = head.value("content-encoding"), coding.lowercased() != "identity" {
            throw CashuMintHTTPError.compressedResponse
        }
        if let coding = head.value("transfer-encoding") {
            guard coding.lowercased() == "chunked" else {
                throw CashuMintHTTPError.compressedResponse
            }
            return try await readChunkedBody(limit: limit)
        }
        if let field = head.value("content-length") {
            guard let length = Int(field), length >= 0 else {
                throw CashuMintHTTPError.invalidResponse
            }
            return (try await readBytes(min(length, limit)), length > limit)
        }

        // Neither header: the body ends when the mint closes the connection
        var body = Data()
        while body.count <= limit {
            guard let piece = try await take(upTo: limit + 1 - body.count) else {
                return (body, false)
            }
            body.append(piece)
        }
        return (body.subdata(in: 0..<limit), true)
    }

    /// Reads exactly `count` bytes. Throws if the mint closes first.
    private func readBytes(_ count: Int) async throws -> Data {
        var bytes = Data()
        while bytes.count < count {
            guard let piece = try await take(upTo: count - bytes.count) else {
                throw CashuMintHTTPError.invalidResponse
            }
            bytes.append(piece)
        }
        return bytes
    }

    private func readChunkedBody(limit: Int) async throws -> (Data, more: Bool) {
        var body = Data()
        while true {
            let line = String(
                decoding: try await take(through: Self.crlf, limit: CashuMintHTTP.maxChunkLineBytes),
                as: UTF8.self)
            // The size can be followed by ";" and chunk extensions
            let digits = line.prefix { $0 != ";" }.trimmingCharacters(in: .whitespaces)
            guard let size = UInt(digits, radix: 16) else {
                throw CashuMintHTTPError.invalidResponse
            }
            if size == 0 {
                // Trailer fields are not read: the connection is closed next
                return (body, false)
            }
            let room = limit - body.count
            guard size <= UInt(room) else {
                body.append(try await readBytes(room))
                return (body, true)
            }
            body.append(try await readBytes(Int(size)))
            // The chunk data is followed by CRLF and nothing else
            _ = try await take(through: Self.crlf, limit: Self.crlf.count)
        }
    }
}

/// Host filter for mint URLs that come from a server, used by
/// checkExternalMintQuote before it contacts the mint
enum CashuMintHost {
    /// Reject loopback, private (RFC1918), link-local and other internal hosts
    /// for server-supplied mint URLs. Matches on the literal host only (no DNS
    /// resolution) to avoid a rebinding/latency side channel; this is
    /// defense-in-depth on top of the JS-side configured-mint binding.
    static func isDisallowed(_ host: String) -> Bool {
        var h = host.trimmingCharacters(in: CharacterSet(charactersIn: "[]"))
            .lowercased()
        // A single trailing dot is the fully qualified spelling of the same
        // host (localhost., 127.0.0.1.), so drop it before matching
        if h.hasSuffix(".") { h.removeLast() }
        if h.isEmpty { return true }
        if h == "localhost" || h.hasSuffix(".localhost") { return true }
        // A host containing ":" can only be an IPv6 literal (hostnames
        // cannot contain it), so parse it numerically instead of
        // prefix-matching one spelling: mapped (::ffff:127.0.0.1),
        // hex-mapped (::ffff:7f00:1) and zero-expanded (0:0:0:0:0:0:0:1)
        // forms of the same internal address all normalize to the same
        // bytes. inet_pton involves no DNS.
        if h.contains(":") { return isDisallowedIPv6Literal(h) }
        return isDisallowedIPv4(h)
    }

    // Internal / non-routable IPv4 ranges as (network, prefix length):
    // 0/8 this network, 10/8 private, 100.64/10 shared CGNAT,
    // 127/8 loopback, 169.254/16 link-local, 172.16/12 private,
    // 192.0.0/24 IETF protocol assignments, 192.168/16 private,
    // 198.18/15 benchmarking, 224/4 multicast, 240/4 reserved
    private static let disallowedIPv4Ranges: [(UInt32, UInt32)] = [
        (0x0000_0000, 8),
        (0x0a00_0000, 8),
        (0x6440_0000, 10),
        (0x7f00_0000, 8),
        (0xa9fe_0000, 16),
        (0xac10_0000, 12),
        (0xc000_0000, 24),
        (0xc0a8_0000, 16),
        (0xc612_0000, 15),
        (0xe000_0000, 4),
        (0xf000_0000, 4)
    ]

    // Parse the host with inet_aton, the same parser the OS resolver
    // applies, so decimal (2130706433), hex (0x7f.1), octal (0177.0.0.1)
    // and shortened (127.1) spellings of an internal address are caught as
    // well as the dotted-quad one. A host that does not parse is a hostname
    // and is not an internal literal.
    private static func isDisallowedIPv4(_ h: String) -> Bool {
        var addr = in_addr()
        guard inet_aton(h, &addr) == 1 else { return false }
        return isDisallowedIPv4(UInt32(bigEndian: addr.s_addr))
    }

    private static func isDisallowedIPv4(_ addr: UInt32) -> Bool {
        return disallowedIPv4Ranges.contains { network, prefix in
            let mask: UInt32 = prefix == 0 ? 0 : ~UInt32(0) << (32 - prefix)
            return addr & mask == network
        }
    }

    private static func isDisallowedIPv6Literal(_ literal: String) -> Bool {
        var addr = in6_addr()
        guard inet_pton(AF_INET6, literal, &addr) == 1 else {
            // Not parseable as an IPv6 literal and not a valid hostname
            // either: fail closed
            return true
        }
        let bytes = withUnsafeBytes(of: addr) { Array($0) }
        // IPv4-mapped (::ffff:a.b.c.d in any spelling): hold the embedded
        // address to the same rules as a dotted host
        if bytes[0...9].allSatisfy({ $0 == 0 }) && bytes[10] == 0xff &&
            bytes[11] == 0xff {
            let v4 = UInt32(bytes[12]) << 24 | UInt32(bytes[13]) << 16 |
                UInt32(bytes[14]) << 8 | UInt32(bytes[15])
            return isDisallowedIPv4(v4)
        }
        // ::1 loopback and :: unspecified
        if bytes[0...14].allSatisfy({ $0 == 0 }) &&
            (bytes[15] == 0 || bytes[15] == 1) {
            return true
        }
        // fe80::/10 link-local, fec0::/10 site-local (deprecated)
        if bytes[0] == 0xfe && (bytes[1] & 0x80) == 0x80 { return true }
        // fc00::/7 unique-local
        return (bytes[0] & 0xfe) == 0xfc
    }
}
