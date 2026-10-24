import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../../components/Accordion', () => () => null);
jest.mock('../../../components/Header', () => () => null);
jest.mock('../../../components/Button', () => () => null);
jest.mock('../../../components/TextInput', () => () => null);
jest.mock('../../../components/LoadingIndicator', () => () => null);
jest.mock('../../../components/Switch', () => () => null);
jest.mock('../../../components/DropdownSetting', () => () => null);
jest.mock('../../../components/SuccessErrorMessage', () => ({
    ErrorMessage: () => null
}));
jest.mock('../../../components/text/Body', () => ({
    Body: ({ children }: any) => {
        const { Text } = require('react-native');
        return <Text>{children}</Text>;
    }
}));
jest.mock('@react-native-community/slider', () => () => null);
jest.mock('@rneui/themed', () => {
    const { Pressable } = require('react-native');
    return {
        ButtonGroup: () => null,
        Icon: ({ onPress, accessibilityLabel }: any) => (
            <Pressable
                onPress={onPress}
                accessibilityLabel={accessibilityLabel}
            />
        )
    };
});
jest.mock('../../../utils/ThemeUtils', () => ({
    themeColor: jest.fn(() => '#000')
}));
jest.mock('../../../utils/LocaleUtils', () => ({
    localeString: jest.fn((key: string) => key)
}));
jest.mock('../../../utils/BackendUtils', () => ({
    __esModule: true,
    default: {
        supportsMessageSigning: jest.fn(() => true),
        supportsCashuWallet: jest.fn(() => false)
    }
}));
jest.mock('../../../stores/NostrWalletConnectStore', () => ({
    __esModule: true,
    default: class {},
    DEFAULT_NOSTR_RELAYS: ['wss://relay.example']
}));
jest.mock('../../../stores/Stores', () => ({
    settingsStore: { settings: { display: {} }, implementation: 'lnd' },
    fiatStore: {},
    unitsStore: { units: 'sats' },
    notesStore: {}
}));
jest.mock('react-native-notifications', () => ({
    Notifications: { postLocalNotification: jest.fn() }
}));

import AddOrEditNWCConnection from './AddOrEditNWCConnection';
import NostrConnectUtils from '../../../utils/NostrConnectUtils';

const BUDGET = 'views.Settings.NostrWalletConnect.budget';
const INFO_LABEL =
    'views.Settings.NostrWalletConnect.budgetInfo.accessibilityLabel';

const renderScreen = async (
    connectionPermissions?: string[],
    relayUrl: string = 'wss://relay.example'
) => {
    const ref = React.createRef<any>();
    const ModalStore = { toggleInfoModal: jest.fn() };
    let onFocus: () => void = () => {};
    const NostrWalletConnectStore = {
        maxBudgetLimit: 0,
        maxBudgetSource: 'lightning',
        loadMaxBudget: jest.fn(() => Promise.resolve()),
        loadConnections: jest.fn(() => Promise.resolve()),
        getConnection: jest.fn(() => ({
            connection: {
                name: 'Test',
                permissions: connectionPermissions,
                relayUrl,
                createdAt: new Date(),
                expiresAt: undefined
            }
        }))
    };
    await render(
        <AddOrEditNWCConnection
            ref={ref}
            navigation={
                {
                    addListener: jest.fn((_: string, cb: () => void) => {
                        onFocus = cb;
                        return jest.fn();
                    })
                } as any
            }
            route={
                {
                    params: connectionPermissions
                        ? { connectionId: 'id', isEdit: true }
                        : {}
                } as any
            }
            NostrWalletConnectStore={NostrWalletConnectStore as any}
            ModalStore={ModalStore as any}
        />
    );
    await act(async () => {
        onFocus();
    });
    return { ModalStore, ref };
};

describe('AddOrEditNWCConnection budget info', () => {
    it('shows the info icon when pay_invoice is selected', async () => {
        await renderScreen();
        expect(screen.getByLabelText(INFO_LABEL)).toBeTruthy();
    });

    it('hides the info icon for Read Only', async () => {
        await renderScreen(NostrConnectUtils.getReadOnlyPermissions());
        expect(screen.queryByLabelText(INFO_LABEL)).toBeNull();
    });

    it('opens the info modal with the budget title and both paragraphs', async () => {
        const { ModalStore } = await renderScreen();
        fireEvent.press(screen.getByLabelText(INFO_LABEL));
        expect(ModalStore.toggleInfoModal).toHaveBeenCalledWith({
            title: BUDGET,
            text: [
                'views.Settings.NostrWalletConnect.budgetInfo.reason',
                'views.Settings.NostrWalletConnect.budgetInfo.limit'
            ]
        });
    });
});

describe('AddOrEditNWCConnection custom relay validation', () => {
    it('requires wss:// for a new custom relay', async () => {
        const { ref } = await renderScreen();
        const screenInstance = ref.current;

        expect(screenInstance.isValidRelayUrl('wss://relay.example.com')).toBe(
            true
        );
        expect(screenInstance.isValidRelayUrl('ws://relay.example.com')).toBe(
            false
        );
        expect(
            screenInstance.isValidRelayUrl(
                'ws://2gzyxa5ihm7nsggfxnu52rck2vv4rvmdlkiu3zzui5du4xyclen53wid.onion'
            )
        ).toBe(true);
    });

    it('keeps an existing ws:// relay valid when editing', async () => {
        const { ref } = await renderScreen(
            NostrConnectUtils.getReadOnlyPermissions(),
            'ws://relay.example.com'
        );
        const screenInstance = ref.current;

        expect(screenInstance.state.customRelayUrl).toBe(
            'ws://relay.example.com'
        );
        expect(screenInstance.isFormValid()).toBe(true);
        expect(screenInstance.isValidRelayUrl('ws://other.example.com')).toBe(
            false
        );
    });
});
