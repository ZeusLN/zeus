jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => ({ Icon: 'Icon' }));
jest.mock('../../utils/BackendUtils', () => ({
    createWithdrawalRequest: jest.fn(async () => ({ bolt12: 'lnr1...' }))
}));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../../components/AmountInput', () => ({
    __esModule: true,
    default: 'AmountInput',
    // ₿1 = $100,000
    getSatAmount: (amount: string, unit: string) =>
        Number(amount) * (unit === 'BTC' ? 100_000_000 : 1_000)
}));
jest.mock('../../components/Button', () => 'Button');
jest.mock('../../components/CollapsedQR', () => 'CollapsedQR');
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/SuccessErrorMessage', () => ({
    WarningMessage: 'WarningMessage',
    ErrorMessage: 'ErrorMessage'
}));
jest.mock('../../components/TextInput', () => 'TextInput');

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import CreateWithdrawalRequest from './CreateWithdrawalRequest';
import BackendUtils from '../../utils/BackendUtils';

const renderView = async (units: string) =>
    render(
        <CreateWithdrawalRequest
            {...({
                navigation: {},
                ChannelsStore: { totalOutbound: 5_000_000 },
                InvoicesStore: { clearUnified: jest.fn() },
                ModalStore: {},
                SettingsStore: {
                    implementation: 'ldk-node',
                    getSettings: jest.fn(async () => ({}))
                },
                UnitsStore: { units }
            } as any)}
        />
    );

const hosts = (type: string) =>
    screen.container.queryAll((n) => n.type === type);

describe('CreateWithdrawalRequest amount', () => {
    beforeEach(() => jest.clearAllMocks());

    it.each([
        ['sats', '100'],
        ['BTC', '0.000001'],
        ['fiat', '0.1']
    ])(
        'hands the backend and the QR code sats when entered in %s',
        async (units, amount) => {
            await renderView(units);
            await fireEvent.changeText(hosts('TextInput')[0], 'pocket money');
            await fireEvent(hosts('AmountInput')[0], 'amountChange', amount);

            await fireEvent.press(
                hosts('Button').find(
                    (n) =>
                        n.props.title ===
                        'views.Tools.withdrawal.createWithdrawalRequest'
                )!
            );

            expect(BackendUtils.createWithdrawalRequest).toHaveBeenCalledWith({
                amount: '100',
                description: 'pocket money',
                timeoutSeconds: '60'
            });
            expect(hosts('CollapsedQR')[0].props).toEqual(
                expect.objectContaining({
                    value: 'lnr1...',
                    satAmount: '100',
                    displayAmount: true
                })
            );
        }
    );
});
