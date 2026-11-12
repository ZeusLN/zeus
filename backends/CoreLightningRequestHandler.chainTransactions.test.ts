const mockPostRequest = jest.fn();
const mockSupportsSplicing = jest.fn(() => true);

// the handler constructs its CLNRest instance at import time, so postRequest
// has to resolve the mock lazily
jest.mock('./CLNRest', () => ({
    __esModule: true,
    default: class {
        postRequest(...args: Array<any>) {
            return mockPostRequest(...args);
        }
        supportsSplicing() {
            return mockSupportsSplicing();
        }
    }
}));
// AddressUtils is not mocked here: these tests cover the addresses it
// derives from listtransactions outputs, on the connected node's network
jest.mock('react-native-encrypted-storage', () => ({
    setItem: jest.fn(() => Promise.resolve()),
    getItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
    clear: jest.fn(() => Promise.resolve())
}));
jest.mock('../stores/Stores');

import {
    getChainTransactions,
    getSpliceHistory
} from './CoreLightningRequestHandler';
import { nodeInfoStore } from '../stores/Stores';

const TXID = 'ab'.repeat(32);

// One wallet deposit whose transaction has the P2WPKH, P2WSH and P2TR output
// scripts from the BIP173 and BIP350 test vectors
const respond = () =>
    mockPostRequest.mockImplementation((route: string) => {
        if (route === '/v1/sql')
            return Promise.resolve({
                rows: [['wallet', 'deposit', `${TXID}:0`, 21000000, 0, 1, 95]]
            });
        if (route === '/v1/listtransactions')
            return Promise.resolve({
                transactions: [
                    {
                        hash: TXID,
                        outputs: [
                            {
                                scriptPubKey:
                                    '0014751e76e8199196d454941c45d1b3a323f1433bd6'
                            },
                            {
                                scriptPubKey:
                                    '00201863143c14c5166804bd19203356da136c985678cd4d27a1b8c6329604903262'
                            },
                            {
                                scriptPubKey:
                                    '512079be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'
                            }
                        ]
                    }
                ]
            });
        if (route === '/v1/getinfo')
            return Promise.resolve({ blockheight: 100 });
        return Promise.reject(new Error(`unexpected route ${route}`));
    });

describe('CoreLightningRequestHandler.getChainTransactions', () => {
    const originalNodeInfo = nodeInfoStore.nodeInfo;
    afterEach(() => {
        (nodeInfoStore as any).nodeInfo = originalNodeInfo;
    });

    it.each([
        [
            'mainnet',
            {},
            [
                'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
                'bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3',
                'bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0'
            ]
        ],
        // CLN reports signet as network: 'signet'
        [
            'signet',
            { isSigNet: true },
            [
                'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
                'tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7',
                'tb1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vq47zagq'
            ]
        ]
    ])(
        'sets the %s destination addresses of a deposit',
        async (_name, nodeInfo, addresses) => {
            (nodeInfoStore as any).nodeInfo = nodeInfo;
            respond();

            const { transactions } = await getChainTransactions();

            expect(transactions).toHaveLength(1);
            expect(transactions[0]).toMatchObject({
                txid: TXID,
                dest_addresses: addresses
            });
        }
    );
});

describe('CoreLightningRequestHandler splices', () => {
    const SPLICE = 'cd'.repeat(32);
    const OLD_FUNDING = 'ef'.repeat(32);
    const CHANNEL = '38'.repeat(32);

    // The splice query's rows: account, tag, outpoint, credit_msat,
    // debit_msat, txid, blockheight, timestamp. The old funding output's
    // spend is channel_close keyed by that output with the splice as its
    // txid; the new funding output is channel_open on the splice
    const spendsOldFunding = [
        CHANNEL,
        'channel_close',
        `${OLD_FUNDING}:0`,
        0,
        1_000_000_000,
        SPLICE,
        120,
        5000
    ];
    const createsNewFunding = (capacityMsat: number) => [
        CHANNEL,
        'channel_open',
        `${SPLICE}:0`,
        capacityMsat,
        0,
        null,
        120,
        5000
    ];
    const walletDeposit = (msat: number) => [
        'wallet',
        'deposit',
        `${SPLICE}:1`,
        msat,
        0,
        null,
        120,
        5000
    ];
    const walletSpend = (msat: number) => [
        'wallet',
        'withdrawal',
        `${'aa'.repeat(32)}:1`,
        0,
        msat,
        SPLICE,
        120,
        5000
    ];

    const isSpliceQuery = (body: any) =>
        body?.query?.includes("tag IN ('channel_open', 'channel_close')");
    const respond = (
        spliceRows: Array<any> | Error,
        listed: Array<any> = [{ hash: SPLICE, outputs: [] }]
    ) =>
        mockPostRequest.mockImplementation((route: string, body: any) => {
            if (route === '/v1/sql') {
                if (!isSpliceQuery(body)) return Promise.resolve({ rows: [] });
                return spliceRows instanceof Error
                    ? Promise.reject(spliceRows)
                    : Promise.resolve({ rows: spliceRows });
            }
            if (route === '/v1/listtransactions')
                return Promise.resolve({ transactions: listed });
            if (route === '/v1/getinfo')
                return Promise.resolve({ blockheight: 122 });
            return Promise.reject(new Error(`unexpected route ${route}`));
        });

    // as alice's node recorded a 100,000 splice-in on regtest
    const spliceIn = [
        walletSpend(3_499_690_000),
        walletDeposit(3_399_432_000),
        spendsOldFunding,
        createsNewFunding(1_100_000_000)
    ];

    beforeEach(() => {
        mockPostRequest.mockReset();
        mockSupportsSplicing.mockReturnValue(true);
    });

    describe('getChainTransactions', () => {
        it('lists a splice-in by the coins it spent less its change', async () => {
            respond(spliceIn);

            const { transactions } = await getChainTransactions();

            expect(transactions).toEqual([
                expect.objectContaining({
                    txid: SPLICE,
                    amount: -100258,
                    block_height: 120,
                    num_confirmations: 3
                })
            ]);
        });

        it('lists a splice-out by what it paid to the wallet', async () => {
            respond([
                walletDeposit(50_000_000),
                spendsOldFunding,
                createsNewFunding(949_812_000)
            ]);

            const { transactions } = await getChainTransactions();

            expect(transactions).toEqual([
                expect.objectContaining({ txid: SPLICE, amount: 50000 })
            ]);
        });

        it("leaves out the peer's splice when it didn't touch the wallet", async () => {
            respond([spendsOldFunding, createsNewFunding(1_080_000_000)]);

            const { transactions } = await getChainTransactions();

            expect(transactions).toEqual([]);
        });

        it('still leaves out a channel open, which spends no funding output', async () => {
            respond([
                walletSpend(1_000_200_000),
                walletDeposit(40_000_000),
                createsNewFunding(960_000_000)
            ]);

            const { transactions } = await getChainTransactions();

            expect(transactions).toEqual([]);
        });

        it('lists the rest as before when the splice query fails', async () => {
            respond(new Error('no such column: txid'));

            const { transactions } = await getChainTransactions();

            expect(transactions).toEqual([]);
        });

        it('asks nothing more of a node that cannot splice', async () => {
            mockSupportsSplicing.mockReturnValue(false);
            respond(spliceIn);

            await getChainTransactions();

            expect(
                mockPostRequest.mock.calls.some(([, body]) =>
                    isSpliceQuery(body)
                )
            ).toBe(false);
        });
    });

    describe('getSpliceHistory', () => {
        it('records our splice-in with what went into the channel', async () => {
            respond(spliceIn);

            const { splices } = await getSpliceHistory();

            expect(splices).toEqual([
                {
                    userChannelId: '',
                    channelId: CHANNEL,
                    txid: SPLICE,
                    initiator: 'local',
                    direction: 'in',
                    amountSats: 100000,
                    startedAt: 5_000_000,
                    status: 'locked',
                    lockedAt: 5_000_000,
                    capacityBefore: 1_000_000,
                    capacityAfter: 1_100_000,
                    confirmationHeight: 120
                }
            ]);
        });

        it('records our splice-out with what the wallet got', async () => {
            respond([
                walletDeposit(50_000_000),
                spendsOldFunding,
                createsNewFunding(949_812_000)
            ]);

            const { splices } = await getSpliceHistory();

            expect(splices[0]).toMatchObject({
                initiator: 'local',
                direction: 'out',
                amountSats: 50000,
                capacityAfter: 949_812
            });
        });

        // as alice's node recorded bob's 80,000 splice-in on regtest:
        // bookkeeper's amounts are her balance, which didn't change
        it("records the peer's splice from its funding outputs", async () => {
            respond(
                [
                    [
                        CHANNEL,
                        'channel_close',
                        `${OLD_FUNDING}:1`,
                        0,
                        1_029_602_000,
                        SPLICE,
                        130,
                        5000
                    ],
                    [
                        CHANNEL,
                        'channel_open',
                        `${SPLICE}:1`,
                        1_029_602_000,
                        0,
                        null,
                        130,
                        5000
                    ]
                ],
                [
                    {
                        hash: OLD_FUNDING,
                        outputs: [
                            { index: 0, amount_msat: 20_000_000 },
                            { index: 1, amount_msat: 1_029_602_000 }
                        ]
                    },
                    {
                        hash: SPLICE,
                        outputs: [
                            { index: 0, amount_msat: 919_742_000 },
                            { index: 1, amount_msat: 1_109_602_000 }
                        ]
                    }
                ]
            );

            const { splices } = await getSpliceHistory();

            expect(splices[0]).toMatchObject({
                initiator: 'remote',
                direction: 'in',
                amountSats: undefined,
                capacityBefore: 1_029_602,
                capacityAfter: 1_109_602
            });
        });

        it('falls back to our balance when the node does not list the funding', async () => {
            respond(spliceIn, []);

            const { splices } = await getSpliceHistory();

            expect(splices[0]).toMatchObject({
                capacityBefore: 1_000_000,
                capacityAfter: 1_100_000
            });
        });

        it('fails when the node cannot say', async () => {
            respond(new Error('no such column: txid'));

            await expect(getSpliceHistory()).rejects.toThrow();
        });
    });
});
