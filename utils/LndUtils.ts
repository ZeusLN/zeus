// LND's lnrpc.NewAddress endpoint expects the AddressType enum by name.
// Address types reach the backend in three forms:
//
// 1. The numeric strings used by the address-type picker / settings ('0',
//    '1', '4') — LND REST's grpc-gateway silently treats these as the
//    default (WITNESS_PUBKEY_HASH = native segwit) unless converted.
// 2. The lnrpc enum names (already correct).
// 3. The walletrpc enum names returned by ListAccounts and forwarded by
//    OnChainAddresses → Receive: NESTED_WITNESS_PUBKEY_HASH and
//    HYBRID_NESTED_WITNESS_PUBKEY_HASH. lnrpc.NewAddress has no hybrid
//    variant; the resulting address is still a nested-segwit p2sh-p2wkh,
//    which is the visible part the receiver cares about.
const LNRPC_NEW_ADDRESS_TYPE_NAMES: { [key: string]: string } = {
    '0': 'WITNESS_PUBKEY_HASH',
    '1': 'NESTED_PUBKEY_HASH',
    '2': 'UNUSED_WITNESS_PUBKEY_HASH',
    '3': 'UNUSED_NESTED_PUBKEY_HASH',
    '4': 'TAPROOT_PUBKEY',
    '5': 'UNUSED_TAPROOT_PUBKEY',
    NESTED_WITNESS_PUBKEY_HASH: 'NESTED_PUBKEY_HASH',
    HYBRID_NESTED_WITNESS_PUBKEY_HASH: 'NESTED_PUBKEY_HASH'
};

export const toLnrpcAddressType = (
    value: string | number | undefined | null
): string | undefined => {
    if (value == null) return undefined;
    const key = String(value);
    return LNRPC_NEW_ADDRESS_TYPE_NAMES[key] ?? key;
};

// Numeric form of the lnrpc enum, for the embedded LND backend.
// protobufjs's NewAddressRequest encoder writes the `type` field via
// `writer.int32(...)`, which does numeric coercion — enum-name strings
// like 'NESTED_PUBKEY_HASH' become NaN and get serialized as 0
// (= WITNESS_PUBKEY_HASH). Always send a number.
const LNRPC_ADDRESS_TYPE_NUMS: { [key: string]: number } = {
    WITNESS_PUBKEY_HASH: 0,
    NESTED_PUBKEY_HASH: 1,
    UNUSED_WITNESS_PUBKEY_HASH: 2,
    UNUSED_NESTED_PUBKEY_HASH: 3,
    TAPROOT_PUBKEY: 4,
    UNUSED_TAPROOT_PUBKEY: 5
};

export const toLnrpcAddressTypeNum = (
    value: string | number | undefined | null
): number | undefined => {
    const name = toLnrpcAddressType(value);
    if (name == null) return undefined;
    if (LNRPC_ADDRESS_TYPE_NUMS[name] !== undefined)
        return LNRPC_ADDRESS_TYPE_NUMS[name];
    const num = Number(name);
    return Number.isInteger(num) ? num : undefined;
};
