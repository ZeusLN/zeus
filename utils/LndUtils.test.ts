import {
    toLnrpcAddressType,
    toLnrpcAddressTypeNum,
    toWalletrpcAddressTypeName,
    toWalletrpcAddressTypeNum
} from './LndUtils';

describe('LndUtils', () => {
    describe('toLnrpcAddressType', () => {
        it('returns the lnrpc enum name for numeric-string input from the picker / settings', () => {
            expect(toLnrpcAddressType('0')).toEqual('WITNESS_PUBKEY_HASH');
            expect(toLnrpcAddressType('1')).toEqual('NESTED_PUBKEY_HASH');
            expect(toLnrpcAddressType('2')).toEqual(
                'UNUSED_WITNESS_PUBKEY_HASH'
            );
            expect(toLnrpcAddressType('3')).toEqual(
                'UNUSED_NESTED_PUBKEY_HASH'
            );
            expect(toLnrpcAddressType('4')).toEqual('TAPROOT_PUBKEY');
            expect(toLnrpcAddressType('5')).toEqual('UNUSED_TAPROOT_PUBKEY');
        });

        it('accepts numeric input as well as numeric strings', () => {
            expect(toLnrpcAddressType(0)).toEqual('WITNESS_PUBKEY_HASH');
            expect(toLnrpcAddressType(1)).toEqual('NESTED_PUBKEY_HASH');
            expect(toLnrpcAddressType(4)).toEqual('TAPROOT_PUBKEY');
        });

        it('maps walletrpc enum names returned by ListAccounts to the lnrpc equivalent', () => {
            // lnrpc has no hybrid variant; nested-segwit p2sh-p2wkh is the
            // closest equivalent the receiver sees.
            expect(toLnrpcAddressType('NESTED_WITNESS_PUBKEY_HASH')).toEqual(
                'NESTED_PUBKEY_HASH'
            );
            expect(
                toLnrpcAddressType('HYBRID_NESTED_WITNESS_PUBKEY_HASH')
            ).toEqual('NESTED_PUBKEY_HASH');
        });

        it('passes lnrpc enum names through unchanged', () => {
            expect(toLnrpcAddressType('WITNESS_PUBKEY_HASH')).toEqual(
                'WITNESS_PUBKEY_HASH'
            );
            expect(toLnrpcAddressType('NESTED_PUBKEY_HASH')).toEqual(
                'NESTED_PUBKEY_HASH'
            );
            expect(toLnrpcAddressType('TAPROOT_PUBKEY')).toEqual(
                'TAPROOT_PUBKEY'
            );
        });

        it('returns undefined for null / undefined input so the backend default kicks in', () => {
            expect(toLnrpcAddressType(undefined)).toBeUndefined();
            expect(toLnrpcAddressType(null)).toBeUndefined();
        });

        it('passes unrecognised values through verbatim rather than swallowing them', () => {
            // Lets callers decide how to handle (LND surfaces a clear
            // "not a valid value" error rather than silently picking '0').
            expect(toLnrpcAddressType('SOMETHING_NEW')).toEqual(
                'SOMETHING_NEW'
            );
        });
    });

    describe('toLnrpcAddressTypeNum', () => {
        it('returns the lnrpc numeric AddressType for numeric-string input', () => {
            expect(toLnrpcAddressTypeNum('0')).toEqual(0);
            expect(toLnrpcAddressTypeNum('1')).toEqual(1);
            expect(toLnrpcAddressTypeNum('2')).toEqual(2);
            expect(toLnrpcAddressTypeNum('3')).toEqual(3);
            expect(toLnrpcAddressTypeNum('4')).toEqual(4);
            expect(toLnrpcAddressTypeNum('5')).toEqual(5);
        });

        it('returns the lnrpc numeric AddressType for lnrpc enum names', () => {
            expect(toLnrpcAddressTypeNum('WITNESS_PUBKEY_HASH')).toEqual(0);
            expect(toLnrpcAddressTypeNum('NESTED_PUBKEY_HASH')).toEqual(1);
            expect(toLnrpcAddressTypeNum('TAPROOT_PUBKEY')).toEqual(4);
        });

        it('returns the lnrpc numeric AddressType for walletrpc enum names', () => {
            expect(toLnrpcAddressTypeNum('NESTED_WITNESS_PUBKEY_HASH')).toEqual(
                1
            );
            expect(
                toLnrpcAddressTypeNum('HYBRID_NESTED_WITNESS_PUBKEY_HASH')
            ).toEqual(1);
        });

        it('returns undefined for null / undefined input', () => {
            expect(toLnrpcAddressTypeNum(undefined)).toBeUndefined();
            expect(toLnrpcAddressTypeNum(null)).toBeUndefined();
        });

        it('returns undefined for unrecognised non-numeric strings', () => {
            // protobufjs would silently encode garbage as 0 — better to
            // fall through to the backend default.
            expect(toLnrpcAddressTypeNum('SOMETHING_NEW')).toBeUndefined();
        });

        it('accepts numeric input directly', () => {
            expect(toLnrpcAddressTypeNum(0)).toEqual(0);
            expect(toLnrpcAddressTypeNum(1)).toEqual(1);
            expect(toLnrpcAddressTypeNum(4)).toEqual(4);
        });
    });

    describe('toWalletrpcAddressTypeName', () => {
        it('normalizes walletrpc numeric values from the embedded proto decode', () => {
            // walletrpc.AddressType numbering differs from lnrpc:
            // UNKNOWN=0, WITNESS_PUBKEY_HASH=1, NESTED_WITNESS_PUBKEY_HASH=2,
            // HYBRID_NESTED_WITNESS_PUBKEY_HASH=3, TAPROOT_PUBKEY=4
            expect(toWalletrpcAddressTypeName(1)).toEqual(
                'WITNESS_PUBKEY_HASH'
            );
            expect(toWalletrpcAddressTypeName(2)).toEqual(
                'NESTED_WITNESS_PUBKEY_HASH'
            );
            expect(toWalletrpcAddressTypeName(3)).toEqual(
                'HYBRID_NESTED_WITNESS_PUBKEY_HASH'
            );
            expect(toWalletrpcAddressTypeName(4)).toEqual('TAPROOT_PUBKEY');
            expect(toWalletrpcAddressTypeName('1')).toEqual(
                'WITNESS_PUBKEY_HASH'
            );
            expect(toWalletrpcAddressTypeName('4')).toEqual('TAPROOT_PUBKEY');
        });

        it('passes walletrpc enum names from REST/LNC ListAccounts through unchanged', () => {
            expect(toWalletrpcAddressTypeName('WITNESS_PUBKEY_HASH')).toEqual(
                'WITNESS_PUBKEY_HASH'
            );
            expect(
                toWalletrpcAddressTypeName('NESTED_WITNESS_PUBKEY_HASH')
            ).toEqual('NESTED_WITNESS_PUBKEY_HASH');
            expect(
                toWalletrpcAddressTypeName('HYBRID_NESTED_WITNESS_PUBKEY_HASH')
            ).toEqual('HYBRID_NESTED_WITNESS_PUBKEY_HASH');
            expect(toWalletrpcAddressTypeName('TAPROOT_PUBKEY')).toEqual(
                'TAPROOT_PUBKEY'
            );
        });

        it('maps the lnrpc nested name to its walletrpc equivalent', () => {
            expect(toWalletrpcAddressTypeName('NESTED_PUBKEY_HASH')).toEqual(
                'NESTED_WITNESS_PUBKEY_HASH'
            );
        });

        it('returns undefined for UNKNOWN, null, undefined and unrecognized values', () => {
            expect(toWalletrpcAddressTypeName(0)).toBeUndefined();
            expect(toWalletrpcAddressTypeName('0')).toBeUndefined();
            expect(toWalletrpcAddressTypeName('UNKNOWN')).toBeUndefined();
            expect(toWalletrpcAddressTypeName(undefined)).toBeUndefined();
            expect(toWalletrpcAddressTypeName(null)).toBeUndefined();
            expect(toWalletrpcAddressTypeName('SOMETHING_NEW')).toBeUndefined();
        });
    });

    describe('toWalletrpcAddressTypeNum', () => {
        it('returns walletrpc numeric values for walletrpc names', () => {
            expect(toWalletrpcAddressTypeNum('WITNESS_PUBKEY_HASH')).toEqual(1);
            expect(
                toWalletrpcAddressTypeNum('NESTED_WITNESS_PUBKEY_HASH')
            ).toEqual(2);
            expect(
                toWalletrpcAddressTypeNum('HYBRID_NESTED_WITNESS_PUBKEY_HASH')
            ).toEqual(3);
            expect(toWalletrpcAddressTypeNum('TAPROOT_PUBKEY')).toEqual(4);
        });

        it('passes walletrpc numeric values through', () => {
            expect(toWalletrpcAddressTypeNum(1)).toEqual(1);
            expect(toWalletrpcAddressTypeNum(4)).toEqual(4);
        });

        it('returns undefined for UNKNOWN, null and unrecognized values', () => {
            expect(toWalletrpcAddressTypeNum(0)).toBeUndefined();
            expect(toWalletrpcAddressTypeNum(undefined)).toBeUndefined();
            expect(toWalletrpcAddressTypeNum(null)).toBeUndefined();
            expect(toWalletrpcAddressTypeNum('SOMETHING_NEW')).toBeUndefined();
        });
    });
});
