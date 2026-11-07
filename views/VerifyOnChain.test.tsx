jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../stores/Stores', () => ({}));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('react-native-randombytes', () => ({
    randomBytes: (n: number) => jest.requireActual('crypto').randomBytes(n)
}));
jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: {
        isLNDBased: () => false,
        supportsOnchainSendMax: () => true,
        sendCoins: jest.fn()
    }
}));
jest.mock('../utils/LocaleUtils', () => ({ localeString: (s: string) => s }));
jest.mock('../utils/ThemeUtils', () => ({ themeColor: () => '#000000' }));
jest.mock('../utils/UrlUtils', () => ({ __esModule: true, default: {} }));
jest.mock('../utils/GraphSyncUtils', () => ({
    checkGraphSyncBeforePayment: () => true
}));
jest.mock('../assets/images/SVG/QR.svg', () => 'QR');
jest.mock('../components/Screen', () => 'Screen');
jest.mock('../components/Header', () => 'Header');
jest.mock('../components/KeyValue', () => 'KeyValue');
jest.mock('../components/Amount', () => 'Amount');
jest.mock('../components/Text', () => 'Text');
jest.mock('../components/SwipeButton', () => 'SwipeButton');
jest.mock('../components/Button', () => {
    const { Pressable, Text } = require('react-native');
    return ({ title, onPress, disabled }: any) => (
        <Pressable role="button" onPress={onPress} disabled={disabled}>
            <Text>{title}</Text>
        </Pressable>
    );
});

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import VerifyOnChain from './VerifyOnChain';
import TransactionsStore from '../stores/TransactionsStore';
import BackendUtils from '../utils/BackendUtils';

const sendCoins = BackendUtils.sendCoins as jest.Mock;

const newStore = () =>
    new TransactionsStore(
        { implementation: 'lnd', settings: {} } as any,
        { nodeInfo: { currentBlockHeight: 800000 } } as any,
        { resetOpenChannel: jest.fn() } as any,
        { getCombinedBalance: jest.fn() } as any,
        {} as any
    );

const focusListeners: Array<() => void> = [];
const navigation = {
    navigate: jest.fn(),
    addListener: jest.fn((event: string, listener: () => void) => {
        if (event === 'focus') focusListeners.push(listener);
        return jest.fn();
    })
};
const focus = () => focusListeners.forEach((listener) => listener());

const renderConfirm = (store: TransactionsStore) =>
    render(
        <VerifyOnChain
            {...({
                navigation,
                route: {
                    params: {
                        destination: 'bc1qrecipient',
                        amount: '5000',
                        satAmount: 5000,
                        fee: '2',
                        utxos: [],
                        account: 'default',
                        additionalOutputs: [],
                        fundMax: false
                    }
                },
                TransactionsStore: store,
                SettingsStore: {
                    implementation: 'lnd',
                    getSettings: async () => ({
                        payments: { slideToPayThreshold: 10000 }
                    })
                },
                UnitsStore: { units: 'sats', changeUnits: jest.fn() }
            } as any)}
        />
    );

describe('VerifyOnChain', () => {
    beforeEach(() => {
        sendCoins.mockReset();
        focusListeners.length = 0;
    });

    it('sends once when the first send answers before the second press', async () => {
        // a local node can answer before SendingOnChain covers the screen
        sendCoins.mockResolvedValue({ txid: 'txid1' });
        const store = newStore();
        await renderConfirm(store);

        const button = screen.getByText('views.Send.sendCoins');
        await fireEvent.press(button);
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(store.onchainSendInFlight).toBe(false);
        await fireEvent.press(button);

        expect(sendCoins).toHaveBeenCalledTimes(1);
    });

    it('sends again after coming back to the screen (Try Again)', async () => {
        sendCoins.mockRejectedValueOnce(new Error('insufficient funds'));
        sendCoins.mockResolvedValueOnce({ txid: 'txid2' });
        const store = newStore();
        await renderConfirm(store);

        const button = screen.getByText('views.Send.sendCoins');
        await fireEvent.press(button);
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(store.error).toBe(true);

        focus();
        await fireEvent.press(button);

        expect(sendCoins).toHaveBeenCalledTimes(2);
    });

    it('sends once when Send Coins is pressed twice', async () => {
        sendCoins.mockReturnValue(new Promise(() => undefined));
        const store = newStore();
        await renderConfirm(store);

        const button = screen.getByText('views.Send.sendCoins');
        await fireEvent.press(button);
        await fireEvent.press(button);

        expect(sendCoins).toHaveBeenCalledTimes(1);
    });

    it('disables Send Coins while a send is in flight', async () => {
        const store = newStore();
        store.onchainSendInFlight = true;
        await renderConfirm(store);

        expect(
            screen.getByRole('button', { name: 'views.Send.sendCoins' })
        ).toBeDisabled();
    });
});
