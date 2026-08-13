import Foundation
import CommonCrypto
import CashuDevKit
import ZeusCashuRestore

/// CashuDevKit Native Module for React Native
/// Provides bridge to CDK FFI bindings
///
/// CDK 0.15+ replaced the MultiMintWallet with a WalletRepository plus
/// per-mint Wallet objects, and one-shot melts with a two-phase
/// prepare/confirm flow. This module adapts the new API behind the
/// pre-existing bridge contract: method names, parameters and resolved
/// JSON shapes are unchanged from the 0.14.x module.
@objc(CashuDevKitModule)
class CashuDevKitModule: RCTEventEmitter {

    // MARK: - Properties

    private var repo: WalletRepository?
    private var db: WalletSqliteDatabase?
    private var walletUnit: CurrencyUnit = .sat
    private var wallets: [String: Wallet] = [:]
    private var preparedSends: [String: PreparedSend] = [:]
    private var isInitialized: Bool = false

    // Serial queue for thread-safe access to the properties above
    private let walletQueue = DispatchQueue(label: "app.zeusln.cashudevkit.wallet")

    // MARK: - Module Setup

    @objc
    override static func moduleName() -> String! {
        return "CashuDevKitModule"
    }

    @objc
    override static func requiresMainQueueSetup() -> Bool {
        return false
    }

    // MARK: - Helper Methods

    /// Parse P2PK spending conditions from JSON dictionary
    private func parseP2PKConditions(from json: [String: Any]) -> SpendingConditions? {
       guard let kind = json["kind"] as? String,
          kind == "P2PK",
          let condData = json["data"] as? [String: Any],
          let pubkey = condData["pubkey"] as? String,
          !pubkey.isEmpty else {
        return nil
    }

      let locktime: UInt64 = {
        if let lt = condData["locktime"] as? NSNumber {
            return lt.uint64Value
        }
        return 0
    }()

    let refundKeys: [String] = {
        if let keys = condData["refund_keys"] as? [String] {
            return keys.filter { !$0.isEmpty }
        }
        return []
    }()

    let conditions = Conditions(
        locktime: locktime,
        pubkeys: [],
        refundKeys: refundKeys,
        numSigs: 0,
        sigFlag: 0,
        numSigsRefund: 0
    )

    return .p2pk(pubkey: pubkey, conditions: conditions)
  }

    private func readPositiveUInt64(from json: [String: Any], key: String) -> UInt64 {
        guard let raw = json[key] else {
            return 0
        }

        if raw is Bool {
            return 0
        }

        if let number = raw as? NSNumber {
            let value = number.int64Value
            return value > 0 ? UInt64(value) : 0
        }

        if let string = raw as? String,
           let value = UInt64(string),
           value > 0 {
            return value
        }

        return 0
    }

    private func parseMeltOptions(from optionsJson: String?) -> MeltOptions? {
        guard
            let json = optionsJson,
            let data = json.data(using: .utf8),
            let parsed = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else {
            return nil
        }

        if let mpp = parsed["mpp"] as? [String: Any] {
            let amount = readPositiveUInt64(from: mpp, key: "amount")
            if amount > 0 {
                return .mpp(amount: Amount(value: amount))
            }
        }

        if let amountless = parsed["amountless"] as? [String: Any] {
            let amountMsat = readPositiveUInt64(from: amountless, key: "amount_msat")
            if amountMsat > 0 {
                return .amountless(
                    amountMsat: Amount(value: amountMsat)
                )
            }
        }

        return nil
    }

    /// Returns the initialized wallet repository or rejects with NO_WALLET error
    private func getInitializedRepo(reject: @escaping RCTPromiseRejectBlock) -> WalletRepository? {
        let repo: WalletRepository? = walletQueue.sync {
            guard isInitialized else { return nil }
            return self.repo
        }
        guard let repo else {
            reject("NO_WALLET", "Wallet not initialized", nil)
            return nil
        }
        return repo
    }

    private func normalizeMintUrl(_ mintUrl: String) -> String {
        var url = mintUrl
        while url.hasSuffix("/") {
            url = String(url.dropLast())
        }
        return url
    }

    /// Get (or lazily create) the per-mint Wallet for a mint URL.
    ///
    /// The repository only creates an in-memory Wallet handle here; no
    /// network request is made until the wallet is used. Creating on
    /// demand preserves the 0.14.x MultiMintWallet behavior where
    /// receive/restore operated with allowUntrusted: true.
    private func getWallet(_ mintUrl: String) async throws -> Wallet {
        let normalized = normalizeMintUrl(mintUrl)
        if let cached = walletQueue.sync(execute: { wallets[normalized] }) {
            return cached
        }

        guard let repo = walletQueue.sync(execute: { isInitialized ? self.repo : nil }) else {
            throw FfiError.Internal(errorMessage: "Wallet not initialized")
        }

        let url = MintUrl(url: normalized)
        let unit = walletQueue.sync { walletUnit }
        if !(await repo.hasMint(mintUrl: url)) {
            try await repo.createWallet(mintUrl: url, unit: unit, targetProofCount: nil)
        }
        let wallet = try await repo.getWallet(mintUrl: url, unit: unit)
        walletQueue.sync { wallets[normalized] = wallet }
        return wallet
    }

    private var currentDbPath: String?

    private func getDatabasePath(for mnemonic: String) -> String {
        let paths = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)
        let appSupport = paths[0]

        // Ensure directory exists
        try? FileManager.default.createDirectory(at: appSupport, withIntermediateDirectories: true)

        // Hash the mnemonic to create a unique, deterministic filename per wallet
        let data = Data(mnemonic.utf8)
        var hash = [UInt8](repeating: 0, count: Int(CC_SHA256_DIGEST_LENGTH))
        _ = data.withUnsafeBytes { CC_SHA256($0.baseAddress, CC_LONG(data.count), &hash) }
        let hashHex = hash.prefix(8).map { String(format: "%02x", $0) }.joined()

        let dbPath = appSupport.appendingPathComponent("cashu_wallet_\(hashHex).db")
        return dbPath.path
    }

    private func encodeToJson(_ object: Any) -> String? {
        guard let data = try? JSONSerialization.data(withJSONObject: object) else {
            return nil
        }
        return String(data: data, encoding: .utf8)
    }

    private func parseCurrencyUnit(_ unit: String) -> CurrencyUnit {
        switch unit.lowercased() {
        case "sat":
            return .sat
        case "msat":
            return .msat
        case "usd":
            return .usd
        case "eur":
            return .eur
        default:
            return .sat
        }
    }

    private func quoteStateToString(_ state: QuoteState) -> String {
        switch state {
        case .unpaid:
            return "Unpaid"
        case .paid:
            return "Paid"
        case .pending:
            return "Pending"
        case .issued:
            return "Issued"
        @unknown default:
            return "Unknown"
        }
    }

    private func currencyUnitToString(_ unit: CurrencyUnit) -> String {
        switch unit {
        case .sat:
            return "sat"
        case .msat:
            return "msat"
        case .usd:
            return "usd"
        case .eur:
            return "eur"
        case .auth:
            return "auth"
        case .custom(let unit):
            return unit
        @unknown default:
            return "sat"
        }
    }

    /// Map the CDK FFI error to the legacy bridge error codes that JS
    /// consumers were written against. CDK 0.15+ collapsed the previous
    /// 19 error variants into Cdk(code, message) with Cashu protocol
    /// error codes, plus Internal(message) for infrastructure errors.
    private func mapFfiError(_ error: FfiError) -> (code: String, message: String) {
        switch error {
        case let .Cdk(code, errorMessage):
            return (legacyErrorCode(protocolCode: code, message: errorMessage), errorMessage)
        case let .Internal(errorMessage):
            return (legacyErrorCode(protocolCode: nil, message: errorMessage), errorMessage)
        @unknown default:
            return ("UNKNOWN_ERROR", "Unknown error occurred")
        }
    }

    private func legacyErrorCode(protocolCode: UInt32?, message: String) -> String {
        if let code = protocolCode {
            switch code {
            case 10003, 11001, 11002, 11007:
                // Token verification / already spent / unbalanced / duplicate inputs
                return "INVALID_TOKEN"
            case 11005:
                return "UNIT_NOT_SUPPORTED"
            case 12001, 12002:
                return "KEYSET_UNKNOWN"
            case 20005:
                return "PAYMENT_PENDING"
            case 20000...20999:
                return "PAYMENT_FAILED"
            default:
                break
            }
        }

        let lowered = message.lowercased()
        if lowered.contains("insufficient funds") {
            return "INSUFFICIENT_FUNDS"
        }
        if lowered.contains("payment failed") {
            return "PAYMENT_FAILED"
        }
        if lowered.contains("payment pending") || lowered.contains("quote pending") {
            return "PAYMENT_PENDING"
        }
        if lowered.contains("network") || lowered.contains("connection") || lowered.contains("transport") {
            return "NETWORK_ERROR"
        }
        if lowered.contains("database") {
            return "DATABASE_ERROR"
        }
        if lowered.contains("mnemonic") {
            return "INVALID_MNEMONIC"
        }
        if lowered.contains("invalid url") {
            return "INVALID_URL"
        }
        return "GENERIC_ERROR"
    }

    private func encodeMintQuote(_ quote: MintQuote) -> [String: Any] {
        return [
            "id": quote.id,
            "amount": quote.amount?.value ?? 0,
            "unit": currencyUnitToString(quote.unit),
            "request": quote.request,
            "state": quoteStateToString(quote.state),
            "expiry": quote.expiry,
            "mint_url": quote.mintUrl.url
        ]
    }

    private func encodeMeltQuote(_ quote: MeltQuote) -> [String: Any] {
        var result: [String: Any] = [
            "id": quote.id,
            "amount": quote.amount.value,
            "unit": currencyUnitToString(quote.unit),
            "request": quote.request,
            "fee_reserve": quote.feeReserve.value,
            "state": quoteStateToString(quote.state),
            "expiry": quote.expiry
        ]
        // Upstream renamed payment_preimage to payment_proof; the bridge
        // key is part of the JS contract and keeps the old name
        if let preimage = quote.paymentProof {
            result["payment_preimage"] = preimage
        }
        return result
    }

    private func encodeMelted(_ melted: FinalizedMelt) -> [String: Any] {
        var result: [String: Any] = [
            "state": quoteStateToString(melted.state),
            "amount": melted.amount.value,
            "fee_paid": melted.feePaid.value
        ]
        if let preimage = melted.preimage {
            result["preimage"] = preimage
        }
        if let change = melted.change {
            result["change"] = change.map { encodeProof($0) }
        }
        return result
    }

    private func encodeProof(_ proof: Proof) -> [String: Any] {
        let result: [String: Any] = [
            "amount": proof.amount.value,
            "secret": proof.secret,
            "c": proof.c,
            "keyset_id": proof.keysetId
        ]
        // Witness and DLEQ are optional
        return result
    }

    private func encodeToken(_ token: Token) async throws -> [String: Any] {
        let value = try token.value()
        let mintUrl = try token.mintUrl()
        var result: [String: Any] = [
        "encoded": token.encode(),
        "value": value.value,
        "mint_url": mintUrl.url,
        "memo": token.memo() ?? "",
        "unit": token.unit().map { currencyUnitToString($0) } ?? "sat"
    ]
    do {
        // Only resolve proofs through a wallet the mint is already part
        // of; decoding a foreign token must not add its mint or contact it
        if let repo = walletQueue.sync(execute: { isInitialized ? self.repo : nil }) {
            if await repo.hasMint(mintUrl: MintUrl(url: normalizeMintUrl(mintUrl.url))) {
                let wallet = try await getWallet(mintUrl.url)
                let keysets = try await wallet.getMintKeysets(filter: .all)
                let proofs = try token.proofs(mintKeysets: keysets)
                result["proofs"] = proofs.map { encodeProof($0) }
            }
        }
    } catch {
        result["proofs"] = []
    }
    return result
    }

    private func encodeKeyset(_ keyset: KeySetInfo) -> [String: Any] {
        return [
            "id": keyset.id,
            "unit": currencyUnitToString(keyset.unit),
            "active": keyset.active,
            "input_fee_ppk": keyset.inputFeePpk
        ]
    }

    // MARK: - Database Path

    @objc(getDatabasePath:rejecter:)
    func getDatabasePath(resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        resolve(currentDbPath ?? "")
    }

    // MARK: - Wallet Management

    @objc(initializeWallet:unit:resolver:rejecter:)
    func initializeWallet(_ mnemonic: String, unit: String,
                          resolve: @escaping RCTPromiseResolveBlock,
                          reject: @escaping RCTPromiseRejectBlock) {
        Task {
            do {
                let dbPath = getDatabasePath(for: mnemonic)
                self.currentDbPath = dbPath
                let sqliteDb = try WalletSqliteDatabase(filePath: dbPath)

                let currencyUnit = parseCurrencyUnit(unit)

                // WalletSqliteDatabase conforms to WalletDatabase; passing
                // it via WalletStore.custom keeps the same handle available
                // for the direct database methods below
                let newRepo = try WalletRepository(
                    mnemonic: mnemonic,
                    store: .custom(db: sqliteDb)
                )

                walletQueue.sync {
                    self.db = sqliteDb
                    self.repo = newRepo
                    self.walletUnit = currencyUnit
                    self.wallets.removeAll()
                    self.isInitialized = true
                }

                resolve(nil)
            } catch let error as FfiError {
                let (code, message) = mapFfiError(error)
                reject(code, message, error)
            } catch {
                reject("INIT_ERROR", error.localizedDescription, error)
            }
        }
    }

    @objc(addMint:targetProofCount:resolver:rejecter:)
    func addMint(_ mintUrl: String, targetProofCount: NSNumber,
                 resolve: @escaping RCTPromiseResolveBlock,
                 reject: @escaping RCTPromiseRejectBlock) {
        guard let repo = getInitializedRepo(reject: reject) else { return }

        Task {
            do {
                let url = MintUrl(url: normalizeMintUrl(mintUrl))
                // Use nil if targetProofCount is 0 or negative (sentinel for "use default")
                let count: UInt32? = targetProofCount.intValue > 0 ? targetProofCount.uint32Value : nil
                let unit = walletQueue.sync { walletUnit }
                try await repo.createWallet(mintUrl: url, unit: unit, targetProofCount: count)
                resolve(nil)
            } catch let error as FfiError {
                let (code, message) = mapFfiError(error)
                reject(code, message, error)
            } catch {
                reject("ADD_MINT_ERROR", error.localizedDescription, error)
            }
        }
    }

    @objc(removeMint:resolver:rejecter:)
    func removeMint(_ mintUrl: String,
                    resolve: @escaping RCTPromiseResolveBlock,
                    reject: @escaping RCTPromiseRejectBlock) {
        guard let repo = getInitializedRepo(reject: reject) else { return }

        Task {
            do {
                let normalized = normalizeMintUrl(mintUrl)
                let url = MintUrl(url: normalized)
                let unit = walletQueue.sync { walletUnit }
                // removeWallet only drops the in-memory wallet; tolerate a
                // mint the repository does not know (parity with the
                // non-throwing 0.14.x removeMint)
                try? await repo.removeWallet(mintUrl: url, currencyUnit: unit)
                _ = walletQueue.sync { wallets.removeValue(forKey: normalized) }
                let dbHandle: WalletSqliteDatabase? = walletQueue.sync { self.db }
                if let db = dbHandle {
                    try await db.removeMint(mintUrl: url)
                } else {
                    reject(
                        "DATABASE_NOT_INITIALIZED",
                        "Database not initialized",
                        nil
                    )
                    return
                }
                resolve(nil)
            } catch let error as FfiError {
                let (code, message) = mapFfiError(error)
                reject(code, message, error)
            } catch {
                reject("REMOVE_MINT_ERROR", error.localizedDescription, error)
            }
        }
    }

    @objc(getMintUrls:rejecter:)
    func getMintUrls(resolve: @escaping RCTPromiseResolveBlock,
                     reject: @escaping RCTPromiseRejectBlock) {
        guard let repo = getInitializedRepo(reject: reject) else { return }

        Task {
            let wallets = await repo.getWallets()
            var seen = Set<String>()
            var urls: [String] = []
            for wallet in wallets {
                let url = wallet.mintUrl().url
                if seen.insert(url).inserted {
                    urls.append(url)
                }
            }
            resolve(urls)
        }
    }

    // MARK: - Balance Operations

    @objc(getTotalBalance:rejecter:)
    func getTotalBalance(resolve: @escaping RCTPromiseResolveBlock,
                         reject: @escaping RCTPromiseRejectBlock) {
        guard let repo = getInitializedRepo(reject: reject) else { return }

        Task {
            do {
                // getBalances() is keyed by (mint URL, unit) and load_wallets
                // creates a wallet per supported unit, so only fold this
                // wallet's unit; other units must not count toward the total
                let unit = walletQueue.sync { walletUnit }
                let balances = try await repo.getBalances()
                var total: UInt64 = 0
                for (key, amount) in balances where key.unit == unit {
                    total += amount.value
                }
                resolve(NSNumber(value: total))
            } catch let error as FfiError {
                let (code, message) = mapFfiError(error)
                reject(code, message, error)
            } catch {
                reject("BALANCE_ERROR", error.localizedDescription, error)
            }
        }
    }

    @objc(getBalances:rejecter:)
    func getBalances(resolve: @escaping RCTPromiseResolveBlock,
                     reject: @escaping RCTPromiseRejectBlock) {
        guard let repo = getInitializedRepo(reject: reject) else { return }

        Task {
            do {
                let unit = walletQueue.sync { walletUnit }
                let balances = try await repo.getBalances()
                var result: [String: UInt64] = [:]
                for (key, amount) in balances where key.unit == unit {
                    result[key.mintUrl.url, default: 0] += amount.value
                }
                resolve(encodeToJson(result))
            } catch let error as FfiError {
                let (code, message) = mapFfiError(error)
                reject(code, message, error)
            } catch {
                reject("BALANCE_ERROR", error.localizedDescription, error)
            }
        }
    }

    // MARK: - Mint Info

    @objc(fetchMintInfo:resolver:rejecter:)
    func fetchMintInfo(_ mintUrl: String,
                       resolve: @escaping RCTPromiseResolveBlock,
                       reject: @escaping RCTPromiseRejectBlock) {
        // fetchMintInfo uses direct HTTP - works without wallet initialization
        Task {
            do {
                // Normalize URL and construct info endpoint
                let normalizedUrl = mintUrl.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
                let infoUrl = normalizedUrl + "/v1/info"

                guard let requestUrl = URL(string: infoUrl) else {
                    reject("INVALID_URL", "Invalid mint URL: \(mintUrl)", nil)
                    return
                }

                let (data, response) = try await URLSession.shared.data(from: requestUrl)

                // Check HTTP response status
                if let httpResponse = response as? HTTPURLResponse {
                    guard (200...299).contains(httpResponse.statusCode) else {
                        reject("HTTP_ERROR", "Mint returned HTTP \(httpResponse.statusCode)", nil)
                        return
                    }
                }

                // Parse JSON response
                guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                    reject("PARSE_ERROR", "Failed to parse mint info response", nil)
                    return
                }

                // Encode and resolve
                if let encoded = encodeToJson(json) {
                    resolve(encoded)
                } else {
                    reject("ENCODE_ERROR", "Failed to encode mint info", nil)
                }
            } catch {
                reject("NETWORK_ERROR", "Failed to fetch mint info: \(error.localizedDescription)", error)
            }
        }
    }

    @objc(getMintKeysets:resolver:rejecter:)
    func getMintKeysets(_ mintUrl: String,
                        resolve: @escaping RCTPromiseResolveBlock,
                        reject: @escaping RCTPromiseRejectBlock) {
        guard getInitializedRepo(reject: reject) != nil else { return }

        Task {
            do {
                let wallet = try await getWallet(mintUrl)
                let keysets = try await wallet.getMintKeysets(filter: .all)
                let encoded = keysets.map { encodeKeyset($0) }
                resolve(encodeToJson(encoded))
            } catch let error as FfiError {
                let (code, message) = mapFfiError(error)
                reject(code, message, error)
            } catch {
                reject("KEYSETS_ERROR", error.localizedDescription, error)
            }
        }
    }

    // MARK: - Mint Quotes (Receiving)

    @objc(createMintQuote:amount:description:resolver:rejecter:)
    func createMintQuote(_ mintUrl: String, amount: NSNumber, description: String?,
                         resolve: @escaping RCTPromiseResolveBlock,
                         reject: @escaping RCTPromiseRejectBlock) {
        guard getInitializedRepo(reject: reject) != nil else { return }

        Task {
            do {
                let amt = Amount(value: amount.uint64Value)
                let wallet = try await getWallet(mintUrl)
                let quote = try await wallet.mintQuote(
                    paymentMethod: .bolt11,
                    amount: amt,
                    description: description,
                    extra: nil
                )
                resolve(encodeToJson(encodeMintQuote(quote)))
            } catch let error as FfiError {
                let (code, message) = mapFfiError(error)
                reject(code, message, error)
            } catch {
                reject("MINT_QUOTE_ERROR", error.localizedDescription, error)
            }
        }
    }

    @objc(checkMintQuote:quoteId:resolver:rejecter:)
    func checkMintQuote(_ mintUrl: String, quoteId: String,
                        resolve: @escaping RCTPromiseResolveBlock,
                        reject: @escaping RCTPromiseRejectBlock) {
        guard getInitializedRepo(reject: reject) != nil else { return }

        Task {
            do {
                let wallet = try await getWallet(mintUrl)
                let quote = try await wallet.checkMintQuote(quoteId: quoteId)
                resolve(encodeToJson(encodeMintQuote(quote)))
            } catch let error as FfiError {
                let (code, message) = mapFfiError(error)
                reject(code, message, error)
            } catch {
                reject("CHECK_MINT_QUOTE_ERROR", error.localizedDescription, error)
            }
        }
    }

    /// Check mint quote status directly from the mint's HTTP API.
    /// This bypasses the local database check and works for external quotes
    /// (e.g., quotes created by ZeusPay server).
    @objc(checkExternalMintQuote:quoteId:resolver:rejecter:)
    func checkExternalMintQuote(_ mintUrl: String, quoteId: String,
                                 resolve: @escaping RCTPromiseResolveBlock,
                                 reject: @escaping RCTPromiseRejectBlock) {
        Task {
            do {
                // Normalize mint URL and construct the quote endpoint
                let normalizedUrl = mintUrl.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
                let quoteUrlStr = "\(normalizedUrl)/v1/mint/quote/bolt11/\(quoteId)"

                guard let quoteUrl = URL(string: quoteUrlStr) else {
                    reject("INVALID_URL", "Invalid mint URL: \(mintUrl)", nil)
                    return
                }

                let (data, response) = try await URLSession.shared.data(from: quoteUrl)

                // Check HTTP response status
                if let httpResponse = response as? HTTPURLResponse {
                    guard (200...299).contains(httpResponse.statusCode) else {
                        let errorBody = String(data: data, encoding: .utf8) ?? "Unknown error"
                        reject("HTTP_ERROR", "Mint returned HTTP \(httpResponse.statusCode): \(errorBody)", nil)
                        return
                    }
                }

                // Parse JSON response
                guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                    reject("PARSE_ERROR", "Failed to parse mint quote response", nil)
                    return
                }

                // Parse the response according to NUT-04 spec
                var result: [String: Any] = [
                    "id": json["quote"] as? String ?? quoteId,
                    "amount": json["amount"] as? Int ?? 0,
                    "request": json["request"] as? String ?? "",
                    "state": json["state"] as? String ?? "Unknown",
                    "expiry": json["expiry"] as? Int ?? 0,
                    "mint_url": mintUrl
                ]

                // Include pubkey if present (for P2PK locked quotes)
                if let pubkey = json["pubkey"] as? String {
                    result["pubkey"] = pubkey
                }

                if let encoded = encodeToJson(result) {
                    resolve(encoded)
                } else {
                    reject("ENCODE_ERROR", "Failed to encode quote response", nil)
                }
            } catch {
                reject("EXTERNAL_QUOTE_ERROR", "Failed to check external quote: \(error.localizedDescription)", error)
            }
        }
    }

    /// Add an external mint quote to CDK's database.
    /// This allows minting from quotes created externally (e.g., by ZeusPay server).
    @objc(addExternalMintQuote:quoteId:amount:request:state:expiry:secretKey:useSeedPrefixMarker:resolver:rejecter:)
    func addExternalMintQuote(_ mintUrl: String, quoteId: String, amount: NSNumber,
                               request: String, state: String, expiry: NSNumber,
                               secretKey: String?,
                               useSeedPrefixMarker: Bool,
                               resolve: @escaping RCTPromiseResolveBlock,
                               reject: @escaping RCTPromiseRejectBlock) {
        let dbHandle: WalletSqliteDatabase? = walletQueue.sync {
            guard isInitialized else { return nil }
            return self.db
        }
        guard let db = dbHandle else {
            reject("NO_WALLET", "Wallet not initialized", nil)
            return
        }

        Task {
            do {
                let url = MintUrl(url: mintUrl)
                let amt = Amount(value: UInt64(truncating: amount))

                // Map state string to QuoteState enum
                let quoteState: QuoteState
                switch state.uppercased() {
                case "UNPAID":
                    quoteState = .unpaid
                case "PAID":
                    quoteState = .paid
                case "PENDING":
                    quoteState = .pending
                case "ISSUED":
                    quoteState = .issued
                default:
                    quoteState = .paid // Default to PAID for external quotes
                }

                // For v2-bip39 wallets, ZEUS Pay locks quotes to the seed-
                // prefix key (seed[0..32]), which is byte-identical to cdk's
                // "legacy NpubCash" key. Storing that key on the quote makes
                // cdk's mint saga scrub it mid-flight (a version bump), and
                // the saga's post-mint write then dies with ConcurrentUpdate
                // AFTER the mint has issued the signatures. For those quotes
                // (useSeedPrefixMarker, decided by JS via byte comparison),
                // store the quote with no key and write cdk's NpubCash
                // quote-key marker: at signing time cdk re-derives the
                // identical seed-prefix key from the marker, with no mid-saga
                // write. v1 wallets sign with a different key (LND seed
                // bytes [32:64]), so the marker would derive the wrong key
                // for them; their key is stored on the quote instead, which
                // is safe because the scrub only triggers on byte equality
                // with the seed prefix.
                // Upstream bug: https://github.com/cashubtc/cdk/issues/2335
                // Remove when fixed: https://github.com/ZeusLN/zeus/issues/4402
                let storedSecretKey = (secretKey?.isEmpty == false) ? secretKey : nil
                if storedSecretKey != nil && useSeedPrefixMarker {
                    try await db.kvWrite(
                        primaryNamespace: "npubcash",
                        secondaryNamespace: "quotes",
                        key: quoteId,
                        value: Data("legacy-seed-prefix".utf8)
                    )
                }

                // Create the MintQuote object
                // For external quotes that are PAID, we set amountPaid = amount
                let zeroAmount = Amount(value: 0)
                let quote = MintQuote(
                    id: quoteId,
                    amount: amt,
                    unit: .sat,
                    request: request,
                    state: quoteState,
                    expiry: UInt64(truncating: expiry),
                    mintUrl: url,
                    amountIssued: quoteState == .issued ? amt : zeroAmount,
                    amountPaid: (quoteState == .paid || quoteState == .issued) ? amt : zeroAmount,
                    estimatedBlocks: nil,
                    paymentMethod: .bolt11,
                    secretKey: useSeedPrefixMarker ? nil : storedSecretKey,
                    usedByOperation: nil,
                    version: 0
                )

                // Add to database
                try await db.addMintQuote(quote: quote)

                resolve(true)
            } catch let error as FfiError {
                let (code, message) = mapFfiError(error)
                reject(code, message, error)
            } catch {
                reject("ADD_QUOTE_ERROR", error.localizedDescription, error)
            }
        }
    }

    /// Mint tokens directly from an external quote.
    /// This creates the quote in CDK's database first, then mints.
    @objc(mintExternal:quoteId:amount:resolver:rejecter:)
    func mintExternal(_ mintUrl: String, quoteId: String, amount: NSNumber,
                      resolve: @escaping RCTPromiseResolveBlock,
                      reject: @escaping RCTPromiseRejectBlock) {
        guard getInitializedRepo(reject: reject) != nil else { return }

        Task {
            do {
                // Mint - quote should be in database now
                let wallet = try await getWallet(mintUrl)
                let proofs = try await wallet.mint(
                    quoteId: quoteId,
                    amountSplitTarget: .none,
                    spendingConditions: nil
                )
                let encoded = proofs.map { encodeProof($0) }
                resolve(encodeToJson(encoded))
            } catch let error as FfiError {
                let (code, message) = mapFfiError(error)
                reject(code, message, error)
            } catch {
                reject("MINT_EXTERNAL_ERROR", error.localizedDescription, error)
            }
        }
    }

    @objc(mint:quoteId:conditionsJson:resolver:rejecter:)
    func mint(_ mintUrl: String, quoteId: String, conditionsJson: String?,
              resolve: @escaping RCTPromiseResolveBlock,
              reject: @escaping RCTPromiseRejectBlock) {
        guard getInitializedRepo(reject: reject) != nil else { return }

        Task {
            do {
                // Parse spending conditions if provided
                var conditions: SpendingConditions? = nil
                if let json = conditionsJson,
                   let data = json.data(using: .utf8),
                   let parsed = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                   conditions = parseP2PKConditions(from: parsed)
                }

                let wallet = try await getWallet(mintUrl)
                let proofs = try await wallet.mint(
                    quoteId: quoteId,
                    amountSplitTarget: .none,
                    spendingConditions: conditions
                )
                let encoded = proofs.map { encodeProof($0) }
                resolve(encodeToJson(encoded))
            } catch let error as FfiError {
                let (code, message) = mapFfiError(error)
                reject(code, message, error)
            } catch {
                reject("MINT_ERROR", error.localizedDescription, error)
            }
        }
    }

    // MARK: - Melt Quotes (Paying)

    @objc(createMeltQuote:request:optionsJson:resolver:rejecter:)
    func createMeltQuote(_ mintUrl: String, request: String, optionsJson: String?,
                         resolve: @escaping RCTPromiseResolveBlock,
                         reject: @escaping RCTPromiseRejectBlock) {
        guard getInitializedRepo(reject: reject) != nil else { return }

        Task {
            do {
                let options = parseMeltOptions(from: optionsJson)
                let wallet = try await getWallet(mintUrl)
                let quote = try await wallet.meltQuote(
                    method: .bolt11,
                    request: request,
                    options: options,
                    extra: nil
                )
                resolve(encodeToJson(encodeMeltQuote(quote)))
            } catch let error as FfiError {
                let (code, message) = mapFfiError(error)
                reject(code, message, error)
            } catch {
                reject("MELT_QUOTE_ERROR", error.localizedDescription, error)
            }
        }
    }

    @objc(checkMeltQuote:quoteId:resolver:rejecter:)
    func checkMeltQuote(_ mintUrl: String, quoteId: String,
                        resolve: @escaping RCTPromiseResolveBlock,
                        reject: @escaping RCTPromiseRejectBlock) {
        guard getInitializedRepo(reject: reject) != nil else { return }

        Task {
            do {
                let wallet = try await getWallet(mintUrl)
                let quote = try await wallet.checkMeltQuoteStatus(quoteId: quoteId)
                resolve(encodeToJson(encodeMeltQuote(quote)))
            } catch let error as FfiError {
                let (code, message) = mapFfiError(error)
                reject(code, message, error)
            } catch {
                reject("CHECK_MELT_QUOTE_ERROR", error.localizedDescription, error)
            }
        }
    }

    @objc(melt:quoteId:resolver:rejecter:)
    func melt(_ mintUrl: String, quoteId: String,
              resolve: @escaping RCTPromiseResolveBlock,
              reject: @escaping RCTPromiseRejectBlock) {
        guard getInitializedRepo(reject: reject) != nil else { return }

        Task {
            do {
                let wallet = try await getWallet(mintUrl)
                let prepared = try await wallet.prepareMelt(quoteId: quoteId)
                let melted = try await prepared.confirm()
                resolve(encodeToJson(encodeMelted(melted)))
            } catch let error as FfiError {
                let (code, message) = mapFfiError(error)
                reject(code, message, error)
            } catch {
                reject("MELT_ERROR", error.localizedDescription, error)
            }
        }
    }

    @objc(meltPartial:bolt11:mppAmountMsat:resolver:rejecter:)
    func meltPartial(_ mintUrl: String, bolt11: String, mppAmountMsat: NSNumber,
                     resolve: @escaping RCTPromiseResolveBlock,
                     reject: @escaping RCTPromiseRejectBlock) {
        guard getInitializedRepo(reject: reject) != nil else { return }

        Task {
            do {
                let mppAmount = Amount(value: mppAmountMsat.uint64Value)
                let wallet = try await getWallet(mintUrl)

                // Step 1: Create melt quote via CDK with MPP options
                let options = MeltOptions.mpp(amount: mppAmount)
                let quote = try await wallet.meltQuote(
                    method: .bolt11,
                    request: bolt11,
                    options: options,
                    extra: nil
                )

                // Step 2: Gather this mint's unspent proofs —
                // the mint knows the MPP partial amount from the quote
                let dbHandle: WalletSqliteDatabase? = walletQueue.sync { self.db }
                guard let db = dbHandle else {
                    reject("NO_WALLET", "Wallet not initialized", nil)
                    return
                }
                let url = MintUrl(url: normalizeMintUrl(mintUrl))
                let proofInfos = try await db.getProofs(
                    mintUrl: url,
                    unit: .sat,
                    state: [.unspent],
                    spendingConditions: nil
                )
                let mintProofs = proofInfos.map { $0.proof }

                guard !mintProofs.isEmpty else {
                    reject("NO_PROOFS", "No proofs found for mint \(mintUrl)", nil)
                    return
                }

                // Step 3: Two-phase melt with the selected proofs
                let prepared = try await wallet.prepareMeltProofs(
                    quoteId: quote.id,
                    proofs: mintProofs
                )
                let melted = try await prepared.confirm()

                resolve(encodeToJson(encodeMelted(melted)))
            } catch let error as FfiError {
                let (code, message) = mapFfiError(error)
                reject(code, message, error)
            } catch {
                reject("MELT_PARTIAL_ERROR", error.localizedDescription, error)
            }
        }
    }

    // MARK: - Token Operations

    @objc(prepareSend:amount:optionsJson:resolver:rejecter:)
    func prepareSend(_ mintUrl: String, amount: NSNumber, optionsJson: String?,
                     resolve: @escaping RCTPromiseResolveBlock,
                     reject: @escaping RCTPromiseRejectBlock) {
        guard getInitializedRepo(reject: reject) != nil else { return }

        Task {
            do {
                let amt = Amount(value: amount.uint64Value)

                // Parse options if provided
                var includeFee = false
                var spendingConditions: SpendingConditions? = nil
                var sendKind: SendKind = .onlineExact
                if let json = optionsJson,
                   let data = json.data(using: .utf8),
                   let parsed = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    if let fee = parsed["include_fee"] as? Bool {
                        includeFee = fee
                    }
                    if let cond = parsed["conditions"] as? [String: Any] {
                    spendingConditions = parseP2PKConditions(from: cond)
                    }
                    if let kindStr = parsed["send_kind"] as? String {
                        let tolerance = (parsed["tolerance"] as? NSNumber).map { Amount(value: $0.uint64Value) } ?? Amount(value: 0)
                        switch kindStr {
                        case "OfflineExact":
                            sendKind = .offlineExact
                        case "OnlineTolerance":
                            sendKind = .onlineTolerance(tolerance: tolerance)
                        case "OfflineTolerance":
                            sendKind = .offlineTolerance(tolerance: tolerance)
                        default:
                            sendKind = .onlineExact
                        }
                    }
                }

                let sendOptions = SendOptions(
                    memo: nil,
                    conditions: spendingConditions,
                    amountSplitTarget: .none,
                    sendKind: sendKind,
                    includeFee: includeFee,
                    useP2bk: false,
                    maxProofs: nil,
                    metadata: [:],
                    p2pkSigningKeys: [],
                    p2pkLockedProofSendMode: .swap
                )

                let wallet = try await getWallet(mintUrl)
                let prepared = try await wallet.prepareSend(amount: amt, options: sendOptions)
                let preparedId = prepared.operationId()
                let preparedAmount = prepared.amount().value
                let preparedFee = prepared.fee().value

                walletQueue.sync {
                    self.preparedSends[preparedId] = prepared
                }

                let result: [String: Any] = [
                    "id": preparedId,
                    "amount": preparedAmount,
                    "fee": preparedFee
                ]
                let jsonData = try JSONSerialization.data(withJSONObject: result)
                resolve(String(data: jsonData, encoding: .utf8)!)
            } catch let error as FfiError {
                let (code, message) = mapFfiError(error)
                reject(code, message, error)
            } catch {
                reject("PREPARE_SEND_ERROR", error.localizedDescription, error)
            }
        }
    }

    @objc(confirmSend:memo:resolver:rejecter:)
    func confirmSend(_ preparedSendId: String, memo: String?,
                     resolve: @escaping RCTPromiseResolveBlock,
                     reject: @escaping RCTPromiseRejectBlock) {
        let prepared: PreparedSend? = walletQueue.sync { preparedSends[preparedSendId] }
        guard let prepared else {
            reject("NO_PREPARED_SEND", "Prepared send not found", nil)
            return
        }

        Task {
            defer {
                // Always clean up prepared send, whether success or failure
                _ = walletQueue.sync {
                    self.preparedSends.removeValue(forKey: preparedSendId)
                }
            }

            do {
                let token = try await prepared.confirm(memo: memo)
                let encoded = try await encodeToken(token)
                resolve(encodeToJson(encoded))
            } catch let error as FfiError {
                let (code, message) = mapFfiError(error)
                reject(code, message, error)
            } catch {
                reject("CONFIRM_SEND_ERROR", error.localizedDescription, error)
            }
        }
    }

    @objc(cancelSend:resolver:rejecter:)
    func cancelSend(_ preparedSendId: String,
                    resolve: @escaping RCTPromiseResolveBlock,
                    reject: @escaping RCTPromiseRejectBlock) {
        let prepared: PreparedSend? = walletQueue.sync { preparedSends[preparedSendId] }
        guard let prepared else {
            resolve(nil)
            return
        }

        Task {
            defer {
                // Always clean up prepared send, whether success or failure
                _ = walletQueue.sync {
                    self.preparedSends.removeValue(forKey: preparedSendId)
                }
            }

            do {
                try await prepared.cancel()
                resolve(nil)
            } catch let error as FfiError {
                let (code, message) = mapFfiError(error)
                reject(code, message, error)
            } catch {
                reject("CANCEL_SEND_ERROR", error.localizedDescription, error)
            }
        }
    }

    @objc(receive:optionsJson:resolver:rejecter:)
    func receive(_ encodedToken: String, optionsJson: String?,
                 resolve: @escaping RCTPromiseResolveBlock,
                 reject: @escaping RCTPromiseRejectBlock) {
        guard getInitializedRepo(reject: reject) != nil else { return }

        Task {
            do {
                let token = try Token.fromString(encodedToken: encodedToken)

                // Parse options if provided
                var p2pkSigningKeys: [SecretKey] = []
                var preimages: [String] = []

                if let json = optionsJson,
                   let data = json.data(using: .utf8),
                   let parsed = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    if let keys = parsed["p2pk_signing_keys"] as? [String] {
                        p2pkSigningKeys = keys.map {
                            SecretKey(hex: $0)
                        }
                    }
                    if let imgs = parsed["preimages"] as? [String] {
                        preimages = imgs
                    }
                }

                let receiveOptions = ReceiveOptions(
                    amountSplitTarget: .none,
                    p2pkSigningKeys: p2pkSigningKeys,
                    preimages: preimages,
                    metadata: [:]
                )

                // The token's mint is added on demand, matching the 0.14.x
                // MultiMintWallet behavior of allowUntrusted: true
                let tokenMintUrl = try token.mintUrl()
                let wallet = try await getWallet(tokenMintUrl.url)
                let amount = try await wallet.receive(token: token, options: receiveOptions)
                resolve(NSNumber(value: amount.value))
            } catch let error as FfiError {
                let (code, message) = mapFfiError(error)
                reject(code, message, error)
            } catch {
                reject("RECEIVE_ERROR", error.localizedDescription, error)
            }
        }
    }

    // MARK: - Token Utility

    @objc(decodeToken:resolver:rejecter:)
    func decodeToken(_ encodedToken: String,
                     resolve: @escaping RCTPromiseResolveBlock,
                     reject: @escaping RCTPromiseRejectBlock) {
    Task {
        do {
            let token = try Token.fromString(encodedToken: encodedToken)
            let encoded = try await encodeToken(token)
            resolve(encodeToJson(encoded))
        } catch let error as FfiError {
            let (code, message) = mapFfiError(error)
            reject(code, message, error)
        } catch {
            reject("DECODE_ERROR", error.localizedDescription, error)
        }
     }
    }

    @objc(isValidToken:resolver:rejecter:)
    func isValidToken(_ encodedToken: String,
                      resolve: @escaping RCTPromiseResolveBlock,
                      reject: @escaping RCTPromiseRejectBlock) {
        do {
            let _ = try Token.fromString(encodedToken: encodedToken)
            resolve(true)
        } catch {
            resolve(false)
        }
    }

    // MARK: - Restore

    @objc(restore:resolver:rejecter:)
    func restore(_ mintUrl: String,
                 resolve: @escaping RCTPromiseResolveBlock,
                 reject: @escaping RCTPromiseRejectBlock) {
        guard getInitializedRepo(reject: reject) != nil else { return }

        Task {
            do {
                let wallet = try await getWallet(mintUrl)
                // Restored splits the result into spent/unspent/pending;
                // the bridge contract is the recovered spendable amount
                let restored = try await wallet.restore()
                resolve(NSNumber(value: restored.unspent.value))
            } catch let error as FfiError {
                let (code, message) = mapFfiError(error)
                reject(code, message, error)
            } catch {
                reject("RESTORE_ERROR", error.localizedDescription, error)
            }
        }
    }

    @objc(restoreFromSeed:seedHex:resolver:rejecter:)
    func restoreFromSeed(_ mintUrl: String, seedHex: String,
                         resolve: @escaping RCTPromiseResolveBlock,
                         reject: @escaping RCTPromiseRejectBlock) {
        guard getInitializedRepo(reject: reject) != nil else { return }

        Task {
            do {
                // Step 1: Call standalone restore crate to get v1 proofs as a cashu token
                let tokenString = try ZeusCashuRestore.restoreFromSeed(mintUrl: mintUrl, seedHex: seedHex)

                // If no proofs found, return 0
                if tokenString.isEmpty {
                    resolve(NSNumber(value: 0))
                    return
                }

                // Step 2: Feed the token into CDK's receive to import proofs into the wallet
                let token = try Token.fromString(encodedToken: tokenString)

                let receiveOptions = ReceiveOptions(
                    amountSplitTarget: .none,
                    p2pkSigningKeys: [],
                    preimages: [],
                    metadata: [:]
                )

                let wallet = try await getWallet(mintUrl)
                let amount = try await wallet.receive(token: token, options: receiveOptions)
                resolve(NSNumber(value: amount.value))
            } catch let error as ZeusCashuRestore.RestoreError {
                reject("RESTORE_FROM_SEED_ERROR", "\(error)", nil)
            } catch let error as FfiError {
                let (code, message) = mapFfiError(error)
                reject(code, message, error)
            } catch {
                reject("RESTORE_FROM_SEED_ERROR", error.localizedDescription, error)
            }
        }
    }

    // MARK: - Proof Management

    @objc(checkProofsState:proofsJson:resolver:rejecter:)
    func checkProofsState(_ mintUrl: String, proofsJson: String,
                          resolve: @escaping RCTPromiseResolveBlock,
                          reject: @escaping RCTPromiseRejectBlock) {
        guard getInitializedRepo(reject: reject) != nil else { return }

        Task {
            do {
                // Parse proofs from JSON
                guard let data = proofsJson.data(using: .utf8),
                      let proofsArray = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
                    reject("INVALID_PROOFS", "Could not parse proofs JSON", nil)
                    return
                }

                var proofs: [Proof] = []
                for proofDict in proofsArray {
                    guard let amount = proofDict["amount"] as? UInt64,
                          let secret = proofDict["secret"] as? String,
                          let c = proofDict["c"] as? String,
                          let keysetId = proofDict["keyset_id"] as? String else {
                        continue
                    }

                    let proof = Proof(
                        amount: Amount(value: amount),
                        secret: secret,
                        c: c,
                        keysetId: keysetId,
                        witness: nil,
                        dleq: nil,
                        p2pkE: nil
                    )
                    proofs.append(proof)
                }

                let wallet = try await getWallet(mintUrl)
                let spentFlags = try await wallet.checkProofsSpent(proofs: proofs)
                let encoded = spentFlags.map { spent -> [String: Any] in
                    return ["state": spent ? "Spent" : "Unspent"]
                }
                resolve(encodeToJson(encoded))
            } catch let error as FfiError {
                let (code, message) = mapFfiError(error)
                reject(code, message, error)
            } catch {
                reject("CHECK_PROOFS_ERROR", error.localizedDescription, error)
            }
        }
    }

    // MARK: - BOLT12 Support

    @objc(createMintBolt12Quote:amount:description:resolver:rejecter:)
    func createMintBolt12Quote(_ mintUrl: String, amount: NSNumber, description: String?,
                               resolve: @escaping RCTPromiseResolveBlock,
                               reject: @escaping RCTPromiseRejectBlock) {
        guard getInitializedRepo(reject: reject) != nil else { return }

        Task {
            do {
                let amt = Amount(value: amount.uint64Value)
                let wallet = try await getWallet(mintUrl)
                let quote = try await wallet.mintQuote(
                    paymentMethod: .bolt12,
                    amount: amt,
                    description: description,
                    extra: nil
                )
                resolve(encodeToJson(encodeMintQuote(quote)))
            } catch let error as FfiError {
                let (code, message) = mapFfiError(error)
                reject(code, message, error)
            } catch {
                reject("BOLT12_MINT_QUOTE_ERROR", error.localizedDescription, error)
            }
        }
    }

    @objc(createMeltBolt12Quote:request:optionsJson:resolver:rejecter:)
    func createMeltBolt12Quote(_ mintUrl: String, request: String, optionsJson: String?,
                               resolve: @escaping RCTPromiseResolveBlock,
                               reject: @escaping RCTPromiseRejectBlock) {
        guard getInitializedRepo(reject: reject) != nil else { return }

        Task {
            do {
                let options = parseMeltOptions(from: optionsJson)
                let wallet = try await getWallet(mintUrl)
                let quote = try await wallet.meltQuote(
                    method: .bolt12,
                    request: request,
                    options: options,
                    extra: nil
                )
                resolve(encodeToJson(encodeMeltQuote(quote)))
            } catch let error as FfiError {
                let (code, message) = mapFfiError(error)
                reject(code, message, error)
            } catch {
                reject("BOLT12_MELT_QUOTE_ERROR", error.localizedDescription, error)
            }
        }
    }

    @objc(createMeltHumanReadableQuote:address:amountMsat:resolver:rejecter:)
    func createMeltHumanReadableQuote(_ mintUrl: String, address: String, amountMsat: NSNumber,
                                       resolve: @escaping RCTPromiseResolveBlock,
                                       reject: @escaping RCTPromiseRejectBlock) {
        guard getInitializedRepo(reject: reject) != nil else { return }

        Task {
            do {
                let wallet = try await getWallet(mintUrl)
                let quote = try await wallet.meltHumanReadableQuote(
                    address: address,
                    amountMsat: Amount(value: amountMsat.uint64Value),
                    network: .bitcoin
                )
                resolve(encodeToJson(encodeMeltQuote(quote)))
            } catch let error as FfiError {
                let (code, message) = mapFfiError(error)
                reject(code, message, error)
            } catch {
                reject("HUMAN_READABLE_QUOTE_ERROR", error.localizedDescription, error)
            }
        }
    }

    // MARK: - Transactions

    @objc(listTransactions:resolver:rejecter:)
    func listTransactions(_ direction: String?,
                          resolve: @escaping RCTPromiseResolveBlock,
                          reject: @escaping RCTPromiseRejectBlock) {
        let dbHandle: WalletSqliteDatabase? = walletQueue.sync {
            guard isInitialized else { return nil }
            return self.db
        }
        guard let db = dbHandle else {
            reject("NO_WALLET", "Wallet not initialized", nil)
            return
        }

        Task {
            do {
                var txDirection: TransactionDirection? = nil
                if let dir = direction {
                    txDirection = dir == "incoming" ? .incoming : .outgoing
                }

                let transactions = try await db.listTransactions(
                    mintUrl: nil,
                    direction: txDirection,
                    unit: nil
                )

                let encoded = transactions.map { tx -> [String: Any] in
                    var result: [String: Any] = [
                        "id": tx.id.hex,
                        "direction": tx.direction == .incoming ? "incoming" : "outgoing",
                        "amount": tx.amount.value,
                        "mint_url": tx.mintUrl.url,
                        "timestamp": tx.timestamp,
                        "fee": tx.fee.value
                    ]
                    if let memo = tx.memo {
                        result["memo"] = memo
                    }
                    return result
                }

                resolve(encodeToJson(encoded))
            } catch let error as FfiError {
                let (code, message) = mapFfiError(error)
                reject(code, message, error)
            } catch {
                reject("LIST_TRANSACTIONS_ERROR", error.localizedDescription, error)
            }
        }
    }

    // MARK: - Direct Proof Access (Offline Send)

    @objc(getUnspentProofs:resolver:rejecter:)
    func getUnspentProofs(_ mintUrl: String,
                          resolve: @escaping RCTPromiseResolveBlock,
                          reject: @escaping RCTPromiseRejectBlock) {
        let dbHandle: WalletSqliteDatabase? = walletQueue.sync { self.db }
        guard let db = dbHandle else {
            reject("NO_WALLET", "Wallet not initialized", nil)
            return
        }

        Task {
            do {
                let url = MintUrl(url: mintUrl)
                let proofInfos = try await db.getProofs(
                    mintUrl: url,
                    unit: .sat,
                    state: [.unspent],
                    spendingConditions: nil
                )

                let result = proofInfos.map { info -> [String: Any] in
                    return [
                        "amount": info.proof.amount.value,
                        "secret": info.proof.secret,
                        "c": info.proof.c,
                        "keyset_id": info.proof.keysetId,
                        "y": info.y.hex
                    ]
                }

                resolve(encodeToJson(result))
            } catch let error as FfiError {
                let (code, message) = mapFfiError(error)
                reject(code, message, error)
            } catch {
                reject("GET_PROOFS_ERROR", error.localizedDescription, error)
            }
        }
    }

    @objc(removeProofs:resolver:rejecter:)
    func removeProofs(_ proofsYJson: String,
                      resolve: @escaping RCTPromiseResolveBlock,
                      reject: @escaping RCTPromiseRejectBlock) {
        let dbHandle: WalletSqliteDatabase? = walletQueue.sync { self.db }
        guard let db = dbHandle else {
            reject("NO_WALLET", "Wallet not initialized", nil)
            return
        }

        Task {
            do {
                guard let data = proofsYJson.data(using: .utf8),
                      let yStrings = try? JSONSerialization.jsonObject(with: data) as? [String] else {
                    reject("INVALID_INPUT", "Could not parse Y values JSON", nil)
                    return
                }

                if yStrings.isEmpty {
                    resolve(nil)
                    return
                }

                let ys = yStrings.map { hex -> CashuDevKit.PublicKey in
                    CashuDevKit.PublicKey(hex: hex)
                }

                try await db.updateProofs(added: [], removedYs: ys)
                resolve(nil)
            } catch let error as FfiError {
                let (code, message) = mapFfiError(error)
                reject(code, message, error)
            } catch {
                reject("REMOVE_PROOFS_ERROR", error.localizedDescription, error)
            }
        }
    }

    // MARK: - Cleanup

    override func invalidate() {
        walletQueue.sync {
            repo = nil
            db = nil
            wallets.removeAll()
            preparedSends.removeAll()
            isInitialized = false
        }
        super.invalidate()
    }
}
