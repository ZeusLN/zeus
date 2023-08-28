/* eslint-disable */
export enum SignMethod {
    /**
     * SIGN_METHOD_WITNESS_V0 - Specifies that a SegWit v0 (p2wkh, np2wkh, p2wsh) input script should be
     * signed.
     */
    SIGN_METHOD_WITNESS_V0 = 'SIGN_METHOD_WITNESS_V0',
    /**
     * SIGN_METHOD_TAPROOT_KEY_SPEND_BIP0086 - Specifies that a SegWit v1 (p2tr) input should be signed by using the
     * BIP0086 method (commit to internal key only).
     */
    SIGN_METHOD_TAPROOT_KEY_SPEND_BIP0086 = 'SIGN_METHOD_TAPROOT_KEY_SPEND_BIP0086',
    /**
     * SIGN_METHOD_TAPROOT_KEY_SPEND - Specifies that a SegWit v1 (p2tr) input should be signed by using a given
     * taproot hash to commit to in addition to the internal key.
     */
    SIGN_METHOD_TAPROOT_KEY_SPEND = 'SIGN_METHOD_TAPROOT_KEY_SPEND',
    /**
     * SIGN_METHOD_TAPROOT_SCRIPT_SPEND - Specifies that a SegWit v1 (p2tr) input should be spent using the script
     * path and that a specific leaf script should be signed for.
     */
    SIGN_METHOD_TAPROOT_SCRIPT_SPEND = 'SIGN_METHOD_TAPROOT_SCRIPT_SPEND',
    UNRECOGNIZED = 'UNRECOGNIZED'
}

export enum MuSig2Version {
    /**
     * MUSIG2_VERSION_UNDEFINED - The default value on the RPC is zero for enums so we need to represent an
     * invalid/undefined version by default to make sure clients upgrade their
     * software to set the version explicitly.
     */
    MUSIG2_VERSION_UNDEFINED = 'MUSIG2_VERSION_UNDEFINED',
    /**
     * MUSIG2_VERSION_V040 - The version of MuSig2 that lnd 0.15.x shipped with, which corresponds to the
     * version v0.4.0 of the MuSig2 BIP draft.
     */
    MUSIG2_VERSION_V040 = 'MUSIG2_VERSION_V040',
    /**
     * MUSIG2_VERSION_V100RC2 - The current version of MuSig2 which corresponds to the version v1.0.0rc2 of
     * the MuSig2 BIP draft.
     */
    MUSIG2_VERSION_V100RC2 = 'MUSIG2_VERSION_V100RC2',
    UNRECOGNIZED = 'UNRECOGNIZED'
}

export interface KeyLocator {
    /** The family of key being identified. */
    keyFamily: number;
    /** The precise index of the key being identified. */
    keyIndex: number;
}

export interface KeyDescriptor {
    /**
     * The raw bytes of the public key in the key pair being identified. Either
     * this or the KeyLocator must be specified.
     */
    rawKeyBytes: Uint8Array | string;
    /**
     * The key locator that identifies which private key to use for signing.
     * Either this or the raw bytes of the target public key must be specified.
     */
    keyLoc: KeyLocator | undefined;
}

export interface TxOut {
    /** The value of the output being spent. */
    value: string;
    /** The script of the output being spent. */
    pkScript: Uint8Array | string;
}

export interface SignDescriptor {
    /**
     * A descriptor that precisely describes *which* key to use for signing. This
     * may provide the raw public key directly, or require the Signer to re-derive
     * the key according to the populated derivation path.
     *
     * Note that if the key descriptor was obtained through walletrpc.DeriveKey,
     * then the key locator MUST always be provided, since the derived keys are not
     * persisted unlike with DeriveNextKey.
     */
    keyDesc: KeyDescriptor | undefined;
    /**
     * A scalar value that will be added to the private key corresponding to the
     * above public key to obtain the private key to be used to sign this input.
     * This value is typically derived via the following computation:
     *
     * derivedKey = privkey + sha256(perCommitmentPoint || pubKey) mod N
     */
    singleTweak: Uint8Array | string;
    /**
     * A private key that will be used in combination with its corresponding
     * private key to derive the private key that is to be used to sign the target
     * input. Within the Lightning protocol, this value is typically the
     * commitment secret from a previously revoked commitment transaction. This
     * value is in combination with two hash values, and the original private key
     * to derive the private key to be used when signing.
     *
     * k = (privKey*sha256(pubKey || tweakPub) +
     * tweakPriv*sha256(tweakPub || pubKey)) mod N
     */
    doubleTweak: Uint8Array | string;
    /**
     * The 32 byte input to the taproot tweak derivation that is used to derive
     * the output key from an internal key: outputKey = internalKey +
     * tagged_hash("tapTweak", internalKey || tapTweak).
     *
     * When doing a BIP 86 spend, this field can be an empty byte slice.
     *
     * When doing a normal key path spend, with the output key committing to an
     * actual script root, then this field should be: the tapscript root hash.
     */
    tapTweak: Uint8Array | string;
    /**
     * The full script required to properly redeem the output. This field will
     * only be populated if a p2tr, p2wsh or a p2sh output is being signed. If a
     * taproot script path spend is being attempted, then this should be the raw
     * leaf script.
     */
    witnessScript: Uint8Array | string;
    /**
     * A description of the output being spent. The value and script MUST be
     * provided.
     */
    output: TxOut | undefined;
    /**
     * The target sighash type that should be used when generating the final
     * sighash, and signature.
     */
    sighash: number;
    /** The target input within the transaction that should be signed. */
    inputIndex: number;
    /**
     * The sign method specifies how the input should be signed. Depending on the
     * method, either the tap_tweak, witness_script or both need to be specified.
     * Defaults to SegWit v0 signing to be backward compatible with older RPC
     * clients.
     */
    signMethod: SignMethod;
}

export interface SignReq {
    /** The raw bytes of the transaction to be signed. */
    rawTxBytes: Uint8Array | string;
    /** A set of sign descriptors, for each input to be signed. */
    signDescs: SignDescriptor[];
    /**
     * The full list of UTXO information for each of the inputs being spent. This
     * is required when spending one or more taproot (SegWit v1) outputs.
     */
    prevOutputs: TxOut[];
}

export interface SignResp {
    /**
     * A set of signatures realized in a fixed 64-byte format ordered in ascending
     * input order.
     */
    rawSigs: Uint8Array | string[];
}

export interface InputScript {
    /** The serializes witness stack for the specified input. */
    witness: Uint8Array | string[];
    /**
     * The optional sig script for the specified witness that will only be set if
     * the input specified is a nested p2sh witness program.
     */
    sigScript: Uint8Array | string;
}

export interface InputScriptResp {
    /** The set of fully valid input scripts requested. */
    inputScripts: InputScript[];
}

export interface SignMessageReq {
    /**
     * The message to be signed. When using REST, this field must be encoded as
     * base64.
     */
    msg: Uint8Array | string;
    /** The key locator that identifies which key to use for signing. */
    keyLoc: KeyLocator | undefined;
    /** Double-SHA256 hash instead of just the default single round. */
    doubleHash: boolean;
    /**
     * Use the compact (pubkey recoverable) format instead of the raw lnwire
     * format. This option cannot be used with Schnorr signatures.
     */
    compactSig: boolean;
    /** Use Schnorr signature. This option cannot be used with compact format. */
    schnorrSig: boolean;
    /**
     * The optional Taproot tweak bytes to apply to the private key before creating
     * a Schnorr signature. The private key is tweaked as described in BIP-341:
     * privKey + h_tapTweak(internalKey || tapTweak)
     */
    schnorrSigTapTweak: Uint8Array | string;
}

export interface SignMessageResp {
    /** The signature for the given message in the fixed-size LN wire format. */
    signature: Uint8Array | string;
}

export interface VerifyMessageReq {
    /**
     * The message over which the signature is to be verified. When using
     * REST, this field must be encoded as base64.
     */
    msg: Uint8Array | string;
    /**
     * The fixed-size LN wire encoded signature to be verified over the given
     * message. When using REST, this field must be encoded as base64.
     */
    signature: Uint8Array | string;
    /**
     * The public key the signature has to be valid for. When using REST, this
     * field must be encoded as base64. If the is_schnorr_sig option is true, then
     * the public key is expected to be in the 32-byte x-only serialization
     * according to BIP-340.
     */
    pubkey: Uint8Array | string;
    /** Specifies if the signature is a Schnorr signature. */
    isSchnorrSig: boolean;
}

export interface VerifyMessageResp {
    /** Whether the signature was valid over the given message. */
    valid: boolean;
}

export interface SharedKeyRequest {
    /** The ephemeral public key to use for the DH key derivation. */
    ephemeralPubkey: Uint8Array | string;
    /**
     * Deprecated. The optional key locator of the local key that should be used.
     * If this parameter is not set then the node's identity private key will be
     * used.
     *
     * @deprecated
     */
    keyLoc: KeyLocator | undefined;
    /**
     * A key descriptor describes the key used for performing ECDH. Either a key
     * locator or a raw public key is expected, if neither is supplied, defaults to
     * the node's identity private key.
     */
    keyDesc: KeyDescriptor | undefined;
}

export interface SharedKeyResponse {
    /** The shared public key, hashed with sha256. */
    sharedKey: Uint8Array | string;
}

export interface TweakDesc {
    /** Tweak is the 32-byte value that will modify the public key. */
    tweak: Uint8Array | string;
    /**
     * Specifies if the target key should be converted to an x-only public key
     * before tweaking. If true, then the public key will be mapped to an x-only
     * key before the tweaking operation is applied.
     */
    isXOnly: boolean;
}

export interface TaprootTweakDesc {
    /**
     * The root hash of the tapscript tree if a script path is committed to. If
     * the MuSig2 key put on chain doesn't also commit to a script path (BIP-0086
     * key spend only), then this needs to be empty and the key_spend_only field
     * below must be set to true. This is required because gRPC cannot
     * differentiate between a zero-size byte slice and a nil byte slice (both
     * would be serialized the same way). So the extra boolean is required.
     */
    scriptRoot: Uint8Array | string;
    /**
     * Indicates that the above script_root is expected to be empty because this
     * is a BIP-0086 key spend only commitment where only the internal key is
     * committed to instead of also including a script root hash.
     */
    keySpendOnly: boolean;
}

export interface MuSig2CombineKeysRequest {
    /**
     * A list of all public keys (serialized in 32-byte x-only format for v0.4.0
     * and 33-byte compressed format for v1.0.0rc2!) participating in the signing
     * session. The list will always be sorted lexicographically internally. This
     * must include the local key which is described by the above key_loc.
     */
    allSignerPubkeys: Uint8Array | string[];
    /**
     * A series of optional generic tweaks to be applied to the the aggregated
     * public key.
     */
    tweaks: TweakDesc[];
    /**
     * An optional taproot specific tweak that must be specified if the MuSig2
     * combined key will be used as the main taproot key of a taproot output
     * on-chain.
     */
    taprootTweak: TaprootTweakDesc | undefined;
    /**
     * The mandatory version of the MuSig2 BIP draft to use. This is necessary to
     * differentiate between the changes that were made to the BIP while this
     * experimental RPC was already released. Some of those changes affect how the
     * combined key and nonces are created.
     */
    version: MuSig2Version;
}

export interface MuSig2CombineKeysResponse {
    /**
     * The combined public key (in the 32-byte x-only format) with all tweaks
     * applied to it. If a taproot tweak is specified, this corresponds to the
     * taproot key that can be put into the on-chain output.
     */
    combinedKey: Uint8Array | string;
    /**
     * The raw combined public key (in the 32-byte x-only format) before any tweaks
     * are applied to it. If a taproot tweak is specified, this corresponds to the
     * internal key that needs to be put into the witness if the script spend path
     * is used.
     */
    taprootInternalKey: Uint8Array | string;
    /** The version of the MuSig2 BIP that was used to combine the keys. */
    version: MuSig2Version;
}

export interface MuSig2SessionRequest {
    /** The key locator that identifies which key to use for signing. */
    keyLoc: KeyLocator | undefined;
    /**
     * A list of all public keys (serialized in 32-byte x-only format for v0.4.0
     * and 33-byte compressed format for v1.0.0rc2!) participating in the signing
     * session. The list will always be sorted lexicographically internally. This
     * must include the local key which is described by the above key_loc.
     */
    allSignerPubkeys: Uint8Array | string[];
    /**
     * An optional list of all public nonces of other signing participants that
     * might already be known.
     */
    otherSignerPublicNonces: Uint8Array | string[];
    /**
     * A series of optional generic tweaks to be applied to the the aggregated
     * public key.
     */
    tweaks: TweakDesc[];
    /**
     * An optional taproot specific tweak that must be specified if the MuSig2
     * combined key will be used as the main taproot key of a taproot output
     * on-chain.
     */
    taprootTweak: TaprootTweakDesc | undefined;
    /**
     * The mandatory version of the MuSig2 BIP draft to use. This is necessary to
     * differentiate between the changes that were made to the BIP while this
     * experimental RPC was already released. Some of those changes affect how the
     * combined key and nonces are created.
     */
    version: MuSig2Version;
}

export interface MuSig2SessionResponse {
    /**
     * The unique ID that represents this signing session. A session can be used
     * for producing a signature a single time. If the signing fails for any
     * reason, a new session with the same participants needs to be created.
     */
    sessionId: Uint8Array | string;
    /**
     * The combined public key (in the 32-byte x-only format) with all tweaks
     * applied to it. If a taproot tweak is specified, this corresponds to the
     * taproot key that can be put into the on-chain output.
     */
    combinedKey: Uint8Array | string;
    /**
     * The raw combined public key (in the 32-byte x-only format) before any tweaks
     * are applied to it. If a taproot tweak is specified, this corresponds to the
     * internal key that needs to be put into the witness if the script spend path
     * is used.
     */
    taprootInternalKey: Uint8Array | string;
    /**
     * The two public nonces the local signer uses, combined into a single value
     * of 66 bytes. Can be split into the two 33-byte points to get the individual
     * nonces.
     */
    localPublicNonces: Uint8Array | string;
    /**
     * Indicates whether all nonces required to start the signing process are known
     * now.
     */
    haveAllNonces: boolean;
    /** The version of the MuSig2 BIP that was used to create the session. */
    version: MuSig2Version;
}

export interface MuSig2RegisterNoncesRequest {
    /** The unique ID of the signing session those nonces should be registered with. */
    sessionId: Uint8Array | string;
    /**
     * A list of all public nonces of other signing participants that should be
     * registered.
     */
    otherSignerPublicNonces: Uint8Array | string[];
}

export interface MuSig2RegisterNoncesResponse {
    /**
     * Indicates whether all nonces required to start the signing process are known
     * now.
     */
    haveAllNonces: boolean;
}

export interface MuSig2SignRequest {
    /** The unique ID of the signing session to use for signing. */
    sessionId: Uint8Array | string;
    /** The 32-byte SHA256 digest of the message to sign. */
    messageDigest: Uint8Array | string;
    /**
     * Cleanup indicates that after signing, the session state can be cleaned up,
     * since another participant is going to be responsible for combining the
     * partial signatures.
     */
    cleanup: boolean;
}

export interface MuSig2SignResponse {
    /** The partial signature created by the local signer. */
    localPartialSignature: Uint8Array | string;
}

export interface MuSig2CombineSigRequest {
    /** The unique ID of the signing session to combine the signatures for. */
    sessionId: Uint8Array | string;
    /**
     * The list of all other participants' partial signatures to add to the current
     * session.
     */
    otherPartialSignatures: Uint8Array | string[];
}

export interface MuSig2CombineSigResponse {
    /**
     * Indicates whether all partial signatures required to create a final, full
     * signature are known yet. If this is true, then the final_signature field is
     * set, otherwise it is empty.
     */
    haveAllSignatures: boolean;
    /** The final, full signature that is valid for the combined public key. */
    finalSignature: Uint8Array | string;
}

export interface MuSig2CleanupRequest {
    /** The unique ID of the signing session that should be removed/cleaned up. */
    sessionId: Uint8Array | string;
}

export interface MuSig2CleanupResponse {}

/**
 * Signer is a service that gives access to the signing functionality of the
 * daemon's wallet.
 */
export interface Signer {
    /**
     * SignOutputRaw is a method that can be used to generated a signature for a
     * set of inputs/outputs to a transaction. Each request specifies details
     * concerning how the outputs should be signed, which keys they should be
     * signed with, and also any optional tweaks. The return value is a fixed
     * 64-byte signature (the same format as we use on the wire in Lightning).
     *
     * If we are  unable to sign using the specified keys, then an error will be
     * returned.
     */
    signOutputRaw(request?: DeepPartial<SignReq>): Promise<SignResp>;
    /**
     * ComputeInputScript generates a complete InputIndex for the passed
     * transaction with the signature as defined within the passed SignDescriptor.
     * This method should be capable of generating the proper input script for both
     * regular p2wkh/p2tr outputs and p2wkh outputs nested within a regular p2sh
     * output.
     *
     * Note that when using this method to sign inputs belonging to the wallet,
     * the only items of the SignDescriptor that need to be populated are pkScript
     * in the TxOut field, the value in that same field, and finally the input
     * index.
     */
    computeInputScript(
        request?: DeepPartial<SignReq>
    ): Promise<InputScriptResp>;
    /**
     * SignMessage signs a message with the key specified in the key locator. The
     * returned signature is fixed-size LN wire format encoded.
     *
     * The main difference to SignMessage in the main RPC is that a specific key is
     * used to sign the message instead of the node identity private key.
     */
    signMessage(
        request?: DeepPartial<SignMessageReq>
    ): Promise<SignMessageResp>;
    /**
     * VerifyMessage verifies a signature over a message using the public key
     * provided. The signature must be fixed-size LN wire format encoded.
     *
     * The main difference to VerifyMessage in the main RPC is that the public key
     * used to sign the message does not have to be a node known to the network.
     */
    verifyMessage(
        request?: DeepPartial<VerifyMessageReq>
    ): Promise<VerifyMessageResp>;
    /**
     * DeriveSharedKey returns a shared secret key by performing Diffie-Hellman key
     * derivation between the ephemeral public key in the request and the node's
     * key specified in the key_desc parameter. Either a key locator or a raw
     * public key is expected in the key_desc, if neither is supplied, defaults to
     * the node's identity private key:
     * P_shared = privKeyNode * ephemeralPubkey
     * The resulting shared public key is serialized in the compressed format and
     * hashed with sha256, resulting in the final key length of 256bit.
     */
    deriveSharedKey(
        request?: DeepPartial<SharedKeyRequest>
    ): Promise<SharedKeyResponse>;
    /**
     * MuSig2CombineKeys (experimental!) is a stateless helper RPC that can be used
     * to calculate the combined MuSig2 public key from a list of all participating
     * signers' public keys. This RPC is completely stateless and deterministic and
     * does not create any signing session. It can be used to determine the Taproot
     * public key that should be put in an on-chain output once all public keys are
     * known. A signing session is only needed later when that output should be
     * _spent_ again.
     *
     * NOTE: The MuSig2 BIP is not final yet and therefore this API must be
     * considered to be HIGHLY EXPERIMENTAL and subject to change in upcoming
     * releases. Backward compatibility is not guaranteed!
     */
    muSig2CombineKeys(
        request?: DeepPartial<MuSig2CombineKeysRequest>
    ): Promise<MuSig2CombineKeysResponse>;
    /**
     * MuSig2CreateSession (experimental!) creates a new MuSig2 signing session
     * using the local key identified by the key locator. The complete list of all
     * public keys of all signing parties must be provided, including the public
     * key of the local signing key. If nonces of other parties are already known,
     * they can be submitted as well to reduce the number of RPC calls necessary
     * later on.
     *
     * NOTE: The MuSig2 BIP is not final yet and therefore this API must be
     * considered to be HIGHLY EXPERIMENTAL and subject to change in upcoming
     * releases. Backward compatibility is not guaranteed!
     */
    muSig2CreateSession(
        request?: DeepPartial<MuSig2SessionRequest>
    ): Promise<MuSig2SessionResponse>;
    /**
     * MuSig2RegisterNonces (experimental!) registers one or more public nonces of
     * other signing participants for a session identified by its ID. This RPC can
     * be called multiple times until all nonces are registered.
     *
     * NOTE: The MuSig2 BIP is not final yet and therefore this API must be
     * considered to be HIGHLY EXPERIMENTAL and subject to change in upcoming
     * releases. Backward compatibility is not guaranteed!
     */
    muSig2RegisterNonces(
        request?: DeepPartial<MuSig2RegisterNoncesRequest>
    ): Promise<MuSig2RegisterNoncesResponse>;
    /**
     * MuSig2Sign (experimental!) creates a partial signature using the local
     * signing key that was specified when the session was created. This can only
     * be called when all public nonces of all participants are known and have been
     * registered with the session. If this node isn't responsible for combining
     * all the partial signatures, then the cleanup flag should be set, indicating
     * that the session can be removed from memory once the signature was produced.
     *
     * NOTE: The MuSig2 BIP is not final yet and therefore this API must be
     * considered to be HIGHLY EXPERIMENTAL and subject to change in upcoming
     * releases. Backward compatibility is not guaranteed!
     */
    muSig2Sign(
        request?: DeepPartial<MuSig2SignRequest>
    ): Promise<MuSig2SignResponse>;
    /**
     * MuSig2CombineSig (experimental!) combines the given partial signature(s)
     * with the local one, if it already exists. Once a partial signature of all
     * participants is registered, the final signature will be combined and
     * returned.
     *
     * NOTE: The MuSig2 BIP is not final yet and therefore this API must be
     * considered to be HIGHLY EXPERIMENTAL and subject to change in upcoming
     * releases. Backward compatibility is not guaranteed!
     */
    muSig2CombineSig(
        request?: DeepPartial<MuSig2CombineSigRequest>
    ): Promise<MuSig2CombineSigResponse>;
    /**
     * MuSig2Cleanup (experimental!) allows a caller to clean up a session early in
     * cases where it's obvious that the signing session won't succeed and the
     * resources can be released.
     *
     * NOTE: The MuSig2 BIP is not final yet and therefore this API must be
     * considered to be HIGHLY EXPERIMENTAL and subject to change in upcoming
     * releases. Backward compatibility is not guaranteed!
     */
    muSig2Cleanup(
        request?: DeepPartial<MuSig2CleanupRequest>
    ): Promise<MuSig2CleanupResponse>;
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
