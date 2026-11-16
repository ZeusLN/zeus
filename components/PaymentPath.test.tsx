jest.mock('mobx-react', () => ({
    observer: (component: any) => component
}));
jest.mock('../stores/Stores', () => ({
    channelsStore: { aliasMap: new Map(), getNodeInfo: jest.fn() },
    nodeInfoStore: { nodeInfo: { nodeId: 'our-node' }, testnet: false },
    settingsStore: { settings: {} },
    notesStore: {}
}));
jest.mock('../utils/UrlUtils', () => ({
    __esModule: true,
    default: { goToBlockExplorerPubkey: jest.fn() }
}));
jest.mock('../utils/LocaleUtils');
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: (key: string) => `theme:${key}`
}));
jest.mock('./LoadingIndicator', () => 'LoadingIndicator');
jest.mock('./Amount', () => 'Amount');
jest.mock('./KeyValue', () => 'KeyValue');
jest.mock('../assets/images/SVG/Caret Down.svg', () => 'CaretDown');
jest.mock('../assets/images/SVG/Caret Right.svg', () => 'CaretRight');

import * as React from 'react';
import { render, screen } from '@testing-library/react-native';

import PaymentPath from './PaymentPath';
import Payment from '../models/Payment';

const hop = (
    pub_key: string,
    amt_to_forward_msat: string,
    fee_msat: string = '0'
) => ({ pub_key, amt_to_forward_msat, fee_msat });

const succeeded = (...hops: any[]) => ({
    status: 'SUCCEEDED',
    route: { hops }
});

// The paths the Payment view hands to PaymentPath for these lnd HTLCs
const pathsFor = (...htlcs: any[]) => new Payment({ htlcs }).enhancedPath;

// The sats of each row with this label, in render order
const amounts = (key: string) =>
    screen.container
        .queryAll((n) => n.type === 'KeyValue' && n.props.keyValue === key)
        .map((n) => n.props.value.props.sats);

describe('PaymentPath sent amount', () => {
    it('adds the first hop fee to its forwarded amount without float error', async () => {
        // 24778.456 + 3.478 is 24781.933999999997 in floating point
        expect(24778456 / 1000 + 3478 / 1000).not.toBe(24781.934);

        await render(
            <PaymentPath
                enhancedPath={pathsFor(
                    succeeded(
                        hop('routing-node', '24778456', '3478'),
                        hop('destination', '24778456')
                    )
                )}
            />
        );

        expect(amounts('general.sent')).toEqual([24781.934]);
        expect(amounts('models.Payment.forwarded')).toEqual([24778.456]);
        expect(amounts('models.Payment.fee')).toEqual([3.478]);
        expect(amounts('general.received')).toEqual([24778.456]);
    });

    it('includes the fees of later hops in the sent amount', async () => {
        // The first hop forwards the second hop's fee on top of the payment
        await render(
            <PaymentPath
                enhancedPath={pathsFor(
                    succeeded(
                        hop('first', '1000100', '1'),
                        hop('second', '1000000', '100'),
                        hop('destination', '1000000')
                    )
                )}
            />
        );

        expect(amounts('general.sent')).toEqual([1000.101]);
        expect(amounts('models.Payment.forwarded')).toEqual([1000.1, 1000]);
        expect(amounts('general.received')).toEqual([1000]);
    });

    it('sends the forwarded amount when the only hop charges no fee', async () => {
        await render(
            <PaymentPath
                enhancedPath={pathsFor(succeeded(hop('peer', '21000')))}
            />
        );

        expect(amounts('general.sent')).toEqual([21]);
        expect(amounts('general.received')).toEqual([21]);
    });
});
