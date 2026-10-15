jest.mock('react-native-blob-util', () => ({
    __esModule: true,
    default: { fetch: jest.fn(), config: jest.fn() }
}));
jest.mock('../stores/Stores');
jest.mock('../utils/TorUtils', () => ({
    doTorRequest: jest.fn(),
    isOnionHttpsUrl: jest.fn(),
    RequestMethod: {}
}));

import LndHub from './LndHub';
import { settingsStore } from '../stores/Stores';

describe('LndHub requests', () => {
    let lndHub: LndHub;
    let restReq: jest.SpyInstance;

    // REST fields left on an lndhub config, e.g. by switching the
    // implementation dropdown from LND (REST) to LndHub
    const staleRestFields = {
        host: 'https://node.example.com',
        port: '8080',
        macaroonHex: 'deadbeef'
    };

    const setStore = (fields: any) => {
        Object.keys(settingsStore).forEach(
            (key) => delete (settingsStore as any)[key]
        );
        Object.assign(settingsStore, {
            lndhubUrl: 'https://lndhub.example.com/lndhub/ext/',
            certVerification: true,
            enableTor: false,
            ...fields
        });
    };

    beforeEach(() => {
        lndHub = new LndHub();
        restReq = jest
            .spyOn(lndHub, 'restReq')
            .mockResolvedValue({ BTC: { AvailableBalance: 0 } });
    });

    it('sends requests to lndhubUrl with the session token', async () => {
        setStore({ ...staleRestFields, accessToken: 'token' });

        await lndHub.getLightningBalance();

        const [headers, url, method, data, certVerification, useTor] =
            restReq.mock.calls[0];
        expect(url).toBe('https://lndhub.example.com/lndhub/ext/balance');
        expect(headers.Authorization).toBe('Bearer token');
        expect(method).toBe('get');
        expect(data).toBeNull();
        expect(certVerification).toBe(true);
        expect(useTor).toBe(false);
    });

    it('does not send the LND macaroon on login', async () => {
        // The dropdown cleared host but kept port and macaroonHex, which
        // sent the macaroon as Bearer to <lndhubUrl>:8080/auth
        setStore({ port: '8080', macaroonHex: 'deadbeef', accessToken: '' });

        await lndHub.login({ login: 'alice', password: 'secret' });

        const [headers, url, method, data] = restReq.mock.calls[0];
        expect(url).toBe(
            'https://lndhub.example.com/lndhub/ext/auth?type=auth'
        );
        expect(headers.Authorization).toBeUndefined();
        expect(method).toBe('post');
        expect(data).toEqual({ login: 'alice', password: 'secret' });
    });

    it('appends query params', async () => {
        setStore({ accessToken: 'token' });

        await lndHub.getRequest('/route', { a: 1, b: 'two' });

        expect(restReq.mock.calls[0][1]).toBe(
            'https://lndhub.example.com/lndhub/ext/route?a=1&b=two'
        );
    });
});

describe('LndHub.watchInvoicePaid', () => {
    const invoice = (r_hash: string, ispaid: boolean, amt: number) => ({
        r_hash,
        ispaid,
        amt,
        payment_request: `lnbc1${r_hash}`,
        r_preimage: `preimage-${r_hash}`
    });

    let hub: LndHub;
    let getInvoices: jest.SpyInstance;

    beforeEach(() => {
        jest.useFakeTimers();
        hub = new LndHub();
        getInvoices = jest.spyOn(hub, 'getInvoices');
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    const tick = async () => {
        jest.advanceTimersByTime(5000);
        await Promise.resolve();
        await Promise.resolve();
    };

    it('fires once the watched invoice is paid', async () => {
        getInvoices.mockResolvedValue({
            invoices: [
                invoice('other', true, 100),
                invoice('watched', true, 900)
            ]
        });
        const onPaid = jest.fn();
        hub.watchInvoicePaid({ rHash: 'watched' }, onPaid);

        await tick();

        expect(onPaid).toHaveBeenCalledTimes(1);
        expect(onPaid).toHaveBeenCalledWith({
            amountSat: 900,
            tx: 'lnbc1watched',
            preimage: 'preimage-watched'
        });
    });

    it('does not fire while the watched invoice is unpaid', async () => {
        getInvoices.mockResolvedValue({
            invoices: [
                invoice('other', true, 100),
                invoice('watched', false, 900)
            ]
        });
        const onPaid = jest.fn();
        hub.watchInvoicePaid({ rHash: 'watched' }, onPaid);

        await tick();

        expect(onPaid).not.toHaveBeenCalled();
    });

    it('keeps polling after a failed request', async () => {
        getInvoices
            .mockRejectedValueOnce(new Error('unreachable'))
            .mockResolvedValueOnce({
                invoices: [invoice('watched', true, 900)]
            });
        const onPaid = jest.fn();
        hub.watchInvoicePaid({ rHash: 'watched' }, onPaid);

        await tick();
        await tick();

        expect(onPaid).toHaveBeenCalledTimes(1);
    });

    it('stops polling once unsubscribed', async () => {
        getInvoices.mockResolvedValue({ invoices: [] });
        const unsubscribe = hub.watchInvoicePaid(
            { rHash: 'watched' },
            jest.fn()
        );

        await tick();
        unsubscribe();
        await tick();

        expect(getInvoices).toHaveBeenCalledTimes(1);
    });
});
