import Foundation
import Lndmobile

// https://stackoverflow.com/a/32306142
extension StringProtocol {
  func index<S: StringProtocol>(of string: S, options: String.CompareOptions = []) -> Index? {
    range(of: string, options: options)?.lowerBound
  }
  func endIndex<S: StringProtocol>(of string: S, options: String.CompareOptions = []) -> Index? {
    range(of: string, options: options)?.upperBound
  }
  func indices<S: StringProtocol>(of string: S, options: String.CompareOptions = []) -> [Index] {
    ranges(of: string, options: options).map(\.lowerBound)
  }
  func ranges<S: StringProtocol>(of string: S, options: String.CompareOptions = []) -> [Range<Index>] {
    var result: [Range<Index>] = []
    var startIndex = self.startIndex
    while startIndex < endIndex,
        let range = self[startIndex...]
          .range(of: string, options: options) {
          result.append(range)
          startIndex = range.lowerBound < range.upperBound ? range.upperBound :
            index(range.lowerBound, offsetBy: 1, limitedBy: endIndex) ?? endIndex
    }
    return result
  }
}

@objc(LndMobile)
class LndMobile: RCTEventEmitter {
  @objc
  override static func moduleName() -> String! {
    "LndMobile"
  }

  override func supportedEvents() -> [String]! {
//    return Lnd.streamMethods.map{ $0.key }
    let mergedKeys = Array(Lnd.streamMethods.keys) + Array(Lnd.biStreamMethods.keys)
    return mergedKeys
  }

  @objc
  override static func requiresMainQueueSetup() -> Bool {
    return false
  }

  @objc(initialize:rejecter:)
  func initialize(resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    // If regtest, we need to ask for LAN access permission
    // before lnd requests it, otherwise it won't have time and crash
    // https://developer.apple.com/forums/thread/663768

    // TODO handle chain param here
    // let chain = Bundle.main.object(forInfoDictionaryKey: "CHAIN") as? String
    // if (chain == "regtest") {
    //   NSLog("Triggering LAN access permission dialog")
    //   triggerLocalNetworkPrivacyAlert()
    // }
    resolve([
      "data": ""
    ])
  }

  func triggerLocalNetworkPrivacyAlert() {
    let sock4 = socket(AF_INET, SOCK_DGRAM, 0)
    guard sock4 >= 0 else { return }
    defer { close(sock4) }
    let sock6 = socket(AF_INET6, SOCK_DGRAM, 0)
    guard sock6 >= 0 else { return }
    defer { close(sock6) }

    let addresses = addressesOfDiscardServiceOnBroadcastCapableInterfaces()
    var message = [UInt8]("!".utf8)
    for address in addresses {
      address.withUnsafeBytes { buf in
        let sa = buf.baseAddress!.assumingMemoryBound(to: sockaddr.self)
        let saLen = socklen_t(buf.count)
        let sock = sa.pointee.sa_family == AF_INET ? sock4 : sock6
        _ = sendto(sock, &message, message.count, MSG_DONTWAIT, sa, saLen)
      }
    }
  }

  /// Returns the addresses of the discard service (port 9) on every
  /// broadcast-capable interface.
  ///
  /// Each array entry is contains either a `sockaddr_in` or `sockaddr_in6`.
  private func addressesOfDiscardServiceOnBroadcastCapableInterfaces() -> [Data] {
    var addrList: UnsafeMutablePointer<ifaddrs>? = nil
    let err = getifaddrs(&addrList)
    guard err == 0, let start = addrList else { return [] }
    defer { freeifaddrs(start) }
    return sequence(first: start, next: { $0.pointee.ifa_next })
      .compactMap { i -> Data? in
        guard
            (i.pointee.ifa_flags & UInt32(bitPattern: IFF_BROADCAST)) != 0,
            let sa = i.pointee.ifa_addr
        else { return nil }
        var result = Data(UnsafeRawBufferPointer(start: sa, count: Int(sa.pointee.sa_len)))
        switch CInt(sa.pointee.sa_family) {
        case AF_INET:
            result.withUnsafeMutableBytes { buf in
                let sin = buf.baseAddress!.assumingMemoryBound(to: sockaddr_in.self)
                sin.pointee.sin_port = UInt16(9).bigEndian
            }
        case AF_INET6:
            result.withUnsafeMutableBytes { buf in
                let sin6 = buf.baseAddress!.assumingMemoryBound(to: sockaddr_in6.self)
                sin6.pointee.sin6_port = UInt16(9).bigEndian
            }
        default:
            return nil
        }
        return result
      }
  }

  @objc(checkStatus:rejecter:)
  func checkStatus(resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    resolve(Lnd.shared.checkStatus())
  }

  @objc(startLnd:isTorEnabled:isTestnet:resolver:rejecter:)
  func startLnd(_ args: String, isTorEnabled: Bool, isTestnet: Bool, resolve: @escaping RCTPromiseResolveBlock, rejecter reject:@escaping RCTPromiseRejectBlock) {
    Lnd.shared.startLnd(args, isTorEnabled: isTorEnabled, isTestnet: isTestnet) { (data, error) in
      if let e = error {
        reject("error", e.localizedDescription, e)
        return
      }
      resolve([
        "data": data?.base64EncodedString()
      ])
    }
  }

  @objc(stopLnd:rejecter:)
  func stopLnd(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject:@escaping RCTPromiseRejectBlock) {
    Lnd.shared.stopLnd() { (data, error) in
      if let e = error {
        reject("error", e.localizedDescription, e)
        return
      }
      resolve([
        "data": data?.base64EncodedString()
      ])
    }
  }

  @objc(initWallet:password:recoveryWindow:channelsBackupBase64:resolver:rejecter:)
  func initWallet(_ seed: [AnyHashable], password: String, recoveryWindow: Int, channelsBackupBase64: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    Lnd.shared.initWallet(
      seed as! [String],
      password: password,
      recoveryWindow: Int32(recoveryWindow),
      channelsBackupsBase64: channelsBackupBase64
    ) { (data, error) in
      if let e = error {
        reject("error", e.localizedDescription, e)
        return
      }
      resolve([
        "data": data?.base64EncodedString()
      ])
    }
  }

  @objc(unlockWallet:resolver:rejecter:)
  func unlockWallet(_ password: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    Lnd.shared.unlockWallet(password) { (data, error) in
      if let e = error {
        reject("error", e.localizedDescription, e)
        return
      }
      resolve([
        "data": data?.base64EncodedString()
      ])
    }
  }

  @objc(sendCommand:payload:resolver:rejecter:)
  func sendCommand(_ method: String, payload: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    Lnd.shared.sendCommand(
      method,
      payload: payload
    ) { (data, error) in
      if let e = error {
        reject("error", e.localizedDescription, e)
        return
      }
      resolve([
        "data": data?.base64EncodedString()
      ])
    }
  }

  @objc(sendStreamCommand:payload:streamOnlyOnce:resolver:rejecter:)
  func sendStreamCommand(_ method: String, payload: String, streamOnlyOnce: Bool, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    Lnd.shared.sendStreamCommand(
      method,
      payload: payload,
      streamOnlyOnce: streamOnlyOnce
    ) { (data, error) in
      if let e = error {
        NSLog("Stream error for " + method)
        NSLog(e.localizedDescription)

        let fullError = e.localizedDescription
        var errorCode = "Error"
        var errorDesc = fullError

        if let codeRange = fullError.range(of: "code = "), let descRange = fullError.range(of: " desc = ") {
          errorCode = String(fullError[codeRange.upperBound..<descRange.lowerBound])
          errorDesc = String(fullError[descRange.upperBound..<fullError.endIndex])
        }

        self.sendEvent(
          withName: method,
          body: ["error_code": errorCode, "error_desc": errorDesc]
        )
      } else {
        self.sendEvent(
          withName: method,
          body: ["data": data?.base64EncodedString()]
        )
      }
    }
    resolve("done")
  }

  @objc(sendBidiStreamCommand:streamOnlyOnce:resolver:rejecter:)
  func sendBidiStreamCommand(_ method: String, streamOnlyOnce: Bool, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    Lnd.shared.sendBidiStreamCommand(
      method,
      streamOnlyOnce: streamOnlyOnce
    ) { (data, error) in
      if let e = error {
        NSLog("Stream error for " + method)
        NSLog(e.localizedDescription)

        let fullError = e.localizedDescription
        var errorCode = "Error"
        var errorDesc = fullError

        if let codeRange = fullError.range(of: "code = "), let descRange = fullError.range(of: " desc = ") {
          errorCode = String(fullError[codeRange.upperBound..<descRange.lowerBound])
          errorDesc = String(fullError[descRange.upperBound..<fullError.endIndex])
        }

        self.sendEvent(
          withName: method,
          body: ["error_code": errorCode, "error_desc": errorDesc]
        )
      } else {
        self.sendEvent(
          withName: method,
          body: ["data": data?.base64EncodedString()]
        )
      }
    }
    resolve("done")
  }

  @objc(writeToStream:payload:resolver:rejecter:)
  func writeToStream(_ method: String, payload: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    Lnd.shared.writeToStream(
      method,
      payload: payload
    ) { (data, error) in
      if let e = error {
        NSLog("writeToStream error for " + method)
        NSLog(e.localizedDescription)
        reject("error", e.localizedDescription, e)
      } else {
        resolve(data)
      }
    }
  }

@objc(gossipSync:resolver:rejecter:)
  func gossipSync(serviceUrl: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
   let applicationSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
   let lndPath = applicationSupport.appendingPathComponent("lnd", isDirectory: true)
   let cachePath = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]

    Lnd.shared.gossipSync(serviceUrl, cacheDir: cachePath.path, dataDir: lndPath.path, callback: { (data, error) in
     if let e = error {
       reject("error", e.localizedDescription, e)
       return
     }
     resolve([
       "data": data
     ])
   })
 }

  @objc(cancelGossipSync:rejecter:)
  func cancelGossipSync(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject:@escaping RCTPromiseRejectBlock) {
    Lnd.shared.cancelGossipSync() { (data, error) in
      if let e = error {
        reject("error", e.localizedDescription, e)
        return
      }
      resolve([
        "data": data?.base64EncodedString()
      ])
    }
  }
}
