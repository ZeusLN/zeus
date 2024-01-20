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
    });
});
