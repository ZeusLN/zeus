import { v4 as uuidv4 } from 'uuid';
import ContactUtils from './ContactUtils';

// Mocking the dependencies
jest.mock('react-native-fs', () => ({
    DocumentDirectoryPath: '/mocked/document/directory',
    downloadFile: jest.fn(() => ({ promise: Promise.resolve() }))
}));

jest.mock('uuid', () => ({
    v4: jest.fn(() => 'mocked-uuid')
}));

describe('ContactUtils', () => {
    describe('transformContactData', () => {
        it('transforms contact data properly', async () => {
            // Test Case 1
            const mockContact1 = {
                display_name: 'Shubham',
                name: 'Shubham',
                about: 'Developer',
                lud16: 'shubham@zeuspay.com',
                nip05: 'nip05Address',
                npub: 'npub1a3vuemsaex2rmshv3h5sr8xlxayehzkan3ucw3sxf8l2rtjyuhpshexnw4'
            };

            const transformedContact1 = await ContactUtils.transformContactData(
                mockContact1
            );

            // Assertions
            expect(uuidv4).toHaveBeenCalled();
            expect(transformedContact1).toEqual({
                photo: '',
                name: 'Shubham',
                description: 'Developer',
                lnAddress: ['shubham@zeuspay.com'],
                onchainAddress: [''],
                pubkey: [''],
                nip05: ['nip05Address'],
                nostrNpub: [
                    'npub1a3vuemsaex2rmshv3h5sr8xlxayehzkan3ucw3sxf8l2rtjyuhpshexnw4'
                ],
                contactId: 'mocked-uuid',
                isFavourite: false,
                banner: '',
                isSelected: false
            });

            // Test Case 2
            const mockContact2 = {
                display_name: 'Evan',
                name: 'Evan',
                about: 'Maintainer at Zeus',
                lud16: 'evan@zeuspay.com',
                nip05: 'nip05Address',
                npub: 'npub1xnf02f60r9v0e5kty33a404dm79zr7z2eepyrk5gsq3m7pwvsz2sazlpr5'
            };

            const transformedContact2 = await ContactUtils.transformContactData(
                mockContact2
            );

            // Assertions
            expect(uuidv4).toHaveBeenCalled();
            expect(transformedContact2).toEqual({
                photo: '',
                name: 'Evan',
                description: 'Maintainer at Zeus',
                lnAddress: ['evan@zeuspay.com'],
                onchainAddress: [''],
                pubkey: [''],
                nip05: ['nip05Address'],
                nostrNpub: [
                    'npub1xnf02f60r9v0e5kty33a404dm79zr7z2eepyrk5gsq3m7pwvsz2sazlpr5'
                ],
                contactId: 'mocked-uuid',
                isFavourite: false,
                banner: '',
                isSelected: false
            });
        });

        it('handles contact transformation ensuring result is not null and is an object.', async () => {
            const mockContact = {
                display_name: 'Shubham',
                about: 'Software Developer',
                lud16: 'shubham@zeuspay.com',
                nip05: 'nip05Address',
                npub: 'npub1a3vuemsaex2rmshv3h5sr8xlxayehzkan3ucw3sxf8l2rtjyuhpshexnw4'
            };
            const transformedContact = await ContactUtils.transformContactData(
                mockContact
            );

            // Expect that the transformation did not result in null but is an object
            expect(transformedContact).toBeDefined();
            expect(transformedContact).toBeInstanceOf(Object);
        });
        it('drops profile fields that are not strings', async () => {
            const transformedContact = await ContactUtils.transformContactData({
                display_name: [['Mallory']],
                name: { first: 'Mallory' },
                about: 5,
                lud16: ['mallory@example.com'],
                lud06: 7,
                nip05: true,
                npub: ['npub1'],
                pubkey: 9,
                picture: ['https://example.com/me.png'],
                banner: {}
            });

            expect(transformedContact).toEqual({
                photo: '',
                name: '',
                description: '',
                lnAddress: [],
                onchainAddress: [''],
                pubkey: [''],
                nip05: [],
                nostrNpub: [],
                contactId: 'mocked-uuid',
                isFavourite: false,
                banner: '',
                isSelected: false
            });
        });

        it('falls back to the next profile field that is a string', async () => {
            const transformedContact = await ContactUtils.transformContactData({
                display_name: 5,
                name: 'Mallory',
                lud16: ['mallory@example.com'],
                lud06: 'lnurl1dp68gurn8ghj7'
            });

            expect(transformedContact).toMatchObject({
                name: 'Mallory',
                lnAddress: ['lnurl1dp68gurn8ghj7']
            });
        });
    });

    describe('sanitizeNostrProfile', () => {
        it('keeps the string fields only', () => {
            expect(
                ContactUtils.sanitizeNostrProfile({
                    name: 'Mallory',
                    about: 5,
                    lud16: ['mallory@example.com'],
                    picture: 'https://example.com/me.png',
                    banner: null
                })
            ).toEqual({
                name: 'Mallory',
                picture: 'https://example.com/me.png'
            });
        });

        it('returns an empty profile for content that is not an object', () => {
            expect(ContactUtils.sanitizeNostrProfile(null)).toEqual({});
            expect(ContactUtils.sanitizeNostrProfile(undefined)).toEqual({});
            expect(ContactUtils.sanitizeNostrProfile(5)).toEqual({});
            expect(ContactUtils.sanitizeNostrProfile('Mallory')).toEqual({});
            expect(ContactUtils.sanitizeNostrProfile(['Mallory'])).toEqual({});
        });
    });

    describe('toCardContact', () => {
        it('keeps only the members a zeuscontact: card carries', () => {
            expect(
                ContactUtils.toCardContact({
                    contactId: '1',
                    name: 'Coffee shop',
                    lnAddress: ['tips@coffee.example'],
                    photo: 'https://beacon.example/photo.png',
                    banner: 'rnfs://banner.png',
                    noffer: ['noffer1'],
                    isFavourite: true,
                    id: 'legacy-id'
                })
            ).toEqual({
                contactId: '1',
                name: 'Coffee shop',
                description: '',
                lnAddress: ['tips@coffee.example'],
                bolt12Address: [],
                bolt12Offer: [],
                noffer: ['noffer1'],
                onchainAddress: [],
                nip05: [],
                nostrNpub: [],
                pubkey: [],
                cashuPubkey: []
            });
        });
    });
});
