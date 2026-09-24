// LnurlResolveUtils.test.ts
// the resolve's fetch, so these tests can prove what never left
const mockFetch = jest.fn();
jest.mock('react-native-blob-util', () => ({
    __esModule: true,
    default: {
        config: () => ({
            fetch: (_method: string, target: string) => mockFetch(target)
        })
    }
}));
jest.mock('./LocaleUtils', () => ({
    localeString: (key: string) => key
}));

import { bech32 } from 'bech32';

import Base64Utils from './Base64Utils';
import { getLnurlParams, isUnsafeLnurlError } from './LnurlResolveUtils';

// The guarded resolve every caller goes through, including the
// ChoosePaymentMethod rows that handleAnything never sees.
describe('getLnurlParams', () => {
    const asLnurl = (target: string) =>
        bech32.encode(
            'lnurl',
            bech32.toWords(Base64Utils.utf8ToBytes(target)),
            20000
        );

    beforeEach(() => {
        mockFetch.mockReset();
        mockFetch.mockResolvedValue({
            info: () => ({ status: 200, headers: {} }),
            json: () => ({
                tag: 'payRequest',
                callback: 'https://example.com/cb',
                metadata: '[]'
            })
        });
    });

    it('resolves a public https endpoint', async () => {
        const params: any = await getLnurlParams(
            asLnurl('https://example.com/lnurl')
        );

        expect(mockFetch).toHaveBeenCalledWith('https://example.com/lnurl');
        expect(params.tag).toBe('payRequest');
    });

    it.each(['https://192.168.1.1/lnurl', 'http://127.0.0.1:8080/lnurl'])(
        'refuses %s without fetching it',
        async (target) => {
            await expect(getLnurlParams(asLnurl(target))).rejects.toThrow(
                'utils.lnurl.unsafeEndpoint'
            );
            expect(mockFetch).not.toHaveBeenCalled();
        }
    );

    // A withdrawRequest carrying k1 and callback in its query string is
    // returned by js-lnurl without any fetch, so the whole payload can ride
    // in one QR. The endpoint check still applies to it.
    it('refuses a LAN withdraw link that js-lnurl would short-circuit', async () => {
        await expect(
            getLnurlParams(
                asLnurl(
                    'https://192.168.1.1/w?tag=withdrawRequest&k1=K1&callback=https%3A%2F%2Fexample.com%2Fcb'
                )
            )
        ).rejects.toThrow('utils.lnurl.unsafeEndpoint');
    });

    it('marks a refusal so callers can tell it from a failed resolve', async () => {
        const error = await getLnurlParams(
            asLnurl('https://192.168.1.1/lnurl')
        ).catch((e) => e);

        expect(isUnsafeLnurlError(error)).toBe(true);
        expect(isUnsafeLnurlError(new Error('invalid lnurl'))).toBe(false);
    });

    // The callback is checked before any caller acts on the params, so a
    // withdraw is refused before the user creates an invoice for it.
    it.each([
        ['withdrawRequest', 'https://192.168.1.1/cb'],
        ['payRequest', 'http://example.com/cb'],
        ['channelRequest', 'https://127.0.0.1/cb']
    ])('refuses a %s whose callback is %s', async (tag, callback) => {
        mockFetch.mockResolvedValue({
            info: () => ({ status: 200, headers: {} }),
            json: () => ({ tag, callback, k1: 'K1', metadata: '[]' })
        });

        const error = await getLnurlParams(
            asLnurl('https://example.com/lnurl')
        ).catch((e) => e);

        expect(error.message).toBe('utils.lnurl.unsafeCallback');
        expect(isUnsafeLnurlError(error)).toBe(true);
    });

    it('resolves an onion service with a cleartext onion callback', async () => {
        mockFetch.mockResolvedValue({
            info: () => ({ status: 200, headers: {} }),
            json: () => ({
                tag: 'withdrawRequest',
                callback: 'http://abcdefg.onion/cb',
                k1: 'K1'
            })
        });

        const params: any = await getLnurlParams(
            asLnurl('http://abcdefg.onion/lnurl')
        );

        expect(params.callback).toBe('http://abcdefg.onion/cb');
    });

    // A public endpoint that redirects to the LAN is refused at the hop,
    // before the redirect target is requested.
    it('refuses an endpoint that redirects to the LAN', async () => {
        mockFetch.mockResolvedValue({
            info: () => ({
                status: 302,
                headers: { Location: 'http://192.168.1.1/lnurl' }
            }),
            json: () => ({}),
            text: () => ''
        });

        const error = await getLnurlParams(
            asLnurl('https://example.com/lnurl')
        ).catch((e) => e);

        expect(error.message).toBe('utils.lnurl.unsafeRedirect');
        expect(isUnsafeLnurlError(error)).toBe(true);
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // Pins the behavior the undecodable pass-through relies on: the resolve
    // decodes with the same function before fetching and reports failure
    // without a request. A lightning address is not something it resolves;
    // Zeus handles those itself (see isLightningAddressEndpointAllowed).
    it('makes no request for a value it cannot decode', async () => {
        const params: any = await getLnurlParams('user@192.168.1.1');

        expect(params.status).toBe('ERROR');
        expect(mockFetch).not.toHaveBeenCalled();
    });
});
