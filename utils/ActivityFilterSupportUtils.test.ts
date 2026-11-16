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
import { getSupportedActivityFilters } from './ActivityFilterSupportUtils';

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
