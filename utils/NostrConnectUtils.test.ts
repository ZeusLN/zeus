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

jest.mock('react-native-notifications', () => ({
    Notifications: {
        postLocalNotification: jest.fn()
    }
}));

import * as nostrTools from 'nostr-tools';

import NostrConnectUtils from './NostrConnectUtils';

// Stable hex values: repeat a hex digit 64 times to fill 32 bytes
const hex64 = (c: string) => c.repeat(64);

const PUBKEY = hex64('a');
const RELAY = 'wss://relay.example.com';
const SECRET = hex64('b');

describe('NostrConnectUtils', () => {
    describe('buildWalletConnectConnectionUrl', () => {
        describe('URI structure', () => {
            it('produces the exact nostr+walletconnect:// template literal', () => {
                expect(
                    NostrConnectUtils.buildWalletConnectConnectionUrl(
                        PUBKEY,
                        RELAY,
                        SECRET
                    )
                ).toBe(
                    `nostr+walletconnect://${PUBKEY}?relay=${RELAY}&secret=${SECRET}`
                );
            });

            it('places pubkey immediately after the scheme', () => {
                const url = NostrConnectUtils.buildWalletConnectConnectionUrl(
                    PUBKEY,
                    RELAY,
                    SECRET
                );
                expect(url.startsWith(`nostr+walletconnect://${PUBKEY}?`)).toBe(
                    true
                );
            });

            it('relay comes before secret in the query string', () => {
                const url = NostrConnectUtils.buildWalletConnectConnectionUrl(
                    PUBKEY,
                    RELAY,
                    SECRET
                );
                const relayIdx = url.indexOf('relay=');
                const secretIdx = url.indexOf('secret=');
                expect(relayIdx).toBeLessThan(secretIdx);
            });

            it('embeds relay and secret verbatim without percent-encoding', () => {
                const relayWithSpecialChars = 'wss://relay.com/path?x=y&z=1';
                const url = NostrConnectUtils.buildWalletConnectConnectionUrl(
                    PUBKEY,
                    relayWithSpecialChars,
                    SECRET
                );
                expect(url).toContain(`relay=${relayWithSpecialChars}`);
                expect(url).toContain(`secret=${SECRET}`);
            });
        });

        describe('relay URL variations', () => {
            const relayVariants = [
                ['simple host', 'wss://relay.damus.io'],
                ['explicit port', 'wss://relay.example.com:3334/'],
                [
                    'multi-segment path',
                    'wss://nos.lostribe.org/nostr-protocol/wss'
                ],
                [
                    'relay with own query string',
                    'wss://pool.com?subscription=alice&tier=free'
                ],
                ['Unicode path segment', 'wss://relay.com/path/ノード'],
                ['localhost', 'ws://localhost:7447']
            ] as const;

            it.each(relayVariants)(
                '%s — embedded verbatim',
                (_label, relayUrl) => {
                    expect(
                        NostrConnectUtils.buildWalletConnectConnectionUrl(
                            PUBKEY,
                            relayUrl,
                            SECRET
                        )
                    ).toBe(
                        `nostr+walletconnect://${PUBKEY}?relay=${relayUrl}&secret=${SECRET}`
                    );
                }
            );
        });

        describe('lud16 parameter', () => {
            it('appends &lud16=<value> verbatim when provided', () => {
                const lud = 'alice@domain.com';
                const url = NostrConnectUtils.buildWalletConnectConnectionUrl(
                    PUBKEY,
                    RELAY,
                    SECRET,
                    lud
                );
                expect(url).toBe(
                    `nostr+walletconnect://${PUBKEY}?relay=${RELAY}&secret=${SECRET}&lud16=${lud}`
                );
            });

            it('appends lud16 verbatim even with special characters', () => {
                const lud = 'alice+tag@sats.tips?t=⚡';
                const url = NostrConnectUtils.buildWalletConnectConnectionUrl(
                    PUBKEY,
                    RELAY,
                    SECRET,
                    lud
                );
                expect(url.endsWith(`&lud16=${lud}`)).toBe(true);
            });

            it.each([
                ['null', null],
                ['undefined', undefined],
                ['empty string', '']
            ])('omits lud16 when %s', (_label, lud16) => {
                const url = NostrConnectUtils.buildWalletConnectConnectionUrl(
                    PUBKEY,
                    RELAY,
                    SECRET,
                    lud16
                );
                expect(url).toBe(
                    `nostr+walletconnect://${PUBKEY}?relay=${RELAY}&secret=${SECRET}`
                );
                expect(url).not.toContain('lud16');
            });
        });
    });

    describe('generateConnectionSecret', () => {
        it('returns all three fields: connectionUrl, connectionPrivateKey, connectionPublicKey', () => {
            const out = NostrConnectUtils.generateConnectionSecret(
                PUBKEY,
                RELAY
            );
            expect(out).toHaveProperty('connectionUrl');
            expect(out).toHaveProperty('connectionPrivateKey');
            expect(out).toHaveProperty('connectionPublicKey');
        });

        it('connectionPrivateKey is a 64-character hex string (32 bytes)', () => {
            const { connectionPrivateKey } =
                NostrConnectUtils.generateConnectionSecret(PUBKEY, RELAY);
            expect(connectionPrivateKey).toMatch(/^[0-9a-f]{64}$/);
        });

        it('connectionPublicKey is derived from connectionPrivateKey via nostr-tools', () => {
            const { connectionPrivateKey, connectionPublicKey } =
                NostrConnectUtils.generateConnectionSecret(PUBKEY, RELAY);
            expect(connectionPublicKey).toBe(
                nostrTools.getPublicKey(connectionPrivateKey)
            );
        });

        it('connectionUrl matches buildWalletConnectConnectionUrl output', () => {
            const out = NostrConnectUtils.generateConnectionSecret(
                PUBKEY,
                RELAY
            );
            expect(out.connectionUrl).toBe(
                NostrConnectUtils.buildWalletConnectConnectionUrl(
                    PUBKEY,
                    RELAY,
                    out.connectionPrivateKey
                )
            );
        });

        it('connectionUrl does not contain lud16 when not provided', () => {
            const { connectionUrl } =
                NostrConnectUtils.generateConnectionSecret(PUBKEY, RELAY);
            expect(connectionUrl).not.toContain('lud16');
        });

        it.each([
            ['null', null],
            ['undefined', undefined]
        ])('connectionUrl omits lud16 when %s is passed', (_label, lud16) => {
            const out = NostrConnectUtils.generateConnectionSecret(
                PUBKEY,
                RELAY,
                lud16
            );
            expect(out.connectionUrl).not.toContain('lud16');
            expect(out.connectionUrl).toBe(
                NostrConnectUtils.buildWalletConnectConnectionUrl(
                    PUBKEY,
                    RELAY,
                    out.connectionPrivateKey
                )
            );
        });

        it('connectionUrl includes lud16 verbatim when provided', () => {
            const lud = '⚡invoice@strike.me';
            const out = NostrConnectUtils.generateConnectionSecret(
                PUBKEY,
                RELAY,
                lud
            );
            expect(out.connectionUrl).toBe(
                NostrConnectUtils.buildWalletConnectConnectionUrl(
                    PUBKEY,
                    RELAY,
                    out.connectionPrivateKey,
                    lud
                )
            );
            expect(out.connectionUrl).toContain(`&lud16=${lud}`);
        });

        it('generates a unique private key on every call', () => {
            const a = NostrConnectUtils.generateConnectionSecret(PUBKEY, RELAY);
            const b = NostrConnectUtils.generateConnectionSecret(PUBKEY, RELAY);
            expect(a.connectionPrivateKey).not.toBe(b.connectionPrivateKey);
            expect(a.connectionPublicKey).not.toBe(b.connectionPublicKey);
            expect(a.connectionUrl).not.toBe(b.connectionUrl);
        });
    });
});
