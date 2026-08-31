import Foundation
import SQLite3

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

  @objc(writeConfig:lndDir:resolver:rejecter:)
  func writeConfig(config: String, lndDir: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    do {
      let paths = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)
      let url = paths[0].appendingPathComponent(lndDir, isDirectory: true).appendingPathComponent("lnd.conf", isDirectory: false)
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
        .appendingPathComponent(network, isDirectory: true)
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

  @objc(deleteLndDirectory:resolver:rejecter:)
  func deleteLndDirectory(lndDir: String, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    let fileManager = FileManager.default
    let applicationSupportUrl = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
    let lndUrl = applicationSupportUrl.appendingPathComponent(lndDir)
  
    do {
      try FileManager.default.removeItem(at: lndUrl)
    } catch {
      reject("error deleting lnd dir", error.localizedDescription, error)
      return
    }

    resolve(true)
  }

  @objc(DEBUG_deleteNeutrinoFiles:network:isSqlite:resolver:rejecter:)
  func DEBUG_deleteNeutrinoFiles(lndDir: String, network: String, isSqlite: Bool, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    let applicationSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
    let folderName = lndDir.isEmpty ? "lnd" : lndDir
    let networkName = network.isEmpty ? "mainnet" : network
    let chainPath = applicationSupport.appendingPathComponent(folderName, isDirectory: true)
                                      .appendingPathComponent("data", isDirectory: true)
                                      .appendingPathComponent("chain", isDirectory: true)
                                      .appendingPathComponent("bitcoin", isDirectory: true)
                                      .appendingPathComponent(networkName, isDirectory: true)

    let neutrinoDbPath = chainPath.appendingPathComponent("neutrino.db")
    let blockHeadersBinPath = chainPath.appendingPathComponent("block_headers.bin")
    let regFiltersHeadersBinPath = chainPath.appendingPathComponent("reg_filter_headers.bin")

    do {
      let baseFiles = [neutrinoDbPath, blockHeadersBinPath, regFiltersHeadersBinPath]
      for filePath in baseFiles {
        if FileManager.default.fileExists(atPath: filePath.path) {
          try FileManager.default.removeItem(at: filePath)
        }
      }

      if isSqlite {
        let sqliteFiles = ["neutrino.sqlite", "neutrino.sqlite-shm", "neutrino.sqlite-wal"]
        for filename in sqliteFiles {
          let filePath = chainPath.appendingPathComponent(filename)
          if FileManager.default.fileExists(atPath: filePath.path) {
            try FileManager.default.removeItem(at: filePath)
          }
        }
      }
    } catch {
      reject("error", error.localizedDescription, error)
      return
    }

    resolve(true)
  }

  // Graph SQL database maintenance.
  //
  // The embedded LND fork stores the gossip graph in native-SQL tables inside
  // lnd.sqlite. LND decides which migrations to run from the single highest
  // version in migration_tracker, so deleting individual tracker rows never
  // makes it re-run a migration. The pre-v13.2.1 reset dropped the graph
  // tables and deleted tracker rows 9/10 while rows 11-18 remained, leaving
  // databases LND could never open again (issue #4524). The reset now only
  // DELETEs rows inside one transaction and treats migration_tracker and
  // schema_migrations as LND-owned. Repair rebuilds the schema for wallets
  // the old reset already damaged.
  //
  // The DDL below mirrors the lnd fork's migrations 000008_graph and
  // 000009_graph_v2 and must stay in sync with the fork pinned in
  // fetch-libraries-versions.json. If the fork's highest migration version
  // moves past graphKnownMaxDbVersion, repair fails closed until these
  // definitions are reviewed against the new migrations.
  static let graphV2MigrationVersion: Int64 = 11  // 000009_graph_v2
  static let graphKnownMaxDbVersion: Int64 = 18   // 000015_chain_params
  static let graphKnownSchemaVersion = 15         // golang-migrate version at db version 18

  static let graphTablesChildFirst = [
    "graph_channel_policy_extra_types",
    "graph_channel_policies",
    "graph_channel_features",
    "graph_channel_extra_types",
    "graph_source_nodes",
    "graph_channels",
    "graph_node_addresses",
    "graph_node_features",
    "graph_node_extra_types",
    "graph_nodes",
    "graph_zombie_channels",
    "graph_prune_log",
    "graph_closed_scids"
  ]

  // Tables as created by 000008_graph, followed by the 000009_graph_v2
  // column additions.
  static let graphTableDdl = [
    """
    CREATE TABLE IF NOT EXISTS graph_nodes (
      id INTEGER PRIMARY KEY,
      version SMALLINT NOT NULL,
      pub_key BLOB NOT NULL,
      alias TEXT,
      last_update BIGINT,
      color VARCHAR,
      signature BLOB
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS graph_node_extra_types (
      node_id BIGINT NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
      type BIGINT NOT NULL,
      value BLOB
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS graph_node_features (
      node_id BIGINT NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
      feature_bit INTEGER NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS graph_node_addresses (
      node_id BIGINT NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
      type SMALLINT NOT NULL,
      position INTEGER NOT NULL,
      address TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS graph_source_nodes (
      node_id BIGINT NOT NULL REFERENCES graph_nodes (id) ON DELETE CASCADE
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS graph_channels (
      id INTEGER PRIMARY KEY,
      version SMALLINT NOT NULL,
      scid BLOB NOT NULL,
      node_id_1 BIGINT NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
      node_id_2 BIGINT NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
      outpoint TEXT NOT NULL,
      capacity BIGINT,
      bitcoin_key_1 BLOB,
      bitcoin_key_2 BLOB,
      node_1_signature BLOB,
      node_2_signature BLOB,
      bitcoin_1_signature BLOB,
      bitcoin_2_signature BLOB
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS graph_channel_features (
      channel_id BIGINT NOT NULL REFERENCES graph_channels(id) ON DELETE CASCADE,
      feature_bit INTEGER NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS graph_channel_extra_types (
      channel_id BIGINT NOT NULL REFERENCES graph_channels(id) ON DELETE CASCADE,
      type BIGINT NOT NULL,
      value BLOB
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS graph_channel_policies (
      id INTEGER PRIMARY KEY,
      version SMALLINT NOT NULL,
      channel_id BIGINT NOT NULL REFERENCES graph_channels(id) ON DELETE CASCADE,
      node_id BIGINT NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
      timelock INTEGER NOT NULL,
      fee_ppm BIGINT NOT NULL,
      base_fee_msat BIGINT NOT NULL,
      min_htlc_msat BIGINT NOT NULL,
      max_htlc_msat BIGINT,
      last_update BIGINT,
      disabled bool,
      inbound_base_fee_msat BIGINT,
      inbound_fee_rate_milli_msat BIGINT,
      message_flags SMALLINT CHECK (message_flags >= 0 AND message_flags <= 255),
      channel_flags SMALLINT CHECK (channel_flags >= 0 AND channel_flags <= 255),
      signature BLOB
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS graph_channel_policy_extra_types (
      channel_policy_id BIGINT NOT NULL REFERENCES graph_channel_policies(id) ON DELETE CASCADE,
      type BIGINT NOT NULL,
      value BLOB
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS graph_zombie_channels (
      scid BLOB NOT NULL,
      version SMALLINT NOT NULL,
      node_key_1 BLOB,
      node_key_2 BLOB
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS graph_prune_log (
      block_height BIGINT PRIMARY KEY,
      block_hash BLOB NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS graph_closed_scids (
      scid BLOB PRIMARY KEY
    )
    """,
    "ALTER TABLE graph_nodes ADD COLUMN block_height BIGINT",
    "ALTER TABLE graph_channels ADD COLUMN signature BLOB",
    "ALTER TABLE graph_channels ADD COLUMN funding_pk_script BLOB",
    "ALTER TABLE graph_channels ADD COLUMN merkle_root_hash BLOB",
    "ALTER TABLE graph_channel_policies ADD COLUMN block_height BIGINT",
    "ALTER TABLE graph_channel_policies ADD COLUMN disable_flags SMALLINT CHECK (disable_flags >= 0 AND disable_flags <= 255)"
  ]

  // The index set after 000009_graph_v2 has been applied.
  static let graphIndexDdl = [
    "CREATE UNIQUE INDEX IF NOT EXISTS graph_nodes_unique ON graph_nodes (pub_key, version)",
    "CREATE INDEX IF NOT EXISTS graph_node_last_update_idx ON graph_nodes(version, last_update, pub_key)",
    "CREATE INDEX IF NOT EXISTS graph_node_block_height_idx ON graph_nodes (version, block_height, pub_key)",
    "CREATE UNIQUE INDEX IF NOT EXISTS graph_node_extra_types_unique ON graph_node_extra_types (type, node_id)",
    "CREATE UNIQUE INDEX IF NOT EXISTS graph_node_features_unique ON graph_node_features (node_id, feature_bit)",
    "CREATE UNIQUE INDEX IF NOT EXISTS graph_node_addresses_unique ON graph_node_addresses (node_id, type, position)",
    "CREATE UNIQUE INDEX IF NOT EXISTS graph_source_nodes_unique ON graph_source_nodes (node_id)",
    "CREATE INDEX IF NOT EXISTS graph_channels_node_id_1_idx ON graph_channels(node_id_1, version)",
    "CREATE INDEX IF NOT EXISTS graph_channels_node_id_2_idx ON graph_channels(node_id_2, version)",
    "CREATE INDEX IF NOT EXISTS graph_channels_version_id_idx ON graph_channels(version, id)",
    "CREATE UNIQUE INDEX IF NOT EXISTS graph_channels_unique ON graph_channels(version, scid DESC)",
    "CREATE INDEX IF NOT EXISTS graph_channels_version_outpoint_idx ON graph_channels(version, outpoint)",
    "CREATE UNIQUE INDEX IF NOT EXISTS graph_channel_features_unique ON graph_channel_features (channel_id, feature_bit)",
    "CREATE UNIQUE INDEX IF NOT EXISTS graph_channel_extra_types_unique ON graph_channel_extra_types (type, channel_id)",
    "CREATE UNIQUE INDEX IF NOT EXISTS graph_channel_policies_unique ON graph_channel_policies (channel_id, node_id, version)",
    "CREATE INDEX IF NOT EXISTS graph_channel_policy_last_update_idx ON graph_channel_policies(last_update)",
    "CREATE INDEX IF NOT EXISTS graph_channel_policy_block_height_idx ON graph_channel_policies (version, block_height)",
    "CREATE UNIQUE INDEX IF NOT EXISTS graph_channel_policy_extra_types_unique ON graph_channel_policy_extra_types (type, channel_policy_id)",
    "CREATE UNIQUE INDEX IF NOT EXISTS graph_zombie_channels_channel_id_version_idx ON graph_zombie_channels(scid, version)"
  ]

  private func graphDbScalar(_ db: OpaquePointer?, _ sql: String) -> Int64? {
    var stmt: OpaquePointer?
    guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return nil }
    defer { sqlite3_finalize(stmt) }
    guard sqlite3_step(stmt) == SQLITE_ROW else { return nil }
    return sqlite3_column_int64(stmt, 0)
  }

  private func graphDbExec(_ db: OpaquePointer?, _ sql: String) -> String? {
    var errMsg: UnsafeMutablePointer<CChar>?
    if sqlite3_exec(db, sql, nil, nil, &errMsg) != SQLITE_OK {
      let error = errMsg != nil ? String(cString: errMsg!) : "Unknown SQLite error"
      sqlite3_free(errMsg)
      return error
    }
    return nil
  }

  private func graphDbExecTransaction(_ db: OpaquePointer?, _ statements: [String]) -> String? {
    if let error = graphDbExec(db, "BEGIN IMMEDIATE") {
      return error
    }
    for sql in statements {
      if let error = graphDbExec(db, sql) {
        _ = graphDbExec(db, "ROLLBACK")
        return error
      }
    }
    return graphDbExec(db, "COMMIT")
  }

  @objc(repairGraphDb:network:resolver:rejecter:)
  func repairGraphDb(lndDir: String, network: String, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    graphDbMaintenance(lndDir: lndDir, network: network, resetData: false, resolver: resolve, rejecter: reject)
  }

  @objc(resetGraphDb:network:resolver:rejecter:)
  func resetGraphDb(lndDir: String, network: String, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    graphDbMaintenance(lndDir: lndDir, network: network, resetData: true, resolver: resolve, rejecter: reject)
  }

  private func graphDbMaintenance(lndDir: String, network: String, resetData: Bool, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    let applicationSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
    let folderName = lndDir.isEmpty ? "lnd" : lndDir
    let networkName = network.isEmpty ? "mainnet" : network
    let graphPath = applicationSupport.appendingPathComponent(folderName, isDirectory: true)
                                      .appendingPathComponent("data", isDirectory: true)
                                      .appendingPathComponent("graph", isDirectory: true)
                                      .appendingPathComponent(networkName, isDirectory: true)
    let dbPath = graphPath.appendingPathComponent("lnd.sqlite").path

    guard FileManager.default.fileExists(atPath: dbPath) else {
      resolve("noop")
      return
    }

    var db: OpaquePointer?
    guard sqlite3_open(dbPath, &db) == SQLITE_OK else {
      reject("error", "Failed to open lnd.sqlite", nil)
      return
    }
    defer { sqlite3_close(db) }

    guard let trackerExists = graphDbScalar(db,
      "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='migration_tracker'") else {
      reject("error", "Failed to inspect lnd.sqlite", nil)
      return
    }
    if trackerExists == 0 {
      // Pre-native-SQL database; the graph does not live here.
      resolve("noop")
      return
    }

    guard let dbVersion = graphDbScalar(db,
      "SELECT COALESCE(MAX(version), 0) FROM migration_tracker") else {
      reject("error", "Failed to read migration_tracker", nil)
      return
    }

    var presentTables = Set<String>()
    var stmt: OpaquePointer?
    guard sqlite3_prepare_v2(db,
      "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'graph!_%' ESCAPE '!'",
      -1, &stmt, nil) == SQLITE_OK else {
      reject("error", "Failed to inspect lnd.sqlite", nil)
      return
    }
    while sqlite3_step(stmt) == SQLITE_ROW {
      if let name = sqlite3_column_text(stmt, 0) {
        presentTables.insert(String(cString: name))
      }
    }
    sqlite3_finalize(stmt)

    let missingTables = LndMobileTools.graphTablesChildFirst.filter { !presentTables.contains($0) }
    let unknownTables = presentTables.subtracting(LndMobileTools.graphTablesChildFirst)

    if missingTables.isEmpty {
      let knownSchema = dbVersion <= LndMobileTools.graphKnownMaxDbVersion && unknownTables.isEmpty
      if !resetData && !knownSchema {
        resolve("ok")
        return
      }
      if resetData && !unknownTables.isEmpty {
        reject("error", "Refusing to reset graph db: unrecognized graph tables " +
          unknownTables.sorted().joined(separator: ", ") +
          ". Update the graph schema definitions to match the lnd fork.", nil)
        return
      }
      var statements: [String] = []
      if resetData {
        statements += LndMobileTools.graphTablesChildFirst.map { "DELETE FROM \($0)" }
      }
      if knownSchema {
        // Restore any indexes a partially-run legacy reset dropped;
        // no-ops on healthy databases.
        statements += LndMobileTools.graphIndexDdl
      }
      if let error = graphDbExecTransaction(db, statements) {
        reject("error", error, nil)
        return
      }
      resolve(resetData ? "reset" : "ok")
      return
    }

    // Some graph tables are missing.
    if dbVersion < LndMobileTools.graphV2MigrationVersion {
      // The graph migrations have not run yet; LND will create the schema
      // itself on next start.
      resolve("noop")
      return
    }
    if dbVersion > LndMobileTools.graphKnownMaxDbVersion || !unknownTables.isEmpty {
      reject("error", "Graph db is missing tables " + missingTables.joined(separator: ", ") +
        " but its schema (version \(dbVersion)) is not recognized by this build; refusing to repair.", nil)
      return
    }

    // migration_tracker says the graph schema exists but the tables are
    // gone: this wallet was damaged by the pre-v13.2.1 reset. Rebuild the
    // schema exactly as migrations 000008_graph + 000009_graph_v2 define
    // it and restore the bookkeeping the legacy reset removed.
    var statements = LndMobileTools.graphTablesChildFirst.map { "DROP TABLE IF EXISTS \($0)" }
    statements += LndMobileTools.graphTableDdl
    statements += LndMobileTools.graphIndexDdl
    statements += [
      "INSERT OR IGNORE INTO migration_tracker (version, migration_time) VALUES (9, CURRENT_TIMESTAMP)",
      "INSERT OR IGNORE INTO migration_tracker (version, migration_time) VALUES (10, CURRENT_TIMESTAMP)",
      "DELETE FROM schema_migrations",
      "INSERT INTO schema_migrations (version, dirty) VALUES (\(LndMobileTools.graphKnownSchemaVersion), 0)"
    ]
    if let error = graphDbExecTransaction(db, statements) {
      reject("error", error, nil)
      return
    }
    resolve("repaired")
  }

  @objc(checkApplicationSupportExists:rejecter:)
  func checkApplicationSupportExists(resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    let applicationSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
    resolve(FileManager.default.fileExists(atPath: applicationSupport.path))
  }

  @objc(checkLndFolderExists:resolver:rejecter:)
  func checkLndFolderExists(lndDir: String, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    let applicationSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
    let folderName = lndDir.isEmpty ? "lnd" : lndDir
    let lndFolder = applicationSupport.appendingPathComponent(folderName, isDirectory: true)
    resolve(FileManager.default.fileExists(atPath: lndFolder.path))
  }

  @objc(createIOSApplicationSupportAndLndDirectories:resolver:rejecter:)
  func createIOSApplicationSupportAndLndDirectories(lndDir: String, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    do {
      let applicationSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
      let lndFolder = applicationSupport.appendingPathComponent(lndDir, isDirectory: true)
      // This will create the lnd folder as well as "Application Support"
      try FileManager.default.createDirectory(at: lndFolder, withIntermediateDirectories: true)

      resolve(true)
    } catch let error {
      reject("error", error.localizedDescription, error)
    }
  }

  @objc(excludeLndICloudBackup:resolver:rejecter:)
  func excludeLndICloudBackup(lndDir: String, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    let applicationSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
    var lndFolder = applicationSupport.appendingPathComponent(lndDir, isDirectory: true)

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

  @objc(tailLog:lndDir:network:resolver:rejecter:)
  func tailLog(numberOfLines: Int32, lndDir: String, network: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    let paths = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)
    let url = paths[0].appendingPathComponent(lndDir, isDirectory: true)
                      .appendingPathComponent("logs", isDirectory: true)
                      .appendingPathComponent("bitcoin", isDirectory: true)
                      .appendingPathComponent(network, isDirectory: true)
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
  @objc(observeLndLogFile:network:resolver:rejecter:)
  func observeLndLogFile(lndDir: String, network: String, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    if (lndLogFileObservingStarted) {
      resolve(true)
      return
    }
    let paths = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)
    let url = paths[0].appendingPathComponent(lndDir, isDirectory: true)
                      .appendingPathComponent("logs", isDirectory: true)
                      .appendingPathComponent("bitcoin", isDirectory: true)
                      .appendingPathComponent(network, isDirectory: true)
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

  @objc(killLnd:rejecter:)
  func killLnd(resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    // On iOS, we can't directly kill other processes, but we can mark LND as stopped
    // and let the system clean up the resources
    if Lnd.shared.lndStarted {
        Lnd.shared.lndStarted = false
        // Clear any active streams
        Lnd.shared.activeStreams.removeAll()
        resolve(true)
    } else {
        resolve(false)
    }
  }
}
