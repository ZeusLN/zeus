import ErrorUtils from './ErrorUtils';

describe('ErrorUtils', () => {
    describe('errorToUserFriendly', () => {
        it('Turns error codes to user friendly values', () => {
            expect(ErrorUtils.errorToUserFriendly('11')).toEqual("The person you're trying to connect to isn't available or rejected the connection.  Their public key may have changed or the server may no longer be responding.");
            expect(ErrorUtils.errorToUserFriendly('3')).toEqual("Can't find a route to make this payment on the Lightning network.  Try to open a channel directly to the destination or find another route.");
        });

        it('Returns error codes with no match', () => {
            expect(ErrorUtils.errorToUserFriendly('15')).toEqual('15');
        });
    });
});