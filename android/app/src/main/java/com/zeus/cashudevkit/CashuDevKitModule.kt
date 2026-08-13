package app.zeusln.zeus.cashudevkit

import android.util.Log
import com.facebook.react.bridge.*
import kotlinx.coroutines.*
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap

import org.cashudevkit.*
import uniffi.zeus_cashu_restore.restoreFromSeed as zeusRestoreFromSeed
import uniffi.zeus_cashu_restore.RestoreException

/**
 * CashuDevKit Native Module for React Native
 * Provides bridge to CDK FFI bindings
 *
 * CDK 0.15+ replaced the MultiMintWallet with a WalletRepository plus
 * per-mint Wallet objects, and one-shot melts with a two-phase
 * prepare/confirm flow. This module adapts the new API behind the
 * pre-existing bridge contract: method names, parameters and resolved
 * JSON shapes are unchanged from the 0.14.x module.
 */
class CashuDevKitModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    @Volatile
    private var repo: WalletRepository? = null
    @Volatile
    private var db: WalletSqliteDatabase? = null
    @Volatile
    private var walletUnit: CurrencyUnit = CurrencyUnit.Sat
    private val wallets = ConcurrentHashMap<String, Wallet>()
    private val preparedSends = ConcurrentHashMap<String, PreparedSend>()
    @Volatile
    private var isInitialized = false
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    companion object {
        private const val TAG = "CashuDevKitModule"
    }

    override fun getName(): String = "CashuDevKitModule"

    // ========================================================================
    // Helper Methods
    // ========================================================================
    /**
     * Parse P2PK spending conditions from JSON
     */
    private fun parseP2PKConditions(json: JSONObject): SpendingConditions? {
        val kind = json.optString("kind")
        if (kind != "P2PK") return null

        val data = json.optJSONObject("data") ?: return null
        val pubkeyHex = data.optString("pubkey").takeIf { it.isNotEmpty() } ?: return null

        val locktime = if (data.has("locktime") && !data.isNull("locktime")) {
            data.optLong("locktime").toULong()
        } else {
            0UL
        }
        val refundKeys = data.optJSONArray("refund_keys")?.let { arr ->
            (0 until arr.length()).mapNotNull { i ->
                arr.optString(i).takeIf { it.isNotEmpty() }
            }
        } ?: emptyList()

        return SpendingConditions.P2pk(
            pubkey = pubkeyHex,
            conditions = Conditions(
                locktime = locktime,
                pubkeys = emptyList(),
                refundKeys = refundKeys,
                numSigs = 0UL,
                sigFlag = 0.toUByte(),
                numSigsRefund = 0UL
            )
        )
    }

    private fun readPositiveLong(json: JSONObject, key: String): Long {
        return when (val raw = json.opt(key)) {
            is Number -> raw.toLong()
            is String -> raw.toLongOrNull() ?: 0L
            else -> 0L
        }.coerceAtLeast(0L)
    }

    private fun parseMeltOptions(optionsJson: String?): MeltOptions? {
        if (optionsJson.isNullOrBlank()) return null

        return try {
            val parsed = JSONObject(optionsJson)

            parsed.optJSONObject("mpp")?.let { mpp ->
                val amount = readPositiveLong(mpp, "amount")
                if (amount > 0) {
                    return MeltOptions.Mpp(Amount(amount.toULong()))
                }
            }

            parsed.optJSONObject("amountless")?.let { amountless ->
                val amountMsat = readPositiveLong(amountless, "amount_msat")
                if (amountMsat > 0) {
                    return MeltOptions.Amountless(Amount(amountMsat.toULong()))
                }
            }

            null
        } catch (e: Exception) {
            Log.w(TAG, "parseMeltOptions: invalid options JSON", e)
            null
        }
    }

    /**
     * Returns the initialized wallet repository or rejects with NO_WALLET
     * error and returns null
     */
    private fun getInitializedRepo(promise: Promise): WalletRepository? {
        val current = repo
        if (!isInitialized || current == null) {
            promise.reject("NO_WALLET", "Wallet not initialized")
            return null
        }
        return current
    }

    private fun normalizeMintUrl(mintUrl: String): String = mintUrl.trimEnd('/')

    /**
     * Get (or lazily create) the per-mint Wallet for a mint URL.
     *
     * The repository only creates an in-memory Wallet handle here; no
     * network request is made until the wallet is used. Creating on
     * demand preserves the 0.14.x MultiMintWallet behavior where
     * receive/restore operated with allowUntrusted: true.
     */
    private suspend fun getWallet(mintUrl: String): Wallet {
        val normalized = normalizeMintUrl(mintUrl)
        wallets[normalized]?.let { return it }

        val currentRepo = repo
        if (!isInitialized || currentRepo == null) {
            throw FfiException.Internal("Wallet not initialized")
        }

        val url = MintUrl(normalized)
        if (!currentRepo.hasMint(url)) {
            currentRepo.createWallet(url, walletUnit, null)
        }
        val wallet = currentRepo.getWallet(url, walletUnit)
        wallets[normalized] = wallet
        return wallet
    }

    private var currentDbPath: String? = null

    private fun getDatabasePath(mnemonic: String): String {
        val filesDir = reactContext.filesDir
        // Hash the mnemonic to create a unique, deterministic filename per wallet
        val digest = MessageDigest.getInstance("SHA-256")
        val hashBytes = digest.digest(mnemonic.toByteArray(Charsets.UTF_8))
        val hashHex = hashBytes.take(8).joinToString("") { "%02x".format(it) }
        return File(filesDir, "cashu_wallet_$hashHex.db").absolutePath
    }

    private fun parseCurrencyUnit(unit: String): CurrencyUnit {
        return when (unit.lowercase()) {
            "sat" -> CurrencyUnit.Sat
            "msat" -> CurrencyUnit.Msat
            "usd" -> CurrencyUnit.Usd
            "eur" -> CurrencyUnit.Eur
            else -> CurrencyUnit.Sat
        }
    }

    private fun currencyUnitToString(unit: CurrencyUnit): String {
        return when (unit) {
            is CurrencyUnit.Sat -> "sat"
            is CurrencyUnit.Msat -> "msat"
            is CurrencyUnit.Usd -> "usd"
            is CurrencyUnit.Eur -> "eur"
            is CurrencyUnit.Auth -> "auth"
            is CurrencyUnit.Custom -> unit.unit
            else -> "sat"
        }
    }

    private fun quoteStateToString(state: QuoteState): String {
        return when (state) {
            QuoteState.UNPAID -> "Unpaid"
            QuoteState.PAID -> "Paid"
            QuoteState.PENDING -> "Pending"
            QuoteState.ISSUED -> "Issued"
        }
    }

    /**
     * Map the CDK FFI exception to the legacy bridge error codes that JS
     * consumers were written against. CDK 0.15+ collapsed the previous
     * 19 error variants into Cdk(code, errorMessage) with Cashu protocol
     * error codes, plus Internal(errorMessage) for infrastructure errors.
     */
    private fun mapFfiException(e: FfiException): Pair<String, String> {
        return when (e) {
            is FfiException.Cdk ->
                legacyErrorCode(e.code, e.errorMessage) to e.errorMessage
            is FfiException.Internal ->
                legacyErrorCode(null, e.errorMessage) to e.errorMessage
        }
    }

    private fun legacyErrorCode(protocolCode: UInt?, message: String): String {
        when (protocolCode?.toInt()) {
            10003, 11001, 11002, 11007 ->
                // Token verification / already spent / unbalanced / duplicate inputs
                return "INVALID_TOKEN"
            11005 -> return "UNIT_NOT_SUPPORTED"
            12001, 12002 -> return "KEYSET_UNKNOWN"
            20005 -> return "PAYMENT_PENDING"
            in 20000..20999 -> return "PAYMENT_FAILED"
        }

        val lowered = message.lowercase()
        return when {
            lowered.contains("insufficient funds") -> "INSUFFICIENT_FUNDS"
            lowered.contains("payment failed") -> "PAYMENT_FAILED"
            lowered.contains("payment pending") || lowered.contains("quote pending") -> "PAYMENT_PENDING"
            lowered.contains("network") || lowered.contains("connection") || lowered.contains("transport") -> "NETWORK_ERROR"
            lowered.contains("database") -> "DATABASE_ERROR"
            lowered.contains("mnemonic") -> "INVALID_MNEMONIC"
            lowered.contains("invalid url") -> "INVALID_URL"
            else -> "GENERIC_ERROR"
        }
    }

    private fun encodeMintQuote(quote: MintQuote): JSONObject {
        return JSONObject().apply {
            put("id", quote.id)
            put("amount", quote.amount?.value ?: 0)
            put("unit", currencyUnitToString(quote.unit))
            put("request", quote.request)
            put("state", quoteStateToString(quote.state))
            put("expiry", quote.expiry)
            put("mint_url", quote.mintUrl.url)
        }
    }

    private fun encodeMeltQuote(quote: MeltQuote): JSONObject {
        return JSONObject().apply {
            put("id", quote.id)
            put("amount", quote.amount.value.toLong())
            put("unit", currencyUnitToString(quote.unit))
            put("request", quote.request)
            put("fee_reserve", quote.feeReserve.value.toLong())
            put("state", quoteStateToString(quote.state))
            put("expiry", quote.expiry)
            // Upstream renamed payment_preimage to payment_proof; the bridge
            // key is part of the JS contract and keeps the old name
            quote.paymentProof?.let { put("payment_preimage", it) }
        }
    }

    private fun encodeMelted(melted: FinalizedMelt): JSONObject {
        return JSONObject().apply {
            put("state", quoteStateToString(melted.state))
            put("amount", melted.amount.value.toLong())
            put("fee_paid", melted.feePaid.value.toLong())
            melted.preimage?.let { put("preimage", it) }
            melted.change?.let { change ->
                put("change", JSONArray().apply {
                    change.forEach { proof -> put(encodeProof(proof)) }
                })
            }
        }
    }

    private fun encodeProof(proof: Proof): JSONObject {
        return JSONObject().apply {
            put("amount", proof.amount.value.toLong())
            put("secret", proof.secret)
            put("c", proof.c)
            put("keyset_id", proof.keysetId)
        }
    }

    private suspend fun encodeToken(token: Token): JSONObject {
        val mintUrl = token.mintUrl()
        val proofsArray = JSONArray()
        val currentRepo = repo
        if (isInitialized && currentRepo != null) {
            try {
                // Only resolve proofs through a wallet the mint is already
                // part of; decoding a foreign token must not add its mint or
                // contact it
                if (currentRepo.hasMint(MintUrl(normalizeMintUrl(mintUrl.url)))) {
                    val wallet = getWallet(mintUrl.url)
                    val keysets = wallet.getMintKeysets(KeysetFilter.ALL)
                    val proofs = token.proofs(keysets)
                    proofs.forEach { proof ->
                        proofsArray.put(encodeProof(proof))
                    }
                }
            } catch (_: Exception) {
                // Mint may not be known to the wallet yet (e.g. decoding a
                // token before receiving it). Fall back to empty proofs, which
                // matches the iOS behaviour.
            }
        }
        return JSONObject().apply {
            put("encoded", token.encode())
            put("value", token.value().value.toLong())
            put("mint_url", token.mintUrl().url)
            put("memo", token.memo() ?: "")
            put("unit", token.unit()?.let { currencyUnitToString(it) } ?: "sat")
            put("proofs", proofsArray)
        }
    }

    private fun encodeMintInfo(info: MintInfo): JSONObject {
        return JSONObject().apply {
            info.name?.let { put("name", it) }
            info.pubkey?.let { put("pubkey", it.toString()) }
            info.version?.let { put("version", it) }
            info.description?.let { put("description", it) }
            info.descriptionLong?.let { put("description_long", it) }
            info.motd?.let { put("motd", it) }
        }
    }

    private fun encodeKeyset(keyset: KeySetInfo): JSONObject {
        return JSONObject().apply {
            put("id", keyset.id.toString())
            put("unit", currencyUnitToString(keyset.unit))
            put("active", keyset.active)
            put("input_fee_ppk", keyset.inputFeePpk ?: 0)
        }
    }

    // ========================================================================
    // Database Path
    // ========================================================================

    @ReactMethod
    fun getDatabasePath(promise: Promise) {
        promise.resolve(currentDbPath ?: "")
    }

    // ========================================================================
    // Wallet Management
    // ========================================================================

    @ReactMethod
    fun initializeWallet(mnemonic: String, unit: String, promise: Promise) {
        scope.launch {
            try {
                val dbPath = getDatabasePath(mnemonic)
                currentDbPath = dbPath
                val database = WalletSqliteDatabase(dbPath)

                val currencyUnit = parseCurrencyUnit(unit)

                // WalletSqliteDatabase conforms to WalletDatabase; passing
                // it via WalletStore.Custom keeps the same handle available
                // for the direct database methods below
                val newRepo = WalletRepository(
                    mnemonic = mnemonic,
                    store = WalletStore.Custom(database)
                )

                db = database
                repo = newRepo
                walletUnit = currencyUnit
                wallets.clear()
                isInitialized = true

                withContext(Dispatchers.Main) {
                    promise.resolve(null)
                }
            } catch (e: FfiException) {
                val (code, message) = mapFfiException(e)
                Log.e(TAG, "initializeWallet error: $message", e)
                withContext(Dispatchers.Main) {
                    promise.reject(code, message, e)
                }
            } catch (e: Exception) {
                Log.e(TAG, "initializeWallet error", e)
                withContext(Dispatchers.Main) {
                    promise.reject("INIT_ERROR", e.message, e)
                }
            }
        }
    }

    @ReactMethod
    fun addMint(mintUrl: String, targetProofCount: Int?, promise: Promise) {
        val repo = getInitializedRepo(promise) ?: return

        scope.launch {
            try {
                val url = MintUrl(normalizeMintUrl(mintUrl))
                repo.createWallet(url, walletUnit, targetProofCount?.toUInt())

                withContext(Dispatchers.Main) {
                    promise.resolve(null)
                }
            } catch (e: FfiException) {
                val (code, message) = mapFfiException(e)
                Log.e(TAG, "addMint error: $message", e)
                withContext(Dispatchers.Main) {
                    promise.reject(code, message, e)
                }
            } catch (e: Exception) {
                Log.e(TAG, "addMint error", e)
                withContext(Dispatchers.Main) {
                    promise.reject("ADD_MINT_ERROR", e.message, e)
                }
            }
        }
    }

    @ReactMethod
    fun removeMint(mintUrl: String, promise: Promise) {
        val repo = getInitializedRepo(promise) ?: return

        scope.launch {
            try {
                val normalized = normalizeMintUrl(mintUrl)
                val url = MintUrl(normalized)
                // removeWallet only drops the in-memory wallet; tolerate a
                // mint the repository does not know (parity with the
                // non-throwing 0.14.x removeMint)
                runCatching { repo.removeWallet(url, walletUnit) }
                wallets.remove(normalized)
                db!!.removeMint(url)

                withContext(Dispatchers.Main) {
                    promise.resolve(null)
                }
            } catch (e: FfiException) {
                val (code, message) = mapFfiException(e)
                Log.e(TAG, "removeMint error: $message", e)
                withContext(Dispatchers.Main) {
                    promise.reject(code, message, e)
                }
            } catch (e: Exception) {
                Log.e(TAG, "removeMint error", e)
                withContext(Dispatchers.Main) {
                    promise.reject("REMOVE_MINT_ERROR", e.message, e)
                }
            }
        }
    }

    @ReactMethod
    fun getMintUrls(promise: Promise) {
        val repo = getInitializedRepo(promise) ?: return

        scope.launch {
            try {
                val urls = mutableListOf<String>()
                val seen = mutableSetOf<String>()
                repo.getWallets().forEach { wallet ->
                    val url = runCatching { wallet.mintUrl().url }.getOrNull() ?: return@forEach
                    if (seen.add(url)) {
                        urls.add(url)
                    }
                }

                val array = Arguments.createArray()
                urls.forEach { array.pushString(it) }

                withContext(Dispatchers.Main) {
                    promise.resolve(array)
                }
            } catch (e: FfiException) {
                val (code, message) = mapFfiException(e)
                Log.e(TAG, "getMintUrls error: $message", e)
                withContext(Dispatchers.Main) {
                    promise.reject(code, message, e)
                }
            } catch (e: Exception) {
                Log.e(TAG, "getMintUrls error", e)
                withContext(Dispatchers.Main) {
                    promise.reject("GET_MINT_URLS_ERROR", e.message, e)
                }
            }
        }
    }

    // ========================================================================
    // Balance Operations
    // ========================================================================

    @ReactMethod
    fun getTotalBalance(promise: Promise) {
        val repo = getInitializedRepo(promise) ?: return

        scope.launch {
            try {
                val balances = repo.getBalances()
                var total: ULong = 0UL
                balances.values.forEach { amount ->
                    total += amount.value
                }

                withContext(Dispatchers.Main) {
                    promise.resolve(total.toDouble())
                }
            } catch (e: FfiException) {
                val (code, message) = mapFfiException(e)
                Log.e(TAG, "getTotalBalance error: $message", e)
                withContext(Dispatchers.Main) {
                    promise.reject(code, message, e)
                }
            } catch (e: Exception) {
                Log.e(TAG, "getTotalBalance error", e)
                withContext(Dispatchers.Main) {
                    promise.reject("BALANCE_ERROR", e.message, e)
                }
            }
        }
    }

    @ReactMethod
    fun getBalances(promise: Promise) {
        val repo = getInitializedRepo(promise) ?: return

        scope.launch {
            try {
                val balances = repo.getBalances()
                val totals = mutableMapOf<String, Long>()
                balances.forEach { (key, amount) ->
                    val url = key.mintUrl.url
                    totals[url] = (totals[url] ?: 0L) + amount.value.toLong()
                }
                val result = JSONObject()
                totals.forEach { (url, value) ->
                    result.put(url, value)
                }

                withContext(Dispatchers.Main) {
                    promise.resolve(result.toString())
                }
            } catch (e: FfiException) {
                val (code, message) = mapFfiException(e)
                Log.e(TAG, "getBalances error: $message", e)
                withContext(Dispatchers.Main) {
                    promise.reject(code, message, e)
                }
            } catch (e: Exception) {
                Log.e(TAG, "getBalances error", e)
                withContext(Dispatchers.Main) {
                    promise.reject("BALANCES_ERROR", e.message, e)
                }
            }
        }
    }

    // ========================================================================
    // Mint Info
    // ========================================================================

    @ReactMethod
    fun fetchMintInfo(mintUrl: String, promise: Promise) {
        // fetchMintInfo uses direct HTTP - works without wallet initialization
        scope.launch {
            try {
                // Normalize URL and construct info endpoint
                val normalizedUrl = mintUrl.trimEnd('/')
                val infoUrl = "$normalizedUrl/v1/info"

                val url = URL(infoUrl)
                val connection = url.openConnection() as HttpURLConnection
                connection.requestMethod = "GET"
                connection.connectTimeout = 30000
                connection.readTimeout = 30000

                val responseCode = connection.responseCode
                if (responseCode !in 200..299) {
                    withContext(Dispatchers.Main) {
                        promise.reject("HTTP_ERROR", "Mint returned HTTP $responseCode")
                    }
                    return@launch
                }

                val response = connection.inputStream.bufferedReader().use { it.readText() }
                connection.disconnect()

                // Return the raw JSON string (already in correct format)
                withContext(Dispatchers.Main) {
                    promise.resolve(response)
                }
            } catch (e: Exception) {
                Log.e(TAG, "fetchMintInfo error", e)
                withContext(Dispatchers.Main) {
                    promise.reject("MINT_INFO_ERROR", e.message, e)
                }
            }
        }
    }

    @ReactMethod
    fun getMintKeysets(mintUrl: String, promise: Promise) {
        getInitializedRepo(promise) ?: return

        scope.launch {
            try {
                val wallet = getWallet(mintUrl)
                val keysets = wallet.getMintKeysets(KeysetFilter.ALL)

                val array = JSONArray()
                keysets.forEach { keyset ->
                    array.put(encodeKeyset(keyset))
                }

                withContext(Dispatchers.Main) {
                    promise.resolve(array.toString())
                }
            } catch (e: FfiException) {
                val (code, message) = mapFfiException(e)
                Log.e(TAG, "getMintKeysets error: $message", e)
                withContext(Dispatchers.Main) {
                    promise.reject(code, message, e)
                }
            } catch (e: Exception) {
                Log.e(TAG, "getMintKeysets error", e)
                withContext(Dispatchers.Main) {
                    promise.reject("KEYSETS_ERROR", e.message, e)
                }
            }
        }
    }

    // ========================================================================
    // Mint Quotes (Receiving)
    // ========================================================================

    @ReactMethod
    fun createMintQuote(mintUrl: String, amount: Double, description: String?, promise: Promise) {
        getInitializedRepo(promise) ?: return

        scope.launch {
            try {
                val amt = Amount(amount.toLong().toULong())
                val wallet = getWallet(mintUrl)
                val quote = wallet.mintQuote(
                    paymentMethod = PaymentMethod.Bolt11,
                    amount = amt,
                    description = description,
                    extra = null
                )

                withContext(Dispatchers.Main) {
                    promise.resolve(encodeMintQuote(quote).toString())
                }
            } catch (e: FfiException) {
                val (code, message) = mapFfiException(e)
                Log.e(TAG, "createMintQuote error: $message", e)
                withContext(Dispatchers.Main) {
                    promise.reject(code, message, e)
                }
            } catch (e: Exception) {
                Log.e(TAG, "createMintQuote error", e)
                withContext(Dispatchers.Main) {
                    promise.reject("MINT_QUOTE_ERROR", e.message, e)
                }
            }
        }
    }

    @ReactMethod
    fun checkMintQuote(mintUrl: String, quoteId: String, promise: Promise) {
        getInitializedRepo(promise) ?: return

        scope.launch {
            try {
                val wallet = getWallet(mintUrl)
                val quote = wallet.checkMintQuote(quoteId)

                withContext(Dispatchers.Main) {
                    promise.resolve(encodeMintQuote(quote).toString())
                }
            } catch (e: FfiException) {
                val (code, message) = mapFfiException(e)
                Log.e(TAG, "checkMintQuote error: $message", e)
                withContext(Dispatchers.Main) {
                    promise.reject(code, message, e)
                }
            } catch (e: Exception) {
                Log.e(TAG, "checkMintQuote error", e)
                withContext(Dispatchers.Main) {
                    promise.reject("CHECK_QUOTE_ERROR", e.message, e)
                }
            }
        }
    }

    /**
     * Check mint quote status directly from the mint's HTTP API.
     * This bypasses the local database check and works for external quotes
     * (e.g., quotes created by ZeusPay server).
     */
    @ReactMethod
    fun checkExternalMintQuote(mintUrl: String, quoteId: String, promise: Promise) {
        scope.launch {
            try {
                // Normalize mint URL and construct the quote endpoint
                val normalizedUrl = mintUrl.trimEnd('/')
                val quoteUrl = "$normalizedUrl/v1/mint/quote/bolt11/$quoteId"

                Log.d(TAG, "checkExternalMintQuote: Fetching $quoteUrl")

                val connection = URL(quoteUrl).openConnection() as HttpURLConnection
                connection.requestMethod = "GET"
                connection.connectTimeout = 30000
                connection.readTimeout = 30000
                connection.setRequestProperty("Accept", "application/json")

                val responseCode = connection.responseCode
                if (responseCode != HttpURLConnection.HTTP_OK) {
                    val errorStream = connection.errorStream?.bufferedReader()?.readText() ?: "Unknown error"
                    Log.e(TAG, "checkExternalMintQuote: HTTP $responseCode - $errorStream")
                    withContext(Dispatchers.Main) {
                        promise.reject("HTTP_ERROR", "Mint returned HTTP $responseCode: $errorStream")
                    }
                    return@launch
                }

                val response = connection.inputStream.bufferedReader().readText()
                Log.d(TAG, "checkExternalMintQuote: Response: $response")

                val json = JSONObject(response)

                // Parse the response according to NUT-04 spec
                val result = JSONObject().apply {
                    put("id", json.optString("quote", quoteId))
                    put("amount", json.optLong("amount", 0))
                    put("request", json.optString("request", ""))
                    put("state", json.optString("state", "Unknown"))
                    put("expiry", json.optLong("expiry", 0))
                    put("mint_url", mintUrl)
                    // Include pubkey if present (for P2PK locked quotes)
                    if (json.has("pubkey")) {
                        put("pubkey", json.optString("pubkey"))
                    }
                }

                withContext(Dispatchers.Main) {
                    promise.resolve(result.toString())
                }
            } catch (e: Exception) {
                Log.e(TAG, "checkExternalMintQuote error", e)
                withContext(Dispatchers.Main) {
                    promise.reject("EXTERNAL_QUOTE_ERROR", e.message, e)
                }
            }
        }
    }

    /**
     * Add an external mint quote to CDK's database.
     * This allows minting from quotes created externally (e.g., by ZeusPay server).
     */
    @ReactMethod
    fun addExternalMintQuote(
        mintUrl: String,
        quoteId: String,
        amount: Double,
        request: String,
        state: String,
        expiry: Double,
        secretKey: String?,
        promise: Promise
    ) {
        if (!isInitialized || db == null) {
            promise.reject("NO_WALLET", "Wallet not initialized")
            return
        }

        scope.launch {
            try {
                val url = MintUrl(mintUrl)
                val amt = Amount(amount.toLong().toULong())

                // Map state string to QuoteState enum
                val quoteState = when (state.uppercase()) {
                    "UNPAID" -> QuoteState.UNPAID
                    "PAID" -> QuoteState.PAID
                    "PENDING" -> QuoteState.PENDING
                    "ISSUED" -> QuoteState.ISSUED
                    else -> QuoteState.PAID // Default to PAID for external quotes
                }

                // ZEUS Pay locks quotes to the wallet's seed-prefix key
                // (seed[0..32]), which is byte-identical to cdk's "legacy
                // NpubCash" key. Storing that key on the quote makes cdk's
                // mint saga scrub it mid-flight (a version bump), and the
                // saga's post-mint write then dies with ConcurrentUpdate
                // AFTER the mint has issued the signatures. Instead, store
                // the quote with no key and write cdk's NpubCash quote-key
                // marker: at signing time cdk re-derives the identical
                // seed-prefix key from the marker, with no mid-saga write.
                // Upstream bug: https://github.com/cashubtc/cdk/issues/2335
                // Remove when fixed: https://github.com/ZeusLN/zeus/issues/4402
                if (!secretKey.isNullOrEmpty()) {
                    db!!.kvWrite(
                        primaryNamespace = "npubcash",
                        secondaryNamespace = "quotes",
                        key = quoteId,
                        value = "legacy-seed-prefix".toByteArray(Charsets.UTF_8)
                    )
                }

                // Create the MintQuote object
                // For external quotes that are PAID, we set amountPaid = amount
                val zeroAmount = Amount(0UL)
                val quote = MintQuote(
                    id = quoteId,
                    mintUrl = url,
                    amount = amt,
                    unit = CurrencyUnit.Sat,
                    request = request,
                    state = quoteState,
                    expiry = expiry.toLong().toULong(),
                    amountPaid = if (quoteState == QuoteState.PAID || quoteState == QuoteState.ISSUED) amt else zeroAmount,
                    amountIssued = if (quoteState == QuoteState.ISSUED) amt else zeroAmount,
                    estimatedBlocks = null,
                    paymentMethod = PaymentMethod.Bolt11,
                    secretKey = null,
                    usedByOperation = null,
                    version = 0u
                )

                Log.d(TAG, "addExternalMintQuote: Adding quote $quoteId to database")

                // Add to database
                db!!.addMintQuote(quote)

                Log.d(TAG, "addExternalMintQuote: Successfully added quote $quoteId")

                withContext(Dispatchers.Main) {
                    promise.resolve(true)
                }
            } catch (e: FfiException) {
                val (code, message) = mapFfiException(e)
                Log.e(TAG, "addExternalMintQuote error: $message", e)
                withContext(Dispatchers.Main) {
                    promise.reject(code, message, e)
                }
            } catch (e: Exception) {
                Log.e(TAG, "addExternalMintQuote error", e)
                withContext(Dispatchers.Main) {
                    promise.reject("ADD_QUOTE_ERROR", e.message, e)
                }
            }
        }
    }

    /**
     * Mint tokens directly from an external quote.
     * This creates the quote in CDK's database first, then mints.
     */
    @ReactMethod
    fun mintExternal(mintUrl: String, quoteId: String, amount: Double, promise: Promise) {
        getInitializedRepo(promise) ?: return

        scope.launch {
            try {
                Log.d(TAG, "mintExternal: Attempting to mint quote $quoteId from $mintUrl")

                val wallet = getWallet(mintUrl)
                val proofs = wallet.mint(
                    quoteId = quoteId,
                    amountSplitTarget = SplitTarget.None,
                    spendingConditions = null
                )

                val array = JSONArray()
                proofs.forEach { proof ->
                    array.put(encodeProof(proof))
                }

                Log.d(TAG, "mintExternal: Successfully minted ${proofs.size} proofs")

                withContext(Dispatchers.Main) {
                    promise.resolve(array.toString())
                }
            } catch (e: FfiException) {
                val (code, message) = mapFfiException(e)
                Log.e(TAG, "mintExternal error: $message", e)
                withContext(Dispatchers.Main) {
                    promise.reject(code, message, e)
                }
            } catch (e: Exception) {
                Log.e(TAG, "mintExternal error", e)
                withContext(Dispatchers.Main) {
                    promise.reject("MINT_EXTERNAL_ERROR", e.message, e)
                }
            }
        }
    }

    @ReactMethod
    fun mint(mintUrl: String, quoteId: String, conditionsJson: String?, promise: Promise) {
        getInitializedRepo(promise) ?: return

        scope.launch {
            try {
                // Parse spending conditions if provided
                val conditions = conditionsJson?.let { json ->
                    runCatching {
                        parseP2PKConditions(JSONObject(json))
                    }.getOrNull()
                }
                val wallet = getWallet(mintUrl)
                val proofs = wallet.mint(
                    quoteId = quoteId,
                    amountSplitTarget = SplitTarget.None,
                    spendingConditions = conditions
                )

                val array = JSONArray()

                proofs.forEach { proof ->
                    array.put(encodeProof(proof))
                }

                withContext(Dispatchers.Main) {
                    promise.resolve(array.toString())
                }
            } catch (e: FfiException) {
                val (code, message) = mapFfiException(e)
                Log.e(TAG, "mint error: $message", e)
                withContext(Dispatchers.Main) {
                    promise.reject(code, message, e)
                }
            } catch (e: Exception) {
                Log.e(TAG, "mint error", e)
                withContext(Dispatchers.Main) {
                    promise.reject("MINT_ERROR", e.message, e)
                }
            }
        }
    }

    // ========================================================================
    // Melt Quotes (Paying)
    // ========================================================================

    @ReactMethod
    fun createMeltQuote(mintUrl: String, request: String, optionsJson: String?, promise: Promise) {
        getInitializedRepo(promise) ?: return

        scope.launch {
            try {
                val options = parseMeltOptions(optionsJson)
                val wallet = getWallet(mintUrl)
                val quote = wallet.meltQuote(
                    method = PaymentMethod.Bolt11,
                    request = request,
                    options = options,
                    extra = null
                )

                withContext(Dispatchers.Main) {
                    promise.resolve(encodeMeltQuote(quote).toString())
                }
            } catch (e: FfiException) {
                val (code, message) = mapFfiException(e)
                Log.e(TAG, "createMeltQuote error: $message", e)
                withContext(Dispatchers.Main) {
                    promise.reject(code, message, e)
                }
            } catch (e: Exception) {
                Log.e(TAG, "createMeltQuote error", e)
                withContext(Dispatchers.Main) {
                    promise.reject("MELT_QUOTE_ERROR", e.message, e)
                }
            }
        }
    }

    @ReactMethod
    fun checkMeltQuote(mintUrl: String, quoteId: String, promise: Promise) {
        getInitializedRepo(promise) ?: return

        scope.launch {
            try {
                val wallet = getWallet(mintUrl)
                val quote = wallet.checkMeltQuoteStatus(quoteId)

                withContext(Dispatchers.Main) {
                    promise.resolve(encodeMeltQuote(quote).toString())
                }
            } catch (e: FfiException) {
                val (code, message) = mapFfiException(e)
                Log.e(TAG, "checkMeltQuote error: $message", e)
                withContext(Dispatchers.Main) {
                    promise.reject(code, message, e)
                }
            } catch (e: Exception) {
                Log.e(TAG, "checkMeltQuote error", e)
                withContext(Dispatchers.Main) {
                    promise.reject("CHECK_MELT_QUOTE_ERROR", e.message, e)
                }
            }
        }
    }

    @ReactMethod
    fun melt(mintUrl: String, quoteId: String, promise: Promise) {
        getInitializedRepo(promise) ?: return

        scope.launch {
            try {
                val wallet = getWallet(mintUrl)
                val prepared = wallet.prepareMelt(quoteId)
                val melted = prepared.confirm()

                withContext(Dispatchers.Main) {
                    promise.resolve(encodeMelted(melted).toString())
                }
            } catch (e: FfiException) {
                val (code, message) = mapFfiException(e)
                Log.e(TAG, "melt error: $message", e)
                withContext(Dispatchers.Main) {
                    promise.reject(code, message, e)
                }
            } catch (e: Exception) {
                Log.e(TAG, "melt error", e)
                withContext(Dispatchers.Main) {
                    promise.reject("MELT_ERROR", e.message, e)
                }
            }
        }
    }

    @ReactMethod
    fun meltPartial(mintUrl: String, bolt11: String, mppAmountMsat: Double, promise: Promise) {
        getInitializedRepo(promise) ?: return

        scope.launch {
            try {
                val mppAmount = Amount(mppAmountMsat.toLong().toULong())
                val wallet = getWallet(mintUrl)

                // Step 1: Create melt quote via CDK with MPP options
                val options = MeltOptions.Mpp(mppAmount)
                val quote = wallet.meltQuote(
                    method = PaymentMethod.Bolt11,
                    request = bolt11,
                    options = options,
                    extra = null
                )

                // Step 2: Gather this mint's unspent proofs —
                // the mint knows the MPP partial amount from the quote
                val database = db
                if (database == null) {
                    withContext(Dispatchers.Main) {
                        promise.reject("NO_WALLET", "Wallet not initialized")
                    }
                    return@launch
                }
                val url = MintUrl(normalizeMintUrl(mintUrl))
                val proofInfos = database.getProofs(
                    mintUrl = url,
                    unit = CurrencyUnit.Sat,
                    state = listOf(ProofState.UNSPENT),
                    spendingConditions = null
                )
                val mintProofs = proofInfos.map { it.proof }

                if (mintProofs.isEmpty()) {
                    withContext(Dispatchers.Main) {
                        promise.reject("NO_PROOFS", "No proofs found for mint $mintUrl")
                    }
                    return@launch
                }

                // Step 3: Two-phase melt with the selected proofs
                val prepared = wallet.prepareMeltProofs(quote.id, mintProofs)
                val melted = prepared.confirm()

                withContext(Dispatchers.Main) {
                    promise.resolve(encodeMelted(melted).toString())
                }
            } catch (e: FfiException) {
                val (code, message) = mapFfiException(e)
                Log.e(TAG, "meltPartial error: $message", e)
                withContext(Dispatchers.Main) {
                    promise.reject(code, message, e)
                }
            } catch (e: Exception) {
                Log.e(TAG, "meltPartial error", e)
                withContext(Dispatchers.Main) {
                    promise.reject("MELT_PARTIAL_ERROR", e.message, e)
                }
            }
        }
    }

    // ========================================================================
    // Token Operations
    // ========================================================================

    @ReactMethod
    fun prepareSend(mintUrl: String, amount: Double, optionsJson: String?, promise: Promise) {
        getInitializedRepo(promise) ?: return

        scope.launch {
            try {
                val amt = Amount(amount.toLong().toULong())

                // Parse options if provided; be defensive so malformed JSON doesn't crash
                var includeFee = false
                var conditions: SpendingConditions? = null
                var sendKind: SendKind = SendKind.OnlineExact
                optionsJson?.let { raw ->
                    val parsed = runCatching { JSONObject(raw) }.getOrNull() ?: return@let

                    includeFee = parsed.optBoolean("include_fee", false)

                    // Parse spending conditions (P2PK) if provided
                    parsed.optJSONObject("conditions")?.let { cond ->
                        conditions = parseP2PKConditions(cond)
                    }

                    // Parse send_kind
                    val kindStr = parsed.optString("send_kind", "")
                    if (kindStr.isNotEmpty()) {
                        val tolerance = Amount(parsed.optLong("tolerance", 0).toULong())
                        sendKind = when (kindStr) {
                            "OfflineExact" -> SendKind.OfflineExact
                            "OnlineTolerance" -> SendKind.OnlineTolerance(tolerance)
                            "OfflineTolerance" -> SendKind.OfflineTolerance(tolerance)
                            else -> SendKind.OnlineExact
                        }
                    }
                }

                val sendOptions = SendOptions(
                    memo = null,
                    conditions = conditions,
                    amountSplitTarget = SplitTarget.None,
                    sendKind = sendKind,
                    includeFee = includeFee,
                    useP2bk = false,
                    maxProofs = 0U,
                    metadata = emptyMap(),
                    p2pkSigningKeys = emptyList(),
                    p2pkLockedProofSendMode = P2pkLockedProofSendMode.SWAP
                )

                val wallet = getWallet(mintUrl)
                val prepared = wallet.prepareSend(amt, sendOptions)

                val preparedId = prepared.operationId()
                val preparedAmount = prepared.amount().value.toLong()
                val preparedFee = prepared.fee().value.toLong()

                preparedSends[preparedId] = prepared

                val result = org.json.JSONObject()
                result.put("id", preparedId)
                result.put("amount", preparedAmount)
                result.put("fee", preparedFee)

                withContext(Dispatchers.Main) {
                    promise.resolve(result.toString())
                }
            } catch (e: FfiException) {
                val (code, message) = mapFfiException(e)
                Log.e(TAG, "prepareSend error: $message", e)
                withContext(Dispatchers.Main) {
                    promise.reject(code, message, e)
                }
            } catch (e: Exception) {
                Log.e(TAG, "prepareSend error", e)
                withContext(Dispatchers.Main) {
                    promise.reject("PREPARE_SEND_ERROR", e.message, e)
                }
            }
        }
    }

    @ReactMethod
    fun confirmSend(preparedSendId: String, memo: String?, promise: Promise) {
        val prepared = preparedSends[preparedSendId]
        if (prepared == null) {
            promise.reject("NO_PREPARED_SEND", "Prepared send not found")
            return
        }

        scope.launch {
            try {
                val token = prepared.confirm(memo)
                val encodedTokenJson = encodeToken(token)
                withContext(Dispatchers.Main) {
                    promise.resolve(encodedTokenJson.toString())
                }
            } catch (e: FfiException) {
                val (code, message) = mapFfiException(e)
                Log.e(TAG, "confirmSend error: $message", e)
                withContext(Dispatchers.Main) {
                    promise.reject(code, message, e)
                }
            } catch (e: Exception) {
                Log.e(TAG, "confirmSend error", e)
                withContext(Dispatchers.Main) {
                    promise.reject("CONFIRM_SEND_ERROR", e.message, e)
                }
            } finally {
                // Always clean up prepared send, whether success or failure
                preparedSends.remove(preparedSendId)
            }
        }
    }

    @ReactMethod
    fun cancelSend(preparedSendId: String, promise: Promise) {
        val prepared = preparedSends[preparedSendId]
        if (prepared == null) {
            promise.resolve(null)
            return
        }

        scope.launch {
            try {
                prepared.cancel()
                withContext(Dispatchers.Main) {
                    promise.resolve(null)
                }
            } catch (e: FfiException) {
                val (code, message) = mapFfiException(e)
                Log.e(TAG, "cancelSend error: $message", e)
                withContext(Dispatchers.Main) {
                    promise.reject(code, message, e)
                }
            } catch (e: Exception) {
                Log.e(TAG, "cancelSend error", e)
                withContext(Dispatchers.Main) {
                    promise.reject("CANCEL_SEND_ERROR", e.message, e)
                }
            } finally {
                // Always clean up prepared send, whether success or failure
                preparedSends.remove(preparedSendId)
            }
        }
    }

    @ReactMethod
    fun receive(encodedToken: String, optionsJson: String?, promise: Promise) {
        getInitializedRepo(promise) ?: return

        scope.launch {
            try {
                val token = Token.fromString(encodedToken)

                // Parse options if provided; be defensive so malformed JSON doesn't crash
                var receiveOptions = ReceiveOptions(
                    amountSplitTarget = SplitTarget.None,
                    p2pkSigningKeys = emptyList(),
                    preimages = emptyList(),
                    metadata = emptyMap()
                )
                optionsJson?.let { raw ->
                    val json = runCatching { JSONObject(raw) }.getOrNull() ?: return@let
                    val p2pkKeysJson = json.optJSONArray("p2pk_signing_keys")
                    val p2pkKeys = p2pkKeysJson?.let { arr ->
                        (0 until arr.length()).mapNotNull { i ->
                            val hex =
                                arr.optString(i).takeIf { it.isNotEmpty() }
                                    ?: return@mapNotNull null
                            runCatching { SecretKey(hex) }.getOrNull()
                        }
                    }
                    val preimagesJson = json.optJSONArray("preimages")
                    val preimages =
                        preimagesJson?.let { arr ->
                            (0 until arr.length()).mapNotNull { i ->
                                arr.optString(i).takeIf { it.isNotEmpty() }
                            }
                        } ?: emptyList()

                    receiveOptions = ReceiveOptions(
                        amountSplitTarget = SplitTarget.None,
                        p2pkSigningKeys = p2pkKeys ?: emptyList(),
                        preimages = preimages,
                        metadata = emptyMap()
                    )
                }

                // The token's mint is added on demand, matching the 0.14.x
                // MultiMintWallet behavior of allowUntrusted: true
                val wallet = getWallet(token.mintUrl().url)
                val amount = wallet.receive(token, receiveOptions)

                withContext(Dispatchers.Main) {
                    promise.resolve(amount.value.toDouble())
                }
            } catch (e: FfiException) {
                val (code, message) = mapFfiException(e)
                Log.e(TAG, "receive error: $message", e)
                withContext(Dispatchers.Main) {
                    promise.reject(code, message, e)
                }
            } catch (e: Exception) {
                Log.e(TAG, "receive error", e)
                withContext(Dispatchers.Main) {
                    promise.reject("RECEIVE_ERROR", e.message, e)
                }
            }
        }
    }

    // ========================================================================
    // Token Utility
    // ========================================================================

    @ReactMethod
    fun decodeToken(encodedToken: String, promise: Promise) {
        scope.launch{
            try {
                val token = Token.fromString(encodedToken)
                val encodedTokenJson = encodeToken(token)
                withContext(Dispatchers.Main) {
                    promise.resolve(encodedTokenJson.toString())
                }
            } catch (e: FfiException) {
                val (code, message) = mapFfiException(e)
                Log.e(TAG, "decodeToken error: $message", e)
                withContext(Dispatchers.Main) {
                    promise.reject(code, message, e)
                }
            } catch (e: Exception) {
                Log.e(TAG, "decodeToken error", e)
                withContext(Dispatchers.Main) {
                    promise.reject("DECODE_ERROR", e.message, e)
                }
            }
        }
    }

    @ReactMethod
    fun isValidToken(encodedToken: String, promise: Promise) {
        try {
            Token.fromString(encodedToken)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    // ========================================================================
    // Restore
    // ========================================================================

    @ReactMethod
    fun restore(mintUrl: String, promise: Promise) {
        getInitializedRepo(promise) ?: return

        scope.launch {
            try {
                val wallet = getWallet(mintUrl)
                // Restored splits the result into spent/unspent/pending;
                // the bridge contract is the recovered spendable amount
                val restored = wallet.restore()

                withContext(Dispatchers.Main) {
                    promise.resolve(restored.unspent.value.toDouble())
                }
            } catch (e: FfiException) {
                val (code, message) = mapFfiException(e)
                Log.e(TAG, "restore error: $message", e)
                withContext(Dispatchers.Main) {
                    promise.reject(code, message, e)
                }
            } catch (e: Exception) {
                Log.e(TAG, "restore error", e)
                withContext(Dispatchers.Main) {
                    promise.reject("RESTORE_ERROR", e.message, e)
                }
            }
        }
    }

    @ReactMethod
    fun restoreFromSeed(mintUrl: String, seedHex: String, promise: Promise) {
        getInitializedRepo(promise) ?: return

        scope.launch {
            try {
                // Step 1: Call standalone restore crate to get v1 proofs as a cashu token
                val tokenString = zeusRestoreFromSeed(mintUrl, seedHex)

                // If no proofs found, return 0
                if (tokenString.isEmpty()) {
                    withContext(Dispatchers.Main) {
                        promise.resolve(0.0)
                    }
                    return@launch
                }

                // Step 2: Feed the token into CDK's receive to import proofs into the wallet
                val token = Token.fromString(tokenString)

                val receiveOptions = ReceiveOptions(
                    amountSplitTarget = SplitTarget.None,
                    p2pkSigningKeys = emptyList(),
                    preimages = emptyList(),
                    metadata = emptyMap()
                )

                val wallet = getWallet(mintUrl)
                val amount = wallet.receive(token, receiveOptions)

                withContext(Dispatchers.Main) {
                    promise.resolve(amount.value.toDouble())
                }
            } catch (e: RestoreException) {
                Log.e(TAG, "restoreFromSeed restore error: ${e.message}", e)
                withContext(Dispatchers.Main) {
                    promise.reject("RESTORE_FROM_SEED_ERROR", e.message, e)
                }
            } catch (e: FfiException) {
                val (code, message) = mapFfiException(e)
                Log.e(TAG, "restoreFromSeed CDK error: $message", e)
                withContext(Dispatchers.Main) {
                    promise.reject(code, message, e)
                }
            } catch (e: Exception) {
                Log.e(TAG, "restoreFromSeed error", e)
                withContext(Dispatchers.Main) {
                    promise.reject("RESTORE_FROM_SEED_ERROR", e.message, e)
                }
            }
        }
    }

    // ========================================================================
    // Proof Management
    // ========================================================================

    @ReactMethod
    fun checkProofsState(mintUrl: String, proofsJson: String, promise: Promise) {
        getInitializedRepo(promise) ?: return

        scope.launch {
            try {
                // Parse proofs from JSON
                val proofsArray = JSONArray(proofsJson)
                val proofs = mutableListOf<Proof>()
                for (i in 0 until proofsArray.length()) {
                    val proofJson = proofsArray.getJSONObject(i)
                    val proof = Proof(
                        amount = Amount(proofJson.getLong("amount").toULong()),
                        secret = proofJson.getString("secret"),
                        c = proofJson.getString("c"),
                        keysetId = proofJson.getString("keyset_id"),
                        witness = null,
                        dleq = null,
                        p2pkE = null
                    )
                    proofs.add(proof)
                }

                val wallet = getWallet(mintUrl)
                val spentFlags = wallet.checkProofsSpent(proofs)

                val result = JSONArray()
                spentFlags.forEach { spent ->
                    result.put(JSONObject().put("state", if (spent) "Spent" else "Unspent"))
                }

                withContext(Dispatchers.Main) {
                    promise.resolve(result.toString())
                }
            } catch (e: FfiException) {
                val (code, message) = mapFfiException(e)
                Log.e(TAG, "checkProofsState error: $message", e)
                withContext(Dispatchers.Main) {
                    promise.reject(code, message, e)
                }
            } catch (e: Exception) {
                Log.e(TAG, "checkProofsState error", e)
                withContext(Dispatchers.Main) {
                    promise.reject("CHECK_PROOFS_ERROR", e.message, e)
                }
            }
        }
    }

    // ========================================================================
    // BOLT12 Support
    // ========================================================================

    @ReactMethod
    fun createMintBolt12Quote(mintUrl: String, amount: Double?, description: String?, promise: Promise) {
        getInitializedRepo(promise) ?: return

        scope.launch {
            try {
                val amt = amount?.let { Amount(it.toLong().toULong()) } ?: Amount(0UL)

                val wallet = getWallet(mintUrl)
                val quote = wallet.mintQuote(
                    paymentMethod = PaymentMethod.Bolt12,
                    amount = amt,
                    description = description,
                    extra = null
                )

                withContext(Dispatchers.Main) {
                    promise.resolve(encodeMintQuote(quote).toString())
                }
            } catch (e: FfiException) {
                val (code, message) = mapFfiException(e)
                Log.e(TAG, "createMintBolt12Quote error: $message", e)
                withContext(Dispatchers.Main) {
                    promise.reject(code, message, e)
                }
            } catch (e: Exception) {
                Log.e(TAG, "createMintBolt12Quote error", e)
                withContext(Dispatchers.Main) {
                    promise.reject("BOLT12_QUOTE_ERROR", e.message, e)
                }
            }
        }
    }

    @ReactMethod
    fun createMeltBolt12Quote(mintUrl: String, request: String, optionsJson: String?, promise: Promise) {
        getInitializedRepo(promise) ?: return

        scope.launch {
            try {
                val options = parseMeltOptions(optionsJson)
                val wallet = getWallet(mintUrl)
                val quote = wallet.meltQuote(
                    method = PaymentMethod.Bolt12,
                    request = request,
                    options = options,
                    extra = null
                )

                withContext(Dispatchers.Main) {
                    promise.resolve(encodeMeltQuote(quote).toString())
                }
            } catch (e: FfiException) {
                val (code, message) = mapFfiException(e)
                Log.e(TAG, "createMeltBolt12Quote error: $message", e)
                withContext(Dispatchers.Main) {
                    promise.reject(code, message, e)
                }
            } catch (e: Exception) {
                Log.e(TAG, "createMeltBolt12Quote error", e)
                withContext(Dispatchers.Main) {
                    promise.reject("BOLT12_MELT_QUOTE_ERROR", e.message, e)
                }
            }
        }
    }

    @ReactMethod
    fun createMeltHumanReadableQuote(mintUrl: String, address: String, amountMsat: Double, promise: Promise) {
        getInitializedRepo(promise) ?: return

        scope.launch {
            try {
                val wallet = getWallet(mintUrl)
                val quote = wallet.meltHumanReadableQuote(
                    address = address,
                    amountMsat = Amount(amountMsat.toLong().toULong()),
                    network = BitcoinNetwork.BITCOIN
                )

                withContext(Dispatchers.Main) {
                    promise.resolve(encodeMeltQuote(quote).toString())
                }
            } catch (e: FfiException) {
                val (code, message) = mapFfiException(e)
                Log.e(TAG, "createMeltHumanReadableQuote error: $message", e)
                withContext(Dispatchers.Main) {
                    promise.reject(code, message, e)
                }
            } catch (e: Exception) {
                Log.e(TAG, "createMeltHumanReadableQuote error", e)
                withContext(Dispatchers.Main) {
                    promise.reject("HR_QUOTE_ERROR", e.message, e)
                }
            }
        }
    }

    // ========================================================================
    // Transactions
    // ========================================================================

    @ReactMethod
    fun listTransactions(direction: String?, promise: Promise) {
        if (!isInitialized || repo == null || db == null) {
            promise.reject("NO_WALLET", "Wallet not initialized")
            return
        }

        scope.launch {
            try {
                val txDirection = direction?.let {
                    if (it == "incoming") TransactionDirection.INCOMING else TransactionDirection.OUTGOING
                }

                val transactions = db!!.listTransactions(
                    mintUrl = null,
                    direction = txDirection,
                    unit = null
                )

                val result = JSONArray()
                transactions.forEach { tx ->
                    val txJson = JSONObject().apply {
                        put("id", tx.id.toString())
                        put("direction", if (tx.direction == TransactionDirection.INCOMING) "incoming" else "outgoing")
                        put("amount", tx.amount.value.toLong())
                        put("mint_url", tx.mintUrl.url)
                        put("timestamp", tx.timestamp)
                        tx.fee?.let { put("fee", it.value.toLong()) }
                        tx.memo?.let { put("memo", it) }
                    }
                    result.put(txJson)
                }

                withContext(Dispatchers.Main) {
                    promise.resolve(result.toString())
                }
            } catch (e: FfiException) {
                val (code, message) = mapFfiException(e)
                Log.e(TAG, "listTransactions error: $message", e)
                withContext(Dispatchers.Main) {
                    promise.reject(code, message, e)
                }
            } catch (e: Exception) {
                Log.e(TAG, "listTransactions error", e)
                withContext(Dispatchers.Main) {
                    promise.reject("LIST_TRANSACTIONS_ERROR", e.message, e)
                }
            }
        }
    }

    // ========================================================================
    // Direct Proof Access (Offline Send)
    // ========================================================================

    @ReactMethod
    fun getUnspentProofs(mintUrl: String, promise: Promise) {
        if (!isInitialized || db == null) {
            promise.reject("NO_WALLET", "Wallet not initialized")
            return
        }

        scope.launch {
            try {
                val url = MintUrl(mintUrl)
                val proofInfos = db!!.getProofs(
                    mintUrl = url,
                    unit = CurrencyUnit.Sat,
                    state = listOf(ProofState.UNSPENT),
                    spendingConditions = null
                )

                val result = JSONArray()
                proofInfos.forEach { info ->
                    result.put(JSONObject().apply {
                        put("amount", info.proof.amount.value.toLong())
                        put("secret", info.proof.secret)
                        put("c", info.proof.c)
                        put("keyset_id", info.proof.keysetId)
                        put("y", info.y.hex)
                    })
                }

                withContext(Dispatchers.Main) {
                    promise.resolve(result.toString())
                }
            } catch (e: FfiException) {
                val (code, message) = mapFfiException(e)
                Log.e(TAG, "getUnspentProofs error: $message", e)
                withContext(Dispatchers.Main) {
                    promise.reject(code, message, e)
                }
            } catch (e: Exception) {
                Log.e(TAG, "getUnspentProofs error", e)
                withContext(Dispatchers.Main) {
                    promise.reject("GET_PROOFS_ERROR", e.message, e)
                }
            }
        }
    }

    @ReactMethod
    fun removeProofs(proofsYJson: String, promise: Promise) {
        if (!isInitialized || db == null) {
            promise.reject("NO_WALLET", "Wallet not initialized")
            return
        }

        scope.launch {
            try {
                val yArray = JSONArray(proofsYJson)
                if (yArray.length() == 0) {
                    withContext(Dispatchers.Main) {
                        promise.resolve(null)
                    }
                    return@launch
                }

                val ys = (0 until yArray.length()).map { i ->
                    PublicKey(yArray.getString(i))
                }

                db!!.updateProofs(added = emptyList(), removedYs = ys)

                withContext(Dispatchers.Main) {
                    promise.resolve(null)
                }
            } catch (e: FfiException) {
                val (code, message) = mapFfiException(e)
                Log.e(TAG, "removeProofs error: $message", e)
                withContext(Dispatchers.Main) {
                    promise.reject(code, message, e)
                }
            } catch (e: Exception) {
                Log.e(TAG, "removeProofs error", e)
                withContext(Dispatchers.Main) {
                    promise.reject("REMOVE_PROOFS_ERROR", e.message, e)
                }
            }
        }
    }

    // ========================================================================
    // Cleanup
    // ========================================================================

    override fun onCatalystInstanceDestroy() {
        scope.cancel()
        repo = null
        db = null
        wallets.clear()
        preparedSends.clear()
        isInitialized = false
    }
}
