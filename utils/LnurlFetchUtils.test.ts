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
    });

    it('turns off native redirect following', async () => {
        mockBlobFetch.mockResolvedValue(respond(200));

        await fetchLnurlUrl('https://example.com/cb');

        expect(mockBlobConfig).toHaveBeenCalledWith({ followRedirect: false });
        expect(mockBlobFetch).toHaveBeenCalledWith(
            'get',
            'https://example.com/cb'
        );
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
