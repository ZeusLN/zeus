import { v4 as uuidv4 } from 'uuid';
import RNFS from 'react-native-fs';
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
                mockContact1,
                mockContact1.npub
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
                mockContact2,
                mockContact2.npub
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

        it('takes the npub from the signer, not from the profile content', async () => {
            const transformedContact: any =
                await ContactUtils.transformContactData(
                    {
                        name: 'Alice (new wallet)',
                        lud16: 'alice@mallory.example',
                        npub: 'npub1xnf02f60r9v0e5kty33a404dm79zr7z2eepyrk5gsq3m7pwvsz2sazlpr5',
                        pubkey: '34d2f5274f1958fcd2cb2463dabeaddf8a21f84ace4241da888023bf05cc8095'
                    },
                    'npub1a3vuemsaex2rmshv3h5sr8xlxayehzkan3ucw3sxf8l2rtjyuhpshexnw4'
                );

            expect(transformedContact.nostrNpub).toEqual([
                'npub1a3vuemsaex2rmshv3h5sr8xlxayehzkan3ucw3sxf8l2rtjyuhpshexnw4'
            ]);
        });

        it('leaves nostrNpub empty when no signer npub is given', async () => {
            const transformedContact: any =
                await ContactUtils.transformContactData({
                    name: 'Mallory',
                    npub: 'npub1xnf02f60r9v0e5kty33a404dm79zr7z2eepyrk5gsq3m7pwvsz2sazlpr5'
                });

            expect(transformedContact.nostrNpub).toEqual([]);
        });

        it('stores the banners of contacts that share a name in separate files', async () => {
            (uuidv4 as jest.Mock)
                .mockReturnValueOnce('uuid-1')
                .mockReturnValueOnce('uuid-2');

            const first: any = await ContactUtils.transformContactData({
                name: 'Alice',
                banner: 'https://alice.example/banner.png'
            });
            const second: any = await ContactUtils.transformContactData({
                name: 'Alice',
                banner: 'https://mallory.example/banner.png'
            });

            expect(first.banner).toBe('rnfs://nostrContactBanner_uuid-1.png');
            expect(second.banner).toBe('rnfs://nostrContactBanner_uuid-2.png');
        });

        it('downloads the picture and banner from public https hosts', async () => {
            (RNFS.downloadFile as jest.Mock).mockClear();

            const transformedContact: any =
                await ContactUtils.transformContactData({
                    name: 'Friend',
                    picture: 'https://cdn.example/friend.png',
                    banner: 'https://cdn.example/banner.png'
                });

            expect(
                (RNFS.downloadFile as jest.Mock).mock.calls.map(
                    ([options]) => options.fromUrl
                )
            ).toEqual([
                'https://cdn.example/banner.png',
                'https://cdn.example/friend.png'
            ]);
            expect(transformedContact.photo).toContain('rnfs://');
            expect(transformedContact.banner).toContain('rnfs://');
        });

        it.each([
            'http://cdn.example/cleartext.png',
            'http://192.168.1.1/cgi-bin/reboot',
            'https://192.168.1.1/cgi-bin/reboot',
            'https://127.0.0.1:8443/shutdown',
            'https://abcdefg.onion/a.png',
            'file:///data/user/0/app.zeusln.zeus/files/a.png',
            { not: 'a string' }
        ])(
            'does not download a picture or banner from %p',
            async (imageUrl) => {
                (RNFS.downloadFile as jest.Mock).mockClear();

                const transformedContact: any =
                    await ContactUtils.transformContactData({
                        name: 'Mallory',
                        picture: imageUrl,
                        banner: imageUrl
                    });

                expect(RNFS.downloadFile).not.toHaveBeenCalled();
                expect(transformedContact.photo).toBe('');
                expect(transformedContact.banner).toBe('');
            }
        );
    });
});
