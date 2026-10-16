// Submarine swap response verification. Uses the real ecpair, bitcoinjs-lib
// and @scure key material like SwapStore.reverseLockup.test.ts, so the swap
// tree and address are derived exactly as the app derives them.
jest.mock('../stores/Stores');
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: (s: string) => s
}));
jest.mock('../utils/LocaleUtils');
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
jest.mock('@react-native-documents/picker', () => ({
    saveDocuments: jest.fn()
}));
jest.mock('react-native-biometrics', () => ({ BiometryType: {} }));
jest.mock('react-native-encrypted-storage', () => ({
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../utils/BackendUtils', () => ({}));
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
import { address as bitcoinAddress, payments } from 'bitcoinjs-lib';
import { mnemonicToSeedSync } from '@scure/bip39';
import { HDKey } from '@scure/bip32';

import SwapStore from './SwapStore';
import Storage from '../storage';
import Swap from '../models/Swap';
import {
    SWAPS_KEY,
    SWAPS_RESCUE_KEY,
    MAX_SUBMARINE_SWAP_TIMEOUT_BLOCKS,
    buildSubmarineSwapLeaves,
    deriveReverseSwapOutputKey
} from '../utils/SwapUtils';

// BIP39 canonical test mnemonic, used as a swap rescue key
const RESCUE_MNEMONIC =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

// regtest BOLT11 vector: 123 sats
const INVOICE =
    'lnbcrt1230n1pj429x7pp57t97q4awqj3f529snr0pa6senk83sq5pp760qf5a4jzvd7xgwcksdqqcqzzsxqrrsssp57eqtv7vxr46arupna3w4ct0lkf2mqmz9wt044cwkks0rwlnhfr5s9qyyssqragwpwav7nfwv2xyuuamxxj4pnnpzv2hlw7j473repd3sq7st698ta9kmzmygt0w7tmncl56a6mnma0w7e5dlpqd0wy6x3v35rssldspjhh8p0';
const PAYMENT_HASH = Buffer.from(
    'f2cbe057ae04a29a28b098de1eea199d8f1802810fb4f0269dac84c6f8c8762d',
    'hex'
);
// 0.5% service fee and 300 sats of miner fees: the Swaps screen shows
// 123 + 1 + 300 = 424 sats to send
const SUB_INFO = { fees: { percentage: 0.5, minerFees: 300 } };
const EXPECTED_AMOUNT = 424;

const storageBacking = (Storage as any).__store as { [key: string]: string };
const fetchMock = ReactNativeBlobUtil.fetch as jest.Mock;

const OUR_PUBKEY = Buffer.from(
    ECPairFactory(ecc).fromPrivateKey(
        Buffer.from(
            HDKey.fromMasterSeed(mnemonicToSeedSync(RESCUE_MNEMONIC)).derive(
                'm/44/0/0/0/0'
            ).privateKey!
        )
    ).publicKey
);
const SERVER_PUBKEY = Buffer.from(
    ecc.pointFromScalar(Buffer.alloc(32, 2), true)!
);
const OTHER_PUBKEY = Buffer.from(
    ecc.pointFromScalar(Buffer.alloc(32, 3), true)!
);
const UNRELATED_ADDRESS = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';
const TIP = 899900;
const TIMEOUT = 900000;

// what a Boltz-style provider answers for these keys, hash and timeout
const swapDetails = ({
    refundPubKey = OUR_PUBKEY,
    preimageHash = PAYMENT_HASH,
    timeoutBlockHeight = TIMEOUT
} = {}) => {
    const { claimLeaf, refundLeaf } = buildSubmarineSwapLeaves({
        claimPubKey: SERVER_PUBKEY,
        refundPubKey,
        preimageHash,
        timeoutBlockHeight
    });
    const pubkey = deriveReverseSwapOutputKey({
        ourPubKey: refundPubKey,
        serverPubKey: SERVER_PUBKEY,
        claimLeaf,
        refundLeaf
    });
    const address = payments.p2tr({ pubkey }).address!;
    return {
        swapTree: {
            claimLeaf: { version: 192, output: claimLeaf.toString('hex') },
            refundLeaf: { version: 192, output: refundLeaf.toString('hex') }
        },
        address,
        bip21: `bitcoin:${address}?amount=0.00000424&label=Send%20to%20BTC%20lightning`,
        claimPublicKey: SERVER_PUBKEY.toString('hex'),
        timeoutBlockHeight
    };
};

const VALID = swapDetails();
// the swap's own witness program under a non-standard bech32 prefix
const NONSTANDARD_ADDRESS = bitcoinAddress.toBech32(
    Buffer.from(bitcoinAddress.fromBech32(VALID.address).data),
    1,
    'bc1p@example.com?x='
);

const newStore = () => {
    const store = new SwapStore(
        { nodeInfo: { nodeId: 'node-pubkey', isTestNet: false } } as any,
        { settings: {}, implementation: 'lnd' } as any
    );
    store.subInfo = SUB_INFO;
    return store;
};

const storedSwaps = () =>
    storageBacking[SWAPS_KEY] ? JSON.parse(storageBacking[SWAPS_KEY]) : [];

beforeEach(() => {
    for (const key of Object.keys(storageBacking)) delete storageBacking[key];
    jest.clearAllMocks();
});

describe('SwapStore.createSubmarineSwap response verification', () => {
    const create = async (responseOverrides: any = {}, tip: any = TIP) => {
        storageBacking[SWAPS_RESCUE_KEY] = RESCUE_MNEMONIC;
        fetchMock.mockResolvedValueOnce({
            data: JSON.stringify({
                id: 'submarine-swap',
                expectedAmount: EXPECTED_AMOUNT,
                acceptZeroConf: false,
                ...VALID,
                ...responseOverrides
            })
        });
        fetchMock.mockResolvedValue({
            info: () => ({ status: 200 }),
            text: () => String(tip)
        });

        const store = newStore();
        const navigation = { navigate: jest.fn() };
        await store.createSubmarineSwap(INVOICE, navigation);
        return { store, navigation, stored: storedSwaps() };
    };

    const expectAborted = ({ store, navigation, stored }: any) => {
        expect(store.apiError).toBe('views.Swaps.invalidReverseSwapResponse');
        expect(store.loading).toBe(false);
        expect(stored).toHaveLength(0);
        expect(navigation.navigate).not.toHaveBeenCalled();
    };

    it('saves and opens a swap whose tree, address, amount and timeout check out', async () => {
        const { store, navigation, stored } = await create();

        expect(store.apiError).toBe('');
        expect(stored).toHaveLength(1);
        expect(stored[0].address).toBe(VALID.address);
        expect(navigation.navigate).toHaveBeenCalledWith(
            'SwapDetails',
            expect.anything()
        );
        expect(fetchMock).toHaveBeenLastCalledWith(
            'GET',
            'https://mempool.test/api/blocks/tip/height'
        );
    });

    it.each([
        [
            'an unrelated address',
            {
                address: UNRELATED_ADDRESS,
                bip21: `bitcoin:${UNRELATED_ADDRESS}?amount=0.00000424`
            }
        ],
        [
            'the swap address under another prefix',
            {
                address: NONSTANDARD_ADDRESS,
                bip21: `bitcoin:${NONSTANDARD_ADDRESS}?amount=0.00000424`
            }
        ],
        [
            'a swap that refunds another key',
            swapDetails({ refundPubKey: OTHER_PUBKEY })
        ],
        [
            'a swap for another payment hash',
            swapDetails({ preimageHash: Buffer.alloc(32, 9) })
        ],
        [
            'an amount above what the user was shown',
            { expectedAmount: EXPECTED_AMOUNT + 1 }
        ],
        [
            'a malformed claim leaf',
            {
                swapTree: {
                    ...VALID.swapTree,
                    claimLeaf: {
                        version: 192,
                        output: `${VALID.swapTree.claimLeaf.output}zz`
                    }
                }
            }
        ],
        [
            'a malformed server key',
            { claimPublicKey: `${VALID.claimPublicKey}zz` }
        ],
        ['no swap tree', { swapTree: undefined }]
    ])(
        'aborts before saving or offering payment when the provider returns %s',
        async (_, overrides) => {
            expectAborted(await create(overrides));
            // the tip is not looked up for a swap that is already refused
            expect(fetchMock).toHaveBeenCalledTimes(1);
        }
    );

    it.each([
        ['another address', `bitcoin:${UNRELATED_ADDRESS}?amount=0.00000424`],
        ['another amount', `bitcoin:${VALID.address}?amount=1`],
        ['nothing', undefined]
    ])(
        'pays the verified address and amount when the BIP21 URI names %s',
        async (_, bip21) => {
            const { navigation, stored } = await create({ bip21 });

            const expected = `bitcoin:${VALID.address}?amount=0.00000424`;
            expect(stored[0].bip21).toBe(expected);
            expect(
                new Swap(navigation.navigate.mock.calls[0][1].swapData)
                    .qrCodeValue
            ).toBe(expected);
        }
    );

    it.each([1, MAX_SUBMARINE_SWAP_TIMEOUT_BLOCKS])(
        'accepts a timeout %s blocks ahead of the explorer tip',
        async (blocks) => {
            const { stored } = await create(
                swapDetails({ timeoutBlockHeight: TIP + blocks })
            );
            expect(stored).toHaveLength(1);
        }
    );

    it.each([
        ['at the tip', TIP],
        ['behind the tip', TIP - 1],
        ['one block too far off', TIP + MAX_SUBMARINE_SWAP_TIMEOUT_BLOCKS + 1],
        ['about 170 years away', 10000000],
        ['never reached', 499999999]
    ])(
        'aborts a consistent swap whose timeout is %s',
        async (_, timeoutBlockHeight) => {
            expectAborted(await create(swapDetails({ timeoutBlockHeight })));
        }
    );

    it('fails closed when the explorer height is unusable', async () => {
        const { store, navigation, stored } = await create({}, 'not a height');
        expect(store.apiError).toBe(
            'views.SwapDetails.lockupVerificationUnavailable'
        );
        expect(stored).toHaveLength(0);
        expect(navigation.navigate).not.toHaveBeenCalled();
    });

    it('compares the amount with the fees shown when the swap was started', async () => {
        storageBacking[SWAPS_RESCUE_KEY] = RESCUE_MNEMONIC;
        const store = newStore();
        fetchMock.mockImplementationOnce(async () => {
            // new rates arrive while the request is in flight
            store.subInfo = { fees: { percentage: 50, minerFees: 100000 } };
            return {
                data: JSON.stringify({
                    id: 'submarine-swap',
                    ...VALID,
                    expectedAmount: 100000
                })
            };
        });
        const navigation = { navigate: jest.fn() };
        await store.createSubmarineSwap(INVOICE, navigation);

        expectAborted({ store, navigation, stored: storedSwaps() });
    });

    it('refuses the swap when no fee quote was loaded', async () => {
        storageBacking[SWAPS_RESCUE_KEY] = RESCUE_MNEMONIC;
        fetchMock.mockResolvedValueOnce({
            data: JSON.stringify({
                id: 'submarine-swap',
                expectedAmount: EXPECTED_AMOUNT,
                ...VALID
            })
        });
        const store = newStore();
        store.subInfo = {};
        const navigation = { navigate: jest.fn() };
        await store.createSubmarineSwap(INVOICE, navigation);

        expectAborted({ store, navigation, stored: storedSwaps() });
    });
});

describe('Swap.qrCodeValue for a rescued submarine swap', () => {
    it('is undefined, so the swap is not offered for funding', () => {
        // /swap/restore returns no invoice, so the claim leaf's hash can't be
        // tied to a payment to this wallet
        expect(
            new Swap({
                id: 'rescued',
                type: 'Submarine',
                imported: true,
                status: 'invoice.set',
                lockupAddress: UNRELATED_ADDRESS,
                // earlier rescues stored the host's response as sent
                bip21: `bitcoin:${UNRELATED_ADDRESS}?amount=1`
            }).qrCodeValue
        ).toBeUndefined();
    });
});
