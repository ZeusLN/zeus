package app.zeusln.zeus.cashudevkit

import android.util.Log
import com.facebook.react.bridge.*
import kotlinx.coroutines.*
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

import org.cashudevkit.*
import uniffi.zeus_cashu_restore.restoreFromSeed as zeusRestoreFromSeed
import uniffi.zeus_cashu_restore.RestoreException

/**
 * CashuDevKit Native Module for React Native
 * Provides bridge to CDK FFI bindings
 */
class CashuDevKitModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var wallet: MultiMintWallet? = null
    private var db: WalletSqliteDatabase? = null
    private val preparedSends = mutableMapOf<String, PreparedSend>()
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

    /**
     * Returns the initialized wallet or rejects with NO_WALLET error and returns null
     */
    private fun getInitializedWallet(promise: Promise): MultiMintWallet? {
        if (!isInitialized || wallet == null) {
            promise.reject("NO_WALLET", "Wallet not initialized")
            return null
        }
        return wallet
    }

    private fun getDatabasePath(): String {
        val filesDir = reactContext.filesDir
        return File(filesDir, "cashu_wallet.db").absolutePath
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

    private fun proofStateToString(state: ProofState): String {
        return when (state) {
            ProofState.UNSPENT -> "Unspent"
            ProofState.PENDING -> "Pending"
            ProofState.SPENT -> "Spent"
            ProofState.RESERVED -> "Reserved"
            ProofState.PENDING_SPENT -> "PendingSpent"
        }
    }

    private fun mapFfiException(e: FfiException): Pair<String, String> {
        return when (e) {
            is FfiException.Generic -> "GENERIC_ERROR" to (e.message ?: "Generic error")
            is FfiException.AmountOverflow -> "AMOUNT_OVERFLOW" to (e.message ?: "Amount overflow")
            is FfiException.PaymentFailed -> "PAYMENT_FAILED" to (e.message ?: "Payment failed")
            is FfiException.PaymentPending -> "PAYMENT_PENDING" to (e.message ?: "Payment pending")
            is FfiException.InsufficientFunds -> "INSUFFICIENT_FUNDS" to (e.message ?: "Insufficient funds")
            is FfiException.Database -> "DATABASE_ERROR" to (e.message ?: "Database error")
            is FfiException.Network -> "NETWORK_ERROR" to (e.message ?: "Network error")
            is FfiException.InvalidToken -> "INVALID_TOKEN" to (e.message ?: "Invalid token")
            is FfiException.Wallet -> "WALLET_ERROR" to (e.message ?: "Wallet error")
            is FfiException.KeysetUnknown -> "KEYSET_UNKNOWN" to (e.message ?: "Keyset unknown")
            is FfiException.UnitNotSupported -> "UNIT_NOT_SUPPORTED" to (e.message ?: "Unit not supported")
            is FfiException.InvalidMnemonic -> "INVALID_MNEMONIC" to (e.message ?: "Invalid mnemonic")
            is FfiException.InvalidUrl -> "INVALID_URL" to (e.message ?: "Invalid URL")
            is FfiException.DivisionByZero -> "DIVISION_BY_ZERO" to (e.message ?: "Division by zero")
            is FfiException.Amount -> "AMOUNT_ERROR" to (e.message ?: "Amount error")
            is FfiException.RuntimeTaskJoin -> "RUNTIME_ERROR" to (e.message ?: "Runtime error")
            is FfiException.InvalidHex -> "INVALID_HEX" to (e.message ?: "Invalid hex")
            is FfiException.InvalidCryptographicKey -> "INVALID_KEY" to (e.message ?: "Invalid key")
            is FfiException.Serialization -> "SERIALIZATION_ERROR" to (e.message ?: "Serialization error")
            else -> "UNKNOWN_ERROR" to (e.message ?: "Unknown error")
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
            put("mint_url", quote.mintUrl.toString())
        }
    }

    private fun encodeMeltQuote(quote: MeltQuote): JSONObject {
        return JSONObject().apply {
            put("id", quote.id)
            put("amount", quote.amount.value)
            put("unit", currencyUnitToString(quote.unit))
            put("request", quote.request)
            put("fee_reserve", quote.feeReserve.value)
            put("state", quoteStateToString(quote.state))
            put("expiry", quote.expiry)
            quote.paymentPreimage?.let { put("payment_preimage", it) }
        }
    }

    private fun encodeMelted(melted: Melted): JSONObject {
        return JSONObject().apply {
            put("state", quoteStateToString(melted.state))
            put("amount", melted.amount.value)
            put("fee_paid", melted.feePaid.value)
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
            put("amount", proof.amount.value)
            put("secret", proof.secret)
            put("c", proof.c)
            put("keyset_id", proof.keysetId)
        }
    }

    private suspend fun encodeToken(token: Token): JSONObject {
        val mintUrl = token.mintUrl();
        val keysets = wallet!!.getMintKeysets(mintUrl) ?: emptyList()
        val proofs = token.proofs(keysets)
        val proofsArray = JSONArray()
        proofs.forEach { proof ->
            proofsArray.put(encodeProof(proof))
        }
        return JSONObject().apply {
            put("encoded", token.encode())
            put("value", token.value().value)
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
        promise.resolve(getDatabasePath())
    }

    // ========================================================================
    // Wallet Management
    // ========================================================================

    @ReactMethod
    fun initializeWallet(mnemonic: String, unit: String, promise: Promise) {
        scope.launch {
            try {
                val dbPath = getDatabasePath()
                val database = WalletSqliteDatabase(dbPath)
                db = database

                val currencyUnit = parseCurrencyUnit(unit)

                val newWallet = MultiMintWallet(
                    unit = currencyUnit,
                    mnemonic = mnemonic,
                    db = database
                )

                wallet = newWallet
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
        val wallet = getInitializedWallet(promise) ?: return

        scope.launch {
            try {
                val url = MintUrl(mintUrl)
                wallet.addMint(url, targetProofCount?.toUInt())

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
        val wallet = getInitializedWallet(promise) ?: return

        scope.launch {
            try {
                val url = MintUrl(mintUrl)
                wallet.removeMint(url)
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
        val wallet = getInitializedWallet(promise) ?: return

        scope.launch {
            try {
                val urls = wallet.getMintUrls() ?: emptyList()

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
        val wallet = getInitializedWallet(promise) ?: return

        scope.launch {
            try {
                val balances = wallet.getBalances() ?: emptyMap()
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
        val wallet = getInitializedWallet(promise) ?: return

        scope.launch {
            try {
                val balances = wallet.getBalances() ?: emptyMap()
                val result = JSONObject()
                balances.forEach { (mintUrl, amount) ->
                    result.put(mintUrl, amount.value)
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
        val wallet = getInitializedWallet(promise) ?: return

        scope.launch {
            try {
                val url = MintUrl(mintUrl)
                val keysets = wallet.getMintKeysets(url) ?: emptyList()

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
        val wallet = getInitializedWallet(promise) ?: return

        scope.launch {
            try {
                val url = MintUrl(mintUrl)
                val amt = Amount(amount.toLong().toULong())
                val quote = wallet!!.mintQuote(url, amt, description)

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
        val wallet = getInitializedWallet(promise) ?: return

        scope.launch {
            try {
                val url = MintUrl(mintUrl)
                val quote = wallet!!.checkMintQuote(url, quoteId)

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

                // Create the MintQuote object
                // For external quotes that are PAID, we set amountPaid = amount
                // Include secretKey for P2PK-locked quotes
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
                    paymentMethod = PaymentMethod.Bolt11,
                    secretKey = secretKey
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
        val wallet = getInitializedWallet(promise) ?: return

        scope.launch {
            try {
                val url = MintUrl(mintUrl)

                Log.d(TAG, "mintExternal: Attempting to mint quote $quoteId from $mintUrl")

                val proofs = wallet!!.mint(url, quoteId, null)

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
        val wallet = getInitializedWallet(promise) ?: return

        scope.launch {
            try {
                val url = MintUrl(mintUrl)

                // Parse spending conditions if provided
                val conditions = conditionsJson?.let { json ->
                    runCatching {
                        parseP2PKConditions(JSONObject(json))
                    }.getOrNull()
                }
                val proofs = wallet!!.mint(url, quoteId, conditions)

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
        val wallet = getInitializedWallet(promise) ?: return

        scope.launch {
            try {
                val url = MintUrl(mintUrl)
                val quote = wallet!!.meltQuote(url, request, null)

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
        val wallet = getInitializedWallet(promise) ?: return

        scope.launch {
            try {
                val url = MintUrl(mintUrl)
                val quote = wallet!!.checkMeltQuote(url, quoteId)

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
        val wallet = getInitializedWallet(promise) ?: return

        scope.launch {
            try {
                val url = MintUrl(mintUrl)
                val melted = wallet!!.meltWithMint(url, quoteId)

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

    // ========================================================================
    // Token Operations
    // ========================================================================

    @ReactMethod
    fun prepareSend(mintUrl: String, amount: Double, optionsJson: String?, promise: Promise) {
        val wallet = getInitializedWallet(promise) ?: return

        scope.launch {
            try {
                val url = MintUrl(mintUrl)
                val amt = Amount(amount.toLong().toULong())

                // Parse options if provided; be defensive so malformed JSON doesn't crash
                var includeFee = false
                var conditions: SpendingConditions? = null
                optionsJson?.let { raw ->
                    val parsed = runCatching { JSONObject(raw) }.getOrNull() ?: return@let

                    includeFee = parsed.optBoolean("include_fee", false)

                    // Parse spending conditions (P2PK) if provided
                    parsed.optJSONObject("conditions")?.let { cond ->
                        conditions = parseP2PKConditions(cond)
                    }
                }
    
                val innerSendOptions = SendOptions(
                    memo = null,
                    conditions = conditions,
                    amountSplitTarget = SplitTarget.None,
                    sendKind = SendKind.OnlineExact,
                    includeFee = includeFee,
                    maxProofs = 0U,
                    metadata = emptyMap()
                )

                val sendOptions = MultiMintSendOptions(
                    allowTransfer = false,
                    maxTransferAmount = Amount(0UL),
                    allowedMints = emptyList(),
                    excludedMints = emptyList(),
                    sendOptions = innerSendOptions
                )

                val prepared = wallet!!.prepareSend(url, amt, sendOptions)
                
                val preparedId = prepared.id()

                preparedSends[preparedId] = prepared

                withContext(Dispatchers.Main) {
                    promise.resolve(preparedId)
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
        val wallet = getInitializedWallet(promise) ?: return

        scope.launch {
            try {
                val token = Token.fromString(encodedToken)

                // Parse options if provided; be defensive so malformed JSON doesn't crash
                var innerReceiveOptions = ReceiveOptions(
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

                    innerReceiveOptions = ReceiveOptions(
                        amountSplitTarget = SplitTarget.None,
                        p2pkSigningKeys = p2pkKeys ?: emptyList(),
                        preimages = preimages,
                        metadata = emptyMap()
                    )
                }

                val receiveOptions = MultiMintReceiveOptions(
                    allowUntrusted = false,
                    transferToMint = null,
                    receiveOptions = innerReceiveOptions
                )

                val amount = wallet!!.receive(token, receiveOptions)

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
        val wallet = getInitializedWallet(promise) ?: return

        scope.launch {
            try {
                val url = MintUrl(mintUrl)
                val amount = wallet!!.restore(url)

                withContext(Dispatchers.Main) {
                    promise.resolve(amount.value.toDouble())
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
        val wallet = getInitializedWallet(promise) ?: return

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

                val innerReceiveOptions = ReceiveOptions(
                    amountSplitTarget = SplitTarget.None,
                    p2pkSigningKeys = emptyList(),
                    preimages = emptyList(),
                    metadata = emptyMap()
                )
                val receiveOptions = MultiMintReceiveOptions(
                    allowUntrusted = true,
                    transferToMint = null,
                    receiveOptions = innerReceiveOptions
                )

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
        val wallet = getInitializedWallet(promise) ?: return

        scope.launch {
            try {
                val url = MintUrl(mintUrl)

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
                        dleq = null
                    )
                    proofs.add(proof)
                }

                val states = wallet!!.checkProofsState(url, proofs)

                val result = JSONArray()
                states.forEach { state ->
                    result.put(JSONObject().put("state", proofStateToString(state)))
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
        val wallet = getInitializedWallet(promise) ?: return

        scope.launch {
            try {
                val url = MintUrl(mintUrl)
                val amt = amount?.let { Amount(it.toLong().toULong()) } ?: Amount(0UL)

                // Note: BOLT12 mint quote uses the same mintQuote API
                val quote = wallet!!.mintQuote(url, amt, description)

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
        val wallet = getInitializedWallet(promise) ?: return

        scope.launch {
            try {
                val url = MintUrl(mintUrl)
                val quote = wallet!!.meltQuote(url, request, null)

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
        val wallet = getInitializedWallet(promise) ?: return

        scope.launch {
            try {
                val url = MintUrl(mintUrl)
                val quote = wallet!!.meltHumanReadableQuote(url, address, amountMsat.toLong().toULong())

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
        if (!isInitialized || wallet == null || db == null) {
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
                        put("amount", tx.amount.value)
                        put("mint_url", tx.mintUrl.toString())
                        put("timestamp", tx.timestamp)
                        tx.fee?.let { put("fee", it.value) }
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
    // Cleanup
    // ========================================================================

    override fun onCatalystInstanceDestroy() {
        scope.cancel()
        wallet = null
        db = null
        preparedSends.clear()
        isInitialized = false
    }
}
