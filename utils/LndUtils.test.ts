import { toLnrpcAddressType, toLnrpcAddressTypeNum } from './LndUtils';

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
});
