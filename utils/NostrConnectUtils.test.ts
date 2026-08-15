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
    default: {
        supportsMessageSigning: jest.fn(() => true)
    }
}));

jest.mock('react-native-notifications', () => ({
    Notifications: {
        postLocalNotification: jest.fn()
    }
}));

import * as nostrTools from 'nostr-tools';

import BackendUtils from './BackendUtils';
import NostrConnectUtils from './NostrConnectUtils';
import Payment from '../models/Payment';
import Invoice from '../models/Invoice';
import Base64Utils from './Base64Utils';
import { PermissionType } from '../models/NWCConnection';
import type { ConnectionActivity } from '../models/NWCConnection';
import CashuPayment from '../models/CashuPayment';

// Stable hex values: repeat a hex digit 64 times to fill 32 bytes
const hex64 = (c: string) => c.repeat(64);

const ZERO_PREIMAGE =
    '0000000000000000000000000000000000000000000000000000000000000000';

/** Minimal snapshots used by NWC pay_invoice in-transit resolution */
type PaymentStateSnapshot = {
    status: string | number | null;
    isIncomplete: boolean | null;
    error: boolean;
    payment_error: string | null;
    loading: boolean;
};

const INVOICE_A = 'lnbc1nwc-test-invoice-a';
const INVOICE_B = 'lnbc1nwc-test-invoice-b';
const HASH_A = hex64('c');
const HASH_B = hex64('d');

const paymentFixtures = {
    /** LND-style: HTLC still in flight, no real preimage */
    inFlightHtlc: () =>
        new Payment({
            payment_request: INVOICE_A,
            payment_hash: HASH_A,
            payment_preimage: ZERO_PREIMAGE,
            htlcs: [{ status: 'IN_FLIGHT' }]
        }),

    /** LDK / list API: top-level IN_FLIGHT status without htlcs array */
    inFlightStatus: () =>
        new Payment({
            payment_request: INVOICE_A,
            payment_hash: HASH_A,
            status: 'IN_FLIGHT',
            payment_preimage: ZERO_PREIMAGE
        }),

    /** CLN-style: pending sendpay, incomplete */
    pendingCln: () =>
        new Payment({
            payment_request: INVOICE_A,
            payment_hash: HASH_A,
            status: 'pending',
            payment_preimage: ZERO_PREIMAGE
        }),

    settled: () =>
        new Payment({
            payment_request: INVOICE_A,
            payment_hash: HASH_A,
            status: 'SUCCEEDED',
            payment_preimage: 'abc123preimage'
        }),

    failed: () =>
        new Payment({
            payment_request: INVOICE_A,
            payment_hash: HASH_A,
            status: 'FAILED',
            payment_preimage: ZERO_PREIMAGE,
            failure_reason: 'FAILURE_REASON_INCORRECT_PAYMENT_DETAILS',
            htlcs: [{ status: 'FAILED' }]
        }),

    /** Another invoice — used to verify lookup does not cross-match */
    otherInvoiceInFlight: () =>
        new Payment({
            payment_request: INVOICE_B,
            payment_hash: HASH_B,
            status: 'IN_FLIGHT',
            payment_preimage: ZERO_PREIMAGE
        })
};

const storeState = {
    inFlight: (): PaymentStateSnapshot => ({
        status: 'IN_FLIGHT',
        isIncomplete: true,
        error: false,
        payment_error: null,
        loading: false
    }),
    embeddedLndInFlight: (): PaymentStateSnapshot => ({
        status: 1,
        isIncomplete: true,
        error: false,
        payment_error: null,
        loading: false
    }),
    incompleteNoError: (): PaymentStateSnapshot => ({
        status: 'complete',
        isIncomplete: true,
        error: false,
        payment_error: null,
        loading: false
    }),
    timedOut: (): PaymentStateSnapshot => ({
        status: 'complete',
        isIncomplete: true,
        error: true,
        payment_error: 'views.SendingLightning.paymentTimedOut',
        loading: false
    }),
    stillLoading: (): PaymentStateSnapshot => ({
        status: null,
        isIncomplete: null,
        error: false,
        payment_error: null,
        loading: true
    }),
    settled: (): PaymentStateSnapshot => ({
        status: 'SUCCEEDED',
        isIncomplete: false,
        error: false,
        payment_error: null,
        loading: false
    }),
    failed: (): PaymentStateSnapshot => ({
        status: 'FAILED',
        isIncomplete: true,
        error: true,
        payment_error: 'route not found',
        loading: false
    })
};

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

    describe('refreshExpiryForRegenerate', () => {
        const createdAt = new Date('2024-01-01T00:00:00Z');

        it('returns empty when connection never expires', () => {
            expect(
                NostrConnectUtils.refreshExpiryForRegenerate({
                    createdAt
                })
            ).toEqual({});
        });

        it('restarts a 30-day preset from now', () => {
            const priorExpiresAt = new Date('2024-01-31T00:00:00Z');
            const before = Date.now();
            const { expiresAt } = NostrConnectUtils.refreshExpiryForRegenerate({
                expiresAt: priorExpiresAt,
                createdAt
            });
            const after = Date.now();
            const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
            expect(expiresAt!.getTime()).toBeGreaterThanOrEqual(
                before + thirtyDaysMs - 1000
            );
            expect(expiresAt!.getTime()).toBeLessThanOrEqual(
                after + thirtyDaysMs + 1000
            );
        });

        it('restarts custom expiry from now using stored value and unit', () => {
            const priorExpiresAt = new Date('2024-02-01T00:00:00Z');
            const before = Date.now();
            const { expiresAt, customExpiryValue, customExpiryUnit } =
                NostrConnectUtils.refreshExpiryForRegenerate({
                    expiresAt: priorExpiresAt,
                    createdAt,
                    customExpiryValue: 14,
                    customExpiryUnit: 'Days'
                });
            const after = Date.now();
            const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
            expect(customExpiryValue).toBe(14);
            expect(customExpiryUnit).toBe('Days');
            expect(expiresAt!.getTime()).toBeGreaterThanOrEqual(
                before + fourteenDaysMs - 1000
            );
            expect(expiresAt!.getTime()).toBeLessThanOrEqual(
                after + fourteenDaysMs + 1000
            );
        });
    });

    describe('resolveFeeSats', () => {
        it('rounds fractional sats from msat division', () => {
            expect(NostrConnectUtils.resolveFeeSats(1.2)).toBe(1);
            expect(NostrConnectUtils.resolveFeeSats(1.999)).toBe(2);
            expect(NostrConnectUtils.resolveFeeSats('0.5')).toBe(1);
            expect(NostrConnectUtils.resolveFeeSats(0.026)).toBe(0);
        });

        it('returns whole sats unchanged and zeros non-positive or invalid values', () => {
            expect(NostrConnectUtils.resolveFeeSats(3)).toBe(3);
            expect(NostrConnectUtils.resolveFeeSats(0)).toBe(0);
            expect(NostrConnectUtils.resolveFeeSats(-1)).toBe(0);
            expect(NostrConnectUtils.resolveFeeSats(undefined)).toBe(0);
            expect(NostrConnectUtils.resolveFeeSats(null)).toBe(0);
            expect(NostrConnectUtils.resolveFeeSats('')).toBe(0);
            expect(NostrConnectUtils.resolveFeeSats(NaN)).toBe(0);
        });
    });

    describe('lightning payment in-transit detection', () => {
        describe('isInFlightPaymentStatus', () => {
            it.each([
                ['IN_FLIGHT string', 'IN_FLIGHT', true],
                ['embedded-lnd enum', 1, true],
                ['stringified enum', '1', true],
                ['SUCCEEDED', 'SUCCEEDED', false],
                ['complete', 'complete', false],
                ['null', null, false],
                ['undefined', undefined, false]
            ])('%s → %s', (_label, status, expected) => {
                expect(NostrConnectUtils.isInFlightPaymentStatus(status)).toBe(
                    expected
                );
            });
        });

        describe('isPaymentTimedOutMessage', () => {
            it.each([
                [
                    'locale key (SendingLightning)',
                    'views.SendingLightning.paymentTimedOut',
                    true
                ],
                ['locale key (error)', 'error.paymentTimedOut', true],
                [
                    'lowercase phrase',
                    'payment timed out waiting for preimage',
                    true
                ],
                ['unrelated route error', 'route not found', false],
                ['null', null, false],
                ['empty string', '', false]
            ])('%s', (_label, message, expected) => {
                expect(
                    NostrConnectUtils.isPaymentTimedOutMessage(message)
                ).toBe(expected);
            });
        });

        describe('isSettledPayment', () => {
            it('returns true when preimage is present and payment is not failed', () => {
                expect(
                    NostrConnectUtils.isSettledPayment(
                        paymentFixtures.settled()
                    )
                ).toBe(true);
            });

            it('returns false for in-flight HTLC payment', () => {
                expect(
                    NostrConnectUtils.isSettledPayment(
                        paymentFixtures.inFlightHtlc()
                    )
                ).toBe(false);
            });

            it('returns false for explicitly failed payment', () => {
                expect(
                    NostrConnectUtils.isSettledPayment(paymentFixtures.failed())
                ).toBe(false);
            });
        });

        describe('isListedPaymentInTransit', () => {
            it.each([
                ['HTLC IN_FLIGHT', () => paymentFixtures.inFlightHtlc(), true],
                [
                    'status IN_FLIGHT (LDK)',
                    () => paymentFixtures.inFlightStatus(),
                    true
                ],
                [
                    'status pending (CLN)',
                    () => paymentFixtures.pendingCln(),
                    true
                ],
                [
                    'settled with preimage',
                    () => paymentFixtures.settled(),
                    false
                ],
                ['failed HTLC', () => paymentFixtures.failed(), false]
            ])('%s', (_label, buildPayment, expected) => {
                expect(
                    NostrConnectUtils.isListedPaymentInTransit(buildPayment())
                ).toBe(expected);
            });
        });

        describe('findPaymentForInvoice', () => {
            const payments = [
                paymentFixtures.inFlightHtlc(),
                paymentFixtures.otherInvoiceInFlight()
            ];

            it('matches by bolt11 payment request', () => {
                const found = NostrConnectUtils.findPaymentForInvoice(
                    INVOICE_A,
                    payments
                );
                expect(found?.getPaymentRequest).toBe(INVOICE_A);
            });

            it('matches by payment hash when invoice string is omitted', () => {
                const found = NostrConnectUtils.findPaymentForInvoice(
                    'lnbc1unknown',
                    payments,
                    HASH_A
                );
                expect(found?.paymentHash).toBe(HASH_A);
            });

            it('returns undefined when neither invoice nor hash match', () => {
                expect(
                    NostrConnectUtils.findPaymentForInvoice(
                        'lnbc1no-match',
                        payments,
                        hex64('f')
                    )
                ).toBeUndefined();
            });
        });

        describe('findInTransitPaymentForInvoice', () => {
            it('returns only in-transit payment for the requested invoice', () => {
                const payments = [
                    paymentFixtures.settled(),
                    paymentFixtures.inFlightHtlc(),
                    paymentFixtures.otherInvoiceInFlight()
                ];

                const found = NostrConnectUtils.findInTransitPaymentForInvoice(
                    INVOICE_A,
                    payments
                );

                expect(found?.getPaymentRequest).toBe(INVOICE_A);
                expect(NostrConnectUtils.isListedPaymentInTransit(found!)).toBe(
                    true
                );
            });

            it('ignores settled payment for the same invoice', () => {
                const payments = [paymentFixtures.settled()];

                expect(
                    NostrConnectUtils.findInTransitPaymentForInvoice(
                        INVOICE_A,
                        payments
                    )
                ).toBeUndefined();
            });

            it('matches in-transit payment by hash alone', () => {
                const inFlight = paymentFixtures.inFlightStatus();
                const found = NostrConnectUtils.findInTransitPaymentForInvoice(
                    'lnbc1different-encoding-same-hash',
                    [inFlight],
                    HASH_A
                );
                expect(found).toBe(inFlight);
            });
        });

        describe('isTransactionsStorePaymentInTransit', () => {
            it.each([
                ['IN_FLIGHT status', storeState.inFlight(), true],
                [
                    'embedded-lnd numeric status',
                    storeState.embeddedLndInFlight(),
                    true
                ],
                [
                    'incomplete without error (hodl: no preimage yet)',
                    storeState.incompleteNoError(),
                    true
                ],
                ['settled', storeState.settled(), false],
                ['hard failure with error', storeState.failed(), false]
            ])('%s', (_label, state, expected) => {
                expect(
                    NostrConnectUtils.isTransactionsStorePaymentInTransit(state)
                ).toBe(expected);
            });

            it('returns false when incomplete but payment_error is set', () => {
                expect(
                    NostrConnectUtils.isTransactionsStorePaymentInTransit({
                        ...storeState.incompleteNoError(),
                        payment_error: 'views.SendingLightning.paymentTimedOut'
                    })
                ).toBe(false);
            });

            it('returns false when incomplete but still loading', () => {
                expect(
                    NostrConnectUtils.isTransactionsStorePaymentInTransit({
                        ...storeState.incompleteNoError(),
                        loading: true
                    })
                ).toBe(false);
            });
        });

        describe('resolveLightningPaymentInTransit', () => {
            const resolve = (params: {
                invoice?: string;
                payments?: Payment[];
                paymentHash?: string | null;
                paymentState: PaymentStateSnapshot;
            }) =>
                NostrConnectUtils.resolveLightningPaymentInTransit({
                    invoice: params.invoice ?? INVOICE_A,
                    payments: params.payments ?? [],
                    paymentHash: params.paymentHash,
                    paymentState: params.paymentState
                });

            describe('when transactions store reports in-flight', () => {
                it('returns inTransit with matching listed payment', () => {
                    const inFlight = paymentFixtures.inFlightHtlc();
                    const result = resolve({
                        payments: [inFlight],
                        paymentState: storeState.inFlight()
                    });

                    expect(result).toEqual({
                        inTransit: true,
                        payment: inFlight
                    });
                });

                it('returns inTransit even when payment not yet in list', () => {
                    const result = resolve({
                        payments: [],
                        paymentState: storeState.inFlight()
                    });

                    expect(result.inTransit).toBe(true);
                    expect(result.payment).toBeUndefined();
                });

                it('returns not inTransit when list already shows settlement (race)', () => {
                    const settled = paymentFixtures.settled();
                    const result = resolve({
                        payments: [settled],
                        paymentState: storeState.inFlight()
                    });

                    expect(result).toEqual({
                        inTransit: false,
                        payment: settled
                    });
                });
            });

            describe('when store timed out or is still loading', () => {
                it('finds in-transit payment after router timeout message', () => {
                    const inFlight = paymentFixtures.inFlightStatus();
                    const result = resolve({
                        payments: [inFlight],
                        paymentState: storeState.timedOut()
                    });

                    expect(result).toEqual({
                        inTransit: true,
                        payment: inFlight
                    });
                });

                it('finds in-transit payment while send is still loading', () => {
                    const inFlight = paymentFixtures.pendingCln();
                    const result = resolve({
                        payments: [inFlight],
                        paymentState: storeState.stillLoading()
                    });

                    expect(result).toEqual({
                        inTransit: true,
                        payment: inFlight
                    });
                });

                it('returns not inTransit when timeout fired but nothing is in flight', () => {
                    const result = resolve({
                        payments: [paymentFixtures.settled()],
                        paymentState: storeState.timedOut()
                    });

                    expect(result).toEqual({ inTransit: false });
                });
            });

            describe('when store shows settled failure (no false positive)', () => {
                it('does not treat a genuine failure as in-transit', () => {
                    const result = resolve({
                        payments: [paymentFixtures.failed()],
                        paymentState: storeState.failed()
                    });

                    expect(result).toEqual({ inTransit: false });
                });
            });
        });
    });

    describe('NIP-47 transaction field mapping', () => {
        const CREATION_DATE = 1700000000;
        const EXPIRY_SECONDS = 3600;
        const SETTLE_DATE = 1700000500;
        const PREIMAGE = hex64('a');

        /** LND REST returns r_hash and r_preimage base64-encoded */
        const lndInvoice = (overrides: object = {}) => ({
            r_hash: Base64Utils.hexToBase64(HASH_A),
            payment_request: INVOICE_A,
            creation_date: String(CREATION_DATE),
            expiry: String(EXPIRY_SECONDS),
            value: '1000',
            settled: false,
            ...overrides
        });

        describe('connection activity conversion', () => {
            it('never reports the payment request as a payment hash', () => {
                const activity: ConnectionActivity = {
                    id: INVOICE_A,
                    type: 'make_invoice',
                    payment_source: 'lightning',
                    status: 'success',
                    invoice: new Invoice(lndInvoice())
                };

                const tx =
                    NostrConnectUtils.convertConnectionActivityToNip47Transaction(
                        activity
                    );

                expect(tx.payment_hash).toBe(HASH_A);
            });

            it('reports the same expiry as lookup_invoice for activity', () => {
                const activity: ConnectionActivity = {
                    id: INVOICE_A,
                    type: 'make_invoice',
                    payment_source: 'lightning',
                    status: 'success',
                    invoice: new Invoice(lndInvoice())
                };

                const tx =
                    NostrConnectUtils.convertConnectionActivityToNip47Transaction(
                        activity
                    );

                expect(tx.expires_at).toBe(CREATION_DATE + EXPIRY_SECONDS);
            });

            it('returns preimage and description_hash for a settled make_invoice activity', () => {
                const DESCRIPTION_HASH = hex64('b');
                const activity: ConnectionActivity = {
                    id: INVOICE_A,
                    type: 'make_invoice',
                    payment_source: 'lightning',
                    status: 'success',
                    invoice: new Invoice(
                        lndInvoice({
                            settled: true,
                            settle_date: String(SETTLE_DATE),
                            r_preimage: Base64Utils.hexToBase64(PREIMAGE),
                            description_hash: DESCRIPTION_HASH
                        })
                    )
                };

                const tx =
                    NostrConnectUtils.convertConnectionActivityToNip47Transaction(
                        activity
                    );

                expect(tx.state).toBe('settled');
                expect(tx.preimage).toBe(PREIMAGE);
                expect(tx.description_hash).toBe(DESCRIPTION_HASH);
                expect(tx.settled_at).toBe(SETTLE_DATE);
            });

            it('returns preimage from a rehydrated plain-object invoice', () => {
                const activity: ConnectionActivity = {
                    id: INVOICE_A,
                    type: 'make_invoice',
                    payment_source: 'lightning',
                    status: 'success',
                    invoice: lndInvoice({
                        settled: true,
                        settle_date: String(SETTLE_DATE),
                        r_preimage: Base64Utils.hexToBase64(PREIMAGE)
                    }) as any
                };

                const tx =
                    NostrConnectUtils.convertConnectionActivityToNip47Transaction(
                        activity
                    );

                expect(tx.preimage).toBe(PREIMAGE);
                expect(tx.state).toBe('settled');
            });

            it('prefers activity.preimage over invoice fields', () => {
                const STORED_PREIMAGE = hex64('c');
                const activity: ConnectionActivity = {
                    id: INVOICE_A,
                    type: 'make_invoice',
                    payment_source: 'lightning',
                    status: 'success',
                    preimage: STORED_PREIMAGE,
                    invoice: lndInvoice({ settled: true }) as any
                };

                const tx =
                    NostrConnectUtils.convertConnectionActivityToNip47Transaction(
                        activity
                    );

                expect(tx.preimage).toBe(STORED_PREIMAGE);
            });
        });
    });

    describe('payment hash normalization', () => {
        // ZEUS's own NWC backend sends payment_hash base64-encoded, while
        // stored hashes are hex — see backends/NostrWalletConnect.ts
        const normalize = (hash?: string) =>
            NostrConnectUtils.normalizePaymentHash(hash);

        it('passes a hex hash through unchanged', () => {
            expect(normalize(HASH_A)).toBe(HASH_A);
        });

        it('decodes a base64 hash to hex', () => {
            expect(normalize(Base64Utils.hexToBase64(HASH_A))).toBe(HASH_A);
        });

        it('returns undefined for a missing or blank hash', () => {
            expect(normalize(undefined)).toBeUndefined();
            expect(normalize('   ')).toBeUndefined();
        });
    });

    describe('findConnectionActivityByLookupRequest', () => {
        const makeInvoiceActivity = (
            overrides: Partial<ConnectionActivity> = {}
        ): ConnectionActivity => ({
            id: INVOICE_A,
            type: 'make_invoice',
            payment_source: 'lightning',
            status: 'success',
            paymentHash: HASH_A,
            satAmount: 1000,
            ...overrides
        });

        it('finds activity by payment hash', async () => {
            const activity = makeInvoiceActivity();

            const found =
                await NostrConnectUtils.findConnectionActivityByLookupRequest(
                    [activity],
                    { payment_hash: HASH_A }
                );

            expect(found).toBe(activity);
        });

        it('finds activity by BOLT11 invoice string', async () => {
            const activity = makeInvoiceActivity();

            const found =
                await NostrConnectUtils.findConnectionActivityByLookupRequest(
                    [activity],
                    { invoice: INVOICE_A }
                );

            expect(found).toBe(activity);
        });

        it('returns undefined when the hash is not in connection activity', async () => {
            const found =
                await NostrConnectUtils.findConnectionActivityByLookupRequest(
                    [makeInvoiceActivity()],
                    { payment_hash: hex64('f') }
                );

            expect(found).toBeUndefined();
        });

        it('finds activity by payment hash decoded from request.invoice', async () => {
            const BOLT11 =
                'lnbc2500u1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpquwpc4curk03c9wlrswe78q4eyqc7d8d0xqzpu9qrsgqhtjpauu9ur7fw2thcl4y9vfvh4m9wlfyz2gem29g5ghe2aak2pm3ps8fdhtceqsaagty2vph7utlgj48u0ged6a337aewvraedendscp573dxr';
            const BOLT11_HASH =
                '0001020304050607080900010203040506070809000102030405060708090102';
            const activity = makeInvoiceActivity({
                id: 'different-id',
                paymentHash: BOLT11_HASH
            });

            const found =
                await NostrConnectUtils.findConnectionActivityByLookupRequest(
                    [activity],
                    { invoice: BOLT11 }
                );

            expect(found).toBe(activity);
        });

        it('matches invoice-only lookups case-insensitively', async () => {
            const activity = makeInvoiceActivity({ id: INVOICE_A });

            const found =
                await NostrConnectUtils.findConnectionActivityByLookupRequest(
                    [activity],
                    { invoice: INVOICE_A.toUpperCase() }
                );

            expect(found).toBe(activity);
        });
    });

    describe('list_transactions unpaid filter', () => {
        // NIP-47: "unpaid: include unpaid invoices, optional, default false"
        const transaction = (
            state: 'settled' | 'pending' | 'failed',
            type: 'incoming' | 'outgoing',
            createdAt: number
        ) =>
            NostrConnectUtils.createNip47Transaction({
                type,
                state,
                invoice: '',
                payment_hash: '',
                amount: 1000,
                created_at: createdAt
            });

        const settledInvoice = transaction('settled', 'incoming', 400);
        const pendingInvoice = transaction('pending', 'incoming', 300);
        const settledPayment = transaction('settled', 'outgoing', 200);
        const failedPayment = transaction('failed', 'outgoing', 100);
        const all = [
            settledInvoice,
            pendingInvoice,
            settledPayment,
            failedPayment
        ];

        const filter = (request: object) =>
            NostrConnectUtils.filterAndPaginateTransactions(
                all,
                request as never
            );

        it('returns only settled transactions when unpaid is not requested', () => {
            const { transactions, totalCount } = filter({});

            expect(transactions).toEqual([settledInvoice, settledPayment]);
            expect(totalCount).toBe(2);
        });

        it('returns only settled transactions when unpaid is false', () => {
            const { transactions } = filter({ unpaid: false });

            expect(transactions).toEqual([settledInvoice, settledPayment]);
        });

        it('includes every state when unpaid is true', () => {
            const { transactions, totalCount } = filter({ unpaid: true });

            expect(transactions).toHaveLength(4);
            expect(totalCount).toBe(4);
        });

        it('does not drop settled transactions when unpaid is true', () => {
            const { transactions } = filter({ unpaid: true });

            expect(transactions).toContain(settledInvoice);
            expect(transactions).toContain(settledPayment);
        });

        it('still applies the type filter alongside unpaid', () => {
            const { transactions } = filter({
                unpaid: true,
                type: 'outgoing'
            });

            expect(transactions).toEqual([settledPayment, failedPayment]);
        });
    });

    describe('buildSettledPaymentFallback', () => {
        const invoice = 'lnbc210n1fallbackfixture';
        const preimage = hex64('a');
        const paymentHash = hex64('b');

        it('builds a settled lightning Payment from request-side state', () => {
            const payment = NostrConnectUtils.buildSettledPaymentFallback({
                invoice,
                payment_source: 'lightning',
                amountSats: 21000,
                preimage,
                feeSats: '21',
                paymentHash
            });

            expect(payment).toBeInstanceOf(Payment);
            expect(payment).not.toBeInstanceOf(CashuPayment);
            expect(payment.getPaymentRequest).toBe(invoice);
            expect(payment.paymentHash).toBe(paymentHash);
            expect(payment.getPreimage).toBe(preimage);
            expect(payment.getAmount).toBe(21000);
            expect(payment.getFee).toBe('21');
            expect(NostrConnectUtils.isSettledPayment(payment)).toBe(true);
        });

        it('builds a CashuPayment for the cashu source', () => {
            const payment = NostrConnectUtils.buildSettledPaymentFallback({
                invoice,
                payment_source: 'cashu',
                amountSats: 500,
                preimage
            });

            expect(payment).toBeInstanceOf(CashuPayment);
            expect(payment.getPaymentRequest).toBe(invoice);
            expect(payment.getAmount).toBe(500);
        });

        it('constructs without optional fields instead of throwing', () => {
            const payment = NostrConnectUtils.buildSettledPaymentFallback({
                invoice,
                payment_source: 'lightning',
                amountSats: 1000
            });

            expect(payment.getPaymentRequest).toBe(invoice);
            expect(payment.getAmount).toBe(1000);
            expect(payment.getPreimage).toBe('');
            expect(payment.getFee).toBe('0');
            expect(payment.status).toBe('SUCCEEDED');
        });

        it('accepts numeric fees and null preimage', () => {
            const payment = NostrConnectUtils.buildSettledPaymentFallback({
                invoice,
                payment_source: 'lightning',
                amountSats: 1000,
                preimage: null,
                feeSats: 3
            });

            expect(payment.getFee).toBe('3');
            expect(payment.getPreimage).toBe('');
        });
    });

    describe('sign_message permission defaults', () => {
        beforeEach(() => {
            (BackendUtils.supportsMessageSigning as jest.Mock).mockReturnValue(
                true
            );
        });

        it('omits sign_message from the default full-access grant', () => {
            expect(NostrConnectUtils.getFullAccessPermissions()).not.toContain(
                'sign_message'
            );
        });

        it('still advertises sign_message as a supported wallet-service method', () => {
            expect(NostrConnectUtils.getWalletServiceMethods()).toContain(
                'sign_message'
            );
        });

        it('does not advertise sign_message when the backend cannot sign', () => {
            (BackendUtils.supportsMessageSigning as jest.Mock).mockReturnValue(
                false
            );
            expect(NostrConnectUtils.getWalletServiceMethods()).not.toContain(
                'sign_message'
            );
            expect(
                NostrConnectUtils.advertisedConnectionMethods([
                    'get_info',
                    'sign_message'
                ])
            ).toEqual(['get_info']);
        });

        it('keeps Full Access / Read Only selected when sign_message is also granted', () => {
            expect(
                NostrConnectUtils.determinePermissionType(
                    NostrConnectUtils.getFullAccessPermissions()
                )
            ).toBe(PermissionType.FullAccess);
            expect(
                NostrConnectUtils.determinePermissionType([
                    ...NostrConnectUtils.getFullAccessPermissions(),
                    'sign_message'
                ])
            ).toBe(PermissionType.FullAccess);
            expect(
                NostrConnectUtils.determinePermissionType([
                    ...NostrConnectUtils.getReadOnlyPermissions(),
                    'sign_message'
                ])
            ).toBe(PermissionType.ReadOnly);
            expect(
                NostrConnectUtils.determinePermissionType(['sign_message'])
            ).toBe(PermissionType.Custom);
        });

        it('preserves sign_message when clearing a wallet-access preset', () => {
            expect(
                NostrConnectUtils.withPreservedSignMessage(
                    [],
                    [
                        ...NostrConnectUtils.getFullAccessPermissions(),
                        'sign_message'
                    ]
                )
            ).toEqual(['sign_message']);
            expect(
                NostrConnectUtils.withPreservedSignMessage(
                    [],
                    NostrConnectUtils.getFullAccessPermissions()
                )
            ).toEqual([]);
            expect(
                NostrConnectUtils.determinePermissionType(['sign_message'])
            ).toBe(PermissionType.Custom);
        });

        it('preserves sign_message when switching wallet-access presets', () => {
            expect(
                NostrConnectUtils.getPermissionsForType(
                    PermissionType.FullAccess,
                    ['sign_message']
                ).permissions
            ).toEqual([
                ...NostrConnectUtils.getFullAccessPermissions(),
                'sign_message'
            ]);
            expect(
                NostrConnectUtils.getPermissionsForType(
                    PermissionType.ReadOnly,
                    [
                        ...NostrConnectUtils.getFullAccessPermissions(),
                        'sign_message'
                    ]
                ).permissions
            ).toEqual([
                ...NostrConnectUtils.getReadOnlyPermissions(),
                'sign_message'
            ]);
        });

        it('lists sign_message separately from Custom wallet methods', () => {
            expect(
                NostrConnectUtils.getWalletPermissionOptions().map(
                    (permission) => permission.key
                )
            ).not.toContain('sign_message');
            expect(NostrConnectUtils.getSignMessagePermission().key).toBe(
                'sign_message'
            );
        });

        it('accepts only a non-empty string as a sign_message payload', () => {
            expect(NostrConnectUtils.isValidSignMessage(undefined)).toBe(false);
            expect(NostrConnectUtils.isValidSignMessage('')).toBe(false);
            expect(NostrConnectUtils.isValidSignMessage(1)).toBe(false);
            expect(NostrConnectUtils.isValidSignMessage('challenge')).toBe(
                true
            );
        });
    });
});
