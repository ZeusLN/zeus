jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => ({ Icon: 'Icon' }));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('@react-native-documents/picker', () => ({
    saveDocuments: jest.fn()
}));
const mockAsyncStorage = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(async (key: string) => mockAsyncStorage.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
        mockAsyncStorage.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
        mockAsyncStorage.delete(key);
    })
}));
jest.mock('../../storage', () => ({
    __esModule: true,
    default: { getItem: jest.fn() }
}));
jest.mock('../../stores/Stores', () => ({}));
jest.mock('../../utils/BackendUtils', () => ({
    supportsFlowLSP: () => false,
    supportsOnchainSends: () => true
}));
jest.mock('../../utils/AddressUtils', () => ({}));
jest.mock('../../utils/NavigationUtils', () => ({
    reAuthNavigation: jest.fn()
}));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({ themeColor: () => '#000' }));
jest.mock('../../utils/FontUtils', () => ({ font: () => 'font' }));
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/ModalBox', () => {
    const { View } = require('react-native');
    return ({ isOpen, children }: any) =>
        isOpen ? <View>{children}</View> : null;
});
jest.mock('../../components/Text', () => {
    const { Text } = require('react-native');
    return ({ children }: any) => <Text>{children}</Text>;
});
jest.mock('../../components/Button', () => {
    const { Text } = require('react-native');
    return ({ title, onPress }: any) => <Text onPress={onPress}>{title}</Text>;
});
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/KeyValue', () => 'KeyValue');
jest.mock('../../components/Amount', () => 'Amount');
jest.mock('../../components/AddressInput', () => 'AddressInput');
jest.mock('../../components/AmountInput', () => 'AmountInput');
jest.mock('../../components/OnchainFeeInput', () => 'OnchainFeeInput');
jest.mock('../../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../../components/Switch', () => 'Switch');
jest.mock('../../components/SuccessErrorMessage', () => ({
    ErrorMessage: 'ErrorMessage',
    SuccessMessage: 'SuccessMessage'
}));
jest.mock('../../components/SVG/OnChainSvg', () => 'OnChainSvg');
jest.mock('../../components/SVG/LightningSvg', () => 'LightningSvg');
jest.mock('../../assets/images/SVG/Arrow_down.svg', () => 'ArrowDown');
jest.mock('../../assets/images/SVG/Caret Down.svg', () => 'CaretDown');
jest.mock('../../assets/images/SVG/Caret Right.svg', () => 'CaretRight');
jest.mock('../../assets/images/SVG/ExchangeBitcoin.svg', () => 'Exchange');
jest.mock('../../assets/images/SVG/ExchangeFiat.svg', () => 'ExchangeFiat');
jest.mock('../../assets/images/SVG/History.svg', () => 'History');
jest.mock('../../assets/images/SVG/Key.svg', () => 'KeyIcon');

import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import Storage from '../../storage';
import Swaps from './index';

const NOTICE = 'swaps-rescue-key-replaced';
const REPLACED_TEXT = 'views.Swaps.rescueKey.replaced';
const rescueKey =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

const storedRescueKey = (value: string | false) =>
    (Storage.getItem as jest.Mock).mockImplementation(async (key: string) =>
        key === 'swaps-rescue-key' ? value : false
    );

// Mounts the screen with the swap rates loaded, so the rescue key check
// in componentDidMount runs straight away
const renderView = async () => {
    const view = await render(
        <Swaps
            {...({
                navigation: {
                    addListener: jest.fn(() => jest.fn()),
                    navigate: jest.fn(),
                    goBack: jest.fn()
                },
                route: { params: undefined },
                SwapStore: {
                    loading: false,
                    subInfo: {},
                    reverseInfo: {},
                    getSwapFees: jest.fn(),
                    clearError: jest.fn(),
                    generateRescueKey: jest.fn()
                },
                UnitsStore: { units: 'sats', getNextUnit: () => 'sats' },
                InvoicesStore: {},
                FiatStore: { fiatRates: [] },
                SettingsStore: {
                    settings: {},
                    getSettings: jest
                        .fn()
                        .mockResolvedValue({ enableLSP: true }),
                    updateSettings: jest.fn()
                },
                FeeStore: {},
                NodeInfoStore: {
                    testnet: false,
                    flowLspNotConfigured: () => ({
                        flowLspNotConfigured: true
                    })
                },
                LSPStore: { resetFee: jest.fn(), getZeroConfFee: jest.fn() }
            } as any)}
        />
    );
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
    return view;
};

// The intro modal comes first; continuing opens the rescue key prompt
const openRescueKeyPrompt = async () => {
    await fireEvent.press(screen.getByText('views.Swaps.intro.continue'));
};

beforeEach(() => {
    mockAsyncStorage.clear();
    jest.clearAllMocks();
});

describe('Swaps rescue key notice', () => {
    it('explains that the rescue key was replaced when none is stored and the notice is set', async () => {
        storedRescueKey(false);
        mockAsyncStorage.set(NOTICE, 'true');

        await renderView();
        await openRescueKeyPrompt();

        expect(screen.getByText('views.Swaps.rescueKey.create')).toBeTruthy();
        expect(screen.getByText(REPLACED_TEXT)).toBeTruthy();
        expect(mockAsyncStorage.get(NOTICE)).toBe('true');
    });

    it('shows the normal prompt when none is stored and the notice is not set', async () => {
        storedRescueKey(false);

        await renderView();
        await openRescueKeyPrompt();

        expect(screen.getByText('views.Swaps.rescueKey.create')).toBeTruthy();
        expect(screen.queryByText(REPLACED_TEXT)).toBeNull();
    });

    it('clears the notice once a new rescue key is stored', async () => {
        storedRescueKey(rescueKey);
        mockAsyncStorage.set(NOTICE, 'true');

        await renderView();

        expect(AsyncStorage.removeItem).toHaveBeenCalledWith(NOTICE);
        expect(mockAsyncStorage.has(NOTICE)).toBe(false);
        expect(screen.queryByText('views.Swaps.intro.continue')).toBeNull();
        expect(screen.queryByText(REPLACED_TEXT)).toBeNull();
    });
});
