import { errorToUserFriendly } from './ErrorUtils';

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
                    }),
                    false
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
                    }),
                    false
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
                    }),
                    false
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
                    }),
                    false
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
                    }),
                    false
                )
            ).toEqual(
                'Error starting up Tor on your phone. Try restarting Zeus. If the problem persists consider using the Orbot app to connect to Tor, or using an alternative connection method like Lightning Node Connect or Tailscale.'
            );
            expect(
                errorToUserFriendly(
                    Object.assign(new Error(), {
                        message:
                            'Error: called `Result::unwrap()` on an `Err` value: BootStrapError("Timeout waiting for boostrap")',
                        name: 'test'
                    }),
                    false
                )
            ).toEqual(
                'Error starting up Tor on your phone. Try restarting Zeus. If the problem persists consider using the Orbot app to connect to Tor, or using an alternative connection method like Lightning Node Connect or Tailscale.'
            );
        });

        it('Returns inputted error if no match found', () => {
            expect(
                errorToUserFriendly(
                    Object.assign(new Error(), {
                        message: 'Random message',
                        name: 'test'
                    }),
                    false
                )
            ).toEqual('Random message');
        });

        it('Return string if error is sent as a string', () => {
            expect(errorToUserFriendly('Payment timed out', false)).toEqual(
                'Payment timed out'
            );
        });

        it('Handles PascalCased LSP error messages', () => {
            expect(
                errorToUserFriendly(
                    'ChannelExpiryBlocksTooHighInCreateOrderRequest',
                    false
                )
            ).toEqual('Channel expiry blocks too high in create order request');
        });
    });
});
