jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../stores/Stores');
jest.mock('../../utils/AddressUtils', () => ({
    isValidBitcoinAddressForNode: () => true
}));
jest.mock('../../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../../utils/ThemeUtils', () => ({ themeColor: () => '#000' }));
jest.mock('../../assets/images/SVG/QR.svg', () => 'QR');
jest.mock('../../components/Amount', () => 'Amount');
jest.mock('../../components/Button', () => {
    const { Text, TouchableOpacity } = require('react-native');
    return ({ title, onPress, disabled }: any) => (
        <TouchableOpacity
            accessibilityRole="button"
            onPress={onPress}
            disabled={disabled}
        >
            <Text>{title}</Text>
        </TouchableOpacity>
    );
});
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/KeyValue', () => 'KeyValue');
jest.mock('../../components/OnchainFeeInput', () => {
    const { TextInput } = require('react-native');
    return ({ fee, onChangeFee }: any) => (
        <TextInput testID="fee" value={fee} onChangeText={onChangeFee} />
    );
});
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/SuccessErrorMessage', () => ({
    WarningMessage: 'WarningMessage'
}));
jest.mock('../../components/SwipeButton', () => 'SwipeButton');
jest.mock('../../components/Text', () => require('react-native').Text);
jest.mock('../../components/TextInput', () => 'TextInput');

import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import Sweep from './Sweep';
import VerifyOnChain from '../VerifyOnChain';

const DESTINATION = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';

const hosts = (type: string) =>
    screen.container.queryAll((n: any) => n.type === type);

const renderSweep = async (
    implementation = 'lnd',
    fee?: string,
    balances = { confirmed: 1500000, unconfirmed: 250000 }
) => {
    const navigation = { navigate: jest.fn() };
    await render(
        <Sweep
            {...({
                navigation,
                route: { params: { destination: DESTINATION } },
                BalanceStore: {
                    confirmedBlockchainBalance: balances.confirmed,
                    unconfirmedBlockchainBalance: balances.unconfirmed
                },
                SettingsStore: { implementation },
                InvoicesStore: {},
                ModalStore: {}
            } as any)}
        />
    );
    if (fee !== undefined) {
        await fireEvent.changeText(screen.getByTestId('fee'), fee);
    }
    await fireEvent.press(screen.getByText('general.proceed'));
    return navigation;
};

// renders VerifyOnChain with the params Sweep navigated to it with
const renderVerifyOnChain = async (implementation: string, params: any) => {
    const TransactionsStore = { sendCoins: jest.fn() };
    const navigation = { navigate: jest.fn() };
    await render(
        <VerifyOnChain
            {...({
                navigation,
                route: { name: 'VerifyOnChain', params },
                TransactionsStore,
                SettingsStore: {
                    implementation,
                    getSettings: async () => ({
                        payments: { slideToPayThreshold: 10000 }
                    })
                },
                UnitsStore: {}
            } as any)}
        />
    );
    return { TransactionsStore, navigation };
};

describe('Sweep', () => {
    it('confirms on VerifyOnChain with the whole balance, destination and fee rate', async () => {
        const navigation = await renderSweep();

        expect(navigation.navigate).toHaveBeenCalledTimes(1);
        expect(navigation.navigate).toHaveBeenCalledWith('VerifyOnChain', {
            destination: DESTINATION,
            fee: '2',
            satAmount: '1750000',
            fundMax: true
        });
    });

    it('quotes only the confirmed balance on CLNRest', async () => {
        const navigation = await renderSweep('cln-rest');

        expect(navigation.navigate).toHaveBeenCalledWith(
            'VerifyOnChain',
            expect.objectContaining({ satAmount: '1500000' })
        );
    });

    // CLN's withdraw spends confirmed outputs only
    it('does not offer to proceed on CLNRest while the whole balance is unconfirmed', async () => {
        const navigation = await renderSweep('cln-rest', undefined, {
            confirmed: 0,
            unconfirmed: 250000
        });

        expect(navigation.navigate).not.toHaveBeenCalled();
        // the balance is not missing, so no "no on-chain balance" warning
        expect(hosts('WarningMessage')).toHaveLength(0);
    });

    it('sweeps a balance that is all unconfirmed on LND', async () => {
        const navigation = await renderSweep('lnd', undefined, {
            confirmed: 0,
            unconfirmed: 250000
        });

        expect(navigation.navigate).toHaveBeenCalledWith(
            'VerifyOnChain',
            expect.objectContaining({ satAmount: '250000' })
        );
    });

    it.each(['lnd', 'cln-rest'])(
        'does not offer to proceed with no balance (%s)',
        async (implementation) => {
            const navigation = await renderSweep(implementation, undefined, {
                confirmed: 0,
                unconfirmed: 0
            });

            expect(navigation.navigate).not.toHaveBeenCalled();
            expect(hosts('WarningMessage')).toHaveLength(1);
        }
    );

    it.each(['', '0', '-1', 'abc', '2001', '2.5', '1e3', '0x10', ' 2'])(
        'does not offer to proceed at a fee rate of %p',
        async (fee) => {
            const navigation = await renderSweep('lnd', fee);

            expect(navigation.navigate).not.toHaveBeenCalled();
        }
    );

    it('passes on a fee rate typed into the fee field', async () => {
        const navigation = await renderSweep('lnd', '15');

        expect(navigation.navigate).toHaveBeenCalledWith(
            'VerifyOnChain',
            expect.objectContaining({ fee: '15' })
        );
    });

    it('shows the swept balance, destination and fee rate on VerifyOnChain', async () => {
        const sweepNavigation = await renderSweep();
        await renderVerifyOnChain(
            'lnd',
            sweepNavigation.navigate.mock.calls[0][1]
        );

        const keyValue = (key: string) =>
            hosts('KeyValue').find((n: any) => n.props.keyValue === key)!.props
                .value;
        expect(
            hosts('Amount').find((n: any) => n.props.jumboText)!.props.sats
        ).toBe('1750000');
        expect(keyValue('general.destination')).toBe(DESTINATION);
        expect(keyValue('views.Send.feeSatsVbyte')).toBe('2');
    });

    it.each([
        ['lnd', { send_all: true }],
        ['cln-rest', { amount: 'all' }]
    ])(
        'sends the whole balance once confirmed on VerifyOnChain (%s)',
        async (implementation, sendAll) => {
            const sweepNavigation = await renderSweep(implementation);
            const { TransactionsStore, navigation } = await renderVerifyOnChain(
                implementation,
                sweepNavigation.navigate.mock.calls[0][1]
            );

            expect(TransactionsStore.sendCoins).not.toHaveBeenCalled();
            // the balance is above the slide to pay threshold
            await act(async () => {
                hosts('SwipeButton')[0].props.onSwipeSuccess();
            });

            // the request Sweep sent itself before it confirmed on
            // VerifyOnChain; the backends drop the account and
            // additional_outputs keys VerifyOnChain adds, which are undefined
            expect(TransactionsStore.sendCoins).toHaveBeenCalledTimes(1);
            expect(TransactionsStore.sendCoins).toHaveBeenCalledWith({
                addr: DESTINATION,
                sat_per_vbyte: '2',
                spend_unconfirmed: true,
                ...sendAll
            });
            expect(navigation.navigate).toHaveBeenCalledWith('SendingOnChain');
        }
    );

    it('sends from the button on VerifyOnChain below the slide to pay threshold', async () => {
        const sweepNavigation = await renderSweep('lnd', undefined, {
            confirmed: 9999,
            unconfirmed: 0
        });
        const { TransactionsStore } = await renderVerifyOnChain(
            'lnd',
            sweepNavigation.navigate.mock.calls[0][1]
        );

        expect(hosts('SwipeButton')).toHaveLength(0);
        await fireEvent.press(screen.getByText('views.Send.sendCoins'));

        expect(TransactionsStore.sendCoins).toHaveBeenCalledTimes(1);
        expect(TransactionsStore.sendCoins).toHaveBeenCalledWith(
            expect.objectContaining({ addr: DESTINATION, send_all: true })
        );
    });
});
