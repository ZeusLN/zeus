jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../components/SharedTransition', () => {
    const { Text, View } = require('react-native');
    return {
        SharedScreen: ({ children }: any) => <View>{children}</View>,
        SharedText: ({ children }: any) => <Text>{children}</Text>,
        sharedTransitionEntering: undefined
    };
});
jest.mock('../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../components/Button', () => 'Button');
jest.mock('../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../components/Header', () => 'Header');
jest.mock('../components/layout/Row', () => ({ Row: 'Row' }));
jest.mock('../components/ContactAvatar', () => ({
    ContactAvatar: 'ContactAvatar'
}));
jest.mock('../stores/ContactStore', () => ({ CONTACTS_KEY: 'contacts' }));
jest.mock('../assets/images/SVG/Lightning Bolt.svg', () => 'LightningBolt');
jest.mock('../assets/images/SVG/BitcoinIcon.svg', () => 'BitcoinIcon');
jest.mock('../assets/images/SVG/Key Security.svg', () => 'KeySecurityIcon');
jest.mock('../assets/images/SVG/Nostrich.svg', () => 'NostrichIcon');
jest.mock('../assets/images/SVG/Pen.svg', () => 'PenIcon');
jest.mock('../assets/images/SVG/Star.svg', () => 'StarIcon');
jest.mock('../assets/images/SVG/QR.svg', () => 'QRIcon');
jest.mock('../assets/images/SVG/Ecash.svg', () => 'EcashIcon');
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: () => '#ffffff'
}));
jest.mock('../utils/LinkingUtils', () => ({ handleDeepLink: jest.fn() }));
jest.mock('../utils/LocaleUtils');
jest.mock('../utils/PhotoUtils', () => ({
    getPhoto: (photo: string) => photo
}));
jest.mock('../storage', () => ({
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve(true))
}));

import * as React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import ContactDetails from './ContactDetails';
import Storage from '../storage';

const renderNostrContact = async (nostrContact: any) => {
    await render(
        <ContactDetails
            {...({
                navigation: { addListener: jest.fn(), navigate: jest.fn() },
                route: { params: { nostrContact, isNostrContact: true } },
                ContactStore: { setPrefillContact: jest.fn() }
            } as any)}
        />
    );
    await waitFor(() =>
        expect(screen.getByText('alice@alice.example')).toBeOnTheScreen()
    );
};

const iconsOfType = (type: string) =>
    screen.container.queryAll((n) => n.type === type);

describe('ContactDetails', () => {
    // the jest config does not reset mocks between tests
    beforeEach(() => {
        (Storage.getItem as jest.Mock).mockImplementation(() =>
            Promise.resolve(null)
        );
        (Storage.setItem as jest.Mock).mockClear();
    });

    it('shows NIP-05 with the Nostrich icon in the same yellow as the other address icons', async () => {
        await renderNostrContact({
            photo: '',
            name: 'Alice',
            description: '',
            lnAddress: ['alice@evil.example'],
            onchainAddress: [''],
            pubkey: [''],
            nip05: ['alice@alice.example'],
            nostrNpub: [],
            contactId: 'contact-id',
            isFavourite: false,
            banner: '',
            isSelected: false
        });

        const nostrichIcons = iconsOfType('NostrichIcon');
        expect(nostrichIcons).toHaveLength(1);
        expect(nostrichIcons[0].props.fill).toBe('#FFD93F');
    });

    // a zeuscontact: card for a contact saved before v0.8.1 has an empty
    // contactId (#5908)
    it('saves a card with an empty contactId under a new one and keeps the stored contacts', async () => {
        const stored = [
            {
                contactId: 'contact-alice',
                name: 'Alice',
                lnAddress: ['alice@example.com']
            },
            {
                contactId: 'contact-carol',
                name: 'Carol',
                lnAddress: ['carol@example.com']
            }
        ];
        (Storage.getItem as jest.Mock).mockResolvedValue(
            JSON.stringify(stored)
        );
        const navigation = {
            addListener: jest.fn(),
            navigate: jest.fn(),
            popTo: jest.fn()
        };
        await render(
            <ContactDetails
                {...({
                    navigation,
                    route: {
                        params: {
                            nostrContact: {
                                contactId: '',
                                name: 'Bob',
                                description: '',
                                lnAddress: ['bob@example.com'],
                                bolt12Address: [],
                                bolt12Offer: [],
                                noffer: [],
                                onchainAddress: [],
                                nip05: [],
                                nostrNpub: [],
                                pubkey: [],
                                cashuPubkey: []
                            },
                            isNostrContact: true
                        }
                    },
                    ContactStore: { setPrefillContact: jest.fn() }
                } as any)}
            />
        );
        await waitFor(() =>
            expect(screen.getByText('bob@example.com')).toBeOnTheScreen()
        );

        const saveButton = screen.root!.queryAll(
            (n: any) => n.props.title === 'views.ContactDetails.saveToContacts'
        )[0];
        await act(async () => saveButton.props.onPress());

        expect(Storage.setItem).toHaveBeenCalledTimes(1);
        const [key, saved] = (Storage.setItem as jest.Mock).mock.calls[0];
        expect(key).toBe('contacts');
        expect(saved.map((c: any) => c.name)).toEqual([
            'Alice',
            'Bob',
            'Carol'
        ]);
        expect(saved).toEqual(expect.arrayContaining(stored));
        const bob = saved.find((c: any) => c.name === 'Bob');
        expect(bob.contactId).toEqual(expect.any(String));
        expect(bob.contactId).not.toBe('');
        expect(bob.lnAddress).toEqual(['bob@example.com']);
        expect(navigation.popTo).toHaveBeenCalledWith('Contacts');
    });
});
