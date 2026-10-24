import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

const mockGetInfo = jest.fn();
const mockClose = jest.fn();
jest.mock('@getalby/sdk', () => ({
    NWCClient: jest.fn().mockImplementation(() => ({
        getInfo: mockGetInfo,
        close: mockClose
    }))
}));
// mobx-react's main entry needs react-dom; the stores arrive as props here
jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => ({ Icon: () => null }));
jest.mock('../../assets/images/SVG/zeus-pay.svg', () => () => null);
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/Header', () => () => null);
jest.mock('../../components/layout/Row', () => ({ Row: () => null }));
jest.mock('../../components/Button', () => {
    const { Pressable, Text } = require('react-native');
    return ({ title, onPress, disabled }: any) => (
        <Pressable role="button" onPress={onPress} disabled={disabled}>
            <Text>{title}</Text>
        </Pressable>
    );
});
jest.mock('../../components/TextInput', () => {
    const { TextInput } = require('react-native');
    return ({ value, onChangeText, placeholder }: any) => (
        <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
        />
    );
});
jest.mock('../../components/Text', () => {
    const { Text } = require('react-native');
    return ({ children }: any) => <Text>{children}</Text>;
});
jest.mock('../../components/LoadingIndicator', () => () => null);
jest.mock('../../components/SuccessErrorMessage', () => {
    const { Text } = require('react-native');
    return {
        SuccessMessage: ({ message }: any) => <Text>{message}</Text>,
        WarningMessage: ({ message }: any) => <Text>{message}</Text>,
        ErrorMessage: ({ message }: any) => <Text>{message}</Text>
    };
});
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: jest.fn((key: string) => `theme:${key}`)
}));
jest.mock('../../utils/LocaleUtils');

import CreateNWCLightningAddress from './CreateNWCLightningAddress';

const NWC_URL =
    'nostr+walletconnect://' +
    'b'.repeat(64) +
    '?relay=wss%3A%2F%2Frelay.example.com&secret=' +
    'a'.repeat(64);

const TEST_TITLE = 'views.Settings.LightningAddress.testConnectionString';
const CONTINUE_TITLE = 'views.LightningAddress.NWC.continueUnchecked';

const makeStore = () => ({
    loading: false,
    error_msg: '',
    testNWCConnectionString: jest.fn(() => Promise.resolve({ success: true })),
    createNWC: jest.fn(() => Promise.resolve({ success: true })),
    update: jest.fn(() => Promise.resolve({ success: true }))
});

const renderView = async (store: any) => {
    await render(
        <CreateNWCLightningAddress
            navigation={{ navigate: jest.fn(), popTo: jest.fn() } as any}
            route={{ params: {} } as any}
            LightningAddressStore={store}
            SettingsStore={{} as any}
        />
    );
    await fireEvent.changeText(
        screen.getByPlaceholderText('nostr+walletconnect://'),
        NWC_URL
    );
};

const press = async (title: string) =>
    fireEvent.press(screen.getByRole('button', { name: title }));

describe('CreateNWCLightningAddress connection permission check', () => {
    beforeEach(() => {
        mockGetInfo.mockReset();
        mockClose.mockReset();
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    it('does not send a connection that can pay to the server', async () => {
        mockGetInfo.mockResolvedValue({
            methods: ['get_info', 'make_invoice', 'pay_invoice', 'pay_keysend']
        });
        const store = makeStore();
        await renderView(store);
        await press(TEST_TITLE);

        expect(mockGetInfo).toHaveBeenCalledTimes(1);
        expect(mockClose).toHaveBeenCalledTimes(1);
        expect(store.testNWCConnectionString).not.toHaveBeenCalled();
        expect(
            screen.getByText('views.LightningAddress.NWC.scopeCanSpend')
        ).toBeTruthy();
    });

    it('does not send a connection that cannot make invoices', async () => {
        mockGetInfo.mockResolvedValue({
            methods: ['get_info', 'lookup_invoice']
        });
        const store = makeStore();
        await renderView(store);
        await press(TEST_TITLE);

        expect(store.testNWCConnectionString).not.toHaveBeenCalled();
        expect(
            screen.getByText(
                'views.LightningAddress.NWC.scopeMissingMakeInvoice'
            )
        ).toBeTruthy();
    });

    it('tests a receive-only connection with the server', async () => {
        mockGetInfo.mockResolvedValue({
            methods: ['get_info', 'make_invoice', 'lookup_invoice']
        });
        const store = makeStore();
        await renderView(store);
        await press(TEST_TITLE);

        expect(store.testNWCConnectionString).toHaveBeenCalledWith(NWC_URL);
    });

    it('asks for confirmation when the permissions cannot be checked', async () => {
        mockGetInfo.mockRejectedValue(new Error('RESTRICTED'));
        const store = makeStore();
        await renderView(store);
        await press(TEST_TITLE);

        expect(store.testNWCConnectionString).not.toHaveBeenCalled();
        expect(
            screen.getByText('views.LightningAddress.NWC.scopeUnknown')
        ).toBeTruthy();

        await press(CONTINUE_TITLE);
        expect(mockGetInfo).toHaveBeenCalledTimes(1);
        expect(store.testNWCConnectionString).toHaveBeenCalledWith(NWC_URL);
    });

    it('checks again after the connection string is edited', async () => {
        mockGetInfo.mockRejectedValueOnce(new Error('timeout'));
        mockGetInfo.mockResolvedValueOnce({
            methods: ['make_invoice', 'pay_invoice']
        });
        const store = makeStore();
        await renderView(store);
        await press(TEST_TITLE);
        expect(
            screen.getByRole('button', { name: CONTINUE_TITLE })
        ).toBeTruthy();

        await fireEvent.changeText(
            screen.getByPlaceholderText('nostr+walletconnect://'),
            NWC_URL + ' '
        );
        await press(TEST_TITLE);

        expect(mockGetInfo).toHaveBeenCalledTimes(2);
        expect(store.testNWCConnectionString).not.toHaveBeenCalled();
    });
});
