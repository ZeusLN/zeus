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
jest.mock(
    '../assets/images/SVG/Verified Account.svg',
    () => 'VerifiedAccountIcon'
);
jest.mock('../assets/images/SVG/AtSign.svg', () => 'AtSignIcon');
jest.mock('../assets/images/SVG/Pen.svg', () => 'PenIcon');
jest.mock('../assets/images/SVG/Star.svg', () => 'StarIcon');
jest.mock('../assets/images/SVG/QR.svg', () => 'QRIcon');
jest.mock('../assets/images/SVG/Ecash.svg', () => 'EcashIcon');
jest.mock('../utils/ThemeUtils', () => ({ themeColor: () => '#ffffff' }));
jest.mock('../utils/LinkingUtils', () => ({ handleDeepLink: jest.fn() }));
jest.mock('../utils/LocaleUtils');
jest.mock('../utils/PhotoUtils', () => ({
    getPhoto: (photo: string) => photo
}));
jest.mock('../storage', () => ({
    getItem: jest.fn(() => Promise.resolve(null))
}));

import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import ContactDetails from './ContactDetails';

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
    it('does not mark a NIP-05 identifier as verified', async () => {
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

        expect(iconsOfType('VerifiedAccountIcon')).toHaveLength(0);
        expect(iconsOfType('AtSignIcon')).toHaveLength(1);
    });
});
