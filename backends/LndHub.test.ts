// Import-time scaffolding for the native modules LND.ts pulls in, copied
// from LND.test.ts. settingsStore is mutable so the URL-dependent flags can
// be exercised.
jest.mock('react-native-blob-util', () => ({
    __esModule: true,
    default: { fetch: jest.fn(), config: jest.fn() }
}));
jest.mock('../stores/Stores', () => ({
    settingsStore: { settings: {} },
    nodeInfoStore: { nodeInfo: {} }
}));
jest.mock('../utils/TorUtils', () => ({
    doTorRequest: jest.fn(),
    isOnionHttpsUrl: jest.fn(),
    RequestMethod: {}
}));

import { settingsStore } from '../stores/Stores';
import LndHub from './LndHub';

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
    supportsChannelManagement: false,
    supportsCircularRebalancing: false,
    supportsForceClose: false,
    supportsPendingChannels: false,
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
