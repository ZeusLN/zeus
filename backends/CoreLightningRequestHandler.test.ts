const mockPostRequest = jest.fn();
const mockGetNode = jest.fn();

// the handler constructs its CLNRest instance at import time, so postRequest
// has to resolve the mock lazily
jest.mock('./CLNRest', () => ({
    __esModule: true,
    default: class {
        postRequest(...args: Array<any>) {
            return mockPostRequest(...args);
        }
        getNode(...args: Array<any>) {
            return mockGetNode(...args);
        }
    }
}));
// only used by getChainTransactions, but importing it pulls in the whole
// store graph
jest.mock('../utils/AddressUtils', () => ({ __esModule: true, default: {} }));

import {
    getUTXOs,
    listClosedChannels,
    listPeerChannels,
    listPeers
} from './CoreLightningRequestHandler';

const listfunds = (outputs: Array<any>) => ({ outputs, channels: [] });

const respond = (funds: any, info?: any) =>
    mockPostRequest.mockImplementation((route: string) => {
        if (route === '/v1/listfunds') return Promise.resolve(funds);
        if (route === '/v1/getinfo')
            return info
                ? Promise.resolve(info)
                : Promise.reject(new Error('getinfo failed'));
        return Promise.reject(new Error(`unexpected route ${route}`));
    });

describe('CoreLightningRequestHandler.getUTXOs', () => {
    beforeEach(() => mockPostRequest.mockReset());

    it('derives a confirmation count from the blockheight and the tip', async () => {
        // listfunds outputs carry no confirmations field; before this was
        // normalized every CLN UTXO reported 0 confirmations
        respond(listfunds([{ txid: 'a', blockheight: 108 }]), {
            blockheight: 200
        });

        const { outputs } = await getUTXOs();

        expect(outputs[0].confirmations).toBe(93);
    });

    it('counts the tip block as one confirmation', async () => {
        respond(listfunds([{ txid: 'a', blockheight: 200 }]), {
            blockheight: 200
        });

        const { outputs } = await getUTXOs();

        expect(outputs[0].confirmations).toBe(1);
    });

    it('reports 0 for an output with no blockheight', async () => {
        respond(listfunds([{ txid: 'a', status: 'unconfirmed' }]), {
            blockheight: 200
        });

        const { outputs } = await getUTXOs();

        expect(outputs[0].confirmations).toBe(0);
    });

    it('omits the count when the tip is unknown', async () => {
        respond(listfunds([{ txid: 'a', blockheight: 108 }]));

        const { outputs } = await getUTXOs();

        expect(outputs[0]).not.toHaveProperty('confirmations');
    });

    it('preserves the rest of the listfunds response', async () => {
        respond(
            listfunds([
                {
                    txid: 'a',
                    output: 1,
                    amount_msat: 984857000,
                    blockheight: 108
                }
            ]),
            { blockheight: 200 }
        );

        const { outputs, channels } = await getUTXOs();

        expect(outputs[0]).toMatchObject({
            txid: 'a',
            output: 1,
            amount_msat: 984857000,
            blockheight: 108
        });
        expect(channels).toEqual([]);
    });

    it('rejects when listfunds fails', async () => {
        mockPostRequest.mockImplementation((route: string) =>
            route === '/v1/listfunds'
                ? Promise.reject(new Error('listfunds failed'))
                : Promise.resolve({ blockheight: 200 })
        );

        await expect(getUTXOs()).rejects.toThrow('listfunds failed');
    });
});

describe('CoreLightningRequestHandler.listPeerChannels', () => {
    const channel = (overrides: any = {}): any => ({
        state: 'CHANNELD_NORMAL',
        peer_connected: true,
        peer_id: 'peer-1',
        ...overrides
    });

    beforeEach(() => {
        mockGetNode.mockReset();
        mockGetNode.mockResolvedValue({ nodes: [] });
    });

    it('reports 0 sats for a channel that carries no amounts yet', async () => {
        // CLN sends the msat fields only once the channel is funded, and
        // OPENINGD is not one of the states this mapper filters out, so the
        // arithmetic used to produce "NaN" for every amount on the row
        const { channels } = await listPeerChannels({
            channels: [channel({ state: 'OPENINGD' })]
        });

        expect(channels[0]).toMatchObject({
            capacity: '0',
            local_balance: '0',
            remote_balance: '0',
            total_satoshis_sent: '0',
            total_satoshis_received: '0',
            num_updates: '0',
            local_chan_reserve_sat: '0',
            remote_chan_reserve_sat: '0'
        });
    });

    it('converts msat amounts to sats', async () => {
        const { channels } = await listPeerChannels({
            channels: [
                channel({
                    total_msat: 1000000,
                    to_us_msat: 400000,
                    out_fulfilled_msat: 20000,
                    in_fulfilled_msat: 5000
                })
            ]
        });

        expect(channels[0]).toMatchObject({
            capacity: '1000',
            local_balance: '400',
            remote_balance: '600',
            total_satoshis_sent: '20',
            total_satoshis_received: '5'
        });
    });

    it('drops channels that are closed or not yet locked in', async () => {
        const { channels } = await listPeerChannels({
            channels: [
                channel({ state: 'ONCHAIN' }),
                channel({ state: 'CHANNELD_AWAITING_LOCKIN' }),
                channel({ state: 'CHANNELD_NORMAL' })
            ]
        });

        expect(channels).toHaveLength(1);
        expect(channels[0].active).toBe(true);
    });

    it('attaches the peer alias when the node is known', async () => {
        mockGetNode.mockResolvedValue({ nodes: [{ alias: 'ACINQ' }] });

        const { channels } = await listPeerChannels({
            channels: [channel()]
        });

        expect(channels[0].alias).toBe('ACINQ');
    });
});

describe('CoreLightningRequestHandler.listClosedChannels', () => {
    const closed = (overrides: any = {}): any => ({
        channel_id: 'chan-1',
        opener: 'local',
        private: false,
        funding_txid: 'txid-1',
        total_msat: 1000000,
        final_to_us_msat: 400000,
        min_to_us_msat: 300000,
        max_to_us_msat: 900000,
        total_htlcs_sent: 7,
        close_cause: 'user',
        ...overrides
    });

    it('reports 0 sats when no commitment fee was recorded', () => {
        // last_commitment_fee_msat is the fee on last_commitment_txid, and
        // neither is present for a channel that never had a commitment tx
        const { channels } = listClosedChannels({
            closedchannels: [closed()]
        });

        expect(channels[0].last_commitment_fee_satoshis).toBe('0');
    });

    it('maps a fully populated closed channel', () => {
        const { channels } = listClosedChannels({
            closedchannels: [
                closed({
                    peer_id: 'peer-1',
                    short_channel_id: '122x1x1',
                    last_commitment_txid: 'commit-1',
                    last_commitment_fee_msat: 2895000,
                    closer: 'remote',
                    channel_type: {
                        bits: [12],
                        names: ['static_remotekey/even']
                    }
                })
            ]
        });

        expect(channels[0]).toMatchObject({
            remote_pubkey: 'peer-1',
            short_channel_id: '122x1x1',
            capacity: '1000',
            closing_txid: 'commit-1',
            last_commitment_fee_satoshis: '2895',
            opener: 'local',
            closer: 'remote',
            close_cause: 'user',
            channel_type: ['static_remotekey/even'],
            total_htlcs_sent: '7',
            to_us_msat: '400000'
        });
    });

    it('reports no channel type when the node did not send one', () => {
        // channel_type only became a required field in CLN v26.06
        const { channels } = listClosedChannels({
            closedchannels: [closed()]
        });

        expect(channels[0].channel_type).toEqual([]);
    });
});

describe('CoreLightningRequestHandler.listPeers', () => {
    beforeEach(() => {
        mockGetNode.mockReset();
        mockGetNode.mockResolvedValue({ nodes: [] });
    });

    it('maps a disconnected peer that carries no address or features', () => {
        // the schema requires netaddr and features only while connected
        return listPeers({
            peers: [{ id: 'peer-1', connected: false, num_channels: 0 }]
        }).then(({ peersWithAliases }) => {
            expect(peersWithAliases[0]).toMatchObject({
                id: 'peer-1',
                connected: false,
                num_channels: 0,
                alias: ''
            });
        });
    });

    it('attaches the peer alias when the node is known', async () => {
        mockGetNode.mockResolvedValue({ nodes: [{ alias: 'ACINQ' }] });

        const { peersWithAliases } = await listPeers({
            peers: [
                {
                    id: 'peer-1',
                    connected: true,
                    num_channels: 2,
                    netaddr: ['1.2.3.4:9735'],
                    features: '08a0000a0a69a2'
                }
            ]
        });

        expect(peersWithAliases[0]).toMatchObject({
            alias: 'ACINQ',
            netaddr: ['1.2.3.4:9735'],
            features: '08a0000a0a69a2'
        });
    });
});
