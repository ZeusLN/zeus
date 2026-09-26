jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => ({ CheckBox: 'CheckBox' }));
jest.mock('../components/SharedTransition', () => ({
    SharedScreen: 'SharedScreen',
    SharedText: 'SharedText'
}));
jest.mock('../components/Button', () => 'Button');
jest.mock('../components/Header', () => 'Header');
jest.mock('../components/Screen', () => 'Screen');
jest.mock('../components/TextInput', () => 'TextInput');
jest.mock('../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../components/SuccessErrorMessage', () => ({
    ErrorMessage: 'ErrorMessage'
}));
jest.mock('../components/layout/Row', () => ({ Row: 'Row' }));
jest.mock('../components/ContactAvatar', () => ({
    ContactAvatar: 'ContactAvatar'
}));
jest.mock('../utils/AddressUtils', () => ({}));
jest.mock('../utils/ContactUtils', () => ({}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../utils/NostrUtils', () => ({}));
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
    nip05: { queryProfile: (...args: any[]) => mockQueryProfile(...args) },
    nip19: {}
}));

import NostrContacts from './NostrContacts';

const PUBKEY =
    '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';

// Apply setState synchronously so the lookup can be driven without
// rendering the screen
const createScreen = (account: string) => {
    const screen: any = new NostrContacts({
        navigation: {},
        ContactStore: {}
    } as any);
    screen.state = { ...screen.state, account, isValidNip05: true };
    screen.setState = (update: any) => {
        screen.state = {
            ...screen.state,
            ...(typeof update === 'function' ? update(screen.state) : update)
        };
    };
    return screen;
};

describe('NostrContacts NIP-05 lookup', () => {
    beforeEach(() => {
        mockQueryProfile.mockReset();
        mockQuerySync.mockReset();
        mockQuerySync.mockResolvedValue([]);
    });

    it('lowercases the identifier before the lookup', async () => {
        mockQueryProfile.mockResolvedValue({ pubkey: PUBKEY });
        const screen = createScreen('SATOSHI@DOMAIN.COM');

        await screen.fetchNostrContacts();
        // the contact list query runs in a promise chain that is not awaited
        await new Promise(setImmediate);

        expect(mockQueryProfile).toHaveBeenCalledWith('satoshi@domain.com');
        expect(mockQuerySync).toHaveBeenCalledWith(
            ['wss://relay.example.com'],
            { authors: [PUBKEY], kinds: [3] }
        );
    });

    it('shows the NIP-05 error when the lookup finds nothing', async () => {
        mockQueryProfile.mockResolvedValue(null);
        const screen = createScreen('satoshi@domain.com');

        await screen.fetchNostrContacts();

        expect(screen.state.loading).toBe(false);
        expect(screen.state.error).toBe('views.NostrContacts.nip05Error');
        expect(mockQuerySync).not.toHaveBeenCalled();
    });
});
