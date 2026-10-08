jest.mock('react-native-blob-util', () => ({ fetch: jest.fn() }));
jest.mock('react-native-notifications', () => ({ Notifications: {} }));
jest.mock('socket.io-client', () => ({ io: jest.fn() }));
jest.mock('nostr-tools', () => ({
    getPublicKey: jest.fn(),
    SimplePool: jest.fn()
}));
jest.mock('./CashuStore', () => ({}));
jest.mock('./NodeInfoStore', () => ({}));
jest.mock('./SettingsStore', () => ({}));
jest.mock('../utils/BackendUtils', () => ({}));
jest.mock('../utils/LocaleUtils', () => ({ localeString: (s: string) => s }));
jest.mock('../storage', () => ({
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(true),
    removeItem: jest.fn().mockResolvedValue(true)
}));

import ReactNativeBlobUtil from 'react-native-blob-util';
import LightningAddressStore from './LightningAddressStore';
import Bolt11Utils from '../utils/Bolt11Utils';

const newStore = (settings: any = {}) =>
    new LightningAddressStore(
        {
            cashuWallets: { 'https://mint.test': { pubkey: '02ab' } }
        } as any,
        { nodeInfo: { identity_pubkey: '03cd' } } as any,
        {
            settings,
            updateSettings: jest.fn().mockResolvedValue(undefined)
        } as any
    );

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

describe('LightningAddressStore', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => jest.restoreAllMocks());

    describe('redeemAllOpenPaymentsZaplocker', () => {
        const paid = [
            { hash: 'h1', amount_msat: 1000, comment: 'a' },
            { hash: 'h2', amount_msat: 2000, comment: 'b' },
            { hash: 'h3', amount_msat: 3000, comment: 'c' }
        ];

        it('redeems every payment with attestation checks disabled and clears redeemingAll', async () => {
            const store = newStore({
                lightningAddress: { automaticallyAcceptAttestationLevel: 0 }
            });
            store.paid = paid;
            const redeem = jest
                .spyOn(store, 'lookupPreimageAndRedeemZaplocker')
                .mockResolvedValue(true as any);
            const lookup = jest.spyOn(store, 'lookupAttestations');
            const status = jest
                .spyOn(store, 'status')
                .mockResolvedValue(undefined as any);

            await store.redeemAllOpenPaymentsZaplocker();

            expect(lookup).not.toHaveBeenCalled();
            expect(redeem.mock.calls.map((c) => c[0])).toEqual([
                'h1',
                'h2',
                'h3'
            ]);
            expect(store.redeemingAll).toBe(false);
            expect(status).toHaveBeenCalledWith(true);
        });

        it('keeps going after a failed redeem and still clears redeemingAll', async () => {
            const store = newStore({
                lightningAddress: { automaticallyAcceptAttestationLevel: 0 }
            });
            store.paid = paid;
            const redeem = jest
                .spyOn(store, 'lookupPreimageAndRedeemZaplocker')
                .mockResolvedValueOnce(true as any)
                .mockRejectedValueOnce(new Error('lookupInvoice failed'))
                .mockResolvedValueOnce(true as any);
            jest.spyOn(store, 'status').mockRejectedValue(
                new Error('server unreachable')
            );

            await store.redeemAllOpenPaymentsZaplocker();
            await flushPromises();

            expect(redeem).toHaveBeenCalledTimes(3);
            expect(store.redeemingAll).toBe(false);
            expect(console.log).toHaveBeenCalledWith(
                'Error redeeming payment',
                expect.any(Error)
            );
            expect(console.log).toHaveBeenCalledWith(
                'Error fetching Lightning address status',
                expect.any(Error)
            );
        });

        it('checks attestations at level 2 when the setting is missing', async () => {
            const store = newStore({ lightningAddress: {} });
            store.paid = paid;
            const lookup = jest
                .spyOn(store, 'lookupAttestations')
                .mockResolvedValueOnce({ status: 'success' } as any)
                .mockResolvedValueOnce({ status: 'error' } as any)
                .mockResolvedValueOnce({ status: 'warning' } as any);
            const redeem = jest
                .spyOn(store, 'lookupPreimageAndRedeemZaplocker')
                .mockResolvedValue(true as any);
            jest.spyOn(store, 'status').mockResolvedValue(undefined as any);

            await store.redeemAllOpenPaymentsZaplocker();

            expect(lookup).toHaveBeenCalledTimes(3);
            expect(redeem.mock.calls.map((c) => c[0])).toEqual(['h1', 'h3']);
            expect(store.redeemingAll).toBe(false);
        });
    });

    describe('createCashu', () => {
        const mockCreateResponse = () =>
            (ReactNativeBlobUtil.fetch as jest.Mock).mockResolvedValue({
                info: () => ({ status: 200 }),
                json: () => ({
                    success: true,
                    handle: 'satoshi',
                    domain: 'zeuspay.com'
                })
            });

        it('resolves and handles a failed push credential update', async () => {
            const store = newStore();
            jest.spyOn(store as any, 'getAuthData').mockResolvedValue({
                verification: 'v',
                signature: 's'
            });
            mockCreateResponse();
            jest.spyOn(store, 'updatePushCredentials').mockRejectedValue(
                new Error('update failed')
            );

            await expect(
                store.createCashu('https://mint.test')
            ).resolves.toEqual({ success: true });
            await flushPromises();

            expect(store.loading).toBe(false);
            expect(console.log).toHaveBeenCalledWith(
                'Failed to update push credentials',
                expect.any(Error)
            );
        });
    });

    // FEES in zeus-pay routes/lnurl.js
    const liveServerFees = [
        {
            limitAmount: 1,
            limitQualifier: 'gte',
            feeQualifier: 'percentage',
            fee: 0
        }
    ];

    describe('calculateFeeMsat', () => {
        const feeFor = (fees: any, amountMsat: number) => {
            const store = newStore();
            store.fees = fees;
            return (store as any).calculateFeeMsat(amountMsat);
        };

        it('returns 0 for a 0 sat fixed tier', () => {
            expect(
                feeFor(
                    [
                        {
                            limitAmount: 100000,
                            limitQualifier: 'lt',
                            fee: 0,
                            feeQualifier: 'fixedSats'
                        }
                    ],
                    50000000
                )
            ).toBe(0);
        });

        it('returns 0 for a 0% percentage tier', () => {
            expect(
                feeFor(
                    [
                        {
                            limitAmount: 0,
                            limitQualifier: 'gte',
                            fee: 0,
                            feeQualifier: 'percentage'
                        }
                    ],
                    50000000
                )
            ).toBe(0);
        });

        it('returns a nonzero fixed tier fee in msat', () => {
            expect(
                feeFor(
                    [
                        {
                            limitAmount: 100000,
                            limitQualifier: 'lte',
                            fee: 10,
                            feeQualifier: 'fixedSats'
                        }
                    ],
                    50000000
                )
            ).toBe(10000);
        });

        it('returns a nonzero percentage tier fee in msat', () => {
            expect(
                feeFor(
                    [
                        {
                            limitAmount: 100000,
                            limitQualifier: 'gt',
                            fee: 0.5,
                            feeQualifier: 'percentage'
                        }
                    ],
                    200000000
                )
            ).toBe(1000000);
        });

        it('returns undefined before status has loaded the fee tiers', () => {
            expect(feeFor({}, 50000000)).toBeUndefined();
        });

        it('falls back to 250 sats when loaded tiers have no match', () => {
            expect(
                feeFor(
                    [
                        {
                            limitAmount: 1000,
                            limitQualifier: 'lt',
                            fee: 1,
                            feeQualifier: 'fixedSats'
                        }
                    ],
                    50000000
                )
            ).toBe(250000);
        });

        it('returns 0 for the live ZEUS Pay tier (gte 1 sat, 0%)', () => {
            expect(feeFor(liveServerFees, 50000000)).toBe(0);
        });

        it('uses the first matching tier in array order when tiers overlap', () => {
            const fees = [
                {
                    limitAmount: 100000,
                    limitQualifier: 'lt',
                    fee: 0,
                    feeQualifier: 'fixedSats'
                },
                {
                    limitAmount: 0,
                    limitQualifier: 'gte',
                    fee: 1,
                    feeQualifier: 'percentage'
                }
            ];
            // 50k sats matches both tiers: the first one (0 sats) wins
            expect(feeFor(fees, 50000000)).toBe(0);
            // 200k sats only matches the second tier
            expect(feeFor(fees, 200000000)).toBe(2000000);
        });
    });

    describe('analyzeAttestation', () => {
        const analyze = (
            fees: any,
            invoiceMsat: string,
            amountMsat: number
        ) => {
            const store = newStore();
            store.fees = fees;
            jest.spyOn(Bolt11Utils, 'decode').mockReturnValue({
                payment_hash: 'hash',
                millisatoshis: invoiceMsat
            } as any);
            return (store as any).analyzeAttestation(
                { content: 'lnbc' },
                'hash',
                amountMsat
            );
        };

        it('accepts an invoice equal to the amount under the live tier', () => {
            const attestation = analyze(liveServerFees, '50000000', 50000000);
            expect(attestation.feeMsat).toBe(0);
            expect(attestation.isAmountValid).toBe(true);
            expect(attestation.isValid).toBe(true);
        });

        it('rejects an invoice padded with 250 sats under the live tier', () => {
            const attestation = analyze(liveServerFees, '50250000', 50000000);
            expect(attestation.isAmountValid).toBe(false);
            expect(attestation.isValid).toBe(false);
        });

        it('accepts the 250 sat fallback when loaded tiers have no match', () => {
            const attestation = analyze(
                [
                    {
                        limitAmount: 1000,
                        limitQualifier: 'lt',
                        fee: 1,
                        feeQualifier: 'fixedSats'
                    }
                ],
                '50250000',
                50000000
            );
            expect(attestation.feeMsat).toBe(250000);
            expect(attestation.isAmountValid).toBe(true);
        });

        it('fails closed without throwing when fee tiers are not loaded', () => {
            const attestation = analyze({}, '50250000', 50000000);
            expect(attestation.feeMsat).toBeUndefined();
            expect(attestation.isValidLightningInvoice).toBe(true);
            expect(attestation.isHashValid).toBe(true);
            expect(attestation.isAmountValid).toBe(false);
            expect(attestation.isValid).toBe(false);
        });
    });
});
