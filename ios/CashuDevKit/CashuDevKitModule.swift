import Foundation
import CashuDevKit

/// CashuDevKit Native Module for React Native
/// Provides bridge to CDK FFI bindings
@objc(CashuDevKitModule)
class CashuDevKitModule: RCTEventEmitter {

    // MARK: - Properties

    private var wallet: MultiMintWallet?
    private var db: WalletSqliteDatabase?
    private var preparedSends: [String: PreparedSend] = [:]
    private var isInitialized: Bool = false

    // Serial queue for thread-safe wallet access
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

    /// Returns the initialized wallet or rejects with NO_WALLET error
    private func getInitializedWallet(reject: @escaping RCTPromiseRejectBlock) -> MultiMintWallet? {
        guard isInitialized, let wallet = wallet else {
            reject("NO_WALLET", "Wallet not initialized", nil)
            return nil
        }
        return wallet
    }

    private func getDatabasePath() -> String {
        let paths = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)
        let appSupport = paths[0]

        // Ensure directory exists
        try? FileManager.default.createDirectory(at: appSupport, withIntermediateDirectories: true)

        let dbPath = appSupport.appendingPathComponent("cashu_wallet.db")
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

    private func mapFfiError(_ error: FfiError) -> (code: String, message: String) {
        switch error {
        case .Generic(let message):
            return ("GENERIC_ERROR", message)
        case .AmountOverflow(let message):
            return ("AMOUNT_OVERFLOW", message)
        case .PaymentFailed(let message):
            return ("PAYMENT_FAILED", message)
        case .PaymentPending(let message):
            return ("PAYMENT_PENDING", message)
        case .InsufficientFunds(let message):
            return ("INSUFFICIENT_FUNDS", message)
        case .Database(let message):
            return ("DATABASE_ERROR", message)
        case .Network(let message):
            return ("NETWORK_ERROR", message)
        case .InvalidToken(let message):
            return ("INVALID_TOKEN", message)
        case .Wallet(let message):
            return ("WALLET_ERROR", message)
        case .KeysetUnknown(let message):
            return ("KEYSET_UNKNOWN", message)
        case .UnitNotSupported(let message):
            return ("UNIT_NOT_SUPPORTED", message)
        case .InvalidMnemonic(let message):
            return ("INVALID_MNEMONIC", message)
        case .InvalidUrl(let message):
            return ("INVALID_URL", message)
        case .DivisionByZero(let message):
            return ("DIVISION_BY_ZERO", message)
        case .Amount(let message):
            return ("AMOUNT_ERROR", message)
        case .RuntimeTaskJoin(let message):
            return ("RUNTIME_ERROR", message)
        case .InvalidHex(let message):
            return ("INVALID_HEX", message)
        case .InvalidCryptographicKey(let message):
            return ("INVALID_KEY", message)
        case .Serialization(let message):
            return ("SERIALIZATION_ERROR", message)
        @unknown default:
            return ("UNKNOWN_ERROR", "Unknown error occurred")
        }
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
        if let preimage = quote.paymentPreimage {
            result["payment_preimage"] = preimage
        }
        return result
    }

    private func encodeMelted(_ melted: Melted) -> [String: Any] {
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
        var result: [String: Any] = [
            "amount": proof.amount.value,
            "secret": proof.secret,
            "c": proof.c,
            "keyset_id": proof.keysetId
        ]
        // Witness and DLEQ are optional
        return result
    }

    private func encodeToken(_ token: Token) throws -> [String: Any] {
        let value = try token.value()
        let mintUrl = try token.mintUrl()

        return [
            "encoded": token.encode(),
            "value": value.value,
            "mint_url": mintUrl.url,
            "memo": token.memo() ?? "",
            "unit": token.unit().map { currencyUnitToString($0) } ?? "sat"
        ]
    }

    private func encodeMintInfo(_ info: MintInfo) -> [String: Any] {
        var result: [String: Any] = [:]

        if let name = info.name {
            result["name"] = name
        }
        if let pubkey = info.pubkey {
            result["pubkey"] = pubkey
        }
        if let version = info.version {
            result["version"] = version
        }
        if let description = info.description {
            result["description"] = description
        }
        if let descriptionLong = info.descriptionLong {
            result["description_long"] = descriptionLong
        }
        if let motd = info.motd {
            result["motd"] = motd
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
        resolve(getDatabasePath())
    }

    // MARK: - Wallet Management

    @objc(initializeWallet:unit:resolver:rejecter:)
    func initializeWallet(_ mnemonic: String, unit: String,
                          resolve: @escaping RCTPromiseResolveBlock,
                          reject: @escaping RCTPromiseRejectBlock) {
        Task {
            do {
                let dbPath = getDatabasePath()
                let sqliteDb = try WalletSqliteDatabase(filePath: dbPath)
                self.db = sqliteDb

                let currencyUnit = parseCurrencyUnit(unit)

                // WalletSqliteDatabase conforms to WalletDatabase protocol, pass directly
                let newWallet = try MultiMintWallet(
                    unit: currencyUnit,
                    mnemonic: mnemonic,
                    db: sqliteDb
                )

                walletQueue.sync {
                    self.wallet = newWallet
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
        guard let wallet = getInitializedWallet(reject: reject) else { return }

        Task {
            do {
                let url = MintUrl(url: mintUrl)
                // Use nil if targetProofCount is 0 or negative (sentinel for "use default")
                let count: UInt32? = targetProofCount.intValue > 0 ? targetProofCount.uint32Value : nil
                try await wallet.addMint(mintUrl: url, targetProofCount: count)
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
        guard let wallet = getInitializedWallet(reject: reject) else { return }

        Task {
            let url = MintUrl(url: mintUrl)
            await wallet.removeMint(mintUrl: url)
            resolve(nil)
        }
    }

    @objc(getMintUrls:rejecter:)
    func getMintUrls(resolve: @escaping RCTPromiseResolveBlock,
                     reject: @escaping RCTPromiseRejectBlock) {
        guard let wallet = getInitializedWallet(reject: reject) else { return }

        Task {
            let urls = await wallet.getMintUrls()
            resolve(urls)
        }
    }

    // MARK: - Balance Operations

    @objc(getTotalBalance:rejecter:)
    func getTotalBalance(resolve: @escaping RCTPromiseResolveBlock,
                         reject: @escaping RCTPromiseRejectBlock) {
        guard let wallet = getInitializedWallet(reject: reject) else { return }

        Task {
            do {
                let balances = try await wallet.getBalances()
                var total: UInt64 = 0
                for (_, amount) in balances {
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
        guard let wallet = getInitializedWallet(reject: reject) else { return }

        Task {
            do {
                let balances = try await wallet.getBalances()
                var result: [String: UInt64] = [:]
                for (mintUrl, amount) in balances {
                    result[mintUrl] = amount.value
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
        guard let wallet = getInitializedWallet(reject: reject) else { return }

        Task {
            do {
                let url = MintUrl(url: mintUrl)
                let keysets = try await wallet.getMintKeysets(mintUrl: url)
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
        guard let wallet = getInitializedWallet(reject: reject) else { return }

        Task {
            do {
                let url = MintUrl(url: mintUrl)
                let amt = Amount(value: amount.uint64Value)
                let quote = try await wallet.mintQuote(mintUrl: url, amount: amt, description: description)
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
        guard let wallet = getInitializedWallet(reject: reject) else { return }

        Task {
            do {
                let url = MintUrl(url: mintUrl)
                let quote = try await wallet.checkMintQuote(mintUrl: url, quoteId: quoteId)
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
    @objc(addExternalMintQuote:quoteId:amount:request:state:expiry:secretKey:resolver:rejecter:)
    func addExternalMintQuote(_ mintUrl: String, quoteId: String, amount: NSNumber,
                               request: String, state: String, expiry: NSNumber,
                               secretKey: String?,
                               resolve: @escaping RCTPromiseResolveBlock,
                               reject: @escaping RCTPromiseRejectBlock) {
        guard isInitialized, let db = db else {
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

                // Create the MintQuote object
                // For external quotes that are PAID, we set amountPaid = amount
                // Include secretKey for P2PK-locked quotes
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
                    paymentMethod: .bolt11,
                    secretKey: secretKey
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
        guard let wallet = getInitializedWallet(reject: reject) else { return }

        Task {
            do {
                let url = MintUrl(url: mintUrl)

                // Mint - quote should be in database now
                let proofs = try await wallet.mint(mintUrl: url, quoteId: quoteId, spendingConditions: nil)
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
        guard let wallet = getInitializedWallet(reject: reject) else { return }

        Task {
            do {
                let url = MintUrl(url: mintUrl)

                // Parse spending conditions if provided
                var conditions: SpendingConditions? = nil
                if let json = conditionsJson,
                   let data = json.data(using: .utf8),
                   let parsed = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    // Parse P2PK conditions
                    if let kind = parsed["kind"] as? String, kind == "P2PK",
                       let condData = parsed["data"] as? [String: Any],
                       let pubkey = condData["pubkey"] as? String {
                        let locktime = condData["locktime"] as? UInt64
                        let refundKeys = condData["refund_keys"] as? [String] ?? []
                        let innerConditions = Conditions(
                            locktime: locktime,
                            pubkeys: [],
                            refundKeys: refundKeys,
                            numSigs: nil,
                            sigFlag: 0,
                            numSigsRefund: nil
                        )
                        conditions = .p2pk(pubkey: pubkey, conditions: innerConditions)
                    }
                }

                let proofs = try await wallet.mint(mintUrl: url, quoteId: quoteId, spendingConditions: conditions)
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
        guard let wallet = getInitializedWallet(reject: reject) else { return }

        Task {
            do {
                let url = MintUrl(url: mintUrl)
                let quote = try await wallet.meltQuote(mintUrl: url, request: request, options: nil)
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
        guard let wallet = getInitializedWallet(reject: reject) else { return }

        Task {
            do {
                let url = MintUrl(url: mintUrl)
                let quote = try await wallet.checkMeltQuote(mintUrl: url, quoteId: quoteId)
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
        guard let wallet = getInitializedWallet(reject: reject) else { return }

        Task {
            do {
                let url = MintUrl(url: mintUrl)
                let melted = try await wallet.meltWithMint(mintUrl: url, quoteId: quoteId)
                resolve(encodeToJson(encodeMelted(melted)))
            } catch let error as FfiError {
                let (code, message) = mapFfiError(error)
                reject(code, message, error)
            } catch {
                reject("MELT_ERROR", error.localizedDescription, error)
            }
        }
    }

    // MARK: - Token Operations

    @objc(prepareSend:amount:optionsJson:resolver:rejecter:)
    func prepareSend(_ mintUrl: String, amount: NSNumber, optionsJson: String?,
                     resolve: @escaping RCTPromiseResolveBlock,
                     reject: @escaping RCTPromiseRejectBlock) {
        guard let wallet = getInitializedWallet(reject: reject) else { return }

        Task {
            do {
                let url = MintUrl(url: mintUrl)
                let amt = Amount(value: amount.uint64Value)

                // Parse options if provided
                var includeFee = false
                if let json = optionsJson,
                   let data = json.data(using: .utf8),
                   let parsed = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    if let fee = parsed["include_fee"] as? Bool {
                        includeFee = fee
                    }
                }

                let innerSendOptions = SendOptions(
                    memo: nil,
                    conditions: nil,
                    amountSplitTarget: .none,
                    sendKind: .onlineExact,
                    includeFee: includeFee,
                    maxProofs: nil,
                    metadata: [:]
                )
                let sendOptions = MultiMintSendOptions(
                    allowTransfer: false,
                    maxTransferAmount: nil,
                    allowedMints: [],
                    excludedMints: [],
                    sendOptions: innerSendOptions
                )

                let prepared = try await wallet.prepareSend(mintUrl: url, amount: amt, options: sendOptions)
                let preparedId = prepared.id()

                walletQueue.sync {
                    self.preparedSends[preparedId] = prepared
                }

                resolve(preparedId)
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
        guard let prepared = preparedSends[preparedSendId] else {
            reject("NO_PREPARED_SEND", "Prepared send not found", nil)
            return
        }

        Task {
            defer {
                // Always clean up prepared send, whether success or failure
                walletQueue.sync {
                    self.preparedSends.removeValue(forKey: preparedSendId)
                }
            }

            do {
                let token = try await prepared.confirm(memo: memo)
                let encoded = try encodeToken(token)
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
        guard let prepared = preparedSends[preparedSendId] else {
            resolve(nil)
            return
        }

        Task {
            defer {
                // Always clean up prepared send, whether success or failure
                walletQueue.sync {
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
        guard let wallet = getInitializedWallet(reject: reject) else { return }

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
                        p2pkSigningKeys = keys.compactMap {
                            try? SecretKey(hex: $0)
                        }
                    }
                    if let imgs = parsed["preimages"] as? [String] {
                        preimages = imgs
                    }
                }

                let innerReceiveOptions = ReceiveOptions(
                    amountSplitTarget: .none,
                    p2pkSigningKeys: p2pkSigningKeys,
                    preimages: preimages,
                    metadata: [:]
                )
                let receiveOptions = MultiMintReceiveOptions(
                    allowUntrusted: true,
                    transferToMint: nil,
                    receiveOptions: innerReceiveOptions
                )

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
        do {
            let token = try Token.fromString(encodedToken: encodedToken)
            let encoded = try encodeToken(token)
            resolve(encodeToJson(encoded))
        } catch let error as FfiError {
            let (code, message) = mapFfiError(error)
            reject(code, message, error)
        } catch {
            reject("DECODE_ERROR", error.localizedDescription, error)
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
        guard let wallet = getInitializedWallet(reject: reject) else { return }

        Task {
            do {
                let url = MintUrl(url: mintUrl)
                let amount = try await wallet.restore(mintUrl: url)
                resolve(NSNumber(value: amount.value))
            } catch let error as FfiError {
                let (code, message) = mapFfiError(error)
                reject(code, message, error)
            } catch {
                reject("RESTORE_ERROR", error.localizedDescription, error)
            }
        }
    }

    // MARK: - Proof Management

    @objc(checkProofsState:proofsJson:resolver:rejecter:)
    func checkProofsState(_ mintUrl: String, proofsJson: String,
                          resolve: @escaping RCTPromiseResolveBlock,
                          reject: @escaping RCTPromiseRejectBlock) {
        guard let wallet = getInitializedWallet(reject: reject) else { return }

        Task {
            do {
                let url = MintUrl(url: mintUrl)

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
                        dleq: nil
                    )
                    proofs.append(proof)
                }

                let states = try await wallet.checkProofsState(mintUrl: url, proofs: proofs)
                let encoded = states.map { state -> [String: Any] in
                    var stateStr: String
                    switch state {
                    case .unspent:
                        stateStr = "Unspent"
                    case .pending:
                        stateStr = "Pending"
                    case .spent:
                        stateStr = "Spent"
                    @unknown default:
                        stateStr = "Unknown"
                    }
                    return ["state": stateStr]
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
        guard let wallet = getInitializedWallet(reject: reject) else { return }

        Task {
            do {
                let url = MintUrl(url: mintUrl)
                let amt = Amount(value: amount.uint64Value)

                // Note: BOLT12 mint quote might need different API - check CDK version
                let quote = try await wallet.mintQuote(mintUrl: url, amount: amt, description: description)
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
        guard let wallet = getInitializedWallet(reject: reject) else { return }

        Task {
            do {
                let url = MintUrl(url: mintUrl)
                let quote = try await wallet.meltQuote(mintUrl: url, request: request, options: nil)
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
        guard let wallet = getInitializedWallet(reject: reject) else { return }

        Task {
            do {
                let url = MintUrl(url: mintUrl)
                let quote = try await wallet.meltHumanReadableQuote(
                    mintUrl: url,
                    address: address,
                    amountMsat: amountMsat.uint64Value
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
        guard isInitialized, let wallet = wallet, let db = db else {
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

    // MARK: - Cleanup

    override func invalidate() {
        walletQueue.sync {
            wallet = nil
            db = nil
            preparedSends.removeAll()
            isInitialized = false
        }
        super.invalidate()
    }
}
