package app.zeusln.zeus

import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlinx.coroutines.*

import org.lightningdevkit.ldknode.*

class LdkNodeModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private val moduleScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private var builder: Builder? = null
    private var node: Node? = null
    private var logFileObserver: LogFileObserver? = null

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
    private var storedLsps7NodeId: PublicKey? = null
    private var storedLsps7Address: SocketAddress? = null
    private var storedLsps7Token: String? = null

    // VSS (Versioned Storage Service) config
    private var storedVssUrl: String? = null
    private var storedVssStoreId: String? = null
    private var storedVssHeaders: Map<String, String> = emptyMap()

    override fun getName(): String {
        return "LdkNodeModule"
    }

    override fun onCatalystInstanceDestroy() {
        moduleScope.cancel()
        super.onCatalystInstanceDestroy()
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
        storedLsps7NodeId = null
        storedLsps7Address = null
        storedLsps7Token = null
        storedVssUrl = null
        storedVssStoreId = null
        storedVssHeaders = emptyMap()
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
            builder.setChainSourceEsplora(serverUrl, createEsploraSyncConfig())
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
    fun setLiquiditySourceLsps7(nodeId: String, address: String, token: String?, promise: Promise) {
        try {
            this.builder ?: throw Exception("Builder not initialized")
            this.storedLsps7NodeId = nodeId
            this.storedLsps7Address = address
            this.storedLsps7Token = token
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

    @ReactMethod
    fun setVssServer(vssUrl: String, storeId: String, headers: ReadableMap?, promise: Promise) {
        try {
            this.builder ?: throw Exception("Builder not initialized")
            this.storedVssUrl = vssUrl
            this.storedVssStoreId = storeId
            if (headers != null) {
                val headerMap = mutableMapOf<String, String>()
                val iter = headers.keySetIterator()
                while (iter.hasNextKey()) {
                    val key = iter.nextKey()
                    headers.getString(key)?.let { headerMap[key] = it }
                }
                this.storedVssHeaders = headerMap
            } else {
                this.storedVssHeaders = emptyMap()
            }
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
        moduleScope.launch {
            try {
                this@LdkNodeModule.builder ?: throw Exception("Builder not initialized")

                // Always create a Config with anchor channels enabled to ensure proper channel type negotiation
                // Create AnchorChannelsConfig (required for LSP zero-conf anchor channels)
                val anchorConfig = AnchorChannelsConfig(
                    trustedPeersNoReserve = this@LdkNodeModule.storedTrustedPeers0conf,
                    perChannelReserveSats = 25000UL
                )

                // Create a Config with anchorChannelsConfig always set
                val config = Config(
                    storageDirPath = this@LdkNodeModule.storedStorageDirPath,
                    network = this@LdkNodeModule.storedNetwork,
                    listeningAddresses = this@LdkNodeModule.storedListeningAddresses,
                    announcementAddresses = null,
                    nodeAlias = null,
                    trustedPeers0conf = this@LdkNodeModule.storedTrustedPeers0conf,
                    probingLiquidityLimitMultiplier = 3UL,
                    anchorChannelsConfig = anchorConfig,
                    routeParameters = null
                )

                val nodeEntropy = NodeEntropy.fromBip39Mnemonic(mnemonic, passphrase)
                val vssUrl = this@LdkNodeModule.storedVssUrl
                val vssStoreId = this@LdkNodeModule.storedVssStoreId

                var vssError: String? = null

                if (vssUrl != null && vssStoreId != null) {
                    try {
                        Log.d("LdkNodeModule", "Building node with VSS store: $vssUrl")
                        val vssBuilder = Builder.fromConfig(config)
                        applyBuilderSettings(vssBuilder)

                        // Use a real thread + CountDownLatch since the native JNI call
                        // blocks and doesn't cooperate with coroutine cancellation
                        var vssNode: Node? = null
                        var vssBuildError: Exception? = null
                        val latch = java.util.concurrent.CountDownLatch(1)

                        val vssThread = Thread {
                            try {
                                vssNode = vssBuilder.buildWithVssStoreAndFixedHeaders(nodeEntropy, vssUrl, vssStoreId, this@LdkNodeModule.storedVssHeaders)
                            } catch (e: Exception) {
                                vssBuildError = e
                            }
                            latch.countDown()
                        }
                        vssThread.start()

                        val completed = latch.await(60, java.util.concurrent.TimeUnit.SECONDS)
                        if (!completed) {
                            vssError = "VSS server at $vssUrl did not respond within 60s"
                            Log.e("LdkNodeModule", "buildNode: $vssError")
                        } else if (vssBuildError != null) {
                            throw vssBuildError!!
                        } else {
                            this@LdkNodeModule.node = vssNode
                            Log.d("LdkNodeModule", "Node built with VSS store successfully")
                        }
                    } catch (e: Exception) {
                        vssError = "VSS setup failed: ${e.message}"
                        Log.e("LdkNodeModule", "buildNode: $vssError", e)
                    }
                }

                // Fall back to local filesystem store if VSS failed or was not configured
                if (this@LdkNodeModule.node == null) {
                    if (vssError != null) {
                        Log.w("LdkNodeModule", "Falling back to local filesystem store")
                    }
                    val fsBuilder = Builder.fromConfig(config)
                    applyBuilderSettings(fsBuilder)
                    this@LdkNodeModule.node = fsBuilder.buildWithFsStore(nodeEntropy)
                }

                this@LdkNodeModule.builder = null // Builder is consumed
                val result = Arguments.createMap()
                if (vssError != null) {
                    result.putString("vssError", vssError)
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

    private fun applyBuilderSettings(builder: Builder) {
        this.storedEsploraServerUrl?.let {
            Log.d("LdkNodeModule", "applyBuilderSettings: Esplora server = $it")
            builder.setChainSourceEsplora(it, createEsploraSyncConfig())
        }
        this.storedRgsServerUrl?.let {
            Log.d("LdkNodeModule", "applyBuilderSettings: RGS server = $it")
            builder.setGossipSourceRgs(it)
        }
        this.storedLsps1NodeId?.let { nodeId ->
            this.storedLsps1Address?.let { address ->
                builder.setLiquiditySourceLsps1(nodeId, address, this.storedLsps1Token)
            }
        }
        this.storedLsps2NodeId?.let { nodeId ->
            this.storedLsps2Address?.let { address ->
                builder.setLiquiditySourceLsps2(nodeId, address, this.storedLsps2Token)
            }
        }
        this.storedLsps7NodeId?.let { nodeId ->
            this.storedLsps7Address?.let { address ->
                builder.setLiquiditySourceLsps7(nodeId, address, this.storedLsps7Token)
            }
        }

        // Enable filesystem logging
        if (this.storedStorageDirPath.isNotEmpty()) {
            Log.d("LdkNodeModule", "applyBuilderSettings: Enabling filesystem logger")
            builder.setFilesystemLogger("${this.storedStorageDirPath}/ldk_node.log", LogLevel.DEBUG)
        }
    }

    private fun createEsploraSyncConfig(): EsploraSyncConfig {
        return EsploraSyncConfig(
            backgroundSyncConfig = BackgroundSyncConfig(
                onchainWalletSyncIntervalSecs = 60UL,
                lightningWalletSyncIntervalSecs = 60UL,
                feeRateCacheUpdateIntervalSecs = 600UL
            )
        )
    }

    // Node Lifecycle Methods

    @ReactMethod
    fun start(promise: Promise) {
        moduleScope.launch {
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
        moduleScope.launch {
            try {
                val node = this@LdkNodeModule.node ?: throw Exception("Node not initialized")
                node.stop()
                this@LdkNodeModule.logFileObserver?.stopObserving()
                this@LdkNodeModule.logFileObserver = null
                this@LdkNodeModule.node = null
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
        moduleScope.launch {
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
                putDouble("totalAnchorChannelsReserveSats", balances.totalAnchorChannelsReserveSats.toLong().toDouble())
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
                            balanceMap.putString("source", when (balance.source) {
                                BalanceSource.HOLDER_FORCE_CLOSED -> "holderForceClosed"
                                BalanceSource.COUNTERPARTY_FORCE_CLOSED -> "counterpartyForceClosed"
                                BalanceSource.COOP_CLOSE -> "coopClose"
                                BalanceSource.HTLC -> "htlc"
                            })
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

    @ReactMethod
    fun resetNetworkGraph(promise: Promise) {
        moduleScope.launch {
            try {
                val node = this@LdkNodeModule.node ?: throw Exception("Node not initialized")
                node.resetNetworkGraph()
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
    fun updateRgsSnapshot(promise: Promise) {
        moduleScope.launch {
            try {
                val node = this@LdkNodeModule.node ?: throw Exception("Node not initialized")
                val timestamp = node.updateRgsSnapshot()
                val result = Arguments.createMap().apply {
                    putDouble("timestamp", timestamp.toLong().toDouble())
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
        moduleScope.launch {
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
        moduleScope.launch {
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
        moduleScope.launch {
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
    fun sendAllToOnchainAddress(address: String, retainReserve: Boolean, promise: Promise) {
        moduleScope.launch {
            try {
                val node = this@LdkNodeModule.node ?: throw Exception("Node not initialized")
                val onchain = node.onchainPayment()
                val txid = onchain.sendAllToAddress(address, retainReserve, null)
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
            val result = Arguments.createMap().apply { putString("invoice", invoice.toString()) }
            promise.resolve(result)
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
            val result = Arguments.createMap().apply { putString("invoice", invoice.toString()) }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("error", e.message, e)
        }
    }

    @ReactMethod
    fun sendBolt11(invoice: String, promise: Promise) {
        moduleScope.launch {
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
        moduleScope.launch {
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

    // Spontaneous Payment Methods

    @ReactMethod
    fun sendSpontaneousPayment(nodeId: String, amountMsat: Double, promise: Promise) {
        moduleScope.launch {
            try {
                val node = this@LdkNodeModule.node ?: throw Exception("Node not initialized")
                val paymentId = node.spontaneousPayment().send(amountMsat.toLong().toULong(), nodeId, null)
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

    // BOLT12 Payment Methods

    @ReactMethod
    fun bolt12Receive(amountMsat: Double, description: String, expirySecs: Double, promise: Promise) {
        try {
            val node = this.node ?: throw Exception("Node not initialized")
            val bolt12 = node.bolt12Payment()
            val expiry = if (expirySecs > 0) expirySecs.toInt().toUInt() else null
            val offer = bolt12.receive(amountMsat.toLong().toULong(), description, expiry, null)
            val result = Arguments.createMap().apply {
                putString("offer", offer.toString())
                putString("offerId", offer.id())
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("error", e.message, e)
        }
    }

    @ReactMethod
    fun bolt12ReceiveVariableAmount(description: String, expirySecs: Double, promise: Promise) {
        try {
            val node = this.node ?: throw Exception("Node not initialized")
            val bolt12 = node.bolt12Payment()
            val expiry = if (expirySecs > 0) expirySecs.toInt().toUInt() else null
            val offer = bolt12.receiveVariableAmount(description, expiry)
            val result = Arguments.createMap().apply {
                putString("offer", offer.toString())
                putString("offerId", offer.id())
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("error", e.message, e)
        }
    }

    @ReactMethod
    fun bolt12Send(offerStr: String, payerNote: String?, promise: Promise) {
        moduleScope.launch {
            try {
                val node = this@LdkNodeModule.node ?: throw Exception("Node not initialized")
                val bolt12 = node.bolt12Payment()
                val offer = Offer.fromStr(offerStr)
                val paymentId = bolt12.send(offer, null, payerNote, null)
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
    fun bolt12SendUsingAmount(offerStr: String, amountMsat: Double, payerNote: String?, promise: Promise) {
        moduleScope.launch {
            try {
                val node = this@LdkNodeModule.node ?: throw Exception("Node not initialized")
                val bolt12 = node.bolt12Payment()
                val offer = Offer.fromStr(offerStr)
                val paymentId = bolt12.sendUsingAmount(offer, amountMsat.toLong().toULong(), null, payerNote, null)
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
    fun bolt12InitiateRefund(amountMsat: Double, expirySecs: Double, promise: Promise) {
        try {
            val node = this.node ?: throw Exception("Node not initialized")
            val bolt12 = node.bolt12Payment()
            val refund = bolt12.initiateRefund(amountMsat.toLong().toULong(), expirySecs.toInt().toUInt(), null, null, null)
            val result = Arguments.createMap().apply { putString("refund", refund.toString()) }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("error", e.message, e)
        }
    }

    @ReactMethod
    fun bolt12RequestRefundPayment(refundStr: String, promise: Promise) {
        try {
            val node = this.node ?: throw Exception("Node not initialized")
            val bolt12 = node.bolt12Payment()
            val refund = Refund.fromStr(refundStr)
            val invoice = bolt12.requestRefundPayment(refund)
            val result = Arguments.createMap().apply { putString("invoice", invoice.toString()) }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("error", e.message, e)
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
                    putMap("kind", serializePaymentKind(payment.kind))

                    payment.amountMsat?.let { putDouble("amountMsat", it.toLong().toDouble()) }

                    when (payment.direction) {
                        PaymentDirection.INBOUND -> putString("direction", "inbound")
                        PaymentDirection.OUTBOUND -> putString("direction", "outbound")
                    }

                    when (payment.status) {
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
        moduleScope.launch {
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
        moduleScope.launch {
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
        moduleScope.launch {
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

    private fun serializePaymentKind(kind: PaymentKind): WritableMap {
        return Arguments.createMap().apply {
            when (kind) {
                is PaymentKind.Onchain -> {
                    putString("type", "onchain")
                    putString("txid", kind.txid)
                    putString("status", when (kind.status) {
                        is ConfirmationStatus.Confirmed -> "confirmed"
                        is ConfirmationStatus.Unconfirmed -> "unconfirmed"
                    })
                    if (kind.status is ConfirmationStatus.Confirmed) {
                        val confirmed = kind.status as ConfirmationStatus.Confirmed
                        putDouble("confirmationHeight", confirmed.height.toDouble())
                        putDouble("confirmationTimestamp", confirmed.timestamp.toLong().toDouble())
                    }
                }
                is PaymentKind.Bolt11 -> {
                    putString("type", "bolt11")
                    putString("hash", kind.hash)
                    kind.preimage?.let { putString("preimage", it) }
                    kind.secret?.let { putString("secret", it) }
                }
                is PaymentKind.Bolt11Jit -> {
                    putString("type", "bolt11Jit")
                    putString("hash", kind.hash)
                    kind.preimage?.let { putString("preimage", it) }
                    kind.secret?.let { putString("secret", it) }
                    kind.counterpartySkimmedFeeMsat?.let { putDouble("counterpartySkimmedFeeMsat", it.toLong().toDouble()) }
                    kind.lspFeeLimits?.let {
                        val limitsMap = Arguments.createMap().apply {
                            it.maxTotalOpeningFeeMsat?.let { v -> putDouble("maxTotalOpeningFeeMsat", v.toLong().toDouble()) }
                            it.maxProportionalOpeningFeePpmMsat?.let { v -> putDouble("maxProportionalOpeningFeePpmMsat", v.toLong().toDouble()) }
                        }
                        putMap("lspFeeLimits", limitsMap)
                    }
                }
                is PaymentKind.Bolt12Offer -> {
                    putString("type", "bolt12Offer")
                    kind.hash?.let { putString("hash", it) }
                    kind.preimage?.let { putString("preimage", it) }
                    kind.secret?.let { putString("secret", it) }
                    putString("offerId", kind.offerId)
                    kind.payerNote?.let { putString("payerNote", it) }
                    kind.quantity?.let { putDouble("quantity", it.toLong().toDouble()) }
                }
                is PaymentKind.Bolt12Refund -> {
                    putString("type", "bolt12Refund")
                    kind.hash?.let { putString("hash", it) }
                    kind.preimage?.let { putString("preimage", it) }
                    kind.secret?.let { putString("secret", it) }
                    kind.payerNote?.let { putString("payerNote", it) }
                    kind.quantity?.let { putDouble("quantity", it.toLong().toDouble()) }
                }
                is PaymentKind.Spontaneous -> {
                    putString("type", "spontaneous")
                    putString("hash", kind.hash)
                    kind.preimage?.let { putString("preimage", it) }
                }
            }
        }
    }

    private fun eventToMap(event: Event): WritableMap {
        val map = Arguments.createMap()
        when (event) {
            is Event.PaymentSuccessful -> {
                map.putString("type", "paymentSuccessful")
                map.putString("paymentId", event.paymentId)
                map.putString("paymentHash", event.paymentHash)
                event.paymentPreimage?.let { map.putString("paymentPreimage", it) }
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
        moduleScope.launch {
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
                    promise.resolve(lsps1OrderStatusToMap(response))
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
        moduleScope.launch {
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

    private fun lsps1OrderStatusToMap(response: Lsps1OrderStatus): WritableMap {
        val map = Arguments.createMap()
        map.putString("orderId", response.orderId)
        map.putMap("orderParams", lsps1OrderParamsToMap(response.orderParams))
        map.putMap("paymentInfo", lsps1PaymentInfoToMap(response.paymentOptions))
        response.channelState?.let { map.putMap("channelInfo", lsps1ChannelInfoToMap(it)) }
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

        info.bolt11?.let { bolt11 ->
            val bolt11Map = Arguments.createMap()
            bolt11Map.putString("state", lsps1PaymentStateToString(bolt11.state))
            bolt11Map.putString("expiresAt", bolt11.expiresAt)
            bolt11Map.putDouble("feeTotalSat", bolt11.feeTotalSat.toLong().toDouble())
            bolt11Map.putDouble("orderTotalSat", bolt11.orderTotalSat.toLong().toDouble())
            bolt11Map.putString("invoice", bolt11.invoice.toString())
            map.putMap("bolt11Invoice", bolt11Map)
            // Promote state/fees from bolt11
            map.putString("state", lsps1PaymentStateToString(bolt11.state))
            map.putDouble("feeTotalSat", bolt11.feeTotalSat.toLong().toDouble())
            map.putDouble("orderTotalSat", bolt11.orderTotalSat.toLong().toDouble())
        }

        info.onchain?.let { onchain ->
            val onchainMap = Arguments.createMap()
            onchainMap.putString("state", lsps1PaymentStateToString(onchain.state))
            onchainMap.putString("expiresAt", onchain.expiresAt)
            onchainMap.putDouble("feeTotalSat", onchain.feeTotalSat.toLong().toDouble())
            onchainMap.putDouble("orderTotalSat", onchain.orderTotalSat.toLong().toDouble())
            onchainMap.putString("address", onchain.address)
            onchain.minOnchainPaymentConfirmations?.let { onchainMap.putDouble("minOnchainPaymentConfirmations", it.toDouble()) }
            onchainMap.putDouble("minFeeFor0conf", onchain.minFeeFor0conf.toSatPerKwu().toDouble())
            onchain.refundOnchainAddress?.let { onchainMap.putString("refundOnchainAddress", it) }
            map.putMap("onchainPayment", onchainMap)
            // If no bolt11, use onchain state
            if (info.bolt11 == null) {
                map.putString("state", lsps1PaymentStateToString(onchain.state))
                map.putDouble("feeTotalSat", onchain.feeTotalSat.toLong().toDouble())
                map.putDouble("orderTotalSat", onchain.orderTotalSat.toLong().toDouble())
            }
        }

        return map
    }

    private fun lsps1ChannelInfoToMap(info: Lsps1ChannelInfo): WritableMap {
        val map = Arguments.createMap()
        map.putString("fundedAt", info.fundedAt)
        map.putString("fundingTxid", info.fundingOutpoint.txid)
        map.putDouble("fundingTxVout", info.fundingOutpoint.vout.toDouble())
        map.putString("expiresAt", info.expiresAt)
        return map
    }

    private fun lsps1PaymentStateToString(state: Lsps1PaymentState): String {
        return when (state) {
            Lsps1PaymentState.EXPECT_PAYMENT -> "expectPayment"
            Lsps1PaymentState.PAID -> "paid"
            Lsps1PaymentState.REFUNDED -> "refunded"
            else -> "unknown"
        }
    }

    // Message Signing Methods

    @ReactMethod
    fun signMessage(message: String, promise: Promise) {
        try {
            val node = this.node ?: throw Exception("Node not initialized")
            val messageBytes = message.toByteArray(Charsets.UTF_8).toList().map { it.toUByte() }
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
            val messageBytes = message.toByteArray(Charsets.UTF_8).toList().map { it.toUByte() }
            val isValid = node.verifySignature(messageBytes, signature, publicKey)
            val result = Arguments.createMap().apply {
                putBoolean("valid", isValid)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("error", e.message, e)
        }
    }

    // Log File Methods

    @ReactMethod
    fun tailLdkNodeLog(numLines: Int, promise: Promise) {
        val logPath = "${this.storedStorageDirPath}/ldk_node.log"
        promise.resolve(LogFileObserver.tailFile(logPath, numLines))
    }

    @ReactMethod
    fun observeLdkNodeLogFile(promise: Promise) {
        if (logFileObserver != null) {
            promise.resolve(true)
            return
        }
        val logPath = "${this.storedStorageDirPath}/ldk_node.log"
        logFileObserver = LogFileObserver(logPath) { line ->
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("ldklog", line + "\n")
        }
        logFileObserver?.startObserving()
        promise.resolve(true)
    }
}
