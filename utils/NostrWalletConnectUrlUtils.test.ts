import { buildNostrWalletConnectUrl } from './NostrWalletConnectUrlUtils';

describe('NostrWalletConnectUrlUtils', () => {
    it('builds a connection URL without lud16 by default', () => {
        expect(
            buildNostrWalletConnectUrl({
                walletServicePubkey: 'service-pubkey',
                relayUrl: 'wss://relay.getalby.com/v1',
                secret: 'secret-key'
            })
        ).toBe(
            'nostr+walletconnect://service-pubkey?relay=wss%3A%2F%2Frelay.getalby.com%2Fv1&secret=secret-key'
        );
    });

    it('appends lud16 when a lightning address is provided', () => {
        expect(
            buildNostrWalletConnectUrl({
                walletServicePubkey: 'service-pubkey',
                relayUrl: 'wss://relay.getalby.com/v1',
                secret: 'secret-key',
                lud16: 'satoshi@zeuspay.com'
            })
        ).toBe(
            'nostr+walletconnect://service-pubkey?relay=wss%3A%2F%2Frelay.getalby.com%2Fv1&secret=secret-key&lud16=satoshi%40zeuspay.com'
        );
    });

    it('ignores blank lud16 values', () => {
        expect(
            buildNostrWalletConnectUrl({
                walletServicePubkey: 'service-pubkey',
                relayUrl: 'wss://relay.getalby.com/v1',
                secret: 'secret-key',
                lud16: '   '
            })
        ).toBe(
            'nostr+walletconnect://service-pubkey?relay=wss%3A%2F%2Frelay.getalby.com%2Fv1&secret=secret-key'
        );
    });
});
