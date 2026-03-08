"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChangeAddressType = exports.WitnessType = exports.AddressType = void 0;
var AddressType;
(function (AddressType) {
    AddressType["UNKNOWN"] = "UNKNOWN";
    AddressType["WITNESS_PUBKEY_HASH"] = "WITNESS_PUBKEY_HASH";
    AddressType["NESTED_WITNESS_PUBKEY_HASH"] = "NESTED_WITNESS_PUBKEY_HASH";
    AddressType["HYBRID_NESTED_WITNESS_PUBKEY_HASH"] = "HYBRID_NESTED_WITNESS_PUBKEY_HASH";
    AddressType["TAPROOT_PUBKEY"] = "TAPROOT_PUBKEY";
    AddressType["UNRECOGNIZED"] = "UNRECOGNIZED";
})(AddressType = exports.AddressType || (exports.AddressType = {}));
var WitnessType;
(function (WitnessType) {
    WitnessType["UNKNOWN_WITNESS"] = "UNKNOWN_WITNESS";
    /**
     * COMMITMENT_TIME_LOCK - A witness that allows us to spend the output of a commitment transaction
     * after a relative lock-time lockout.
     */
    WitnessType["COMMITMENT_TIME_LOCK"] = "COMMITMENT_TIME_LOCK";
    /**
     * COMMITMENT_NO_DELAY - A witness that allows us to spend a settled no-delay output immediately on a
     * counterparty's commitment transaction.
     */
    WitnessType["COMMITMENT_NO_DELAY"] = "COMMITMENT_NO_DELAY";
    /**
     * COMMITMENT_REVOKE - A witness that allows us to sweep the settled output of a malicious
     * counterparty's who broadcasts a revoked commitment transaction.
     */
    WitnessType["COMMITMENT_REVOKE"] = "COMMITMENT_REVOKE";
    /**
     * HTLC_OFFERED_REVOKE - A witness that allows us to sweep an HTLC which we offered to the remote
     * party in the case that they broadcast a revoked commitment state.
     */
    WitnessType["HTLC_OFFERED_REVOKE"] = "HTLC_OFFERED_REVOKE";
    /**
     * HTLC_ACCEPTED_REVOKE - A witness that allows us to sweep an HTLC output sent to us in the case that
     * the remote party broadcasts a revoked commitment state.
     */
    WitnessType["HTLC_ACCEPTED_REVOKE"] = "HTLC_ACCEPTED_REVOKE";
    /**
     * HTLC_OFFERED_TIMEOUT_SECOND_LEVEL - A witness that allows us to sweep an HTLC output that we extended to a
     * party, but was never fulfilled.  This HTLC output isn't directly on the
     * commitment transaction, but is the result of a confirmed second-level HTLC
     * transaction. As a result, we can only spend this after a CSV delay.
     */
    WitnessType["HTLC_OFFERED_TIMEOUT_SECOND_LEVEL"] = "HTLC_OFFERED_TIMEOUT_SECOND_LEVEL";
    /**
     * HTLC_ACCEPTED_SUCCESS_SECOND_LEVEL - A witness that allows us to sweep an HTLC output that was offered to us, and
     * for which we have a payment preimage. This HTLC output isn't directly on our
     * commitment transaction, but is the result of confirmed second-level HTLC
     * transaction. As a result, we can only spend this after a CSV delay.
     */
    WitnessType["HTLC_ACCEPTED_SUCCESS_SECOND_LEVEL"] = "HTLC_ACCEPTED_SUCCESS_SECOND_LEVEL";
    /**
     * HTLC_OFFERED_REMOTE_TIMEOUT - A witness that allows us to sweep an HTLC that we offered to the remote
     * party which lies in the commitment transaction of the remote party. We can
     * spend this output after the absolute CLTV timeout of the HTLC as passed.
     */
    WitnessType["HTLC_OFFERED_REMOTE_TIMEOUT"] = "HTLC_OFFERED_REMOTE_TIMEOUT";
    /**
     * HTLC_ACCEPTED_REMOTE_SUCCESS - A witness that allows us to sweep an HTLC that was offered to us by the
     * remote party. We use this witness in the case that the remote party goes to
     * chain, and we know the pre-image to the HTLC. We can sweep this without any
     * additional timeout.
     */
    WitnessType["HTLC_ACCEPTED_REMOTE_SUCCESS"] = "HTLC_ACCEPTED_REMOTE_SUCCESS";
    /**
     * HTLC_SECOND_LEVEL_REVOKE - A witness that allows us to sweep an HTLC from the remote party's commitment
     * transaction in the case that the broadcast a revoked commitment, but then
     * also immediately attempt to go to the second level to claim the HTLC.
     */
    WitnessType["HTLC_SECOND_LEVEL_REVOKE"] = "HTLC_SECOND_LEVEL_REVOKE";
    /**
     * WITNESS_KEY_HASH - A witness type that allows us to spend a regular p2wkh output that's sent to
     * an output which is under complete control of the backing wallet.
     */
    WitnessType["WITNESS_KEY_HASH"] = "WITNESS_KEY_HASH";
    /**
     * NESTED_WITNESS_KEY_HASH - A witness type that allows us to sweep an output that sends to a nested P2SH
     * script that pays to a key solely under our control.
     */
    WitnessType["NESTED_WITNESS_KEY_HASH"] = "NESTED_WITNESS_KEY_HASH";
    /**
     * COMMITMENT_ANCHOR - A witness type that allows us to spend our anchor on the commitment
     * transaction.
     */
    WitnessType["COMMITMENT_ANCHOR"] = "COMMITMENT_ANCHOR";
    /**
     * COMMITMENT_NO_DELAY_TWEAKLESS - A witness type that is similar to the COMMITMENT_NO_DELAY type,
     * but it omits the tweak that randomizes the key we need to
     * spend with a channel peer supplied set of randomness.
     */
    WitnessType["COMMITMENT_NO_DELAY_TWEAKLESS"] = "COMMITMENT_NO_DELAY_TWEAKLESS";
    /**
     * COMMITMENT_TO_REMOTE_CONFIRMED - A witness type that allows us to spend our output on the counterparty's
     * commitment transaction after a confirmation.
     */
    WitnessType["COMMITMENT_TO_REMOTE_CONFIRMED"] = "COMMITMENT_TO_REMOTE_CONFIRMED";
    /**
     * HTLC_OFFERED_TIMEOUT_SECOND_LEVEL_INPUT_CONFIRMED - A witness type that allows us to sweep an HTLC output that we extended
     * to a party, but was never fulfilled. This _is_ the HTLC output directly
     * on our commitment transaction, and the input to the second-level HTLC
     * timeout transaction. It can only be spent after CLTV expiry, and
     * commitment confirmation.
     */
    WitnessType["HTLC_OFFERED_TIMEOUT_SECOND_LEVEL_INPUT_CONFIRMED"] = "HTLC_OFFERED_TIMEOUT_SECOND_LEVEL_INPUT_CONFIRMED";
    /**
     * HTLC_ACCEPTED_SUCCESS_SECOND_LEVEL_INPUT_CONFIRMED - A witness type that allows us to sweep an HTLC output that was offered
     * to us, and for which we have a payment preimage. This _is_ the HTLC
     * output directly on our commitment transaction, and the input to the
     * second-level HTLC success transaction. It can only be spent after the
     * commitment has confirmed.
     */
    WitnessType["HTLC_ACCEPTED_SUCCESS_SECOND_LEVEL_INPUT_CONFIRMED"] = "HTLC_ACCEPTED_SUCCESS_SECOND_LEVEL_INPUT_CONFIRMED";
    /**
     * LEASE_COMMITMENT_TIME_LOCK - A witness type that allows us to spend our output on our local
     * commitment transaction after a relative and absolute lock-time lockout as
     * part of the script enforced lease commitment type.
     */
    WitnessType["LEASE_COMMITMENT_TIME_LOCK"] = "LEASE_COMMITMENT_TIME_LOCK";
    /**
     * LEASE_COMMITMENT_TO_REMOTE_CONFIRMED - A witness type that allows us to spend our output on the counterparty's
     * commitment transaction after a confirmation and absolute locktime as part
     * of the script enforced lease commitment type.
     */
    WitnessType["LEASE_COMMITMENT_TO_REMOTE_CONFIRMED"] = "LEASE_COMMITMENT_TO_REMOTE_CONFIRMED";
    /**
     * LEASE_HTLC_OFFERED_TIMEOUT_SECOND_LEVEL - A witness type that allows us to sweep an HTLC output that we extended
     * to a party, but was never fulfilled. This HTLC output isn't directly on
     * the commitment transaction, but is the result of a confirmed second-level
     * HTLC transaction. As a result, we can only spend this after a CSV delay
     * and CLTV locktime as part of the script enforced lease commitment type.
     */
    WitnessType["LEASE_HTLC_OFFERED_TIMEOUT_SECOND_LEVEL"] = "LEASE_HTLC_OFFERED_TIMEOUT_SECOND_LEVEL";
    /**
     * LEASE_HTLC_ACCEPTED_SUCCESS_SECOND_LEVEL - A witness type that allows us to sweep an HTLC output that was offered
     * to us, and for which we have a payment preimage. This HTLC output isn't
     * directly on our commitment transaction, but is the result of confirmed
     * second-level HTLC transaction. As a result, we can only spend this after
     * a CSV delay and CLTV locktime as part of the script enforced lease
     * commitment type.
     */
    WitnessType["LEASE_HTLC_ACCEPTED_SUCCESS_SECOND_LEVEL"] = "LEASE_HTLC_ACCEPTED_SUCCESS_SECOND_LEVEL";
    /**
     * TAPROOT_PUB_KEY_SPEND - A witness type that allows us to spend a regular p2tr output that's sent
     * to an output which is under complete control of the backing wallet.
     */
    WitnessType["TAPROOT_PUB_KEY_SPEND"] = "TAPROOT_PUB_KEY_SPEND";
    /**
     * TAPROOT_LOCAL_COMMIT_SPEND - A witness type that allows us to spend our settled local commitment after a
     * CSV delay when we force close the channel.
     */
    WitnessType["TAPROOT_LOCAL_COMMIT_SPEND"] = "TAPROOT_LOCAL_COMMIT_SPEND";
    /**
     * TAPROOT_REMOTE_COMMIT_SPEND - A witness type that allows us to spend our settled local commitment after
     * a CSV delay when the remote party has force closed the channel.
     */
    WitnessType["TAPROOT_REMOTE_COMMIT_SPEND"] = "TAPROOT_REMOTE_COMMIT_SPEND";
    /** TAPROOT_ANCHOR_SWEEP_SPEND - A witness type that we'll use for spending our own anchor output. */
    WitnessType["TAPROOT_ANCHOR_SWEEP_SPEND"] = "TAPROOT_ANCHOR_SWEEP_SPEND";
    /**
     * TAPROOT_HTLC_OFFERED_TIMEOUT_SECOND_LEVEL - A witness that allows us to timeout an HTLC we offered to the remote party
     * on our commitment transaction. We use this when we need to go on chain to
     * time out an HTLC.
     */
    WitnessType["TAPROOT_HTLC_OFFERED_TIMEOUT_SECOND_LEVEL"] = "TAPROOT_HTLC_OFFERED_TIMEOUT_SECOND_LEVEL";
    /**
     * TAPROOT_HTLC_ACCEPTED_SUCCESS_SECOND_LEVEL - A witness type that allows us to sweep an HTLC we accepted on our commitment
     * transaction after we go to the second level on chain.
     */
    WitnessType["TAPROOT_HTLC_ACCEPTED_SUCCESS_SECOND_LEVEL"] = "TAPROOT_HTLC_ACCEPTED_SUCCESS_SECOND_LEVEL";
    /**
     * TAPROOT_HTLC_SECOND_LEVEL_REVOKE - A witness that allows us to sweep an HTLC on the revoked transaction of the
     * remote party that goes to the second level.
     */
    WitnessType["TAPROOT_HTLC_SECOND_LEVEL_REVOKE"] = "TAPROOT_HTLC_SECOND_LEVEL_REVOKE";
    /**
     * TAPROOT_HTLC_ACCEPTED_REVOKE - A witness that allows us to sweep an HTLC sent to us by the remote party
     * in the event that they broadcast a revoked state.
     */
    WitnessType["TAPROOT_HTLC_ACCEPTED_REVOKE"] = "TAPROOT_HTLC_ACCEPTED_REVOKE";
    /**
     * TAPROOT_HTLC_OFFERED_REVOKE - A witness that allows us to sweep an HTLC we offered to the remote party if
     * they broadcast a revoked commitment.
     */
    WitnessType["TAPROOT_HTLC_OFFERED_REVOKE"] = "TAPROOT_HTLC_OFFERED_REVOKE";
    /**
     * TAPROOT_HTLC_OFFERED_REMOTE_TIMEOUT - A witness that allows us to sweep an HTLC we offered to the remote party
     * that lies on the commitment transaction for the remote party. We can spend
     * this output after the absolute CLTV timeout of the HTLC as passed.
     */
    WitnessType["TAPROOT_HTLC_OFFERED_REMOTE_TIMEOUT"] = "TAPROOT_HTLC_OFFERED_REMOTE_TIMEOUT";
    /**
     * TAPROOT_HTLC_LOCAL_OFFERED_TIMEOUT - A witness type that allows us to sign the second level HTLC timeout
     * transaction when spending from an HTLC residing on our local commitment
     * transaction.
     * This is used by the sweeper to re-sign inputs if it needs to aggregate
     * several second level HTLCs.
     */
    WitnessType["TAPROOT_HTLC_LOCAL_OFFERED_TIMEOUT"] = "TAPROOT_HTLC_LOCAL_OFFERED_TIMEOUT";
    /**
     * TAPROOT_HTLC_ACCEPTED_REMOTE_SUCCESS - A witness that allows us to sweep an HTLC that was offered to us by the
     * remote party for a taproot channels. We use this witness in the case that
     * the remote party goes to chain, and we know the pre-image to the HTLC. We
     * can sweep this without any additional timeout.
     */
    WitnessType["TAPROOT_HTLC_ACCEPTED_REMOTE_SUCCESS"] = "TAPROOT_HTLC_ACCEPTED_REMOTE_SUCCESS";
    /**
     * TAPROOT_HTLC_ACCEPTED_LOCAL_SUCCESS - A witness type that allows us to sweep the HTLC offered to us on our local
     * commitment transaction. We'll use this when we need to go on chain to sweep
     * the HTLC. In this case, this is the second level HTLC success transaction.
     */
    WitnessType["TAPROOT_HTLC_ACCEPTED_LOCAL_SUCCESS"] = "TAPROOT_HTLC_ACCEPTED_LOCAL_SUCCESS";
    /**
     * TAPROOT_COMMITMENT_REVOKE - A witness that allows us to sweep the settled output of a malicious
     * counterparty's who broadcasts a revoked taproot commitment transaction.
     */
    WitnessType["TAPROOT_COMMITMENT_REVOKE"] = "TAPROOT_COMMITMENT_REVOKE";
    WitnessType["UNRECOGNIZED"] = "UNRECOGNIZED";
})(WitnessType = exports.WitnessType || (exports.WitnessType = {}));
/**
 * The possible change address types for default accounts and single imported
 * public keys. By default, P2WPKH will be used. We don't provide the
 * possibility to choose P2PKH as it is a legacy key scope, nor NP2WPKH as
 * no key scope permits to do so. For custom accounts, no change type should
 * be provided as the coin selection key scope will always be used to generate
 * the change address.
 */
var ChangeAddressType;
(function (ChangeAddressType) {
    /**
     * CHANGE_ADDRESS_TYPE_UNSPECIFIED - CHANGE_ADDRESS_TYPE_UNSPECIFIED indicates that no change address type is
     * provided. We will then use P2WPKH address type for change (BIP0084 key
     * scope).
     */
    ChangeAddressType["CHANGE_ADDRESS_TYPE_UNSPECIFIED"] = "CHANGE_ADDRESS_TYPE_UNSPECIFIED";
    /**
     * CHANGE_ADDRESS_TYPE_P2TR - CHANGE_ADDRESS_TYPE_P2TR indicates to use P2TR address for change output
     * (BIP0086 key scope).
     */
    ChangeAddressType["CHANGE_ADDRESS_TYPE_P2TR"] = "CHANGE_ADDRESS_TYPE_P2TR";
    ChangeAddressType["UNRECOGNIZED"] = "UNRECOGNIZED";
})(ChangeAddressType = exports.ChangeAddressType || (exports.ChangeAddressType = {}));
