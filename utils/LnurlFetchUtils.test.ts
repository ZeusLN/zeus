// LnurlFetchUtils.test.ts
const mockBlobFetch = jest.fn();
const mockBlobConfig = jest.fn((_options: any) => ({
    fetch: (...args: any[]) => mockBlobFetch(...args)
}));
jest.mock('react-native-blob-util', () => ({
    __esModule: true,
    default: { config: (options: any) => mockBlobConfig(options) }
}));
jest.mock('./LocaleUtils', () => ({
    localeString: (key: string) => key
}));
const mockSettingsStore: { enableTor?: boolean } = {};
jest.mock('../stores/Stores', () => ({
    settingsStore: mockSettingsStore
}));
const mockTorHttpRequest = jest.fn();
jest.mock('./TorUtils', () => ({
    RequestMethod: { GET: 'get', POST: 'post', DELETE: 'delete' },
    torHttpRequest: (...args: any[]) => mockTorHttpRequest(...args)
}));

import { bech32 } from 'bech32';

import Base64Utils from './Base64Utils';
import {
    fetchLnurlParams,
    fetchLnurlUrl,
    isUnsafeLnurlError,
    MAX_LNURL_REDIRECTS
} from './LnurlFetchUtils';

const respond = (
    status: number,
    body: any = {},
    headers: { [key: string]: string } = {}
) => ({
    info: () => ({ status, headers }),
    json: () => (typeof body === 'string' ? JSON.parse(body) : body),
    text: () => (typeof body === 'string' ? body : JSON.stringify(body))
});

const redirect = (location: string, status = 302) =>
    respond(status, '', { Location: location });

const fetchedUrls = () => mockBlobFetch.mock.calls.map((call) => call[1]);

describe('fetchLnurlUrl', () => {
    beforeEach(() => {
        mockBlobFetch.mockReset();
        mockBlobConfig.mockClear();
        mockTorHttpRequest.mockReset();
    });

    it('turns off native redirect following', async () => {
        mockBlobFetch.mockResolvedValue(respond(200));

        await fetchLnurlUrl('https://example.com/cb');

        expect(mockBlobConfig).toHaveBeenCalledWith({ followRedirect: false });
        expect(mockBlobFetch).toHaveBeenCalledWith(
            'get',
            'https://example.com/cb'
        );
        expect(mockTorHttpRequest).not.toHaveBeenCalled();
    });

    it('follows redirects to public https hosts', async () => {
        mockBlobFetch
            .mockResolvedValueOnce(redirect('https://canonical.example/a'))
            .mockResolvedValueOnce(redirect('/b?x=1', 308))
            .mockResolvedValueOnce(respond(200, { ok: true }));

        const response = await fetchLnurlUrl('https://example.com/cb');

        expect(response.json()).toEqual({ ok: true });
        expect(fetchedUrls()).toEqual([
            'https://example.com/cb',
            'https://canonical.example/a',
            'https://canonical.example/b?x=1'
        ]);
    });

    it.each([
        'http://192.168.1.1/cb',
        'https://127.0.0.1/cb',
        'https://169.254.169.254/latest/meta-data',
        'https://[::1]/cb',
        'https://0x7f.1/cb',
        'https://localhost/cb',
        '//10.0.0.1/cb',
        'http://public.example/cb'
    ])('refuses a redirect to %s without requesting it', async (location) => {
        mockBlobFetch.mockResolvedValueOnce(redirect(location));

        const error = await fetchLnurlUrl('https://example.com/cb').catch(
            (e) => e
        );

        expect(error.message).toBe('utils.lnurl.unsafeRedirect');
        expect(isUnsafeLnurlError(error)).toBe(true);
        expect(mockBlobFetch).toHaveBeenCalledTimes(1);
    });

    // url.resolve turns the backslash into a path separator, so the host
    // checked and the host requested are both evil.example
    it('checks the host the resolved URL will contact', async () => {
        mockBlobFetch
            .mockResolvedValueOnce(
                redirect('https://evil.example\\@192.168.1.1/')
            )
            .mockResolvedValueOnce(respond(200));

        await fetchLnurlUrl('https://example.com/cb');

        expect(fetchedUrls()[1]).toBe('https://evil.example/@192.168.1.1/');
    });

    // Sent as given, iOS 17+ NSURL would percent-encode the backslash into
    // the userinfo and contact the LAN address instead
    it.each([
        [
            'http://abc.onion\\@192.168.1.50:8080/p',
            'http://abc.onion/@192.168.1.50:8080/p'
        ],
        [
            'https://example.com\\@10.0.0.1/cb',
            'https://example.com/@10.0.0.1/cb'
        ]
    ])(
        'requests the first URL as the policy parsed it: %s',
        async (target, expected) => {
            mockBlobFetch.mockResolvedValueOnce(respond(200));

            await fetchLnurlUrl(target);

            expect(fetchedUrls()).toEqual([expected]);
        }
    );

    it('leaves an ordinary first URL unchanged', async () => {
        mockBlobFetch.mockResolvedValueOnce(respond(200));
        const target =
            'https://example.com/lnurlp/cb?amount=1000&comment=hi%20there';

        await fetchLnurlUrl(target);

        expect(fetchedUrls()).toEqual([target]);
    });

    it('reads the Location header case-insensitively', async () => {
        mockBlobFetch.mockResolvedValueOnce(
            respond(301, '', { location: 'http://10.0.0.1/' })
        );

        await expect(fetchLnurlUrl('https://example.com/cb')).rejects.toThrow(
            'utils.lnurl.unsafeRedirect'
        );
    });

    it('refuses an unsafe first URL without requesting it', async () => {
        await expect(fetchLnurlUrl('http://192.168.1.1/cb')).rejects.toThrow(
            'utils.lnurl.unsafeCallback'
        );
        expect(mockBlobFetch).not.toHaveBeenCalled();
    });

    it(`stops after ${MAX_LNURL_REDIRECTS} redirects`, async () => {
        let hop = 0;
        mockBlobFetch.mockImplementation(async () =>
            redirect(`https://example.com/${++hop}`)
        );

        const error = await fetchLnurlUrl('https://example.com/cb').catch(
            (e) => e
        );

        expect(error.message).toBe('utils.lnurl.tooManyRedirects');
        expect(isUnsafeLnurlError(error)).toBe(false);
        expect(mockBlobFetch).toHaveBeenCalledTimes(MAX_LNURL_REDIRECTS + 1);
    });

    it('returns a 3xx without a Location as the final response', async () => {
        mockBlobFetch.mockResolvedValueOnce(respond(304));

        const response = await fetchLnurlUrl('https://example.com/cb');

        expect(response.info().status).toBe(304);
        expect(mockBlobFetch).toHaveBeenCalledTimes(1);
    });
});

// With Use Tor on, every hop goes over the embedded Tor with redirect
// following off, and ReactNativeBlobUtil is never used
describe('fetchLnurlUrl over Tor', () => {
    const torRespond = (
        statusCode: number,
        body: any = {},
        headers: { [key: string]: string[] } = {}
    ) => ({
        statusCode,
        headers,
        body: typeof body === 'string' ? body : JSON.stringify(body)
    });

    const torRedirect = (location: string, statusCode = 302) =>
        torRespond(statusCode, '', { location: [location] });

    const torUrls = () =>
        mockTorHttpRequest.mock.calls.map((call) => call[0].url);

    beforeEach(() => {
        mockSettingsStore.enableTor = true;
        mockTorHttpRequest.mockReset();
        mockBlobFetch.mockReset();
        mockBlobConfig.mockClear();
    });

    afterEach(() => {
        delete mockSettingsStore.enableTor;
    });

    it('sends the request over Tor without following redirects', async () => {
        mockTorHttpRequest.mockResolvedValue(torRespond(200, { ok: true }));

        const response = await fetchLnurlUrl('https://example.com/cb');

        expect(mockTorHttpRequest).toHaveBeenCalledWith({
            url: 'https://example.com/cb',
            method: 'get',
            followRedirects: false
        });
        expect(mockBlobConfig).not.toHaveBeenCalled();
        expect(mockBlobFetch).not.toHaveBeenCalled();
        expect(response.info().status).toBe(200);
        expect(response.json()).toEqual({ ok: true });
        expect(response.text()).toBe('{"ok":true}');
    });

    it('returns headers as strings, as ReactNativeBlobUtil does', async () => {
        mockTorHttpRequest.mockResolvedValue(
            torRespond(200, {}, { 'content-type': ['application/json'] })
        );

        const response = await fetchLnurlUrl('https://example.com/cb');

        expect(response.info().headers).toEqual({
            'content-type': 'application/json'
        });
    });

    it('throws from json() on a body that is not JSON', async () => {
        mockTorHttpRequest.mockResolvedValue(torRespond(200, '<html>'));

        const response = await fetchLnurlUrl('https://example.com/cb');

        expect(() => response.json()).toThrow();
        expect(response.text()).toBe('<html>');
    });

    it('refuses a redirect from https to http without requesting it', async () => {
        mockTorHttpRequest.mockResolvedValueOnce(
            torRedirect('http://public.example/cb')
        );

        const error = await fetchLnurlUrl('https://example.com/cb').catch(
            (e) => e
        );

        expect(error.message).toBe('utils.lnurl.unsafeRedirect');
        expect(isUnsafeLnurlError(error)).toBe(true);
        expect(torUrls()).toEqual(['https://example.com/cb']);
        expect(mockBlobFetch).not.toHaveBeenCalled();
    });

    it('refuses a redirect to the LAN without requesting it', async () => {
        mockTorHttpRequest.mockResolvedValueOnce(
            torRedirect('https://192.168.1.1/cb', 307)
        );

        await expect(fetchLnurlUrl('https://example.com/cb')).rejects.toThrow(
            'utils.lnurl.unsafeRedirect'
        );
        expect(mockTorHttpRequest).toHaveBeenCalledTimes(1);
    });

    it('follows allowed redirects one hop at a time', async () => {
        mockTorHttpRequest
            .mockResolvedValueOnce(torRedirect('https://canonical.example/a'))
            .mockResolvedValueOnce(torRedirect('/b?x=1', 308))
            .mockResolvedValueOnce(torRespond(200, { ok: true }));

        const response = await fetchLnurlUrl('https://example.com/cb');

        expect(response.json()).toEqual({ ok: true });
        expect(torUrls()).toEqual([
            'https://example.com/cb',
            'https://canonical.example/a',
            'https://canonical.example/b?x=1'
        ]);
        mockTorHttpRequest.mock.calls.forEach((call) =>
            expect(call[0].followRedirects).toBe(false)
        );
    });

    it('follows a redirect within an onion service over http', async () => {
        const onion =
            'http://zeuspayzeuspayzeuspayzeuspayzeuspayzeuspayzeuspayzeus.onion';
        mockTorHttpRequest
            .mockResolvedValueOnce(torRedirect('/lnurlp/satoshi'))
            .mockResolvedValueOnce(torRespond(200, { tag: 'payRequest' }));

        await fetchLnurlUrl(`${onion}/.well-known/lnurlp/satoshi`);

        expect(torUrls()).toEqual([
            `${onion}/.well-known/lnurlp/satoshi`,
            `${onion}/lnurlp/satoshi`
        ]);
    });

    it(`stops after ${MAX_LNURL_REDIRECTS} redirects`, async () => {
        let hop = 0;
        mockTorHttpRequest.mockImplementation(async () =>
            torRedirect(`https://example.com/${++hop}`)
        );

        const error = await fetchLnurlUrl('https://example.com/cb').catch(
            (e) => e
        );

        expect(error.message).toBe('utils.lnurl.tooManyRedirects');
        expect(mockTorHttpRequest).toHaveBeenCalledTimes(
            MAX_LNURL_REDIRECTS + 1
        );
    });

    it('refuses an unsafe first URL without starting a request', async () => {
        await expect(fetchLnurlUrl('http://192.168.1.1/cb')).rejects.toThrow(
            'utils.lnurl.unsafeCallback'
        );
        expect(mockTorHttpRequest).not.toHaveBeenCalled();
    });

    it('rejects with the Tor transport error', async () => {
        mockTorHttpRequest.mockRejectedValue(new Error('circuit closed'));

        await expect(fetchLnurlUrl('https://example.com/cb')).rejects.toThrow(
            'circuit closed'
        );
    });

    it('resolves lnurl params over Tor', async () => {
        mockTorHttpRequest.mockResolvedValue(
            torRespond(200, {
                tag: 'payRequest',
                callback: 'https://pay.example/cb',
                metadata: '[]'
            })
        );
        const lnurl = bech32.encode(
            'lnurl',
            bech32.toWords(Base64Utils.utf8ToBytes('https://example.com/p')),
            20000
        );

        const params = await fetchLnurlParams(lnurl);

        expect(params.tag).toBe('payRequest');
        expect(params.domain).toBe('pay.example');
        expect(mockBlobFetch).not.toHaveBeenCalled();
    });

    it('uses ReactNativeBlobUtil again once Use Tor is turned off', async () => {
        mockSettingsStore.enableTor = false;
        mockBlobFetch.mockResolvedValue(respond(200));

        await fetchLnurlUrl('https://example.com/cb');

        expect(mockBlobFetch).toHaveBeenCalledWith(
            'get',
            'https://example.com/cb'
        );
        expect(mockTorHttpRequest).not.toHaveBeenCalled();
    });
});

// Parity with js-lnurl 0.6.0's getParams, which this replaces.
describe('fetchLnurlParams', () => {
    const asLnurl = (target: string) =>
        bech32.encode(
            'lnurl',
            bech32.toWords(Base64Utils.utf8ToBytes(target)),
            20000
        );

    beforeEach(() => {
        mockBlobFetch.mockReset();
    });

    it('reports an undecodable value without a request', async () => {
        const params = await fetchLnurlParams('user@example.com');

        expect(params).toEqual({
            status: 'ERROR',
            reason: "invalid lnurl 'user@example.com'"
        });
        expect(mockBlobFetch).not.toHaveBeenCalled();
    });

    it('returns a login link without a request', async () => {
        const target = 'https://example.com/auth?tag=login&k1=K1';

        const params = await fetchLnurlParams(asLnurl(target));

        expect(params).toEqual({
            tag: 'login',
            k1: 'K1',
            callback: target,
            domain: 'example.com'
        });
        expect(mockBlobFetch).not.toHaveBeenCalled();
    });

    it('returns a withdraw link carrying k1 and callback without a request', async () => {
        const params = await fetchLnurlParams(
            asLnurl(
                'https://example.com/w?tag=withdrawRequest&k1=K1&callback=https%3A%2F%2Fpay.example%2Fcb'
            )
        );

        expect(params).toEqual({
            tag: 'withdrawRequest',
            k1: 'K1',
            callback: 'https://pay.example/cb',
            domain: 'pay.example'
        });
        expect(mockBlobFetch).not.toHaveBeenCalled();
    });

    it('resolves a payRequest with decoded metadata', async () => {
        mockBlobFetch.mockResolvedValue(
            respond(200, {
                tag: 'payRequest',
                callback: 'https://pay.example/cb',
                metadata: '[["text/plain","hi"]]'
            })
        );

        const params = await fetchLnurlParams(asLnurl('https://example.com/p'));

        expect(params.domain).toBe('pay.example');
        expect(params.decodedMetadata).toEqual([['text/plain', 'hi']]);
        expect(params.commentAllowed).toBe(0);
    });

    it('resolves through a redirect to a canonical host', async () => {
        mockBlobFetch
            .mockResolvedValueOnce(redirect('https://canonical.example/p'))
            .mockResolvedValueOnce(
                respond(200, {
                    tag: 'withdrawRequest',
                    callback: 'https://canonical.example/cb',
                    k1: 'K1'
                })
            );

        const params = await fetchLnurlParams(asLnurl('https://example.com/p'));

        expect(params.tag).toBe('withdrawRequest');
        expect(params.domain).toBe('canonical.example');
    });

    it('rejects a redirect to the LAN instead of reporting an error', async () => {
        mockBlobFetch.mockResolvedValueOnce(redirect('http://192.168.1.1/p'));

        const error = await fetchLnurlParams(
            asLnurl('https://example.com/p')
        ).catch((e) => e);

        expect(isUnsafeLnurlError(error)).toBe(true);
    });

    it.each([
        ['an HTTP error', () => respond(404, 'not found'), 'not found'],
        ['invalid JSON', () => respond(200, '<html>'), '(invalid JSON)'],
        [
            'an unknown tag',
            () => respond(200, { tag: 'nope' }),
            'unknown tag: nope'
        ]
    ])('reports %s as an ERROR result', async (_name, response, message) => {
        mockBlobFetch.mockResolvedValue(response());

        const params = await fetchLnurlParams(asLnurl('https://example.com/p'));

        expect(params).toEqual({
            status: 'ERROR',
            reason: `https://example.com/p returned error: ${message}`,
            url: 'https://example.com/p',
            domain: 'example.com'
        });
    });

    it('passes a service ERROR through with its domain', async () => {
        mockBlobFetch.mockResolvedValue(
            respond(200, { status: 'ERROR', reason: 'expired' })
        );

        const params = await fetchLnurlParams(asLnurl('https://example.com/p'));

        expect(params).toEqual({
            status: 'ERROR',
            reason: 'expired',
            domain: 'example.com',
            url: 'https://example.com/p'
        });
    });
});
