// LnurlResolveUtils.test.ts
// js-lnurl's own fetch, so these tests can prove what never left
const mockCrossFetch = jest.fn();
jest.mock('cross-fetch', () => ({
    __esModule: true,
    default: (...args: any[]) => mockCrossFetch(...args)
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
        mockCrossFetch.mockReset();
        mockCrossFetch.mockResolvedValue({
            status: 200,
            json: async () => ({
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

        expect(mockCrossFetch).toHaveBeenCalledWith(
            'https://example.com/lnurl'
        );
        expect(params.tag).toBe('payRequest');
    });

    it.each(['https://192.168.1.1/lnurl', 'http://127.0.0.1:8080/lnurl'])(
        'refuses %s without fetching it',
        async (target) => {
            await expect(getLnurlParams(asLnurl(target))).rejects.toThrow(
                'utils.lnurl.unsafeEndpoint'
            );
            expect(mockCrossFetch).not.toHaveBeenCalled();
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
        mockCrossFetch.mockResolvedValue({
            status: 200,
            json: async () => ({ tag, callback, k1: 'K1', metadata: '[]' })
        });

        const error = await getLnurlParams(
            asLnurl('https://example.com/lnurl')
        ).catch((e) => e);

        expect(error.message).toBe('utils.lnurl.unsafeCallback');
        expect(isUnsafeLnurlError(error)).toBe(true);
    });

    it('resolves an onion service with a cleartext onion callback', async () => {
        mockCrossFetch.mockResolvedValue({
            status: 200,
            json: async () => ({
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

    // Pins the js-lnurl behavior the undecodable pass-through relies on: it
    // decodes with the same function before fetching and reports failure
    // without a request. A lightning address is not something it resolves;
    // Zeus handles those itself (see isLightningAddressEndpointAllowed).
    it('makes no request for a value js-lnurl cannot decode', async () => {
        const params: any = await getLnurlParams('user@192.168.1.1');

        expect(params.status).toBe('ERROR');
        expect(mockCrossFetch).not.toHaveBeenCalled();
    });
});
