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

import UrlUtils from './UrlUtils';

describe('UrlUtils', () => {
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
