jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
// the keypad's font size and input checks read these
jest.mock('../../stores/Stores', () => ({
    settingsStore: { settings: { fiat: 'USD' } },
    fiatStore: { symbolLookup: () => ({ decimalPlaces: 2 }) },
    unitsStore: { units: 'sats' }
}));
jest.mock('../../utils/BackendUtils', () => ({
    __esModule: true,
    default: {
        supportsCashuWallet: () => false,
        supportsFlowLSP: () => false,
        supportsLightningSends: () => true
    }
}));
jest.mock('../../NavigationService', () => ({ navigate: jest.fn() }));
jest.mock('../../components/Button', () => 'Button');
jest.mock('../../components/EcashMintPicker', () => 'EcashMintPicker');
jest.mock('../../components/EcashToggle', () => 'EcashToggle');
jest.mock('../../components/ModalBox', () => 'ModalBox');
jest.mock('../../components/PinPad', () => 'PinPad');
jest.mock('../../components/UnitToggle', () => 'UnitToggle');
jest.mock('../../components/WalletHeader', () => 'WalletHeader');
jest.mock('../../components/KeypadAmountDisplay', () => {
    const { Text, View } = require('react-native');
    return ({ amount, children }: any) => (
        <View>
            <Text testID="amount">{amount}</Text>
            {children}
        </View>
    );
});
jest.mock('../../components/CurrencySelectorModal', () => {
    const React = require('react');
    return class CurrencySelectorModal extends React.Component {
        open() {}
        render() {
            return React.createElement('CurrencySelectorModal', this.props);
        }
    };
});
jest.mock('../../assets/images/SVG/Bitcoin.svg', () => 'Bitcoin');
jest.mock('../../assets/images/SVG/MintToken.svg', () => 'MintToken');
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));

import * as React from 'react';
import { act, render, screen } from '@testing-library/react-native';

import KeypadPane from './KeypadPane';

const host = (type: string) =>
    screen.container.queryAll((n) => n.type === type)[0];

const renderPane = async () => {
    const UnitsStore: any = { units: 'sats' };
    const SettingsStore: any = { settings: { fiat: 'USD' } };
    await render(
        <KeypadPane
            {...({
                navigation: {
                    addListener: () => () => {},
                    navigate: jest.fn()
                },
                loading: false,
                CashuStore: { mintUrls: [] },
                ChannelsStore: { channels: [{}], totalInbound: 0 },
                FiatStore: {},
                NodeInfoStore: {
                    flowLspNotConfigured: () => ({
                        flowLspNotConfigured: true
                    })
                },
                SettingsStore,
                SyncStore: { isSyncing: false },
                UnitsStore
            } as any)}
        />
    );
    await act(() => {
        host('PinPad').props.appendValue('2');
        host('PinPad').props.appendValue('5');
    });
    expect(screen.getByTestId('amount')).toHaveTextContent('25');
    return { UnitsStore, SettingsStore };
};

// CurrencyList stores the selection, then closes the modal
const pickInModal = async (select: () => void) => {
    await act(() => host('UnitToggle').props.onOpenModal());
    select();
    await act(() => host('CurrencySelectorModal').props.onClose());
};

describe('KeypadPane currency modal', () => {
    it('clears the digits when another unit is picked', async () => {
        const { UnitsStore } = await renderPane();

        await pickInModal(() => (UnitsStore.units = 'BTC'));

        expect(screen.getByTestId('amount')).toHaveTextContent('0');
    });

    it('clears the digits when another fiat currency is picked', async () => {
        const { SettingsStore } = await renderPane();

        await pickInModal(() => (SettingsStore.settings.fiat = 'EUR'));

        expect(screen.getByTestId('amount')).toHaveTextContent('0');
    });

    it('keeps the digits when the modal closes without a change', async () => {
        await renderPane();

        await pickInModal(() => undefined);

        expect(screen.getByTestId('amount')).toHaveTextContent('25');
    });

    it('keeps the digits when the unit already in use is picked again', async () => {
        const { UnitsStore } = await renderPane();

        await pickInModal(() => (UnitsStore.units = 'sats'));

        expect(screen.getByTestId('amount')).toHaveTextContent('25');
    });
});
