import Foundation
import LDKNodeFFI

@objc(LdkNodeModule)
class LdkNodeModule: RCTEventEmitter {

    private var node: Node?
    private var builder: Builder?

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

    @objc
    override static func moduleName() -> String! {
        "LdkNodeModule"
    }

    override func supportedEvents() -> [String]! {
        return ["LdkNodeEvent"]
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
        builder.setChainSourceEsplora(serverUrl: serverUrl, config: nil)
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
            reject("error", error.localizedDescription, error)
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

            // Create builder from config to ensure anchor channels are enabled
            let builderToUse = Builder.fromConfig(config: config)

            // Re-apply builder-only settings
            if let esploraUrl = self.storedEsploraServerUrl {
                builderToUse.setChainSourceEsplora(serverUrl: esploraUrl, config: nil)
            }
            if let rgsUrl = self.storedRgsServerUrl {
                builderToUse.setGossipSourceRgs(rgsServerUrl: rgsUrl)
            }
            if let lsps1NodeId = self.storedLsps1NodeId, let lsps1Address = self.storedLsps1Address {
                builderToUse.setLiquiditySourceLsps1(nodeId: lsps1NodeId, address: lsps1Address, token: self.storedLsps1Token)
            }
            if let lsps2NodeId = self.storedLsps2NodeId, let lsps2Address = self.storedLsps2Address {
                builderToUse.setLiquiditySourceLsps2(nodeId: lsps2NodeId, address: lsps2Address, token: self.storedLsps2Token)
            }

            builderToUse.setEntropyBip39Mnemonic(mnemonic: mnemonic, passphrase: passphrase)
            self.node = try builderToUse.buildWithFsStore()
            self.builder = nil // Builder is consumed
            resolve(["status": "ok"])
        } catch {
            reject("error", error.localizedDescription, error)
        }
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
            reject("error", error.localizedDescription, error)
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
            self.node = nil
            resolve(["status": "ok"])
        } catch {
            reject("error", error.localizedDescription, error)
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
                reject("error", error.localizedDescription, error)
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
            reject("error", error.localizedDescription, error)
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
            reject("error", error.localizedDescription, error)
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
            reject("error", error.localizedDescription, error)
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
            reject("error", error.localizedDescription, error)
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
            reject("error", error.localizedDescription, error)
        }
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
            reject("error", error.localizedDescription, error)
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
            reject("error", error.localizedDescription, error)
        }
    }

    @objc(sendBolt11:resolver:rejecter:)
    func sendBolt11(_ invoice: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let node = self.node else {
            reject("error", "Node not initialized", nil)
            return
        }

        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let bolt11 = node.bolt11Payment()
                let bolt11Invoice = try Bolt11Invoice.fromStr(invoiceStr: invoice)
                let paymentId = try bolt11.send(invoice: bolt11Invoice, routeParameters: nil)
                resolve(["paymentId": paymentId])
            } catch {
                reject("error", error.localizedDescription, error)
            }
        }
    }

    @objc(sendBolt11UsingAmount:amountMsat:resolver:rejecter:)
    func sendBolt11UsingAmount(_ invoice: String, amountMsat: Double, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let node = self.node else {
            reject("error", "Node not initialized", nil)
            return
        }

        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let bolt11 = node.bolt11Payment()
                let bolt11Invoice = try Bolt11Invoice.fromStr(invoiceStr: invoice)
                let paymentId = try bolt11.sendUsingAmount(invoice: bolt11Invoice, amountMsat: UInt64(amountMsat), routeParameters: nil)
                resolve(["paymentId": paymentId])
            } catch {
                reject("error", error.localizedDescription, error)
            }
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
            reject("error", error.localizedDescription, error)
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
            reject("error", error.localizedDescription, error)
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
            reject("error", error.localizedDescription, error)
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
                reject("error", error.localizedDescription, error)
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
                reject("error", error.localizedDescription, error)
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

    private func serializeClosureReason(_ reason: ClosureReason) -> String {
        switch reason {
        case .counterpartyForceClosed:
            return "counterpartyForceClosed"
        case .holderForceClosed:
            return "holderForceClosed"
        case .legacyCooperativeClosure:
            return "legacyCooperativeClosure"
        case .counterpartyInitiatedCooperativeClosure:
            return "counterpartyInitiatedCooperativeClosure"
        case .locallyInitiatedCooperativeClosure:
            return "locallyInitiatedCooperativeClosure"
        case .commitmentTxConfirmed:
            return "commitmentTxConfirmed"
        case .fundingTimedOut:
            return "fundingTimedOut"
        case .processingError:
            return "processingError"
        case .disconnectedPeer:
            return "disconnectedPeer"
        case .outdatedChannelManager:
            return "outdatedChannelManager"
        case .counterpartyCoopClosedUnfundedChannel:
            return "counterpartyCoopClosedUnfundedChannel"
        case .fundingBatchClosure:
            return "fundingBatchClosure"
        case .locallyCoopClosedUnfundedChannel:
            return "locallyCoopClosedUnfundedChannel"
        case .htlCsTimedOut:
            return "htlCsTimedOut"
        case .peerFeerateTooLow:
            return "peerFeerateTooLow"
        @unknown default:
            return "unknown"
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
        case .claimableAwaitingConfirmations(let channelId, let counterpartyNodeId, let amountSatoshis, let confirmationHeight, _):
            return [
                "type": "claimableAwaitingConfirmations",
                "channelId": channelId,
                "counterpartyNodeId": counterpartyNodeId,
                "amountSatoshis": amountSatoshis,
                "confirmationHeight": confirmationHeight
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
            return [
                "type": "onchain",
                "txid": txid,
                "status": serializeConfirmationStatus(status)
            ]
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
}
