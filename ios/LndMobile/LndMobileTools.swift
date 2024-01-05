import Foundation

public struct LndMobileToolsError: Error {
  let msg: String
}

extension LndMobileToolsError: LocalizedError {
  public var errorDescription: String? {
    return NSLocalizedString(msg, comment: "")
  }
}

@objc(LndMobileTools)
class LndMobileTools: RCTEventEmitter {
  @objc
  override static func moduleName() -> String! {
    "LndMobileTools"
  }

  override func supportedEvents() -> [String]! {
    return ["lndlog"]
  }

  @objc
  override static func requiresMainQueueSetup() -> Bool {
    return false
  }

  @objc(writeConfig:resolver:rejecter:)
  func writeConfig(config: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    do {
      let paths = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)
      let url = paths[0].appendingPathComponent("lnd", isDirectory: true).appendingPathComponent("lnd.conf", isDirectory: false)
      NSLog(url.relativeString)

      try config.write(to: url, atomically: true, encoding: .utf8)
      let input = try String(contentsOf: url)
      NSLog("Read config: " + input)
      resolve("Config written")
    } catch let error {
      NSLog(error.localizedDescription)
      reject("error", error.localizedDescription, error)
    }
  }

  @objc(log:tag:msg:)
  func log(level: String, tag: String, msg: String) {
    NSLog("[" + tag + "] " + msg)
  }

  @objc(DEBUG_getWalletPasswordFromKeychain:rejecter:)
  func DEBUG_getWalletPasswordFromKeychain(resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    let server = "password"

    let query: CFDictionary = [
      kSecClass: kSecClassInternetPassword,
      kSecAttrServer: server,
      kSecReturnAttributes: kCFBooleanTrue!,
      kSecReturnData: kCFBooleanTrue!,
      kSecMatchLimit: kSecMatchLimitOne as String
    ] as [CFString: Any] as CFDictionary

    var result: AnyObject?
    let osStatus = SecItemCopyMatching(query, &result)
    if osStatus != noErr && osStatus != errSecItemNotFound {
      let error = NSError(domain: NSOSStatusErrorDomain, code: Int(osStatus), userInfo: nil)
      return reject("error", error.localizedDescription, error)
    } else if (result == nil) {
      return resolve(NSNumber(value: false))
    }

    if let passwordData = result![kSecValueData] as? Data {
      let password = String(data: passwordData, encoding: .utf8)
      return resolve(password)
    }
  }

  @objc(saveChannelsBackup:resolver:rejecter:)
  func saveChannelsBackup(base64Backups: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
#if os(macOS)
      do {
        let dataWrapped = Data(base64Encoded: base64Backups, options: [])
        if let data = dataWrapped {
          let savePanel = NSSavePanel()
          savePanel.nameFieldStringValue = "zeus-channel-backup.dat"
          if (savePanel.runModal() == NSApplication.ModalResponse.OK) {
            let saveUrl = savePanel.url
            NSLog(saveUrl?.path ?? "")
            NSLog(saveUrl?.absoluteString ?? "")
            NSLog(saveUrl?.relativeString ?? "")

            if let saveUrlUnwrapped = saveUrl {
              try data.write(to: saveUrlUnwrapped)
            }
            resolve(true)
          } else {
            resolve(false)
          }
        } else {
          NSLog("WARNING: Unable to unwrap backup data")
          resolve(false)
        }
      } catch {
        print("Error saving backup")
        reject("error", error.localizedDescription, error)
      }
#elseif os(iOS)
      let activityController = UIActivityViewController(activityItems: [base64Backups], applicationActivities: nil)
      activityController.popoverPresentationController?.sourceView = UIView() // so that iPads won't crash, https://stackoverflow.com/a/35931947
      RCTSharedApplication()?.delegate?.window??.rootViewController?.present(activityController, animated: true, completion: {
        resolve(true)
      })
#endif
    }
  }

  @objc(saveChannelBackupFile:resolver:rejecter:)
  func saveChannelBackupFile(network: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      let paths = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)
      let url = paths[0].appendingPathComponent("lnd", isDirectory: true)
        .appendingPathComponent("data", isDirectory: true)
        .appendingPathComponent("chain", isDirectory: true)
        .appendingPathComponent("bitcoin", isDirectory: true)
        .appendingPathComponent(network ?? "mainnet", isDirectory: true)
        .appendingPathComponent("channel.backup", isDirectory: false)
#if os(iOS)
      do {
        let data = try Data(contentsOf: url)
        let activityController = UIActivityViewController(activityItems: [data], applicationActivities: nil)
        RCTSharedApplication()?.delegate?.window??.rootViewController?.present(activityController, animated: true, completion: {
          resolve(true)
        })
      } catch {
        reject("error", error.localizedDescription, error)
      }
#else
      do {
        let data = try Data(contentsOf: url)
        let savePanel = NSSavePanel()
        savePanel.nameFieldStringValue = "zeus-channel-backup.dat"
        if (savePanel.runModal() == NSApplication.ModalResponse.OK) {
          let saveUrl = savePanel.url
          NSLog(saveUrl?.path ?? "")
          NSLog(saveUrl?.absoluteString ?? "")
          NSLog(saveUrl?.relativeString ?? "")

          if let saveUrlUnwrapped = saveUrl {
            try data.write(to: saveUrlUnwrapped)
          }
          resolve(true)
        } else {
          resolve(false)
        }
      } catch {
        print("Error saving backup")
        reject("error", error.localizedDescription, error)
      }
#endif
    }
  }

  @objc(checkICloudEnabled:rejecter:)
  func checkICloudEnabled(resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    let token = FileManager.default.ubiquityIdentityToken
    resolve(token != nil)
  }

  @objc(DEBUG_listFilesInDocuments:rejecter:)
  func DEBUG_listFilesInDocuments(resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    let fileManager = FileManager.default
    let documentsURL = fileManager.urls(for: .documentDirectory, in: .userDomainMask)[0]
    do {
      let fileURLs = try fileManager.contentsOfDirectory(at: documentsURL, includingPropertiesForKeys: nil)
      print(fileURLs)
      resolve(fileURLs.description)
    } catch {
      print("Error while enumerating files \(documentsURL.path): \(error.localizedDescription)")
      reject("error", error.localizedDescription, error)
    }
  }

  @objc(DEBUG_listFilesInApplicationSupport:rejecter:)
  func DEBUG_listFilesInApplicationSupport(resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    let fileManager = FileManager.default
    let applicationSupportUrl = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
    let lndUrl = applicationSupportUrl.appendingPathComponent("lnd")
    do {
      let fileURLs = try fileManager.contentsOfDirectory(at: lndUrl, includingPropertiesForKeys: nil)
      // process files
      print(fileURLs)
      resolve(fileURLs.description)
    } catch {
      print("Error while enumerating files \(lndUrl.path): \(error.localizedDescription)")
      reject("error", error.localizedDescription, error)
    }
  }

  @objc(DEBUG_deleteSpeedloaderLastrunFile:rejecter:)
  func DEBUG_deleteSpeedloaderLastrunFile(resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    let cachePath = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
    let lastrunPath = cachePath.appendingPathComponent("lastrun")

    do {
      try FileManager.default.removeItem(at: lastrunPath)
    } catch {
      reject("error", error.localizedDescription, error)
      return
    }

    resolve(true)
  }

  @objc(DEBUG_deleteSpeedloaderDgraphDirectory:rejecter:)
  func DEBUG_deleteSpeedloaderDgraphDirectory(resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    let cachePath = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
    let dgraphPath = cachePath.appendingPathComponent("dgraph", isDirectory: true)

    do {
      try FileManager.default.removeItem(at: dgraphPath)
    } catch {
      reject("error", error.localizedDescription, error)
      return
    }

    resolve(nil)
  }

  @objc(DEBUG_deleteNeutrinoFiles:resolver:rejecter:)
  func DEBUG_deleteNeutrinoFiles(network: String, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    let applicationSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
    let chainPath = applicationSupport.appendingPathComponent("lnd", isDirectory: true)
                                      .appendingPathComponent("data", isDirectory: true)
                                      .appendingPathComponent("chain", isDirectory: true)
                                      .appendingPathComponent("bitcoin", isDirectory: true)
                                      .appendingPathComponent(network ?? "mainnet", isDirectory: true)

    let neutrinoDbPath = chainPath.appendingPathComponent("neutrino.db")
    let blockHeadersBinPath = chainPath.appendingPathComponent("block_headers.bin")
    let regFiltersHeadersBinPath = chainPath.appendingPathComponent("reg_filter_headers.bin")

    do {
      try FileManager.default.removeItem(at: neutrinoDbPath)
      try FileManager.default.removeItem(at: blockHeadersBinPath)
      try FileManager.default.removeItem(at: regFiltersHeadersBinPath)
    } catch {
      reject("error", error.localizedDescription, error)
      return
    }

    resolve(true)
  }

  @objc(checkApplicationSupportExists:rejecter:)
  func checkApplicationSupportExists(resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    let applicationSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
    resolve(FileManager.default.fileExists(atPath: applicationSupport.path))
  }

  @objc(checkLndFolderExists:rejecter:)
  func checkLndFolderExists(resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    let applicationSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
    let lndFolder = applicationSupport.appendingPathComponent("lnd", isDirectory: true)
    resolve(FileManager.default.fileExists(atPath: lndFolder.path))
  }

  @objc(createIOSApplicationSupportAndLndDirectories:rejecter:)
  func createIOSApplicationSupportAndLndDirectories(resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    do {
      let applicationSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
      let lndFolder = applicationSupport.appendingPathComponent("lnd", isDirectory: true)
      // This will create the lnd folder as well as "Application Support"
      try FileManager.default.createDirectory(at: lndFolder, withIntermediateDirectories: true)

      resolve(true)
    } catch let error {
      reject("error", error.localizedDescription, error)
    }
  }

  @objc(excludeLndICloudBackup:rejecter:)
  func excludeLndICloudBackup(resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    let applicationSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
    var lndFolder = applicationSupport.appendingPathComponent("lnd", isDirectory: true)

    do {
      if FileManager.default.fileExists(atPath: lndFolder.path) {
        var resourceValues = URLResourceValues()
        resourceValues.isExcludedFromBackup = true
        try lndFolder.setResourceValues(resourceValues)
        resolve(true)
      } else {
        let error = LndMobileToolsError(msg: "lnd path " + lndFolder.path + " doesn't exist")
        reject("error", error.localizedDescription, error)
      }
    } catch let error {
      print("failed setting isExcludedFromBackup: \(error)")
      reject("error", error.localizedDescription, error)
    }
  }

  @objc(TEMP_moveLndToApplicationSupport:rejecter:)
  func TEMP_moveLndToApplicationSupport(resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
    let applicationSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!

    let newLndFolder = applicationSupport.appendingPathComponent("lnd", isDirectory: true)

    let lndData = documents.appendingPathComponent("data", isDirectory: true)
    let lndConfig = documents.appendingPathComponent("lnd.conf")

    let newlndDataPath = newLndFolder.appendingPathComponent("data")
    let newLndConfigPath = newLndFolder.appendingPathComponent("lnd.conf")

    NSLog("FROM: \(lndData.path)")
    NSLog("TO: \(newlndDataPath.path)")

    do {
      if FileManager.default.fileExists(atPath: newLndFolder.path) {
        try FileManager.default.moveItem(at: lndData, to: newlndDataPath)
        try FileManager.default.moveItem(at: lndConfig, to: newLndConfigPath)
        resolve(true)
      } else {
        let error = LndMobileToolsError(msg: "lnd path \(newLndFolder.path) doesn't exist")
        reject("error", error.localizedDescription, error)
      }
    } catch let error {
      NSLog("Failed moving lnd files: \(error)")
      reject("error", error.localizedDescription, error)
    }
  }

  @objc(tailLog:network:resolver:rejecter:)
  func tailLog(numberOfLines: Int32, network: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    let paths = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)
    let url = paths[0].appendingPathComponent("lnd", isDirectory: true)
                      .appendingPathComponent("logs", isDirectory: true)
                      .appendingPathComponent("bitcoin", isDirectory: true)
                      .appendingPathComponent(network ?? "mainnet", isDirectory: true)
                      .appendingPathComponent("lnd.log", isDirectory: false)

    do {
      let data = try String(contentsOf: url)
      let lines = data.components(separatedBy: .newlines)
      resolve(lines.suffix(Int(numberOfLines)).joined(separator: "\n"))
    } catch {
      reject("error", error.localizedDescription, error)
    }
  }

  var lndLogFileObservingStarted = false
  @objc(observeLndLogFile:resolver:rejecter:)
  func observeLndLogFile(network: String, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    if (lndLogFileObservingStarted) {
      resolve(true)
      return
    }
    let paths = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)
    let url = paths[0].appendingPathComponent("lnd", isDirectory: true)
                      .appendingPathComponent("logs", isDirectory: true)
                      .appendingPathComponent("bitcoin", isDirectory: true)
                      .appendingPathComponent(network ?? "mainnet", isDirectory: true)
                      .appendingPathComponent("lnd.log", isDirectory: false)
    let fileHandle = FileHandle(forReadingAtPath: url.path)

    DispatchQueue.main.async(execute: { [self] in
      NotificationCenter.default.addObserver(
        forName: FileHandle.readCompletionNotification,
        object: fileHandle,
        queue: OperationQueue.main,
        using: { [self] n in
          let data = n.userInfo?[NSFileHandleNotificationDataItem] as? Data
          if data != nil && (data?.count ?? 0) > 0 {
            var s: String? = nil
            if let bytes = data {
              s = String(bytes: bytes, encoding: .utf8)
            }
            if let s = s {
              self.sendEvent(withName: "lndlog", body: s)
            }
          }
          fileHandle?.readInBackgroundAndNotify()
        })
      fileHandle?.seekToEndOfFile()
      fileHandle?.readInBackgroundAndNotify()
    })
    lndLogFileObservingStarted = true
    resolve(true)
  }

  @objc(copyLndLog:resolver:rejecter:)
  func copyLndLog(network: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      let paths = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)
      let url = paths[0].appendingPathComponent("lnd", isDirectory: true)
        .appendingPathComponent("logs", isDirectory: true)
        .appendingPathComponent("bitcoin", isDirectory: true)
        .appendingPathComponent(network ?? "mainnet", isDirectory: true)
        .appendingPathComponent("lnd.log", isDirectory: false)
#if os(iOS)
      do {
        let data = try String(contentsOf: url)
        let activityController = UIActivityViewController(activityItems: [data], applicationActivities: nil)
        RCTSharedApplication()?.delegate?.window??.rootViewController?.present(activityController, animated: true, completion: {
          resolve(true)
        })
      } catch {
        reject("error", error.localizedDescription, error)
      }
#else
      do {
        let data = try Data(contentsOf: url)
        let savePanel = NSSavePanel()
        savePanel.nameFieldStringValue = "lnd.log"
        if (savePanel.runModal() == NSApplication.ModalResponse.OK) {
          let saveUrl = savePanel.url
          NSLog(saveUrl?.path ?? "")
          NSLog(saveUrl?.absoluteString ?? "")
          NSLog(saveUrl?.relativeString ?? "")

          if let saveUrlUnwrapped = saveUrl {
            try data.write(to: saveUrlUnwrapped)
          }
          resolve(true)
        } else {
          resolve(false)
        }
      } catch {
        print("Error saving backup")
        reject("error", error.localizedDescription, error)
      }
#endif
    }
  }

  @objc(macosOpenFileDialog:rejecter:)
  func macosOpenFileDialog(resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
  #if os(iOS)
    let error = LndMobileToolsError(msg: "Not supported iOS")
    reject("error", error.localizedDescription, error)
  #else
    DispatchQueue.main.async {
      do {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = false
        panel.canChooseDirectories = false
        if panel.runModal() == .OK {
          if let u = panel.url {
            resolve(try Data(contentsOf: u).base64EncodedString())
          } else {
            let error = LndMobileToolsError(msg: "Could not open file")
            reject("error", error.localizedDescription, error)
          }
        } else {
          resolve(nil)
        }
      }
      catch {
       print("Error open")
       reject("error", error.localizedDescription, error)
     }
    }
  #endif
  }
}
