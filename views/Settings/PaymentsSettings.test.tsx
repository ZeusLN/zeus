jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../stores/SettingsStore', () => ({
    __esModule: true,
    default: class SettingsStore {},
    DEFAULT_TAP_TO_PAY_LIMIT: 10000,
    MEMPOOL_RATES_KEYS: []
}));
jest.mock('../../stores/NodeInfoStore', () => ({}));
jest.mock('../../utils/BackendUtils', () => ({
    isLNDBased: jest.fn(() => true),
    supportsCashuWallet: jest.fn(() => true),
    supportsCustomFeeLimit: jest.fn(() => true)
}));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('@react-native-community/slider', () => 'Slider');
jest.mock('../../components/AmountInput', () => 'AmountInput');
jest.mock('../../components/DropdownSetting', () => 'DropdownSetting');
jest.mock('../../components/Header', () => () => null);
jest.mock('../../components/Switch', () => 'Switch');
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/Text', () => {
    const { Text } = require('react-native');
    return ({ children }: any) => <Text>{children}</Text>;
});
jest.mock('../../components/TextInput', () => 'TextInput');

import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import PaymentsSettings from './PaymentsSettings';
import BackendUtils from '../../utils/BackendUtils';

const renderView = async (payments: any) => {
    const SettingsStore = {
        settings: { payments },
        getSettings: jest.fn(async () => ({ payments })),
        updateSettingsGroup: jest.fn(),
        updateSettingsGroupDebounced: jest.fn(),
        flushPendingSettings: jest.fn()
    };
    await render(
        <PaymentsSettings
            navigation={{} as any}
            SettingsStore={SettingsStore as any}
            NodeInfoStore={{ nodeInfo: { isMainNet: true } } as any}
        />
    );
    return SettingsStore;
};

const TITLE = 'general.ecash - views.Settings.Payments.tapToPayLimit';

const limitInput = () =>
    screen.container.queryAll(
        (n) => n.type === 'AmountInput' && n.props.title === TITLE
    )[0];

describe('PaymentsSettings tap-to-pay limit', () => {
    beforeEach(() => {
        (BackendUtils.supportsCashuWallet as jest.Mock).mockReturnValue(true);
    });

    it('shows the stored limit', async () => {
        await renderView({ tapToPayLimit: 0 });

        expect(limitInput().props.amount).toBe('0');
    });

    it('shows the default for settings saved before the limit existed', async () => {
        await renderView({ slideToPayThreshold: 10000 });

        expect(limitInput().props.amount).toBe('10000');
    });

    it('saves a new limit', async () => {
        const SettingsStore = await renderView({});

        await act(() => fireEvent(limitInput(), 'amountChange', '2100', 2100));

        expect(limitInput().props.amount).toBe('2100');
        expect(SettingsStore.updateSettingsGroupDebounced).toHaveBeenCalledWith(
            'payments',
            { tapToPayLimit: 2100 }
        );
    });

    it('does not save a cleared field as a limit of 0', async () => {
        const SettingsStore = await renderView({});

        await act(() => fireEvent(limitInput(), 'amountChange', '', 0));

        expect(
            SettingsStore.updateSettingsGroupDebounced
        ).not.toHaveBeenCalled();
    });

    it('is hidden without an ecash wallet', async () => {
        (BackendUtils.supportsCashuWallet as jest.Mock).mockReturnValue(false);
        await renderView({});

        expect(limitInput()).toBeUndefined();
        expect(
            screen.queryByText('views.Settings.Payments.tapToPayLimitExplainer')
        ).toBeNull();
    });
});
