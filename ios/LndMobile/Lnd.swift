import Foundation
import Lndmobile
import SwiftProtobuf

public struct LndError: Error {
  let msg: String
}

extension LndError: LocalizedError {
  public var errorDescription: String? {
    return NSLocalizedString(msg, comment: "")
  }
}

enum LndStatusCodes: NSNumber {
  case STATUS_SERVICE_BOUND = 1
  case STATUS_PROCESS_STARTED = 2
  case STATUS_WALLET_UNLOCKED = 4
}

// Used for anyone who wants to use this class
typealias Callback = (Data?, Error?) -> Void
typealias StreamCallback = (Data?, Error?) -> Void

// Used internally in this class to deal with Lndmobile/Go
class LndmobileCallback: NSObject, LndmobileCallbackProtocol {
  var method: String
  var callback: Callback

  init(method: String, callback: @escaping Callback) {
    self.method = method
    self.callback = callback
  }

  func onResponse(_ p0: Data?) {
    self.callback(p0, nil)
  }

  func onError(_ p0: Error?) {
    NSLog("Inside onError " + self.method)
    NSLog(p0?.localizedDescription ?? "unknown error")
    self.callback(nil, p0)
  }
}

class LndmobileReceiveStream: NSObject, LndmobileRecvStreamProtocol {
  var method: String
  var callback: StreamCallback

  init(method: String, callback: @escaping StreamCallback) {
    self.method = method
    self.callback = callback
  }

  func onResponse(_ p0: Data?) {
    self.callback(p0, nil)
  }

  func onError(_ p0: Error?) {
    NSLog("LndmobileReceiveStream onError " + self.method)
    NSLog(p0?.localizedDescription ?? "unknown error")
    self.callback(nil, p0)
  }
}

open class Lnd {
  static let shared = Lnd()

  var lndStarted = false
  var activeStreams: [String] = []

  static let syncMethods: [String: (Data?, (any LndmobileCallbackProtocol)?) -> Void] = [
    // index
    //
    "AddInvoice": { bytes, cb in LndmobileAddInvoice(bytes, cb) },
    "InvoicesCancelInvoice": { bytes, cb in LndmobileInvoicesCancelInvoice(bytes, cb) },
    "ConnectPeer": { bytes, cb in LndmobileConnectPeer(bytes, cb) },
    "SendCustomMessage": { bytes, cb in LndmobileSendCustomMessage(bytes, cb) },
    "DecodePayReq": { bytes, cb in LndmobileDecodePayReq(bytes, cb) },
    "DescribeGraph": { bytes, cb in LndmobileDescribeGraph(bytes, cb) },
    "GetInfo": { bytes, cb in LndmobileGetInfo(bytes, cb) },
    "GetNodeInfo": { bytes, cb in LndmobileGetNodeInfo(bytes, cb) },
    "LookupInvoice": { bytes, cb in LndmobileLookupInvoice(bytes, cb) },
    "ListPeers": { bytes, cb in LndmobileListPeers(bytes, cb) },
    "DisconnectPeer": { bytes, cb in LndmobileDisconnectPeer (bytes, cb) },
    "SendPaymentSync": { bytes, cb in LndmobileSendPaymentSync(bytes, cb) },
    "GetRecoveryInfo": { bytes, cb in LndmobileGetRecoveryInfo(bytes, cb) },
    "RouterResetMissionControl": { bytes, cb in LndmobileRouterResetMissionControl(bytes, cb) },
    "QueryRoutes": { bytes, cb in LndmobileQueryRoutes(bytes, cb) },
    "ListPayments": { bytes, cb in LndmobileListPayments(bytes, cb) },
    "ListInvoices": { bytes, cb in LndmobileListInvoices(bytes, cb) },
    "FundingStateStep": { bytes, cb in LndmobileFundingStateStep(bytes, cb) },

    // channel
    //
    "ChannelBalance": { bytes, cb in LndmobileChannelBalance(bytes, cb) },
    "ListChannels": { bytes, cb in LndmobileListChannels(bytes, cb) },
    "OpenChannelSync": { bytes, cb in LndmobileOpenChannelSync(bytes, cb) },
    "PendingChannels": { bytes, cb in LndmobilePendingChannels(bytes, cb) },
    "ClosedChannels": { bytes, cb in LndmobileClosedChannels(bytes, cb) },
    "ExportAllChannelBackups": { bytes, cb in LndmobileExportAllChannelBackups(bytes, cb) },
    "RestoreChannelBackups": { bytes, cb in LndmobileRestoreChannelBackups(bytes, cb) },
    "VerifyChanBackup": { bytes, cb in LndmobileVerifyChanBackup(bytes, cb) },
    "GetChanInfo": { bytes, cb in LndmobileGetChanInfo(bytes, cb) },
    "AbandonChannel": { bytes, cb in LndmobileAbandonChannel(bytes, cb) },
    "GetNetworkInfo": { bytes, cb in LndmobileGetNetworkInfo(bytes, cb) },

    // onchain
    //
    "GetTransactions": { bytes, cb in LndmobileGetTransactions(bytes, cb) },
    "NewAddress": { bytes, cb in LndmobileNewAddress(bytes, cb) },
    "SendCoins": { bytes, cb in LndmobileSendCoins(bytes, cb) },
    "WalletBalance": { bytes, cb in LndmobileWalletBalance(bytes, cb) },

    // init wallet
    "GenSeed": { bytes, cb in LndmobileGenSeed(bytes, cb) },
    "InitWallet": { bytes, cb in LndmobileInitWallet(bytes, cb) },
    "UnlockWallet": { bytes, cb in LndmobileUnlockWallet(bytes, cb) },

    // wallet
    "WalletKitFundPsbt": { bytes, cb in LndmobileWalletKitFundPsbt(bytes, cb) },
    "WalletKitSignPsbt": { bytes, cb in LndmobileWalletKitSignPsbt(bytes, cb) },
    "WalletKitFinalizePsbt": { bytes, cb in LndmobileWalletKitFinalizePsbt(bytes, cb) },
    "WalletKitPublishTransaction": { bytes, cb in LndmobileWalletKitPublishTransaction(bytes, cb) },
    "WalletKitListAddresses": { bytes, cb in LndmobileWalletKitListAddresses(bytes, cb) },
    "WalletKitListAccounts": { bytes, cb in LndmobileWalletKitListAccounts(bytes, cb) },
    "WalletKitImportAccount": { bytes, cb in LndmobileWalletKitImportAccount(bytes, cb) },
    "WalletKitBumpFee": { bytes, cb in LndmobileWalletKitBumpFee(bytes, cb) },
    "WalletKitListUnspent": { bytes, cb in LndmobileWalletKitListUnspent(bytes, cb) },
    "WalletKitDeriveKey": { bytes, cb in LndmobileWalletKitDeriveKey(bytes, cb) },
    "WalletKitRescan": { bytes, cb in LndmobileWalletKitRescan(bytes, cb) },
    "WalletKitNextAddr": { bytes, cb in LndmobileWalletKitNextAddr(bytes, cb) },
  
    // derivePrivateKey
    "VerifyMessage": { bytes, cb in LndmobileVerifyMessage(bytes, cb) },
    "SignMessage": { bytes, cb in LndmobileSignMessage(bytes, cb) },
    "SignerSignMessage": { bytes, cb in LndmobileSignerSignMessage(bytes, cb) },

    // autopilot
    "AutopilotStatus": { bytes, cb in LndmobileAutopilotStatus(bytes, cb) },
    "AutopilotModifyStatus": { bytes, cb in LndmobileAutopilotModifyStatus(bytes, cb) },
    "AutopilotQueryScores": { bytes, cb in LndmobileAutopilotQueryScores(bytes, cb) },
    "AutopilotSetScores": { bytes, cb in LndmobileAutopilotSetScores(bytes, cb) },
  ]

  static let streamMethods: [String: (Data?, (any LndmobileRecvStreamProtocol)?) -> Void] = [
    // index
    //
    "RouterSendPaymentV2": { req, cb in return LndmobileRouterSendPaymentV2(req, cb) },
    "SubscribeState": { req, cb in return LndmobileSubscribeState(req, cb) },
    "RouterTrackPaymentV2": { req, cb in return LndmobileRouterTrackPaymentV2(req, cb) },
    "OpenChannel": { bytes, cb in LndmobileOpenChannel(bytes, cb) },
    "SubscribeCustomMessages": { bytes, cb in LndmobileSubscribeCustomMessages(bytes, cb) },

    // channel
    //
    "CloseChannel": { req, cb in return LndmobileCloseChannel(req, cb)},
    "SubscribeChannelEvents": { req, cb in return LndmobileSubscribeChannelEvents(req, cb)},
    "SubscribeChannelGraph": { req, cb in return LndmobileSubscribeChannelGraph(req, cb)},
    // onchain
    //
    "SubscribeTransactions": { req, cb in return LndmobileSubscribeTransactions(req, cb) },
    "SubscribeInvoices": { req, cb in return LndmobileSubscribeInvoices(req, cb) },
  ]

  static let biStreamMethods: [String: ((any LndmobileRecvStreamProtocol)?) -> (any LndmobileSendStreamProtocol)?] = [
    "ChannelAcceptor": {cb in return LndmobileChannelAcceptor(cb, nil) }
  ]

  var writeStreams: [String: LndmobileSendStream] = [:]

  func checkStatus() -> Int32 {
    // Service is always bound on iOS
    var flags = LndStatusCodes.STATUS_SERVICE_BOUND.rawValue.int32Value

    if (self.lndStarted) {
      flags += LndStatusCodes.STATUS_PROCESS_STARTED.rawValue.int32Value
    }

    return flags
  }

  func startLnd(_ args: String, isTorEnabled: Bool, isTestnet: Bool, lndStartedCallback: @escaping Callback) -> Void {
    let applicationSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
    let lndPath = applicationSupport.appendingPathComponent("lnd", isDirectory: true)

    var lndArgs = "--nolisten --lnddir=\"\(lndPath.path)\" " + args
    if (isTorEnabled) {
      lndArgs += " --tor.active"
    }

    let started: Callback = {(data: Data?, error: Error?) in {
      self.lndStarted = true
      lndStartedCallback(data, error)
    }()}

    LndmobileStart(
      lndArgs,
      LndmobileCallback(method: "start", callback: started)
    )
  }

  func stopLnd(_ callback: @escaping Callback) {
    do {
      let stopRequest = Lnrpc_StopRequest()
      let payload = try stopRequest.serializedData()
      LndmobileStopDaemon(payload, LndmobileCallback(method: "stopLnd", callback: callback))
    } catch let error {
      callback(nil, error)
    }
  }

  func initWallet(_ seed: [String], password: String, recoveryWindow: Int32, channelsBackupsBase64: String, callback: @escaping Callback) {
    do {
      var initWalletRequest = Lnrpc_InitWalletRequest()
      initWalletRequest.cipherSeedMnemonic = seed
      initWalletRequest.walletPassword = password.data(using: .utf8).unsafelyUnwrapped
      if (recoveryWindow != 0) {
        initWalletRequest.recoveryWindow = recoveryWindow
      }

      if (channelsBackupsBase64 != "") {
        NSLog("--CHANNEL BACKUP RESTORE--")
        var chanBackupSnapshot = Lnrpc_ChanBackupSnapshot()
        var multiChanBackup = Lnrpc_MultiChanBackup()

        multiChanBackup.multiChanBackup = Data(base64Encoded: channelsBackupsBase64, options: [])!
        chanBackupSnapshot.multiChanBackup = multiChanBackup

        initWalletRequest.channelBackups = chanBackupSnapshot
      }
      let payload = try initWalletRequest.serializedData()
      LndmobileInitWallet(payload, LndmobileCallback(method: "InitWallet", callback: callback))
    } catch let error {
      callback(nil, error)
    }
  }

  func unlockWallet(_ password: String, callback: @escaping Callback) {
    do {
      var unlockWalletRequest = Lnrpc_UnlockWalletRequest();
      unlockWalletRequest.walletPassword = password.data(using: .utf8).unsafelyUnwrapped
      let payload = try unlockWalletRequest.serializedData()
      LndmobileUnlockWallet(payload, LndmobileCallback(method: "UnlockWallet", callback: callback))
    } catch let error {
      callback(nil, error)
    }
  }

  func sendCommand(_ method: String, payload: String, callback: @escaping Callback) {
    let block = Lnd.syncMethods[method]

    if block == nil {
      NSLog("method not found" + method)
      callback(nil, LndError(msg: "Lnd method not found: " + method))
      return
    }

    let bytes = Data(base64Encoded: payload, options: [])
    block?(bytes, LndmobileCallback(method: method, callback: callback))
  }

  func sendStreamCommand(_ method: String, payload: String, streamOnlyOnce: Bool, callback: @escaping StreamCallback) {
    if (streamOnlyOnce) {
      if (self.activeStreams.contains(method)) {
        NSLog("Attempting to stream " + method + " twice, not allowing")
        return
      } else {
        self.activeStreams.append(method)
      }
    }
    let block = Lnd.streamMethods[method]
    if block == nil {
      NSLog("method not found" + method)
      callback(nil, LndError(msg: "Lnd method not found: " + method))
      return
    }

    let bytes = Data(base64Encoded: payload, options: [])
    block?(bytes, LndmobileReceiveStream(method: method, callback: callback))
  }

  func sendBidiStreamCommand(_ method: String, streamOnlyOnce: Bool, callback: @escaping StreamCallback) {
    if (streamOnlyOnce) {
      if (self.activeStreams.contains(method)) {
        NSLog("Attempting to stream " + method + " twice, not allowing")
        return
      } else {
        self.activeStreams.append(method)
      }
    }
    let block = Lnd.biStreamMethods[method]
    if block == nil {
      NSLog("method not found" + method)
      callback(nil, LndError(msg: "Lnd method not found: " + method))
      return
    }

    let writeStream = block?(LndmobileReceiveStream(method: method, callback: callback))
    writeStreams.updateValue(writeStream as! LndmobileSendStream, forKey: method)
  }

  func writeToStream(_ method: String, payload: String, callback: @escaping StreamCallback) {
    let write = Lnd.shared.writeStreams[method]
    if write == nil {
      NSLog("method not found" + method)
      callback(nil, LndError(msg: "Lnd method not found: " + method))
      return
    }
    do {
      let bytes = Data(base64Encoded: payload, options: [])
      try write?.send(bytes) // TODO(hsjoberg): Figure out whether send returns a BOOL?
      callback(nil, nil)
    } catch let error {
      callback(nil, error)
    }
  }

  func gossipSync(_ serviceUrl: String, cacheDir: String, dataDir: String, callback: @escaping Callback) {
    LndmobileGossipSync(serviceUrl, cacheDir, dataDir, "", LndmobileCallback(method: "zeus_gossipSync", callback: callback))
  }
  
  func cancelGossipSync(_ callback: @escaping Callback) {
    do {
      let stopRequest = Lnrpc_StopRequest()
      let payload = try stopRequest.serializedData()
      LndmobileCancelGossipSync()
    } catch let error {
      callback(nil, error)
    }
  }
}
