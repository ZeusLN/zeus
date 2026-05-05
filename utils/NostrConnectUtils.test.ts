jest.mock('../stores/Stores', () => ({
    settingsStore: {
        settings: { display: {} },
        implementation: 'lnd'
    },
    fiatStore: {
        symbolLookup: () => ({ decimalPlaces: 2 }),
        fiatRates: [],
        getSymbol: () => ({
            symbol: '$',
            space: false,
            rtl: false,
            separatorSwap: false,
            decimalPlaces: 2
        })
    },
    unitsStore: { units: 'sats' },
    notesStore: {}
}));

jest.mock('./LocaleUtils', () => ({
    localeString: (key: string) => key
}));

jest.mock('./BackendUtils', () => ({
    __esModule: true,
    default: {}
}));

import * as nostrTools from 'nostr-tools';

import NostrConnectUtils from './NostrConnectUtils';

const hex64 = (c: string) => c.repeat(64);

/**
 * Parses URIs produced by `buildWalletConnectConnectionUrl`: query order is
 * `relay` → `secret` → optional `lud16`.
 */
function parseWalletConnectPairingUri(uri: string): {
    walletPubKeyHex: string;
    relayUrl: string;
    connectionSecretHex: string;
    lud16?: string;
} {
    const scheme = 'nostr+walletconnect://';
    if (!uri.startsWith(scheme)) {
        throw new Error('expected nostr+walletconnect://');
    }

    const qIndex = uri.indexOf('?', scheme.length);
    if (qIndex === -1) {
        throw new Error('missing query');
    }

    const walletPubKeyHex = uri.slice(scheme.length, qIndex);
    const query = uri.slice(qIndex + 1);

    const relayPrefix = 'relay=';
    const secretMarker = '&secret=';
    if (!query.startsWith(relayPrefix)) {
        throw new Error('relay must be first parameter');
    }

    const secretIdx = query.indexOf(secretMarker, relayPrefix.length);
    if (secretIdx === -1) {
        throw new Error('&secret=');
    }

    const relayUrl = decodeURIComponent(
        query.slice(relayPrefix.length, secretIdx)
    );

    const afterSecretHead = secretIdx + secretMarker.length;
    const ludMarker = '&lud16=';

    let connectionSecretHex: string;
    let lud16: string | undefined;
    const ludIdx = query.indexOf(ludMarker, afterSecretHead);
    if (ludIdx === -1) {
        connectionSecretHex = decodeURIComponent(query.slice(afterSecretHead));
    } else {
        connectionSecretHex = decodeURIComponent(
            query.slice(afterSecretHead, ludIdx)
        );
        lud16 = decodeURIComponent(query.slice(ludIdx + ludMarker.length));
    }

    return { walletPubKeyHex, relayUrl, connectionSecretHex, lud16 };
}

describe('NostrConnectUtils — Wallet Connect pairing URI', () => {
    describe('buildWalletConnectConnectionUrl', () => {
        it('starts with nostr+walletconnect scheme with pubkey before query', () => {
            const pubkey = hex64('a');
            const url = NostrConnectUtils.buildWalletConnectConnectionUrl(
                pubkey,
                'wss://relay',
                hex64('b')
            );
            expect(url).toMatch(
                new RegExp(
                    '^nostr\\+walletconnect:\\/\\/' +
                        pubkey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
                        '\\?'
                )
            );
        });

        it('matches the stable template literal: encodeURIComponent on relay and secret', () => {
            const pubkey = hex64('1');
            const relay = 'wss://relay/path?x=y&z=';
            const secret = hex64('2');

            expect(
                NostrConnectUtils.buildWalletConnectConnectionUrl(
                    pubkey,
                    relay,
                    secret
                )
            ).toBe(
                `nostr+walletconnect://${pubkey}?relay=${encodeURIComponent(
                    relay
                )}&secret=${encodeURIComponent(secret)}`
            );
        });

        describe('relay URL decoding (realistic Nostr relays)', () => {
            const cases = [
                ['minimal wss host', 'wss://relay.damus.io'],
                ['port explicit', 'wss://relay.example.com:3334/'],
                [
                    'path with trailing segment',
                    'wss://nos.lostribe.org/nostr-protocol/wss'
                ],
                [
                    'relay with own query string (ambiguous chars encoded)',
                    'wss://pool.com?subscription=alice&tier=free'
                ],
                ['Unicode path segments', 'wss://relay.com/path/ノード']
            ] as const;

            it.each(cases)('%s', (_label, relayUrl) => {
                const pubkey = hex64('3');
                const secret = hex64('4');
                const uri = NostrConnectUtils.buildWalletConnectConnectionUrl(
                    pubkey,
                    relayUrl,
                    secret
                );
                const parsed = parseWalletConnectPairingUri(uri);
                expect(parsed.walletPubKeyHex).toBe(pubkey);
                expect(parsed.relayUrl).toBe(relayUrl);
                expect(parsed.connectionSecretHex).toBe(secret);
                expect(parsed.lud16).toBeUndefined();
            });
        });

        describe('lud16 parameter', () => {
            it('appends &lud16=<encoded> only when set; parses back to exact string', () => {
                const pubkey = hex64('5');
                const relay = 'wss://r';
                const secret = hex64('6');
                const lud = 'alice+tag@sats.tips?t=⚡';

                const withoutLud =
                    NostrConnectUtils.buildWalletConnectConnectionUrl(
                        pubkey,
                        relay,
                        secret
                    );

                expect(withoutLud.includes('lud16')).toBe(false);

                const withLud =
                    NostrConnectUtils.buildWalletConnectConnectionUrl(
                        pubkey,
                        relay,
                        secret,
                        lud
                    );

                expect(withLud).toBe(
                    `${withoutLud}&lud16=${encodeURIComponent(lud)}`
                );

                expect(parseWalletConnectPairingUri(withLud)).toEqual({
                    walletPubKeyHex: pubkey,
                    relayUrl: relay,
                    connectionSecretHex: secret,
                    lud16: lud
                });
            });

            it('omits lud16 for null, undefined, and empty string', () => {
                const pubkey = hex64('7');
                const relay = 'wss://r';
                const secret = hex64('8');
                const base = NostrConnectUtils.buildWalletConnectConnectionUrl(
                    pubkey,
                    relay,
                    secret
                );

                expect(
                    NostrConnectUtils.buildWalletConnectConnectionUrl(
                        pubkey,
                        relay,
                        secret,
                        null
                    )
                ).toBe(base);
                expect(
                    NostrConnectUtils.buildWalletConnectConnectionUrl(
                        pubkey,
                        relay,
                        secret,
                        undefined
                    )
                ).toBe(base);
                expect(
                    NostrConnectUtils.buildWalletConnectConnectionUrl(
                        pubkey,
                        relay,
                        secret,
                        ''
                    )
                ).toBe(base);
                expect(base.includes('lud16')).toBe(false);
            });
        });
    });

    describe('generateConnectionSecret', () => {
        it('derives a valid keypair via nostr-tools and a URI reproducible via the builder', () => {
            const walletPk = hex64('e');
            const relay = 'wss://relay.dev/?nested=1';

            const out = NostrConnectUtils.generateConnectionSecret(
                walletPk,
                relay
            );

            expect(out.connectionPublicKey).toEqual(
                nostrTools.getPublicKey(out.connectionPrivateKey)
            );
            expect(out.connectionPrivateKey.length).toBeGreaterThanOrEqual(
                32 * 2
            );

            expect(out.connectionUrl).toEqual(
                NostrConnectUtils.buildWalletConnectConnectionUrl(
                    walletPk,
                    relay,
                    out.connectionPrivateKey
                )
            );

            const parsed = parseWalletConnectPairingUri(out.connectionUrl);
            expect(parsed.walletPubKeyHex).toBe(walletPk);
            expect(parsed.relayUrl).toBe(relay);
            expect(parsed.connectionSecretHex).toBe(out.connectionPrivateKey);
            expect(parsed.lud16).toBeUndefined();
        });

        it('threads lud16 through the builder so decoding matches input', () => {
            const walletPk = hex64('f');
            const relay = 'wss://relay/';
            const lud = '⚡invoice@strike.me';

            const out = NostrConnectUtils.generateConnectionSecret(
                walletPk,
                relay,
                lud
            );

            const parsed = parseWalletConnectPairingUri(out.connectionUrl);
            expect(parsed.walletPubKeyHex).toBe(walletPk);
            expect(parsed.relayUrl).toBe(relay);
            expect(parsed.connectionSecretHex).toBe(out.connectionPrivateKey);
            expect(parsed.lud16).toBe(lud);

            expect(out.connectionUrl).toEqual(
                NostrConnectUtils.buildWalletConnectConnectionUrl(
                    walletPk,
                    relay,
                    out.connectionPrivateKey,
                    lud
                )
            );
        });
    });
});
