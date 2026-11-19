jest.mock('../stores/Stores', () => ({
    feeStore: {},
    settingsStore: {}
}));
jest.mock('../utils/BackendUtils', () => ({
    supportsCashuWallet: jest.fn(() => false),
    supportsOnchainReceiving: () => false
}));
jest.mock('../utils/LocaleUtils');
jest.mock('../utils/ThemeUtils', () => ({ themeColor: () => '#000000' }));
jest.mock('./Amount', () => 'Amount');
jest.mock('./LoadingIndicator', () => 'LoadingIndicator');
jest.mock('./ModalBox', () => 'ModalBox');
jest.mock('./OnchainFeeInput', () => 'OnchainFeeInput');
jest.mock('../assets/images/SVG/Caret Down.svg', () => 'CaretDown');
jest.mock('../assets/images/SVG/Caret Up.svg', () => 'CaretUp');

import * as React from 'react';
import { render, screen } from '@testing-library/react-native';
import BackendUtils from '../utils/BackendUtils';
import FeeEstimate from './FeeEstimate';

const NOT_AVAILABLE = 'general.notAvailable';

const renderFeeEstimate = (props: object = {}) =>
    render(
        <FeeEstimate
            {...({
                satAmount: '12000',
                lightning: 'lnbc1invoice',
                ...props
            } as any)}
        />
    );

const hosts = (type: string) =>
    screen.container.queryAll((n) => n.type === type);
const amounts = () => hosts('Amount').map((n) => n.props.sats);

// The Lightning fee comes from the screen that decoded the invoice, not
// from InvoicesStore
describe('FeeEstimate Lightning fee', () => {
    beforeEach(() => {
        jest.mocked(BackendUtils.supportsCashuWallet).mockReturnValue(false);
    });

    it('shows the fee it is given and the total with it', async () => {
        await renderFeeEstimate({ lightningFee: 7 });

        expect(amounts()).toEqual([7, 12007]);
        expect(hosts('LoadingIndicator')).toHaveLength(0);
        expect(screen.queryByText(NOT_AVAILABLE)).not.toBeOnTheScreen();
    });

    it('shows a 0 sat fee as a fee', async () => {
        await renderFeeEstimate({ lightningFee: 0 });

        expect(amounts()).toEqual([0, 12000]);
    });

    it('shows the fee and total as not available without a fee', async () => {
        await renderFeeEstimate();

        expect(amounts()).toEqual([]);
        expect(screen.getAllByText(NOT_AVAILABLE)).toHaveLength(2);
    });

    it('shows the fee and total as loading', async () => {
        await renderFeeEstimate({ lightningFeeLoading: true });

        expect(hosts('LoadingIndicator')).toHaveLength(2);
        expect(amounts()).toEqual([]);
    });

    it('does not show a Lightning fee as loading for an on-chain payment', async () => {
        await renderFeeEstimate({
            lightning: undefined,
            lightningFeeLoading: true
        });

        expect(hosts('LoadingIndicator')).toHaveLength(0);
    });

    it('renders nothing without an amount', async () => {
        await renderFeeEstimate({ satAmount: '', lightningFee: 7 });

        expect(hosts('ModalBox')).toHaveLength(0);
    });
});

// The ecash fee comes from the screen that quoted the invoice, not from
// CashuStore
describe('FeeEstimate ecash fee', () => {
    beforeEach(() => {
        jest.mocked(BackendUtils.supportsCashuWallet).mockReturnValue(true);
    });

    it('shows the ecash fee it is given next to the Lightning fee', async () => {
        await renderFeeEstimate({ lightningFee: 7, ecashFee: 2 });

        expect(amounts()).toEqual([7, 12007, 2, 12002]);
        expect(hosts('LoadingIndicator')).toHaveLength(0);
        expect(screen.queryByText(NOT_AVAILABLE)).not.toBeOnTheScreen();
    });

    it('shows a 0 sat ecash fee as a fee', async () => {
        await renderFeeEstimate({ lightningFee: 7, ecashFee: 0 });

        expect(amounts()).toEqual([7, 12007, 0, 12000]);
    });

    it('shows the ecash fee and total as not available without a fee', async () => {
        await renderFeeEstimate({ lightningFee: 7 });

        expect(amounts()).toEqual([7, 12007]);
        expect(screen.getAllByText(NOT_AVAILABLE)).toHaveLength(2);
    });

    it('shows the ecash fee and total as loading', async () => {
        await renderFeeEstimate({ lightningFee: 7, ecashFeeLoading: true });

        expect(hosts('LoadingIndicator')).toHaveLength(2);
        expect(amounts()).toEqual([7, 12007]);
    });

    it('shows the ecash fee for an LNURL payment', async () => {
        await renderFeeEstimate({
            lightning: undefined,
            lnurlParams: { tag: 'payRequest' },
            lightningFee: 7,
            ecashFee: 2
        });

        expect(amounts()).toEqual([7, 12007, 2, 12002]);
    });

    it('shows no ecash fee or loading for an on-chain payment', async () => {
        await renderFeeEstimate({
            lightning: undefined,
            lightningFee: 7,
            ecashFee: 2,
            ecashFeeLoading: true
        });

        expect(amounts()).toEqual([7, 12007]);
        expect(hosts('LoadingIndicator')).toHaveLength(0);
    });

    it('shows no ecash fee or loading when the backend has no Cashu wallet', async () => {
        jest.mocked(BackendUtils.supportsCashuWallet).mockReturnValue(false);

        await renderFeeEstimate({
            lightningFee: 7,
            ecashFee: 2,
            ecashFeeLoading: true
        });

        expect(amounts()).toEqual([7, 12007]);
        expect(hosts('LoadingIndicator')).toHaveLength(0);
    });

    it('ignores the fee and loading state of a CashuStore prop', async () => {
        await renderFeeEstimate({
            lightningFee: 7,
            CashuStore: { feeEstimate: 5, loading: true }
        });

        expect(amounts()).toEqual([7, 12007]);
        expect(hosts('LoadingIndicator')).toHaveLength(0);
        expect(screen.getAllByText(NOT_AVAILABLE)).toHaveLength(2);
    });
});
