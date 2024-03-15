import { errorToUserFriendly } from './ErrorUtils';

describe('ErrorUtils', () => {
    describe('errorToUserFriendly', () => {
        it('Turns error message to user friendly values', () => {
            expect(
                errorToUserFriendly(
                    JSON.stringify({
                        code: 2,
                        message: 'transaction output is dust',
                        details: []
                    })
                )
            ).toEqual('transaction output is dust');
            expect(
                errorToUserFriendly(
                    JSON.stringify({
                        code: 3,
                        message:
                            'proto: (line 1:126): invalid value for uint64 type: "0.01"',
                        details: []
                    })
                )
            ).toEqual(
                'proto: (line 1:126): invalid value for uint64 type: "0.01"'
            );
            expect(
                errorToUserFriendly(
                    JSON.stringify({
                        error: {
                            code: 2,
                            message: 'invoice is already paid',
                            details: []
                        }
                    })
                )
            ).toEqual('invoice is already paid');
            expect(
                errorToUserFriendly('Error: SOCKS: Connection refused', false)
            ).toEqual(
                'Host unreachable. Try restarting your node or its Tor process.'
            );
            expect(
                errorToUserFriendly(
                    'Error: called `Result::unwrap()` on an `Err` value: BootStrapError("Timeout waiting for bootstrap")',
                    false
                )
            ).toEqual(
                'Error starting up Tor on your phone. Try restarting Zeus. If the problem persists consider using the Orbot app to connect to Tor, or using an alternative connection method like Lightning Node Connect or Tailscale.'
            );
            expect(
                errorToUserFriendly(
                    'Error: called `Result::unwrap()` on an `Err` value: BootStrapError("Timeout waiting for boostrap")',
                    false
                )
            ).toEqual(
                'Error starting up Tor on your phone. Try restarting Zeus. If the problem persists consider using the Orbot app to connect to Tor, or using an alternative connection method like Lightning Node Connect or Tailscale.'
            );
        });

        it('Returns inputted error if no match found', () => {
            expect(errorToUserFriendly('Random message', false)).toEqual(
                'Random message'
            );
        });
    });
});
