jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: { supportInboundFees: jest.fn() }
}));
jest.mock('../utils/UrlUtils', () => ({
    __esModule: true,
    default: {
        goToBlockExplorerChannelId: jest.fn(),
        goToBlockExplorerTXID: jest.fn()
    }
}));
jest.mock('../utils/DateTimeUtils', () => ({
    __esModule: true,
    default: { listFormattedDate: (time: number) => `date:${time}` }
}));
jest.mock('../utils/LocaleUtils');
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: (key: string) => `theme:${key}`
}));
jest.mock('@rneui/themed', () => ({ Divider: 'Divider' }));
jest.mock('./LoadingIndicator', () => 'LoadingIndicator');
jest.mock('./Amount', () => 'Amount');
jest.mock('./KeyValue', () => 'KeyValue');

import * as React from 'react';
import { render, screen } from '@testing-library/react-native';

import FeeBreakdown from './FeeBreakdown';
import BackendUtils from '../utils/BackendUtils';
import UrlUtils from '../utils/UrlUtils';

const OUR_NODE = 'our-node';
const PEER_NODE = 'peer-node';
const CHANNEL_ID = '123x1x0';

const policy = (overrides: Record<string, any> = {}) => ({
    fee_base_msat: '1000',
    fee_rate_milli_msat: '100',
    min_htlc: '1000',
    max_htlc_msat: '990000000',
    time_lock_delta: 40,
    last_update: 1_700_000_000,
    ...overrides
});

const OUR_POLICY = policy();
const PEER_POLICY = policy({
    fee_base_msat: '2500',
    fee_rate_milli_msat: '2500',
    min_htlc: '2000',
    max_htlc_msat: '500000000',
    time_lock_delta: 144,
    last_update: 1_700_000_100
});

beforeEach(() => {
    (BackendUtils.supportInboundFees as jest.Mock).mockReturnValue(false);
    (UrlUtils.goToBlockExplorerChannelId as jest.Mock).mockClear();
    (UrlUtils.goToBlockExplorerTXID as jest.Mock).mockClear();
});

const renderBreakdown = ({
    chanInfo,
    loading = false,
    getNodePolicy = jest.fn(),
    ...props
}: {
    chanInfo?: any;
    loading?: boolean;
    getNodePolicy?: jest.Mock;
    [prop: string]: any;
} = {}) =>
    render(
        <FeeBreakdown
            {...({
                channelId: CHANNEL_ID,
                channelPoint: 'txid:1',
                peerDisplay: 'Peer',
                ChannelsStore: {
                    loading,
                    getNodePolicy,
                    chanInfo: chanInfo ?? {
                        [CHANNEL_ID]: {
                            node1Pub: OUR_NODE,
                            node2Pub: PEER_NODE,
                            node1Policy: OUR_POLICY,
                            node2Policy: PEER_POLICY
                        }
                    }
                },
                NodeInfoStore: {
                    nodeInfo: { nodeId: OUR_NODE },
                    testnet: true
                },
                ...props
            } as any)}
        />
    );

const keyValues = () => screen.container.queryAll((n) => n.type === 'KeyValue');

const row = (key: string) => keyValues().find((n) => n.props.keyValue === key);

// What a row shows: the sats of an Amount, or the value itself
const shown = (key: string) => {
    const value = row(key)?.props.value;
    return value?.type === 'Amount' ? Number(value.props.sats) : value;
};

describe('FeeBreakdown policies', () => {
    it('shows our policy as local when we are node 1', async () => {
        await renderBreakdown();

        expect(shown('views.Channel.localBaseFee')).toBe(1);
        expect(shown('views.Channel.localFeeRate')).toBe('0.01%');
        expect(shown('views.Channel.remoteBaseFee')).toBe(2.5);
        expect(shown('views.Channel.remoteFeeRate')).toBe('0.25%');
    });

    it('shows our policy as local when we are node 2', async () => {
        await renderBreakdown({
            chanInfo: {
                [CHANNEL_ID]: {
                    node1Pub: PEER_NODE,
                    node2Pub: OUR_NODE,
                    node1Policy: PEER_POLICY,
                    node2Policy: OUR_POLICY
                }
            }
        });

        expect(shown('views.Channel.localBaseFee')).toBe(1);
        expect(shown('views.Channel.remoteBaseFee')).toBe(2.5);
    });

    it('falls back to the store policy when the channel info has none', async () => {
        // CLNRest channel info carries no node policies
        const getNodePolicy = jest.fn(() => OUR_POLICY);
        await renderBreakdown({
            getNodePolicy,
            chanInfo: {
                [CHANNEL_ID]: { node1Pub: OUR_NODE, node2Pub: PEER_NODE }
            }
        });

        expect(getNodePolicy).toHaveBeenCalledWith(CHANNEL_ID);
        expect(shown('views.Channel.localBaseFee')).toBe(1);
    });

    it('shows HTLC limits, time locks and last updates for both sides', async () => {
        await renderBreakdown();

        expect(shown('views.Channel.localMin')).toBe(1);
        expect(shown('views.Channel.remoteMin')).toBe(2);
        expect(shown('views.Channel.localMax')).toBe(990_000);
        expect(shown('views.Channel.remoteMax')).toBe(500_000);
        expect(shown('views.Channel.localTimeLock')).toBe('40 general.blocks');
        expect(shown('views.Channel.remoteTimeLock')).toBe(
            '144 general.blocks'
        );
        expect(shown('views.Channel.lastLocalUpdate')).toBe('date:1700000000');
        expect(shown('views.Channel.lastRemoteUpdate')).toBe('date:1700000100');
    });

    it('shows nothing about policies when our node is not in the channel', async () => {
        await renderBreakdown({
            NodeInfoStore: { nodeInfo: { nodeId: 'someone-else' } },
            label: 'Fees'
        });

        expect(keyValues()).toHaveLength(0);
        expect(screen.queryByText('Fees')).not.toBeOnTheScreen();
    });

    it('shows nothing about policies for an unknown channel', async () => {
        await renderBreakdown({ chanInfo: {} });

        expect(keyValues()).toHaveLength(0);
    });

    it('shows a spinner and the label while loading', async () => {
        await renderBreakdown({ loading: true, label: 'Fees' });

        expect(
            screen.container.queryAll((n) => n.type === 'LoadingIndicator')
        ).toHaveLength(1);
        expect(screen.getByText('Fees')).toBeOnTheScreen();
        expect(keyValues()).toHaveLength(0);
    });
});

describe('FeeBreakdown inbound fees', () => {
    const inbound = {
        [CHANNEL_ID]: {
            node1Pub: OUR_NODE,
            node2Pub: PEER_NODE,
            // int32 fields, so LND sends numbers
            node1Policy: policy({
                inbound_fee_base_msat: -500,
                inbound_fee_rate_milli_msat: -50
            }),
            node2Policy: policy({
                inbound_fee_base_msat: 0,
                inbound_fee_rate_milli_msat: 0
            })
        }
    };

    it('shows nonzero inbound fees when the backend supports them', async () => {
        (BackendUtils.supportInboundFees as jest.Mock).mockReturnValue(true);
        await renderBreakdown({ chanInfo: inbound });

        expect(shown('views.Channel.localInboundBaseFee')).toBe(-0.5);
        expect(shown('views.Channel.localInboundFeeRate')).toBe('-0.005%');
        expect(row('views.Channel.remoteInboundBaseFee')).toBeUndefined();
        expect(row('views.Channel.remoteInboundFeeRate')).toBeUndefined();
    });

    it('shows nonzero remote inbound fees from the remote policy', async () => {
        (BackendUtils.supportInboundFees as jest.Mock).mockReturnValue(true);
        await renderBreakdown({
            chanInfo: {
                [CHANNEL_ID]: {
                    ...inbound[CHANNEL_ID],
                    node2Policy: policy({
                        inbound_fee_base_msat: -1200,
                        inbound_fee_rate_milli_msat: -250
                    })
                }
            }
        });

        expect(shown('views.Channel.localInboundBaseFee')).toBe(-0.5);
        expect(shown('views.Channel.localInboundFeeRate')).toBe('-0.005%');
        expect(shown('views.Channel.remoteInboundBaseFee')).toBe(-1.2);
        expect(shown('views.Channel.remoteInboundFeeRate')).toBe('-0.025%');
    });

    it('leaves inbound fees out when the backend does not support them', async () => {
        await renderBreakdown({ chanInfo: inbound });

        expect(row('views.Channel.localInboundBaseFee')).toBeUndefined();
    });
});

describe('FeeBreakdown channel details', () => {
    it('shows the peer status', async () => {
        await renderBreakdown({ isActive: true });
        expect(shown('views.Channel.peerStatus')).toBe('general.active');

        await renderBreakdown({ isActive: false });
        expect(shown('views.Channel.peerStatus')).toBe(
            'views.Channel.inactive'
        );
    });

    it('says who funded the channel', async () => {
        await renderBreakdown({ initiator: true });
        expect(shown('views.Channel.fundedBy')).toBe('views.Channel.yourNode');

        await renderBreakdown({ initiator: false });
        expect(shown('views.Channel.fundedBy')).toBe('Peer');
    });

    it('shows totals and commitment details only when given', async () => {
        await renderBreakdown();
        expect(row('views.Channel.totalReceived')).toBeUndefined();
        expect(row('views.Channel.totalSent')).toBeUndefined();
        expect(row('views.Channel.commitFee')).toBeUndefined();
        expect(row('views.Channel.commitWeight')).toBeUndefined();

        await renderBreakdown({
            total_satoshis_received: '5000',
            total_satoshis_sent: '3000',
            commit_fee: '281',
            commit_weight: 724
        });
        expect(shown('views.Channel.totalReceived')).toBe(5000);
        expect(shown('views.Channel.totalSent')).toBe(3000);
        expect(shown('views.Channel.commitFee')).toBe(281);
        expect(shown('views.Channel.commitWeight')).toBe(724);
    });

    it('links the channel id and point to the block explorer on the node network', async () => {
        await renderBreakdown();

        row('views.Channel.channelId')!.props.mempoolLink();
        row('views.Channel.channelPoint')!.props.mempoolLink();

        expect(UrlUtils.goToBlockExplorerChannelId).toHaveBeenCalledWith(
            CHANNEL_ID,
            true
        );
        expect(UrlUtils.goToBlockExplorerTXID).toHaveBeenCalledWith(
            'txid:1',
            true
        );
    });
});

describe('FeeBreakdown closed channel', () => {
    it('says the channel is closed and names the peer', async () => {
        await renderBreakdown({ isClosed: true, chanInfo: {} });

        expect(
            screen.getByText('components.FeeBreakdown.nowClosed')
        ).toBeOnTheScreen();
        expect(screen.getByText('Peer')).toBeOnTheScreen();
    });

    it('waits for loading to finish before saying so', async () => {
        await renderBreakdown({ isClosed: true, loading: true });

        expect(
            screen.queryByText('components.FeeBreakdown.nowClosed')
        ).not.toBeOnTheScreen();
    });
});
