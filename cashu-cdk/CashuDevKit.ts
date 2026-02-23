/**
 * CashuDevKit - React Native Bridge Module
 *
 * Provides a typed TypeScript interface to the native CDK FFI bindings
 * for both iOS (Swift) and Android (Kotlin).
 */

import { NativeModules } from 'react-native';
import {
    CDKProof,
    CDKToken,
    CDKMintInfo,
    CDKKeyset,
    CDKMintQuote,
    CDKMeltQuote,
    CDKMelted,
    CDKSpendingConditions,
    CDKSendOptions,
    CDKReceiveOptions,
    CDKProofState,
    CDKTransaction,
    CDKTransactionDirection,
    CDKErrorType,
    CDKError,
    CashuDevKitNativeModule
} from './types';

const { CashuDevKitModule } = NativeModules as unknown as {
    CashuDevKitModule: CashuDevKitNativeModule;
};

/**
 * Map native error messages to CDK error types
 */
function mapCDKError(error: any): CDKError {
    const message = error?.message || String(error);

    if (
        message.includes('Insufficient funds') ||
        message.includes('insufficient')
    ) {
        return { type: CDKErrorType.InsufficientFunds, message };
    }
    if (message.includes('Payment failed')) {
        return { type: CDKErrorType.PaymentFailed, message };
    }
    if (message.includes('Payment pending') || message.includes('pending')) {
        return { type: CDKErrorType.PaymentPending, message };
    }
    if (
        message.includes('Invalid token') ||
        message.includes('invalid token')
    ) {
        return { type: CDKErrorType.InvalidToken, message };
    }
    if (message.includes('network') || message.includes('connection')) {
        return { type: CDKErrorType.Network, message };
    }
    if (message.includes('database') || message.includes('sqlite')) {
        return { type: CDKErrorType.Database, message };
    }
    if (message.includes('mnemonic')) {
        return { type: CDKErrorType.InvalidMnemonic, message };
    }
    if (message.includes('url') || message.includes('URL')) {
        return { type: CDKErrorType.InvalidUrl, message };
    }
    if (message.includes('keyset')) {
        return { type: CDKErrorType.KeysetUnknown, message };
    }
    if (message.includes('unit')) {
        return { type: CDKErrorType.UnitNotSupported, message };
    }
    if (message.includes('expired')) {
        return { type: CDKErrorType.QuoteExpired, message };
    }
    if (message.includes('not paid') || message.includes('unpaid')) {
        return { type: CDKErrorType.QuoteNotPaid, message };
    }

    return { type: CDKErrorType.Generic, message };
}

/**
 * CashuDevKit class providing high-level wallet operations
 */
class CashuDevKit {
    private initialized: boolean = false;

    /**
     * Check if native module is available
     */
    isAvailable(): boolean {
        return CashuDevKitModule != null;
    }

    /**
     * Check if wallet is initialized
     */
    isInitialized(): boolean {
        return this.initialized;
    }

    // ========================================================================
    // Wallet Management
    // ========================================================================

    /**
     * Initialize the wallet with a BIP39 mnemonic
     * @param mnemonic - Space-separated BIP39 mnemonic words
     * @param unit - Currency unit ('sat' or 'msat'), defaults to 'sat'
     */
    async initializeWallet(
        mnemonic: string,
        unit: string = 'sat'
    ): Promise<void> {
        try {
            await CashuDevKitModule.initializeWallet(mnemonic, unit);
            this.initialized = true;
        } catch (error) {
            throw mapCDKError(error);
        }
    }

    /**
     * Add a mint to the wallet
     * @param mintUrl - The mint's URL
     * @param targetProofCount - Optional target number of proofs to maintain (0 = use default)
     */
    async addMint(mintUrl: string, targetProofCount?: number): Promise<void> {
        try {
            // Pass 0 as sentinel for "use default" since RN requires non-null NSNumber
            await CashuDevKitModule.addMint(mintUrl, targetProofCount ?? 0);
        } catch (error) {
            throw mapCDKError(error);
        }
    }

    /**
     * Remove a mint from the wallet
     * @param mintUrl - The mint's URL to remove
     */
    async removeMint(mintUrl: string): Promise<void> {
        try {
            await CashuDevKitModule.removeMint(mintUrl);
        } catch (error) {
            throw mapCDKError(error);
        }
    }

    /**
     * Get list of all configured mint URLs
     */
    async getMintUrls(): Promise<string[]> {
        try {
            return await CashuDevKitModule.getMintUrls();
        } catch (error) {
            throw mapCDKError(error);
        }
    }

    // ========================================================================
    // Balance Operations
    // ========================================================================

    /**
     * Get total balance across all mints
     */
    async getTotalBalance(): Promise<number> {
        try {
            return await CashuDevKitModule.getTotalBalance();
        } catch (error) {
            throw mapCDKError(error);
        }
    }

    /**
     * Get balance per mint
     * @returns Record mapping mint URL to balance in sats
     */
    async getBalances(): Promise<Record<string, number>> {
        try {
            const json = await CashuDevKitModule.getBalances();
            return JSON.parse(json);
        } catch (error) {
            throw mapCDKError(error);
        }
    }

    // ========================================================================
    // Mint Info
    // ========================================================================

    /**
     * Fetch mint information
     * @param mintUrl - The mint's URL
     */
    async fetchMintInfo(mintUrl: string): Promise<CDKMintInfo | null> {
        try {
            const json = await CashuDevKitModule.fetchMintInfo(mintUrl);
            return json ? JSON.parse(json) : null;
        } catch (error) {
            throw mapCDKError(error);
        }
    }

    /**
     * Get keysets for a mint
     * @param mintUrl - The mint's URL
     */
    async getMintKeysets(mintUrl: string): Promise<CDKKeyset[]> {
        try {
            const json = await CashuDevKitModule.getMintKeysets(mintUrl);
            return JSON.parse(json);
        } catch (error) {
            throw mapCDKError(error);
        }
    }

    // ========================================================================
    // Mint Quotes (Receiving ecash)
    // ========================================================================

    /**
     * Create a mint quote (Lightning invoice to receive ecash)
     * @param mintUrl - The mint's URL
     * @param amount - Amount in sats
     * @param description - Optional invoice description
     */
    async createMintQuote(
        mintUrl: string,
        amount: number,
        description?: string
    ): Promise<CDKMintQuote> {
        try {
            const json = await CashuDevKitModule.createMintQuote(
                mintUrl,
                amount,
                description
            );
            return JSON.parse(json);
        } catch (error) {
            throw mapCDKError(error);
        }
    }

    /**
     * Check status of a mint quote
     * @param mintUrl - The mint's URL
     * @param quoteId - The quote ID
     */
    async checkMintQuote(
        mintUrl: string,
        quoteId: string
    ): Promise<CDKMintQuote> {
        try {
            const json = await CashuDevKitModule.checkMintQuote(
                mintUrl,
                quoteId
            );
            return JSON.parse(json);
        } catch (error) {
            throw mapCDKError(error);
        }
    }

    /**
     * Check status of an external mint quote directly from the mint's HTTP API.
     * This bypasses CDK's local database check and works for quotes created
     * externally (e.g., by ZeusPay server).
     * @param mintUrl - The mint's URL
     * @param quoteId - The quote ID
     */
    async checkExternalMintQuote(
        mintUrl: string,
        quoteId: string
    ): Promise<CDKMintQuote & { pubkey?: string }> {
        try {
            const json = await CashuDevKitModule.checkExternalMintQuote(
                mintUrl,
                quoteId
            );
            return JSON.parse(json);
        } catch (error) {
            throw mapCDKError(error);
        }
    }

    /**
     * Add an external mint quote to CDK's database.
     * This allows minting from quotes created externally (e.g., by ZeusPay server).
     * Must be called before mintExternal for quotes not in CDK's database.
     * @param mintUrl - The mint's URL
     * @param quoteId - The quote ID
     * @param amount - The amount in sats
     * @param request - The Lightning invoice / payment request
     * @param state - The quote state (UNPAID, PAID, PENDING, ISSUED)
     * @param expiry - The quote expiry timestamp
     * @param secretKey - Optional hex-encoded secret key for P2PK-locked quotes
     */
    async addExternalMintQuote(
        mintUrl: string,
        quoteId: string,
        amount: number,
        request: string,
        state: string,
        expiry: number,
        secretKey?: string
    ): Promise<boolean> {
        try {
            return await CashuDevKitModule.addExternalMintQuote(
                mintUrl,
                quoteId,
                amount,
                request,
                state,
                expiry,
                secretKey
            );
        } catch (error) {
            throw mapCDKError(error);
        }
    }

    /**
     * Mint tokens from an external quote.
     * Note: You must call addExternalMintQuote first if the quote is not in CDK's database.
     * @param mintUrl - The mint's URL
     * @param quoteId - The quote ID
     * @param amount - The amount in sats
     */
    async mintExternal(
        mintUrl: string,
        quoteId: string,
        amount: number
    ): Promise<CDKProof[]> {
        try {
            const json = await CashuDevKitModule.mintExternal(
                mintUrl,
                quoteId,
                amount
            );
            return JSON.parse(json);
        } catch (error) {
            throw mapCDKError(error);
        }
    }

    /**
     * Mint proofs from a paid quote
     * @param mintUrl - The mint's URL
     * @param quoteId - The quote ID
     * @param conditions - Optional spending conditions (P2PK)
     */
    async mint(
        mintUrl: string,
        quoteId: string,
        conditions?: CDKSpendingConditions
    ): Promise<CDKProof[]> {
        try {
            const json = await CashuDevKitModule.mint(
                mintUrl,
                quoteId,
                conditions ? JSON.stringify(conditions) : undefined
            );
            return JSON.parse(json);
        } catch (error) {
            throw mapCDKError(error);
        }
    }

    // ========================================================================
    // Melt Quotes (Paying Lightning invoices)
    // ========================================================================

    /**
     * Create a melt quote (fee estimate for paying a Lightning invoice)
     * @param mintUrl - The mint's URL
     * @param request - BOLT11 invoice or BOLT12 offer
     * @param options - Optional melt options
     */
    async createMeltQuote(
        mintUrl: string,
        request: string,
        options?: any
    ): Promise<CDKMeltQuote> {
        try {
            const json = await CashuDevKitModule.createMeltQuote(
                mintUrl,
                request,
                options ? JSON.stringify(options) : undefined
            );
            return JSON.parse(json);
        } catch (error) {
            throw mapCDKError(error);
        }
    }

    /**
     * Check status of a melt quote
     * @param mintUrl - The mint's URL
     * @param quoteId - The quote ID
     */
    async checkMeltQuote(
        mintUrl: string,
        quoteId: string
    ): Promise<CDKMeltQuote> {
        try {
            const json = await CashuDevKitModule.checkMeltQuote(
                mintUrl,
                quoteId
            );
            return JSON.parse(json);
        } catch (error) {
            throw mapCDKError(error);
        }
    }

    /**
     * Execute melt (pay Lightning invoice using ecash)
     * @param mintUrl - The mint's URL
     * @param quoteId - The melt quote ID (from createMeltQuote)
     */
    async melt(mintUrl: string, quoteId: string): Promise<CDKMelted> {
        try {
            const json = await CashuDevKitModule.melt(mintUrl, quoteId);
            return JSON.parse(json);
        } catch (error) {
            throw mapCDKError(error);
        }
    }

    // ========================================================================
    // Token Operations (Send/Receive)
    // ========================================================================

    /**
     * Prepare a send operation (creates proofs for sending)
     * @param mintUrl - The mint's URL
     * @param amount - Amount in sats to send
     * @param options - Send options (memo, conditions, etc.)
     * @returns Prepared send ID for confirmation
     */
    async prepareSend(
        mintUrl: string,
        amount: number,
        options?: CDKSendOptions
    ): Promise<string> {
        try {
            return await CashuDevKitModule.prepareSend(
                mintUrl,
                amount,
                options ? JSON.stringify(options) : undefined
            );
        } catch (error) {
            throw mapCDKError(error);
        }
    }

    /**
     * Confirm and finalize a prepared send, returning the token
     * @param preparedSendId - ID from prepareSend
     * @param memo - Optional memo to include in token
     */
    async confirmSend(
        preparedSendId: string,
        memo?: string
    ): Promise<CDKToken> {
        try {
            const json = await CashuDevKitModule.confirmSend(
                preparedSendId,
                memo
            );
            return JSON.parse(json);
        } catch (error) {
            throw mapCDKError(error);
        }
    }

    /**
     * Cancel a prepared send (returns proofs to wallet)
     * @param preparedSendId - ID from prepareSend
     */
    async cancelSend(preparedSendId: string): Promise<void> {
        try {
            await CashuDevKitModule.cancelSend(preparedSendId);
        } catch (error) {
            throw mapCDKError(error);
        }
    }

    /**
     * Convenience method: send tokens in one step
     * @param mintUrl - The mint's URL
     * @param amount - Amount in sats
     * @param memo - Optional memo
     * @param conditions - Optional P2PK conditions
     */
    async send(
        mintUrl: string,
        amount: number,
        memo?: string,
        conditions?: CDKSpendingConditions
    ): Promise<CDKToken> {
        const options: CDKSendOptions = {
            send_kind: 'OnlineExact',
            include_fee: true,
            conditions,
            memo: memo ? { memo, include_memo: true } : undefined
        };

        const preparedId = await this.prepareSend(mintUrl, amount, options);
        return await this.confirmSend(preparedId, memo);
    }

    /**
     * Get encoded token string from a send operation
     * Convenience wrapper that returns just the encoded string
     * @param mintUrl - The mint's URL
     * @param amount - Amount in sats
     * @param memo - Optional memo
     */
    async getEncodedToken(
        mintUrl: string,
        amount: number,
        memo?: string
    ): Promise<string> {
        const token = await this.send(mintUrl, amount, memo);
        return token.encoded;
    }

    /**
     * Get balance for a specific mint
     * @param mintUrl - The mint's URL
     */
    async getMintBalance(mintUrl: string): Promise<number> {
        const balances = await this.getBalances();
        return balances[mintUrl] || 0;
    }

    /**
     * Receive an ecash token
     * @param encodedToken - The encoded cashu token string
     * @param options - Receive options (signing keys for P2PK, preimages for HTLC)
     * @returns Amount received in sats
     */
    async receive(
        encodedToken: string,
        options?: CDKReceiveOptions
    ): Promise<number> {
        try {
            return await CashuDevKitModule.receive(
                encodedToken,
                options ? JSON.stringify(options) : undefined
            );
        } catch (error) {
            throw mapCDKError(error);
        }
    }

    // ========================================================================
    // Token Utility
    // ========================================================================

    /**
     * Decode an encoded cashu token without receiving it
     * @param encodedToken - The encoded token string
     */
    async decodeToken(encodedToken: string): Promise<CDKToken> {
        try {
            const json = await CashuDevKitModule.decodeToken(encodedToken);
            return JSON.parse(json);
        } catch (error) {
            throw mapCDKError(error);
        }
    }

    /**
     * Validate if a string is a valid cashu token
     * @param token - The token string to validate
     */
    async isValidToken(token: string): Promise<boolean> {
        try {
            return await CashuDevKitModule.isValidToken(token);
        } catch {
            return false;
        }
    }

    // ========================================================================
    // Restore
    // ========================================================================

    /**
     * Restore proofs from seed for a mint
     * @param mintUrl - The mint's URL
     * @returns Amount restored in sats
     */
    async restore(mintUrl: string): Promise<number> {
        try {
            return await CashuDevKitModule.restore(mintUrl);
        } catch (error) {
            throw mapCDKError(error);
        }
    }

    /**
     * Restore proofs from a raw seed (v1 legacy seed) for a mint
     * @param mintUrl - The mint's URL
     * @param seedHex - Hex-encoded raw seed bytes
     * @returns Amount restored in sats
     */
    async restoreFromSeed(mintUrl: string, seedHex: string): Promise<number> {
        try {
            return await CashuDevKitModule.restoreFromSeed(mintUrl, seedHex);
        } catch (error) {
            throw mapCDKError(error);
        }
    }

    // ========================================================================
    // Proof Management
    // ========================================================================

    /**
     * Check spending state of proofs
     * @param mintUrl - The mint's URL
     * @param proofs - Array of proofs to check
     */
    async checkProofsState(
        mintUrl: string,
        proofs: CDKProof[]
    ): Promise<CDKProofState[]> {
        try {
            const json = await CashuDevKitModule.checkProofsState(
                mintUrl,
                JSON.stringify(proofs)
            );
            return JSON.parse(json);
        } catch (error) {
            throw mapCDKError(error);
        }
    }

    // ========================================================================
    // BOLT12 Support
    // ========================================================================

    /**
     * Create a BOLT12 mint quote
     * @param mintUrl - The mint's URL
     * @param amount - Amount in sats (0 for amountless offers)
     * @param description - Optional description
     */
    async createMintBolt12Quote(
        mintUrl: string,
        amount?: number,
        description?: string
    ): Promise<CDKMintQuote> {
        try {
            const json = await CashuDevKitModule.createMintBolt12Quote(
                mintUrl,
                amount ?? 0,
                description
            );
            return JSON.parse(json);
        } catch (error) {
            throw mapCDKError(error);
        }
    }

    /**
     * Create a BOLT12 melt quote
     * @param mintUrl - The mint's URL
     * @param request - BOLT12 offer string
     * @param options - Optional melt options
     */
    async createMeltBolt12Quote(
        mintUrl: string,
        request: string,
        options?: any
    ): Promise<CDKMeltQuote> {
        try {
            const json = await CashuDevKitModule.createMeltBolt12Quote(
                mintUrl,
                request,
                options ? JSON.stringify(options) : undefined
            );
            return JSON.parse(json);
        } catch (error) {
            throw mapCDKError(error);
        }
    }

    /**
     * Create a melt quote for human-readable addresses (BIP353 or Lightning Address)
     * @param mintUrl - The mint's URL
     * @param address - Human readable address (e.g., "user@domain.com")
     * @param amountMsat - Amount in millisatoshis
     */
    async createMeltHumanReadableQuote(
        mintUrl: string,
        address: string,
        amountMsat: number
    ): Promise<CDKMeltQuote> {
        try {
            const json = await CashuDevKitModule.createMeltHumanReadableQuote(
                mintUrl,
                address,
                amountMsat
            );
            return JSON.parse(json);
        } catch (error) {
            throw mapCDKError(error);
        }
    }

    // ========================================================================
    // Transactions
    // ========================================================================

    /**
     * List transaction history
     * @param direction - Optional filter by direction ('incoming' or 'outgoing')
     */
    async listTransactions(
        direction?: CDKTransactionDirection
    ): Promise<CDKTransaction[]> {
        try {
            const json = await CashuDevKitModule.listTransactions(direction);
            return JSON.parse(json);
        } catch (error) {
            throw mapCDKError(error);
        }
    }

    // ========================================================================
    // Database
    // ========================================================================

    /**
     * Get the SQLite database path
     */
    async getDatabasePath(): Promise<string> {
        try {
            return await CashuDevKitModule.getDatabasePath();
        } catch (error) {
            throw mapCDKError(error);
        }
    }
}

// Export singleton instance
export default new CashuDevKit();

// Also export class for testing
export { CashuDevKit };

// Re-export types
export * from './types';
