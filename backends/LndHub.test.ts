// Import-time scaffolding for the native modules LND.ts pulls in, copied
// from LND.test.ts. settingsStore is mutable so the URL-dependent flags can
// be exercised.
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

const store = settingsStore as any;

// Golden values for every supports* flag LndHub exposes, whether it
// overrides the flag or inherits it from LND. Values are for a generic
// LndHub URL; the URL-dependent flags are covered separately below.
const EXPECTED_FLAGS: { [flag: string]: boolean } = {
    supportsPeers: false,
    supportsMessageSigning: false,
    supportsMessageVerification: false,
    supportsLnurlAuth: true,
    supportsOnchainBalance: false,
    supportsUnconfirmedTransactionOrigin: false,
    supportsOnchainSends: false,
    supportsOnchainReceiving: true,
    supportsLightningSends: true,
    supportsWatchtowerClient: false,
    supportsKeysend: false,
    supportsPaymentLookup: false,
    supportsChannelManagement: false,
    supportsCircularRebalancing: false,
    supportsForceClose: false,
    supportsPendingChannels: false,
    supportsRouteHintUserChannelIds: false,
    supportsRouteHints: false,
    supportsClosedChannels: false,
    supportsMPP: false,
    supportsAMP: false,
    supportsCoinControl: false,
    supportsChannelCoinControl: false,
    supportsHopPicking: false,
    supportsAccounts: false,
    supportsAccountImportRescan: false,
    supportsRouting: false,
    supportsNodeInfo: false,
    supportsWithdrawalRequests: false,
    supportsAddressTypeSelection: false,
    supportsNestedSegWit: false,
    supportsTaproot: false,
    supportsBumpFee: false,
    supportsOnchainSendFeeRate: false,
    supportsChannelOpenFeeRate: false,
    supportsChannelOpenMinConfs: false,
    supportsFlowLSP: false,
    supportsNetworkInfo: false,
    supportsSimpleTaprootChannels: false,
    supportsCustomPreimages: false,
    supportsSweep: false,
    supportsOnchainSendMax: false,
    supportsOnchainBatching: false,
    supportsChannelBatching: false,
    supportsChannelFundMax: false,
    supportsLSPScustomMessage: false,
    supportsLSPS1rest: false,
    supportsOffers: false,
    supportsListingOffers: false,
    supportsBolt12Address: false,
    supportsBolt11BlindedRoutes: false,
    supportsAddressesWithDerivationPaths: false,
    supportsCustomFeeLimit: false,
    supportsForwardingHistory: false,
    supportInboundFees: false,
    supportsDevTools: true,
    supportsCashuWallet: false,
    supportsAddressMessageSigning: false,
    supportsSettingInvoiceExpiration: false,
    supportsNostrWalletConnectService: true
};

// `supports` itself is LND's version-gate helper, not a flag
const flagNames = (backend: any) =>
    Object.keys(backend)
        .filter((key) => /^supports?[A-Z]/.test(key))
        .sort();

describe('LndHub capability flags', () => {
    let lndHub: any;

    beforeEach(() => {
        store.lndhubUrl = 'https://lndhub.example.com';
        store.username = 'user';
        lndHub = new LndHub();
    });

    it('lists every flag it exposes in the golden table', () => {
        // A flag added to LND is inherited silently; this fails until the
        // new flag is given an explicit LndHub value here
        expect(flagNames(lndHub)).toEqual(Object.keys(EXPECTED_FLAGS).sort());
    });

    it.each(Object.entries(EXPECTED_FLAGS))('%s() is %s', (flag, expected) => {
        expect(lndHub[flag]()).toBe(expected);
    });

    describe('invariants', () => {
        it('disables channel-open options when channel management is off', () => {
            expect(lndHub.supportsChannelManagement()).toBe(false);
            expect(lndHub.supportsChannelFundMax()).toBe(false);
            expect(lndHub.supportsChannelBatching()).toBe(false);
        });

        it('disables address signing when message signing is off', () => {
            expect(lndHub.supportsMessageSigning()).toBe(false);
            expect(lndHub.supportsAddressMessageSigning()).toBe(false);
        });
    });

    describe('URL-dependent flags', () => {
        it.each([
            'https://ln.getalby.com',
            'https://getalby.com/lndhub',
            'https://lntxbot.com',
            'https://btcpay.example.com/plugins/lnbank/api/lndhub',
            'https://lnbits.example.com/lndhub/ext/'
        ])('disables onchain receiving for %s', (url) => {
            store.lndhubUrl = url;
            expect(lndHub.supportsOnchainReceiving()).toBe(false);
        });

        it('disables lightning sends for LNbits invoice-only credentials', () => {
            store.lndhubUrl = 'https://lnbits.example.com/lndhub/ext/';
            store.username = 'invoice';
            expect(lndHub.supportsLightningSends()).toBe(false);
        });

        it('allows lightning sends for LNbits admin credentials', () => {
            store.lndhubUrl = 'https://lnbits.example.com/lndhub/ext/';
            store.username = 'admin';
            expect(lndHub.supportsLightningSends()).toBe(true);
        });
    });
});
