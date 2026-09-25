// Import-time scaffolding for the native LDK Node module and the stores
// LdkNode.ts pulls in. formatChannel touches none of them.
jest.mock('../ldknode/LdkNodeInjection', () => ({
    __esModule: true,
    default: {}
}));
jest.mock('../stores/Stores', () => ({
    settingsStore: { settings: {} }
}));

import LdkNode from './LdkNode';

describe('LdkNode.formatChannel', () => {
    const formatChannel = (overrides: any = {}) =>
        (new LdkNode() as any).formatChannel({
            channelId: 'abc',
            counterpartyNodeId: 'peer-1',
            channelValueSats: 100000,
            outboundCapacityMsat: 40000000,
            inboundCapacityMsat: 59000000,
            unspendablePunishmentReserve: 1000,
            counterpartyUnspendablePunishmentReserve: 1000,
            isUsable: true,
            isAnnounced: false,
            isOutbound: true,
            ...overrides
        });

    it('reports the force-close spend delay as the CSV delay', () => {
        expect(formatChannel({ forceCloseSpendDelay: 144 }).csv_delay).toBe(
            144
        );
    });

    it('reports 0 before the counterparty has accepted the channel', () => {
        // LDK leaves forceCloseSpendDelay unset on an outbound channel
        // until the counterparty accepts it
        expect(formatChannel().csv_delay).toBe(0);
    });
});
