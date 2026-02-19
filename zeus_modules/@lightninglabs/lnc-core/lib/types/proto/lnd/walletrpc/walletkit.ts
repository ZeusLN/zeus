/* eslint-disable */
import type {
    CoinSelectionStrategy,
    Utxo,
    OutPoint,
    ChannelPoint,
    TransactionDetails,
    Transaction as Transaction1
} from '../lightning';
import type { TxOut, KeyDescriptor, KeyLocator } from '../signrpc/signer';

export enum AddressType {
    UNKNOWN = 'UNKNOWN',
    WITNESS_PUBKEY_HASH = 'WITNESS_PUBKEY_HASH',
    NESTED_WITNESS_PUBKEY_HASH = 'NESTED_WITNESS_PUBKEY_HASH',
    HYBRID_NESTED_WITNESS_PUBKEY_HASH = 'HYBRID_NESTED_WITNESS_PUBKEY_HASH',
    TAPROOT_PUBKEY = 'TAPROOT_PUBKEY',
    UNRECOGNIZED = 'UNRECOGNIZED'
}

export enum WitnessType {
    UNKNOWN_WITNESS = 'UNKNOWN_WITNESS',
    /**
     * COMMITMENT_TIME_LOCK - A witness that allows us to spend the output of a commitment transaction
     * after a relative lock-time lockout.
     */
    COMMITMENT_TIME_LOCK = 'COMMITMENT_TIME_LOCK',
    /**
     * COMMITMENT_NO_DELAY - A witness that allows us to spend a settled no-delay output immediately on a
     * counterparty's commitment transaction.
     */
    COMMITMENT_NO_DELAY = 'COMMITMENT_NO_DELAY',
    /**
     * COMMITMENT_REVOKE - A witness that allows us to sweep the settled output of a malicious
     * counterparty's who broadcasts a revoked commitment transaction.
     */
    COMMITMENT_REVOKE = 'COMMITMENT_REVOKE',
    /**
     * HTLC_OFFERED_REVOKE - A witness that allows us to sweep an HTLC which we offered to the remote
     * party in the case that they broadcast a revoked commitment state.
     */
    HTLC_OFFERED_REVOKE = 'HTLC_OFFERED_REVOKE',
    /**
     * HTLC_ACCEPTED_REVOKE - A witness that allows us to sweep an HTLC output sent to us in the case that
     * the remote party broadcasts a revoked commitment state.
     */
    HTLC_ACCEPTED_REVOKE = 'HTLC_ACCEPTED_REVOKE',
    /**
     * HTLC_OFFERED_TIMEOUT_SECOND_LEVEL - A witness that allows us to sweep an HTLC output that we extended to a
     * party, but was never fulfilled.  This HTLC output isn't directly on the
     * commitment transaction, but is the result of a confirmed second-level HTLC
     * transaction. As a result, we can only spend this after a CSV delay.
     */
    HTLC_OFFERED_TIMEOUT_SECOND_LEVEL = 'HTLC_OFFERED_TIMEOUT_SECOND_LEVEL',
    /**
     * HTLC_ACCEPTED_SUCCESS_SECOND_LEVEL - A witness that allows us to sweep an HTLC output that was offered to us, and
     * for which we have a payment preimage. This HTLC output isn't directly on our
     * commitment transaction, but is the result of confirmed second-level HTLC
     * transaction. As a result, we can only spend this after a CSV delay.
     */
    HTLC_ACCEPTED_SUCCESS_SECOND_LEVEL = 'HTLC_ACCEPTED_SUCCESS_SECOND_LEVEL',
    /**
     * HTLC_OFFERED_REMOTE_TIMEOUT - A witness that allows us to sweep an HTLC that we offered to the remote
     * party which lies in the commitment transaction of the remote party. We can
     * spend this output after the absolute CLTV timeout of the HTLC as passed.
     */
    HTLC_OFFERED_REMOTE_TIMEOUT = 'HTLC_OFFERED_REMOTE_TIMEOUT',
    /**
     * HTLC_ACCEPTED_REMOTE_SUCCESS - A witness that allows us to sweep an HTLC that was offered to us by the
     * remote party. We use this witness in the case that the remote party goes to
     * chain, and we know the pre-image to the HTLC. We can sweep this without any
     * additional timeout.
     */
    HTLC_ACCEPTED_REMOTE_SUCCESS = 'HTLC_ACCEPTED_REMOTE_SUCCESS',
    /**
     * HTLC_SECOND_LEVEL_REVOKE - A witness that allows us to sweep an HTLC from the remote party's commitment
     * transaction in the case that the broadcast a revoked commitment, but then
     * also immediately attempt to go to the second level to claim the HTLC.
     */
    HTLC_SECOND_LEVEL_REVOKE = 'HTLC_SECOND_LEVEL_REVOKE',
    /**
     * WITNESS_KEY_HASH - A witness type that allows us to spend a regular p2wkh output that's sent to
     * an output which is under complete control of the backing wallet.
     */
    WITNESS_KEY_HASH = 'WITNESS_KEY_HASH',
    /**
     * NESTED_WITNESS_KEY_HASH - A witness type that allows us to sweep an output that sends to a nested P2SH
     * script that pays to a key solely under our control.
     */
    NESTED_WITNESS_KEY_HASH = 'NESTED_WITNESS_KEY_HASH',
    /**
     * COMMITMENT_ANCHOR - A witness type that allows us to spend our anchor on the commitment
     * transaction.
     */
    COMMITMENT_ANCHOR = 'COMMITMENT_ANCHOR',
    /**
     * COMMITMENT_NO_DELAY_TWEAKLESS - A witness type that is similar to the COMMITMENT_NO_DELAY type,
     * but it omits the tweak that randomizes the key we need to
     * spend with a channel peer supplied set of randomness.
     */
    COMMITMENT_NO_DELAY_TWEAKLESS = 'COMMITMENT_NO_DELAY_TWEAKLESS',
    /**
     * COMMITMENT_TO_REMOTE_CONFIRMED - A witness type that allows us to spend our output on the counterparty's
     * commitment transaction after a confirmation.
     */
    COMMITMENT_TO_REMOTE_CONFIRMED = 'COMMITMENT_TO_REMOTE_CONFIRMED',
    /**
     * HTLC_OFFERED_TIMEOUT_SECOND_LEVEL_INPUT_CONFIRMED - A witness type that allows us to sweep an HTLC output that we extended
     * to a party, but was never fulfilled. This _is_ the HTLC output directly
     * on our commitment transaction, and the input to the second-level HTLC
     * timeout transaction. It can only be spent after CLTV expiry, and
     * commitment confirmation.
     */
    HTLC_OFFERED_TIMEOUT_SECOND_LEVEL_INPUT_CONFIRMED = 'HTLC_OFFERED_TIMEOUT_SECOND_LEVEL_INPUT_CONFIRMED',
    /**
     * HTLC_ACCEPTED_SUCCESS_SECOND_LEVEL_INPUT_CONFIRMED - A witness type that allows us to sweep an HTLC output that was offered
     * to us, and for which we have a payment preimage. This _is_ the HTLC
     * output directly on our commitment transaction, and the input to the
     * second-level HTLC success transaction. It can only be spent after the
     * commitment has confirmed.
     */
    HTLC_ACCEPTED_SUCCESS_SECOND_LEVEL_INPUT_CONFIRMED = 'HTLC_ACCEPTED_SUCCESS_SECOND_LEVEL_INPUT_CONFIRMED',
    /**
     * LEASE_COMMITMENT_TIME_LOCK - A witness type that allows us to spend our output on our local
     * commitment transaction after a relative and absolute lock-time lockout as
     * part of the script enforced lease commitment type.
     */
    LEASE_COMMITMENT_TIME_LOCK = 'LEASE_COMMITMENT_TIME_LOCK',
    /**
     * LEASE_COMMITMENT_TO_REMOTE_CONFIRMED - A witness type that allows us to spend our output on the counterparty's
     * commitment transaction after a confirmation and absolute locktime as part
     * of the script enforced lease commitment type.
     */
    LEASE_COMMITMENT_TO_REMOTE_CONFIRMED = 'LEASE_COMMITMENT_TO_REMOTE_CONFIRMED',
    /**
     * LEASE_HTLC_OFFERED_TIMEOUT_SECOND_LEVEL - A witness type that allows us to sweep an HTLC output that we extended
     * to a party, but was never fulfilled. This HTLC output isn't directly on
     * the commitment transaction, but is the result of a confirmed second-level
     * HTLC transaction. As a result, we can only spend this after a CSV delay
     * and CLTV locktime as part of the script enforced lease commitment type.
     */
    LEASE_HTLC_OFFERED_TIMEOUT_SECOND_LEVEL = 'LEASE_HTLC_OFFERED_TIMEOUT_SECOND_LEVEL',
    /**
     * LEASE_HTLC_ACCEPTED_SUCCESS_SECOND_LEVEL - A witness type that allows us to sweep an HTLC output that was offered
     * to us, and for which we have a payment preimage. This HTLC output isn't
     * directly on our commitment transaction, but is the result of confirmed
     * second-level HTLC transaction. As a result, we can only spend this after
     * a CSV delay and CLTV locktime as part of the script enforced lease
     * commitment type.
     */
    LEASE_HTLC_ACCEPTED_SUCCESS_SECOND_LEVEL = 'LEASE_HTLC_ACCEPTED_SUCCESS_SECOND_LEVEL',
    /**
     * TAPROOT_PUB_KEY_SPEND - A witness type that allows us to spend a regular p2tr output that's sent
     * to an output which is under complete control of the backing wallet.
     */
    TAPROOT_PUB_KEY_SPEND = 'TAPROOT_PUB_KEY_SPEND',
    /**
     * TAPROOT_LOCAL_COMMIT_SPEND - A witness type that allows us to spend our settled local commitment after a
     * CSV delay when we force close the channel.
     */
    TAPROOT_LOCAL_COMMIT_SPEND = 'TAPROOT_LOCAL_COMMIT_SPEND',
    /**
     * TAPROOT_REMOTE_COMMIT_SPEND - A witness type that allows us to spend our settled local commitment after
     * a CSV delay when the remote party has force closed the channel.
     */
    TAPROOT_REMOTE_COMMIT_SPEND = 'TAPROOT_REMOTE_COMMIT_SPEND',
    /** TAPROOT_ANCHOR_SWEEP_SPEND - A witness type that we'll use for spending our own anchor output. */
    TAPROOT_ANCHOR_SWEEP_SPEND = 'TAPROOT_ANCHOR_SWEEP_SPEND',
    /**
     * TAPROOT_HTLC_OFFERED_TIMEOUT_SECOND_LEVEL - A witness that allows us to timeout an HTLC we offered to the remote party
     * on our commitment transaction. We use this when we need to go on chain to
     * time out an HTLC.
     */
    TAPROOT_HTLC_OFFERED_TIMEOUT_SECOND_LEVEL = 'TAPROOT_HTLC_OFFERED_TIMEOUT_SECOND_LEVEL',
    /**
     * TAPROOT_HTLC_ACCEPTED_SUCCESS_SECOND_LEVEL - A witness type that allows us to sweep an HTLC we accepted on our commitment
     * transaction after we go to the second level on chain.
     */
    TAPROOT_HTLC_ACCEPTED_SUCCESS_SECOND_LEVEL = 'TAPROOT_HTLC_ACCEPTED_SUCCESS_SECOND_LEVEL',
    /**
     * TAPROOT_HTLC_SECOND_LEVEL_REVOKE - A witness that allows us to sweep an HTLC on the revoked transaction of the
     * remote party that goes to the second level.
     */
    TAPROOT_HTLC_SECOND_LEVEL_REVOKE = 'TAPROOT_HTLC_SECOND_LEVEL_REVOKE',
    /**
     * TAPROOT_HTLC_ACCEPTED_REVOKE - A witness that allows us to sweep an HTLC sent to us by the remote party
     * in the event that they broadcast a revoked state.
     */
    TAPROOT_HTLC_ACCEPTED_REVOKE = 'TAPROOT_HTLC_ACCEPTED_REVOKE',
    /**
     * TAPROOT_HTLC_OFFERED_REVOKE - A witness that allows us to sweep an HTLC we offered to the remote party if
     * they broadcast a revoked commitment.
     */
    TAPROOT_HTLC_OFFERED_REVOKE = 'TAPROOT_HTLC_OFFERED_REVOKE',
    /**
     * TAPROOT_HTLC_OFFERED_REMOTE_TIMEOUT - A witness that allows us to sweep an HTLC we offered to the remote party
     * that lies on the commitment transaction for the remote party. We can spend
     * this output after the absolute CLTV timeout of the HTLC as passed.
     */
    TAPROOT_HTLC_OFFERED_REMOTE_TIMEOUT = 'TAPROOT_HTLC_OFFERED_REMOTE_TIMEOUT',
    /**
     * TAPROOT_HTLC_LOCAL_OFFERED_TIMEOUT - A witness type that allows us to sign the second level HTLC timeout
     * transaction when spending from an HTLC residing on our local commitment
     * transaction.
     * This is used by the sweeper to re-sign inputs if it needs to aggregate
     * several second level HTLCs.
     */
    TAPROOT_HTLC_LOCAL_OFFERED_TIMEOUT = 'TAPROOT_HTLC_LOCAL_OFFERED_TIMEOUT',
    /**
     * TAPROOT_HTLC_ACCEPTED_REMOTE_SUCCESS - A witness that allows us to sweep an HTLC that was offered to us by the
     * remote party for a taproot channels. We use this witness in the case that
     * the remote party goes to chain, and we know the pre-image to the HTLC. We
     * can sweep this without any additional timeout.
     */
    TAPROOT_HTLC_ACCEPTED_REMOTE_SUCCESS = 'TAPROOT_HTLC_ACCEPTED_REMOTE_SUCCESS',
    /**
     * TAPROOT_HTLC_ACCEPTED_LOCAL_SUCCESS - A witness type that allows us to sweep the HTLC offered to us on our local
     * commitment transaction. We'll use this when we need to go on chain to sweep
     * the HTLC. In this case, this is the second level HTLC success transaction.
     */
    TAPROOT_HTLC_ACCEPTED_LOCAL_SUCCESS = 'TAPROOT_HTLC_ACCEPTED_LOCAL_SUCCESS',
    /**
     * TAPROOT_COMMITMENT_REVOKE - A witness that allows us to sweep the settled output of a malicious
     * counterparty's who broadcasts a revoked taproot commitment transaction.
     */
    TAPROOT_COMMITMENT_REVOKE = 'TAPROOT_COMMITMENT_REVOKE',
    UNRECOGNIZED = 'UNRECOGNIZED'
}

/**
 * The possible change address types for default accounts and single imported
 * public keys. By default, P2WPKH will be used. We don't provide the
 * possibility to choose P2PKH as it is a legacy key scope, nor NP2WPKH as
 * no key scope permits to do so. For custom accounts, no change type should
 * be provided as the coin selection key scope will always be used to generate
 * the change address.
 */
export enum ChangeAddressType {
    /**
     * CHANGE_ADDRESS_TYPE_UNSPECIFIED - CHANGE_ADDRESS_TYPE_UNSPECIFIED indicates that no change address type is
     * provided. We will then use P2WPKH address type for change (BIP0084 key
     * scope).
     */
    CHANGE_ADDRESS_TYPE_UNSPECIFIED = 'CHANGE_ADDRESS_TYPE_UNSPECIFIED',
    /**
     * CHANGE_ADDRESS_TYPE_P2TR - CHANGE_ADDRESS_TYPE_P2TR indicates to use P2TR address for change output
     * (BIP0086 key scope).
     */
    CHANGE_ADDRESS_TYPE_P2TR = 'CHANGE_ADDRESS_TYPE_P2TR',
    UNRECOGNIZED = 'UNRECOGNIZED'
}

export interface ListUnspentRequest {
    /** The minimum number of confirmations to be included. */
    minConfs: number;
    /** The maximum number of confirmations to be included. */
    maxConfs: number;
    /** An optional filter to only include outputs belonging to an account. */
    account: string;
    /**
     * When min_confs and max_confs are zero, setting false implicitly
     * overrides max_confs to be MaxInt32, otherwise max_confs remains
     * zero. An error is returned if the value is true and both min_confs
     * and max_confs are non-zero. (default: false)
     */
    unconfirmedOnly: boolean;
}

export interface ListUnspentResponse {
    /** A list of utxos satisfying the specified number of confirmations. */
    utxos: Utxo[];
}

export interface LeaseOutputRequest {
    /**
     * An ID of 32 random bytes that must be unique for each distinct application
     * using this RPC which will be used to bound the output lease to.
     */
    id: Uint8Array | string;
    /** The identifying outpoint of the output being leased. */
    outpoint: OutPoint | undefined;
    /**
     * The time in seconds before the lock expires. If set to zero, the default
     * lock duration is used.
     */
    expirationSeconds: string;
}

export interface LeaseOutputResponse {
    /** The absolute expiration of the output lease represented as a unix timestamp. */
    expiration: string;
}

export interface ReleaseOutputRequest {
    /** The unique ID that was used to lock the output. */
    id: Uint8Array | string;
    /** The identifying outpoint of the output being released. */
    outpoint: OutPoint | undefined;
}

export interface ReleaseOutputResponse {
    /** The status of the release operation. */
    status: string;
}

export interface KeyReq {
    /**
     * Is the key finger print of the root pubkey that this request is targeting.
     * This allows the WalletKit to possibly serve out keys for multiple HD chains
     * via public derivation.
     */
    keyFingerPrint: number;
    /**
     * The target key family to derive a key from. In other contexts, this is
     * known as the "account".
     */
    keyFamily: number;
}

export interface AddrRequest {
    /**
     * The name of the account to retrieve the next address of. If empty, the
     * default wallet account is used.
     */
    account: string;
    /** The type of address to derive. */
    type: AddressType;
    /** Whether a change address should be derived. */
    change: boolean;
}

export interface AddrResponse {
    /** The address encoded using a bech32 format. */
    addr: string;
}

export interface Account {
    /** The name used to identify the account. */
    name: string;
    /** The type of addresses the account supports. */
    addressType: AddressType;
    /**
     * The public key backing the account that all keys are derived from
     * represented as an extended key. This will always be empty for the default
     * imported account in which single public keys are imported into.
     */
    extendedPublicKey: string;
    /**
     * The fingerprint of the root key from which the account public key was
     * derived from. This will always be zero for the default imported account in
     * which single public keys are imported into. The bytes are in big-endian
     * order.
     */
    masterKeyFingerprint: Uint8Array | string;
    /**
     * The derivation path corresponding to the account public key. This will
     * always be empty for the default imported account in which single public keys
     * are imported into.
     */
    derivationPath: string;
    /**
     * The number of keys derived from the external branch of the account public
     * key. This will always be zero for the default imported account in which
     * single public keys are imported into.
     */
    externalKeyCount: number;
    /**
     * The number of keys derived from the internal branch of the account public
     * key. This will always be zero for the default imported account in which
     * single public keys are imported into.
     */
    internalKeyCount: number;
    /** Whether the wallet stores private keys for the account. */
    watchOnly: boolean;
}

export interface AddressProperty {
    /**
     * The address encoded using the appropriate format depending on the
     * address type (base58, bech32, bech32m).
     *
     * Note that lnd's internal/custom keys for channels and other
     * functionality are derived from the same scope. Since they
     * aren't really used as addresses and will never have an
     * on-chain balance, we'll show the public key instead (only if
     * the show_custom_accounts flag is provided).
     */
    address: string;
    /** Denotes if the address is a change address. */
    isInternal: boolean;
    /** The balance of the address. */
    balance: string;
    /**
     * The full derivation path of the address. This will be empty for imported
     * addresses.
     */
    derivationPath: string;
    /** The public key of the address. This will be empty for imported addresses. */
    publicKey: Uint8Array | string;
}

export interface AccountWithAddresses {
    /** The name used to identify the account. */
    name: string;
    /** The type of addresses the account supports. */
    addressType: AddressType;
    /**
     * The derivation path corresponding to the account public key. This will
     * always be empty for the default imported account in which single public keys
     * are imported into.
     */
    derivationPath: string;
    /**
     * List of address, its type internal/external & balance.
     * Note that the order of addresses will be random and not according to the
     * derivation index, since that information is not stored by the underlying
     * wallet.
     */
    addresses: AddressProperty[];
}

export interface ListAccountsRequest {
    /** An optional filter to only return accounts matching this name. */
    name: string;
    /** An optional filter to only return accounts matching this address type. */
    addressType: AddressType;
}

export interface ListAccountsResponse {
    accounts: Account[];
}

export interface RequiredReserveRequest {
    /** The number of additional channels the user would like to open. */
    additionalPublicChannels: number;
}

export interface RequiredReserveResponse {
    /** The amount of reserve required. */
    requiredReserve: string;
}

export interface ListAddressesRequest {
    /** An optional filter to only return addresses matching this account. */
    accountName: string;
    /**
     * An optional flag to return LND's custom accounts (Purpose=1017)
     * public key along with other addresses.
     */
    showCustomAccounts: boolean;
}

export interface ListAddressesResponse {
    /** A list of all the accounts and their addresses. */
    accountWithAddresses: AccountWithAddresses[];
}

export interface GetTransactionRequest {
    /** The txid of the transaction. */
    txid: string;
}

export interface SignMessageWithAddrRequest {
    /**
     * The message to be signed. When using REST, this field must be encoded as
     * base64.
     */
    msg: Uint8Array | string;
    /**
     * The address which will be used to look up the private key and sign the
     * corresponding message.
     */
    addr: string;
}

export interface SignMessageWithAddrResponse {
    /** The compact ECDSA signature for the given message encoded in base64. */
    signature: string;
}

export interface VerifyMessageWithAddrRequest {
    /**
     * The message to be signed. When using REST, this field must be encoded as
     * base64.
     */
    msg: Uint8Array | string;
    /**
     * The compact ECDSA signature to be verified over the given message
     * ecoded in base64.
     */
    signature: string;
    /**
     * The address which will be used to look up the public key and verify the
     * the signature.
     */
    addr: string;
}

export interface VerifyMessageWithAddrResponse {
    /** Whether the signature was valid over the given message. */
    valid: boolean;
    /** The pubkey recovered from the signature. */
    pubkey: Uint8Array | string;
}

export interface ImportAccountRequest {
    /** A name to identify the account with. */
    name: string;
    /**
     * A public key that corresponds to a wallet account represented as an extended
     * key. It must conform to a derivation path of the form
     * m/purpose'/coin_type'/account'.
     */
    extendedPublicKey: string;
    /**
     * The fingerprint of the root key (also known as the key with derivation path
     * m/) from which the account public key was derived from. This may be required
     * by some hardware wallets for proper identification and signing. The bytes
     * must be in big-endian order.
     */
    masterKeyFingerprint: Uint8Array | string;
    /**
     * An address type is only required when the extended account public key has a
     * legacy version (xpub, tpub, etc.), such that the wallet cannot detect what
     * address scheme it belongs to.
     */
    addressType: AddressType;
    /**
     * Whether a dry run should be attempted when importing the account. This
     * serves as a way to confirm whether the account is being imported correctly
     * by returning the first N addresses for the external and internal branches of
     * the account. If these addresses match as expected, then it should be safe to
     * import the account as is.
     */
    dryRun: boolean;
}

export interface ImportAccountResponse {
    /** The details of the imported account. */
    account: Account | undefined;
    /**
     * The first N addresses that belong to the external branch of the account.
     * The external branch is typically used for external non-change addresses.
     * These are only returned if a dry run was specified within the request.
     */
    dryRunExternalAddrs: string[];
    /**
     * The first N addresses that belong to the internal branch of the account.
     * The internal branch is typically used for change addresses. These are only
     * returned if a dry run was specified within the request.
     */
    dryRunInternalAddrs: string[];
}

export interface ImportPublicKeyRequest {
    /** A compressed public key represented as raw bytes. */
    publicKey: Uint8Array | string;
    /** The type of address that will be generated from the public key. */
    addressType: AddressType;
}

export interface ImportPublicKeyResponse {
    /** The status of the import operation. */
    status: string;
}

export interface ImportTapscriptRequest {
    /** The internal public key, serialized as 32-byte x-only public key. */
    internalPublicKey: Uint8Array | string;
    /**
     * The full script tree with all individual leaves is known and the root
     * hash can be constructed from the full tree directly.
     */
    fullTree: TapscriptFullTree | undefined;
    /**
     * Only a single script leaf is known. To construct the root hash, the full
     * inclusion proof must also be provided.
     */
    partialReveal: TapscriptPartialReveal | undefined;
    /**
     * Only the root hash of the Taproot script tree (or other form of Taproot
     * commitment) is known.
     */
    rootHashOnly: Uint8Array | string | undefined;
    /**
     * Only the final, tweaked Taproot key is known and no additional
     * information about the internal key or type of tweak that was used to
     * derive it. When this is set, the wallet treats the key in
     * internal_public_key as the Taproot key directly. This can be useful for
     * tracking arbitrary Taproot outputs without the goal of ever being able
     * to spend from them through the internal wallet.
     */
    fullKeyOnly: boolean | undefined;
}

export interface TapscriptFullTree {
    /** The complete, ordered list of all tap leaves of the tree. */
    allLeaves: TapLeaf[];
}

export interface TapLeaf {
    /** The leaf version. Should be 0xc0 (192) in case of a SegWit v1 script. */
    leafVersion: number;
    /** The script of the tap leaf. */
    script: Uint8Array | string;
}

export interface TapscriptPartialReveal {
    /** The tap leaf that is known and will be revealed. */
    revealedLeaf: TapLeaf | undefined;
    /**
     * The BIP-0341 serialized inclusion proof that is required to prove that
     * the revealed leaf is part of the tree. This contains 0..n blocks of 32
     * bytes. If the tree only contained a single leaf (which is the revealed
     * leaf), this can be empty.
     */
    fullInclusionProof: Uint8Array | string;
}

export interface ImportTapscriptResponse {
    /**
     * The resulting pay-to-Taproot address that represents the imported internal
     * key with the script committed to it.
     */
    p2trAddress: string;
}

export interface Transaction {
    /**
     * The raw serialized transaction. Despite the field name, this does need to be
     * specified in raw bytes (or base64 encoded when using REST) and not in hex.
     * To not break existing software, the field can't simply be renamed.
     */
    txHex: Uint8Array | string;
    /** An optional label to save with the transaction. Limited to 500 characters. */
    label: string;
}

export interface PublishResponse {
    /**
     * If blank, then no error occurred and the transaction was successfully
     * published. If not the empty string, then a string representation of the
     * broadcast error.
     *
     * TODO(roasbeef): map to a proper enum type
     */
    publishError: string;
}

export interface RemoveTransactionResponse {
    /** The status of the remove transaction operation. */
    status: string;
}

export interface SendOutputsRequest {
    /**
     * The number of satoshis per kilo weight that should be used when crafting
     * this transaction.
     */
    satPerKw: string;
    /** A slice of the outputs that should be created in the transaction produced. */
    outputs: TxOut[];
    /** An optional label for the transaction, limited to 500 characters. */
    label: string;
    /**
     * The minimum number of confirmations each one of your outputs used for
     * the transaction must satisfy.
     */
    minConfs: number;
    /** Whether unconfirmed outputs should be used as inputs for the transaction. */
    spendUnconfirmed: boolean;
    /** The strategy to use for selecting coins during sending the outputs. */
    coinSelectionStrategy: CoinSelectionStrategy;
}

export interface SendOutputsResponse {
    /** The serialized transaction sent out on the network. */
    rawTx: Uint8Array | string;
}

export interface EstimateFeeRequest {
    /** The number of confirmations to shoot for when estimating the fee. */
    confTarget: number;
}

export interface EstimateFeeResponse {
    /**
     * The amount of satoshis per kw that should be used in order to reach the
     * confirmation target in the request.
     */
    satPerKw: string;
    /** The current minimum relay fee based on our chain backend in sat/kw. */
    minRelayFeeSatPerKw: string;
}

export interface PendingSweep {
    /** The outpoint of the output we're attempting to sweep. */
    outpoint: OutPoint | undefined;
    /** The witness type of the output we're attempting to sweep. */
    witnessType: WitnessType;
    /** The value of the output we're attempting to sweep. */
    amountSat: number;
    /**
     * Deprecated, use sat_per_vbyte.
     * The fee rate we'll use to sweep the output, expressed in sat/vbyte. The fee
     * rate is only determined once a sweeping transaction for the output is
     * created, so it's possible for this to be 0 before this.
     *
     * @deprecated
     */
    satPerByte: number;
    /** The number of broadcast attempts we've made to sweep the output. */
    broadcastAttempts: number;
    /**
     * Deprecated.
     * The next height of the chain at which we'll attempt to broadcast the
     * sweep transaction of the output.
     *
     * @deprecated
     */
    nextBroadcastHeight: number;
    /**
     * Deprecated, use immediate.
     * Whether this input must be force-swept. This means that it is swept
     * immediately.
     *
     * @deprecated
     */
    force: boolean;
    /**
     * Deprecated, use deadline.
     * The requested confirmation target for this output, which is the deadline
     * used by the sweeper.
     *
     * @deprecated
     */
    requestedConfTarget: number;
    /**
     * Deprecated, use requested_sat_per_vbyte.
     * The requested fee rate, expressed in sat/vbyte, for this output.
     *
     * @deprecated
     */
    requestedSatPerByte: number;
    /**
     * The current fee rate we'll use to sweep the output, expressed in sat/vbyte.
     * The fee rate is only determined once a sweeping transaction for the output
     * is created, so it's possible for this to be 0 before this.
     */
    satPerVbyte: string;
    /**
     * The requested starting fee rate, expressed in sat/vbyte, for this
     * output. When not requested, this field will be 0.
     */
    requestedSatPerVbyte: string;
    /** Whether this input will be swept immediately. */
    immediate: boolean;
    /**
     * The budget for this sweep, expressed in satoshis. This is the maximum amount
     * that can be spent as fees to sweep this output.
     */
    budget: string;
    /** The deadline height used for this output when perform fee bumping. */
    deadlineHeight: number;
    /**
     * The block height which the input's locktime will expire at. Zero if the
     * input has no locktime.
     */
    maturityHeight: number;
}

export interface PendingSweepsRequest {}

export interface PendingSweepsResponse {
    /** The set of outputs currently being swept by lnd's central batching engine. */
    pendingSweeps: PendingSweep[];
}

export interface BumpFeeRequest {
    /** The input we're attempting to bump the fee of. */
    outpoint: OutPoint | undefined;
    /**
     * Optional. The conf target the underlying fee estimator will use to
     * estimate the starting fee rate for the fee function.
     */
    targetConf: number;
    /**
     * Deprecated, use sat_per_vbyte.
     * The fee rate, expressed in sat/vbyte, that should be used to spend the input
     * with.
     *
     * @deprecated
     */
    satPerByte: number;
    /**
     * Deprecated, use immediate.
     * Whether this input must be force-swept. This means that it is swept
     * immediately.
     *
     * @deprecated
     */
    force: boolean;
    /**
     * Optional. The starting fee rate, expressed in sat/vbyte, that will be used
     * to spend the input with initially. This value will be used by the sweeper's
     * fee function as its starting fee rate. When not set, the sweeper will use
     * the estimated fee rate using the `target_conf` as the starting fee rate.
     */
    satPerVbyte: string;
    /**
     * Optional. Whether this input will be swept immediately. When set to true,
     * the sweeper will sweep this input without waiting for the next block.
     */
    immediate: boolean;
    /**
     * Optional. The max amount in sats that can be used as the fees. Setting this
     * value greater than the input's value may result in CPFP - one or more wallet
     * utxos will be used to pay the fees specified by the budget. If not set, for
     * new inputs, by default 50% of the input's value will be treated as the
     * budget for fee bumping; for existing inputs, their current budgets will be
     * retained.
     */
    budget: string;
    /**
     * Optional. The deadline delta in number of blocks that the output
     * should be spent within. This translates internally to the width of the
     * fee function that the sweeper will use to bump the fee rate. When the
     * deadline is reached, ALL the budget will be spent as fees.
     */
    deadlineDelta: number;
}

export interface BumpFeeResponse {
    /** The status of the bump fee operation. */
    status: string;
}

export interface BumpForceCloseFeeRequest {
    /**
     * The channel point which force close transaction we are attempting to
     * bump the fee rate for.
     */
    chanPoint: ChannelPoint | undefined;
    /**
     * Optional. The deadline delta in number of blocks that the anchor output
     * should be spent within to bump the closing transaction. When the
     * deadline is reached, ALL the budget will be spent as fees
     */
    deadlineDelta: number;
    /**
     * Optional. The starting fee rate, expressed in sat/vbyte. This value will be
     * used by the sweeper's fee function as its starting fee rate. When not set,
     * the sweeper will use the estimated fee rate using the target_conf as the
     * starting fee rate.
     */
    startingFeerate: string;
    /**
     * Optional. Whether this cpfp transaction will be triggered immediately. When
     * set to true, the sweeper will consider all currently registered sweeps and
     * trigger new batch transactions including the sweeping of the anchor output
     * related to the selected force close transaction.
     */
    immediate: boolean;
    /**
     * Optional. The max amount in sats that can be used as the fees. For already
     * registered anchor outputs if not set explicitly the old value will be used.
     * For channel force closes which have no HTLCs in their commitment transaction
     * this value has to be set to an appropriate amount to pay for the cpfp
     * transaction of the force closed channel otherwise the fee bumping will fail.
     */
    budget: string;
    /**
     * Optional. The conf target the underlying fee estimator will use to
     * estimate the starting fee rate for the fee function.
     */
    targetConf: number;
}

export interface BumpForceCloseFeeResponse {
    /** The status of the force close fee bump operation. */
    status: string;
}

export interface ListSweepsRequest {
    /**
     * Retrieve the full sweep transaction details. If false, only the sweep txids
     * will be returned. Note that some sweeps that LND publishes will have been
     * replaced-by-fee, so will not be included in this output.
     */
    verbose: boolean;
    /**
     * The start height to use when fetching sweeps. If not specified (0), the
     * result will start from the earliest sweep. If set to -1 the result will
     * only include unconfirmed sweeps (at the time of the call).
     */
    startHeight: number;
}

export interface ListSweepsResponse {
    transactionDetails: TransactionDetails | undefined;
    transactionIds: ListSweepsResponse_TransactionIDs | undefined;
}

export interface ListSweepsResponse_TransactionIDs {
    /**
     * Reversed, hex-encoded string representing the transaction ids of the
     * sweeps that our node has broadcast. Note that these transactions may
     * not have confirmed yet, we record sweeps on broadcast, not confirmation.
     */
    transactionIds: string[];
}

export interface LabelTransactionRequest {
    /**
     * The txid of the transaction to label. Note: When using gRPC, the bytes
     * must be in little-endian (reverse) order.
     */
    txid: Uint8Array | string;
    /** The label to add to the transaction, limited to 500 characters. */
    label: string;
    /** Whether to overwrite the existing label, if it is present. */
    overwrite: boolean;
}

export interface LabelTransactionResponse {
    /** The status of the label operation. */
    status: string;
}

export interface FundPsbtRequest {
    /**
     * Use an existing PSBT packet as the template for the funded PSBT.
     *
     * The packet must contain at least one non-dust output. If one or more
     * inputs are specified, no coin selection is performed. In that case every
     * input must be an UTXO known to the wallet that has not been locked
     * before. The sum of all inputs must be sufficiently greater than the sum
     * of all outputs to pay a miner fee with the specified fee rate. A change
     * output is added to the PSBT if necessary.
     */
    psbt: Uint8Array | string | undefined;
    /** Use the outputs and optional inputs from this raw template. */
    raw: TxTemplate | undefined;
    /**
     * Use an existing PSBT packet as the template for the funded PSBT.
     *
     * The difference to the pure PSBT template above is that coin selection is
     * performed even if inputs are specified. The output amounts are summed up
     * and used as the target amount for coin selection. A change output must
     * either already exist in the PSBT and be marked as such, otherwise a new
     * change output of the specified output type will be added. Any inputs
     * already specified in the PSBT must already be locked (if they belong to
     * this node), only newly added inputs will be locked by this RPC.
     *
     * In case the sum of the already provided inputs exceeds the required
     * output amount, no new coins are selected. Instead only the fee and
     * change amount calculation is performed (e.g. a change output is added if
     * requested or the change is added to the specified existing change
     * output, given there is any non-dust change). This can be identified by
     * the returned locked UTXOs being empty.
     */
    coinSelect: PsbtCoinSelect | undefined;
    /** The target number of blocks that the transaction should be confirmed in. */
    targetConf: number | undefined;
    /**
     * The fee rate, expressed in sat/vbyte, that should be used to spend the
     * input with.
     */
    satPerVbyte: string | undefined;
    /**
     * The fee rate, expressed in sat/kWU, that should be used to spend the
     * input with.
     */
    satPerKw: string | undefined;
    /**
     * The name of the account to fund the PSBT with. If empty, the default wallet
     * account is used.
     */
    account: string;
    /**
     * The minimum number of confirmations each one of your outputs used for
     * the transaction must satisfy.
     */
    minConfs: number;
    /** Whether unconfirmed outputs should be used as inputs for the transaction. */
    spendUnconfirmed: boolean;
    /**
     * The address type for the change. If empty, P2WPKH addresses will be used
     * for default accounts and single imported public keys. For custom
     * accounts, no change type should be provided as the coin selection key
     * scope will always be used to generate the change address.
     */
    changeType: ChangeAddressType;
    /** The strategy to use for selecting coins during funding the PSBT. */
    coinSelectionStrategy: CoinSelectionStrategy;
    /** The max fee to total output amount ratio that this psbt should adhere to. */
    maxFeeRatio: number;
    /**
     * The custom lock ID to use for the inputs in the funded PSBT. The value
     * if set must be exactly 32 bytes long. If empty, the default lock ID will
     * be used.
     */
    customLockId: Uint8Array | string;
    /**
     * If set, then the inputs in the funded PSBT will be locked for the
     * specified duration. The lock duration is specified in seconds. If not
     * set, the default lock duration will be used.
     */
    lockExpirationSeconds: string;
}

export interface FundPsbtResponse {
    /** The funded but not yet signed PSBT packet. */
    fundedPsbt: Uint8Array | string;
    /** The index of the added change output or -1 if no change was left over. */
    changeOutputIndex: number;
    /**
     * The list of lock leases that were acquired for the inputs in the funded PSBT
     * packet. Only inputs added to the PSBT by this RPC are locked, inputs that
     * were already present in the PSBT are not locked.
     */
    lockedUtxos: UtxoLease[];
}

export interface TxTemplate {
    /**
     * An optional list of inputs to use. Every input must be an UTXO known to the
     * wallet that has not been locked before. The sum of all inputs must be
     * sufficiently greater than the sum of all outputs to pay a miner fee with the
     * fee rate specified in the parent message.
     *
     * If no inputs are specified, coin selection will be performed instead and
     * inputs of sufficient value will be added to the resulting PSBT.
     */
    inputs: OutPoint[];
    /** A map of all addresses and the amounts to send to in the funded PSBT. */
    outputs: { [key: string]: string };
}

export interface TxTemplate_OutputsEntry {
    key: string;
    value: string;
}

export interface PsbtCoinSelect {
    /**
     * The template to use for the funded PSBT. The template must contain at least
     * one non-dust output. The amount to be funded is calculated by summing up the
     * amounts of all outputs in the template, subtracting all the input values of
     * the already specified inputs. The change value is added to the output that
     * is marked as such (or a new change output is added if none is marked). For
     * the input amount calculation to be correct, the template must have the
     * WitnessUtxo field set for all inputs. Any inputs already specified in the
     * PSBT must already be locked (if they belong to this node), only newly added
     * inputs will be locked by this RPC.
     */
    psbt: Uint8Array | string;
    /**
     * Use the existing output within the template PSBT with the specified
     * index as the change output. Any leftover change will be added to the
     * already specified amount of that output. To add a new change output to
     * the PSBT, set the "add" field below instead. The type of change output
     * added is defined by change_type in the parent message.
     */
    existingOutputIndex: number | undefined;
    /**
     * Add a new change output to the PSBT using the change_type specified in
     * the parent message.
     */
    add: boolean | undefined;
}

export interface UtxoLease {
    /** A 32 byte random ID that identifies the lease. */
    id: Uint8Array | string;
    /** The identifying outpoint of the output being leased. */
    outpoint: OutPoint | undefined;
    /** The absolute expiration of the output lease represented as a unix timestamp. */
    expiration: string;
    /** The public key script of the leased output. */
    pkScript: Uint8Array | string;
    /** The value of the leased output in satoshis. */
    value: string;
}

export interface SignPsbtRequest {
    /**
     * The PSBT that should be signed. The PSBT must contain all required inputs,
     * outputs, UTXO data and custom fields required to identify the signing key.
     */
    fundedPsbt: Uint8Array | string;
}

export interface SignPsbtResponse {
    /** The signed transaction in PSBT format. */
    signedPsbt: Uint8Array | string;
    /** The indices of signed inputs. */
    signedInputs: number[];
}

export interface FinalizePsbtRequest {
    /**
     * A PSBT that should be signed and finalized. The PSBT must contain all
     * required inputs, outputs, UTXO data and partial signatures of all other
     * signers.
     */
    fundedPsbt: Uint8Array | string;
    /**
     * The name of the account to finalize the PSBT with. If empty, the default
     * wallet account is used.
     */
    account: string;
}

export interface FinalizePsbtResponse {
    /** The fully signed and finalized transaction in PSBT format. */
    signedPsbt: Uint8Array | string;
    /** The fully signed and finalized transaction in the raw wire format. */
    rawFinalTx: Uint8Array | string;
}

export interface ListLeasesRequest {}

export interface ListLeasesResponse {
    /** The list of currently leased utxos. */
    lockedUtxos: UtxoLease[];
}

/**
 * WalletKit is a service that gives access to the core functionalities of the
 * daemon's wallet.
 */
export interface WalletKit {
    /**
     * ListUnspent returns a list of all utxos spendable by the wallet with a
     * number of confirmations between the specified minimum and maximum. By
     * default, all utxos are listed. To list only the unconfirmed utxos, set
     * the unconfirmed_only to true.
     */
    listUnspent(
        request?: DeepPartial<ListUnspentRequest>
    ): Promise<ListUnspentResponse>;
    /**
     * lncli: `wallet leaseoutput`
     * LeaseOutput locks an output to the given ID, preventing it from being
     * available for any future coin selection attempts. The absolute time of the
     * lock's expiration is returned. The expiration of the lock can be extended by
     * successive invocations of this RPC. Outputs can be unlocked before their
     * expiration through `ReleaseOutput`.
     */
    leaseOutput(
        request?: DeepPartial<LeaseOutputRequest>
    ): Promise<LeaseOutputResponse>;
    /**
     * lncli: `wallet releaseoutput`
     * ReleaseOutput unlocks an output, allowing it to be available for coin
     * selection if it remains unspent. The ID should match the one used to
     * originally lock the output.
     */
    releaseOutput(
        request?: DeepPartial<ReleaseOutputRequest>
    ): Promise<ReleaseOutputResponse>;
    /**
     * lncli: `wallet listleases`
     * ListLeases lists all currently locked utxos.
     */
    listLeases(
        request?: DeepPartial<ListLeasesRequest>
    ): Promise<ListLeasesResponse>;
    /**
     * DeriveNextKey attempts to derive the *next* key within the key family
     * (account in BIP43) specified. This method should return the next external
     * child within this branch.
     */
    deriveNextKey(request?: DeepPartial<KeyReq>): Promise<KeyDescriptor>;
    /**
     * DeriveKey attempts to derive an arbitrary key specified by the passed
     * KeyLocator.
     */
    deriveKey(request?: DeepPartial<KeyLocator>): Promise<KeyDescriptor>;
    /** NextAddr returns the next unused address within the wallet. */
    nextAddr(request?: DeepPartial<AddrRequest>): Promise<AddrResponse>;
    /**
     * lncli: `wallet gettx`
     * GetTransaction returns details for a transaction found in the wallet.
     */
    getTransaction(
        request?: DeepPartial<GetTransactionRequest>
    ): Promise<Transaction1>;
    /**
     * lncli: `wallet accounts list`
     * ListAccounts retrieves all accounts belonging to the wallet by default. A
     * name and key scope filter can be provided to filter through all of the
     * wallet accounts and return only those matching.
     */
    listAccounts(
        request?: DeepPartial<ListAccountsRequest>
    ): Promise<ListAccountsResponse>;
    /**
     * lncli: `wallet requiredreserve`
     * RequiredReserve returns the minimum amount of satoshis that should be kept
     * in the wallet in order to fee bump anchor channels if necessary. The value
     * scales with the number of public anchor channels but is capped at a maximum.
     */
    requiredReserve(
        request?: DeepPartial<RequiredReserveRequest>
    ): Promise<RequiredReserveResponse>;
    /**
     * lncli: `wallet addresses list`
     * ListAddresses retrieves all the addresses along with their balance. An
     * account name filter can be provided to filter through all of the
     * wallet accounts and return the addresses of only those matching.
     */
    listAddresses(
        request?: DeepPartial<ListAddressesRequest>
    ): Promise<ListAddressesResponse>;
    /**
     * lncli: `wallet addresses signmessage`
     * SignMessageWithAddr returns the compact signature (base64 encoded) created
     * with the private key of the provided address. This requires the address
     * to be solely based on a public key lock (no scripts). Obviously the internal
     * lnd wallet has to possess the private key of the address otherwise
     * an error is returned.
     *
     * This method aims to provide full compatibility with the bitcoin-core and
     * btcd implementation. Bitcoin-core's algorithm is not specified in a
     * BIP and only applicable for legacy addresses. This method enhances the
     * signing for additional address types: P2WKH, NP2WKH, P2TR.
     * For P2TR addresses this represents a special case. ECDSA is used to create
     * a compact signature which makes the public key of the signature recoverable.
     */
    signMessageWithAddr(
        request?: DeepPartial<SignMessageWithAddrRequest>
    ): Promise<SignMessageWithAddrResponse>;
    /**
     * lncli: `wallet addresses verifymessage`
     * VerifyMessageWithAddr returns the validity and the recovered public key of
     * the provided compact signature (base64 encoded). The verification is
     * twofold. First the validity of the signature itself is checked and then
     * it is verified that the recovered public key of the signature equals
     * the public key of the provided address. There is no dependence on the
     * private key of the address therefore also external addresses are allowed
     * to verify signatures.
     * Supported address types are P2PKH, P2WKH, NP2WKH, P2TR.
     *
     * This method is the counterpart of the related signing method
     * (SignMessageWithAddr) and aims to provide full compatibility to
     * bitcoin-core's implementation. Although bitcoin-core/btcd only provide
     * this functionality for legacy addresses this function enhances it to
     * the address types: P2PKH, P2WKH, NP2WKH, P2TR.
     *
     * The verification for P2TR addresses is a special case and requires the
     * ECDSA compact signature to compare the reovered public key to the internal
     * taproot key. The compact ECDSA signature format was used because there
     * are still no known compact signature schemes for schnorr signatures.
     */
    verifyMessageWithAddr(
        request?: DeepPartial<VerifyMessageWithAddrRequest>
    ): Promise<VerifyMessageWithAddrResponse>;
    /**
     * lncli: `wallet accounts import`
     * ImportAccount imports an account backed by an account extended public key.
     * The master key fingerprint denotes the fingerprint of the root key
     * corresponding to the account public key (also known as the key with
     * derivation path m/). This may be required by some hardware wallets for
     * proper identification and signing.
     *
     * The address type can usually be inferred from the key's version, but may be
     * required for certain keys to map them into the proper scope.
     *
     * For BIP-0044 keys, an address type must be specified as we intend to not
     * support importing BIP-0044 keys into the wallet using the legacy
     * pay-to-pubkey-hash (P2PKH) scheme. A nested witness address type will force
     * the standard BIP-0049 derivation scheme, while a witness address type will
     * force the standard BIP-0084 derivation scheme.
     *
     * For BIP-0049 keys, an address type must also be specified to make a
     * distinction between the standard BIP-0049 address schema (nested witness
     * pubkeys everywhere) and our own BIP-0049Plus address schema (nested pubkeys
     * externally, witness pubkeys internally).
     *
     * NOTE: Events (deposits/spends) for keys derived from an account will only be
     * detected by lnd if they happen after the import. Rescans to detect past
     * events will be supported later on.
     */
    importAccount(
        request?: DeepPartial<ImportAccountRequest>
    ): Promise<ImportAccountResponse>;
    /**
     * lncli: `wallet accounts import-pubkey`
     * ImportPublicKey imports a public key as watch-only into the wallet. The
     * public key is converted into a simple address of the given type and that
     * address script is watched on chain. For Taproot keys, this will only watch
     * the BIP-0086 style output script. Use ImportTapscript for more advanced key
     * spend or script spend outputs.
     *
     * NOTE: Events (deposits/spends) for a key will only be detected by lnd if
     * they happen after the import. Rescans to detect past events will be
     * supported later on.
     */
    importPublicKey(
        request?: DeepPartial<ImportPublicKeyRequest>
    ): Promise<ImportPublicKeyResponse>;
    /**
     * ImportTapscript imports a Taproot script and internal key and adds the
     * resulting Taproot output key as a watch-only output script into the wallet.
     * For BIP-0086 style Taproot keys (no root hash commitment and no script spend
     * path) use ImportPublicKey.
     *
     * NOTE: Events (deposits/spends) for a key will only be detected by lnd if
     * they happen after the import. Rescans to detect past events will be
     * supported later on.
     *
     * NOTE: Taproot keys imported through this RPC currently _cannot_ be used for
     * funding PSBTs. Only tracking the balance and UTXOs is currently supported.
     */
    importTapscript(
        request?: DeepPartial<ImportTapscriptRequest>
    ): Promise<ImportTapscriptResponse>;
    /**
     * lncli: `wallet publishtx`
     * PublishTransaction attempts to publish the passed transaction to the
     * network. Once this returns without an error, the wallet will continually
     * attempt to re-broadcast the transaction on start up, until it enters the
     * chain.
     */
    publishTransaction(
        request?: DeepPartial<Transaction>
    ): Promise<PublishResponse>;
    /**
     * lncli: `wallet removetx`
     * RemoveTransaction attempts to remove the provided transaction from the
     * internal transaction store of the wallet.
     */
    removeTransaction(
        request?: DeepPartial<GetTransactionRequest>
    ): Promise<RemoveTransactionResponse>;
    /**
     * SendOutputs is similar to the existing sendmany call in Bitcoind, and
     * allows the caller to create a transaction that sends to several outputs at
     * once. This is ideal when wanting to batch create a set of transactions.
     */
    sendOutputs(
        request?: DeepPartial<SendOutputsRequest>
    ): Promise<SendOutputsResponse>;
    /**
     * lncli: `wallet estimatefeerate`
     * EstimateFee attempts to query the internal fee estimator of the wallet to
     * determine the fee (in sat/kw) to attach to a transaction in order to
     * achieve the confirmation target.
     */
    estimateFee(
        request?: DeepPartial<EstimateFeeRequest>
    ): Promise<EstimateFeeResponse>;
    /**
     * lncli: `wallet pendingsweeps`
     * PendingSweeps returns lists of on-chain outputs that lnd is currently
     * attempting to sweep within its central batching engine. Outputs with similar
     * fee rates are batched together in order to sweep them within a single
     * transaction.
     *
     * NOTE: Some of the fields within PendingSweepsRequest are not guaranteed to
     * remain supported. This is an advanced API that depends on the internals of
     * the UtxoSweeper, so things may change.
     */
    pendingSweeps(
        request?: DeepPartial<PendingSweepsRequest>
    ): Promise<PendingSweepsResponse>;
    /**
     * lncli: `wallet bumpfee`
     * BumpFee is an endpoint that allows users to interact with lnd's sweeper
     * directly. It takes an outpoint from an unconfirmed transaction and sends it
     * to the sweeper for potential fee bumping. Depending on whether the outpoint
     * has been registered in the sweeper (an existing input, e.g., an anchor
     * output) or not (a new input, e.g., an unconfirmed wallet utxo), this will
     * either be an RBF or CPFP attempt.
     *
     * When receiving an input, lnd’s sweeper needs to understand its time
     * sensitivity to make economical fee bumps - internally a fee function is
     * created using the deadline and budget to guide the process. When the
     * deadline is approaching, the fee function will increase the fee rate and
     * perform an RBF.
     *
     * When a force close happens, all the outputs from the force closing
     * transaction will be registered in the sweeper. The sweeper will then handle
     * the creation, publish, and fee bumping of the sweeping transactions.
     * Everytime a new block comes in, unless the sweeping transaction is
     * confirmed, an RBF is attempted. To interfere with this automatic process,
     * users can use BumpFee to specify customized fee rate, budget, deadline, and
     * whether the sweep should happen immediately. It's recommended to call
     * `ListSweeps` to understand the shape of the existing sweeping transaction
     * first - depending on the number of inputs in this transaction, the RBF
     * requirements can be quite different.
     *
     * This RPC also serves useful when wanting to perform a Child-Pays-For-Parent
     * (CPFP), where the child transaction pays for its parent's fee. This can be
     * done by specifying an outpoint within the low fee transaction that is under
     * the control of the wallet.
     */
    bumpFee(request?: DeepPartial<BumpFeeRequest>): Promise<BumpFeeResponse>;
    /**
     * lncli: `wallet bumpforceclosefee`
     * BumpForceCloseFee is an endpoint that allows users to bump the fee of a
     * channel force close. This only works for channels with option_anchors.
     */
    bumpForceCloseFee(
        request?: DeepPartial<BumpForceCloseFeeRequest>
    ): Promise<BumpForceCloseFeeResponse>;
    /**
     * lncli: `wallet listsweeps`
     * ListSweeps returns a list of the sweep transactions our node has produced.
     * Note that these sweeps may not be confirmed yet, as we record sweeps on
     * broadcast, not confirmation.
     */
    listSweeps(
        request?: DeepPartial<ListSweepsRequest>
    ): Promise<ListSweepsResponse>;
    /**
     * lncli: `wallet labeltx`
     * LabelTransaction adds a label to a transaction. If the transaction already
     * has a label the call will fail unless the overwrite bool is set. This will
     * overwrite the existing transaction label. Labels must not be empty, and
     * cannot exceed 500 characters.
     */
    labelTransaction(
        request?: DeepPartial<LabelTransactionRequest>
    ): Promise<LabelTransactionResponse>;
    /**
     * lncli: `wallet psbt fund`
     * FundPsbt creates a fully populated PSBT that contains enough inputs to fund
     * the outputs specified in the template. There are three ways a user can
     * specify what we call the template (a list of inputs and outputs to use in
     * the PSBT): Either as a PSBT packet directly with no coin selection (using
     * the legacy "psbt" field), a PSBT with advanced coin selection support (using
     * the new "coin_select" field) or as a raw RPC message (using the "raw"
     * field).
     * The legacy "psbt" and "raw" modes, the following restrictions apply:
     * 1. If there are no inputs specified in the template, coin selection is
     * performed automatically.
     * 2. If the template does contain any inputs, it is assumed that full
     * coin selection happened externally and no additional inputs are added. If
     * the specified inputs aren't enough to fund the outputs with the given fee
     * rate, an error is returned.
     *
     * The new "coin_select" mode does not have these restrictions and allows the
     * user to specify a PSBT with inputs and outputs and still perform coin
     * selection on top of that.
     * For all modes this RPC requires any inputs that are specified to be locked
     * by the user (if they belong to this node in the first place).
     *
     * After either selecting or verifying the inputs, all input UTXOs are locked
     * with an internal app ID.
     *
     * NOTE: If this method returns without an error, it is the caller's
     * responsibility to either spend the locked UTXOs (by finalizing and then
     * publishing the transaction) or to unlock/release the locked UTXOs in case of
     * an error on the caller's side.
     */
    fundPsbt(request?: DeepPartial<FundPsbtRequest>): Promise<FundPsbtResponse>;
    /**
     * SignPsbt expects a partial transaction with all inputs and outputs fully
     * declared and tries to sign all unsigned inputs that have all required fields
     * (UTXO information, BIP32 derivation information, witness or sig scripts)
     * set.
     * If no error is returned, the PSBT is ready to be given to the next signer or
     * to be finalized if lnd was the last signer.
     *
     * NOTE: This RPC only signs inputs (and only those it can sign), it does not
     * perform any other tasks (such as coin selection, UTXO locking or
     * input/output/fee value validation, PSBT finalization). Any input that is
     * incomplete will be skipped.
     */
    signPsbt(request?: DeepPartial<SignPsbtRequest>): Promise<SignPsbtResponse>;
    /**
     * lncli: `wallet psbt finalize`
     * FinalizePsbt expects a partial transaction with all inputs and outputs fully
     * declared and tries to sign all inputs that belong to the wallet. Lnd must be
     * the last signer of the transaction. That means, if there are any unsigned
     * non-witness inputs or inputs without UTXO information attached or inputs
     * without witness data that do not belong to lnd's wallet, this method will
     * fail. If no error is returned, the PSBT is ready to be extracted and the
     * final TX within to be broadcast.
     *
     * NOTE: This method does NOT publish the transaction once finalized. It is the
     * caller's responsibility to either publish the transaction on success or
     * unlock/release any locked UTXOs in case of an error in this method.
     */
    finalizePsbt(
        request?: DeepPartial<FinalizePsbtRequest>
    ): Promise<FinalizePsbtResponse>;
}

type Builtin =
    | Date
    | Function
    | Uint8Array
    | string
    | number
    | boolean
    | undefined;

type DeepPartial<T> = T extends Builtin
    ? T
    : T extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T extends ReadonlyArray<infer U>
    ? ReadonlyArray<DeepPartial<U>>
    : T extends {}
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : Partial<T>;
