import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

// mobx-react's main entry needs react-dom; the stores arrive as props here
jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../../components/Header', () => () => null);
jest.mock('../../../components/Amount', () => () => null);
jest.mock('../../../components/LoadingIndicator', () => () => null);
jest.mock('../../../assets/images/SVG/Filter On.svg', () => 'Filter');
jest.mock('@rneui/themed', () => {
    const { Text, TouchableOpacity, View } = require('react-native');
    const ListItem: any = ({ children, onPress }: any) => (
        <TouchableOpacity onPress={onPress}>{children}</TouchableOpacity>
    );
    ListItem.Content = ({ children }: any) => <View>{children}</View>;
    ListItem.Title = ({ children }: any) => <Text>{children}</Text>;
    ListItem.Subtitle = ({ children }: any) => <Text>{children}</Text>;
    return { Button: () => null, ListItem };
});
jest.mock('../../../models/Invoice', () => class Invoice {});
jest.mock('../../../models/CashuInvoice', () => class CashuInvoice {});
jest.mock('../../../utils/ThemeUtils', () => ({
    themeColor: jest.fn(() => '#000')
}));
jest.mock('../../../utils/LocaleUtils');
jest.mock('../../../utils/PrivacyUtils', () => ({
    sensitiveValue: ({ input }: any) => input
}));
jest.mock('../../../utils/DateTimeUtils', () => ({
    listFormattedDateShort: () => 'date'
}));
jest.mock('../../../utils/NostrConnectUtils', () => ({
    canReleasePayInvoiceHold: jest.fn()
}));

import NostrConnectUtils from '../../../utils/NostrConnectUtils';
import NWCConnectionActivity from './NWCConnectionActivity';

const IN_TRANSIT = 'views.Payment.inTransitPayment';
const RELEASE = 'views.Settings.NostrWalletConnect.releaseHold.button';
const RELEASED = 'views.Settings.NostrWalletConnect.releaseHold.released';

const canRelease = NostrConnectUtils.canReleasePayInvoiceHold as jest.Mock;

const renderActivity = async (activity: any[]) => {
    let onFocus: () => Promise<void> = async () => undefined;
    const navigation = {
        addListener: jest.fn((_event: string, callback: any) => {
            onFocus = callback;
            return jest.fn();
        }),
        navigate: jest.fn(),
        setParams: jest.fn()
    };
    const NostrWalletConnectStore = {
        getActivities: jest.fn(async () => ({ name: 'App', activity })),
        releasePayInvoiceHold: jest.fn((_connectionId: string, id: string) => {
            const row = activity.find((a) => a.id === id);
            row.isHoldReleased = true;
            return true;
        })
    };
    const ModalStore = { toggleInfoModal: jest.fn() };

    await render(
        <NWCConnectionActivity
            navigation={navigation as any}
            route={{ params: { connectionId: 'conn-1' } } as any}
            NostrWalletConnectStore={NostrWalletConnectStore as any}
            SettingsStore={{} as any}
            ModalStore={ModalStore as any}
        />
    );
    await act(async () => onFocus());

    return { navigation, NostrWalletConnectStore, ModalStore };
};

const stuckPayment = () => ({
    id: 'lnbc1stuck',
    type: 'pay_invoice',
    payment_source: 'lightning',
    status: 'pending',
    satAmount: 1000,
    paymentHash: 'ab'.repeat(32),
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
});

describe('NWCConnectionActivity pay_invoice hold release', () => {
    beforeEach(() => {
        canRelease.mockReset();
    });

    it('offers to release the hold of a stuck payment and releases it', async () => {
        canRelease.mockReturnValue(true);
        const { NostrWalletConnectStore, ModalStore, navigation } =
            await renderActivity([stuckPayment()]);
        expect(screen.queryByText(RELEASED)).not.toBeOnTheScreen();

        await fireEvent.press(screen.getByText(IN_TRANSIT));

        expect(navigation.navigate).not.toHaveBeenCalled();
        const { buttons } = ModalStore.toggleInfoModal.mock.calls[0][0];
        // no payment details to open yet
        expect(buttons.map((b: any) => b.title)).toEqual([RELEASE]);

        await act(async () => buttons[0].callback());

        expect(
            NostrWalletConnectStore.releasePayInvoiceHold
        ).toHaveBeenCalledWith('conn-1', 'lnbc1stuck', 'ab'.repeat(32));
        expect(screen.getByText(RELEASED)).toBeOnTheScreen();
    });

    it('does not say the hold is released once the payment has settled', async () => {
        canRelease.mockReturnValue(false);
        await renderActivity([
            {
                ...stuckPayment(),
                status: 'success',
                isHoldReleased: true,
                isBudgetDebited: true
            }
        ]);

        expect(screen.queryByText(RELEASED)).not.toBeOnTheScreen();
    });

    it('opens the payment of a pending payment whose hold cannot be released', async () => {
        canRelease.mockReturnValue(false);
        const payment = { getAmount: 1000 };
        const { ModalStore, navigation } = await renderActivity([
            { ...stuckPayment(), payment }
        ]);

        await fireEvent.press(screen.getByText(IN_TRANSIT));

        expect(ModalStore.toggleInfoModal).not.toHaveBeenCalled();
        expect(navigation.navigate).toHaveBeenCalledWith('Payment', {
            payment
        });
    });
});
