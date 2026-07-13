jest.mock('../stores/Stores', () => ({
    modalStore: {
        setUrl: jest.fn(),
        setClipboardValue: jest.fn(),
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

import { settingsStore } from '../stores/Stores';
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
