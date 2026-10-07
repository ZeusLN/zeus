const mockPostRequest = jest.fn();

// the handler constructs its CLNRest instance at import time, so postRequest
// has to resolve the mock lazily
jest.mock('./CLNRest', () => ({
    __esModule: true,
    default: class {
        postRequest(...args: Array<any>) {
            return mockPostRequest(...args);
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
jest.mock('../stores/Stores', () => ({
    nodeInfoStore: { nodeInfo: {} }
}));

import { getChainTransactions } from './CoreLightningRequestHandler';
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
