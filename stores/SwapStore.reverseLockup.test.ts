// Reverse swap lockup verification. Uses the real ecpair, bitcoinjs-lib
// and @scure key material like SwapStore.rescue.test.ts, so the swap tree
// and lockup address are derived exactly as the app derives them.
jest.mock('../stores/Stores', () => ({}));
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: (s: string) => s
}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (s: string) => s
}));
jest.mock('../utils/UrlUtils', () => ({
    __esModule: true,
    default: { getMempoolApiUrl: () => 'https://mempool.test/api' }
}));
jest.mock('react-native-blob-util', () => ({
    __esModule: true,
    default: {
        fetch: jest.fn(),
        fs: { dirs: { LibraryDir: '/lib', DocumentDir: '/docs' } }
    }
}));
jest.mock('react-native-fs', () => ({
    DownloadDirectoryPath: '/public-downloads',
    DocumentDirectoryPath: '/docs',
    CachesDirectoryPath: '/cache',
    exists: jest.fn().mockResolvedValue(false),
    unlink: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('@react-native-documents/picker', () => ({
    saveDocuments: jest.fn()
}));
jest.mock('react-native-biometrics', () => ({ BiometryType: {} }));
jest.mock('react-native-encrypted-storage', () => ({
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../utils/BackendUtils', () => ({ getPayments: jest.fn() }));
jest.mock('../utils/BiometricUtils', () => ({
    getSupportedBiometryType: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../utils/MigrationUtils', () => ({
    keychainCloudSyncMigration: jest.fn().mockResolvedValue(undefined),
    migrateRgsDefaultToZeus: jest.fn().mockResolvedValue(undefined),
    migrateInvoiceExpiryDisplay: jest.fn().mockResolvedValue(undefined),
    legacySettingsMigrations: jest.fn().mockResolvedValue({}),
    storageMigrationV2: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../utils/TorUtils', () => ({
    doTorRequest: jest.fn(),
    RequestMethod: {}
}));
jest.mock('../utils/LdkNodeUtils', () => ({
    DEFAULT_SCORER_URL: '',
    DEFAULT_VSS_SERVER: '',
    getDefaultEsploraServer: jest.fn().mockReturnValue(''),
    getDefaultRgsServer: jest.fn().mockReturnValue('')
}));
// the invoice check has its own tests in SwapUtils.test.ts; building a
// signed BOLT11 for the derived preimage hash here adds nothing
jest.mock('../utils/SwapUtils', () => ({
    ...jest.requireActual('../utils/SwapUtils'),
    verifyReverseSwapInvoice: jest.fn(() => ({ valid: true }))
}));
jest.mock('../storage', () => {
    const store: { [key: string]: string } = {};
    return {
        __esModule: true,
        default: {
            getItem: jest.fn(async (key: string) => store[key] ?? null),
            setItem: jest.fn(async (key: string, value: string) => {
                store[key] = value;
                return true;
            }),
            __store: store
        }
    };
});

import ReactNativeBlobUtil from 'react-native-blob-util';
import ecc from '@bitcoinerlab/secp256k1';
import { ECPairFactory } from 'ecpair';
import { crypto, payments, Transaction } from 'bitcoinjs-lib';
import { mnemonicToSeedSync } from '@scure/bip39';
import { HDKey } from '@scure/bip32';

import SwapStore from './SwapStore';
import BackendUtils from '../utils/BackendUtils';
import Bolt11Utils from '../utils/Bolt11Utils';
import Storage from '../storage';
import Swap from '../models/Swap';
import {
    REVERSE_SWAPS_KEY,
    SWAPS_RESCUE_KEY,
    buildReverseSwapLeaves,
    deriveReverseSwapOutputKey,
    deriveSwapPreimage
} from '../utils/SwapUtils';

// BIP39 canonical test mnemonic, used as a swap rescue key
const RESCUE_MNEMONIC =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

const storageBacking = (Storage as any).__store as { [key: string]: string };
const fetchMock = ReactNativeBlobUtil.fetch as jest.Mock;

const ECPair = ECPairFactory(ecc);
const childPrivateKey = HDKey.fromMasterSeed(
    mnemonicToSeedSync(RESCUE_MNEMONIC)
).derive('m/44/0/0/0/0').privateKey!;
const OUR_KEYS = ECPair.fromPrivateKey(Buffer.from(childPrivateKey));
const PREIMAGE = deriveSwapPreimage(childPrivateKey);
const SERVER_PUBKEY = Buffer.from(
    ecc.pointFromScalar(Buffer.alloc(32, 2), true)!
);
const OTHER_PUBKEY = Buffer.from(
    ecc.pointFromScalar(Buffer.alloc(32, 3), true)!
);
const TIMEOUT = 900000;

const swapDetails = (ourPubKey: Buffer = Buffer.from(OUR_KEYS.publicKey)) => {
    const { claimLeaf, refundLeaf } = buildReverseSwapLeaves({
        claimPubKey: ourPubKey,
        refundPubKey: SERVER_PUBKEY,
        preimageHash: crypto.sha256(PREIMAGE),
        timeoutBlockHeight: TIMEOUT
    });
    const outputKey = deriveReverseSwapOutputKey({
        ourPubKey,
        serverPubKey: SERVER_PUBKEY,
        claimLeaf,
        refundLeaf
    });
    const { address, output } = payments.p2tr({ pubkey: outputKey });
    return {
        swapTree: {
            claimLeaf: { version: 192, output: claimLeaf.toString('hex') },
            refundLeaf: { version: 192, output: refundLeaf.toString('hex') }
        },
        lockupAddress: address!,
        refundPublicKey: SERVER_PUBKEY.toString('hex'),
        timeoutBlockHeight: TIMEOUT,
        outputScript: Buffer.from(output!)
    };
};

const VALID = swapDetails();
// a correctly formed swap for a key that isn't ours: its address is a
// real taproot address the provider could control
const OTHER_ADDRESS = swapDetails(OTHER_PUBKEY).lockupAddress;

const newStore = () =>
    new SwapStore(
        { nodeInfo: { nodeId: 'node-pubkey', isTestNet: false } } as any,
        { settings: {}, implementation: 'lnd' } as any
    );

beforeEach(() => {
    for (const key of Object.keys(storageBacking)) delete storageBacking[key];
    jest.clearAllMocks();
});

describe('SwapStore.createReverseSwap response verification', () => {
    const INVOICE_AMOUNT = 100000;
    // 0.5% service fee and 700 sats of miner fees: the Swaps screen shows
    // 100000 - 500 - 700 = 98800 sats to receive
    const REVERSE_INFO = {
        fees: { percentage: 0.5, minerFees: { claim: 300, lockup: 400 } }
    };

    const create = async (
        responseOverrides: any = {},
        tip: any = TIMEOUT - 100
    ) => {
        storageBacking[SWAPS_RESCUE_KEY] = RESCUE_MNEMONIC;
        const { outputScript: _outputScript, ...details } = VALID;
        fetchMock.mockResolvedValueOnce({
            data: JSON.stringify({
                id: 'reverse-swap',
                invoice: 'lnbc-provider-invoice',
                onchainAmount: 99100,
                ...details,
                ...responseOverrides
            })
        });
        fetchMock.mockResolvedValue({
            info: () => ({ status: 200 }),
            text: () => String(tip)
        });

        const store = newStore();
        store.reverseInfo = REVERSE_INFO;
        const navigation = { navigate: jest.fn() };
        await store.createReverseSwap(
            'bc1qdestination',
            INVOICE_AMOUNT,
            '2',
            navigation
        );
        const stored = storageBacking[REVERSE_SWAPS_KEY]
            ? JSON.parse(storageBacking[REVERSE_SWAPS_KEY])
            : [];
        return { store, navigation, stored };
    };

    it('saves and opens a swap whose tree, address and amount check out', async () => {
        const { store, navigation, stored } = await create();

        expect(store.apiError).toBe('');
        expect(stored).toHaveLength(1);
        expect(navigation.navigate).toHaveBeenCalledWith(
            'SwapDetails',
            expect.anything()
        );
    });

    it.each([TIMEOUT + 1, TIMEOUT, TIMEOUT - 1, TIMEOUT - 5])(
        'does not save or offer payment when the explorer tip is %s',
        async (tip) => {
            const { store, navigation, stored } = await create({}, tip);
            expect(store.apiError).toBe(
                'views.Swaps.invalidReverseSwapResponse'
            );
            expect(store.loading).toBe(false);
            expect(stored).toHaveLength(0);
            expect(navigation.navigate).not.toHaveBeenCalled();
        }
    );

    it('fails closed before payment when the explorer height is unusable', async () => {
        const { navigation, stored } = await create({}, 'not a height');
        expect(stored).toHaveLength(0);
        expect(navigation.navigate).not.toHaveBeenCalled();
    });

    it.each([
        [
            'a lockup address the provider controls',
            { lockupAddress: OTHER_ADDRESS }
        ],
        [
            'a claim leaf for another key',
            { swapTree: swapDetails(OTHER_PUBKEY).swapTree }
        ],
        [
            'an on-chain amount below what the user was shown',
            { onchainAmount: 1000 }
        ],
        ['no swap tree', { swapTree: undefined }]
    ])(
        'aborts before saving or paying when the provider returns %s',
        async (_, overrides) => {
            const { store, navigation, stored } = await create(overrides);

            expect(store.apiError).toBe(
                'views.Swaps.invalidReverseSwapResponse'
            );
            expect(store.loading).toBe(false);
            expect(stored).toHaveLength(0);
            expect(navigation.navigate).not.toHaveBeenCalled();
        }
    );
});

describe('SwapStore.verifyReverseLockup', () => {
    const ONCHAIN_AMOUNT = 99100;

    // a stored swap: keys and preimage in their JSON shapes
    const storedSwap = (overrides: any = {}) => {
        const { outputScript: _outputScript, ...details } = VALID;
        return new Swap(
            JSON.parse(
                JSON.stringify({
                    id: 'reverse-swap',
                    type: 'reverse',
                    keys: OUR_KEYS,
                    preimage: PREIMAGE,
                    onchainAmount: ONCHAIN_AMOUNT,
                    ...details,
                    ...overrides
                })
            )
        );
    };

    // the provider's websocket supplies this hex; only its txid is used
    const lockupTx = () => {
        const tx = new Transaction();
        tx.addInput(Buffer.alloc(32, 1), 0);
        tx.addOutput(VALID.outputScript, ONCHAIN_AMOUNT);
        return tx;
    };
    const LOCKUP_TX = lockupTx();

    const esplora = (
        status: number,
        body: any = {
            txid: LOCKUP_TX.getId(),
            vout: [
                {
                    scriptpubkey: VALID.outputScript.toString('hex'),
                    value: ONCHAIN_AMOUNT
                }
            ],
            status: { confirmed: true }
        }
    ) => {
        fetchMock.mockImplementation(async (_method: string, url: string) => {
            if (url.endsWith('/blocks/tip/height')) {
                return {
                    info: () => ({ status: 200 }),
                    text: () => String(TIMEOUT - 100)
                };
            }
            if (url.includes('/outspend/')) {
                return {
                    info: () => ({ status: 200 }),
                    json: () => ({ spent: false })
                };
            }
            return { info: () => ({ status }), json: () => body };
        });
    };

    const verify = (swap = storedSwap(), hex = LOCKUP_TX.toHex()) =>
        newStore().verifyReverseLockup(swap, hex);

    it('allows the claim for a confirmed, fully funded lockup', async () => {
        esplora(200);
        await expect(verify()).resolves.toEqual({ status: 'ok' });
    });

    it('looks the lockup up on the mempool instance, not the provider', async () => {
        esplora(200);
        await verify();
        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(fetchMock).toHaveBeenCalledWith(
            'GET',
            `https://mempool.test/api/tx/${LOCKUP_TX.getId()}`
        );
        expect(fetchMock).toHaveBeenCalledWith(
            'GET',
            `https://mempool.test/api/tx/${LOCKUP_TX.getId()}/outspend/0`
        );
        expect(fetchMock).toHaveBeenCalledWith(
            'GET',
            'https://mempool.test/api/blocks/tip/height'
        );
    });

    it.each([false, true])(
        'refuses a spent output (spend confirmed: %s)',
        async (confirmed) => {
            esplora(200);
            const fetch = fetchMock.getMockImplementation()!;
            fetchMock.mockImplementation(async (method, url) =>
                url.includes('/outspend/')
                    ? {
                          info: () => ({ status: 200 }),
                          json: () => ({ spent: true, status: { confirmed } })
                      }
                    : fetch(method, url)
            );
            await expect(verify()).resolves.toEqual({
                status: 'invalid',
                reason: 'lockup-spent'
            });
        }
    );

    it.each([{}, { spent: 'false' }, null])(
        'fails closed on malformed outspend data %j',
        async (body) => {
            esplora(200);
            const fetch = fetchMock.getMockImplementation()!;
            fetchMock.mockImplementation(async (method, url) =>
                url.includes('/outspend/')
                    ? { info: () => ({ status: 200 }), json: () => body }
                    : fetch(method, url)
            );
            await expect(verify()).resolves.toMatchObject({
                status: 'unavailable'
            });
        }
    );

    it.each([TIMEOUT + 1, TIMEOUT, TIMEOUT - 1, TIMEOUT - 5])(
        'refuses a deadline too close to fresh tip %s, including rescued swaps',
        async (tip) => {
            esplora(200);
            const fetch = fetchMock.getMockImplementation()!;
            fetchMock.mockImplementation(async (method, url) =>
                url.endsWith('/blocks/tip/height')
                    ? { info: () => ({ status: 200 }), text: () => String(tip) }
                    : fetch(method, url)
            );
            await expect(verify()).resolves.toEqual({
                status: 'invalid',
                reason: 'refund-deadline'
            });
            await expect(
                verify(storedSwap({ timeoutBlockHeight: undefined }))
            ).resolves.toEqual({
                status: 'invalid',
                reason: 'refund-deadline'
            });
        }
    );

    it('allows exactly six blocks before the refund deadline', async () => {
        esplora(200);
        const fetch = fetchMock.getMockImplementation()!;
        fetchMock.mockImplementation(async (method, url) =>
            url.endsWith('/blocks/tip/height')
                ? {
                      info: () => ({ status: 200 }),
                      text: () => String(TIMEOUT - 6)
                  }
                : fetch(method, url)
        );
        await expect(verify()).resolves.toEqual({ status: 'ok' });
    });

    it('checks the first matching output at its actual index, not a later unspent duplicate', async () => {
        const tx = new Transaction();
        tx.addInput(Buffer.alloc(32, 1), 0);
        tx.addOutput(Buffer.from('0014' + '00'.repeat(20), 'hex'), 1000);
        tx.addOutput(VALID.outputScript, ONCHAIN_AMOUNT);
        tx.addOutput(VALID.outputScript, ONCHAIN_AMOUNT);
        esplora(200, {
            txid: tx.getId(),
            vout: tx.outs.map((out) => ({
                scriptpubkey: out.script.toString('hex'),
                value: out.value
            })),
            status: { confirmed: true }
        });
        const fetch = fetchMock.getMockImplementation()!;
        fetchMock.mockImplementation(async (method, url) =>
            url.endsWith('/outspend/1')
                ? {
                      info: () => ({ status: 200 }),
                      json: () => ({ spent: true })
                  }
                : fetch(method, url)
        );
        await expect(verify(storedSwap(), tx.toHex())).resolves.toEqual({
            status: 'invalid',
            reason: 'lockup-spent'
        });
        expect(fetchMock).toHaveBeenCalledWith(
            'GET',
            `https://mempool.test/api/tx/${tx.getId()}/outspend/1`
        );
    });

    it.each(['', 'NaN', '-1', '1.5', '0', 'null'])(
        'retries rather than claiming with invalid height %j',
        async (height) => {
            esplora(200);
            const fetch = fetchMock.getMockImplementation()!;
            fetchMock.mockImplementation(async (method, url) =>
                url.endsWith('/blocks/tip/height')
                    ? { info: () => ({ status: 200 }), text: () => height }
                    : fetch(method, url)
            );
            await expect(verify()).resolves.toMatchObject({
                status: 'unavailable'
            });
        }
    );

    it.each(['/outspend/0', '/blocks/tip/height'])(
        'retries when %s is unavailable',
        async (path) => {
            esplora(200);
            const fetch = fetchMock.getMockImplementation()!;
            fetchMock.mockImplementation(async (method, url) =>
                url.endsWith(path)
                    ? { info: () => ({ status: 503 }) }
                    : fetch(method, url)
            );
            await expect(verify()).resolves.toMatchObject({
                status: 'unavailable'
            });
        }
    );

    it.each(['/outspend/0', '/blocks/tip/height'])(
        'retries when %s rejects',
        async (path) => {
            esplora(200);
            const fetch = fetchMock.getMockImplementation()!;
            fetchMock.mockImplementation(async (method, url) => {
                if (url.endsWith(path)) throw new Error('offline');
                return fetch(method, url);
            });
            await expect(verify()).resolves.toMatchObject({
                status: 'unavailable'
            });
        }
    );

    it('waits on a fabricated lockup the mempool instance has never seen', async () => {
        // the report's case: syntactically valid hex, never broadcast
        esplora(404, 'Transaction not found');
        await expect(verify()).resolves.toEqual({
            status: 'unconfirmed',
            reason: 'lockup-not-found'
        });
    });

    it('waits on a lockup that is not confirmed yet', async () => {
        esplora(200, {
            vout: [
                {
                    scriptpubkey: VALID.outputScript.toString('hex'),
                    value: ONCHAIN_AMOUNT
                }
            ],
            status: { confirmed: false }
        });
        await expect(verify()).resolves.toEqual({ status: 'unconfirmed' });
    });

    it('refuses a lockup that pays less than the swap amount', async () => {
        esplora(200, {
            vout: [
                {
                    scriptpubkey: VALID.outputScript.toString('hex'),
                    value: 1000
                }
            ],
            status: { confirmed: true }
        });
        await expect(verify()).resolves.toEqual({
            status: 'invalid',
            reason: 'underfunded'
        });
    });

    it('refuses a lockup with no output to the swap', async () => {
        esplora(200, {
            vout: [{ scriptpubkey: '0014' + '00'.repeat(20), value: 99100 }],
            status: { confirmed: true }
        });
        await expect(verify()).resolves.toEqual({
            status: 'invalid',
            reason: 'missing-output'
        });
    });

    it.each([
        ['an HTTP error', () => esplora(500, 'error')],
        [
            'a network failure',
            () => fetchMock.mockRejectedValue(new Error('offline'))
        ]
    ])('fails closed and retries on %s', async (_, setup) => {
        setup();
        await expect(verify()).resolves.toMatchObject({
            status: 'unavailable'
        });
    });

    it('refuses a stored swap whose lockup address is not its tree, without a lookup', async () => {
        esplora(200);
        await expect(
            verify(storedSwap({ lockupAddress: OTHER_ADDRESS }))
        ).resolves.toEqual({
            status: 'invalid',
            reason: 'lockup-address-mismatch'
        });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('refuses a key fromPrivateKey rejects, without throwing or a lookup', async () => {
        esplora(200);
        const swap = storedSwap();
        // out of range: the curve order n
        swap.keys = {
            __D: Buffer.from(
                'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141',
                'hex'
            )
        } as any;
        await expect(verify(swap)).resolves.toEqual({
            status: 'invalid',
            reason: 'invalid-key'
        });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('refuses undecodable lockup hex', async () => {
        esplora(200);
        await expect(verify(storedSwap(), 'zz')).resolves.toEqual({
            status: 'invalid',
            reason: 'undecodable-lockup'
        });
    });

    it('accepts the live key and preimage shapes the creation screen passes', async () => {
        esplora(200);
        const swap = storedSwap();
        swap.keys = OUR_KEYS;
        swap.preimage = PREIMAGE as any;
        await expect(verify(swap)).resolves.toEqual({ status: 'ok' });
    });

    describe('a rescued swap, which has no on-chain amount', () => {
        const getPayments = BackendUtils.getPayments as jest.Mock;
        const PAYMENT_HASH = crypto.sha256(PREIMAGE).toString('hex');
        // 90% of a 100000-sat payment
        const FLOOR = 90000;

        const rescuedSwap = () =>
            storedSwap({
                imported: true,
                swapTree: undefined,
                refundPublicKey: undefined,
                timeoutBlockHeight: undefined,
                onchainAmount: undefined,
                tree: VALID.swapTree,
                serverPublicKey: VALID.refundPublicKey
            });

        const lockedUp = (value: number) =>
            esplora(200, {
                vout: [
                    {
                        scriptpubkey: VALID.outputScript.toString('hex'),
                        value
                    }
                ],
                status: { confirmed: true }
            });

        const paid = (payment: any = {}) =>
            getPayments.mockResolvedValue({
                payments: [
                    { payment_hash: 'ab'.repeat(32), value_sat: '500' },
                    {
                        payment_hash: PAYMENT_HASH,
                        value_sat: '100000',
                        status: 'IN_FLIGHT',
                        ...payment
                    }
                ]
            });

        const shortOf = (paidAmount: number, amount: number) => ({
            status: 'confirm-amount',
            amount,
            paidAmount
        });

        it.each([1000, 0, 99100])(
            'ignores a legacy imported onchainAmount of %s',
            async (onchainAmount) => {
                paid();
                lockedUp(1000);
                const swap = rescuedSwap();
                swap.onchainAmount = onchainAmount;
                await expect(verify(swap)).resolves.toEqual(
                    shortOf(100000, 1000)
                );
                expect(getPayments).toHaveBeenCalled();
                await expect(
                    newStore().verifyReverseLockup(swap, LOCKUP_TX.toHex(), {
                        confirmedLockupAmount: 1000
                    })
                ).resolves.toEqual({ status: 'ok' });
            }
        );

        it.each([99100, FLOOR])(
            'claims a lockup of %s sats against a payment of 100000 sats',
            async (value) => {
                paid();
                lockedUp(value);
                await expect(verify(rescuedSwap())).resolves.toEqual({
                    status: 'ok'
                });
            }
        );

        it.each([1000, FLOOR - 1])(
            'asks before claiming a lockup of %s sats against a payment of 100000 sats',
            async (value) => {
                // the host trades a small lockup for the preimage that
                // settles the whole Lightning payment
                paid();
                lockedUp(value);
                await expect(verify(rescuedSwap())).resolves.toEqual(
                    shortOf(100000, value)
                );
            }
        );

        it.each([
            // a fixed sat allowance would have let these through
            [10000, 1000, false],
            [10000, 8999, false],
            [10000, 9000, true],
            [25000, 22499, false],
            [25000, 22500, true]
        ])(
            'against a payment of %s sats, a lockup of %s sats is claimed without asking: %s',
            async (payment, value, claims) => {
                paid({ value_sat: String(payment) });
                lockedUp(value);
                await expect(verify(rescuedSwap())).resolves.toEqual(
                    claims ? { status: 'ok' } : shortOf(payment, value)
                );
            }
        );

        it('reads a payment amount given in msat', async () => {
            paid({ value_sat: undefined, amount_msat: '100000000msat' });
            lockedUp(1000);
            await expect(verify(rescuedSwap())).resolves.toEqual(
                shortOf(100000, 1000)
            );
        });

        it('takes the amount from the invoice when the payment record has none', async () => {
            // CLN sums amount_msat only over completed parts
            paid({
                value_sat: undefined,
                amount_msat: '0',
                bolt11: 'lnbc-pending'
            });
            const decode = jest
                .spyOn(Bolt11Utils, 'decode')
                .mockReturnValue({ satoshis: 100000 } as any);
            lockedUp(1000);
            await expect(verify(rescuedSwap())).resolves.toEqual(
                shortOf(100000, 1000)
            );
            expect(decode).toHaveBeenCalledWith('lnbc-pending');
            decode.mockRestore();
        });

        it('asks for confirmation, with the lockup amount, when the wallet has no payment for it', async () => {
            getPayments.mockResolvedValue({
                payments: [{ payment_hash: 'ab'.repeat(32), value_sat: '1' }]
            });
            lockedUp(1000);
            await expect(verify(rescuedSwap())).resolves.toEqual({
                status: 'confirm-amount',
                amount: 1000
            });
        });

        it('still refuses an invalid lockup before asking for confirmation', async () => {
            getPayments.mockResolvedValue({ payments: [] });
            esplora(200, {
                vout: [
                    {
                        scriptpubkey: VALID.outputScript.toString('hex'),
                        value: 1000
                    }
                ],
                status: { confirmed: false }
            });
            await expect(verify(rescuedSwap())).resolves.toEqual({
                status: 'unconfirmed'
            });
        });

        it('claims once the user confirms the amount', async () => {
            getPayments.mockResolvedValue({ payments: [] });
            lockedUp(1000);
            await expect(
                newStore().verifyReverseLockup(
                    rescuedSwap(),
                    LOCKUP_TX.toHex(),
                    { confirmedLockupAmount: 1000 }
                )
            ).resolves.toEqual({ status: 'ok' });
            expect(getPayments).not.toHaveBeenCalled();
        });

        it('refuses a lockup below the amount the user confirmed', async () => {
            lockedUp(999);
            await expect(
                newStore().verifyReverseLockup(
                    rescuedSwap(),
                    LOCKUP_TX.toHex(),
                    { confirmedLockupAmount: 1000 }
                )
            ).resolves.toEqual({ status: 'invalid', reason: 'underfunded' });
        });

        it('retries when the payments cannot be listed', async () => {
            getPayments.mockRejectedValue(new Error('offline'));
            lockedUp(99100);
            await expect(verify(rescuedSwap())).resolves.toEqual({
                status: 'unavailable',
                reason: 'payment-lookup-failed'
            });
        });

        it('does not look up payments for a swap with an on-chain amount', async () => {
            esplora(200);
            await expect(verify()).resolves.toEqual({ status: 'ok' });
            expect(getPayments).not.toHaveBeenCalled();
        });
    });
});
