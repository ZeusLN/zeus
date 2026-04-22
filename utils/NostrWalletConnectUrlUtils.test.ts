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

    describe('LUD-16 Lightning Address validation', () => {
        it('accepts valid lightning addresses', () => {
            expect(
                buildNostrWalletConnectUrl({
                    walletServicePubkey: 'service-pubkey',
                    relayUrl: 'wss://relay.getalby.com/v1',
                    secret: 'secret-key',
                    lud16: 'user@example.com'
                })
            ).toContain('lud16=user%40example.com');

            expect(
                buildNostrWalletConnectUrl({
                    walletServicePubkey: 'service-pubkey',
                    relayUrl: 'wss://relay.getalby.com/v1',
                    secret: 'secret-key',
                    lud16: 'alice@ln.example.org'
                })
            ).toContain('lud16=alice%40ln.example.org');
        });

        it('rejects invalid lightning address format - no domain', () => {
            expect(() =>
                buildNostrWalletConnectUrl({
                    walletServicePubkey: 'service-pubkey',
                    relayUrl: 'wss://relay.getalby.com/v1',
                    secret: 'secret-key',
                    lud16: 'user@invalid'
                })
            ).toThrow('Invalid Lightning Address format (must be name@domain)');
        });

        it('rejects invalid lightning address format - missing localpart', () => {
            expect(() =>
                buildNostrWalletConnectUrl({
                    walletServicePubkey: 'service-pubkey',
                    relayUrl: 'wss://relay.getalby.com/v1',
                    secret: 'secret-key',
                    lud16: '@example.com'
                })
            ).toThrow('Invalid Lightning Address format (must be name@domain)');
        });

        it('rejects invalid lightning address format - missing domain', () => {
            expect(() =>
                buildNostrWalletConnectUrl({
                    walletServicePubkey: 'service-pubkey',
                    relayUrl: 'wss://relay.getalby.com/v1',
                    secret: 'secret-key',
                    lud16: 'user@'
                })
            ).toThrow('Invalid Lightning Address format (must be name@domain)');
        });

        it('rejects invalid lightning address format - spaces in address', () => {
            expect(() =>
                buildNostrWalletConnectUrl({
                    walletServicePubkey: 'service-pubkey',
                    relayUrl: 'wss://relay.getalby.com/v1',
                    secret: 'secret-key',
                    lud16: 'user space@example.com'
                })
            ).toThrow('Invalid Lightning Address format (must be name@domain)');
        });

        it('accepts lightning addresses with allowed special characters', () => {
            expect(
                buildNostrWalletConnectUrl({
                    walletServicePubkey: 'service-pubkey',
                    relayUrl: 'wss://relay.getalby.com/v1',
                    secret: 'secret-key',
                    lud16: 'user.name@sub.example.com'
                })
            ).toContain('lud16=user.name%40sub.example.com');

            expect(
                buildNostrWalletConnectUrl({
                    walletServicePubkey: 'service-pubkey',
                    relayUrl: 'wss://relay.getalby.com/v1',
                    secret: 'secret-key',
                    lud16: 'user-name@example.com'
                })
            ).toContain('lud16=user-name%40example.com');
        });

        it('rejects invalid domain format - leading hyphen in domain label', () => {
            expect(() =>
                buildNostrWalletConnectUrl({
                    walletServicePubkey: 'service-pubkey',
                    relayUrl: 'wss://relay.getalby.com/v1',
                    secret: 'secret-key',
                    lud16: 'user@-example.com'
                })
            ).toThrow('Invalid Lightning Address format (must be name@domain)');
        });

        it('rejects invalid domain format - dash before TLD', () => {
            expect(() =>
                buildNostrWalletConnectUrl({
                    walletServicePubkey: 'service-pubkey',
                    relayUrl: 'wss://relay.getalby.com/v1',
                    secret: 'secret-key',
                    lud16: 'user@example.-com'
                })
            ).toThrow('Invalid Lightning Address format (must be name@domain)');
        });

        it('rejects invalid domain format - trailing hyphen in domain label', () => {
            expect(() =>
                buildNostrWalletConnectUrl({
                    walletServicePubkey: 'service-pubkey',
                    relayUrl: 'wss://relay.getalby.com/v1',
                    secret: 'secret-key',
                    lud16: 'user@example-.com'
                })
            ).toThrow('Invalid Lightning Address format (must be name@domain)');
        });

        it('accepts DNS-compliant domains with hyphens in middle of labels', () => {
            expect(
                buildNostrWalletConnectUrl({
                    walletServicePubkey: 'service-pubkey',
                    relayUrl: 'wss://relay.getalby.com/v1',
                    secret: 'secret-key',
                    lud16: 'test@my-domain.co.uk'
                })
            ).toContain('lud16=test%40my-domain.co.uk');
        });
    });
});
