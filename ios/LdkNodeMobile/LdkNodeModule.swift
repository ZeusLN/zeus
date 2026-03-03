import Foundation
import LDKNodeFFI

@objc(LdkNodeModule)
class LdkNodeModule: RCTEventEmitter {

    private var node: Node?
    private var builder: Builder?
    private var logFileObserver: LogFileObserver?

    // Stored config values for building with custom Config
    private var storedNetwork: Network = .bitcoin
    private var storedStorageDirPath: String = ""
    private var storedListeningAddresses: [SocketAddress]?
    private var storedTrustedPeers0conf: [PublicKey] = []

    // Stored builder settings (not part of Config)
    private var storedEsploraServerUrl: String?
    private var storedRgsServerUrl: String?
    private var storedLsps1NodeId: PublicKey?
    private var storedLsps1Address: SocketAddress?
    private var storedLsps1Token: String?
    private var storedLsps2NodeId: PublicKey?
    private var storedLsps2Address: SocketAddress?
    private var storedLsps2Token: String?
    private var storedLsps7NodeId: PublicKey?
    private var storedLsps7Address: SocketAddress?
    private var storedLsps7Token: String?

    // VSS (Versioned Storage Service) config
    private var storedVssUrl: String?
    private var storedVssStoreId: String?
    private var storedVssHeaders: [String: String] = [:]

    @objc
    override static func moduleName() -> String! {
        "LdkNodeModule"
    }

    override func supportedEvents() -> [String]! {
        return ["LdkNodeEvent", "ldklog"]
    }

    @objc
    override static func requiresMainQueueSetup() -> Bool {
        return false
    }

    private func resetStoredConfig() {
        storedNetwork = .bitcoin
        storedStorageDirPath = ""
        storedListeningAddresses = nil
        storedTrustedPeers0conf = []
        storedEsploraServerUrl = nil
        storedRgsServerUrl = nil
        storedLsps1NodeId = nil
        storedLsps1Address = nil
        storedLsps1Token = nil
        storedLsps2NodeId = nil
        storedLsps2Address = nil
        storedLsps2Token = nil
        storedLsps7NodeId = nil
        storedLsps7Address = nil
        storedLsps7Token = nil
        storedVssUrl = nil
        storedVssStoreId = nil
        storedVssHeaders = [:]
    }

    // MARK: - Builder Methods

    @objc(createBuilder:rejecter:)
    func createBuilder(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        resetStoredConfig()
        self.builder = Builder()
        resolve(["status": "ok"])
    }

    @objc(setNetwork:resolver:rejecter:)
    func setNetwork(_ network: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let builder = self.builder else {
            reject("error", "Builder not initialized", nil)
            return
        }

        let networkEnum: Network
        switch network.lowercased() {
        case "bitcoin", "mainnet":
            networkEnum = Network.bitcoin
        case "testnet":
            networkEnum = Network.testnet
        case "signet":
            networkEnum = Network.signet
        case "regtest":
            networkEnum = Network.regtest
        default:
            reject("error", "Unknown network: \(network)", nil)
            return
        }

        self.storedNetwork = networkEnum
        builder.setNetwork(network: networkEnum)
        resolve(["status": "ok"])
    }

    @objc(setStorageDirPath:resolver:rejecter:)
    func setStorageDirPath(_ path: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let builder = self.builder else {
            reject("error", "Builder not initialized", nil)
            return
        }

        self.storedStorageDirPath = path
        builder.setStorageDirPath(storageDirPath: path)
        resolve(["status": "ok"])
    }

    @objc(setEsploraServer:resolver:rejecter:)
    func setEsploraServer(_ serverUrl: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let builder = self.builder else {
            reject("error", "Builder not initialized", nil)
            return
        }

        self.storedEsploraServerUrl = serverUrl
        builder.setChainSourceEsplora(serverUrl: serverUrl, config: createEsploraSyncConfig())
        resolve(["status": "ok"])
    }

    @objc(setGossipSourceRgs:resolver:rejecter:)
    func setGossipSourceRgs(_ rgsServerUrl: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let builder = self.builder else {
            reject("error", "Builder not initialized", nil)
            return
        }

        self.storedRgsServerUrl = rgsServerUrl
        builder.setGossipSourceRgs(rgsServerUrl: rgsServerUrl)
        resolve(["status": "ok"])
    }

    @objc(setTrustedPeers0conf:resolver:rejecter:)
    func setTrustedPeers0conf(_ peers: [String], resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard self.builder != nil else {
            reject("error", "Builder not initialized", nil)
            return
        }

        // PublicKey is a typealias for String, so we can use the peers directly
        self.storedTrustedPeers0conf = peers
        resolve(["status": "ok"])
    }

    @objc(setVssServer:storeId:headers:resolver:rejecter:)
    func setVssServer(_ vssUrl: String, storeId: String, headers: NSDictionary?, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard self.builder != nil else {
            reject("error", "Builder not initialized", nil)
            return
        }

        self.storedVssUrl = vssUrl
        self.storedVssStoreId = storeId
        if let headers = headers as? [String: String] {
            self.storedVssHeaders = headers
        } else {
            self.storedVssHeaders = [:]
        }
        resolve(["status": "ok"])
    }

    @objc(setGossipSourceP2p:rejecter:)
    func setGossipSourceP2p(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let builder = self.builder else {
            reject("error", "Builder not initialized", nil)
            return
        }

        builder.setGossipSourceP2p()
        resolve(["status": "ok"])
    }

    @objc(setListeningAddresses:resolver:rejecter:)
    func setListeningAddresses(_ addresses: [String], resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let builder = self.builder else {
            reject("error", "Builder not initialized", nil)
            return
        }

        do {
            // SocketAddress is a String typealias, so we pass addresses directly
            self.storedListeningAddresses = addresses
            try builder.setListeningAddresses(listeningAddresses: addresses)
            resolve(["status": "ok"])
        } catch {
            reject("error", self.errorMessage(error), error)
        }
    }

    @objc(setLiquiditySourceLsps1:address:token:resolver:rejecter:)
    func setLiquiditySourceLsps1(_ nodeId: String, address: String, token: String?, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let builder = self.builder else {
            reject("error", "Builder not initialized", nil)
            return
        }

        // PublicKey and SocketAddress are String typealiases
        self.storedLsps1NodeId = nodeId
        self.storedLsps1Address = address
        self.storedLsps1Token = token
        builder.setLiquiditySourceLsps1(nodeId: nodeId, address: address, token: token)
        resolve(["status": "ok"])
    }

    @objc(setLiquiditySourceLsps2:address:token:resolver:rejecter:)
    func setLiquiditySourceLsps2(_ nodeId: String, address: String, token: String?, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let builder = self.builder else {
            reject("error", "Builder not initialized", nil)
            return
        }

        // PublicKey and SocketAddress are String typealiases
        self.storedLsps2NodeId = nodeId
        self.storedLsps2Address = address
        self.storedLsps2Token = token
        builder.setLiquiditySourceLsps2(nodeId: nodeId, address: address, token: token)
        resolve(["status": "ok"])
    }

    @objc(setLiquiditySourceLsps7:address:token:resolver:rejecter:)
    func setLiquiditySourceLsps7(_ nodeId: String, address: String, token: String?, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard self.builder != nil else {
            reject("error", "Builder not initialized", nil)
            return
        }

        self.storedLsps7NodeId = nodeId
        self.storedLsps7Address = address
        self.storedLsps7Token = token
        resolve(["status": "ok"])
    }

    // MARK: - Mnemonic Methods

    @objc(generateMnemonic:resolver:rejecter:)
    func generateMnemonic(_ wordCount: NSNumber, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        let wc: WordCount
        switch wordCount.intValue {
        case 12:
            wc = WordCount.words12
        case 18:
            wc = WordCount.words18
        case 24:
            wc = WordCount.words24
        default:
            wc = WordCount.words12
        }

        let mnemonic = generateEntropyMnemonic(wordCount: wc)
        resolve(["mnemonic": mnemonic])
    }

    // MARK: - Node Build Methods

    @objc(buildNode:passphrase:resolver:rejecter:)
    func buildNode(_ mnemonic: String, passphrase: String?, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard self.builder != nil else {
            reject("error", "Builder not initialized", nil)
            return
        }

        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self = self else {
                reject("error", "Module deallocated", nil)
                return
            }

            do {
                // Always create a Config with anchor channels enabled to ensure proper channel type negotiation
                // Create AnchorChannelsConfig (required for LSP zero-conf anchor channels)
                let anchorConfig = AnchorChannelsConfig(
                    trustedPeersNoReserve: self.storedTrustedPeers0conf,
                    perChannelReserveSats: 25000
                )

                // Create a Config with anchorChannelsConfig always set
                let config = Config(
                    storageDirPath: self.storedStorageDirPath,
                    network: self.storedNetwork,
                    listeningAddresses: self.storedListeningAddresses,
                    announcementAddresses: nil,
                    nodeAlias: nil,
                    trustedPeers0conf: self.storedTrustedPeers0conf,
                    probingLiquidityLimitMultiplier: 3,
                    anchorChannelsConfig: anchorConfig,
                    routeParameters: nil
                )

                let nodeEntropy = NodeEntropy.fromBip39Mnemonic(mnemonic: mnemonic, passphrase: passphrase)
                var vssError: String? = nil

                if let vssUrl = self.storedVssUrl, let vssStoreId = self.storedVssStoreId {
                    NSLog("LdkNodeModule: Building node with VSS store: \(vssUrl)")

                    let semaphore = DispatchSemaphore(value: 0)
                    var buildResult: Node?
                    var buildError: Error?

                    let workItem = DispatchWorkItem {
                        do {
                            let vssBuilder = Builder.fromConfig(config: config)
                            self.applyBuilderSettings(vssBuilder)
                            buildResult = try vssBuilder.buildWithVssStoreAndFixedHeaders(nodeEntropy: nodeEntropy, vssUrl: vssUrl, storeId: vssStoreId, fixedHeaders: self.storedVssHeaders)
                        } catch {
                            buildError = error
                        }
                        semaphore.signal()
                    }

                    DispatchQueue.global(qos: .userInitiated).async(execute: workItem)
                    let timeout = semaphore.wait(timeout: .now() + 60)

                    if timeout == .timedOut {
                        workItem.cancel()
                        vssError = "VSS server at \(vssUrl) did not respond within 60s"
                        NSLog("LdkNodeModule: \(vssError!)")
                    } else if let error = buildError {
                        vssError = "VSS setup failed: \(error.localizedDescription)"
                        NSLog("LdkNodeModule: \(vssError!)")
                    } else {
                        self.node = buildResult
                        NSLog("LdkNodeModule: Node built with VSS store successfully")
                    }
                }

                // Fall back to local filesystem store if VSS failed or was not configured
                if self.node == nil {
                    if vssError != nil {
                        NSLog("LdkNodeModule: Falling back to local filesystem store")
                    }
                    let fsBuilder = Builder.fromConfig(config: config)
                    self.applyBuilderSettings(fsBuilder)
                    self.node = try fsBuilder.buildWithFsStore(nodeEntropy: nodeEntropy)
                }

                self.builder = nil // Builder is consumed
                var result: [String: Any] = [:]
                if let vssError = vssError {
                    result["vssError"] = vssError
                }
                resolve(result)
            } catch {
                reject("error", self.errorMessage(error), error)
            }
        }
    }

    private func applyBuilderSettings(_ builder: Builder) {
        if let esploraUrl = self.storedEsploraServerUrl {
            NSLog("LdkNodeModule: applyBuilderSettings: Esplora server = \(esploraUrl)")
            builder.setChainSourceEsplora(serverUrl: esploraUrl, config: nil)
        }
        if let rgsUrl = self.storedRgsServerUrl {
            NSLog("LdkNodeModule: applyBuilderSettings: RGS server = \(rgsUrl)")
            builder.setGossipSourceRgs(rgsServerUrl: rgsUrl)
        }
        if let lsps1NodeId = self.storedLsps1NodeId, let lsps1Address = self.storedLsps1Address {
            builder.setLiquiditySourceLsps1(nodeId: lsps1NodeId, address: lsps1Address, token: self.storedLsps1Token)
        }
        if let lsps2NodeId = self.storedLsps2NodeId, let lsps2Address = self.storedLsps2Address {
            builder.setLiquiditySourceLsps2(nodeId: lsps2NodeId, address: lsps2Address, token: self.storedLsps2Token)
        }
        if let lsps7NodeId = self.storedLsps7NodeId, let lsps7Address = self.storedLsps7Address {
            builder.setLiquiditySourceLsps7(nodeId: lsps7NodeId, address: lsps7Address, token: self.storedLsps7Token)
        }

        if !self.storedStorageDirPath.isEmpty {
            NSLog("LdkNodeModule: applyBuilderSettings: Enabling filesystem logger")
            builder.setFilesystemLogger(logFilePath: "\(self.storedStorageDirPath)/ldk_node.log", maxLogLevel: .debug)
        }
    }

    private func createEsploraSyncConfig() -> EsploraSyncConfig {
        return EsploraSyncConfig(
            backgroundSyncConfig: BackgroundSyncConfig(
                onchainWalletSyncIntervalSecs: 60,
                lightningWalletSyncIntervalSecs: 60,
                feeRateCacheUpdateIntervalSecs: 600
            )
        )
    }

    // MARK: - Node Lifecycle Methods

    @objc(start:rejecter:)
    func start(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let node = self.node else {
            reject("error", "Node not initialized", nil)
            return
        }

        do {
            try node.start()
            resolve(["status": "ok"])
        } catch {
            reject("error", self.errorMessage(error), error)
        }
    }

    @objc(stop:rejecter:)
    func stop(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let node = self.node else {
            // No node to stop - that's OK
            resolve(["status": "ok"])
            return
        }

        do {
            try node.stop()
            self.logFileObserver?.stopObserving()
            self.logFileObserver = nil
            self.node = nil
            resolve(["status": "ok"])
        } catch {
            reject("error", self.errorMessage(error), error)
        }
    }

    @objc(syncWallets:rejecter:)
    func syncWallets(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let node = self.node else {
            reject("error", "Node not initialized", nil)
            return
        }

        DispatchQueue.global(qos: .userInitiated).async {
            do {
                try node.syncWallets()
                resolve(["status": "ok"])
            } catch {
                reject("error", self.errorMessage(error), error)
            }
        }
    }

    // MARK: - Node Info Methods

    @objc(nodeId:rejecter:)
    func nodeId(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let node = self.node else {
            reject("error", "Node not initialized", nil)
            return
        }

        let nodeId = node.nodeId()
        resolve(["nodeId": nodeId])
    }

    @objc(status:rejecter:)
    func status(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let node = self.node else {
            reject("error", "Node not initialized", nil)
            return
        }

        let status = node.status()
        resolve([
            "isRunning": status.isRunning,
            "currentBestBlock_height": status.currentBestBlock.height,
            "currentBestBlock_hash": status.currentBestBlock.blockHash,
            "latestLightningWalletSyncTimestamp": status.latestLightningWalletSyncTimestamp as Any,
            "latestOnchainWalletSyncTimestamp": status.latestOnchainWalletSyncTimestamp as Any,
            "latestFeeRateCacheUpdateTimestamp": status.latestFeeRateCacheUpdateTimestamp as Any,
            "latestRgsSnapshotTimestamp": status.latestRgsSnapshotTimestamp as Any,
            "latestNodeAnnouncementBroadcastTimestamp": status.latestNodeAnnouncementBroadcastTimestamp as Any
        ])
    }

    @objc(listBalances:rejecter:)
    func listBalances(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let node = self.node else {
            reject("error", "Node not initialized", nil)
            return
        }

        let balances = node.listBalances()
        resolve([
            "totalOnchainBalanceSats": balances.totalOnchainBalanceSats,
            "spendableOnchainBalanceSats": balances.spendableOnchainBalanceSats,
            "totalAnchorChannelsReserveSats": balances.totalAnchorChannelsReserveSats,
            "totalLightningBalanceSats": balances.totalLightningBalanceSats,
            "lightningBalances": balances.lightningBalances.map { self.serializeLightningBalance($0) },
            "pendingBalancesFromChannelClosures": balances.pendingBalancesFromChannelClosures.map { self.serializePendingBalance($0) }
        ])
    }

    @objc(networkGraphInfo:rejecter:)
    func networkGraphInfo(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let node = self.node else {
            reject("error", "Node not initialized", nil)
            return
        }

        let graph = node.networkGraph()
        let channelCount = graph.listChannels().count
        let nodeCount = graph.listNodes().count

        resolve([
            "channelCount": channelCount,
            "nodeCount": nodeCount
        ])
    }

    @objc(resetNetworkGraph:rejecter:)
    func resetNetworkGraph(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let node = self.node else {
            reject("error", "Node not initialized", nil)
            return
        }

        DispatchQueue.global(qos: .userInitiated).async {
            do {
                try node.resetNetworkGraph()
                resolve(["status": "ok"])
            } catch {
                reject("error", self.errorMessage(error), error)
            }
        }
    }

    @objc(updateRgsSnapshot:rejecter:)
    func updateRgsSnapshot(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let node = self.node else {
            reject("error", "Node not initialized", nil)
            return
        }

        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let timestamp = try node.updateRgsSnapshot()
                resolve(["timestamp": timestamp])
            } catch {
                reject("error", self.errorMessage(error), error)
            }
        }
    }

    // MARK: - Channel Methods

    @objc(listChannels:rejecter:)
    func listChannels(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let node = self.node else {
            reject("error", "Node not initialized", nil)
            return
        }

        let channels = node.listChannels()
        let channelList = channels.map { channel -> [String: Any] in
            var result: [String: Any] = [
                "channelId": channel.channelId,
                "counterpartyNodeId": channel.counterpartyNodeId,
                "channelValueSats": channel.channelValueSats,
                "outboundCapacityMsat": channel.outboundCapacityMsat,
                "inboundCapacityMsat": channel.inboundCapacityMsat,
                "confirmationsRequired": channel.confirmationsRequired as Any,
                "confirmations": channel.confirmations as Any,
                "isOutbound": channel.isOutbound,
                "isChannelReady": channel.isChannelReady,
                "isUsable": channel.isUsable,
                "isAnnounced": channel.isAnnounced,
                "userChannelId": channel.userChannelId,
                "feerateSatPer1000Weight": channel.feerateSatPer1000Weight,
                "counterpartyUnspendablePunishmentReserve": channel.counterpartyUnspendablePunishmentReserve,
                "nextOutboundHtlcLimitMsat": channel.nextOutboundHtlcLimitMsat,
                "nextOutboundHtlcMinimumMsat": channel.nextOutboundHtlcMinimumMsat,
                "inboundHtlcMinimumMsat": channel.inboundHtlcMinimumMsat
            ]
            if let fundingTxo = channel.fundingTxo {
                result["fundingTxo_txid"] = fundingTxo.txid
                result["fundingTxo_vout"] = fundingTxo.vout
            }
            if let unspendablePunishmentReserve = channel.unspendablePunishmentReserve {
                result["unspendablePunishmentReserve"] = unspendablePunishmentReserve
            }
            if let cltvExpiryDelta = channel.cltvExpiryDelta {
                result["cltvExpiryDelta"] = cltvExpiryDelta
            }
            if let counterpartyOutboundHtlcMinimumMsat = channel.counterpartyOutboundHtlcMinimumMsat {
                result["counterpartyOutboundHtlcMinimumMsat"] = counterpartyOutboundHtlcMinimumMsat
            }
            if let counterpartyOutboundHtlcMaximumMsat = channel.counterpartyOutboundHtlcMaximumMsat {
                result["counterpartyOutboundHtlcMaximumMsat"] = counterpartyOutboundHtlcMaximumMsat
            }
            if let counterpartyForwardingInfoFeeBaseMsat = channel.counterpartyForwardingInfoFeeBaseMsat {
                result["counterpartyForwardingInfoFeeBaseMsat"] = counterpartyForwardingInfoFeeBaseMsat
            }
            if let counterpartyForwardingInfoFeeProportionalMillionths = channel.counterpartyForwardingInfoFeeProportionalMillionths {
                result["counterpartyForwardingInfoFeeProportionalMillionths"] = counterpartyForwardingInfoFeeProportionalMillionths
            }
            if let counterpartyForwardingInfoCltvExpiryDelta = channel.counterpartyForwardingInfoCltvExpiryDelta {
                result["counterpartyForwardingInfoCltvExpiryDelta"] = counterpartyForwardingInfoCltvExpiryDelta
            }
            if let forceCloseSpendDelay = channel.forceCloseSpendDelay {
                result["forceCloseSpendDelay"] = forceCloseSpendDelay
            }
            if let inboundHtlcMaximumMsat = channel.inboundHtlcMaximumMsat {
                result["inboundHtlcMaximumMsat"] = inboundHtlcMaximumMsat
            }
            return result
        }
        resolve(["channels": channelList])
    }

    @objc(listClosedChannels:rejecter:)
    func listClosedChannels(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let node = self.node else {
            reject("error", "Node not initialized", nil)
            return
        }

        let closedChannels = node.listClosedChannels()
        let channelList = closedChannels.map { channel -> [String: Any] in
            var result: [String: Any] = [
                "channelId": channel.channelId,
                "userChannelId": channel.userChannelId,
                "closedAtTimestamp": channel.closedAtTimestamp
            ]
            if let counterpartyNodeId = channel.counterpartyNodeId {
                result["counterpartyNodeId"] = counterpartyNodeId
            }
            if let fundingTxo = channel.fundingTxo {
                result["fundingTxo_txid"] = fundingTxo.txid
                result["fundingTxo_vout"] = fundingTxo.vout
            }
            if let channelCapacitySats = channel.channelCapacitySats {
                result["channelCapacitySats"] = channelCapacitySats
            }
            if let lastLocalBalanceMsat = channel.lastLocalBalanceMsat {
                result["lastLocalBalanceMsat"] = lastLocalBalanceMsat
            }
            if let closureReason = channel.closureReason {
                result["closureReason"] = serializeClosureReason(closureReason)
            }
            return result
        }
        resolve(["channels": channelList])
    }

    @objc(openChannel:address:channelAmountSats:pushToCounterpartyMsat:announceChannel:resolver:rejecter:)
    func openChannel(_ nodeId: String, address: String, channelAmountSats: NSNumber, pushToCounterpartyMsat: NSNumber, announceChannel: Bool, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let node = self.node else {
            reject("error", "Node not initialized", nil)
            return
        }

        do {
            // Treat 0 as nil (no push to counterparty)
            let pushMsat: UInt64? = pushToCounterpartyMsat.uint64Value > 0 ? pushToCounterpartyMsat.uint64Value : nil

            let userChannelId: UserChannelId
            if announceChannel {
                userChannelId = try node.openAnnouncedChannel(
                    nodeId: nodeId,
                    address: address,
                    channelAmountSats: channelAmountSats.uint64Value,
                    pushToCounterpartyMsat: pushMsat,
                    channelConfig: nil
                )
            } else {
                userChannelId = try node.openChannel(
                    nodeId: nodeId,
                    address: address,
                    channelAmountSats: channelAmountSats.uint64Value,
                    pushToCounterpartyMsat: pushMsat,
                    channelConfig: nil
                )
            }
            resolve(["userChannelId": userChannelId])
        } catch {
            reject("error", self.errorMessage(error), error)
        }
    }

    @objc(closeChannel:counterpartyNodeId:resolver:rejecter:)
    func closeChannel(_ userChannelId: String, counterpartyNodeId: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let node = self.node else {
            reject("error", "Node not initialized", nil)
            return
        }

        do {
            try node.closeChannel(userChannelId: userChannelId, counterpartyNodeId: counterpartyNodeId)
            resolve(["status": "ok"])
        } catch {
            reject("error", self.errorMessage(error), error)
        }
    }

    // MARK: - On-chain Methods

    @objc(newOnchainAddress:rejecter:)
    func newOnchainAddress(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let node = self.node else {
            reject("error", "Node not initialized", nil)
            return
        }

        do {
            let onchain = node.onchainPayment()
            let address = try onchain.newAddress()
            resolve(["address": address])
        } catch {
            reject("error", self.errorMessage(error), error)
        }
    }

    @objc(sendToOnchainAddress:amountSats:resolver:rejecter:)
    func sendToOnchainAddress(_ address: String, amountSats: NSNumber, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let node = self.node else {
            reject("error", "Node not initialized", nil)
            return
        }

        do {
            let onchain = node.onchainPayment()
            let txid = try onchain.sendToAddress(address: address, amountSats: amountSats.uint64Value, feeRate: nil)
            resolve(["txid": txid])
        } catch {
            reject("error", self.errorMessage(error), error)
        }
    }

    @objc(sendAllToOnchainAddress:retainReserve:resolver:rejecter:)
    func sendAllToOnchainAddress(_ address: String, retainReserve: Bool, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let node = self.node else {
            reject("error", "Node not initialized", nil)
            return
        }

        do {
            let onchain = node.onchainPayment()
            let txid = try onchain.sendAllToAddress(address: address, retainReserve: retainReserve, feeRate: nil)
            resolve(["txid": txid])
        } catch {
            reject("error", self.errorMessage(error), error)
        }
    }

    // MARK: - Route Parameters Helper

    private func buildRouteParameters(maxTotalRoutingFeeMsat: Double, maxPathCount: Double) -> RouteParametersConfig? {
        let hasFeeMsat = maxTotalRoutingFeeMsat >= 0
        let hasPathCount = maxPathCount >= 0
        guard hasFeeMsat || hasPathCount else { return nil }
        return RouteParametersConfig(
            maxTotalRoutingFeeMsat: hasFeeMsat ? UInt64(maxTotalRoutingFeeMsat) : nil,
            maxTotalCltvExpiryDelta: 1008,
            maxPathCount: hasPathCount ? UInt8(maxPathCount) : 10,
            maxChannelSaturationPowerOfHalf: 2
        )
    }

    // MARK: - BOLT11 Payment Methods

    @objc(receiveBolt11:invoiceDescription:expirySecs:resolver:rejecter:)
    func receiveBolt11(_ amountMsat: Double, invoiceDescription: String, expirySecs: Double, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let node = self.node else {
            reject("error", "Node not initialized", nil)
            return
        }

        do {
            let bolt11 = node.bolt11Payment()
            let descriptionObj = Bolt11InvoiceDescription.direct(description: invoiceDescription)
            let invoice = try bolt11.receive(amountMsat: UInt64(amountMsat), description: descriptionObj, expirySecs: UInt32(expirySecs))
            resolve(["invoice": invoice.description])
        } catch {
            reject("error", self.errorMessage(error), error)
        }
    }

    @objc(receiveVariableAmountBolt11:expirySecs:resolver:rejecter:)
    func receiveVariableAmountBolt11(_ invoiceDescription: String, expirySecs: Double, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let node = self.node else {
            reject("error", "Node not initialized", nil)
            return
        }

        do {
            let bolt11 = node.bolt11Payment()
            let descriptionObj = Bolt11InvoiceDescription.direct(description: invoiceDescription)
            let invoice = try bolt11.receiveVariableAmount(description: descriptionObj, expirySecs: UInt32(expirySecs))
            resolve(["invoice": invoice.description])
        } catch {
            reject("error", self.errorMessage(error), error)
        }
    }

    @objc(sendBolt11:maxTotalRoutingFeeMsat:maxPathCount:resolver:rejecter:)
    func sendBolt11(_ invoice: String, maxTotalRoutingFeeMsat: Double, maxPathCount: Double, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let node = self.node else {
            reject("error", "Node not initialized", nil)
            return
        }

        let routeParams = buildRouteParameters(maxTotalRoutingFeeMsat: maxTotalRoutingFeeMsat, maxPathCount: maxPathCount)

        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let bolt11 = node.bolt11Payment()
                let bolt11Invoice = try Bolt11Invoice.fromStr(invoiceStr: invoice)
                let paymentId = try bolt11.send(invoice: bolt11Invoice, routeParameters: routeParams)
                resolve(["paymentId": paymentId])
            } catch {
                reject("error", self.errorMessage(error), error)
            }
        }
    }

    @objc(sendBolt11UsingAmount:amountMsat:maxTotalRoutingFeeMsat:maxPathCount:resolver:rejecter:)
    func sendBolt11UsingAmount(_ invoice: String, amountMsat: Double, maxTotalRoutingFeeMsat: Double, maxPathCount: Double, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let node = self.node else {
            reject("error", "Node not initialized", nil)
            return
        }

        let routeParams = buildRouteParameters(maxTotalRoutingFeeMsat: maxTotalRoutingFeeMsat, maxPathCount: maxPathCount)

        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let bolt11 = node.bolt11Payment()
                let bolt11Invoice = try Bolt11Invoice.fromStr(invoiceStr: invoice)
                let paymentId = try bolt11.sendUsingAmount(invoice: bolt11Invoice, amountMsat: UInt64(amountMsat), routeParameters: routeParams)
                resolve(["paymentId": paymentId])
            } catch {
                reject("error", self.errorMessage(error), error)
            }
        }
    }

    // MARK: - Spontaneous Payment Methods

    @objc(sendSpontaneousPayment:amountMsat:maxTotalRoutingFeeMsat:maxPathCount:resolver:rejecter:)
    func sendSpontaneousPayment(_ nodeId: String, amountMsat: Double, maxTotalRoutingFeeMsat: Double, maxPathCount: Double, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let node = self.node else {
            reject("error", "Node not initialized", nil)
            return
        }

        let routeParams = buildRouteParameters(maxTotalRoutingFeeMsat: maxTotalRoutingFeeMsat, maxPathCount: maxPathCount)

        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let paymentId = try node.spontaneousPayment().send(amountMsat: UInt64(amountMsat), nodeId: nodeId, routeParameters: routeParams)
                resolve(["paymentId": paymentId])
            } catch {
                reject("error", self.errorMessage(error), error)
            }
        }
    }

    // MARK: - BOLT12 Payment Methods

    @objc(bolt12Receive:description:expirySecs:resolver:rejecter:)
    func bolt12Receive(_ amountMsat: Double, description: String, expirySecs: Double, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let node = self.node else {
            reject("error", "Node not initialized", nil)
            return
        }

        do {
            let bolt12 = node.bolt12Payment()
            let offer = try bolt12.receive(amountMsat: UInt64(amountMsat), description: description, expirySecs: expirySecs > 0 ? UInt32(expirySecs) : nil, quantity: nil)
            resolve(["offer": offer.description, "offerId": offer.id()])
        } catch {
            reject("error", self.errorMessage(error), error)
        }
    }

    @objc(bolt12ReceiveVariableAmount:expirySecs:resolver:rejecter:)
    func bolt12ReceiveVariableAmount(_ description: String, expirySecs: Double, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let node = self.node else {
            reject("error", "Node not initialized", nil)
            return
        }

        do {
            let bolt12 = node.bolt12Payment()
            let offer = try bolt12.receiveVariableAmount(description: description, expirySecs: expirySecs > 0 ? UInt32(expirySecs) : nil)
            resolve(["offer": offer.description, "offerId": offer.id()])
        } catch {
            reject("error", self.errorMessage(error), error)
        }
    }

    @objc(bolt12Send:payerNote:maxTotalRoutingFeeMsat:maxPathCount:resolver:rejecter:)
    func bolt12Send(_ offerStr: String, payerNote: String?, maxTotalRoutingFeeMsat: Double, maxPathCount: Double, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let node = self.node else {
            reject("error", "Node not initialized", nil)
            return
        }

        let routeParams = buildRouteParameters(maxTotalRoutingFeeMsat: maxTotalRoutingFeeMsat, maxPathCount: maxPathCount)

        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let bolt12 = node.bolt12Payment()
                let offer = try Offer.fromStr(offerStr: offerStr)
                let paymentId = try bolt12.send(offer: offer, quantity: nil, payerNote: payerNote, routeParameters: routeParams)
                resolve(["paymentId": paymentId])
            } catch {
                reject("error", self.errorMessage(error), error)
            }
        }
    }

    @objc(bolt12SendUsingAmount:amountMsat:payerNote:maxTotalRoutingFeeMsat:maxPathCount:resolver:rejecter:)
    func bolt12SendUsingAmount(_ offerStr: String, amountMsat: Double, payerNote: String?, maxTotalRoutingFeeMsat: Double, maxPathCount: Double, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let node = self.node else {
            reject("error", "Node not initialized", nil)
            return
        }

        let routeParams = buildRouteParameters(maxTotalRoutingFeeMsat: maxTotalRoutingFeeMsat, maxPathCount: maxPathCount)

        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let bolt12 = node.bolt12Payment()
                let offer = try Offer.fromStr(offerStr: offerStr)
                let paymentId = try bolt12.sendUsingAmount(offer: offer, amountMsat: UInt64(amountMsat), quantity: nil, payerNote: payerNote, routeParameters: routeParams)
                resolve(["paymentId": paymentId])
            } catch {
                reject("error", self.errorMessage(error), error)
            }
        }
    }

    @objc(bolt12InitiateRefund:expirySecs:maxTotalRoutingFeeMsat:maxPathCount:resolver:rejecter:)
    func bolt12InitiateRefund(_ amountMsat: Double, expirySecs: Double, maxTotalRoutingFeeMsat: Double, maxPathCount: Double, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let node = self.node else {
            reject("error", "Node not initialized", nil)
            return
        }

        let routeParams = buildRouteParameters(maxTotalRoutingFeeMsat: maxTotalRoutingFeeMsat, maxPathCount: maxPathCount)

        do {
            let bolt12 = node.bolt12Payment()
            let refund = try bolt12.initiateRefund(amountMsat: UInt64(amountMsat), expirySecs: UInt32(expirySecs), quantity: nil, payerNote: nil, routeParameters: routeParams)
            resolve(["refund": refund.description])
        } catch {
            reject("error", self.errorMessage(error), error)
        }
    }

    @objc(bolt12RequestRefundPayment:resolver:rejecter:)
    func bolt12RequestRefundPayment(_ refundStr: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let node = self.node else {
            reject("error", "Node not initialized", nil)
            return
        }

        do {
            let bolt12 = node.bolt12Payment()
            let refund = try Refund.fromStr(refundStr: refundStr)
            let invoice = try bolt12.requestRefundPayment(refund: refund)
            resolve(["invoice": String(describing: invoice)])
        } catch {
            reject("error", self.errorMessage(error), error)
        }
    }

    // MARK: - Payment Methods

    @objc(listPayments:rejecter:)
    func listPayments(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let node = self.node else {
            reject("error", "Node not initialized", nil)
            return
        }

        let payments = node.listPayments()
        let paymentList = payments.map { payment -> [String: Any] in
            return [
                "id": payment.id,
                "kind": self.serializePaymentKind(payment.kind),
                "amountMsat": payment.amountMsat as Any,
                "feePaidMsat": payment.feePaidMsat as Any,
                "direction": self.serializePaymentDirection(payment.direction),
                "status": self.serializePaymentStatus(payment.status),
                "latestUpdateTimestamp": payment.latestUpdateTimestamp
            ]
        }
        resolve(["payments": paymentList])
    }

    // MARK: - Peer Methods

    @objc(connect:address:persist:resolver:rejecter:)
    func connect(_ nodeId: String, address: String, persist: Bool, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let node = self.node else {
            reject("error", "Node not initialized", nil)
            return
        }

        do {
            try node.connect(nodeId: nodeId, address: address, persist: persist)
            resolve(["status": "ok"])
        } catch {
            reject("error", self.errorMessage(error), error)
        }
    }

    @objc(disconnect:resolver:rejecter:)
    func disconnect(_ nodeId: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let node = self.node else {
            reject("error", "Node not initialized", nil)
            return
        }

        do {
            try node.disconnect(nodeId: nodeId)
            resolve(["status": "ok"])
        } catch {
            reject("error", self.errorMessage(error), error)
        }
    }

    @objc(listPeers:rejecter:)
    func listPeers(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let node = self.node else {
            reject("error", "Node not initialized", nil)
            return
        }

        let peers = node.listPeers()
        let peerList = peers.map { peer -> [String: Any] in
            return [
                "nodeId": peer.nodeId,
                "address": peer.address,
                "isConnected": peer.isConnected
            ]
        }
        resolve(["peers": peerList])
    }

    // MARK: - Event Methods

    @objc(nextEvent:rejecter:)
    func nextEvent(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let node = self.node else {
            reject("error", "Node not initialized", nil)
            return
        }

        if let event = node.nextEvent() {
            resolve(["event": serializeEvent(event)])
        } else {
            resolve(["event": NSNull()])
        }
    }

    @objc(waitNextEvent:rejecter:)
    func waitNextEvent(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let node = self.node else {
            reject("error", "Node not initialized", nil)
            return
        }

        DispatchQueue.global(qos: .userInitiated).async {
            let event = node.waitNextEvent()
            resolve(["event": self.serializeEvent(event)])
        }
    }

    @objc(eventHandled:rejecter:)
    func eventHandled(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let node = self.node else {
            reject("error", "Node not initialized", nil)
            return
        }

        do {
            try node.eventHandled()
            resolve(["status": "ok"])
        } catch {
            reject("error", self.errorMessage(error), error)
        }
    }

    // MARK: - LSPS1 Methods

    @objc(lsps1RequestChannel:clientBalanceSat:channelExpiryBlocks:announceChannel:resolver:rejecter:)
    func lsps1RequestChannel(_ lspBalanceSat: Double, clientBalanceSat: Double, channelExpiryBlocks: Double, announceChannel: Bool, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let node = self.node else {
            reject("error", "Node not initialized", nil)
            return
        }

        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let lsps1 = node.lsps1Liquidity()
                let orderStatus = try lsps1.requestChannel(
                    lspBalanceSat: UInt64(lspBalanceSat),
                    clientBalanceSat: UInt64(clientBalanceSat),
                    channelExpiryBlocks: UInt32(channelExpiryBlocks),
                    announceChannel: announceChannel
                )
                resolve(self.serializeLsps1OrderStatus(orderStatus))
            } catch {
                reject("error", self.errorMessage(error), error)
            }
        }
    }

    @objc(lsps1CheckOrderStatus:resolver:rejecter:)
    func lsps1CheckOrderStatus(_ orderId: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let node = self.node else {
            reject("error", "Node not initialized", nil)
            return
        }

        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let lsps1 = node.lsps1Liquidity()
                // Lsps1OrderId is a String typealias
                let orderStatus = try lsps1.checkOrderStatus(orderId: orderId)
                resolve(self.serializeLsps1OrderStatus(orderStatus))
            } catch {
                reject("error", self.errorMessage(error), error)
            }
        }
    }

    // MARK: - LSPS7 Methods

    @objc(lsps7GetExtendableChannels:rejecter:)
    func lsps7GetExtendableChannels(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let node = self.node else {
            reject("error", "Node not initialized", nil)
            return
        }

        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let lsps7 = node.lsps7Liquidity()
                let channels = try lsps7.getExtendableChannels()
                let result = channels.map { self.serializeLsps7ExtendableChannel($0) }
                resolve(result)
            } catch {
                reject("error", self.errorMessage(error), error)
            }
        }
    }

    @objc(lsps7CreateOrder:channelExtensionExpiryBlocks:token:refundOnchainAddress:resolver:rejecter:)
    func lsps7CreateOrder(_ shortChannelId: String, channelExtensionExpiryBlocks: Double, token: String?, refundOnchainAddress: String?, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let node = self.node else {
            reject("error", "Node not initialized", nil)
            return
        }

        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let lsps7 = node.lsps7Liquidity()
                let response = try lsps7.createOrder(
                    shortChannelId: shortChannelId,
                    channelExtensionExpiryBlocks: UInt32(channelExtensionExpiryBlocks),
                    token: token,
                    refundOnchainAddress: refundOnchainAddress
                )
                resolve(self.serializeLsps7OrderResponse(response))
            } catch {
                reject("error", self.errorMessage(error), error)
            }
        }
    }

    @objc(lsps7CheckOrderStatus:resolver:rejecter:)
    func lsps7CheckOrderStatus(_ orderId: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let node = self.node else {
            reject("error", "Node not initialized", nil)
            return
        }

        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let lsps7 = node.lsps7Liquidity()
                let response = try lsps7.checkOrderStatus(orderId: orderId)
                resolve(self.serializeLsps7OrderResponse(response))
            } catch {
                reject("error", self.errorMessage(error), error)
            }
        }
    }

    // MARK: - Message Signing Methods

    @objc(signMessage:resolver:rejecter:)
    func signMessage(_ message: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let node = self.node else {
            reject("error", "Node not initialized", nil)
            return
        }

        let messageBytes = Array(message.utf8)
        let signature = node.signMessage(msg: messageBytes)
        resolve(["signature": signature])
    }

    @objc(verifySignature:signature:publicKey:resolver:rejecter:)
    func verifySignature(_ message: String, signature: String, publicKey: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let node = self.node else {
            reject("error", "Node not initialized", nil)
            return
        }

        let messageBytes = Array(message.utf8)
        // PublicKey is a typealias for String, so use publicKey directly
        let isValid = node.verifySignature(msg: messageBytes, sig: signature, pkey: publicKey)
        resolve(["valid": isValid])
    }

    // MARK: - Helper Methods

    private func serializeEvent(_ event: Event) -> [String: Any] {
        switch event {
        case .paymentSuccessful(let paymentId, let paymentHash, let paymentPreimage, let feePaidMsat):
            return [
                "type": "paymentSuccessful",
                "paymentId": paymentId as Any,
                "paymentHash": paymentHash,
                "paymentPreimage": paymentPreimage as Any,
                "feePaidMsat": feePaidMsat as Any
            ]
        case .paymentFailed(let paymentId, let paymentHash, let reason):
            return [
                "type": "paymentFailed",
                "paymentId": paymentId as Any,
                "paymentHash": paymentHash as Any,
                "reason": reason.map { serializePaymentFailureReason($0) } as Any
            ]
        case .paymentReceived(let paymentId, let paymentHash, let amountMsat, _):
            return [
                "type": "paymentReceived",
                "paymentId": paymentId as Any,
                "paymentHash": paymentHash,
                "amountMsat": amountMsat
            ]
        case .paymentClaimable(let paymentId, let paymentHash, let claimableAmountMsat, let claimDeadline, _):
            return [
                "type": "paymentClaimable",
                "paymentId": paymentId,
                "paymentHash": paymentHash,
                "claimableAmountMsat": claimableAmountMsat,
                "claimDeadline": claimDeadline as Any
            ]
        case .channelPending(let channelId, let userChannelId, let formerTemporaryChannelId, let counterpartyNodeId, let fundingTxo):
            return [
                "type": "channelPending",
                "channelId": channelId,
                "userChannelId": userChannelId,
                "formerTemporaryChannelId": formerTemporaryChannelId,
                "counterpartyNodeId": counterpartyNodeId,
                "fundingTxo": ["txid": fundingTxo.txid, "vout": fundingTxo.vout]
            ]
        case .channelReady(let channelId, let userChannelId, let counterpartyNodeId, let fundingTxo):
            return [
                "type": "channelReady",
                "channelId": channelId,
                "userChannelId": userChannelId,
                "counterpartyNodeId": counterpartyNodeId as Any,
                "fundingTxo": fundingTxo.map { ["txid": $0.txid, "vout": $0.vout] } as Any
            ]
        case .channelClosed(let channelId, let userChannelId, let counterpartyNodeId, let reason):
            return [
                "type": "channelClosed",
                "channelId": channelId,
                "userChannelId": userChannelId,
                "counterpartyNodeId": counterpartyNodeId as Any,
                "reason": reason.map { serializeClosureReason($0) } as Any
            ]
        default:
            return ["type": "unknown"]
        }
    }

    private func serializePaymentFailureReason(_ reason: PaymentFailureReason) -> String {
        switch reason {
        case .recipientRejected:
            return "recipientRejected"
        case .userAbandoned:
            return "userAbandoned"
        case .retriesExhausted:
            return "retriesExhausted"
        case .paymentExpired:
            return "paymentExpired"
        case .routeNotFound:
            return "routeNotFound"
        case .unexpectedError:
            return "unexpectedError"
        case .unknownRequiredFeatures:
            return "unknownRequiredFeatures"
        case .invoiceRequestExpired:
            return "invoiceRequestExpired"
        case .invoiceRequestRejected:
            return "invoiceRequestRejected"
        case .blindedPathCreationFailed:
            return "blindedPathCreationFailed"
        @unknown default:
            return "unknown"
        }
    }

    private func errorMessage(_ error: Error) -> String {
        if let nodeError = error as? NodeError {
            switch nodeError {
            case .ChannelCreationFailed(let message):
                return message
            default:
                // All NodeError cases have (message: String)
                // Extract via Mirror to avoid exhaustive switch
                let mirror = Mirror(reflecting: nodeError)
                if let firstChild = mirror.children.first,
                   let message = firstChild.value as? String {
                    return message
                }
                return "\(nodeError)"
            }
        }
        return error.localizedDescription
    }

    private func serializeClosureReason(_ reason: ClosureReason) -> [String: Any] {
        switch reason {
        case .counterpartyForceClosed(let peerMsg):
            return ["type": "counterpartyForceClosed", "peerMessage": "\(peerMsg)"]
        case .holderForceClosed(_, let message):
            return ["type": "holderForceClosed", "peerMessage": message]
        case .legacyCooperativeClosure:
            return ["type": "legacyCooperativeClosure"]
        case .counterpartyInitiatedCooperativeClosure:
            return ["type": "counterpartyInitiatedCooperativeClosure"]
        case .locallyInitiatedCooperativeClosure:
            return ["type": "locallyInitiatedCooperativeClosure"]
        case .commitmentTxConfirmed:
            return ["type": "commitmentTxConfirmed"]
        case .fundingTimedOut:
            return ["type": "fundingTimedOut"]
        case .processingError(let err):
            return ["type": "processingError", "peerMessage": err]
        case .disconnectedPeer:
            return ["type": "disconnectedPeer"]
        case .outdatedChannelManager:
            return ["type": "outdatedChannelManager"]
        case .counterpartyCoopClosedUnfundedChannel:
            return ["type": "counterpartyCoopClosedUnfundedChannel"]
        case .fundingBatchClosure:
            return ["type": "fundingBatchClosure"]
        case .locallyCoopClosedUnfundedChannel:
            return ["type": "locallyCoopClosedUnfundedChannel"]
        case .htlCsTimedOut:
            return ["type": "htlCsTimedOut"]
        case .peerFeerateTooLow(let peerFeerate, let requiredFeerate):
            return ["type": "peerFeerateTooLow", "peerMessage": "Peer feerate \(peerFeerate) sat/kw too low, required \(requiredFeerate) sat/kw"]
        @unknown default:
            return ["type": "unknown"]
        }
    }

    private func serializeLightningBalance(_ balance: LightningBalance) -> [String: Any] {
        switch balance {
        case .claimableOnChannelClose(let channelId, let counterpartyNodeId, let amountSatoshis, let transactionFeeSatoshis, let outboundPaymentHtlcRoundedMsat, let outboundForwardedHtlcRoundedMsat, let inboundClaimingHtlcRoundedMsat, let inboundHtlcRoundedMsat):
            return [
                "type": "claimableOnChannelClose",
                "channelId": channelId,
                "counterpartyNodeId": counterpartyNodeId,
                "amountSatoshis": amountSatoshis,
                "transactionFeeSatoshis": transactionFeeSatoshis,
                "outboundPaymentHtlcRoundedMsat": outboundPaymentHtlcRoundedMsat,
                "outboundForwardedHtlcRoundedMsat": outboundForwardedHtlcRoundedMsat,
                "inboundClaimingHtlcRoundedMsat": inboundClaimingHtlcRoundedMsat,
                "inboundHtlcRoundedMsat": inboundHtlcRoundedMsat
            ]
        case .claimableAwaitingConfirmations(let channelId, let counterpartyNodeId, let amountSatoshis, let confirmationHeight, let source):
            var sourceStr: String
            switch source {
            case .holderForceClosed: sourceStr = "holderForceClosed"
            case .counterpartyForceClosed: sourceStr = "counterpartyForceClosed"
            case .coopClose: sourceStr = "coopClose"
            case .htlc: sourceStr = "htlc"
            }
            return [
                "type": "claimableAwaitingConfirmations",
                "channelId": channelId,
                "counterpartyNodeId": counterpartyNodeId,
                "amountSatoshis": amountSatoshis,
                "confirmationHeight": confirmationHeight,
                "source": sourceStr
            ]
        case .contentiousClaimable(let channelId, let counterpartyNodeId, let amountSatoshis, let timeoutHeight, let paymentHash, let paymentPreimage):
            return [
                "type": "contentiousClaimable",
                "channelId": channelId,
                "counterpartyNodeId": counterpartyNodeId,
                "amountSatoshis": amountSatoshis,
                "timeoutHeight": timeoutHeight,
                "paymentHash": paymentHash,
                "paymentPreimage": paymentPreimage
            ]
        case .maybeTimeoutClaimableHtlc(let channelId, let counterpartyNodeId, let amountSatoshis, let claimableHeight, let paymentHash, let outboundPayment):
            return [
                "type": "maybeTimeoutClaimableHtlc",
                "channelId": channelId,
                "counterpartyNodeId": counterpartyNodeId,
                "amountSatoshis": amountSatoshis,
                "claimableHeight": claimableHeight,
                "paymentHash": paymentHash,
                "outboundPayment": outboundPayment
            ]
        case .maybePreimageClaimableHtlc(let channelId, let counterpartyNodeId, let amountSatoshis, let expiryHeight, let paymentHash):
            return [
                "type": "maybePreimageClaimableHtlc",
                "channelId": channelId,
                "counterpartyNodeId": counterpartyNodeId,
                "amountSatoshis": amountSatoshis,
                "expiryHeight": expiryHeight,
                "paymentHash": paymentHash
            ]
        case .counterpartyRevokedOutputClaimable(let channelId, let counterpartyNodeId, let amountSatoshis):
            return [
                "type": "counterpartyRevokedOutputClaimable",
                "channelId": channelId,
                "counterpartyNodeId": counterpartyNodeId,
                "amountSatoshis": amountSatoshis
            ]
        }
    }

    private func serializePendingBalance(_ balance: PendingSweepBalance) -> [String: Any] {
        switch balance {
        case .pendingBroadcast(let channelId, let amountSatoshis):
            return [
                "type": "pendingBroadcast",
                "channelId": channelId as Any,
                "amountSatoshis": amountSatoshis
            ]
        case .broadcastAwaitingConfirmation(let channelId, let latestBroadcastHeight, let latestSpendingTxid, let amountSatoshis):
            return [
                "type": "broadcastAwaitingConfirmation",
                "channelId": channelId as Any,
                "latestBroadcastHeight": latestBroadcastHeight,
                "latestSpendingTxid": latestSpendingTxid,
                "amountSatoshis": amountSatoshis
            ]
        case .awaitingThresholdConfirmations(let channelId, let latestSpendingTxid, let confirmationHash, let confirmationHeight, let amountSatoshis):
            return [
                "type": "awaitingThresholdConfirmations",
                "channelId": channelId as Any,
                "latestSpendingTxid": latestSpendingTxid,
                "confirmationHash": confirmationHash,
                "confirmationHeight": confirmationHeight,
                "amountSatoshis": amountSatoshis
            ]
        }
    }

    private func serializePaymentKind(_ kind: PaymentKind) -> [String: Any] {
        switch kind {
        case .onchain(let txid, let status):
            var result: [String: Any] = [
                "type": "onchain",
                "txid": txid,
                "status": serializeConfirmationStatus(status)
            ]
            if case .confirmed(_, let height, let timestamp) = status {
                result["confirmationHeight"] = height
                result["confirmationTimestamp"] = timestamp
            }
            return result
        case .bolt11(let hash, let preimage, let secret):
            return [
                "type": "bolt11",
                "hash": hash,
                "preimage": preimage as Any,
                "secret": secret as Any
            ]
        case .bolt11Jit(let hash, let preimage, let secret, let counterpartySkimmedFeeMsat, let lspFeeLimits):
            return [
                "type": "bolt11Jit",
                "hash": hash,
                "preimage": preimage as Any,
                "secret": secret as Any,
                "counterpartySkimmedFeeMsat": counterpartySkimmedFeeMsat as Any,
                "lspFeeLimits": [
                    "maxTotalOpeningFeeMsat": lspFeeLimits.maxTotalOpeningFeeMsat as Any,
                    "maxProportionalOpeningFeePpmMsat": lspFeeLimits.maxProportionalOpeningFeePpmMsat as Any
                ]
            ]
        case .bolt12Offer(let hash, let preimage, let secret, let offerId, let payerNote, let quantity):
            return [
                "type": "bolt12Offer",
                "hash": hash as Any,
                "preimage": preimage as Any,
                "secret": secret as Any,
                "offerId": offerId,
                "payerNote": payerNote as Any,
                "quantity": quantity as Any
            ]
        case .bolt12Refund(let hash, let preimage, let secret, let payerNote, let quantity):
            return [
                "type": "bolt12Refund",
                "hash": hash as Any,
                "preimage": preimage as Any,
                "secret": secret as Any,
                "payerNote": payerNote as Any,
                "quantity": quantity as Any
            ]
        case .spontaneous(let hash, let preimage):
            return [
                "type": "spontaneous",
                "hash": hash,
                "preimage": preimage as Any
            ]
        }
    }

    private func serializeConfirmationStatus(_ status: ConfirmationStatus) -> String {
        switch status {
        case .confirmed:
            return "confirmed"
        case .unconfirmed:
            return "unconfirmed"
        @unknown default:
            return "unknown"
        }
    }

    private func serializePaymentDirection(_ direction: PaymentDirection) -> String {
        switch direction {
        case .inbound:
            return "inbound"
        case .outbound:
            return "outbound"
        }
    }

    private func serializePaymentStatus(_ status: PaymentStatus) -> String {
        switch status {
        case .pending:
            return "pending"
        case .succeeded:
            return "succeeded"
        case .failed:
            return "failed"
        }
    }

    // MARK: - LSPS1 Serialization Helpers

    private func serializeLsps1OrderStatus(_ status: Lsps1OrderStatus) -> [String: Any] {
        var result: [String: Any] = [
            // orderId is already a String (Lsps1OrderId is a typealias for String)
            "orderId": status.orderId,
            "orderParams": serializeLsps1OrderParams(status.orderParams),
            "paymentInfo": serializeLsps1PaymentInfo(status.paymentOptions)
        ]
        if let channelState = status.channelState {
            result["channelInfo"] = serializeLsps1ChannelInfo(channelState)
        }
        return result
    }

    private func serializeLsps1OrderParams(_ params: Lsps1OrderParams) -> [String: Any] {
        return [
            "lspBalanceSat": params.lspBalanceSat,
            "clientBalanceSat": params.clientBalanceSat,
            "requiredChannelConfirmations": params.requiredChannelConfirmations,
            "fundingConfirmsWithinBlocks": params.fundingConfirmsWithinBlocks,
            "channelExpiryBlocks": params.channelExpiryBlocks,
            "token": params.token as Any,
            "announceChannel": params.announceChannel
        ]
    }

    private func serializeLsps1PaymentInfo(_ info: Lsps1PaymentInfo) -> [String: Any] {
        var result: [String: Any] = [:]
        if let bolt11 = info.bolt11 {
            result["bolt11Invoice"] = serializeLsps1Bolt11PaymentInfo(bolt11)
            // Set overall state from bolt11 if available
            result["state"] = serializeLsps1PaymentState(bolt11.state)
            result["feeTotalSat"] = bolt11.feeTotalSat
            result["orderTotalSat"] = bolt11.orderTotalSat
        }
        if let onchain = info.onchain {
            result["onchainPayment"] = serializeLsps1OnchainPaymentInfo(onchain)
            // If no bolt11, use onchain state
            if info.bolt11 == nil {
                result["state"] = serializeLsps1PaymentState(onchain.state)
                result["feeTotalSat"] = onchain.feeTotalSat
                result["orderTotalSat"] = onchain.orderTotalSat
            }
        }
        return result
    }

    private func serializeLsps1Bolt11PaymentInfo(_ info: Lsps1Bolt11PaymentInfo) -> [String: Any] {
        return [
            "state": serializeLsps1PaymentState(info.state),
            // expiresAt is a String (LspsDateTime is a typealias for String)
            "expiresAt": info.expiresAt,
            "feeTotalSat": info.feeTotalSat,
            "orderTotalSat": info.orderTotalSat,
            // Bolt11Invoice has CustomStringConvertible, use .description
            "invoice": info.invoice.description
        ]
    }

    private func serializeLsps1OnchainPaymentInfo(_ info: Lsps1OnchainPaymentInfo) -> [String: Any] {
        return [
            "state": serializeLsps1PaymentState(info.state),
            // expiresAt is a String (LspsDateTime is a typealias for String)
            "expiresAt": info.expiresAt,
            "feeTotalSat": info.feeTotalSat,
            "orderTotalSat": info.orderTotalSat,
            // address is a String (Address is a typealias for String)
            "address": info.address,
            "minOnchainPaymentConfirmations": info.minOnchainPaymentConfirmations as Any,
            // FeeRate uses toSatPerKwu() method
            "minFeeFor0conf": info.minFeeFor0conf.toSatPerKwu(),
            "refundOnchainAddress": info.refundOnchainAddress as Any
        ]
    }

    private func serializeLsps1ChannelInfo(_ info: Lsps1ChannelInfo) -> [String: Any] {
        return [
            // fundedAt and expiresAt are Strings (LspsDateTime is a typealias)
            "fundedAt": info.fundedAt,
            // fundingOutpoint is an OutPoint struct with txid and vout
            "fundingTxid": info.fundingOutpoint.txid,
            "fundingTxVout": info.fundingOutpoint.vout,
            "expiresAt": info.expiresAt
        ]
    }

    private func serializeLsps1PaymentState(_ state: Lsps1PaymentState) -> String {
        switch state {
        case .expectPayment:
            return "expectPayment"
        case .paid:
            return "paid"
        case .refunded:
            return "refunded"
        }
    }

    // MARK: - LSPS7 Serialization Helpers

    private func serializeLsps7OrderResponse(_ response: Lsps7OrderResponse) -> [String: Any] {
        var result: [String: Any] = [
            "orderId": response.orderId,
            "orderState": serializeLsps7OrderState(response.orderState),
            "channelExtensionExpiryBlocks": response.channelExtensionExpiryBlocks,
            "newChannelExpiryBlock": response.newChannelExpiryBlock,
            "paymentInfo": serializeLsps1PaymentInfo(response.payment),
            "channel": serializeLsps7ExtendableChannel(response.channel)
        ]
        return result
    }

    private func serializeLsps7ExtendableChannel(_ channel: Lsps7ExtendableChannel) -> [String: Any] {
        var result: [String: Any] = [
            "shortChannelId": channel.shortChannelId,
            "maxChannelExtensionExpiryBlocks": channel.maxChannelExtensionExpiryBlocks,
            "expirationBlock": channel.expirationBlock
        ]
        if let originalOrder = channel.originalOrder {
            result["originalOrder"] = [
                "id": originalOrder.id,
                "service": originalOrder.service
            ]
        }
        if let extensionOrderIds = channel.extensionOrderIds {
            result["extensionOrderIds"] = extensionOrderIds
        }
        return result
    }

    // MARK: - Log File Methods

    @objc(tailLdkNodeLog:resolver:rejecter:)
    func tailLdkNodeLog(_ numLines: NSNumber,
                         resolver resolve: @escaping RCTPromiseResolveBlock,
                         rejecter reject: @escaping RCTPromiseRejectBlock) {
        let logPath = "\(self.storedStorageDirPath)/ldk_node.log"
        resolve(LogFileObserver.tailFile(path: logPath, numLines: numLines.intValue))
    }

    @objc(observeLdkNodeLogFile:rejecter:)
    func observeLdkNodeLogFile(_ resolve: @escaping RCTPromiseResolveBlock,
                                rejecter reject: @escaping RCTPromiseRejectBlock) {
        if logFileObserver != nil {
            resolve(true)
            return
        }
        let logPath = "\(self.storedStorageDirPath)/ldk_node.log"
        logFileObserver = LogFileObserver(filePath: logPath) { [weak self] data in
            self?.sendEvent(withName: "ldklog", body: data)
        }
        logFileObserver?.startObserving()
        resolve(true)
    }

    private func serializeLsps7OrderState(_ state: Lsps7OrderState) -> String {
        switch state {
        case .created:
            return "CREATED"
        case .completed:
            return "COMPLETED"
        case .failed:
            return "FAILED"
        }
    }
}
