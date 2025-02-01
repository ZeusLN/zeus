import { errorToUserFriendly } from './ErrorUtils';

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
                'Payment failed: Payment details incorrect (unknown payment hash, invalid amount or invalid final CLTV delta).'
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
                'Payment failed: Payment details incorrect (unknown payment hash, invalid amount or invalid final CLTV delta). The receiving node might not accept keysend payments.'
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
    });
});
