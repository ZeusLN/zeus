jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => ({ CheckBox: 'CheckBox' }));
jest.mock('../components/SharedTransition', () => {
    const { Text } = require('react-native');
    return {
        SharedScreen: 'SharedScreen',
        SharedText: ({ children }: any) => <Text>{children}</Text>
    };
});
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
jest.mock('../utils/LocaleUtils');
jest.mock('../utils/ThemeUtils', () => ({ themeColor: () => '#ffffff' }));
const mockGetItem = jest.fn();
const mockSetItem = jest.fn();
jest.mock('../storage', () => ({
    getItem: (...args: any[]) => mockGetItem(...args),
    setItem: (...args: any[]) => mockSetItem(...args)
}));
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
    nip19: { npubEncode: (pubkey: string) => `npub-of-${pubkey}` }
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
                navigation: {
                    goBack: jest.fn(),
                    navigate: jest.fn(),
                    popTo: jest.fn()
                },
                ContactStore: { loadContacts: jest.fn() },
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

describe('NostrContacts follow list', () => {
    const profile = (pubkey: string, content: any) => ({
        pubkey,
        created_at: 1,
        content: JSON.stringify({
            picture: 'https://cdn.example/avatar.png',
            ...content
        })
    });

    // Looks up a follow list holding the given kind 0 events
    const lookUpFollows = async (profiles: any[]) => {
        mockQueryProfile.mockReset();
        mockQuerySync.mockReset();
        mockQueryProfile.mockResolvedValue({ pubkey: PUBKEY });
        mockQuerySync
            .mockResolvedValueOnce([
                {
                    created_at: 1,
                    tags: profiles.map((event) => ['p', event.pubkey])
                }
            ])
            .mockResolvedValueOnce(profiles);

        await lookUp('satoshi@domain.com');
        await new Promise(setImmediate);
    };

    const avatars = () =>
        screen.container.queryAll((n) => n.type === 'ContactAvatar');

    it('lists accounts that share a display name as separate rows', async () => {
        await lookUpFollows([
            profile('aa', { name: 'Alice', lud16: 'alice@wallet.example' }),
            profile('bb', { name: 'Bob', lud16: 'bob@wallet.example' }),
            profile('cc', { name: 'alice', lud16: 'alice@mallory.example' })
        ]);

        expect(screen.getByText('alice@wallet.example')).toBeOnTheScreen();
        expect(screen.getByText('alice@mallory.example')).toBeOnTheScreen();
        expect(screen.getByText('bob@wallet.example')).toBeOnTheScreen();
        expect(avatars().map((a) => a.props.contactId)).toEqual([
            'npub-of-aa',
            'npub-of-cc',
            'npub-of-bb'
        ]);
    });

    it('takes the npub from the event author, not from the profile', async () => {
        await lookUpFollows([
            profile('aa', { name: 'Alice' }),
            profile('cc', { name: 'Mallory', npub: 'npub-of-aa' })
        ]);

        expect(avatars().map((a) => a.props.contactId)).toEqual([
            'npub-of-aa',
            'npub-of-cc'
        ]);
    });

    it('does not load avatars from cleartext or private addresses', async () => {
        await lookUpFollows([
            profile('aa', { name: 'Alice' }),
            profile('bb', {
                name: 'Bob',
                picture: 'http://192.168.1.1/apply.cgi?action=reboot'
            }),
            profile('cc', {
                name: 'Carol',
                picture: 'https://127.0.0.1:8443/shutdown'
            })
        ]);

        expect(avatars().map((a) => a.props.imageUrl)).toEqual([
            'https://cdn.example/avatar.png',
            undefined,
            undefined
        ]);
    });

    const spinners = () =>
        screen.container.queryAll((n) => n.type === 'LoadingIndicator');
    const IMPORT_ALL = 'views.NostrContacts.importAllContacts';

    it('lists the other profiles when one has null content', async () => {
        const error = jest.spyOn(console, 'error').mockImplementation(() => {});
        await lookUpFollows([
            profile('aa', { name: 'Alice', lud16: 'alice@wallet.example' }),
            { pubkey: 'bb', created_at: 1, content: 'null' }
        ]);

        expect(screen.getByText('alice@wallet.example')).toBeOnTheScreen();
        expect(spinners()).toHaveLength(0);
        expect(error).not.toHaveBeenCalled();
        error.mockRestore();
    });

    // Import all is offered whenever the list holds an entry, shown or not
    it.each(['null', '"Alice"', '42', '[]'])(
        'adds no entry for a profile whose content is %s',
        async (raw) => {
            const error = jest
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            await lookUpFollows([
                { pubkey: 'bb', created_at: 1, content: raw }
            ]);

            expect(
                screen.queryByRole('button', { name: IMPORT_ALL })
            ).not.toBeOnTheScreen();
            expect(spinners()).toHaveLength(0);
            expect(error).not.toHaveBeenCalled();
            error.mockRestore();
        }
    );

    it('stops the spinner when the relay query fails', async () => {
        const error = jest.spyOn(console, 'error').mockImplementation(() => {});
        mockQueryProfile.mockResolvedValue({ pubkey: PUBKEY });
        mockQuerySync.mockReset();
        mockQuerySync.mockRejectedValue(new Error('relay down'));

        await lookUp('satoshi@domain.com');
        await new Promise(setImmediate);

        expect(spinners()).toHaveLength(0);
        error.mockRestore();
    });

    it('imports each contact with the npub of the event author', async () => {
        mockGetItem.mockReset();
        mockSetItem.mockReset();
        mockGetItem.mockResolvedValue(null);
        mockSetItem.mockResolvedValue(undefined);

        await lookUpFollows([
            profile('aa', { name: 'Alice', lud16: 'alice@wallet.example' }),
            profile('cc', {
                name: 'Mallory',
                lud16: 'mallory@wallet.example',
                npub: 'npub-of-aa'
            })
        ]);
        await fireEvent.press(screen.getByRole('button', { name: IMPORT_ALL }));

        expect(mockSetItem).toHaveBeenCalledTimes(1);
        const [key, saved] = mockSetItem.mock.calls[0];
        expect(key).toBe('contacts');
        expect(
            saved.map((contact: any) => [contact.name, contact.nostrNpub])
        ).toEqual([
            ['Alice', ['npub-of-aa']],
            ['Mallory', ['npub-of-cc']]
        ]);
    });
});
