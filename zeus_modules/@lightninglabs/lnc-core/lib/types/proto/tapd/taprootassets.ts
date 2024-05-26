/* eslint-disable */

export enum AssetType {
    /**
     * NORMAL - Indicates that an asset is capable of being split/merged, with each of the
     * units being fungible, even across a key asset ID boundary (assuming the
     * key group is the same).
     */
    NORMAL = 'NORMAL',
    /**
     * COLLECTIBLE - Indicates that an asset is a collectible, meaning that each of the other
     * items under the same key group are not fully fungible with each other.
     * Collectibles also cannot be split or merged.
     */
    COLLECTIBLE = 'COLLECTIBLE',
    UNRECOGNIZED = 'UNRECOGNIZED'
}

export enum AssetMetaType {
    /**
     * META_TYPE_OPAQUE - Opaque is used for asset meta blobs that have no true structure and instead
     * should be interpreted as opaque blobs.
     */
    META_TYPE_OPAQUE = 'META_TYPE_OPAQUE',
    UNRECOGNIZED = 'UNRECOGNIZED'
}

export enum AssetVersion {
    /**
     * ASSET_VERSION_V0 - ASSET_VERSION_V0 is the default asset version. This version will include
     * the witness vector in the leaf for a tap commitment.
     */
    ASSET_VERSION_V0 = 'ASSET_VERSION_V0',
    /**
     * ASSET_VERSION_V1 - ASSET_VERSION_V1 is the asset version that leaves out the witness vector
     * from the MS-SMT leaf encoding.
     */
    ASSET_VERSION_V1 = 'ASSET_VERSION_V1',
    UNRECOGNIZED = 'UNRECOGNIZED'
}

export enum OutputType {
    /**
     * OUTPUT_TYPE_SIMPLE - OUTPUT_TYPE_SIMPLE is a plain full-value or split output that is not a
     * split root and does not carry passive assets. In case of a split, the
     * asset of this output has a split commitment.
     */
    OUTPUT_TYPE_SIMPLE = 'OUTPUT_TYPE_SIMPLE',
    /**
     * OUTPUT_TYPE_SPLIT_ROOT - OUTPUT_TYPE_SPLIT_ROOT is a split root output that carries the change
     * from a split or a tombstone from a non-interactive full value send
     * output. In either case, the asset of this output has a tx witness.
     */
    OUTPUT_TYPE_SPLIT_ROOT = 'OUTPUT_TYPE_SPLIT_ROOT',
    /**
     * OUTPUT_TYPE_PASSIVE_ASSETS_ONLY - OUTPUT_TYPE_PASSIVE_ASSETS_ONLY indicates that this output only carries
     * passive assets and therefore the asset in this output is nil. The passive
     * assets themselves are signed in their own virtual transactions and
     * are not present in this packet.
     */
    OUTPUT_TYPE_PASSIVE_ASSETS_ONLY = 'OUTPUT_TYPE_PASSIVE_ASSETS_ONLY',
    /**
     * OUTPUT_TYPE_PASSIVE_SPLIT_ROOT - OUTPUT_TYPE_PASSIVE_SPLIT_ROOT is a split root output that carries the
     * change from a split or a tombstone from a non-interactive full value send
     * output, as well as passive assets.
     */
    OUTPUT_TYPE_PASSIVE_SPLIT_ROOT = 'OUTPUT_TYPE_PASSIVE_SPLIT_ROOT',
    /**
     * OUTPUT_TYPE_SIMPLE_PASSIVE_ASSETS - OUTPUT_TYPE_SIMPLE_PASSIVE_ASSETS is a plain full-value interactive send
     * output that also carries passive assets. This is a special case where we
     * send the full value of a single asset in a commitment to a new script
     * key, but also carry passive assets in the same output. This is useful for
     * key rotation (send-to-self) scenarios or asset burns where we burn the
     * full supply of a single asset within a commitment.
     */
    OUTPUT_TYPE_SIMPLE_PASSIVE_ASSETS = 'OUTPUT_TYPE_SIMPLE_PASSIVE_ASSETS',
    UNRECOGNIZED = 'UNRECOGNIZED'
}

export enum AddrEventStatus {
    ADDR_EVENT_STATUS_UNKNOWN = 'ADDR_EVENT_STATUS_UNKNOWN',
    ADDR_EVENT_STATUS_TRANSACTION_DETECTED = 'ADDR_EVENT_STATUS_TRANSACTION_DETECTED',
    ADDR_EVENT_STATUS_TRANSACTION_CONFIRMED = 'ADDR_EVENT_STATUS_TRANSACTION_CONFIRMED',
    ADDR_EVENT_STATUS_PROOF_RECEIVED = 'ADDR_EVENT_STATUS_PROOF_RECEIVED',
    ADDR_EVENT_STATUS_COMPLETED = 'ADDR_EVENT_STATUS_COMPLETED',
    UNRECOGNIZED = 'UNRECOGNIZED'
}

/**
 * ProofTransferType is the type of proof transfer attempt. The transfer is
 * either a proof delivery to the transfer counterparty or receiving a proof
 * from the transfer counterparty. Note that the transfer counterparty is
 * usually the proof courier service.
 */
export enum ProofTransferType {
    /**
     * PROOF_TRANSFER_TYPE_SEND - This value indicates that the proof transfer attempt is a delivery to the
     * transfer counterparty.
     */
    PROOF_TRANSFER_TYPE_SEND = 'PROOF_TRANSFER_TYPE_SEND',
    /**
     * PROOF_TRANSFER_TYPE_RECEIVE - This value indicates that the proof transfer attempt is a receive from
     * the transfer counterparty.
     */
    PROOF_TRANSFER_TYPE_RECEIVE = 'PROOF_TRANSFER_TYPE_RECEIVE',
    UNRECOGNIZED = 'UNRECOGNIZED'
}

export interface AssetMeta {
    /**
     * The raw data of the asset meta data. Based on the type below, this may be
     * structured data such as a text file or PDF. The size of the data is limited
     * to 1MiB.
     */
    data: Uint8Array | string;
    /** The type of the asset meta data. */
    type: AssetMetaType;
    /**
     * The hash of the meta. This is the hash of the TLV serialization of the meta
     * itself.
     */
    metaHash: Uint8Array | string;
}

export interface ListAssetRequest {
    withWitness: boolean;
    includeSpent: boolean;
    includeLeased: boolean;
}

export interface AnchorInfo {
    /**
     * The transaction that anchors the Taproot Asset commitment where the asset
     *  resides.
     */
    anchorTx: Uint8Array | string;
    /** The block hash the contains the anchor transaction above. */
    anchorBlockHash: string;
    /** The outpoint (txid:vout) that stores the Taproot Asset commitment. */
    anchorOutpoint: string;
    /** The raw internal key that was used to create the anchor Taproot output key. */
    internalKey: Uint8Array | string;
    /**
     * The Taproot merkle root hash of the anchor output the asset was committed
     * to. If there is no Tapscript sibling, this is equal to the Taproot Asset
     * root commitment hash.
     */
    merkleRoot: Uint8Array | string;
    /**
     * The serialized preimage of a Tapscript sibling, if there was one. If this
     * is empty, then the merkle_root hash is equal to the Taproot root hash of the
     * anchor output.
     */
    tapscriptSibling: Uint8Array | string;
    /** The height of the block which contains the anchor transaction. */
    blockHeight: number;
}

export interface GenesisInfo {
    /** The first outpoint of the transaction that created the asset (txid:vout). */
    genesisPoint: string;
    /** The name of the asset. */
    name: string;
    /** The hash of the meta data for this genesis asset. */
    metaHash: Uint8Array | string;
    /** The asset ID that uniquely identifies the asset. */
    assetId: Uint8Array | string;
    /** The type of the asset. */
    assetType: AssetType;
    /**
     * The index of the output that carries the unique Taproot Asset commitment in
     * the genesis transaction.
     */
    outputIndex: number;
    /** The version of the Taproot Asset commitment that created this asset. */
    version: number;
}

export interface AssetGroup {
    /** The raw group key which is a normal public key. */
    rawGroupKey: Uint8Array | string;
    /**
     * The tweaked group key, which is derived based on the genesis point and also
     * asset type.
     */
    tweakedGroupKey: Uint8Array | string;
    /**
     * A witness that authorizes a specific asset to be part of the asset group
     * specified by the above key.
     */
    assetWitness: Uint8Array | string;
}

export interface GroupKeyReveal {
    /** The raw group key which is a normal public key. */
    rawGroupKey: Uint8Array | string;
    /** The tapscript root included in the tweaked group key, which may be empty. */
    tapscriptRoot: Uint8Array | string;
}

export interface GenesisReveal {
    /** The base genesis information in the genesis reveal. */
    genesisBaseReveal: GenesisInfo | undefined;
}

export interface Asset {
    /** The version of the Taproot Asset. */
    version: AssetVersion;
    /** The base genesis information of an asset. This information never changes. */
    assetGenesis: GenesisInfo | undefined;
    /** The total amount of the asset stored in this Taproot Asset UTXO. */
    amount: string;
    /** An optional locktime, as with Bitcoin transactions. */
    lockTime: number;
    /** An optional relative lock time, same as Bitcoin transactions. */
    relativeLockTime: number;
    /** The version of the script, only version 0 is defined at present. */
    scriptVersion: number;
    /** The script key of the asset, which can be spent under Taproot semantics. */
    scriptKey: Uint8Array | string;
    /**
     * Indicates whether the script key is known to the wallet of the lnd node
     * connected to the Taproot Asset daemon.
     */
    scriptKeyIsLocal: boolean;
    /** The information related to the key group of an asset (if it exists). */
    assetGroup: AssetGroup | undefined;
    /** Describes where in the chain the asset is currently anchored. */
    chainAnchor: AnchorInfo | undefined;
    prevWitnesses: PrevWitness[];
    /** Indicates whether the asset has been spent. */
    isSpent: boolean;
    /**
     * If the asset has been leased, this is the owner (application ID) of the
     * lease.
     */
    leaseOwner: Uint8Array | string;
    /**
     * If the asset has been leased, this is the expiry of the lease as a Unix
     * timestamp in seconds.
     */
    leaseExpiry: string;
    /**
     * Indicates whether this transfer was an asset burn. If true, the number of
     * assets in this output are destroyed and can no longer be spent.
     */
    isBurn: boolean;
}

export interface PrevWitness {
    prevId: PrevInputAsset | undefined;
    txWitness: Uint8Array | string[];
    splitCommitment: SplitCommitment | undefined;
}

export interface SplitCommitment {
    rootAsset: Asset | undefined;
}

export interface ListAssetResponse {
    assets: Asset[];
}

export interface ListUtxosRequest {
    includeLeased: boolean;
}

export interface ManagedUtxo {
    /** The outpoint of the UTXO. */
    outPoint: string;
    /** The UTXO amount in satoshis. */
    amtSat: string;
    /** The internal key used for the on-chain output. */
    internalKey: Uint8Array | string;
    /** The Taproot Asset root commitment hash. */
    taprootAssetRoot: Uint8Array | string;
    /**
     * The Taproot merkle root hash committed to by the outpoint of this UTXO.
     * If there is no Tapscript sibling, this is equal to the Taproot Asset root
     * commitment hash.
     */
    merkleRoot: Uint8Array | string;
    /** The assets held at this UTXO. */
    assets: Asset[];
}

export interface ListUtxosResponse {
    /** The set of UTXOs managed by the daemon. */
    managedUtxos: { [key: string]: ManagedUtxo };
}

export interface ListUtxosResponse_ManagedUtxosEntry {
    key: string;
    value: ManagedUtxo | undefined;
}

export interface ListGroupsRequest {}

export interface AssetHumanReadable {
    /** The ID of the asset. */
    id: Uint8Array | string;
    /** The amount of the asset. */
    amount: string;
    /** An optional locktime, as with Bitcoin transactions. */
    lockTime: number;
    /** An optional relative locktime, as with Bitcoin transactions. */
    relativeLockTime: number;
    /** The name of the asset. */
    tag: string;
    /** The metadata hash of the asset. */
    metaHash: Uint8Array | string;
    /** The type of the asset. */
    type: AssetType;
    /** The version of the asset. */
    version: AssetVersion;
}

export interface GroupedAssets {
    /** A list of assets with the same group key. */
    assets: AssetHumanReadable[];
}

export interface ListGroupsResponse {
    /** The set of assets with a group key. */
    groups: { [key: string]: GroupedAssets };
}

export interface ListGroupsResponse_GroupsEntry {
    key: string;
    value: GroupedAssets | undefined;
}

export interface ListBalancesRequest {
    /** Group results by asset IDs. */
    assetId: boolean | undefined;
    /** Group results by group keys. */
    groupKey: boolean | undefined;
    /**
     * If the query results should grouped by asset ids, then an optional asset
     * filter may be provided to query balance of a specific asset.
     */
    assetFilter: Uint8Array | string;
    /**
     * If the query results should be grouped by group keys, then an optional
     * group key filter may be provided to query the balance of a specific
     * asset group.
     */
    groupKeyFilter: Uint8Array | string;
}

export interface AssetBalance {
    /** The base genesis information of an asset. This information never changes. */
    assetGenesis: GenesisInfo | undefined;
    /** The balance of the asset owned by the target daemon. */
    balance: string;
}

export interface AssetGroupBalance {
    /** The group key or nil aggregating assets that don't have a group. */
    groupKey: Uint8Array | string;
    /** The total balance of the assets in the group. */
    balance: string;
}

export interface ListBalancesResponse {
    assetBalances: { [key: string]: AssetBalance };
    assetGroupBalances: { [key: string]: AssetGroupBalance };
}

export interface ListBalancesResponse_AssetBalancesEntry {
    key: string;
    value: AssetBalance | undefined;
}

export interface ListBalancesResponse_AssetGroupBalancesEntry {
    key: string;
    value: AssetGroupBalance | undefined;
}

export interface ListTransfersRequest {}

export interface ListTransfersResponse {
    /** The unordered list of outgoing asset transfers. */
    transfers: AssetTransfer[];
}

export interface AssetTransfer {
    transferTimestamp: string;
    /**
     * The new transaction that commits to the set of Taproot Assets found
     * at the above new anchor point.
     */
    anchorTxHash: Uint8Array | string;
    anchorTxHeightHint: number;
    anchorTxChainFees: string;
    /** Describes the set of spent assets. */
    inputs: TransferInput[];
    /** Describes the set of newly created asset outputs. */
    outputs: TransferOutput[];
}

export interface TransferInput {
    /**
     * The old/current location of the Taproot Asset commitment that was spent
     * as an input.
     */
    anchorPoint: string;
    /** The ID of the asset that was spent. */
    assetId: Uint8Array | string;
    /** The script key of the asset that was spent. */
    scriptKey: Uint8Array | string;
    /** The amount of the asset that was spent. */
    amount: string;
}

export interface TransferOutputAnchor {
    /**
     * The new location of the Taproot Asset commitment that was created on
     * chain.
     */
    outpoint: string;
    value: string;
    internalKey: Uint8Array | string;
    taprootAssetRoot: Uint8Array | string;
    merkleRoot: Uint8Array | string;
    tapscriptSibling: Uint8Array | string;
    numPassiveAssets: number;
}

export interface TransferOutput {
    anchor: TransferOutputAnchor | undefined;
    scriptKey: Uint8Array | string;
    scriptKeyIsLocal: boolean;
    amount: string;
    /**
     * The new individual transition proof (not a full proof file) that proves
     * the inclusion of the new asset within the new AnchorTx.
     */
    newProofBlob: Uint8Array | string;
    splitCommitRootHash: Uint8Array | string;
    outputType: OutputType;
    assetVersion: AssetVersion;
}

export interface StopRequest {}

export interface StopResponse {}

export interface DebugLevelRequest {
    /** If true, all the valid debug sub-systems will be returned. */
    show: boolean;
    levelSpec: string;
}

export interface DebugLevelResponse {
    subSystems: string;
}

export interface Addr {
    /** The bech32 encoded Taproot Asset address. */
    encoded: string;
    /** The asset ID that uniquely identifies the asset. */
    assetId: Uint8Array | string;
    /** The type of the asset. */
    assetType: AssetType;
    /** The total amount of the asset stored in this Taproot Asset UTXO. */
    amount: string;
    /** The group key of the asset (if it exists) */
    groupKey: Uint8Array | string;
    /**
     * The specific script key the asset must commit to in order to transfer
     * ownership to the creator of the address.
     */
    scriptKey: Uint8Array | string;
    /** The internal key used for the on-chain output. */
    internalKey: Uint8Array | string;
    /**
     * The optional serialized tapscript sibling preimage to use for the receiving
     * asset. This is usually empty as it is only needed when there should be an
     * additional script path in the Taproot tree alongside the Taproot Asset
     * commitment of the asset.
     */
    tapscriptSibling: Uint8Array | string;
    /**
     * The tweaked internal key that commits to the asset and represents the
     * on-chain output key the Bitcoin transaction must send to in order to
     * transfer assets described in this address.
     */
    taprootOutputKey: Uint8Array | string;
    /** The address of the proof courier service used in proof transfer. */
    proofCourierAddr: string;
    /** The asset version of the address. */
    assetVersion: AssetVersion;
}

export interface QueryAddrRequest {
    /**
     * If set, then only addresses created after this Unix timestamp will be
     * returned.
     */
    createdAfter: string;
    /**
     * If set, then only addresses created before this Unix timestamp will be
     * returned.
     */
    createdBefore: string;
    /** The max number of addresses that should be returned. */
    limit: number;
    /** The offset from the addresses that should be returned. */
    offset: number;
}

export interface QueryAddrResponse {
    addrs: Addr[];
}

export interface NewAddrRequest {
    assetId: Uint8Array | string;
    amt: string;
    /**
     * The optional script key that the receiving asset should be locked to. If no
     * script key is provided, a normal BIP-86 key will be derived from the
     * underlying wallet.
     *
     * NOTE: The script_key and internal_key fields should either both be set or
     * both be empty.
     */
    scriptKey: ScriptKey | undefined;
    /**
     * The optional internal key of the receiving BTC level transaction output on
     * which the receiving asset transfers will be committed to. If no internal key
     * is provided, a key will be derived from the underlying wallet.
     *
     * NOTE: The script_key and internal_key fields should either both be set or
     * both be empty.
     */
    internalKey: KeyDescriptor | undefined;
    /**
     * The optional serialized tapscript sibling preimage to use for the receiving
     * asset. This is usually empty as it is only needed when there should be an
     * additional script path in the Taproot tree alongside the Taproot Asset
     * commitment of the asset.
     */
    tapscriptSibling: Uint8Array | string;
    /**
     * An optional proof courier address for use in proof transfer. If unspecified,
     * the daemon configured default address will be used.
     */
    proofCourierAddr: string;
    /** The asset version to use when sending/receiving to/from this address. */
    assetVersion: AssetVersion;
}

export interface ScriptKey {
    /**
     * The full Taproot output key the asset is locked to. This is either a BIP-86
     * key if the tap_tweak below is empty, or a key with the tap tweak applied to
     * it.
     */
    pubKey: Uint8Array | string;
    /** The key descriptor describing the internal key of the above Taproot key. */
    keyDesc: KeyDescriptor | undefined;
    /**
     * The optional Taproot tweak to apply to the above internal key. If this is
     * empty then a BIP-86 style tweak is applied to the internal key.
     */
    tapTweak: Uint8Array | string;
}

export interface KeyLocator {
    /** The family of key being identified. */
    keyFamily: number;
    /** The precise index of the key being identified. */
    keyIndex: number;
}

export interface KeyDescriptor {
    /** The raw bytes of the key being identified. */
    rawKeyBytes: Uint8Array | string;
    /** The key locator that identifies which key to use for signing. */
    keyLoc: KeyLocator | undefined;
}

export interface DecodeAddrRequest {
    addr: string;
}

export interface ProofFile {
    /**
     * The raw proof file encoded as bytes. Must be a file and not just an
     * individual mint/transfer proof.
     */
    rawProofFile: Uint8Array | string;
    genesisPoint: string;
}

export interface DecodedProof {
    /** The index depth of the decoded proof, with 0 being the latest proof. */
    proofAtDepth: number;
    /**
     * The total number of proofs contained in the decoded proof file (this will
     * always be 1 if a single mint/transition proof was given as the raw_proof
     * instead of a file).
     */
    numberOfProofs: number;
    /** The asset referenced in the proof. */
    asset: Asset | undefined;
    /** The reveal meta data associated with the proof, if available. */
    metaReveal: AssetMeta | undefined;
    /**
     * The merkle proof for AnchorTx used to prove its
     * inclusion within BlockHeader.
     */
    txMerkleProof: Uint8Array | string;
    /**
     * The TaprootProof proving the new inclusion of the
     * resulting asset within AnchorTx.
     */
    inclusionProof: Uint8Array | string;
    /**
     * The set of TaprootProofs proving the exclusion of
     * the resulting asset from all other Taproot outputs within AnchorTx.
     */
    exclusionProofs: Uint8Array | string[];
    /**
     * An optional TaprootProof needed if this asset is
     * the result of a split. SplitRootProof proves inclusion of the root
     * asset of the split.
     */
    splitRootProof: Uint8Array | string;
    /**
     * The number of additional nested full proofs for any inputs found within
     * the resulting asset.
     */
    numAdditionalInputs: number;
    /**
     * ChallengeWitness is an optional virtual transaction witness that serves
     * as an ownership proof for the asset. If this is non-nil, then it is a
     * valid transfer witness for a 1-input, 1-output virtual transaction that
     * spends the asset in this proof and sends it to the NUMS key, to prove
     * that the creator of the proof is able to produce a valid signature to
     * spend the asset.
     */
    challengeWitness: Uint8Array | string[];
    /**
     * Indicates whether the state transition this proof represents is a burn,
     * meaning that the assets were provably destroyed and can no longer be
     * spent.
     */
    isBurn: boolean;
    /**
     * GenesisReveal is an optional field that is the Genesis information for
     * the asset. This is required for minting proofs.
     */
    genesisReveal: GenesisReveal | undefined;
    /**
     * GroupKeyReveal is an optional field that includes the information needed
     * to derive the tweaked group key.
     */
    groupKeyReveal: GroupKeyReveal | undefined;
}

export interface VerifyProofResponse {
    valid: boolean;
    /** The decoded last proof in the file if the proof file was valid. */
    decodedProof: DecodedProof | undefined;
}

export interface DecodeProofRequest {
    /**
     * The raw proof bytes to decode. This can be a full proof file or a single
     * mint/transition proof. If it is a full proof file, the proof_at_depth
     * field will be used to determine which individual proof within the file to
     * decode.
     */
    rawProof: Uint8Array | string;
    /**
     * The index depth of the decoded proof, with 0 being the latest proof. This
     * is ignored if the raw_proof is a single mint/transition proof and not a
     * proof file.
     */
    proofAtDepth: number;
    /** An option to include previous witnesses in decoding. */
    withPrevWitnesses: boolean;
    /** An option to attempt to retrieve the meta data associated with the proof. */
    withMetaReveal: boolean;
}

export interface DecodeProofResponse {
    decodedProof: DecodedProof | undefined;
}

export interface ExportProofRequest {
    assetId: Uint8Array | string;
    scriptKey: Uint8Array | string;
    outpoint: OutPoint | undefined;
}

export interface AddrEvent {
    /** The time the event was created in unix timestamp seconds. */
    creationTimeUnixSeconds: string;
    /** The address the event was created for. */
    addr: Addr | undefined;
    /** The current status of the event. */
    status: AddrEventStatus;
    /** The outpoint that contains the inbound asset transfer. */
    outpoint: string;
    /**
     * The amount in satoshis that were transferred on chain along with the asset.
     * This amount is independent of the requested asset amount, which can be
     * looked up on the address.
     */
    utxoAmtSat: string;
    /** The taproot sibling hash that was used to send to the Taproot output. */
    taprootSibling: Uint8Array | string;
    /**
     * The height at which the on-chain output was confirmed. If this is zero, it
     * means the output is unconfirmed.
     */
    confirmationHeight: number;
    /**
     * Indicates whether a proof file can be found for the address' asset ID and
     * script key.
     */
    hasProof: boolean;
}

export interface AddrReceivesRequest {
    /** Filter receives by a specific address. Leave empty to get all receives. */
    filterAddr: string;
    /** Filter receives by a specific status. Leave empty to get all receives. */
    filterStatus: AddrEventStatus;
}

export interface AddrReceivesResponse {
    /** The events that match the filter criteria. */
    events: AddrEvent[];
}

export interface SendAssetRequest {
    tapAddrs: string[];
    /** The optional fee rate to use for the minting transaction, in sat/kw. */
    feeRate: number;
}

export interface PrevInputAsset {
    anchorPoint: string;
    assetId: Uint8Array | string;
    scriptKey: Uint8Array | string;
    amount: string;
}

export interface SendAssetResponse {
    transfer: AssetTransfer | undefined;
}

export interface GetInfoRequest {}

export interface GetInfoResponse {
    version: string;
    lndVersion: string;
    network: string;
    lndIdentityPubkey: string;
    nodeAlias: string;
    blockHeight: number;
    blockHash: string;
    syncToChain: boolean;
}

export interface SubscribeSendAssetEventNtfnsRequest {}

export interface SendAssetEvent {
    /** An event which indicates that a send state is about to be executed. */
    executeSendStateEvent: ExecuteSendStateEvent | undefined;
    /**
     * An event which indicates that the proof transfer backoff wait period
     * will start imminently.
     */
    proofTransferBackoffWaitEvent: ProofTransferBackoffWaitEvent | undefined;
}

export interface ExecuteSendStateEvent {
    /** Execute timestamp (microseconds). */
    timestamp: string;
    /** The send state that is about to be executed. */
    sendState: string;
}

export interface ProofTransferBackoffWaitEvent {
    /** Transfer attempt timestamp (microseconds). */
    timestamp: string;
    /** Backoff is the active backoff wait duration. */
    backoff: string;
    /**
     * Tries counter is the number of tries we've made so far during the
     * course of the current backoff procedure to deliver the proof to the
     * receiver.
     */
    triesCounter: string;
    /** The type of proof transfer attempt. */
    transferType: ProofTransferType;
}

export interface SubscribeReceiveAssetEventNtfnsRequest {}

export interface AssetReceiveCompleteEvent {
    /** Event creation timestamp. */
    timestamp: string;
    /** The address that received the asset. */
    address: Addr | undefined;
    /** The outpoint of the transaction that was used to receive the asset. */
    outpoint: string;
}

export interface ReceiveAssetEvent {
    /**
     * An event which indicates that the proof transfer backoff wait period
     * will start imminently.
     */
    proofTransferBackoffWaitEvent: ProofTransferBackoffWaitEvent | undefined;
    /** An event which indicates that an asset receive process has finished. */
    assetReceiveCompleteEvent: AssetReceiveCompleteEvent | undefined;
}

export interface FetchAssetMetaRequest {
    /** The asset ID of the asset to fetch the meta for. */
    assetId: Uint8Array | string | undefined;
    /** The 32-byte meta hash of the asset meta. */
    metaHash: Uint8Array | string | undefined;
    /** The hex encoded asset ID of the asset to fetch the meta for. */
    assetIdStr: string | undefined;
    /** The hex encoded meta hash of the asset meta. */
    metaHashStr: string | undefined;
}

export interface BurnAssetRequest {
    /** The asset ID of the asset to burn units of. */
    assetId: Uint8Array | string | undefined;
    /** The hex encoded asset ID of the asset to burn units of. */
    assetIdStr: string | undefined;
    amountToBurn: string;
    /**
     * A safety check to ensure the user is aware of the destructive nature of
     * the burn. This needs to be set to the value "assets will be destroyed"
     * for the burn to succeed.
     */
    confirmationText: string;
}

export interface BurnAssetResponse {
    /** The asset transfer that contains the asset burn as an output. */
    burnTransfer: AssetTransfer | undefined;
    /** The burn transition proof for the asset burn output. */
    burnProof: DecodedProof | undefined;
}

export interface OutPoint {
    /** Raw bytes representing the transaction id. */
    txid: Uint8Array | string;
    /** The index of the output on the transaction. */
    outputIndex: number;
}

export interface TaprootAssets {
    /**
     * tapcli: `assets list`
     * ListAssets lists the set of assets owned by the target daemon.
     */
    listAssets(
        request?: DeepPartial<ListAssetRequest>
    ): Promise<ListAssetResponse>;
    /**
     * tapcli: `assets utxos`
     * ListUtxos lists the UTXOs managed by the target daemon, and the assets they
     * hold.
     */
    listUtxos(
        request?: DeepPartial<ListUtxosRequest>
    ): Promise<ListUtxosResponse>;
    /**
     * tapcli: `assets groups`
     * ListGroups lists the asset groups known to the target daemon, and the assets
     * held in each group.
     */
    listGroups(
        request?: DeepPartial<ListGroupsRequest>
    ): Promise<ListGroupsResponse>;
    /**
     * tapcli: `assets balance`
     * ListBalances lists asset balances
     */
    listBalances(
        request?: DeepPartial<ListBalancesRequest>
    ): Promise<ListBalancesResponse>;
    /**
     * tapcli: `assets transfers`
     * ListTransfers lists outbound asset transfers tracked by the target daemon.
     */
    listTransfers(
        request?: DeepPartial<ListTransfersRequest>
    ): Promise<ListTransfersResponse>;
    /**
     * tapcli: `stop`
     * StopDaemon will send a shutdown request to the interrupt handler, triggering
     * a graceful shutdown of the daemon.
     */
    stopDaemon(request?: DeepPartial<StopRequest>): Promise<StopResponse>;
    /**
     * tapcli: `debuglevel`
     * DebugLevel allows a caller to programmatically set the logging verbosity of
     * tapd. The logging can be targeted according to a coarse daemon-wide logging
     * level, or in a granular fashion to specify the logging for a target
     * sub-system.
     */
    debugLevel(
        request?: DeepPartial<DebugLevelRequest>
    ): Promise<DebugLevelResponse>;
    /**
     * tapcli: `addrs query`
     * QueryAddrs queries the set of Taproot Asset addresses stored in the
     * database.
     */
    queryAddrs(
        request?: DeepPartial<QueryAddrRequest>
    ): Promise<QueryAddrResponse>;
    /**
     * tapcli: `addrs new`
     * NewAddr makes a new address from the set of request params.
     */
    newAddr(request?: DeepPartial<NewAddrRequest>): Promise<Addr>;
    /**
     * tapcli: `addrs decode`
     * DecodeAddr decode a Taproot Asset address into a partial asset message that
     * represents the asset it wants to receive.
     */
    decodeAddr(request?: DeepPartial<DecodeAddrRequest>): Promise<Addr>;
    /**
     * tapcli: `addrs receives`
     * List all receives for incoming asset transfers for addresses that were
     * created previously.
     */
    addrReceives(
        request?: DeepPartial<AddrReceivesRequest>
    ): Promise<AddrReceivesResponse>;
    /**
     * tapcli: `proofs verify`
     * VerifyProof attempts to verify a given proof file that claims to be anchored
     * at the specified genesis point.
     */
    verifyProof(request?: DeepPartial<ProofFile>): Promise<VerifyProofResponse>;
    /**
     * tapcli: `proofs decode`
     * DecodeProof attempts to decode a given proof file into human readable
     * format.
     */
    decodeProof(
        request?: DeepPartial<DecodeProofRequest>
    ): Promise<DecodeProofResponse>;
    /**
     * tapcli: `proofs export`
     * ExportProof exports the latest raw proof file anchored at the specified
     * script_key.
     */
    exportProof(request?: DeepPartial<ExportProofRequest>): Promise<ProofFile>;
    /**
     * tapcli: `assets send`
     * SendAsset uses one or multiple passed Taproot Asset address(es) to attempt
     * to complete an asset send. The method returns information w.r.t the on chain
     * send, as well as the proof file information the receiver needs to fully
     * receive the asset.
     */
    sendAsset(
        request?: DeepPartial<SendAssetRequest>
    ): Promise<SendAssetResponse>;
    /**
     * tapcli: `assets burn`
     * BurnAsset burns the given number of units of a given asset by sending them
     * to a provably un-spendable script key. Burning means irrevocably destroying
     * a certain number of assets, reducing the total supply of the asset. Because
     * burning is such a destructive and non-reversible operation, some specific
     * values need to be set in the request to avoid accidental burns.
     */
    burnAsset(
        request?: DeepPartial<BurnAssetRequest>
    ): Promise<BurnAssetResponse>;
    /**
     * tapcli: `getinfo`
     * GetInfo returns the information for the node.
     */
    getInfo(request?: DeepPartial<GetInfoRequest>): Promise<GetInfoResponse>;
    /**
     * SubscribeSendAssetEventNtfns registers a subscription to the event
     * notification stream which relates to the asset sending process.
     */
    subscribeSendAssetEventNtfns(
        request?: DeepPartial<SubscribeSendAssetEventNtfnsRequest>,
        onMessage?: (msg: SendAssetEvent) => void,
        onError?: (err: Error) => void
    ): void;
    /**
     * SubscribeReceiveAssetEventNtfns registers a subscription to the event
     * notification stream which relates to the asset receive process.
     */
    subscribeReceiveAssetEventNtfns(
        request?: DeepPartial<SubscribeReceiveAssetEventNtfnsRequest>,
        onMessage?: (msg: ReceiveAssetEvent) => void,
        onError?: (err: Error) => void
    ): void;
    /**
     * tapcli: `assets meta`
     * FetchAssetMeta allows a caller to fetch the reveal meta data for an asset
     * either by the asset ID for that asset, or a meta hash.
     */
    fetchAssetMeta(
        request?: DeepPartial<FetchAssetMetaRequest>
    ): Promise<AssetMeta>;
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
