import { v4 as uuidv4 } from 'uuid';
import { nip19 } from 'nostr-tools';
import RNFS from 'react-native-fs';

import Contact from '../models/Contact';

const transformContactData = async (contact: any) => {
    try {
        const name = contact?.display_name || contact?.name || '';
        const transformedContact = {
            photo: '',
            name,
            description: contact?.about || '',
            lnAddress: contact?.lud16
                ? [contact?.lud16]
                : contact?.lud06
                ? [contact?.lud06]
                : contact?.lud16 && contact?.lud06
                ? [contact?.lud06, contact?.lud16]
                : [],
            onchainAddress: [''],
            pubkey: [''],
            nip05: contact?.nip05 ? [contact?.nip05] : [],
            nostrNpub: contact?.npub
                ? [contact?.npub]
                : contact?.pubkey
                ? [nip19.npubEncode(contact.pubkey)]
                : [],
            contactId: uuidv4(),
            isFavourite: false,
            banner: '',
            isSelected: false
        };

        if (contact?.banner) {
            console.log('Downloading banner...');
            const bannerFileName =
                'nostrContactBanner_' + transformedContact.name + '.png';
            const bannerFilePath =
                RNFS.DocumentDirectoryPath + '/' + bannerFileName;

            try {
                // Download the banner and save it locally
                await RNFS.downloadFile({
                    fromUrl: contact?.banner,
                    toFile: bannerFilePath
                }).promise;

                console.log('Banner download successful!');
                transformedContact.banner = 'rnfs://' + bannerFileName;
            } catch (bannerError) {
                console.error('Error downloading banner:', bannerError);
            }
        }

        if (contact?.picture) {
            console.log('Downloading image...');
            const fileName =
                'nostrContactPhoto_' + transformedContact.contactId + '.png';
            const filePath = RNFS.DocumentDirectoryPath + '/' + fileName;

            try {
                // Download the image and save it locally
                await RNFS.downloadFile({
                    fromUrl: contact?.picture,
                    toFile: filePath
                }).promise;

                console.log('Download successful!');
                transformedContact.photo = 'rnfs://' + fileName;
            } catch (photoError) {
                console.error('Error downloading photo:', photoError);
            }
        }

        return transformedContact;
    } catch (error) {
        console.error('Error transforming contact:', error);
        return null;
    }
};

const findContactByLightningAddress = (
    lightningAddress: string | undefined,
    contacts: Contact[] | undefined
): Contact | null => {
    if (!lightningAddress || !contacts?.length) return null;
    const normalized = lightningAddress.toLowerCase();
    const found = contacts.find((c: any) =>
        c.lnAddress?.some(
            (addr: string) => addr && addr.toLowerCase() === normalized
        )
    );
    return found ? new Contact(found) : null;
};

export default { transformContactData, findContactByLightningAddress };
