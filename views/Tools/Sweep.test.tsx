jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../stores/Stores');
jest.mock('../../utils/AddressUtils', () => ({
    isValidBitcoinAddressForNode: () => true
}));
jest.mock('../../utils/LocaleUtils', () => ({
    localeString: (key: string) =>
        key === 'views.Sweep.confirm'
            ? 'Send {amount} to {destination} at {fee}'
            : key
}));
jest.mock('../../utils/ThemeUtils', () => ({ themeColor: () => '#000' }));
jest.mock('../../components/Amount', () => 'Amount');
jest.mock('../../components/Button', () => {
    const { Text, TouchableOpacity } = require('react-native');
    return ({ title, onPress }: any) => (
        <TouchableOpacity accessibilityRole="button" onPress={onPress}>
            <Text>{title}</Text>
        </TouchableOpacity>
    );
});
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/OnchainFeeInput', () => 'OnchainFeeInput');
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/SuccessErrorMessage', () => ({
    WarningMessage: 'WarningMessage'
}));
jest.mock('../../components/TextInput', () => 'TextInput');

import * as React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import Sweep from './Sweep';

const DESTINATION = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';

const renderSweep = async (implementation = 'lnd') => {
    const TransactionsStore = { sendCoins: jest.fn() };
    const navigation = { navigate: jest.fn() };
    await render(
        <Sweep
            {...({
                navigation,
                route: { params: { destination: DESTINATION } },
                BalanceStore: {
                    confirmedBlockchainBalance: 1500000,
                    unconfirmedBlockchainBalance: 250000
                },
                SettingsStore: { implementation },
                TransactionsStore,
                InvoicesStore: {},
                ModalStore: {}
            } as any)}
        />
    );
    await fireEvent.press(screen.getByText('views.Send.sendCoins'));
    return { TransactionsStore, navigation };
};

// presses the Alert button with the given locale key
const pressAlertButton = async (text: string) => {
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
    await act(async () => {
        buttons.find((b: any) => b.text === text).onPress();
    });
};

describe('Sweep', () => {
    beforeEach(() => {
        jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    });

    afterEach(() => jest.restoreAllMocks());

    it('asks for confirmation with amount, destination and fee rate before sending', async () => {
        const { TransactionsStore, navigation } = await renderSweep();

        expect(TransactionsStore.sendCoins).not.toHaveBeenCalled();
        expect(navigation.navigate).not.toHaveBeenCalled();
        expect(Alert.alert).toHaveBeenCalledTimes(1);
        expect((Alert.alert as jest.Mock).mock.calls[0][1]).toBe(
            `Send 1,750,000 to ${DESTINATION} at 2`
        );
    });

    it('sends everything once confirmed', async () => {
        const { TransactionsStore, navigation } = await renderSweep();

        await pressAlertButton('general.confirm');

        expect(TransactionsStore.sendCoins).toHaveBeenCalledWith({
            addr: DESTINATION,
            sat_per_vbyte: '2',
            send_all: true,
            spend_unconfirmed: true
        });
        expect(navigation.navigate).toHaveBeenCalledWith('SendingOnChain');
    });

    it('uses amount all on CLNRest once confirmed', async () => {
        const { TransactionsStore } = await renderSweep('cln-rest');

        await pressAlertButton('general.confirm');

        expect(TransactionsStore.sendCoins).toHaveBeenCalledWith({
            addr: DESTINATION,
            sat_per_vbyte: '2',
            amount: 'all',
            spend_unconfirmed: true
        });
    });

    it('sends nothing when cancelled', async () => {
        const { TransactionsStore, navigation } = await renderSweep();

        await pressAlertButton('general.cancel');

        expect(TransactionsStore.sendCoins).not.toHaveBeenCalled();
        expect(navigation.navigate).not.toHaveBeenCalled();
    });
});
