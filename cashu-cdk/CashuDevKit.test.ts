import { mapCDKError } from './CashuDevKit';
import { CDKErrorType } from './types';

// React Native rejections carry the native error code next to the message
const nativeRejection = (code: string, message: string) =>
    Object.assign(new Error(message), { code });

describe('mapCDKError', () => {
    describe('network classification', () => {
        it('classifies a CDK transport error with no HTTP response as Network', () => {
            // Before: the 'url' in this text classified it as InvalidUrl
            const message =
                'Http transport error None: error sending request for url (https://mint.test/v1/keysets)';
            expect(
                mapCDKError(nativeRejection('NETWORK_ERROR', message))
            ).toEqual({ type: CDKErrorType.Network, message });
        });

        it('classifies the transport text as Network without the native code', () => {
            expect(
                mapCDKError(
                    new Error(
                        'Http transport error None: error sending request for url (https://mint.test/v1/info)'
                    )
                ).type
            ).toBe(CDKErrorType.Network);
        });

        it('trusts the native NETWORK_ERROR code for an HTTP error without a Cashu body', () => {
            expect(
                mapCDKError(
                    nativeRejection(
                        'NETWORK_ERROR',
                        'Http transport error Some(502): Bad Gateway'
                    )
                ).type
            ).toBe(CDKErrorType.Network);
        });

        it('matches network and connection case-insensitively', () => {
            expect(mapCDKError(new Error('Connection refused')).type).toBe(
                CDKErrorType.Network
            );
            expect(mapCDKError(new Error('Network unreachable')).type).toBe(
                CDKErrorType.Network
            );
        });

        it('keeps earlier, more specific classifications ahead of the native code', () => {
            expect(
                mapCDKError(
                    nativeRejection('NETWORK_ERROR', 'Insufficient funds')
                ).type
            ).toBe(CDKErrorType.InsufficientFunds);
        });
    });

    it('still classifies a real invalid URL as InvalidUrl', () => {
        expect(
            mapCDKError(nativeRejection('INVALID_URL', 'Invalid URL: ftp:/x'))
                .type
        ).toBe(CDKErrorType.InvalidUrl);
    });

    it('leaves the mint "Unknown quote" error Generic so the external-quote fallback can match it', () => {
        const mapped = mapCDKError(
            nativeRejection('GENERIC_ERROR', 'Unknown quote')
        );
        expect(mapped).toEqual({
            type: CDKErrorType.Generic,
            message: 'Unknown quote'
        });
    });

    it('unwraps a raw iOS FFI error before classifying', () => {
        expect(
            mapCDKError(
                new Error(
                    'CashuDevKit.FfiError.Cdk(code: 999, errorMessage: "Http transport error None: error sending request for url (https://mint.test/v1/keys)")'
                )
            )
        ).toEqual({
            type: CDKErrorType.Network,
            message:
                'Http transport error None: error sending request for url (https://mint.test/v1/keys)'
        });
    });
});
