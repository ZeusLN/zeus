import NodeInfo from './NodeInfo';

const networkFlags = (nodeInfo: NodeInfo) => ({
    isTestNet: !!nodeInfo.isTestNet,
    isTestNet4: !!nodeInfo.isTestNet4,
    isRegTest: !!nodeInfo.isRegTest,
    isSigNet: !!nodeInfo.isSigNet,
    isMainNet: !!nodeInfo.isMainNet
});

const flags = (overrides: Partial<ReturnType<typeof networkFlags>>) => ({
    isTestNet: false,
    isTestNet4: false,
    isRegTest: false,
    isSigNet: false,
    isMainNet: false,
    ...overrides
});

describe('NodeInfo network flags', () => {
    test.each([
        // Core Lightning getinfo
        ['CLN mainnet', { network: 'bitcoin' }, flags({ isMainNet: true })],
        ['CLN testnet3', { network: 'testnet' }, flags({ isTestNet: true })],
        [
            'CLN testnet4',
            { network: 'testnet4' },
            flags({ isTestNet: true, isTestNet4: true })
        ],
        ['CLN signet', { network: 'signet' }, flags({ isSigNet: true })],
        ['CLN regtest', { network: 'regtest' }, flags({ isRegTest: true })],
        // LND GetInfo: chains[0].network is lncfg.NormalizeNetwork of the
        // chain params name, and the deprecated testnet bool is set on both
        // testnet3 and testnet4
        [
            'LND mainnet',
            {
                testnet: false,
                chains: [{ chain: 'bitcoin', network: 'mainnet' }]
            },
            flags({ isMainNet: true })
        ],
        [
            'LND testnet3',
            {
                testnet: true,
                chains: [{ chain: 'bitcoin', network: 'testnet' }]
            },
            flags({ isTestNet: true })
        ],
        [
            'LND testnet4',
            {
                testnet: true,
                chains: [{ chain: 'bitcoin', network: 'testnet4' }]
            },
            flags({ isTestNet: true, isTestNet4: true })
        ],
        [
            'LND signet',
            {
                testnet: false,
                chains: [{ chain: 'bitcoin', network: 'signet' }]
            },
            flags({ isSigNet: true })
        ],
        [
            'LND regtest',
            {
                testnet: false,
                chains: [{ chain: 'bitcoin', network: 'regtest' }]
            },
            flags({ isRegTest: true })
        ],
        // LDK Node backend builds these bools itself
        ['LDK Node testnet', { testnet: true }, flags({ isTestNet: true })],
        ['no network info', {}, flags({ isMainNet: true })]
    ])('%s', (_name, data, expected) => {
        expect(networkFlags(new NodeInfo(data))).toEqual(expected);
    });
});
