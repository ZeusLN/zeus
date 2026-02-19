"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParcelType = exports.SendState = exports.AddrEventStatus = exports.ScriptKeyType = exports.AddrVersion = exports.ProofDeliveryStatus = exports.OutputType = exports.AssetVersion = exports.AssetMetaType = exports.AssetType = void 0;
var AssetType;
(function (AssetType) {
    /**
     * NORMAL - Indicates that an asset is capable of being split/merged, with each of the
     * units being fungible, even across a key asset ID boundary (assuming the
     * key group is the same).
     */
    AssetType["NORMAL"] = "NORMAL";
    /**
     * COLLECTIBLE - Indicates that an asset is a collectible, meaning that each of the other
     * items under the same key group are not fully fungible with each other.
     * Collectibles also cannot be split or merged.
     */
    AssetType["COLLECTIBLE"] = "COLLECTIBLE";
    AssetType["UNRECOGNIZED"] = "UNRECOGNIZED";
})(AssetType = exports.AssetType || (exports.AssetType = {}));
var AssetMetaType;
(function (AssetMetaType) {
    /**
     * META_TYPE_OPAQUE - Opaque is used for asset meta blobs that have no true structure and instead
     * should be interpreted as opaque blobs.
     */
    AssetMetaType["META_TYPE_OPAQUE"] = "META_TYPE_OPAQUE";
    /**
     * META_TYPE_JSON - JSON is used for asset meta blobs that are to be interpreted as valid JSON
     * strings.
     */
    AssetMetaType["META_TYPE_JSON"] = "META_TYPE_JSON";
    AssetMetaType["UNRECOGNIZED"] = "UNRECOGNIZED";
})(AssetMetaType = exports.AssetMetaType || (exports.AssetMetaType = {}));
var AssetVersion;
(function (AssetVersion) {
    /**
     * ASSET_VERSION_V0 - ASSET_VERSION_V0 is the default asset version. This version will include
     * the witness vector in the leaf for a tap commitment.
     */
    AssetVersion["ASSET_VERSION_V0"] = "ASSET_VERSION_V0";
    /**
     * ASSET_VERSION_V1 - ASSET_VERSION_V1 is the asset version that leaves out the witness vector
     * from the MS-SMT leaf encoding.
     */
    AssetVersion["ASSET_VERSION_V1"] = "ASSET_VERSION_V1";
    AssetVersion["UNRECOGNIZED"] = "UNRECOGNIZED";
})(AssetVersion = exports.AssetVersion || (exports.AssetVersion = {}));
var OutputType;
(function (OutputType) {
    /**
     * OUTPUT_TYPE_SIMPLE - OUTPUT_TYPE_SIMPLE is a plain full-value or split output that is not a
     * split root and does not carry passive assets. In case of a split, the
     * asset of this output has a split commitment.
     */
    OutputType["OUTPUT_TYPE_SIMPLE"] = "OUTPUT_TYPE_SIMPLE";
    /**
     * OUTPUT_TYPE_SPLIT_ROOT - OUTPUT_TYPE_SPLIT_ROOT is a split root output that carries the change
     * from a split or a tombstone from a non-interactive full value send
     * output. In either case, the asset of this output has a tx witness.
     */
    OutputType["OUTPUT_TYPE_SPLIT_ROOT"] = "OUTPUT_TYPE_SPLIT_ROOT";
    OutputType["UNRECOGNIZED"] = "UNRECOGNIZED";
})(OutputType = exports.OutputType || (exports.OutputType = {}));
/**
 * ProofDeliveryStatus is an enum that describes the status of the delivery of
 * a proof associated with an asset transfer output.
 */
var ProofDeliveryStatus;
(function (ProofDeliveryStatus) {
    /** PROOF_DELIVERY_STATUS_NOT_APPLICABLE - Delivery is not applicable; the proof will not be delivered. */
    ProofDeliveryStatus["PROOF_DELIVERY_STATUS_NOT_APPLICABLE"] = "PROOF_DELIVERY_STATUS_NOT_APPLICABLE";
    /** PROOF_DELIVERY_STATUS_COMPLETE - The proof has been successfully delivered. */
    ProofDeliveryStatus["PROOF_DELIVERY_STATUS_COMPLETE"] = "PROOF_DELIVERY_STATUS_COMPLETE";
    /**
     * PROOF_DELIVERY_STATUS_PENDING - The proof is pending delivery. This status indicates that the proof has
     * not yet been delivered successfully. One or more attempts at proof
     * delivery may have been made.
     */
    ProofDeliveryStatus["PROOF_DELIVERY_STATUS_PENDING"] = "PROOF_DELIVERY_STATUS_PENDING";
    ProofDeliveryStatus["UNRECOGNIZED"] = "UNRECOGNIZED";
})(ProofDeliveryStatus = exports.ProofDeliveryStatus || (exports.ProofDeliveryStatus = {}));
var AddrVersion;
(function (AddrVersion) {
    /**
     * ADDR_VERSION_UNSPECIFIED - ADDR_VERSION_UNSPECIFIED is the default value for an address version in
     * an RPC message. It is unmarshalled to the latest address version.
     */
    AddrVersion["ADDR_VERSION_UNSPECIFIED"] = "ADDR_VERSION_UNSPECIFIED";
    /** ADDR_VERSION_V0 - ADDR_VERSION_V0 is the initial address version. */
    AddrVersion["ADDR_VERSION_V0"] = "ADDR_VERSION_V0";
    /**
     * ADDR_VERSION_V1 - ADDR_VERSION_V1 is the address version that uses V2 Taproot Asset
     * commitments.
     */
    AddrVersion["ADDR_VERSION_V1"] = "ADDR_VERSION_V1";
    /**
     * ADDR_VERSION_V2 - ADDR_VERSION_V2 is the address version that supports sending grouped
     * assets and require the new auth mailbox proof courier address format.
     */
    AddrVersion["ADDR_VERSION_V2"] = "ADDR_VERSION_V2";
    AddrVersion["UNRECOGNIZED"] = "UNRECOGNIZED";
})(AddrVersion = exports.AddrVersion || (exports.AddrVersion = {}));
var ScriptKeyType;
(function (ScriptKeyType) {
    /**
     * SCRIPT_KEY_UNKNOWN - The type of script key is not known. This should only be stored for assets
     * where we don't know the internal key of the script key (e.g. for imported
     * proofs).
     */
    ScriptKeyType["SCRIPT_KEY_UNKNOWN"] = "SCRIPT_KEY_UNKNOWN";
    /**
     * SCRIPT_KEY_BIP86 - The script key is a normal BIP-86 key. This means that the internal key is
     * turned into a Taproot output key by applying a BIP-86 tweak to it.
     */
    ScriptKeyType["SCRIPT_KEY_BIP86"] = "SCRIPT_KEY_BIP86";
    /**
     * SCRIPT_KEY_SCRIPT_PATH_EXTERNAL - The script key is a key that contains a script path that is defined by the
     * user and is therefore external to the tapd wallet. Spending this key
     * requires providing a specific witness and must be signed through the vPSBT
     * signing flow.
     */
    ScriptKeyType["SCRIPT_KEY_SCRIPT_PATH_EXTERNAL"] = "SCRIPT_KEY_SCRIPT_PATH_EXTERNAL";
    /**
     * SCRIPT_KEY_BURN - The script key is a specific un-spendable key that indicates a burnt asset.
     * Assets with this key type can never be spent again, as a burn key is a
     * tweaked NUMS key that nobody knows the private key for.
     */
    ScriptKeyType["SCRIPT_KEY_BURN"] = "SCRIPT_KEY_BURN";
    /**
     * SCRIPT_KEY_TOMBSTONE - The script key is a specific un-spendable key that indicates a tombstone
     * output. This is only the case for zero-value assets that result from a
     * non-interactive (TAP address) send where no change was left over.
     */
    ScriptKeyType["SCRIPT_KEY_TOMBSTONE"] = "SCRIPT_KEY_TOMBSTONE";
    /**
     * SCRIPT_KEY_CHANNEL - The script key is used for an asset that resides within a Taproot Asset
     * Channel. That means the script key is either a funding key (OP_TRUE), a
     * commitment output key (to_local, to_remote, htlc), or a HTLC second-level
     * transaction output key. Keys related to channels are not shown in asset
     * balances (unless specifically requested) and are never used for coin
     * selection.
     */
    ScriptKeyType["SCRIPT_KEY_CHANNEL"] = "SCRIPT_KEY_CHANNEL";
    /**
     * SCRIPT_KEY_UNIQUE_PEDERSEN - The script key is derived using the asset ID and a single leaf that contains
     * an un-spendable Pedersen commitment key
     * `(OP_CHECKSIG <NUMS_key + asset_id * G>)`. This can be used to create
     * unique script keys for each virtual packet in the fragment, to avoid proof
     * collisions in the universe, where the script keys should be spendable by
     * a hardware wallet that only supports miniscript policies for signing P2TR
     * outputs.
     */
    ScriptKeyType["SCRIPT_KEY_UNIQUE_PEDERSEN"] = "SCRIPT_KEY_UNIQUE_PEDERSEN";
    ScriptKeyType["UNRECOGNIZED"] = "UNRECOGNIZED";
})(ScriptKeyType = exports.ScriptKeyType || (exports.ScriptKeyType = {}));
var AddrEventStatus;
(function (AddrEventStatus) {
    AddrEventStatus["ADDR_EVENT_STATUS_UNKNOWN"] = "ADDR_EVENT_STATUS_UNKNOWN";
    AddrEventStatus["ADDR_EVENT_STATUS_TRANSACTION_DETECTED"] = "ADDR_EVENT_STATUS_TRANSACTION_DETECTED";
    AddrEventStatus["ADDR_EVENT_STATUS_TRANSACTION_CONFIRMED"] = "ADDR_EVENT_STATUS_TRANSACTION_CONFIRMED";
    AddrEventStatus["ADDR_EVENT_STATUS_PROOF_RECEIVED"] = "ADDR_EVENT_STATUS_PROOF_RECEIVED";
    AddrEventStatus["ADDR_EVENT_STATUS_COMPLETED"] = "ADDR_EVENT_STATUS_COMPLETED";
    AddrEventStatus["UNRECOGNIZED"] = "UNRECOGNIZED";
})(AddrEventStatus = exports.AddrEventStatus || (exports.AddrEventStatus = {}));
var SendState;
(function (SendState) {
    /**
     * SEND_STATE_VIRTUAL_INPUT_SELECT - Input coin selection to pick out which asset inputs should be spent is
     * executed during this state.
     */
    SendState["SEND_STATE_VIRTUAL_INPUT_SELECT"] = "SEND_STATE_VIRTUAL_INPUT_SELECT";
    /** SEND_STATE_VIRTUAL_SIGN - The virtual transaction is signed during this state. */
    SendState["SEND_STATE_VIRTUAL_SIGN"] = "SEND_STATE_VIRTUAL_SIGN";
    /** SEND_STATE_ANCHOR_SIGN - The Bitcoin anchor transaction is signed during this state. */
    SendState["SEND_STATE_ANCHOR_SIGN"] = "SEND_STATE_ANCHOR_SIGN";
    /**
     * SEND_STATE_LOG_COMMITMENT - The outbound packet is written to the database during this state,
     * including the partial proof suffixes. Only parcels that complete this
     * state can be resumed on restart.
     */
    SendState["SEND_STATE_LOG_COMMITMENT"] = "SEND_STATE_LOG_COMMITMENT";
    /**
     * SEND_STATE_BROADCAST - The Bitcoin anchor transaction is broadcast to the network during this
     * state.
     */
    SendState["SEND_STATE_BROADCAST"] = "SEND_STATE_BROADCAST";
    /**
     * SEND_STATE_WAIT_CONFIRMATION - The on-chain anchor transaction needs to reach at least 1 confirmation.
     * This state waits for the confirmation.
     */
    SendState["SEND_STATE_WAIT_CONFIRMATION"] = "SEND_STATE_WAIT_CONFIRMATION";
    /**
     * SEND_STATE_STORE_PROOFS - The anchor transaction was confirmed in a block and the full proofs can
     * now be constructed during this stage.
     */
    SendState["SEND_STATE_STORE_PROOFS"] = "SEND_STATE_STORE_PROOFS";
    /**
     * SEND_STATE_TRANSFER_PROOFS - The full proofs are sent to the recipient(s) with the proof courier
     * service during this state.
     */
    SendState["SEND_STATE_TRANSFER_PROOFS"] = "SEND_STATE_TRANSFER_PROOFS";
    /** SEND_STATE_COMPLETED - The send state machine has completed the send process. */
    SendState["SEND_STATE_COMPLETED"] = "SEND_STATE_COMPLETED";
    SendState["UNRECOGNIZED"] = "UNRECOGNIZED";
})(SendState = exports.SendState || (exports.SendState = {}));
var ParcelType;
(function (ParcelType) {
    /** PARCEL_TYPE_ADDRESS - The parcel is an address parcel. */
    ParcelType["PARCEL_TYPE_ADDRESS"] = "PARCEL_TYPE_ADDRESS";
    /**
     * PARCEL_TYPE_PRE_SIGNED - The parcel type is a pre-signed parcel where the virtual transactions are
     * signed outside of the send state machine. Parcels of this type will only
     * get send states starting from SEND_STATE_ANCHOR_SIGN.
     */
    ParcelType["PARCEL_TYPE_PRE_SIGNED"] = "PARCEL_TYPE_PRE_SIGNED";
    /**
     * PARCEL_TYPE_PENDING - The parcel is pending and was resumed on the latest restart of the
     * daemon. The original parcel type (address or pre-signed) is not known
     * anymore, as it's not relevant for the remaining steps. Parcels of this
     * type will only get send states starting from SEND_STATE_BROADCAST.
     */
    ParcelType["PARCEL_TYPE_PENDING"] = "PARCEL_TYPE_PENDING";
    /**
     * PARCEL_TYPE_PRE_ANCHORED - The parcel type is a pre-anchored parcel where the full anchor
     * transaction and all proofs are already available. Parcels of this type
     * will only get send states starting from SEND_STATE_LOG_COMMITMENT.
     */
    ParcelType["PARCEL_TYPE_PRE_ANCHORED"] = "PARCEL_TYPE_PRE_ANCHORED";
    ParcelType["UNRECOGNIZED"] = "UNRECOGNIZED";
})(ParcelType = exports.ParcelType || (exports.ParcelType = {}));
