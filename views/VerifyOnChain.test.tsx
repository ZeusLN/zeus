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
// keeps the props so a test can fire onSwipeSuccess on a disabled swipe,
// as a swipe finishing in the same frame the guard was taken would
const mockSwipeProps: { current: any } = { current: null };
jest.mock('../components/SwipeButton', () => (props: any) => {
    mockSwipeProps.current = props;
    return null;
});
jest.mock('../components/OnchainSendInFlightNotice', () => {
    const { Text } = require('react-native');
    return ({ TransactionsStore }: any) =>
        TransactionsStore.onchainSendInFlight ? (
            <Text>OnchainSendInFlightNotice</Text>
        ) : null;
});
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

const renderConfirm = (store: TransactionsStore, amount = 5000) =>
    render(
        <VerifyOnChain
            {...({
                navigation,
                route: {
                    params: {
                        destination: 'bc1qrecipient',
                        amount: String(amount),
                        satAmount: amount,
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
        navigation.navigate.mockReset();
        focusListeners.length = 0;
        mockSwipeProps.current = null;
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

    it('explains why Send Coins is disabled while a send is in flight', async () => {
        const store = newStore();
        store.onchainSendInFlight = true;
        await renderConfirm(store);

        expect(screen.getByText('OnchainSendInFlightNotice')).toBeTruthy();
    });

    describe('slide to pay', () => {
        // at or above slideToPayThreshold (10000 here)
        const swipeAmount = 20000;
        const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

        it('disables the swipe while a send is in flight', async () => {
            const store = newStore();
            store.onchainSendInFlight = true;
            await renderConfirm(store, swipeAmount);
            await flush();

            expect(mockSwipeProps.current.disabled).toBe(true);
        });

        it('sends once when the swipe fires twice', async () => {
            sendCoins.mockReturnValue(new Promise(() => undefined));
            const store = newStore();
            await renderConfirm(store, swipeAmount);
            await flush();

            mockSwipeProps.current.onSwipeSuccess();
            mockSwipeProps.current.onSwipeSuccess();

            expect(sendCoins).toHaveBeenCalledTimes(1);
            expect(navigation.navigate).toHaveBeenCalledTimes(1);
        });

        // Android back leaves SendingOnChain while a send is loading. A new
        // send started then would be refused by the store, and SendingOnChain
        // would show the earlier send's success and txid as this one's
        it('stays on the screen while an earlier send is in flight', async () => {
            let resolveEarlier: (value: any) => void = () => undefined;
            sendCoins.mockReturnValueOnce(
                new Promise((resolve) => (resolveEarlier = resolve))
            );
            const store = newStore();
            store.sendCoins({
                addr: 'bc1qearlier',
                amount: '5000',
                sat_per_vbyte: '2',
                account: 'default'
            } as any);
            await renderConfirm(store, swipeAmount);
            await flush();

            mockSwipeProps.current.onSwipeSuccess();

            expect(sendCoins).toHaveBeenCalledTimes(1);
            expect(navigation.navigate).not.toHaveBeenCalled();

            // the earlier send settles and the screen can send
            resolveEarlier({ txid: 'txid-earlier' });
            await flush();
            sendCoins.mockReturnValueOnce(new Promise(() => undefined));
            mockSwipeProps.current.onSwipeSuccess();

            expect(sendCoins).toHaveBeenCalledTimes(2);
            expect(sendCoins.mock.calls[1][0].addr).toBe('bc1qrecipient');
            expect(navigation.navigate).toHaveBeenCalledWith('SendingOnChain');
        });
    });
});
