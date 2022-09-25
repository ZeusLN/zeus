import ErrorUtils from './ErrorUtils';

describe('ErrorUtils', () => {
    describe('errorToUserFriendly', () => {
        it('Turns error message to user friendly values', () => {
            expect(
                ErrorUtils.errorToUserFriendly(
                    'Error: SOCKS: Connection refused'
                )
            ).toEqual(
                'Host unreachable. Try restarting your node or its Tor process.'
            );
            expect(
                ErrorUtils.errorToUserFriendly(
                    'Error: called `Result::unwrap()` on an `Err` value: BootStrapError("Timeout waiting for bootstrap")'
                )
            ).toEqual(
                'Error starting up Tor on your phone. Try restarting Zeus. If the problem persists consider reinstalling the app.'
            );
        });

        it('Returns inputted error if no match found', () => {
            expect(ErrorUtils.errorToUserFriendly('Random message')).toEqual(
                'Random message'
            );
        });
    });
});
