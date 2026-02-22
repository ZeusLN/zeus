package app.zeusln.zeus

import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlinx.coroutines.*

import org.lightningdevkit.ldknode.*

class LdkNodeModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private var builder: Builder? = null
    private var node: Node? = null

    // Stored config values for building with custom Config
    private var storedNetwork: Network = Network.BITCOIN
    private var storedStorageDirPath: String = ""
    private var storedListeningAddresses: List<SocketAddress>? = null
    private var storedTrustedPeers0conf: List<PublicKey> = emptyList()

    // Stored builder settings (not part of Config)
    private var storedEsploraServerUrl: String? = null
    private var storedRgsServerUrl: String? = null
    private var storedLsps1NodeId: PublicKey? = null
    private var storedLsps1Address: SocketAddress? = null
    private var storedLsps1Token: String? = null
    private var storedLsps2NodeId: PublicKey? = null
    private var storedLsps2Address: SocketAddress? = null
    private var storedLsps2Token: String? = null

    override fun getName(): String {
        return "LdkNodeModule"
    }

    private fun resetStoredConfig() {
        storedNetwork = Network.BITCOIN
        storedStorageDirPath = ""
        storedListeningAddresses = null
        storedTrustedPeers0conf = emptyList()
        storedEsploraServerUrl = null
        storedRgsServerUrl = null
        storedLsps1NodeId = null
        storedLsps1Address = null
        storedLsps1Token = null
        storedLsps2NodeId = null
        storedLsps2Address = null
        storedLsps2Token = null
    }

    // Builder Methods

    @ReactMethod
    fun createBuilder(promise: Promise) {
        try {
            resetStoredConfig()
            builder = Builder()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("error", e.message, e)
        }
    }

    @ReactMethod
    fun setNetwork(network: String, promise: Promise) {
        try {
            val builder = this.builder ?: throw Exception("Builder not initialized")
            val networkEnum = when (network.lowercase()) {
                "bitcoin", "mainnet" -> Network.BITCOIN
                "testnet" -> Network.TESTNET
                "signet" -> Network.SIGNET
                "regtest" -> Network.REGTEST
                else -> throw Exception("Unknown network: $network")
            }
            this.storedNetwork = networkEnum
            builder.setNetwork(networkEnum)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("error", e.message, e)
        }
    }

    @ReactMethod
    fun setStorageDirPath(path: String, promise: Promise) {
        try {
            val builder = this.builder ?: throw Exception("Builder not initialized")
            this.storedStorageDirPath = path
            builder.setStorageDirPath(path)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("error", e.message, e)
        }
    }

    @ReactMethod
    fun setEsploraServer(serverUrl: String, promise: Promise) {
        try {
            val builder = this.builder ?: throw Exception("Builder not initialized")
            this.storedEsploraServerUrl = serverUrl
            builder.setChainSourceEsplora(serverUrl, null)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("error", e.message, e)
        }
    }

    @ReactMethod
    fun setGossipSourceRgs(rgsServerUrl: String, promise: Promise) {
        try {
            val builder = this.builder ?: throw Exception("Builder not initialized")
            this.storedRgsServerUrl = rgsServerUrl
            builder.setGossipSourceRgs(rgsServerUrl)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("error", e.message, e)
        }
    }

    @ReactMethod
    fun setGossipSourceP2p(promise: Promise) {
        try {
            val builder = this.builder ?: throw Exception("Builder not initialized")
            builder.setGossipSourceP2p()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("error", e.message, e)
        }
    }

    @ReactMethod
    fun setListeningAddresses(addresses: ReadableArray, promise: Promise) {
        try {
            val builder = this.builder ?: throw Exception("Builder not initialized")
            val addressList = mutableListOf<SocketAddress>()
            for (i in 0 until addresses.size()) {
                addresses.getString(i)?.let { addressList.add(it) }
            }
            this.storedListeningAddresses = addressList
            builder.setListeningAddresses(addressList)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("error", e.message, e)
        }
    }

    @ReactMethod
    fun setLiquiditySourceLsps1(nodeId: String, address: String, token: String?, promise: Promise) {
        try {
            val builder = this.builder ?: throw Exception("Builder not initialized")
            this.storedLsps1NodeId = nodeId
            this.storedLsps1Address = address
            this.storedLsps1Token = token
            builder.setLiquiditySourceLsps1(nodeId, address, token)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("error", e.message, e)
        }
    }

    @ReactMethod
    fun setLiquiditySourceLsps2(nodeId: String, address: String, token: String?, promise: Promise) {
        try {
            val builder = this.builder ?: throw Exception("Builder not initialized")
            this.storedLsps2NodeId = nodeId
            this.storedLsps2Address = address
            this.storedLsps2Token = token
            builder.setLiquiditySourceLsps2(nodeId, address, token)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("error", e.message, e)
        }
    }

    @ReactMethod
    fun setTrustedPeers0conf(peers: ReadableArray, promise: Promise) {
        try {
            this.builder ?: throw Exception("Builder not initialized")
            val peerList = mutableListOf<PublicKey>()
            for (i in 0 until peers.size()) {
                peers.getString(i)?.let { peerList.add(it) }
            }
            this.storedTrustedPeers0conf = peerList
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("error", e.message, e)
        }
    }

    // Mnemonic Methods

    @ReactMethod
    fun generateMnemonic(wordCount: Int, promise: Promise) {
        try {
            val wc = when (wordCount) {
                12 -> WordCount.WORDS12
                15 -> WordCount.WORDS15
                18 -> WordCount.WORDS18
                21 -> WordCount.WORDS21
                24 -> WordCount.WORDS24
                else -> WordCount.WORDS12
            }
            val mnemonic = generateEntropyMnemonic(wc)
            val result = Arguments.createMap().apply {
                putString("mnemonic", mnemonic.toString())
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("error", e.message, e)
        }
    }

    // Node Build Methods

    @ReactMethod
    fun buildNode(mnemonic: String, passphrase: String?, promise: Promise) {
        try {
            this.builder ?: throw Exception("Builder not initialized")

            // Always create a Config with anchor channels enabled to ensure proper channel type negotiation
            // Create AnchorChannelsConfig (required for LSP zero-conf anchor channels)
            val anchorConfig = AnchorChannelsConfig(
                trustedPeersNoReserve = this.storedTrustedPeers0conf,
                perChannelReserveSats = 25000UL
            )

            // Create a Config with anchorChannelsConfig always set
            val config = Config(
                storageDirPath = this.storedStorageDirPath,
                network = this.storedNetwork,
                listeningAddresses = this.storedListeningAddresses,
                announcementAddresses = null,
                nodeAlias = null,
                trustedPeers0conf = this.storedTrustedPeers0conf,
                probingLiquidityLimitMultiplier = 3UL,
                anchorChannelsConfig = anchorConfig,
                routeParameters = null
            )

            // Create builder from config to ensure anchor channels are enabled
            val builderToUse = Builder.fromConfig(config)

            // Re-apply builder-only settings
            this.storedEsploraServerUrl?.let { builderToUse.setChainSourceEsplora(it, null) }
            this.storedRgsServerUrl?.let { builderToUse.setGossipSourceRgs(it) }
            this.storedLsps1NodeId?.let { nodeId ->
                this.storedLsps1Address?.let { address ->
                    builderToUse.setLiquiditySourceLsps1(nodeId, address, this.storedLsps1Token)
                }
            }
            this.storedLsps2NodeId?.let { nodeId ->
                this.storedLsps2Address?.let { address ->
                    builderToUse.setLiquiditySourceLsps2(nodeId, address, this.storedLsps2Token)
                }
            }

            val nodeEntropy = NodeEntropy.fromBip39Mnemonic(mnemonic, passphrase)
            this.node = builderToUse.buildWithFsStore(nodeEntropy)
            this.builder = null // Builder is consumed
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("error", e.message, e)
        }
    }

    // Node Lifecycle Methods

    @ReactMethod
    fun start(promise: Promise) {
        GlobalScope.launch(Dispatchers.IO) {
            try {
                val node = this@LdkNodeModule.node ?: throw Exception("Node not initialized")
                node.start()
                withContext(Dispatchers.Main) {
                    promise.resolve(null)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("error", e.message, e)
                }
            }
        }
    }

    @ReactMethod
    fun stop(promise: Promise) {
        GlobalScope.launch(Dispatchers.IO) {
            try {
                val node = this@LdkNodeModule.node ?: throw Exception("Node not initialized")
                node.stop()
                withContext(Dispatchers.Main) {
                    promise.resolve(null)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("error", e.message, e)
                }
            }
        }
    }

    @ReactMethod
    fun syncWallets(promise: Promise) {
        GlobalScope.launch(Dispatchers.IO) {
            try {
                val node = this@LdkNodeModule.node ?: throw Exception("Node not initialized")
                node.syncWallets()
                withContext(Dispatchers.Main) {
                    promise.resolve(null)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("error", e.message, e)
                }
            }
        }
    }

    // Node Info Methods

    @ReactMethod
    fun nodeId(promise: Promise) {
        try {
            val node = this.node ?: throw Exception("Node not initialized")
            val nodeId = node.nodeId()
            val result = Arguments.createMap().apply {
                putString("nodeId", nodeId)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("error", e.message, e)
        }
    }

    @ReactMethod
    fun status(promise: Promise) {
        try {
            val node = this.node ?: throw Exception("Node not initialized")
            val status = node.status()
            val result = Arguments.createMap().apply {
                putBoolean("isRunning", status.isRunning)
                putDouble("currentBestBlock_height", status.currentBestBlock.height.toDouble())
                putString("currentBestBlock_hash", status.currentBestBlock.blockHash)
                status.latestLightningWalletSyncTimestamp?.let {
                    putDouble("latestLightningWalletSyncTimestamp", it.toDouble())
                }
                status.latestOnchainWalletSyncTimestamp?.let {
                    putDouble("latestOnchainWalletSyncTimestamp", it.toDouble())
                }
                status.latestFeeRateCacheUpdateTimestamp?.let {
                    putDouble("latestFeeRateCacheUpdateTimestamp", it.toDouble())
                }
                status.latestRgsSnapshotTimestamp?.let {
                    putDouble("latestRgsSnapshotTimestamp", it.toDouble())
                }
                status.latestNodeAnnouncementBroadcastTimestamp?.let {
                    putDouble("latestNodeAnnouncementBroadcastTimestamp", it.toDouble())
                }
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("error", e.message, e)
        }
    }

    @ReactMethod
    fun listBalances(promise: Promise) {
        try {
            val node = this.node ?: throw Exception("Node not initialized")
            val balances = node.listBalances()
            val result = Arguments.createMap().apply {
                putDouble("totalOnchainBalanceSats", balances.totalOnchainBalanceSats.toLong().toDouble())
                putDouble("spendableOnchainBalanceSats", balances.spendableOnchainBalanceSats.toLong().toDouble())
                putDouble("totalLightningBalanceSats", balances.totalLightningBalanceSats.toLong().toDouble())

                val lightningBalances = Arguments.createArray()
                for (balance in balances.lightningBalances) {
                    val balanceMap = Arguments.createMap()
                    when (balance) {
                        is LightningBalance.ClaimableOnChannelClose -> {
                            balanceMap.putString("type", "claimableOnChannelClose")
                            balanceMap.putString("channelId", balance.channelId)
                            balanceMap.putString("counterpartyNodeId", balance.counterpartyNodeId)
                            balanceMap.putDouble("amountSatoshis", balance.amountSatoshis.toLong().toDouble())
                            balanceMap.putDouble("transactionFeeSatoshis", balance.transactionFeeSatoshis.toLong().toDouble())
                            balanceMap.putDouble("outboundPaymentHtlcRoundedMsat", balance.outboundPaymentHtlcRoundedMsat.toLong().toDouble())
                            balanceMap.putDouble("outboundForwardedHtlcRoundedMsat", balance.outboundForwardedHtlcRoundedMsat.toLong().toDouble())
                            balanceMap.putDouble("inboundClaimingHtlcRoundedMsat", balance.inboundClaimingHtlcRoundedMsat.toLong().toDouble())
                            balanceMap.putDouble("inboundHtlcRoundedMsat", balance.inboundHtlcRoundedMsat.toLong().toDouble())
                        }
                        is LightningBalance.ClaimableAwaitingConfirmations -> {
                            balanceMap.putString("type", "claimableAwaitingConfirmations")
                            balanceMap.putString("channelId", balance.channelId)
                            balanceMap.putString("counterpartyNodeId", balance.counterpartyNodeId)
                            balanceMap.putDouble("amountSatoshis", balance.amountSatoshis.toLong().toDouble())
                            balanceMap.putDouble("confirmationHeight", balance.confirmationHeight.toDouble())
                        }
                        is LightningBalance.ContentiousClaimable -> {
                            balanceMap.putString("type", "contentiousClaimable")
                            balanceMap.putString("channelId", balance.channelId)
                            balanceMap.putString("counterpartyNodeId", balance.counterpartyNodeId)
                            balanceMap.putDouble("amountSatoshis", balance.amountSatoshis.toLong().toDouble())
                            balanceMap.putDouble("timeoutHeight", balance.timeoutHeight.toDouble())
                            balanceMap.putString("paymentHash", balance.paymentHash)
                            balanceMap.putString("paymentPreimage", balance.paymentPreimage)
                        }
                        is LightningBalance.MaybeTimeoutClaimableHtlc -> {
                            balanceMap.putString("type", "maybeTimeoutClaimableHtlc")
                            balanceMap.putString("channelId", balance.channelId)
                            balanceMap.putString("counterpartyNodeId", balance.counterpartyNodeId)
                            balanceMap.putDouble("amountSatoshis", balance.amountSatoshis.toLong().toDouble())
                            balanceMap.putDouble("claimableHeight", balance.claimableHeight.toDouble())
                            balanceMap.putString("paymentHash", balance.paymentHash)
                            balanceMap.putBoolean("outboundPayment", balance.outboundPayment)
                        }
                        is LightningBalance.MaybePreimageClaimableHtlc -> {
                            balanceMap.putString("type", "maybePreimageClaimableHtlc")
                            balanceMap.putString("channelId", balance.channelId)
                            balanceMap.putString("counterpartyNodeId", balance.counterpartyNodeId)
                            balanceMap.putDouble("amountSatoshis", balance.amountSatoshis.toLong().toDouble())
                            balanceMap.putDouble("expiryHeight", balance.expiryHeight.toDouble())
                            balanceMap.putString("paymentHash", balance.paymentHash)
                        }
                        is LightningBalance.CounterpartyRevokedOutputClaimable -> {
                            balanceMap.putString("type", "counterpartyRevokedOutputClaimable")
                            balanceMap.putString("channelId", balance.channelId)
                            balanceMap.putString("counterpartyNodeId", balance.counterpartyNodeId)
                            balanceMap.putDouble("amountSatoshis", balance.amountSatoshis.toLong().toDouble())
                        }
                    }
                    lightningBalances.pushMap(balanceMap)
                }
                putArray("lightningBalances", lightningBalances)

                val pendingBalancesFromChannelClosures = Arguments.createArray()
                for (pending in balances.pendingBalancesFromChannelClosures) {
                    val pendingMap = Arguments.createMap()
                    when (pending) {
                        is PendingSweepBalance.PendingBroadcast -> {
                            pendingMap.putString("type", "pendingBroadcast")
                            pendingMap.putString("channelId", pending.channelId)
                            pendingMap.putDouble("amountSatoshis", pending.amountSatoshis.toLong().toDouble())
                        }
                        is PendingSweepBalance.BroadcastAwaitingConfirmation -> {
                            pendingMap.putString("type", "broadcastAwaitingConfirmation")
                            pendingMap.putString("channelId", pending.channelId)
                            pendingMap.putDouble("latestBroadcastHeight", pending.latestBroadcastHeight.toDouble())
                            pendingMap.putString("latestSpendingTxid", pending.latestSpendingTxid)
                            pendingMap.putDouble("amountSatoshis", pending.amountSatoshis.toLong().toDouble())
                        }
                        is PendingSweepBalance.AwaitingThresholdConfirmations -> {
                            pendingMap.putString("type", "awaitingThresholdConfirmations")
                            pendingMap.putString("channelId", pending.channelId)
                            pendingMap.putString("latestSpendingTxid", pending.latestSpendingTxid)
                            pendingMap.putString("confirmationHash", pending.confirmationHash)
                            pendingMap.putDouble("confirmationHeight", pending.confirmationHeight.toDouble())
                            pendingMap.putDouble("amountSatoshis", pending.amountSatoshis.toLong().toDouble())
                        }
                    }
                    pendingBalancesFromChannelClosures.pushMap(pendingMap)
                }
                putArray("pendingBalancesFromChannelClosures", pendingBalancesFromChannelClosures)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("error", e.message, e)
        }
    }

    @ReactMethod
    fun networkGraphInfo(promise: Promise) {
        try {
            val node = this.node ?: throw Exception("Node not initialized")
            val graph = node.networkGraph()
            val channelCount = graph.listChannels().size
            val nodeCount = graph.listNodes().size
            val result = Arguments.createMap().apply {
                putInt("channelCount", channelCount)
                putInt("nodeCount", nodeCount)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("error", e.message, e)
        }
    }

    // Channel Methods

    @ReactMethod
    fun listChannels(promise: Promise) {
        try {
            val node = this.node ?: throw Exception("Node not initialized")
            val channels = node.listChannels()
            val result = Arguments.createArray()
            for (channel in channels) {
                val channelMap = Arguments.createMap().apply {
                    putString("channelId", channel.channelId)
                    putString("counterpartyNodeId", channel.counterpartyNodeId)
                    channel.fundingTxo?.let {
                        putString("fundingTxo_txid", it.txid)
                        putDouble("fundingTxo_vout", it.vout.toDouble())
                    }
                    putDouble("channelValueSats", channel.channelValueSats.toLong().toDouble())
                    channel.unspendablePunishmentReserve?.let {
                        putDouble("unspendablePunishmentReserve", it.toLong().toDouble())
                    }
                    putString("userChannelId", channel.userChannelId)
                    channel.feerateSatPer1000Weight?.let {
                        putDouble("feerateSatPer1000Weight", it.toDouble())
                    }
                    putDouble("outboundCapacityMsat", channel.outboundCapacityMsat.toLong().toDouble())
                    putDouble("inboundCapacityMsat", channel.inboundCapacityMsat.toLong().toDouble())
                    channel.confirmationsRequired?.let {
                        putDouble("confirmationsRequired", it.toDouble())
                    }
                    channel.confirmations?.let {
                        putDouble("confirmations", it.toDouble())
                    }
                    putBoolean("isOutbound", channel.isOutbound)
                    putBoolean("isChannelReady", channel.isChannelReady)
                    putBoolean("isUsable", channel.isUsable)
                    putBoolean("isAnnounced", channel.isAnnounced)
                    channel.cltvExpiryDelta?.let {
                        putDouble("cltvExpiryDelta", it.toDouble())
                    }
                    putDouble("counterpartyUnspendablePunishmentReserve", channel.counterpartyUnspendablePunishmentReserve.toLong().toDouble())
                    channel.counterpartyOutboundHtlcMinimumMsat?.let {
                        putDouble("counterpartyOutboundHtlcMinimumMsat", it.toLong().toDouble())
                    }
                    channel.counterpartyOutboundHtlcMaximumMsat?.let {
                        putDouble("counterpartyOutboundHtlcMaximumMsat", it.toLong().toDouble())
                    }
                    channel.counterpartyForwardingInfoFeeBaseMsat?.let {
                        putDouble("counterpartyForwardingInfoFeeBaseMsat", it.toDouble())
                    }
                    channel.counterpartyForwardingInfoFeeProportionalMillionths?.let {
                        putDouble("counterpartyForwardingInfoFeeProportionalMillionths", it.toDouble())
                    }
                    channel.counterpartyForwardingInfoCltvExpiryDelta?.let {
                        putDouble("counterpartyForwardingInfoCltvExpiryDelta", it.toDouble())
                    }
                    putDouble("nextOutboundHtlcLimitMsat", channel.nextOutboundHtlcLimitMsat.toLong().toDouble())
                    putDouble("nextOutboundHtlcMinimumMsat", channel.nextOutboundHtlcMinimumMsat.toLong().toDouble())
                    channel.forceCloseSpendDelay?.let {
                        putDouble("forceCloseSpendDelay", it.toDouble())
                    }
                    putDouble("inboundHtlcMinimumMsat", channel.inboundHtlcMinimumMsat.toLong().toDouble())
                    channel.inboundHtlcMaximumMsat?.let {
                        putDouble("inboundHtlcMaximumMsat", it.toLong().toDouble())
                    }
                }
                result.pushMap(channelMap)
            }
            val response = Arguments.createMap().apply {
                putArray("channels", result)
            }
            promise.resolve(response)
        } catch (e: Exception) {
            promise.reject("error", e.message, e)
        }
    }

    @ReactMethod
    fun openChannel(nodeId: String, address: String, channelAmountSats: Double, pushToCounterpartyMsat: Double?, announceChannel: Boolean, promise: Promise) {
        GlobalScope.launch(Dispatchers.IO) {
            try {
                val node = this@LdkNodeModule.node ?: throw Exception("Node not initialized")
                val pushMsat = pushToCounterpartyMsat?.let { it.toLong().toULong() }
                val userChannelId = if (announceChannel) {
                    node.openAnnouncedChannel(nodeId, address, channelAmountSats.toLong().toULong(), pushMsat, null)
                } else {
                    node.openChannel(nodeId, address, channelAmountSats.toLong().toULong(), pushMsat, null)
                }
                val result = Arguments.createMap().apply {
                    putString("userChannelId", userChannelId)
                }
                withContext(Dispatchers.Main) {
                    promise.resolve(result)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("error", e.message, e)
                }
            }
        }
    }

    @ReactMethod
    fun closeChannel(userChannelId: String, counterpartyNodeId: String, promise: Promise) {
        GlobalScope.launch(Dispatchers.IO) {
            try {
                val node = this@LdkNodeModule.node ?: throw Exception("Node not initialized")
                node.closeChannel(userChannelId, counterpartyNodeId)
                withContext(Dispatchers.Main) {
                    promise.resolve(null)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("error", e.message, e)
                }
            }
        }
    }

    // On-chain Methods

    @ReactMethod
    fun newOnchainAddress(promise: Promise) {
        try {
            val node = this.node ?: throw Exception("Node not initialized")
            val onchain = node.onchainPayment()
            val address = onchain.newAddress()
            val result = Arguments.createMap().apply {
                putString("address", address)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("error", e.message, e)
        }
    }

    @ReactMethod
    fun sendToOnchainAddress(address: String, amountSats: Double, promise: Promise) {
        GlobalScope.launch(Dispatchers.IO) {
            try {
                val node = this@LdkNodeModule.node ?: throw Exception("Node not initialized")
                val onchain = node.onchainPayment()
                val txid = onchain.sendToAddress(address, amountSats.toLong().toULong(), null)
                val result = Arguments.createMap().apply {
                    putString("txid", txid)
                }
                withContext(Dispatchers.Main) {
                    promise.resolve(result)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("error", e.message, e)
                }
            }
        }
    }

    @ReactMethod
    fun sendAllToOnchainAddress(address: String, promise: Promise) {
        GlobalScope.launch(Dispatchers.IO) {
            try {
                val node = this@LdkNodeModule.node ?: throw Exception("Node not initialized")
                val onchain = node.onchainPayment()
                val txid = onchain.sendAllToAddress(address, false, null)
                val result = Arguments.createMap().apply {
                    putString("txid", txid)
                }
                withContext(Dispatchers.Main) {
                    promise.resolve(result)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("error", e.message, e)
                }
            }
        }
    }

    // BOLT11 Payment Methods

    @ReactMethod
    fun receiveBolt11(amountMsat: Double, description: String, expirySecs: Double, promise: Promise) {
        try {
            val node = this.node ?: throw Exception("Node not initialized")
            val bolt11 = node.bolt11Payment()
            val invoiceDescription = Bolt11InvoiceDescription.Direct(description)
            val invoice = bolt11.receive(amountMsat.toLong().toULong(), invoiceDescription, expirySecs.toInt().toUInt())
            promise.resolve(mapOf("invoice" to invoice.toString()))
        } catch (e: Exception) {
            promise.reject("error", e.message, e)
        }
    }

    @ReactMethod
    fun receiveVariableAmountBolt11(description: String, expirySecs: Double, promise: Promise) {
        try {
            val node = this.node ?: throw Exception("Node not initialized")
            val bolt11 = node.bolt11Payment()
            val invoiceDescription = Bolt11InvoiceDescription.Direct(description)
            val invoice = bolt11.receiveVariableAmount(invoiceDescription, expirySecs.toInt().toUInt())
            promise.resolve(mapOf("invoice" to invoice.toString()))
        } catch (e: Exception) {
            promise.reject("error", e.message, e)
        }
    }

    @ReactMethod
    fun sendBolt11(invoice: String, promise: Promise) {
        GlobalScope.launch(Dispatchers.IO) {
            try {
                val node = this@LdkNodeModule.node ?: throw Exception("Node not initialized")
                val bolt11 = node.bolt11Payment()
                val invoiceObj = Bolt11Invoice.fromStr(invoice)
                val paymentId = bolt11.send(invoiceObj, null)
                val result = Arguments.createMap().apply {
                    putString("paymentId", paymentId)
                }
                withContext(Dispatchers.Main) {
                    promise.resolve(result)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("error", e.message, e)
                }
            }
        }
    }

    @ReactMethod
    fun sendBolt11UsingAmount(invoice: String, amountMsat: Double, promise: Promise) {
        GlobalScope.launch(Dispatchers.IO) {
            try {
                val node = this@LdkNodeModule.node ?: throw Exception("Node not initialized")
                val bolt11 = node.bolt11Payment()
                val invoiceObj = Bolt11Invoice.fromStr(invoice)
                val paymentId = bolt11.sendUsingAmount(invoiceObj, amountMsat.toLong().toULong(), null)
                val result = Arguments.createMap().apply {
                    putString("paymentId", paymentId)
                }
                withContext(Dispatchers.Main) {
                    promise.resolve(result)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("error", e.message, e)
                }
            }
        }
    }

    // Payment Methods

    @ReactMethod
    fun listPayments(promise: Promise) {
        try {
            val node = this.node ?: throw Exception("Node not initialized")
            val payments = node.listPayments()
            val result = Arguments.createArray()
            for (payment in payments) {
                val paymentMap = Arguments.createMap().apply {
                    putString("id", payment.id)

                    when (val kind = payment.kind) {
                        is PaymentKind.Onchain -> {
                            putString("kind", "onchain")
                        }
                        is PaymentKind.Bolt11 -> {
                            putString("kind", "bolt11")
                            putString("hash", kind.hash)
                            kind.preimage?.let { putString("preimage", it) }
                            kind.secret?.let { putString("secret", it) }
                        }
                        is PaymentKind.Bolt11Jit -> {
                            putString("kind", "bolt11Jit")
                            putString("hash", kind.hash)
                            kind.preimage?.let { putString("preimage", it) }
                            kind.secret?.let { putString("secret", it) }
                            kind.lspFeeLimits?.let {
                                putDouble("lspFeeLimits_maxTotalOpeningFeeMsat", it.maxTotalOpeningFeeMsat?.toLong()?.toDouble() ?: 0.0)
                                putDouble("lspFeeLimits_maxProportionalOpeningFeePpmMsat", it.maxProportionalOpeningFeePpmMsat?.toLong()?.toDouble() ?: 0.0)
                            }
                        }
                        is PaymentKind.Bolt12Offer -> {
                            putString("kind", "bolt12Offer")
                            putString("hash", kind.hash)
                            kind.preimage?.let { putString("preimage", it) }
                            kind.secret?.let { putString("secret", it) }
                            kind.offerId?.let { putString("offerId", it) }
                        }
                        is PaymentKind.Bolt12Refund -> {
                            putString("kind", "bolt12Refund")
                            putString("hash", kind.hash)
                            kind.preimage?.let { putString("preimage", it) }
                            kind.secret?.let { putString("secret", it) }
                        }
                        is PaymentKind.Spontaneous -> {
                            putString("kind", "spontaneous")
                            putString("hash", kind.hash)
                            kind.preimage?.let { putString("preimage", it) }
                        }
                    }

                    payment.amountMsat?.let { putDouble("amountMsat", it.toLong().toDouble()) }

                    when (val direction = payment.direction) {
                        PaymentDirection.INBOUND -> putString("direction", "inbound")
                        PaymentDirection.OUTBOUND -> putString("direction", "outbound")
                    }

                    when (val status = payment.status) {
                        PaymentStatus.PENDING -> putString("status", "pending")
                        PaymentStatus.SUCCEEDED -> putString("status", "succeeded")
                        PaymentStatus.FAILED -> putString("status", "failed")
                    }

                    putDouble("latestUpdateTimestamp", payment.latestUpdateTimestamp.toLong().toDouble())
                }
                result.pushMap(paymentMap)
            }
            val response = Arguments.createMap().apply {
                putArray("payments", result)
            }
            promise.resolve(response)
        } catch (e: Exception) {
            promise.reject("error", e.message, e)
        }
    }

    // Peer Methods

    @ReactMethod
    fun connect(nodeId: String, address: String, persist: Boolean, promise: Promise) {
        GlobalScope.launch(Dispatchers.IO) {
            try {
                val node = this@LdkNodeModule.node ?: throw Exception("Node not initialized")
                node.connect(nodeId, address, persist)
                withContext(Dispatchers.Main) {
                    promise.resolve(null)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("error", e.message, e)
                }
            }
        }
    }

    @ReactMethod
    fun disconnect(nodeId: String, promise: Promise) {
        GlobalScope.launch(Dispatchers.IO) {
            try {
                val node = this@LdkNodeModule.node ?: throw Exception("Node not initialized")
                node.disconnect(nodeId)
                withContext(Dispatchers.Main) {
                    promise.resolve(null)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("error", e.message, e)
                }
            }
        }
    }

    @ReactMethod
    fun listPeers(promise: Promise) {
        try {
            val node = this.node ?: throw Exception("Node not initialized")
            val peers = node.listPeers()
            val result = Arguments.createArray()
            for (peer in peers) {
                val peerMap = Arguments.createMap().apply {
                    putString("nodeId", peer.nodeId)
                    putString("address", peer.address)
                    putBoolean("isConnected", peer.isConnected)
                }
                result.pushMap(peerMap)
            }
            val response = Arguments.createMap().apply {
                putArray("peers", result)
            }
            promise.resolve(response)
        } catch (e: Exception) {
            promise.reject("error", e.message, e)
        }
    }

    // Event Methods

    @ReactMethod
    fun nextEvent(promise: Promise) {
        try {
            val node = this.node ?: throw Exception("Node not initialized")
            val event = node.nextEvent()
            val response = Arguments.createMap()
            if (event == null) {
                response.putNull("event")
            } else {
                response.putMap("event", eventToMap(event))
            }
            promise.resolve(response)
        } catch (e: Exception) {
            promise.reject("error", e.message, e)
        }
    }

    @ReactMethod
    fun waitNextEvent(promise: Promise) {
        GlobalScope.launch(Dispatchers.IO) {
            try {
                val node = this@LdkNodeModule.node ?: throw Exception("Node not initialized")
                val event = node.waitNextEvent()
                val response = Arguments.createMap().apply {
                    putMap("event", eventToMap(event))
                }
                withContext(Dispatchers.Main) {
                    promise.resolve(response)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("error", e.message, e)
                }
            }
        }
    }

    @ReactMethod
    fun eventHandled(promise: Promise) {
        try {
            val node = this.node ?: throw Exception("Node not initialized")
            node.eventHandled()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("error", e.message, e)
        }
    }

    private fun eventToMap(event: Event): WritableMap {
        val map = Arguments.createMap()
        when (event) {
            is Event.PaymentSuccessful -> {
                map.putString("type", "paymentSuccessful")
                map.putString("paymentId", event.paymentId)
                map.putString("paymentHash", event.paymentHash)
                event.feePaidMsat?.let { map.putDouble("feePaidMsat", it.toLong().toDouble()) }
            }
            is Event.PaymentFailed -> {
                map.putString("type", "paymentFailed")
                map.putString("paymentId", event.paymentId)
                map.putString("paymentHash", event.paymentHash)
                event.reason?.let { map.putString("reason", paymentFailureReasonToString(it)) }
            }
            is Event.PaymentReceived -> {
                map.putString("type", "paymentReceived")
                map.putString("paymentId", event.paymentId)
                map.putString("paymentHash", event.paymentHash)
                map.putDouble("amountMsat", event.amountMsat.toLong().toDouble())
            }
            is Event.PaymentClaimable -> {
                map.putString("type", "paymentClaimable")
                map.putString("paymentId", event.paymentId)
                map.putString("paymentHash", event.paymentHash)
                map.putDouble("claimableAmountMsat", event.claimableAmountMsat.toLong().toDouble())
                event.claimDeadline?.let { map.putDouble("claimDeadline", it.toDouble()) }
            }
            is Event.PaymentForwarded -> {
                map.putString("type", "paymentForwarded")
                map.putString("prevChannelId", event.prevChannelId)
                map.putString("nextChannelId", event.nextChannelId)
                event.prevUserChannelId?.let { map.putString("prevUserChannelId", it) }
                event.nextUserChannelId?.let { map.putString("nextUserChannelId", it) }
                event.prevNodeId?.let { map.putString("prevNodeId", it) }
                event.nextNodeId?.let { map.putString("nextNodeId", it) }
                event.totalFeeEarnedMsat?.let { map.putDouble("totalFeeEarnedMsat", it.toLong().toDouble()) }
                event.skimmedFeeMsat?.let { map.putDouble("skimmedFeeMsat", it.toLong().toDouble()) }
                map.putBoolean("claimFromOnchainTx", event.claimFromOnchainTx)
                event.outboundAmountForwardedMsat?.let { map.putDouble("outboundAmountForwardedMsat", it.toLong().toDouble()) }
            }
            is Event.ChannelPending -> {
                map.putString("type", "channelPending")
                map.putString("channelId", event.channelId)
                map.putString("userChannelId", event.userChannelId)
                map.putString("formerTemporaryChannelId", event.formerTemporaryChannelId)
                map.putString("counterpartyNodeId", event.counterpartyNodeId)
                map.putString("fundingTxo_txid", event.fundingTxo.txid)
                map.putDouble("fundingTxo_vout", event.fundingTxo.vout.toDouble())
            }
            is Event.ChannelReady -> {
                map.putString("type", "channelReady")
                map.putString("channelId", event.channelId)
                map.putString("userChannelId", event.userChannelId)
                event.counterpartyNodeId?.let { map.putString("counterpartyNodeId", it) }
                event.fundingTxo?.let {
                    map.putString("fundingTxo_txid", it.txid)
                    map.putDouble("fundingTxo_vout", it.vout.toDouble())
                }
            }
            is Event.ChannelClosed -> {
                map.putString("type", "channelClosed")
                map.putString("channelId", event.channelId)
                map.putString("userChannelId", event.userChannelId)
                event.counterpartyNodeId?.let { map.putString("counterpartyNodeId", it) }
                event.reason?.let { map.putString("reason", closureReasonToString(it)) }
            }
            is Event.SplicePending -> {
                map.putString("type", "splicePending")
                map.putString("channelId", event.channelId)
                map.putString("userChannelId", event.userChannelId)
                map.putString("counterpartyNodeId", event.counterpartyNodeId)
                map.putString("newFundingTxo_txid", event.newFundingTxo.txid)
                map.putDouble("newFundingTxo_vout", event.newFundingTxo.vout.toDouble())
            }
            is Event.SpliceFailed -> {
                map.putString("type", "spliceFailed")
                map.putString("channelId", event.channelId)
                map.putString("userChannelId", event.userChannelId)
                map.putString("counterpartyNodeId", event.counterpartyNodeId)
                event.abandonedFundingTxo?.let {
                    map.putString("abandonedFundingTxo_txid", it.txid)
                    map.putDouble("abandonedFundingTxo_vout", it.vout.toDouble())
                }
            }
        }
        return map
    }

    private fun paymentFailureReasonToString(reason: PaymentFailureReason): String {
        return when (reason) {
            PaymentFailureReason.RECIPIENT_REJECTED -> "recipientRejected"
            PaymentFailureReason.USER_ABANDONED -> "userAbandoned"
            PaymentFailureReason.RETRIES_EXHAUSTED -> "retriesExhausted"
            PaymentFailureReason.PAYMENT_EXPIRED -> "paymentExpired"
            PaymentFailureReason.ROUTE_NOT_FOUND -> "routeNotFound"
            PaymentFailureReason.UNEXPECTED_ERROR -> "unexpectedError"
            PaymentFailureReason.UNKNOWN_REQUIRED_FEATURES -> "unknownRequiredFeatures"
            PaymentFailureReason.INVOICE_REQUEST_EXPIRED -> "invoiceRequestExpired"
            PaymentFailureReason.INVOICE_REQUEST_REJECTED -> "invoiceRequestRejected"
            PaymentFailureReason.BLINDED_PATH_CREATION_FAILED -> "blindedPathCreationFailed"
        }
    }

    private fun closureReasonToString(reason: ClosureReason): String {
        return when (reason) {
            is ClosureReason.CounterpartyForceClosed -> "counterpartyForceClosed"
            is ClosureReason.HolderForceClosed -> "holderForceClosed"
            is ClosureReason.LegacyCooperativeClosure -> "legacyCooperativeClosure"
            is ClosureReason.CounterpartyInitiatedCooperativeClosure -> "counterpartyInitiatedCooperativeClosure"
            is ClosureReason.LocallyInitiatedCooperativeClosure -> "locallyInitiatedCooperativeClosure"
            is ClosureReason.CommitmentTxConfirmed -> "commitmentTxConfirmed"
            is ClosureReason.FundingTimedOut -> "fundingTimedOut"
            is ClosureReason.ProcessingError -> "processingError"
            is ClosureReason.DisconnectedPeer -> "disconnectedPeer"
            is ClosureReason.OutdatedChannelManager -> "outdatedChannelManager"
            is ClosureReason.CounterpartyCoopClosedUnfundedChannel -> "counterpartyCoopClosedUnfundedChannel"
            is ClosureReason.LocallyCoopClosedUnfundedChannel -> "locallyCoopClosedUnfundedChannel"
            is ClosureReason.FundingBatchClosure -> "fundingBatchClosure"
            is ClosureReason.HtlCsTimedOut -> "htlcsTimedOut"
            is ClosureReason.PeerFeerateTooLow -> "peerFeerateTooLow"
        }
    }

    // LSPS1 Methods

    @ReactMethod
    fun lsps1RequestChannel(lspBalanceSat: Double, clientBalanceSat: Double, channelExpiryBlocks: Double, announceChannel: Boolean, promise: Promise) {
        GlobalScope.launch(Dispatchers.IO) {
            try {
                val node = this@LdkNodeModule.node ?: throw Exception("Node not initialized")
                val lsps1 = node.lsps1Liquidity()
                val response = lsps1.requestChannel(
                    lspBalanceSat.toLong().toULong(),
                    clientBalanceSat.toLong().toULong(),
                    channelExpiryBlocks.toInt().toUInt(),
                    announceChannel
                )
                withContext(Dispatchers.Main) {
                    promise.resolve(lsps1OrderResponseToMap(response))
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("error", e.message, e)
                }
            }
        }
    }

    @ReactMethod
    fun lsps1CheckOrderStatus(orderId: String, promise: Promise) {
        GlobalScope.launch(Dispatchers.IO) {
            try {
                val node = this@LdkNodeModule.node ?: throw Exception("Node not initialized")
                val lsps1 = node.lsps1Liquidity()
                val response = lsps1.checkOrderStatus(orderId)
                withContext(Dispatchers.Main) {
                    promise.resolve(lsps1OrderStatusToMap(response))
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("error", e.message, e)
                }
            }
        }
    }

    private fun lsps1OrderResponseToMap(response: Lsps1OrderResponse): WritableMap {
        val map = Arguments.createMap()
        map.putString("orderId", response.orderId)
        map.putMap("orderParams", lsps1OrderParamsToMap(response.orderParams))
        map.putMap("paymentInfo", lsps1PaymentInfoToMap(response.paymentInfo))
        response.channelInfo?.let { map.putMap("channelInfo", lsps1ChannelInfoToMap(it)) }
        return map
    }

    private fun lsps1OrderStatusToMap(response: Lsps1OrderStatus): WritableMap {
        val map = Arguments.createMap()
        map.putString("orderId", response.orderId)
        map.putMap("orderParams", lsps1OrderParamsToMap(response.orderParams))
        map.putMap("paymentInfo", lsps1PaymentInfoToMap(response.paymentInfo))
        response.channelInfo?.let { map.putMap("channelInfo", lsps1ChannelInfoToMap(it)) }
        return map
    }

    private fun lsps1OrderParamsToMap(params: Lsps1OrderParams): WritableMap {
        val map = Arguments.createMap()
        map.putDouble("lspBalanceSat", params.lspBalanceSat.toLong().toDouble())
        map.putDouble("clientBalanceSat", params.clientBalanceSat.toLong().toDouble())
        map.putDouble("requiredChannelConfirmations", params.requiredChannelConfirmations.toDouble())
        map.putDouble("fundingConfirmsWithinBlocks", params.fundingConfirmsWithinBlocks.toDouble())
        map.putDouble("channelExpiryBlocks", params.channelExpiryBlocks.toDouble())
        map.putString("token", params.token ?: "")
        map.putBoolean("announceChannel", params.announceChannel)
        return map
    }

    private fun lsps1PaymentInfoToMap(info: Lsps1PaymentInfo): WritableMap {
        val map = Arguments.createMap()
        map.putString("state", lsps1PaymentStateToString(info.state))
        map.putDouble("feeTotalSat", info.feeTotalSat.toLong().toDouble())
        map.putDouble("orderTotalSat", info.orderTotalSat.toLong().toDouble())

        val bolt11Map = Arguments.createMap()
        bolt11Map.putString("invoice", info.bolt11Invoice.invoice)
        bolt11Map.putDouble("feeTotalSat", info.bolt11Invoice.feeTotalSat.toLong().toDouble())
        bolt11Map.putDouble("orderTotalSat", info.bolt11Invoice.orderTotalSat.toLong().toDouble())
        bolt11Map.putString("state", lsps1PaymentStateToString(info.bolt11Invoice.state))
        map.putMap("bolt11Invoice", bolt11Map)

        info.onchainPayment?.let { onchain ->
            val onchainMap = Arguments.createMap()
            onchainMap.putString("address", onchain.address)
            onchainMap.putDouble("feeTotalSat", onchain.feeTotalSat.toLong().toDouble())
            onchainMap.putDouble("orderTotalSat", onchain.orderTotalSat.toLong().toDouble())
            onchainMap.putDouble("minimumFeeSat", onchain.minimumFeeSat.toLong().toDouble())
            onchainMap.putString("state", lsps1PaymentStateToString(onchain.state))
            onchain.confirmsWithinBlocks?.let { onchainMap.putDouble("confirmsWithinBlocks", it.toDouble()) }
            map.putMap("onchainPayment", onchainMap)
        }

        return map
    }

    private fun lsps1ChannelInfoToMap(info: Lsps1ChannelInfo): WritableMap {
        val map = Arguments.createMap()
        map.putString("fundingTxid", info.fundingTxid)
        map.putDouble("fundingTxVout", info.fundingTxVout.toDouble())
        map.putString("fundingOutpointIndex", info.fundingTxVout.toString())
        map.putDouble("expiresAt", info.expiresAt.toDouble())
        return map
    }

    private fun lsps1PaymentStateToString(state: Lsps1PaymentState): String {
        return when (state) {
            Lsps1PaymentState.EXPECTED_PAYMENT -> "expectedPayment"
            Lsps1PaymentState.HOLD -> "hold"
            Lsps1PaymentState.PAID -> "paid"
            Lsps1PaymentState.REFUNDED -> "refunded"
            Lsps1PaymentState.REFUND_PENDING -> "refundPending"
            Lsps1PaymentState.OVERPAID_REFUND_PENDING -> "overpaidRefundPending"
        }
    }

    // Message Signing Methods

    @ReactMethod
    fun signMessage(message: String, promise: Promise) {
        try {
            val node = this.node ?: throw Exception("Node not initialized")
            val messageBytes = message.toByteArray(Charsets.UTF_8).toList()
            val signature = node.signMessage(messageBytes)
            val result = Arguments.createMap().apply {
                putString("signature", signature)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("error", e.message, e)
        }
    }

    @ReactMethod
    fun verifySignature(message: String, signature: String, publicKey: String, promise: Promise) {
        try {
            val node = this.node ?: throw Exception("Node not initialized")
            val messageBytes = message.toByteArray(Charsets.UTF_8).toList()
            val pubkey = PublicKey(publicKey)
            val isValid = node.verifySignature(messageBytes, signature, pubkey)
            val result = Arguments.createMap().apply {
                putBoolean("valid", isValid)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("error", e.message, e)
        }
    }
}
