const mockNetworkFetch = jest.fn();
jest.mock('./NetworkUtils', () => ({
    networkFetch: (...args: any[]) => mockNetworkFetch(...args)
}));
// js-lnurl's own transport, used to compare the Tor path against it
const mockCrossFetch = jest.fn();
jest.mock(
    'cross-fetch',
    () =>
        (...args: any[]) =>
            mockCrossFetch(...args)
);

import { getParams } from 'js-lnurl';

import { getLnurlParams } from './LnurlParamsUtils';

// Serve the same HTTP response to both transports
const respond = (status: number, body: string) => {
    mockNetworkFetch.mockResolvedValue({
        info: () => ({ status }),
        json: () => JSON.parse(body),
        text: () => body
    });
    mockCrossFetch.mockResolvedValue({
        status,
        json: async () => JSON.parse(body),
        text: async () => body
    });
};

const PAY_URL = 'https://service.example.com/lnurlp/satoshi';

describe('getLnurlParams', () => {
    beforeEach(() => {
        mockNetworkFetch.mockReset();
        mockCrossFetch.mockReset();
    });

    it('uses js-lnurl unchanged when Tor is disabled', async () => {
        respond(200, JSON.stringify({ tag: 'channelRequest', k1: 'a' }));

        await getLnurlParams(PAY_URL, false);

        expect(mockCrossFetch).toHaveBeenCalledWith(PAY_URL);
        expect(mockNetworkFetch).not.toHaveBeenCalled();
    });

    it('fetches over Tor when Tor is enabled', async () => {
        respond(200, JSON.stringify({ tag: 'channelRequest', k1: 'a' }));

        await getLnurlParams(PAY_URL, true);

        expect(mockNetworkFetch).toHaveBeenCalledWith({
            method: 'get',
            url: PAY_URL,
            enableTor: true
        });
        expect(mockCrossFetch).not.toHaveBeenCalled();
    });

    it('fetches an .onion lnurlp:// link over Tor as http', async () => {
        const onion =
            'zeuspayzeuspayzeuspayzeuspayzeuspayzeuspayzeuspayzeus.onion';
        respond(200, JSON.stringify({ tag: 'channelRequest', k1: 'a' }));

        await getLnurlParams(`lnurlp://${onion}/lnurlp/satoshi`, true);

        expect(mockNetworkFetch).toHaveBeenCalledWith(
            expect.objectContaining({
                url: `http://${onion}/lnurlp/satoshi`
            })
        );
    });

    it('does not fetch login links', async () => {
        const login =
            'https://service.example.com/auth?tag=login&k1=k1value&action=login';

        const result = await getLnurlParams(login, true);

        expect(mockNetworkFetch).not.toHaveBeenCalled();
        expect(result).toEqual(await getParams(login));
    });

    it('does not fetch fully specified withdraw links', async () => {
        const withdraw =
            'https://service.example.com/w?tag=withdrawRequest&k1=k&callback=https%3A%2F%2Fcb.example.com%2Fw&maxWithdrawable=1000';

        const result = await getLnurlParams(withdraw, true);

        expect(mockNetworkFetch).not.toHaveBeenCalled();
        expect(result).toEqual(await getParams(withdraw));
        expect(result.domain).toBe('cb.example.com');
    });

    it('rejects an invalid lnurl without fetching', async () => {
        const result = await getLnurlParams('not an lnurl', true);

        expect(mockNetworkFetch).not.toHaveBeenCalled();
        expect(result).toEqual(await getParams('not an lnurl'));
        expect(result.status).toBe('ERROR');
    });

    // The Tor path must return exactly what js-lnurl returns for the same
    // HTTP response, so callers see no difference between transports
    describe('matches js-lnurl for the same response', () => {
        const cases: Array<[string, number, string]> = [
            [
                'payRequest',
                200,
                JSON.stringify({
                    tag: 'payRequest',
                    callback: 'https://cb.example.com/pay',
                    minSendable: 1000,
                    maxSendable: 100000,
                    metadata: JSON.stringify([['text/plain', 'hi']])
                })
            ],
            [
                'payRequest with bad metadata and a comment length',
                200,
                JSON.stringify({
                    tag: 'payRequest',
                    callback: 'https://cb.example.com/pay',
                    metadata: 'not json',
                    commentAllowed: 140
                })
            ],
            [
                'withdrawRequest',
                200,
                JSON.stringify({
                    tag: 'withdrawRequest',
                    callback: 'https://cb.example.com/withdraw',
                    k1: 'k1',
                    maxWithdrawable: 5000
                })
            ],
            [
                'channelRequest',
                200,
                JSON.stringify({
                    tag: 'channelRequest',
                    callback: 'https://cb.example.com/channel',
                    k1: 'k1',
                    uri: 'pubkey@host:9735'
                })
            ],
            [
                'an ERROR envelope',
                200,
                JSON.stringify({ status: 'ERROR', reason: 'nope' })
            ],
            ['an unknown tag', 200, JSON.stringify({ tag: 'mystery' })],
            ['invalid JSON', 200, '<html>'],
            ['an HTTP error', 404, 'not found']
        ];

        it.each(cases)('%s', async (_name, status, body) => {
            respond(status, body);
            const expected = await getParams(PAY_URL);

            respond(status, body);
            const result = await getLnurlParams(PAY_URL, true);

            expect(result).toEqual(expected);
        });
    });
});
