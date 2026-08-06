import {
    errorToUserFriendly,
    parseLdkNodeError,
    parseCashuDevKitError
} from './ErrorUtils';

jest.mock('./LocaleUtils', () => ({
    localeString: (key: string) => require('../locales/en.json')[key]
}));

describe('ErrorUtils', () => {
    describe('errorToUserFriendly', () => {
        it('Turns error message to user friendly values', () => {
            expect(
                errorToUserFriendly(
                    Object.assign(new Error(), {
                        message: `{
                        "code": 2,
                        "message": "transaction output is dust",
                        "details": []
                    }`,
                        name: 'test'
                    })
                )
            ).toEqual('transaction output is dust');
            expect(
                errorToUserFriendly(
                    Object.assign(new Error(), {
                        message: `{
                        "code": 2,
                        "message": "proto: (line 1:126): invalid value for uint64 type: 0.1",
                        "details": []
                    }`,
                        name: 'test'
                    })
                )
            ).toEqual(
                'proto: (line 1:126): invalid value for uint64 type: 0.1'
            );
            expect(
                errorToUserFriendly(
                    Object.assign(new Error(), {
                        message: `{
                            "error": {
                                "code": 2,
                                "message": "invoice is already paid",
                                "details": []
                            }
                        }
                        `,
                        name: 'test'
                    })
                )
            ).toEqual('invoice is already paid');
            expect(
                errorToUserFriendly(
                    Object.assign(new Error(), {
                        message: `{
                            "error": {
                                "code": 2,
                                "message": "Error: SOCKS: Connection refused",
                                "details": []
                            }
                        }
                        `,
                        name: 'test'
                    })
                )
            ).toEqual(
                'Host unreachable. Try restarting your node or its Tor process.'
            );
            expect(
                errorToUserFriendly(
                    Object.assign(new Error(), {
                        message:
                            'Error: called `Result::unwrap()` on an `Err` value: BootStrapError("Timeout waiting for bootstrap")',
                        name: 'test'
                    })
                )
            ).toEqual(
                'Error starting up Tor on your phone. Try restarting ZEUS. If the problem persists consider using the Orbot app to connect to Tor, or using an alternative connection method like Lightning Node Connect or Tailscale.'
            );
            expect(
                errorToUserFriendly(
                    Object.assign(new Error(), {
                        message:
                            'Error: called `Result::unwrap()` on an `Err` value: BootStrapError("Timeout waiting for boostrap")',
                        name: 'test'
                    })
                )
            ).toEqual(
                'Error starting up Tor on your phone. Try restarting ZEUS. If the problem persists consider using the Orbot app to connect to Tor, or using an alternative connection method like Lightning Node Connect or Tailscale.'
            );
        });

        it('Handles partial error message matches', () => {
            expect(
                errorToUserFriendly(
                    Object.assign(new Error(), {
                        message:
                            'Error: Failed to connect to /can-be-any-host:8082',
                        name: 'test'
                    })
                )
            ).toEqual(
                'Unable to connect to node. Please verify the host and port are correct and the service is running.'
            );
            expect(
                errorToUserFriendly(
                    Object.assign(new Error(), {
                        message:
                            'Error: {"code":2,"message":"verification failed: signature mismatch after caveat verification","details":[]}',
                        name: 'test'
                    })
                )
            ).toEqual(
                "Invalid macaroon. Please check that you've entered the correct macaroon for this node."
            );
        });

        it('Returns normal error message for unhandled errorContext', () => {
            expect(
                errorToUserFriendly(
                    Object.assign(new Error(), {
                        message: 'FAILURE_REASON_INCORRECT_PAYMENT_DETAILS',
                        name: 'test'
                    }),
                    ['UnhandledContext']
                )
            ).toEqual(
                'Payment failed because the invoice was rejected, canceled, or is no longer valid. For a canceled hold invoice, the held payment is released and your funds are not sent. Check Activity for the final payment state.'
            );
        });

        it('Handles raw LND payment details errors', () => {
            expect(
                errorToUserFriendly(
                    new Error(
                        'Payment details incorrect (unknown hash, invalid amt or invalid final cltv delta)'
                    )
                )
            ).toEqual(
                'Payment failed because the invoice was rejected, canceled, or is no longer valid. For a canceled hold invoice, the held payment is released and your funds are not sent. Check Activity for the final payment state.'
            );
        });

        it('Handles Keysend errorContext with additional message', () => {
            expect(
                errorToUserFriendly(
                    Object.assign(new Error(), {
                        message: 'FAILURE_REASON_INCORRECT_PAYMENT_DETAILS',
                        name: 'test'
                    }),
                    ['Keysend']
                )
            ).toEqual(
                'Payment failed because the invoice was rejected, canceled, or is no longer valid. For a canceled hold invoice, the held payment is released and your funds are not sent. Check Activity for the final payment state. The receiving node might not accept keysend payments.'
            );
        });

        it('Handles raw LND payment details errors with Keysend errorContext', () => {
            expect(
                errorToUserFriendly(
                    new Error(
                        'Payment details incorrect (unknown hash, invalid amt or invalid final cltv delta)'
                    ),
                    ['Keysend']
                )
            ).toEqual(
                'Payment failed because the invoice was rejected, canceled, or is no longer valid. For a canceled hold invoice, the held payment is released and your funds are not sent. Check Activity for the final payment state. The receiving node might not accept keysend payments.'
            );
        });

        it('Returns inputted error if no match found', () => {
            expect(
                errorToUserFriendly(
                    Object.assign(new Error(), {
                        message: 'Random message that can even contain Error',
                        name: 'test'
                    })
                )
            ).toEqual('Random message that can even contain Error');
        });

        it('Return string if error is sent as a string', () => {
            expect(errorToUserFriendly(new Error('Payment timed out'))).toEqual(
                'Payment timed out'
            );
        });

        it('Handles PascalCased LSP error messages', () => {
            expect(
                errorToUserFriendly(
                    new Error('ChannelExpiryBlocksTooHighInCreateOrderRequest')
                )
            ).toEqual('Channel expiry blocks too high in create order request');
        });

        it('Handles invalid server response error messages', () => {
            expect(
                errorToUserFriendly(
                    new Error(
                        'ReactNativeBlobUtil failed to encode response data to BASE64 string.'
                    )
                )
            ).toEqual('Received invalid response data from the server');
        });
    });

    describe('parseLdkNodeError', () => {
        it('parses Android NodeException with dot separator', () => {
            expect(
                parseLdkNodeError(
                    'org.lightningdevkit.ldknode.NodeException.RefundCreationFailed: Failed to create refund.'
                )
            ).toEqual('Failed to create refund.');
        });

        it('parses Android NodeException with dollar separator', () => {
            expect(
                parseLdkNodeError(
                    'org.lightningdevkit.ldknode.NodeException$RefundCreationFailed: Failed to create refund.'
                )
            ).toEqual('Failed to create refund.');
        });

        it('parses iOS NodeError with message parameter', () => {
            expect(
                parseLdkNodeError(
                    'RefundCreationFailed(message: "Failed to create refund.")'
                )
            ).toEqual('Failed to create refund.');
        });

        it('parses iOS error with Error: prefix', () => {
            expect(
                parseLdkNodeError(
                    'Error: RefundCreationFailed(message: "Failed to create refund.")'
                )
            ).toEqual('Failed to create refund.');
        });

        it('parses Error object with Android-style message', () => {
            expect(
                parseLdkNodeError(
                    new Error(
                        'org.lightningdevkit.ldknode.NodeException.InvoiceCreationFailed: Invoice creation failed.'
                    )
                )
            ).toEqual('Invoice creation failed.');
        });

        it('parses Error object with iOS-style message', () => {
            expect(
                parseLdkNodeError(
                    new Error(
                        'ChannelCreationFailed(message: "Channel creation failed.")'
                    )
                )
            ).toEqual('Channel creation failed.');
        });

        it('parses various Android NodeException types', () => {
            expect(
                parseLdkNodeError(
                    'org.lightningdevkit.ldknode.NodeException.PaymentSendingFailed: Payment failed to send.'
                )
            ).toEqual('Payment failed to send.');

            expect(
                parseLdkNodeError(
                    'org.lightningdevkit.ldknode.NodeException.ChannelClosingFailed: Could not close channel.'
                )
            ).toEqual('Could not close channel.');
        });

        it('passes through non-LDK error strings unchanged', () => {
            expect(parseLdkNodeError('Something went wrong')).toEqual(
                'Something went wrong'
            );
        });

        it('strips Error: prefix from plain errors', () => {
            expect(parseLdkNodeError('Error: Something went wrong')).toEqual(
                'Something went wrong'
            );
        });

        it('passes through non-LDK Error objects unchanged', () => {
            expect(
                parseLdkNodeError(new Error('Something went wrong'))
            ).toEqual('Something went wrong');
        });

        it('handles empty string', () => {
            expect(parseLdkNodeError('')).toEqual('');
        });

        it('handles null/undefined', () => {
            expect(parseLdkNodeError(null)).toEqual('');
            expect(parseLdkNodeError(undefined)).toEqual('');
        });
    });

    describe('parseCashuDevKitError', () => {
        it('extracts inner message from iOS FfiError with associated value', () => {
            expect(
                parseCashuDevKitError(
                    'CashuDevKit.FfiError.Generic(message: "Mint returned HTTP 400")'
                )
            ).toEqual('Mint returned HTTP 400');
        });

        it('extracts inner message from various iOS FfiError variants', () => {
            expect(
                parseCashuDevKitError(
                    'CashuDevKit.FfiError.InsufficientFunds(message: "Not enough proofs to melt")'
                )
            ).toEqual('Not enough proofs to melt');

            expect(
                parseCashuDevKitError(
                    'CashuDevKit.FfiError.PaymentFailed(message: "lightning payment failed")'
                )
            ).toEqual('lightning payment failed');

            expect(
                parseCashuDevKitError(
                    'CashuDevKit.FfiError.Network(message: "connection refused")'
                )
            ).toEqual('connection refused');
        });

        it('humanizes bare iOS FfiError case names with no associated value', () => {
            expect(
                parseCashuDevKitError('CashuDevKit.FfiError.Generic')
            ).toEqual('Generic');
            expect(
                parseCashuDevKitError('CashuDevKit.FfiError.InsufficientFunds')
            ).toEqual('Insufficient funds');
            expect(
                parseCashuDevKitError('CashuDevKit.FfiError.KeysetUnknown')
            ).toEqual('Keyset unknown');
        });

        it('extracts inner message from Android FfiException with dot separator', () => {
            expect(
                parseCashuDevKitError(
                    'uniffi.cdk_ffi.FfiException.Generic: Mint returned HTTP 400'
                )
            ).toEqual('Mint returned HTTP 400');
        });

        it('extracts inner message from Android FfiException with dollar separator', () => {
            expect(
                parseCashuDevKitError(
                    'uniffi.cdk_ffi.FfiException$PaymentFailed: lightning payment failed'
                )
            ).toEqual('lightning payment failed');
        });

        it('humanizes Android FfiException case when no inner message present', () => {
            expect(
                parseCashuDevKitError('uniffi.cdk_ffi.FfiException$InvalidUrl')
            ).toEqual('Invalid url');
        });

        it('parses Error object with iOS-style FfiError message', () => {
            expect(
                parseCashuDevKitError(
                    new Error(
                        'CashuDevKit.FfiError.PaymentFailed(message: "no route found")'
                    )
                )
            ).toEqual('no route found');
        });

        it('parses Error object with Android-style FfiException message', () => {
            expect(
                parseCashuDevKitError(
                    new Error(
                        'uniffi.cdk_ffi.FfiException.Network: timed out connecting to mint'
                    )
                )
            ).toEqual('timed out connecting to mint');
        });

        it('handles multi-line inner messages on iOS', () => {
            expect(
                parseCashuDevKitError(
                    'CashuDevKit.FfiError.Generic(message: "first line\nsecond line")'
                )
            ).toEqual('first line\nsecond line');
        });

        it('preserves embedded colons in Android inner messages', () => {
            expect(
                parseCashuDevKitError(
                    'uniffi.cdk_ffi.FfiException.Generic: Mint returned HTTP 400: bad request'
                )
            ).toEqual('Mint returned HTTP 400: bad request');
        });

        it('passes through non-CDK error strings unchanged', () => {
            expect(parseCashuDevKitError('Something went wrong')).toEqual(
                'Something went wrong'
            );
        });

        it('passes through non-CDK Error objects unchanged', () => {
            expect(
                parseCashuDevKitError(new Error('Insufficient funds'))
            ).toEqual('Insufficient funds');
        });

        it('handles empty string', () => {
            expect(parseCashuDevKitError('')).toEqual('');
        });

        it('handles null/undefined', () => {
            expect(parseCashuDevKitError(null)).toEqual('');
            expect(parseCashuDevKitError(undefined)).toEqual('');
        });

        it('handles object with no message property', () => {
            expect(parseCashuDevKitError({})).toEqual('[object Object]');
        });

        it('extracts only the detail field from CDK mint error responses (iOS)', () => {
            expect(
                parseCashuDevKitError(
                    'CashuDevKit.FfiError.Generic(message: "CDK Error: Unknown error response: `code: 20004, detail: Lightning payment failed: Ran out of routes to try after 1 attempt: see `paystatus`.`")'
                )
            ).toEqual(
                'Lightning payment failed: Ran out of routes to try after 1 attempt: see `paystatus`.'
            );
        });

        it('extracts only the detail field from CDK mint error responses (Android)', () => {
            expect(
                parseCashuDevKitError(
                    'uniffi.cdk_ffi.FfiException$Generic: CDK Error: Unknown error response: `code: 20004, detail: Lightning payment failed: unable to find a path to destination.`'
                )
            ).toEqual(
                'Lightning payment failed: unable to find a path to destination.'
            );
        });

        it('falls back to the error field when detail is absent', () => {
            expect(
                parseCashuDevKitError(
                    'CashuDevKit.FfiError.Generic(message: "CDK Error: Unknown error response: `code: 11000, error: quote amount not as requested`")'
                )
            ).toEqual('Quote amount not as requested');
        });

        it('capitalizes lowercased detail messages', () => {
            expect(
                parseCashuDevKitError(
                    'CashuDevKit.FfiError.Generic(message: "code: 20001, detail: insufficient inputs provided")'
                )
            ).toEqual('Insufficient inputs provided');
        });

        it('extracts detail from a raw (non-FFI-wrapped) CDK string', () => {
            expect(
                parseCashuDevKitError(
                    'CDK Error: Unknown error response: `code: 20004, detail: payment expired.`'
                )
            ).toEqual('Payment expired.');
        });

        it('leaves non-CDK strings with the word "detail:" alone', () => {
            expect(
                parseCashuDevKitError('see the detail: that is important')
            ).toEqual('see the detail: that is important');
        });

        it('returns the unparsed inner message when no code/detail pattern is present', () => {
            expect(
                parseCashuDevKitError(
                    'CashuDevKit.FfiError.PaymentFailed(message: "no route to recipient")'
                )
            ).toEqual('no route to recipient');
        });
    });
});
