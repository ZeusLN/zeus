package app.zeusln.zeus.cashudevkit

import android.util.Log
import com.facebook.react.bridge.*
import kotlinx.coroutines.*
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.Inet4Address
import java.net.InetAddress
import java.net.URL
import java.net.URLEncoder
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

    // Guards the swap of the handle set above. destroy() is idempotent, so
    // this only has to keep two teardowns from taking the same handles, and
    // a teardown from racing an initialization
    private val handleLock = Any()

    companion object {
        private const val TAG = "CashuDevKitModule"
    }

    override fun getName(): String = "CashuDevKitModule"

    // ========================================================================
    // Handle Lifecycle
    // ========================================================================

    /**
     * Removes every CDK handle from the module's state and returns them for
     * destruction. Call under handleLock.
     *
     * Order matters: the per-mint Wallet handles and any outstanding
     * PreparedSend hold their own references to the repository and database,
     * so the SQLite connection is not released until those are destroyed
     * first.
     */
    private fun takeHandlesLocked(): List<Disposable> {
        val taken = mutableListOf<Disposable>()
        taken.addAll(preparedSends.values)
        preparedSends.clear()
        taken.addAll(wallets.values)
        wallets.clear()
        repo?.let { taken.add(it) }
        repo = null
        db?.let { taken.add(it) }
        db = null
        isInitialized = false
        currentDbPath = null
        return taken
    }

    private fun destroyHandles(handles: List<Disposable>) {
        for (handle in handles) {
            try {
                handle.destroy()
            } catch (e: Exception) {
                // Best effort: one handle failing to release must not strand
                // the others, and destroy() is a no-op if it already ran
                Log.w(
                    TAG,
                    "destroyHandles: failed to destroy ${handle.javaClass.simpleName}",
                    e
                )
            }
        }
    }

    /**
     * Runs [block] on a transient CDK handle and destroys the handle after,
     * success or not.
     *
     * Same reasoning as disposeHandles: a prepared melt or send holds its own
     * reference to the wallet's database, so one left for the Cleaner keeps
     * the SQLite connection alive past a teardown that destroyed everything
     * the module tracks. Inline so suspending calls inside the block stay
     * legal.
     */
    private inline fun <T : Disposable, R> T.useHandle(block: (T) -> R): R {
        try {
            return block(this)
        } finally {
            destroyHandles(listOf(this))
        }
    }

    /**
     * Destroys every live CDK handle and resets the module to uninitialized.
     *
     * The uniffi bindings are Disposable: dropping the Kotlin reference alone
     * leaves the Rust object - and the SQLite connection it owns - alive
     * until the Cleaner next runs after a GC. An unlinked database file
     * therefore keeps its blocks allocated for an unbounded time, which is
     * the reachability the wipe paths exist to close. iOS has no equivalent
     * gap: ARC frees the handle as soon as the last reference goes.
     *
     * In-flight work is aborted rather than left to finish. uniffi keeps an
     * already-started call alive (the Rust side holds its own reference), but
     * the next call on a destroyed handle throws IllegalStateException, which
     * the per-method catch turns into a promise rejection. That is the
     * intended outcome: every caller here has either torn the wallet down or
     * switched to a different one, and the methods below re-read repo/db
     * between steps, so letting a half-finished flow continue would mean
     * operating on a mix of the outgoing and incoming wallet's state.
     */
    private fun disposeHandles() {
        destroyHandles(synchronized(handleLock) { takeHandlesLocked() })
    }

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

        // NUT-11 tags must be omitted entirely when they don't apply. Emitting
        // them with a value of 0 (["locktime", "0"], ["n_sigs", "0"],
        // ["n_sigs_refund", "0"]) produces tokens that mints such as CDK refuse
        // to redeem, and a zero locktime marks the lock as already expired.
        val locktime = optionalPositiveULong(data, "locktime")
        val numSigs = optionalPositiveULong(data, "num_sigs")
        val numSigsRefund = optionalPositiveULong(data, "num_sigs_refund")

        val pubkeys = data.optJSONArray("pubkeys")?.let { arr ->
            (0 until arr.length()).mapNotNull { i ->
                arr.optString(i).takeIf { it.isNotEmpty() }
            }
        } ?: emptyList()

        val refundKeys = data.optJSONArray("refund_keys")?.let { arr ->
            (0 until arr.length()).mapNotNull { i ->
                arr.optString(i).takeIf { it.isNotEmpty() }
            }
        } ?: emptyList()

        val sigFlag: UByte = if (data.optString("sig_flag") == "SigAll") 1.toUByte() else 0.toUByte()

        // NUT-11: "If n_sigs or n_sigs_refund ... exceeds the total number of
        // keys in its pathway, the P2PK secret is malformed and the Proof
        // MUST be rejected as unspendable." The mint only enforces this at
        // redemption time, so an out-of-range value here would otherwise
        // silently mint a token nobody can ever fully sign for. Main pathway
        // has `1 (pubkey) + pubkeys.size` possible signers; refund pathway
        // has `refundKeys.size`. Compared in the unsigned domain rather than
        // via toInt(), which truncates to the low 32 bits (e.g. 4294967296
        // -> 0) and could let a huge num_sigs wrap into a small, passing
        // value instead of being rejected.
        val maxMainSigs = 1 + pubkeys.size
        require(numSigs == null || numSigs <= maxMainSigs.toULong()) {
            "num_sigs ($numSigs) exceeds the number of available pubkeys ($maxMainSigs)"
        }
        require(numSigsRefund == null || numSigsRefund <= refundKeys.size.toULong()) {
            "num_sigs_refund ($numSigsRefund) exceeds the number of available refund_keys (${refundKeys.size})"
        }

        return SpendingConditions.P2pk(
            pubkey = pubkeyHex,
            conditions = Conditions(
                locktime = locktime,
                pubkeys = pubkeys,
                refundKeys = refundKeys,
                numSigs = numSigs,
                sigFlag = sigFlag,
                numSigsRefund = numSigsRefund
            )
        )
    }

    /**
     * Returns the value at [key] only when it is a positive integer, so that
     * optional NUT-11 tags stay absent instead of being serialized as 0.
     */
    private fun optionalPositiveULong(json: JSONObject, key: String): ULong? {
        if (!json.has(key) || json.isNull(key)) return null
        return readPositiveLong(json, key).takeIf { it > 0L }?.toULong()
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
        // Try the (URL, unit)-keyed lookup first and only create on a miss:
        // creating unconditionally would overwrite a wallet configured by
        // addMint (e.g. a custom targetProofCount) with a default-config
        // handle. The FFI does not expose the unit-keyed hasWallet, so a
        // failed get is the miss signal; createWallet is a no-network map
        // insert, and a concurrent double-create is a benign same-config
        // overwrite
        val wallet = try {
            currentRepo.getWallet(url, walletUnit)
        } catch (e: FfiException) {
            currentRepo.createWallet(url, walletUnit, null)
            currentRepo.getWallet(url, walletUnit)
        }
        // Insert under handleLock with a staleness check: this is the one
        // map write that can land after a teardown drained the map (the repo
        // was read before the create above, outside the lock), and an
        // unconditional insert would park an undestroyed Wallet - holding
        // its own reference to the closed database - in the map until the
        // next initializeWallet drains it, briefly reopening the
        // reachability window the wipe paths exist to close. The insert is
        // also first-wins: two callers racing the first access to the same
        // mint both reach here with a fresh handle, and an overwrite would
        // orphan the earlier one to the Cleaner the same way
        val winner = synchronized(handleLock) {
            if (repo === currentRepo) {
                wallets[normalized] ?: wallet.also {
                    wallets[normalized] = wallet
                }
            } else {
                null
            }
        }
        if (winner == null) {
            destroyHandles(listOf(wallet))
            throw FfiException.Internal("Wallet not initialized")
        }
        if (winner !== wallet) {
            destroyHandles(listOf(wallet))
        }
        return winner
    }

    @Volatile
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
                val database = WalletSqliteDatabase(dbPath)

                val currencyUnit = parseCurrencyUnit(unit)

                // WalletSqliteDatabase conforms to WalletDatabase; passing
                // it via WalletStore.Custom keeps the same handle available
                // for the direct database methods below
                val newRepo = WalletRepository(
                    mnemonic = mnemonic,
                    store = WalletStore.Custom(database)
                )

                // Swap atomically and destroy what we replaced. Switching
                // wallets does not restart the app, so without this the
                // outgoing wallet's SQLite connection stays open for the rest
                // of the session and its database file survives deletion as
                // unreclaimed blocks. Building the new handles first keeps a
                // construction failure from tearing down a working wallet.
                val outgoing = synchronized(handleLock) {
                    val previous = takeHandlesLocked()
                    db = database
                    repo = newRepo
                    walletUnit = currencyUnit
                    // Publish the path only now that these are the handles
                    // actually open: closeWalletDatabase keys its
                    // dispose-before-unlink decision off this path, so one
                    // published before construction succeeded would point
                    // the guard at a database the module never opened
                    currentDbPath = dbPath
                    isInitialized = true
                    previous
                }
                destroyHandles(outgoing)

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
                // 0 is the JS sentinel for "use default"; match iOS, which
                // maps it to null rather than a target of zero proofs
                val count = targetProofCount?.takeIf { it > 0 }?.toUInt()
                repo.createWallet(url, walletUnit, count)

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
                // load_wallets creates one wallet per supported unit, so
                // drop every unit's wallet for this mint, not just the
                // configured one: a leftover handle keeps the mint in
                // getMintUrls, and the persisted list then re-adds the
                // mint at the next boot's reconcile. Compare
                // case-insensitively since cdk canonicalizes scheme and
                // host casing. removeWallet failures are tolerated (parity
                // with the non-throwing 0.14.x removeMint)
                repo.getWallets().forEach { wallet ->
                    val wUrl = runCatching { wallet.mintUrl() }.getOrNull() ?: return@forEach
                    if (!wUrl.url.equals(normalized, ignoreCase = true)) return@forEach
                    runCatching { repo.removeWallet(wUrl, wallet.unit()) }
                }
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
                // getBalances() is keyed by (mint URL, unit) and load_wallets
                // creates a wallet per supported unit, so only fold this
                // wallet's unit; other units must not count toward the total
                val balances = repo.getBalances()
                var total: ULong = 0UL
                balances.forEach { (key, amount) ->
                    if (key.unit == walletUnit) total += amount.value
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
                    if (key.unit != walletUnit) return@forEach
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
     * Reject loopback, private (RFC1918), link-local and other internal hosts
     * for server-supplied mint URLs. Matches on the literal host only (no DNS
     * resolution) to avoid a rebinding/latency side channel; this is
     * defense-in-depth on top of the JS-side configured-mint binding.
     */
    private fun isDisallowedMintHost(host: String?): Boolean {
        if (host.isNullOrBlank()) return true
        val h = host.trim().trimStart('[').trimEnd(']').lowercase()
        if (h == "localhost" || h.endsWith(".localhost")) return true
        // A host containing ':' can only be an IPv6 literal (hostnames
        // cannot contain it), so parse it numerically instead of
        // prefix-matching one spelling: mapped (::ffff:127.0.0.1),
        // hex-mapped (::ffff:7f00:1) and zero-expanded (0:0:0:0:0:0:0:1)
        // forms of the same internal address all normalize to the same
        // bytes. This still involves no DNS - the brackets force
        // InetAddress to treat the input as a literal or throw.
        if (h.contains(':')) return isDisallowedIpv6Literal(h)
        return isDisallowedIpv4(h)
    }

    // IPv4 ranges: 127/8, 10/8, 169.254/16, 172.16/12, 192.168/16, 0/8
    private fun isDisallowedIpv4(h: String): Boolean {
        return h.startsWith("127.") ||
            h.startsWith("10.") ||
            h.startsWith("169.254.") ||
            h.startsWith("192.168.") ||
            h.startsWith("0.") ||
            Regex("^172\\.(1[6-9]|2[0-9]|3[0-1])\\.").containsMatchIn(h)
    }

    private fun isDisallowedIpv6Literal(literal: String): Boolean {
        val addr = try {
            InetAddress.getByName("[$literal]")
        } catch (e: Exception) {
            // Not parseable as an IPv6 literal and not a valid hostname
            // either: fail closed
            return true
        }
        // IPv4-mapped literals parse to an Inet4Address in any spelling;
        // hold the embedded address to the same rules as a dotted host
        if (addr is Inet4Address) {
            return isDisallowedIpv4(addr.hostAddress ?: return true)
        }
        if (addr.isLoopbackAddress || addr.isLinkLocalAddress ||
            addr.isSiteLocalAddress || addr.isAnyLocalAddress
        ) {
            return true
        }
        // fc00::/7 unique-local: no InetAddress predicate covers it
        return (addr.address[0].toInt() and 0xfe) == 0xfc
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

                // Security: this issues a raw HTTP GET against a mint URL that
                // originates from a ZEUS Pay socket event. Refuse cleartext and
                // internal/loopback/link-local targets so a forged event cannot
                // downgrade the fetch or drive the device into an SSRF against
                // the local network. quoteId is percent-encoded so it cannot
                // alter the request path.
                val parsed = try {
                    URL(normalizedUrl)
                } catch (e: Exception) {
                    withContext(Dispatchers.Main) {
                        promise.reject("INVALID_URL", "Invalid mint URL: $mintUrl")
                    }
                    return@launch
                }
                if (!parsed.protocol.equals("https", ignoreCase = true) ||
                    isDisallowedMintHost(parsed.host)
                ) {
                    Log.e(TAG, "checkExternalMintQuote: refusing unsafe mint URL $mintUrl")
                    withContext(Dispatchers.Main) {
                        promise.reject(
                            "UNSAFE_MINT_URL",
                            "Refusing to contact non-HTTPS or internal mint host: $mintUrl"
                        )
                    }
                    return@launch
                }

                val encodedQuoteId = URLEncoder.encode(quoteId, "UTF-8")
                val quoteUrl = "$normalizedUrl/v1/mint/quote/bolt11/$encodedQuoteId"

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
                val url = MintUrl(normalizeMintUrl(mintUrl))
                val amt = Amount(amount.toLong().toULong())

                // Map state string to QuoteState enum
                val quoteState = when (state.uppercase()) {
                    "UNPAID" -> QuoteState.UNPAID
                    "PAID" -> QuoteState.PAID
                    "PENDING" -> QuoteState.PENDING
                    "ISSUED" -> QuoteState.ISSUED
                    // Fail closed: never assume PAID for an unrecognized state.
                    else -> {
                        withContext(Dispatchers.Main) {
                            promise.reject(
                                "INVALID_QUOTE_STATE",
                                "Unrecognized mint quote state: $state"
                            )
                        }
                        return@launch
                    }
                }

                // Storing a key equal to cdk's seed prefix on the quote
                // requires cdk >= 0.17.4: earlier versions claim it as a
                // legacy NpubCash key and scrub it mid-mint-saga, stranding
                // the minted funds (cashubtc/cdk#2335).
                val storedSecretKey = secretKey?.takeIf { it.isNotEmpty() }

                // Create the MintQuote object
                // For external quotes that are PAID, we set amountPaid = amount
                val zeroAmount = Amount(0UL)
                fun makeQuote(version: UInt) = MintQuote(
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
                    secretKey = storedSecretKey,
                    usedByOperation = null,
                    version = version
                )

                Log.d(TAG, "addExternalMintQuote: Adding quote $quoteId to database")

                // addMintQuote is a CAS upsert: the update only applies while
                // the stored row still has the version we write, and a failed
                // mint attempt leaves the row bumped by the saga's claim.
                // Reuse the stored version (0 for a fresh insert) so retries
                // do not die with ConcurrentUpdate before minting
                val storedVersion = db!!.getMintQuote(quoteId)?.version ?: 0u
                try {
                    db!!.addMintQuote(makeQuote(storedVersion))
                } catch (e: FfiException) {
                    // Lost the CAS race between read and write; re-read and
                    // retry once
                    val retryVersion = db!!.getMintQuote(quoteId)?.version ?: 0u
                    db!!.addMintQuote(makeQuote(retryVersion))
                }

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
                // Parse spending conditions if provided. Only tolerate a
                // malformed JSON *blob* silently (treat as "no conditions");
                // a validation failure inside well-formed conditions (e.g. an
                // impossible num_sigs) must fail loudly instead of quietly
                // minting an unlocked proof the caller never asked for.
                val conditions = conditionsJson?.let { json ->
                    val parsed = runCatching { JSONObject(json) }.getOrNull()
                        ?: return@let null
                    parseP2PKConditions(parsed)
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
                val melted = wallet.prepareMelt(quoteId).useHandle { it.confirm() }

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
                val melted = wallet.prepareMeltProofs(quote.id, mintProofs)
                    .useHandle { it.confirm() }

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
                // Always clean up prepared send, whether success or failure.
                // Destroy it rather than only dropping the reference: the
                // handle holds the wallet's database open until the Cleaner
                // runs (see disposeHandles)
                preparedSends.remove(preparedSendId)?.let {
                    destroyHandles(listOf(it))
                }
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
                // Always clean up prepared send, whether success or failure.
                // Destroy it rather than only dropping the reference: the
                // handle holds the wallet's database open until the Cleaner
                // runs (see disposeHandles)
                preparedSends.remove(preparedSendId)?.let {
                    destroyHandles(listOf(it))
                }
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
    // Database Deletion
    // ========================================================================

    /**
     * Closes the repository/database handles and deletes the proof db (and its
     * WAL/SHM sidecars) from disk. Used by "Delete Cashu data" so plaintext
     * bearer proofs do not survive the user's deletion. disposeHandles()
     * destroys the uniffi handles rather than only dropping the references, so
     * the SQLite connection is closed before the files are unlinked: unlinking
     * under a live connection succeeds but leaves the blocks allocated to it.
     * Resolves false if no database was opened this session.
     */
    @ReactMethod
    fun deleteWalletDatabase(promise: Promise) {
        // Read the path in the same critical section that takes the handles:
        // read outside it, a concurrent initializeWallet could swap wallets
        // in between, disposing one wallet's handles and unlinking another's
        // files
        val (path, taken) = synchronized(handleLock) {
            Pair(currentDbPath, takeHandlesLocked())
        }
        destroyHandles(taken)
        if (path == null) {
            promise.resolve(false)
            return
        }
        for (p in listOf(path, "$path-wal", "$path-shm")) {
            try {
                File(p).takeIf { it.exists() }?.delete()
            } catch (e: Exception) {
                Log.w(TAG, "deleteWalletDatabase: failed to delete $p", e)
            }
        }
        promise.resolve(true)
    }

    /**
     * Disposes the open CDK handles if, and only if, the database currently
     * open is [dbFileName], compared by basename because the JS side cannot
     * reconstruct the absolute path this module resolves. The compare and the
     * handle swap happen under one handleLock acquisition, so a wallet switch
     * cannot land between the check and the teardown - the check-then-act gap
     * a JS-side getDatabasePath() + deleteWalletDatabase() pair has, where a
     * switch in the gap retargets the dispose (and its unlink) at the newly
     * opened wallet's database. Unlinks nothing: the caller owns file
     * deletion. Resolves true if the handles were disposed, false when no
     * database or a different wallet's is open.
     */
    @ReactMethod
    fun closeWalletDatabase(dbFileName: String, promise: Promise) {
        val taken = synchronized(handleLock) {
            val open = currentDbPath
            if (open != null && File(open).name == dbFileName) {
                takeHandlesLocked()
            } else {
                null
            }
        }
        if (taken == null) {
            promise.resolve(false)
            return
        }
        destroyHandles(taken)
        promise.resolve(true)
    }

    // ========================================================================
    // Cleanup
    // ========================================================================

    override fun onCatalystInstanceDestroy() {
        scope.cancel()
        // Destroy, not just dereference: a bridge teardown that is not a
        // process restart (an iOS-style JS reload, a dev reload) would
        // otherwise leave the previous instance's connection open
        disposeHandles()
    }
}
