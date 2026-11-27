jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../stores/Stores', () => ({}));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('react-native-randombytes', () => ({
    randomBytes: (n: number) => jest.requireActual('crypto').randomBytes(n)
}));
jest.mock('../../utils/BackendUtils', () => ({
    __esModule: true,
    default: {
        isLNDBased: () => false,
        supportsOnchainSendMax: () => true,
        sendCoins: jest.fn()
    }
}));
jest.mock('../../utils/LocaleUtils', () => ({
    localeString: (s: string) => s
}));
jest.mock('../../utils/UrlUtils', () => ({ __esModule: true, default: {} }));
jest.mock('../../utils/ThemeUtils', () => ({ themeColor: () => '#000000' }));
jest.mock('../../utils/AddressUtils', () => ({
    __esModule: true,
    default: { isValidBitcoinAddressForNode: () => true }
}));
jest.mock('../../components/Screen', () => 'Screen');
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/Amount', () => 'Amount');
jest.mock('../../components/TextInput', () => 'TextInput');
jest.mock('../../components/OnchainFeeInput', () => 'OnchainFeeInput');
jest.mock('../../components/SuccessErrorMessage', () => ({
    WarningMessage: 'WarningMessage'
}));
jest.mock('../../components/OnchainSendInFlightNotice', () => {
    const { Text } = require('react-native');
    return ({ TransactionsStore }: any) =>
        TransactionsStore.onchainSendInFlight ? (
            <Text>OnchainSendInFlightNotice</Text>
        ) : null;
});
// ignores `disabled` so a test can press as a tap landing in the same
// frame the guard was taken would; the prop is checked on its own
const mockButtonProps: { current: any } = { current: null };
jest.mock('../../components/Button', () => {
    const { Pressable, Text } = require('react-native');
    return (props: any) => {
        mockButtonProps.current = props;
        return (
            <Pressable onPress={props.onPress}>
                <Text>{props.title}</Text>
            </Pressable>
        );
    };
});

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import Sweep from './Sweep';
import TransactionsStore from '../../stores/TransactionsStore';
import BackendUtils from '../../utils/BackendUtils';

const sendCoins = BackendUtils.sendCoins as jest.Mock;
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const newStore = () =>
    new TransactionsStore(
        { implementation: 'lnd', settings: {} } as any,
        { nodeInfo: { currentBlockHeight: 800000 } } as any,
        { resetOpenChannel: jest.fn() } as any,
        { getCombinedBalance: jest.fn() } as any,
        {} as any
    );

const focusListeners: Array<() => void> = [];
const removeFocusListener = jest.fn();
const navigation = {
    navigate: jest.fn(),
    addListener: jest.fn((event: string, listener: () => void) => {
        if (event === 'focus') focusListeners.push(listener);
        return removeFocusListener;
    })
};
const focus = () => focusListeners.forEach((listener) => listener());

const renderSweep = (
    store: TransactionsStore,
    { implementation = 'lnd', confirmedBlockchainBalance = 100000 } = {}
) =>
    render(
        <Sweep
            {...({
                navigation,
                route: { params: { destination: 'bc1qdestination' } },
                TransactionsStore: store,
                SettingsStore: { implementation },
                BalanceStore: {
                    confirmedBlockchainBalance,
                    unconfirmedBlockchainBalance: 0
                }
            } as any)}
        />
    );

const pressSend = () =>
    fireEvent.press(screen.getByText('views.Send.sendCoins'));

describe('Sweep', () => {
    beforeEach(() => {
        sendCoins.mockReset();
        navigation.navigate.mockReset();
        removeFocusListener.mockReset();
        focusListeners.length = 0;
        mockButtonProps.current = null;
    });

    it('sweeps with send_all on LND', async () => {
        sendCoins.mockReturnValue(new Promise(() => undefined));
        await renderSweep(newStore());

        await pressSend();

        expect(sendCoins).toHaveBeenCalledWith({
            addr: 'bc1qdestination',
            sat_per_vbyte: '2',
            send_all: true,
            spend_unconfirmed: true
        });
        expect(navigation.navigate).toHaveBeenCalledWith('SendingOnChain');
    });

    it("sweeps with amount 'all' on CLN", async () => {
        sendCoins.mockReturnValue(new Promise(() => undefined));
        await renderSweep(newStore(), { implementation: 'cln-rest' });

        await pressSend();

        expect(sendCoins).toHaveBeenCalledWith({
            addr: 'bc1qdestination',
            sat_per_vbyte: '2',
            amount: 'all',
            spend_unconfirmed: true
        });
    });

    it('sends once when Send Coins is pressed twice', async () => {
        sendCoins.mockReturnValue(new Promise(() => undefined));
        await renderSweep(newStore());

        await pressSend();
        await pressSend();

        expect(sendCoins).toHaveBeenCalledTimes(1);
        expect(navigation.navigate).toHaveBeenCalledTimes(1);
    });

    // a local node can answer before SendingOnChain covers the screen; a
    // second send_all would fail on the spent wallet and replace the success
    it('sends once when the first sweep answers before the second press', async () => {
        sendCoins.mockResolvedValueOnce({ txid: 'txid1' });
        sendCoins.mockRejectedValueOnce(new Error('insufficient funds'));
        const store = newStore();
        await renderSweep(store);

        await pressSend();
        await flush();
        expect(store.onchainSendInFlight).toBe(false);
        await pressSend();
        await flush();

        expect(sendCoins).toHaveBeenCalledTimes(1);
        expect(store.publishSuccess).toBe(true);
        expect(store.error).toBe(false);
    });

    it('sweeps again after coming back to the screen (Try Again)', async () => {
        sendCoins.mockRejectedValueOnce(new Error('insufficient funds'));
        sendCoins.mockResolvedValueOnce({ txid: 'txid2' });
        const store = newStore();
        await renderSweep(store);

        await pressSend();
        await flush();
        expect(store.error).toBe(true);

        focus();
        await pressSend();

        expect(sendCoins).toHaveBeenCalledTimes(2);
    });

    it('disables Send Coins and explains why while a send is in flight', async () => {
        const store = newStore();
        store.onchainSendInFlight = true;
        await renderSweep(store);

        expect(mockButtonProps.current.disabled).toBe(true);
        expect(screen.getByText('OnchainSendInFlightNotice')).toBeTruthy();
    });

    it('enables Send Coins when no send is in flight', async () => {
        await renderSweep(newStore());

        expect(mockButtonProps.current.disabled).toBe(false);
        expect(screen.queryByText('OnchainSendInFlightNotice')).toBeNull();
    });

    // Android back leaves SendingOnChain while a send is loading, and a
    // wallet switch keeps the store's guard. A sweep started then would be
    // refused by the store and land on a blank SendingOnChain, or on the
    // earlier send's outcome shown as the sweep's
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
        store.reset();
        await renderSweep(store);

        await pressSend();

        expect(sendCoins).toHaveBeenCalledTimes(1);
        expect(navigation.navigate).not.toHaveBeenCalled();

        // the earlier send settles and the screen can sweep
        resolveEarlier({ txid: 'txid-earlier' });
        await flush();
        sendCoins.mockReturnValueOnce(new Promise(() => undefined));
        await pressSend();

        expect(sendCoins).toHaveBeenCalledTimes(2);
        expect(sendCoins.mock.calls[1][0].addr).toBe('bc1qdestination');
        expect(navigation.navigate).toHaveBeenCalledWith('SendingOnChain');
    });

    it('removes the focus listener on unmount', async () => {
        const { unmount } = await renderSweep(newStore());

        await unmount();

        expect(removeFocusListener).toHaveBeenCalledTimes(1);
    });
});
