jest.mock('react-native-blob-util', () => {
    const fetchMock = jest.fn();
    return {
        __esModule: true,
        default: {
            config: jest.fn(() => ({ fetch: fetchMock }))
        }
    };
});
jest.mock('../stores/Stores', () => ({
    settingsStore: {
        host: 'http://100.87.112.121',
        port: '9740',
        phoenixdPassword: 'testpassword',
        certVerification: false,
        enableTor: false
    }
}));
jest.mock('../utils/TorUtils', () => ({
    doTorRequest: jest.fn(),
    isOnionHttpsUrl: () => false,
    RequestMethod: {}
}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (s: string) => s
}));

import ReactNativeBlobUtil from 'react-native-blob-util';
import Phoenixd from './Phoenixd';

const mockFetch = (ReactNativeBlobUtil.config({} as any) as any)
    .fetch as jest.Mock;

// phoenixd returns JSON on most routes and bare text on others; model
// both with a response whose json() parses the raw body
const mockResponse = (status: number, body: any) => {
    const data = typeof body === 'string' ? body : JSON.stringify(body);
    return {
        info: () => ({ status }),
        json: () => JSON.parse(data),
        data
    };
};

const lastCall = () => mockFetch.mock.calls[mockFetch.mock.calls.length - 1];

describe('Phoenixd backend', () => {
    let backend: Phoenixd;

    beforeEach(() => {
        backend = new Phoenixd();
        backend.clearCachedCalls();
        mockFetch.mockReset();
    });

    describe('transport', () => {
        it('sends basic auth with an empty username and form-encoded bodies', async () => {
            mockFetch.mockResolvedValue(
                mockResponse(200, {
                    amountSat: 1000,
                    paymentHash: 'a'.repeat(64),
                    serialized: 'lnbc10u1ptest'
                })
            );
            await backend.createInvoice({ memo: 'hello world', value: 1000 });
            const [method, url, headers, body] = lastCall();
            expect(method).toEqual('post');
            expect(url).toEqual('http://100.87.112.121:9740/createinvoice');
            expect(headers.Authorization).toEqual(
                // base64(':testpassword')
                `Basic ${Buffer.from(':testpassword').toString('base64')}`
            );
            expect(headers['Content-Type']).toEqual(
                'application/x-www-form-urlencoded'
            );
            expect(body).toContain('description=hello%20world');
            expect(body).toContain('amountSat=1000');
        });

        it('throws the plain-text error body with the status attached', async () => {
            mockFetch.mockResolvedValue(
                mockResponse(400, 'Request parameter invoice is missing')
            );
            await expect(backend.getRequest('/payinvoice')).rejects.toThrow(
                'Request parameter invoice is missing'
            );
        });
    });

    describe('receive: bolt11 invoice', () => {
        it('creates an invoice and returns a payment request with rHash', async () => {
            mockFetch.mockResolvedValue(
                mockResponse(200, {
                    amountSat: 50000,
                    paymentHash: 'e8'.repeat(32),
                    serialized: 'lnbc500u1ptest'
                })
            );
            const result = await backend.createInvoice({
                memo: 'test',
                value: '50000',
                expiry_seconds: '3600'
            });
            const [, , , body] = lastCall();
            expect(body).toContain('expirySeconds=3600');
            expect(result.payment_request).toEqual('lnbc500u1ptest');
            expect(result.r_hash).toEqual('e8'.repeat(32));
        });

        it('omits amountSat for zero-amount invoices', async () => {
            mockFetch.mockResolvedValue(
                mockResponse(200, {
                    amountSat: null,
                    paymentHash: 'a'.repeat(64),
                    serialized: 'lnbc1ptest'
                })
            );
            await backend.createInvoice({ memo: '', value: 0 });
            const [, , , body] = lastCall();
            expect(body).not.toContain('amountSat');
        });
    });

    describe('receive: bolt12 offer', () => {
        it('creates an offer from the bare-text response', async () => {
            mockFetch.mockResolvedValue(mockResponse(200, 'lno1newoffer'));
            const result = await backend.createOffer({
                description: 'tips',
                label: 'my offer',
                singleUse: false
            });
            const [method, url] = lastCall();
            expect(method).toEqual('post');
            expect(url).toEqual('http://100.87.112.121:9740/createoffer');
            expect(result.bolt12).toEqual('lno1newoffer');
            expect(result.active).toEqual(true);
        });

        it('lists the static node offer', async () => {
            mockFetch.mockResolvedValue(mockResponse(200, 'lno1staticoffer'));
            const result = await backend.listOffers();
            const [method, url] = lastCall();
            expect(method).toEqual('get');
            expect(url).toEqual('http://100.87.112.121:9740/getoffer');
            expect(result.offers[0].bolt12).toEqual('lno1staticoffer');
        });
    });

    describe('receive: on-chain swap-in address', () => {
        it('flags that the address is reused until it is paid', () => {
            // phoenixd's getswapinaddress returns the first *unused*
            // derived address, so it only rotates after receiving coins
            expect(backend.reusesOnchainAddress()).toEqual(true);
        });

        it('returns the same address across calls', async () => {
            const address =
                'bc1pp3m6fm524y6fxehlx7l2twcrleckyqf8wpv3zuu4vtenaj22qkts76xzl7';
            mockFetch.mockResolvedValue(
                mockResponse(200, { address, index: 0 })
            );
            const first = await backend.getNewAddress();
            backend.clearCachedCalls();
            const second = await backend.getNewAddress();
            expect(first.address).toEqual(second.address);
        });

        it('returns the swap-in address', async () => {
            mockFetch.mockResolvedValue(
                mockResponse(200, {
                    address:
                        'bc1pp3m6fm524y6fxehlx7l2twcrleckyqf8wpv3zuu4vtenaj22qkts76xzl7',
                    index: 0
                })
            );
            const result = await backend.getNewAddress();
            const [, url] = lastCall();
            expect(url).toEqual('http://100.87.112.121:9740/getswapinaddress');
            expect(result).toEqual({
                address:
                    'bc1pp3m6fm524y6fxehlx7l2twcrleckyqf8wpv3zuu4vtenaj22qkts76xzl7'
            });
        });
    });

    describe('send: bolt11', () => {
        it('pays an invoice and synthesizes a complete status', async () => {
            mockFetch.mockResolvedValue(
                mockResponse(200, {
                    recipientAmountSat: 1000,
                    routingFeeSat: 2,
                    paymentId: 'f1d2d2f9-24f8-4b3e-9a5c-000000000001',
                    paymentHash: 'a'.repeat(64),
                    paymentPreimage: 'b'.repeat(64)
                })
            );
            const result = await backend.payLightningInvoice({
                payment_request: 'lnbc10u1ptest'
            });
            const [, url, , body] = lastCall();
            expect(url).toEqual('http://100.87.112.121:9740/payinvoice');
            expect(body).toContain('invoice=lnbc10u1ptest');
            expect(body).not.toContain('amountSat');
            expect(result.status).toEqual('complete');
            expect(result.payment_preimage).toEqual('b'.repeat(64));
        });

        it('passes an override amount for zero-amount invoices', async () => {
            mockFetch.mockResolvedValue(
                mockResponse(200, {
                    recipientAmountSat: 21,
                    routingFeeSat: 0,
                    paymentId: 'f1d2d2f9-24f8-4b3e-9a5c-000000000002',
                    paymentHash: 'a'.repeat(64),
                    paymentPreimage: 'b'.repeat(64)
                })
            );
            await backend.payLightningInvoice({
                payment_request: 'lnbc1ptest',
                amt: '21'
            });
            const [, , , body] = lastCall();
            expect(body).toContain('amountSat=21');
        });

        it('surfaces a PaymentFailed (HTTP 200) response as payment_error', async () => {
            mockFetch.mockResolvedValue(
                mockResponse(200, {
                    paymentHash: 'a'.repeat(64),
                    offerId: null,
                    reason: 'not enough funds'
                })
            );
            const result = await backend.payLightningInvoice({
                payment_request: 'lnbc10u1ptest'
            });
            expect(result.payment_error).toEqual('not enough funds');
        });

        it('resolves payment-timed-out shaped when the node blocks past the window', async () => {
            jest.useFakeTimers();
            try {
                // node never answers
                mockFetch.mockReturnValue(new Promise(() => {}));
                const promise = backend.payLightningInvoice({
                    payment_request: 'lnbc10u1ptest'
                });
                jest.advanceTimersByTime(61001);
                const result = await promise;
                expect(result.payment_error).toEqual(
                    'views.SendingLightning.paymentTimedOut'
                );
            } finally {
                jest.useRealTimers();
            }
        });
    });

    describe('send: bolt12', () => {
        it('pays an offer atomically and returns the paid shape', async () => {
            mockFetch.mockResolvedValue(
                mockResponse(200, {
                    recipientAmountSat: 1000,
                    routingFeeSat: 3,
                    paymentId: 'f1d2d2f9-24f8-4b3e-9a5c-000000000003',
                    paymentHash: 'a'.repeat(64),
                    paymentPreimage: 'b'.repeat(64)
                })
            );
            const result = await backend.fetchInvoiceFromOffer(
                'lno1testoffer',
                '1000'
            );
            const [, url, , body] = lastCall();
            expect(url).toEqual('http://100.87.112.121:9740/payoffer');
            expect(body).toContain('offer=lno1testoffer');
            expect(body).toContain('amountSat=1000');
            expect(result.status).toEqual('SUCCEEDED');
            expect(result.payment_hash).toEqual('a'.repeat(64));
        });

        it('throws when the offer payment fails', async () => {
            mockFetch.mockResolvedValue(
                mockResponse(200, {
                    paymentHash: null,
                    offerId: 'c'.repeat(64),
                    reason: 'offer expired'
                })
            );
            await expect(
                backend.fetchInvoiceFromOffer('lno1testoffer', '1000')
            ).rejects.toThrow('offer expired');
        });
    });

    describe('send: on-chain (splice-out)', () => {
        it('sends and returns the bare-text txid wrapped', async () => {
            const txid = 'ab'.repeat(32);
            mockFetch.mockResolvedValue(mockResponse(200, txid));
            const result = await backend.sendCoins({
                addr: 'bc1qtestaddress',
                amount: '10000',
                sat_per_vbyte: '5'
            });
            const [, url, , body] = lastCall();
            expect(url).toEqual('http://100.87.112.121:9740/sendtoaddress');
            expect(body).toContain('address=bc1qtestaddress');
            expect(body).toContain('amountSat=10000');
            expect(body).toContain('feerateSatByte=5');
            expect(result).toEqual({ txid });
        });

        it('rejects when phoenixd answers HTTP 200 with a failure body', async () => {
            mockFetch.mockResolvedValue(
                mockResponse(200, 'no channel available')
            );
            await expect(
                backend.sendCoins({
                    addr: 'bc1qtestaddress',
                    amount: '10000',
                    sat_per_vbyte: '5'
                })
            ).rejects.toThrow('no channel available');
        });
    });

    describe('activity', () => {
        it('requests incoming history with all=true and limit=500', async () => {
            mockFetch.mockResolvedValue(mockResponse(200, []));
            await backend.getInvoices();
            const [method, url] = lastCall();
            expect(method).toEqual('get');
            expect(url).toEqual(
                'http://100.87.112.121:9740/payments/incoming?all=true&limit=500'
            );
        });

        it('requests outgoing history with all=true and limit=500', async () => {
            mockFetch.mockResolvedValue(mockResponse(200, []));
            await backend.getPayments();
            const [, url] = lastCall();
            expect(url).toEqual(
                'http://100.87.112.121:9740/payments/outgoing?all=true&limit=500'
            );
        });

        it('requests on-chain history with the same limit', async () => {
            mockFetch.mockResolvedValue(mockResponse(200, []));
            await backend.getTransactions();
            const [, url] = lastCall();
            expect(url).toEqual(
                'http://100.87.112.121:9740/payments/outgoing?all=true&limit=500'
            );
        });

        it('splits outgoing history into payments and transactions', async () => {
            const outgoing = [
                {
                    subType: 'lightning',
                    paymentId: 'f1d2d2f9-24f8-4b3e-9a5c-000000000004',
                    paymentHash: 'a'.repeat(64),
                    preimage: 'b'.repeat(64),
                    txId: null,
                    isPaid: true,
                    sent: 1002,
                    fees: 2000,
                    invoice: 'lnbc10u1ptest',
                    completedAt: 1787523700000,
                    createdAt: 1787523690000
                },
                {
                    subType: 'splice_out',
                    paymentId: 'f1d2d2f9-24f8-4b3e-9a5c-000000000005',
                    paymentHash: null,
                    preimage: null,
                    txId: '1'.repeat(64),
                    isPaid: true,
                    sent: 10500,
                    fees: 500000,
                    invoice: null,
                    completedAt: 1787524000000,
                    createdAt: 1787523900000
                }
            ];
            mockFetch.mockResolvedValue(mockResponse(200, outgoing));
            const { payments } = await backend.getPayments();
            backend.clearCachedCalls();
            const { transactions } = await backend.getTransactions();
            expect(payments.length).toEqual(1);
            expect(payments[0].payment_hash).toEqual('a'.repeat(64));
            expect(transactions.length).toEqual(1);
            expect(transactions[0].txid).toEqual('1'.repeat(64));
        });
    });

    describe('limited-access detection', () => {
        const getInfoBody = {
            nodeId: '03'.repeat(33).slice(0, 66),
            channels: [],
            chain: 'mainnet',
            blockHeight: 963776,
            version: '0.9.0-b072567'
        };

        it('hides send capabilities behind the limited-access password', async () => {
            mockFetch.mockImplementation((_method: string, url: string) => {
                if (url.endsWith('/getinfo')) {
                    return Promise.resolve(mockResponse(200, getInfoBody));
                }
                // limited password: auth rejects before the handler runs
                return Promise.resolve(
                    mockResponse(
                        401,
                        'Invalid authentication (use basic auth with the http password set in phoenix.conf)'
                    )
                );
            });
            await backend.getMyNodeInfo();
            expect(backend.supportsLightningSends()).toEqual(false);
            expect(backend.supportsOnchainSends()).toEqual(false);
        });

        it('keeps send capabilities with the full-access password', async () => {
            mockFetch.mockImplementation((_method: string, url: string) => {
                if (url.endsWith('/getinfo')) {
                    return Promise.resolve(mockResponse(200, getInfoBody));
                }
                // full password: handler runs and rejects the empty body
                return Promise.resolve(
                    mockResponse(400, 'Request parameter invoice is missing')
                );
            });
            await backend.getMyNodeInfo();
            expect(backend.supportsLightningSends()).toEqual(true);
            expect(backend.supportsOnchainSends()).toEqual(true);
        });

        it('rejects connecting to a non-mainnet node', async () => {
            mockFetch.mockResolvedValue(
                mockResponse(200, { ...getInfoBody, chain: 'testnet' })
            );
            await expect(backend.getMyNodeInfo()).rejects.toThrow(/mainnet/);
        });
    });

    describe('stubs required by the connect flow', () => {
        it('returns an empty channel list', async () => {
            await expect(backend.getChannels()).resolves.toEqual({
                channels: []
            });
        });
    });

    describe('node info', () => {
        it('exposes no node or network info screens', () => {
            expect(backend.supportsNodeInfo()).toEqual(false);
            expect(backend.supportsNetworkInfo()).toEqual(false);
        });

        // The screens are hidden, but the connect flow still calls
        // getMyNodeInfo unconditionally and the wallet will not render
        // until nodeInfo.version is populated
        it('still supplies the fields the connect flow needs', async () => {
            mockFetch.mockImplementation((_method: string, url: string) => {
                if (url.endsWith('/getinfo')) {
                    return Promise.resolve(
                        mockResponse(200, {
                            nodeId: '03a4aff76bc19547acfe9703a5bb2eb862715d1074d40574675d86f688bd603488',
                            channels: [],
                            chain: 'mainnet',
                            blockHeight: 963776,
                            version: '0.9.0-b072567'
                        })
                    );
                }
                return Promise.resolve(
                    mockResponse(400, 'Request parameter invoice is missing')
                );
            });
            const info = await backend.getMyNodeInfo();
            // NodeInfo.nodeId reads `id`; currentBlockHeight reads
            // `blockheight`; isMainNet reads `network`
            expect(info.id).toEqual(
                '03a4aff76bc19547acfe9703a5bb2eb862715d1074d40574675d86f688bd603488'
            );
            expect(info.version).toEqual('phoenixd v0.9.0-b072567');
            expect(info.blockheight).toEqual(963776);
            expect(info.network).toEqual('mainnet');
            expect(info.synced_to_chain).toEqual(true);
        });
    });
});
