jest.mock('react-native-randombytes', () => ({
    randomBytes: () => Buffer.alloc(32)
}));
jest.mock('../utils/BackendUtils', () => ({
    getNodeInfo: jest.fn(() => Promise.resolve(null)),
    isLNDBased: () => true
}));
jest.mock('../utils/LocaleUtils');

import ChannelsStore from './ChannelsStore';

describe('ChannelsStore pending HTLCs', () => {
    it('logs the pending HTLC count, not the HTLCs', async () => {
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        const store = new ChannelsStore(
            { implementation: 'lnd' } as any,
            { setPendingCloseBalance: jest.fn() } as any
        );
        // the peer is already known, so no node info lookup runs
        store.nodes['peer-pubkey'] = { alias: 'Peer' };
        store.aliasesByChannelId['chan-1'] = 'Peer';
        const htlc = {
            incoming: true,
            amount: '1000',
            hash_lock: 'htlc-hash-lock-123',
            expiration_height: 900000
        };

        try {
            await (store as any).enrichChannels(
                [
                    {
                        remotePubkey: 'peer-pubkey',
                        channelId: 'chan-1',
                        pending_htlcs: [htlc]
                    }
                ],
                true
            );

            expect(store.pendingHTLCs).toHaveLength(1);
            expect(logSpy).toHaveBeenCalledWith('Pending HTLCs:', 1);
            expect(JSON.stringify(logSpy.mock.calls)).not.toContain(
                htlc.hash_lock
            );
        } finally {
            logSpy.mockRestore();
        }
    });
});
