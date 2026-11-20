const mockSetVssServer = jest.fn();
const mockNative: Record<string, jest.Mock> = {};

jest.mock('react-native', () => ({
    Platform: { OS: 'android' },
    NativeModules: {
        LdkNodeModule: new Proxy(
            {},
            {
                get: (_target, name: string) => {
                    if (name === 'setVssServer') return mockSetVssServer;
                    if (!mockNative[name]) {
                        mockNative[name] = jest.fn(async () => null);
                    }
                    return mockNative[name];
                }
            }
        )
    }
}));

jest.mock('react-native-fs', () => ({
    exists: jest.fn(async () => true)
}));

import LdkNodeInjection from './LdkNodeInjection';
import {
    getVssHeaderIssuedAt,
    noteVssHeaderIssued
} from '../utils/VssHeaderRefreshUtils';
import { deriveVssSigningKeyFromSeed } from '../utils/VssAuthUtils';

const HOUR = 60 * 60 * 1000;
const START = Date.UTC(2026, 10, 17, 8, 0, 0);
const vssKey = deriveVssSigningKeyFromSeed(Buffer.alloc(64, 3));

const params = {
    network: 'bitcoin' as any,
    storagePath: '/data/ldk-node/wallet',
    esploraServerUrl: 'https://esplora.example',
    mnemonic: 'unused because vssKey is given',
    vssConfig: { url: 'https://vss.example/vss', storeId: 'store' },
    vssKey
};

const lastAuthorization = (): string =>
    mockSetVssServer.mock.calls[mockSetVssServer.mock.calls.length - 1][2]
        .authorization;

describe('LdkNodeInjection.utils.initializeNode VSS header', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(START);
        mockSetVssServer.mockReset();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it('records when the header it builds the node with was signed', async () => {
        await LdkNodeInjection.utils.initializeNode(params);

        expect(mockSetVssServer).toHaveBeenCalledTimes(1);
        expect(lastAuthorization().endsWith(`${START / 1000}`)).toBe(true);
        expect(getVssHeaderIssuedAt()).toEqual(START);
    });

    it('signs a new header on a later build', async () => {
        await LdkNodeInjection.utils.initializeNode(params);
        const first = lastAuthorization();

        jest.setSystemTime(START + 21 * HOUR);
        await LdkNodeInjection.utils.initializeNode(params);
        const second = lastAuthorization();

        expect(second).not.toEqual(first);
        expect(second.endsWith(`${(START + 21 * HOUR) / 1000}`)).toBe(true);
        expect(getVssHeaderIssuedAt()).toEqual(START + 21 * HOUR);
    });

    it('clears the recorded time for a build without VSS', async () => {
        noteVssHeaderIssued(START - HOUR);

        await LdkNodeInjection.utils.initializeNode({
            ...params,
            vssConfig: undefined
        });

        expect(mockSetVssServer).not.toHaveBeenCalled();
        expect(getVssHeaderIssuedAt()).toBeUndefined();
    });
});
