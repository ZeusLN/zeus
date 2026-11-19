jest.mock('./BackendUtils', () => ({
    __esModule: true,
    default: {
        isLNDBased: jest.fn(),
        supportsOnchainReceiving: jest.fn(),
        supportsOnchainSends: jest.fn(),
        supportsCashuWallet: jest.fn(),
        supportsLSPS1native: jest.fn(),
        supportsLSPScustomMessage: jest.fn(),
        supportsLSPS1rest: jest.fn(),
        supportsLSPS7native: jest.fn(),
        supportsAMP: jest.fn(),
        supportsLightningAddress: jest.fn(),
        supportsKeysend: jest.fn(),
        supportsCircularRebalancing: jest.fn()
    }
}));

import BackendUtils from './BackendUtils';
import { BACKEND_CAPABILITIES } from './backendCapabilityFixtures';
import {
    getSupportedActivityFilters,
    neutralizeUnsupportedFilters,
    SupportedActivityFilters
} from './ActivityFilterSupportUtils';

const setBackend = (flags: Record<string, boolean>) => {
    Object.keys(BackendUtils).forEach((key) =>
        ((BackendUtils as any)[key] as jest.Mock).mockReturnValue(!!flags[key])
    );
};

// the filters a node supports, with the capabilities of a real backend
const supportedFor = (
    backend: string,
    {
        testnet = false,
        lightningAddressEnabled = false,
        cashuEnabled = false
    }: {
        testnet?: boolean;
        lightningAddressEnabled?: boolean;
        cashuEnabled?: boolean;
    } = {},
    override: Record<string, boolean> = {}
) => {
    setBackend({ ...BACKEND_CAPABILITIES[backend], ...override });
    return getSupportedActivityFilters({
        testnet,
        lightningAddressEnabled,
        cashuEnabled
    });
};

describe('getSupportedActivityFilters', () => {
    it('shows only the swaps filter on NWC', () => {
        expect(supportedFor('nostr-wallet-connect')).toEqual({
            onChain: false,
            cashu: false,
            swaps: true,
            lsps1: false,
            lsps7: false,
            unconfirmed: false,
            standardInvoices: false,
            ampInvoices: false,
            zeusPay: false,
            keysend: false,
            circularRebalance: false
        });
    });

    it('shows no on-chain filters on LndHub, which only receives on-chain', () => {
        expect(supportedFor('lndhub')).toMatchObject({
            onChain: false,
            unconfirmed: false,
            keysend: false,
            circularRebalance: false,
            lsps1: false,
            lsps7: false
        });
    });

    it('shows the LSPS filters but not AMP or circular rebalance on LDK Node', () => {
        expect(supportedFor('ldk-node')).toMatchObject({
            onChain: true,
            unconfirmed: true,
            keysend: true,
            lsps1: true,
            lsps7: true,
            standardInvoices: false,
            ampInvoices: false,
            circularRebalance: false
        });
    });

    it('shows LSPS1, LSPS7 and the LND filters on LND, where LSPS runs over custom messages', () => {
        expect(supportedFor('lnd')).toMatchObject({
            onChain: true,
            unconfirmed: true,
            keysend: true,
            standardInvoices: true,
            ampInvoices: true,
            circularRebalance: true,
            lsps1: true,
            lsps7: true
        });
    });

    it('shows LSPS1 and LSPS7 on embedded LND without LSPS1 over REST', () => {
        expect(supportedFor('embedded-lnd')).toMatchObject({
            lsps1: true,
            lsps7: true
        });
    });

    it('shows circular rebalance and LSPS1 but not LSPS7 or AMP on Core Lightning', () => {
        expect(supportedFor('cln-rest')).toMatchObject({
            circularRebalance: true,
            lsps1: true,
            lsps7: false,
            standardInvoices: false,
            ampInvoices: false
        });
    });

    it('keeps the standard invoice filter on LND without AMP', () => {
        expect(supportedFor('lnd', {}, { supportsAMP: false })).toMatchObject({
            standardInvoices: true,
            ampInvoices: false
        });
    });

    it('hides the on-chain filters on an LNC session that cannot send on-chain', () => {
        expect(
            supportedFor('lightning-node-connect-receive-only')
        ).toMatchObject({
            onChain: false,
            unconfirmed: false
        });
    });

    it('treats any LSPS1 transport as LSPS1 support', () => {
        for (const flag of [
            'supportsLSPS1native',
            'supportsLSPScustomMessage',
            'supportsLSPS1rest'
        ]) {
            setBackend({ [flag]: true });
            expect(
                getSupportedActivityFilters({
                    testnet: false,
                    lightningAddressEnabled: false,
                    cashuEnabled: false
                }).lsps1
            ).toBe(true);
        }
    });

    it('treats native and custom message LSPS7 as LSPS7 support', () => {
        for (const flag of [
            'supportsLSPS7native',
            'supportsLSPScustomMessage'
        ]) {
            setBackend({ [flag]: true });
            expect(
                getSupportedActivityFilters({
                    testnet: false,
                    lightningAddressEnabled: false,
                    cashuEnabled: false
                }).lsps7
            ).toBe(true);
        }
        setBackend({ supportsLSPS1rest: true });
        expect(
            getSupportedActivityFilters({
                testnet: false,
                lightningAddressEnabled: false,
                cashuEnabled: false
            }).lsps7
        ).toBe(false);
    });

    it('hides swaps on testnet', () => {
        expect(
            supportedFor('nostr-wallet-connect', { testnet: true }).swaps
        ).toBe(false);
    });

    it('needs both the Lightning address setting and backend support for ZEUS Pay', () => {
        expect(
            supportedFor('ldk-node', { lightningAddressEnabled: true }).zeusPay
        ).toBe(true);
        expect(
            supportedFor('ldk-node', { lightningAddressEnabled: false }).zeusPay
        ).toBe(false);
        expect(
            supportedFor('cln-rest', { lightningAddressEnabled: true }).zeusPay
        ).toBe(false);
    });

    it('hides ZEUS Pay on testnet, where the menu has no Lightning address', () => {
        expect(
            supportedFor('ldk-node', {
                testnet: true,
                lightningAddressEnabled: true
            }).zeusPay
        ).toBe(false);
    });

    it('needs an LND based node for the AMP filter, whatever supportsAMP says', () => {
        // every backend but the LND ones reports supportsAMP false today, so
        // this pins the clause rather than a real combination
        expect(
            supportedFor('ldk-node', {}, { supportsAMP: true }).ampInvoices
        ).toBe(false);
        expect(supportedFor('lnd', {}, { supportsAMP: true }).ampInvoices).toBe(
            true
        );
    });

    it('needs both the ecash setting and backend support for Cashu', () => {
        expect(supportedFor('ldk-node', { cashuEnabled: true }).cashu).toBe(
            true
        );
        expect(supportedFor('ldk-node', { cashuEnabled: false }).cashu).toBe(
            false
        );
        expect(supportedFor('lnd', { cashuEnabled: true }).cashu).toBe(false);
    });
});

describe('neutralizeUnsupportedFilters', () => {
    const defaults: any = {
        sent: true,
        inTransit: false,
        keysend: true,
        circularRebalance: true,
        zeusPay: true,
        swaps: true,
        submarine: true,
        reverse: true,
        swapFilter: {
            submarine: { created: true },
            reverse: { created: true }
        },
        lsps1: true,
        lsps1State: { created: true },
        lsps7: true,
        lsps7State: { created: true },
        minimumAmount: 0
    };
    const allSupported: SupportedActivityFilters = {
        onChain: true,
        cashu: true,
        swaps: true,
        lsps1: true,
        lsps7: true,
        unconfirmed: true,
        standardInvoices: true,
        ampInvoices: true,
        zeusPay: true,
        keysend: true,
        circularRebalance: true
    };
    const userFilters = (): any => ({
        ...defaults,
        sent: false,
        inTransit: true,
        keysend: false,
        circularRebalance: false,
        zeusPay: false,
        swaps: false,
        submarine: false,
        reverse: false,
        swapFilter: {
            submarine: { created: false },
            reverse: { created: false }
        },
        lsps1: false,
        lsps1State: { created: false },
        lsps7: false,
        lsps7State: { created: false },
        minimumAmount: 100
    });

    it('resets the toggles the node does not support', () => {
        const out: any = neutralizeUnsupportedFilters(userFilters(), defaults, {
            ...allSupported,
            keysend: false,
            circularRebalance: false,
            zeusPay: false
        });

        expect(out.keysend).toBe(true);
        expect(out.circularRebalance).toBe(true);
        expect(out.zeusPay).toBe(true);
    });

    it('keeps the toggles the node supports', () => {
        const out: any = neutralizeUnsupportedFilters(
            userFilters(),
            defaults,
            allSupported
        );

        expect(out).toEqual(userFilters());
    });

    it('does not touch filters that are not in the map', () => {
        const out: any = neutralizeUnsupportedFilters(userFilters(), defaults, {
            ...allSupported,
            keysend: false
        });

        expect(out.sent).toBe(false);
        expect(out.inTransit).toBe(true);
        expect(out.minimumAmount).toBe(100);
    });

    it('resets the swap filters together when swaps are not supported', () => {
        const out: any = neutralizeUnsupportedFilters(userFilters(), defaults, {
            ...allSupported,
            swaps: false
        });

        expect(out.swaps).toBe(true);
        expect(out.submarine).toBe(true);
        expect(out.reverse).toBe(true);
        expect(out.swapFilter).toEqual(defaults.swapFilter);
    });

    it('resets the LSPS order states with their toggles', () => {
        const out: any = neutralizeUnsupportedFilters(userFilters(), defaults, {
            ...allSupported,
            lsps1: false,
            lsps7: false
        });

        expect(out.lsps1).toBe(true);
        expect(out.lsps1State).toEqual({ created: true });
        expect(out.lsps7).toBe(true);
        expect(out.lsps7State).toEqual({ created: true });
    });

    it('keeps the LSPS states of a service that is supported', () => {
        const out: any = neutralizeUnsupportedFilters(userFilters(), defaults, {
            ...allSupported,
            lsps7: false
        });

        expect(out.lsps1State).toEqual({ created: false });
        expect(out.lsps7State).toEqual({ created: true });
    });

    it('keeps the LSPS7 states when only LSPS1 is not supported', () => {
        const out: any = neutralizeUnsupportedFilters(userFilters(), defaults, {
            ...allSupported,
            lsps1: false
        });

        expect(out.lsps1State).toEqual({ created: true });
        expect(out.lsps7State).toEqual({ created: false });
    });

    it('returns a copy and leaves the saved filters as they are', () => {
        const filters = userFilters();
        const out = neutralizeUnsupportedFilters(filters, defaults, {
            ...allSupported,
            keysend: false,
            swaps: false
        });

        expect(out).not.toBe(filters);
        expect(filters).toEqual(userFilters());
    });
});
