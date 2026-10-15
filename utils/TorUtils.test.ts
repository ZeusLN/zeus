jest.mock('react-native-nitro-tor', () => ({
    RnTor: {
        startTorIfNotRunning: jest.fn(),
        shutdownService: jest.fn(),
        httpGet: jest.fn(),
        httpPost: jest.fn(),
        httpDelete: jest.fn()
    }
}));

jest.mock('react-native-fs', () => ({
    DocumentDirectoryPath: '/tmp'
}));

import { RnTor } from 'react-native-nitro-tor';
import { doTorRequest, isOnionHttpsUrl, RequestMethod } from './TorUtils';
import { isNodeResponse } from './PaymentLookupUtils';

describe('TorUtils', () => {
    describe('isOnionHttpsUrl', () => {
        it('returns true for an HTTPS v3 .onion URL', () => {
            expect(
                isOnionHttpsUrl(
                    'https://hnmvv3bxny3chob3ytfai5m5j3356qplcf26hel63fs6c3adlbu56lad.onion/v1/getinfo'
                )
            ).toBe(true);
        });

        it('returns true regardless of port', () => {
            expect(
                isOnionHttpsUrl(
                    'https://hnmvv3bxny3chob3ytfai5m5j3356qplcf26hel63fs6c3adlbu56lad.onion:8443/v1/getinfo'
                )
            ).toBe(true);
        });

        it('returns true for a multi-label .onion hostname', () => {
            expect(isOnionHttpsUrl('https://api.xyz.onion/v1/getinfo')).toBe(
                true
            );
        });

        it('returns true even when the hostname is mixed case', () => {
            expect(isOnionHttpsUrl('https://XYZ.ONION/v1/getinfo')).toBe(true);
        });

        it('returns false for an HTTP .onion URL (no TLS to bypass)', () => {
            expect(isOnionHttpsUrl('http://xyz.onion/v1/getinfo')).toBe(false);
        });

        it('returns false for a clearnet HTTPS URL', () => {
            expect(isOnionHttpsUrl('https://example.com/v1/getinfo')).toBe(
                false
            );
        });

        it('returns false when .onion appears in the path', () => {
            expect(
                isOnionHttpsUrl('https://example.com/xyz.onion/v1/getinfo')
            ).toBe(false);
        });

        it('returns false when .onion appears in a query string', () => {
            expect(isOnionHttpsUrl('https://example.com/?host=xyz.onion')).toBe(
                false
            );
        });

        it('returns false when .onion appears in a fragment', () => {
            expect(isOnionHttpsUrl('https://example.com/#xyz.onion')).toBe(
                false
            );
        });

        it('returns false for hostnames that merely contain "onion"', () => {
            expect(isOnionHttpsUrl('https://onion-router.example.com/')).toBe(
                false
            );
        });

        it('returns false for a hostname where .onion is a non-trailing label', () => {
            expect(isOnionHttpsUrl('https://xyz.onion.evil.com/')).toBe(false);
        });

        it('returns false for a hostname suffixed with .onion-like text', () => {
            expect(isOnionHttpsUrl('https://foo.onionspoof.com/')).toBe(false);
        });

        it('returns false for unrelated schemes pointing at .onion', () => {
            expect(isOnionHttpsUrl('ws://xyz.onion/socket')).toBe(false);
            expect(isOnionHttpsUrl('wss://xyz.onion/socket')).toBe(false);
            expect(isOnionHttpsUrl('ftp://xyz.onion/file')).toBe(false);
        });

        it('returns false for invalid / unparseable URLs', () => {
            expect(isOnionHttpsUrl('')).toBe(false);
            expect(isOnionHttpsUrl('not a url')).toBe(false);
            expect(isOnionHttpsUrl('xyz.onion')).toBe(false); // no scheme
            expect(isOnionHttpsUrl('://xyz.onion')).toBe(false);
        });
    });
});

describe('doTorRequest errors', () => {
    beforeEach(() => {
        (RnTor.startTorIfNotRunning as jest.Mock).mockResolvedValue({
            is_success: true
        });
    });

    it('tags an error status as a response from the node', async () => {
        (RnTor.httpPost as jest.Mock).mockResolvedValue({
            status_code: 500,
            body: JSON.stringify({ code: 2, message: 'invoice expired' })
        });

        const error = await doTorRequest(
            'https://node.onion:8080/v2/router/send',
            RequestMethod.POST,
            '{}'
        ).catch((e: any) => e);

        expect(error.message).toBe('invoice expired');
        expect(isNodeResponse(error)).toBe(true);
    });

    it('does not tag a transport failure', async () => {
        (RnTor.httpPost as jest.Mock).mockResolvedValue({
            error: 'circuit closed'
        });

        const error = await doTorRequest(
            'https://node.onion:8080/v2/router/send',
            RequestMethod.POST,
            '{}'
        ).catch((e: any) => e);

        expect(error.message).toBe('circuit closed');
        expect(isNodeResponse(error)).toBe(false);
    });
});
