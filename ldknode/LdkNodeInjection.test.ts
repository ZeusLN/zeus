jest.mock('react-native', () => {
    const methods: Record<string, jest.Mock> = {};
    return {
        Platform: { OS: 'android' },
        NativeModules: {
            // every native call resolves unless a test says otherwise
            LdkNodeModule: new Proxy(methods, {
                get: (target, name: string) => {
                    if (!target[name])
                        target[name] = jest.fn(() => Promise.resolve());
                    return target[name];
                }
            })
        }
    };
});
jest.mock('../utils/VssAuthUtils', () => ({
    generateVssAuthHeaders: jest.fn()
}));

import { NativeModules } from 'react-native';
import LdkNodeInjection from './LdkNodeInjection';

const native = NativeModules.LdkNodeModule as unknown as Record<
    string,
    jest.Mock
>;

const lsps1Config = { nodeId: 'lsps1-node', address: '1.2.3.4:9735' };
const lsps2Config = {
    nodeId: 'lsps2-node',
    address: '5.6.7.8:9735',
    token: 'jit'
};

const initialize = (configs: any) =>
    LdkNodeInjection.utils.initializeNode({
        network: 'signet',
        storagePath: '/ldk',
        esploraServerUrl: 'https://esplora.example',
        mnemonic: 'mnemonic',
        ...configs
    });

beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
});

beforeEach(() => {
    jest.clearAllMocks();
});

describe('LdkNodeInjection.initializeNode LSPS2 source', () => {
    it('makes the LSPS1 node the LSPS2 source without a dedicated LSP', async () => {
        const result = await initialize({ lsps1Config });

        expect(native.setLiquiditySourceLsps2).toHaveBeenCalledWith(
            'lsps1-node',
            '1.2.3.4:9735',
            null
        );
        expect(result.lsps2NodeId).toBeUndefined();
    });

    it('registers the dedicated LSP and reports it', async () => {
        const result = await initialize({ lsps1Config, lsps2Config });

        expect(native.setLiquiditySourceLsps2).toHaveBeenCalledTimes(1);
        expect(native.setLiquiditySourceLsps2).toHaveBeenCalledWith(
            'lsps2-node',
            '5.6.7.8:9735',
            'jit'
        );
        expect(native.setLiquiditySourceLsps1).toHaveBeenCalledWith(
            'lsps1-node',
            '1.2.3.4:9735',
            null
        );
        expect(result.lsps2NodeId).toEqual('lsps2-node');
    });

    it('reports no LSPS2 LSP when the node rejects it', async () => {
        native.setLiquiditySourceLsps2.mockRejectedValueOnce(
            new Error('invalid address')
        );

        const result = await initialize({ lsps1Config, lsps2Config });

        expect(result.lsps2NodeId).toBeUndefined();
        expect(native.buildNode).toHaveBeenCalled();
    });

    it('registers no LSPS2 source without any LSP', async () => {
        const result = await initialize({});

        expect(native.setLiquiditySourceLsps2).not.toHaveBeenCalled();
        expect(result.lsps2NodeId).toBeUndefined();
    });
});

describe('LdkNodeInjection receiveViaJitChannel', () => {
    it('passes the fee limit to the node', async () => {
        native.receiveViaJitChannel.mockResolvedValueOnce({
            invoice: 'lnbc-jit'
        });

        const invoice = await LdkNodeInjection.bolt11.receiveViaJitChannel({
            amountMsat: 50_000_000,
            description: 'memo',
            expirySecs: 3600,
            maxLspFeeLimitMsat: 49_999_999
        });

        expect(native.receiveViaJitChannel).toHaveBeenCalledWith(
            50_000_000,
            'memo',
            3600,
            49_999_999
        );
        expect(invoice).toEqual('lnbc-jit');
    });
});
