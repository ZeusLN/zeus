jest.mock('../stores/Stores', () => ({
    modalStore: {
        setUrl: jest.fn(),
        setClipboardValue: jest.fn(),
        setIsEmail: jest.fn(),
        toggleExternalLinkModal: jest.fn(),
        setAction: jest.fn()
    },
    nodeInfoStore: {
        nodeInfo: { isTestNet: false }
    },
    settingsStore: {
        settings: { privacy: {} }
    }
}));

jest.mock('react-native', () => ({
    Linking: {
        canOpenURL: jest.fn(),
        openURL: jest.fn()
    }
}));

jest.mock('../stores/SettingsStore', () => ({
    DEFAULT_MEMPOOL_INSTANCE: 'electrs.zeusln.com'
}));

import { modalStore, settingsStore } from '../stores/Stores';
import UrlUtils from './UrlUtils';

const mainnet = { isMutinynet: false, isTestNet: false };
const testnet = { isMutinynet: false, isTestNet: true };
const mutinynet = { isMutinynet: true, isTestNet: false };

describe('UrlUtils', () => {
    describe('getMempoolApiUrl', () => {
        beforeEach(() => {
            settingsStore.settings.privacy = {};
        });

        it('defaults to electrs.zeusln.com on mainnet', () => {
            expect(UrlUtils.getMempoolApiUrl(mainnet)).toEqual(
                'https://electrs.zeusln.com/api'
            );
        });

        it('uses mempool.space when selected', () => {
            settingsStore.settings.privacy = {
                mempoolInstance: 'mempool.space'
            };
            expect(UrlUtils.getMempoolApiUrl(mainnet)).toEqual(
                'https://mempool.space/api'
            );
        });

        it('falls back to mempool.space testnet3 on testnet (electrs.zeusln.com is mainnet-only)', () => {
            expect(UrlUtils.getMempoolApiUrl(testnet)).toEqual(
                'https://mempool.space/testnet/api'
            );
            settingsStore.settings.privacy = {
                mempoolInstance: 'mempool.space'
            };
            expect(UrlUtils.getMempoolApiUrl(testnet)).toEqual(
                'https://mempool.space/testnet/api'
            );
        });

        it('uses mutinynet.com on mutinynet', () => {
            expect(UrlUtils.getMempoolApiUrl(mutinynet)).toEqual(
                'https://mutinynet.com/api'
            );
        });

        it('uses a custom instance verbatim on every network', () => {
            settingsStore.settings.privacy = {
                mempoolInstance: 'Custom',
                customMempoolInstance: 'https://mempool.mynode.local'
            };
            expect(UrlUtils.getMempoolApiUrl(mainnet)).toEqual(
                'https://mempool.mynode.local/api'
            );
            expect(UrlUtils.getMempoolApiUrl(testnet)).toEqual(
                'https://mempool.mynode.local/api'
            );
            expect(UrlUtils.getMempoolApiUrl(mutinynet)).toEqual(
                'https://mempool.mynode.local/api'
            );
        });

        it('prepends https:// and strips trailing slashes on custom instances', () => {
            settingsStore.settings.privacy = {
                mempoolInstance: 'Custom',
                customMempoolInstance: 'mempool.mynode.local/'
            };
            expect(UrlUtils.getMempoolApiUrl(mainnet)).toEqual(
                'https://mempool.mynode.local/api'
            );
        });

        it('falls back to the default instance when Custom is selected but empty', () => {
            settingsStore.settings.privacy = {
                mempoolInstance: 'Custom',
                customMempoolInstance: ''
            };
            expect(UrlUtils.getMempoolApiUrl(mainnet)).toEqual(
                'https://electrs.zeusln.com/api'
            );
        });
    });

    describe('getMempoolInstanceHost', () => {
        it('returns the hostname of the effective instance', () => {
            settingsStore.settings.privacy = {};
            expect(UrlUtils.getMempoolInstanceHost(mainnet)).toEqual(
                'electrs.zeusln.com'
            );
            expect(UrlUtils.getMempoolInstanceHost(testnet)).toEqual(
                'mempool.space'
            );
            settingsStore.settings.privacy = {
                mempoolInstance: 'Custom',
                customMempoolInstance: 'http://192.168.1.1:8999'
            };
            expect(UrlUtils.getMempoolInstanceHost(mainnet)).toEqual(
                '192.168.1.1:8999'
            );
        });
    });

    describe('goToBlockExplorer', () => {
        const lastUrl = () =>
            (modalStore.setUrl as jest.Mock).mock.calls.slice(-1)[0][0];

        beforeEach(() => {
            (modalStore.setUrl as jest.Mock).mockClear();
            settingsStore.settings.privacy = {};
        });

        it('uses the default explorer when no custom one is set', () => {
            UrlUtils.goToBlockExplorerTXID('abc');
            expect(lastUrl()).toEqual('https://mempool.space/tx/abc');
        });

        it('uses a custom explorer with a scheme', () => {
            settingsStore.settings.privacy = {
                defaultBlockExplorer: 'Custom',
                customBlockExplorer: 'https://explorer.mynode.local'
            };
            UrlUtils.goToBlockExplorerTXID('abc');
            expect(lastUrl()).toEqual('https://explorer.mynode.local/tx/abc');
        });

        it('resolves a scheme-less custom explorer as https', () => {
            settingsStore.settings.privacy = {
                defaultBlockExplorer: 'Custom',
                customBlockExplorer: 'explorer.mynode.local'
            };
            UrlUtils.goToBlockExplorerTXID('abc');
            expect(lastUrl()).toEqual('https://explorer.mynode.local/tx/abc');
        });

        it("honors the '#mempool.space' convention hint for block heights", () => {
            settingsStore.settings.privacy = {
                defaultBlockExplorer: 'Custom',
                customBlockExplorer:
                    'https://explorer.mynode.local#mempool.space'
            };
            UrlUtils.goToBlockExplorerBlockHeight(800000);
            // hint selects mempool.space's 'block' path, and is not in the url
            expect(lastUrl()).toEqual(
                'https://explorer.mynode.local/block/800000'
            );
        });

        it('strips the convention hint from scheme-less hosts too', () => {
            settingsStore.settings.privacy = {
                defaultBlockExplorer: 'Custom',
                customBlockExplorer: 'explorer.mynode.local#mempool.space'
            };
            UrlUtils.goToBlockExplorerBlockHeight(800000);
            expect(lastUrl()).toEqual(
                'https://explorer.mynode.local/block/800000'
            );
        });

        it('uses block-height paths for non-mempool.space explorers', () => {
            settingsStore.settings.privacy = {
                defaultBlockExplorer: 'Custom',
                customBlockExplorer: 'https://explorer.mynode.local'
            };
            UrlUtils.goToBlockExplorerBlockHeight(800000);
            expect(lastUrl()).toEqual(
                'https://explorer.mynode.local/block-height/800000'
            );
        });
    });

    describe('withScheme', () => {
        it('prepends https to bare hosts', () => {
            expect(UrlUtils.withScheme('mempool.space')).toEqual(
                'https://mempool.space'
            );
            expect(UrlUtils.withScheme('192.168.1.1:8999')).toEqual(
                'https://192.168.1.1:8999'
            );
            expect(UrlUtils.withScheme('localhost')).toEqual(
                'https://localhost'
            );
        });

        it('leaves values that already carry a scheme alone', () => {
            expect(UrlUtils.withScheme('https://mempool.space')).toEqual(
                'https://mempool.space'
            );
            expect(UrlUtils.withScheme('http://192.168.1.1:8999')).toEqual(
                'http://192.168.1.1:8999'
            );
            // not our business to rewrite an unsupported scheme
            expect(UrlUtils.withScheme('ftp://mempool.space')).toEqual(
                'ftp://mempool.space'
            );
        });

        it('leaves an empty value empty', () => {
            expect(UrlUtils.withScheme('')).toEqual('');
        });

        it('strips leading slashes so scheme-relative hosts stay clean', () => {
            expect(UrlUtils.withScheme('//mempool.space')).toEqual(
                'https://mempool.space'
            );
        });

        it('preserves paths and convention hints', () => {
            expect(UrlUtils.withScheme('mempool.mynode.local/api')).toEqual(
                'https://mempool.mynode.local/api'
            );
            expect(UrlUtils.withScheme('explorer.local#mempool.space')).toEqual(
                'https://explorer.local#mempool.space'
            );
        });

        it('produces values that isValidUrl accepts', () => {
            for (const host of [
                'mempool.space',
                '192.168.1.1:8999',
                '//mempool.space',
                'mempool.mynode.local/api'
            ]) {
                expect(UrlUtils.isValidUrl(UrlUtils.withScheme(host))).toBe(
                    true
                );
            }
        });
    });

    describe('isValidUrl', () => {
        it('accepts valid HTTPS URLs', () => {
            expect(UrlUtils.isValidUrl('https://example.com')).toBe(true);
            expect(UrlUtils.isValidUrl('https://example.com/path')).toBe(true);
            expect(UrlUtils.isValidUrl('https://localhost:3338')).toBe(true);
            expect(UrlUtils.isValidUrl('https://192.168.1.1:3338')).toBe(true);
            expect(UrlUtils.isValidUrl('https://sub.example.com/path')).toBe(
                true
            );
        });

        it('accepts valid HTTP URLs', () => {
            expect(UrlUtils.isValidUrl('http://localhost:3338')).toBe(true);
            expect(UrlUtils.isValidUrl('http://192.168.1.1:3338')).toBe(true);
            expect(UrlUtils.isValidUrl('http://example.com')).toBe(true);
        });

        it('accepts URLs with trailing whitespace', () => {
            expect(UrlUtils.isValidUrl('https://example.com  ')).toBe(true);
            expect(UrlUtils.isValidUrl('  https://example.com')).toBe(true);
        });

        it('rejects URLs without protocol', () => {
            expect(UrlUtils.isValidUrl('example.com')).toBe(false);
            expect(UrlUtils.isValidUrl('www.example.com')).toBe(false);
        });

        it('rejects URLs with invalid protocols', () => {
            expect(UrlUtils.isValidUrl('ftp://example.com')).toBe(false);
            expect(UrlUtils.isValidUrl('ws://example.com')).toBe(false);
            expect(UrlUtils.isValidUrl('file:///etc/passwd')).toBe(false);
        });

        it('rejects malformed URLs', () => {
            expect(UrlUtils.isValidUrl('https://')).toBe(false);
            expect(UrlUtils.isValidUrl('https://?')).toBe(false);
            expect(UrlUtils.isValidUrl('not a url at all')).toBe(false);
            expect(UrlUtils.isValidUrl('https:// invalid')).toBe(false);
        });

        it('rejects empty and null values', () => {
            expect(UrlUtils.isValidUrl('')).toBe(false);
            expect(UrlUtils.isValidUrl('   ')).toBe(false);
            expect(UrlUtils.isValidUrl(null as any)).toBe(false);
            expect(UrlUtils.isValidUrl(undefined as any)).toBe(false);
        });
    });
});
