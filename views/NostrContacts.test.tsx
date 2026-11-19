jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => ({ CheckBox: 'CheckBox' }));
jest.mock('../components/SharedTransition', () => ({
    SharedScreen: 'SharedScreen',
    SharedText: 'SharedText'
}));
jest.mock('../components/Button', () => {
    const { Pressable, Text } = require('react-native');
    return ({ title, onPress, disabled }: any) => (
        <Pressable role="button" onPress={onPress} disabled={disabled}>
            <Text>{title}</Text>
        </Pressable>
    );
});
jest.mock('../components/Header', () => 'Header');
jest.mock('../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../components/TextInput', () => {
    const { TextInput } = require('react-native');
    return (props: any) => <TextInput {...props} />;
});
jest.mock('../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../components/SuccessErrorMessage', () => {
    const { Text } = require('react-native');
    return { ErrorMessage: ({ message }: any) => <Text>{message}</Text> };
});
jest.mock('../components/layout/Row', () => ({ Row: 'Row' }));
jest.mock('../components/ContactAvatar', () => ({
    ContactAvatar: 'ContactAvatar'
}));
// a NIP-05 identifier is shaped like a lightning address
jest.mock('../utils/AddressUtils', () => ({
    isValidNpub: (text: string) => text.startsWith('npub1'),
    isValidLightningAddress: (text: string) => /^[^@\s]+@[^@\s]+$/.test(text)
}));
jest.mock('../utils/ContactUtils', () => ({}));
jest.mock('../utils/LocaleUtils');
jest.mock('../utils/ThemeUtils', () => ({ themeColor: () => '#ffffff' }));
jest.mock('../storage', () => ({}));
jest.mock('../stores/SettingsStore', () => ({
    DEFAULT_NOSTR_RELAYS: ['wss://relay.example.com']
}));
jest.mock('../stores/ContactStore', () => ({ CONTACTS_KEY: 'contacts' }));

const mockQueryProfile = jest.fn();
const mockQuerySync = jest.fn();
jest.mock('nostr-tools', () => ({
    SimplePool: class {
        querySync = (...args: any[]) => mockQuerySync(...args);
        close = jest.fn();
    },
    nip05: {
        NIP05_REGEX: jest.requireActual('nostr-tools').nip05.NIP05_REGEX,
        queryProfile: (...args: any[]) => mockQueryProfile(...args)
    },
    nip19: {}
}));

const mockDoTorRequest = jest.fn();
jest.mock('../utils/TorUtils', () => ({
    doTorRequest: (...args: any[]) => mockDoTorRequest(...args),
    RequestMethod: { GET: 'get' }
}));

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import NostrContacts from './NostrContacts';

const PUBKEY =
    '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';

const LOOK_UP = 'views.NostrContacts.lookUpContacts';

// Opens the screen, types the identifier and presses Look up contacts
const lookUp = async (account: string, enableTor: boolean = false) => {
    await render(
        <NostrContacts
            {...({
                navigation: { goBack: jest.fn(), navigate: jest.fn() },
                ContactStore: {},
                SettingsStore: { enableTor }
            } as any)}
        />
    );
    await fireEvent.changeText(
        screen.getByPlaceholderText('npub1...'),
        account
    );
    await fireEvent.press(screen.getByRole('button', { name: LOOK_UP }));
};

describe('NostrContacts NIP-05 lookup', () => {
    beforeEach(() => {
        mockQueryProfile.mockReset();
        mockDoTorRequest.mockReset();
        mockQuerySync.mockReset();
        mockQuerySync.mockResolvedValue([]);
    });

    it('keeps Look up contacts disabled until the identifier is valid', async () => {
        await render(
            <NostrContacts {...({ navigation: {}, ContactStore: {} } as any)} />
        );
        expect(screen.getByRole('button', { name: LOOK_UP })).toBeDisabled();

        await fireEvent.changeText(
            screen.getByPlaceholderText('npub1...'),
            'not an identifier'
        );
        expect(screen.getByRole('button', { name: LOOK_UP })).toBeDisabled();

        await fireEvent.changeText(
            screen.getByPlaceholderText('npub1...'),
            'satoshi@domain.com'
        );
        expect(screen.getByRole('button', { name: LOOK_UP })).toBeEnabled();
    });

    it('lowercases the identifier before the lookup', async () => {
        mockQueryProfile.mockResolvedValue({ pubkey: PUBKEY });

        await lookUp('SATOSHI@DOMAIN.COM');
        // the contact list query runs in a promise chain that is not awaited
        await new Promise(setImmediate);

        expect(mockQueryProfile).toHaveBeenCalledWith('satoshi@domain.com');
        expect(mockQuerySync).toHaveBeenCalledWith(
            ['wss://relay.example.com'],
            { authors: [PUBKEY], kinds: [3] }
        );
    });

    it('sends the NIP-05 lookup through Tor when Tor is enabled', async () => {
        mockDoTorRequest.mockResolvedValue({ names: { satoshi: PUBKEY } });

        await lookUp('satoshi@domain.com', true);
        await new Promise(setImmediate);

        expect(mockDoTorRequest).toHaveBeenCalledWith(
            'https://domain.com/.well-known/nostr.json?name=satoshi',
            'get'
        );
        expect(mockQueryProfile).not.toHaveBeenCalled();
        expect(mockQuerySync).toHaveBeenCalledWith(
            ['wss://relay.example.com'],
            { authors: [PUBKEY], kinds: [3] }
        );
    });

    it('shows the NIP-05 error when Tor is enabled and the response is malformed', async () => {
        mockDoTorRequest.mockResolvedValue({ names: { satoshi: 'bogus' } });

        await lookUp('satoshi@domain.com', true);

        expect(
            screen.getByText('views.NostrContacts.nip05Error')
        ).toBeOnTheScreen();
        expect(mockQuerySync).not.toHaveBeenCalled();
    });

    it('shows the NIP-05 error when the lookup finds nothing', async () => {
        mockQueryProfile.mockResolvedValue(null);

        await lookUp('satoshi@domain.com');

        expect(
            screen.getByText('views.NostrContacts.nip05Error')
        ).toBeOnTheScreen();
        // the spinner is gone again
        expect(
            screen.container.queryAll((n) => n.type === 'LoadingIndicator')
        ).toHaveLength(0);
        expect(mockQuerySync).not.toHaveBeenCalled();
    });
});
