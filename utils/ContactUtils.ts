import { v4 as uuidv4 } from 'uuid';
import RNFS from 'react-native-fs';
import ReactNativeBlobUtil from 'react-native-blob-util';

import { isRemoteImageAllowed } from './LnurlPayUtils';

import Contact from '../models/Contact';

// Keeps only the string fields of a Nostr profile (kind 0 content)
const sanitizeNostrProfile = (profile: any): any => {
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
        return {};
    }
    return Object.fromEntries(
        Object.entries(profile).filter(([, value]) => typeof value === 'string')
    );
};

// Largest profile picture or banner saved for a contact. A URL that keeps
// sending data is cut off here instead of filling the app's storage.
const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;

// Saves a profile image whose URL passed isRemoteImageAllowed. That check
// saw only this URL, so a redirect, which could lead to a loopback or LAN
// host or to plain http, is not followed. Returns whether a file was
// saved; anything written for a refused or failed download is deleted.
const downloadProfileImage = async (
    fromUrl: string,
    toFile: string
): Promise<boolean> => {
    let tooLarge = false;
    try {
        const task = ReactNativeBlobUtil.config({
            path: toFile,
            followRedirect: false
        }).fetch('GET', fromUrl);
        task.progress((received: number, total: number) => {
            if (
                Number(received) > MAX_PROFILE_IMAGE_BYTES ||
                Number(total) > MAX_PROFILE_IMAGE_BYTES
            ) {
                tooLarge = true;
                task.cancel();
            }
        });
        const response = await task;
        const status = Number(response.info().status);
        // Progress is reported every 250 ms, so a fast response can end
        // before it is checked
        if (!tooLarge && status >= 200 && status < 300) {
            const { size } = await RNFS.stat(toFile);
            if (Number(size) <= MAX_PROFILE_IMAGE_BYTES) return true;
        }
    } catch (error) {
        console.error('Error downloading profile image:', error);
    }
    try {
        await RNFS.unlink(toFile);
    } catch {
        // nothing was written
    }
    return false;
};

const transformContactData = async (profile: any, npub?: string | null) => {
    try {
        const contact = sanitizeNostrProfile(profile);
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
            nostrNpub: npub ? [npub] : [],
            contactId: uuidv4(),
            isFavourite: false,
            banner: '',
            isSelected: false
        };

        if (isRemoteImageAllowed(contact?.banner).ok) {
            console.log('Downloading banner...');
            const bannerFileName =
                'nostrContactBanner_' + transformedContact.contactId + '.png';
            const bannerFilePath =
                RNFS.DocumentDirectoryPath + '/' + bannerFileName;

            if (await downloadProfileImage(contact.banner, bannerFilePath)) {
                console.log('Banner download successful!');
                transformedContact.banner = 'rnfs://' + bannerFileName;
            }
        }

        if (isRemoteImageAllowed(contact?.picture).ok) {
            console.log('Downloading image...');
            const fileName =
                'nostrContactPhoto_' + transformedContact.contactId + '.png';
            const filePath = RNFS.DocumentDirectoryPath + '/' + fileName;

            if (await downloadProfileImage(contact.picture, filePath)) {
                console.log('Download successful!');
                transformedContact.photo = 'rnfs://' + fileName;
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

// The members a zeuscontact: card carries (views/MultiQR.tsx). Cards
// made before v0.11.0 also held the sender's remote photo and banner URLs
// and fields like isFavourite, so a received card is rebuilt from this list.
const toCardContact = (contact: any) => ({
    contactId: contact.contactId ?? '',
    name: contact.name ?? '',
    description: contact.description ?? '',
    lnAddress: contact.lnAddress ?? [],
    bolt12Address: contact.bolt12Address ?? [],
    bolt12Offer: contact.bolt12Offer ?? [],
    noffer: contact.noffer ?? [],
    onchainAddress: contact.onchainAddress ?? [],
    nip05: contact.nip05 ?? [],
    nostrNpub: contact.nostrNpub ?? [],
    pubkey: contact.pubkey ?? [],
    cashuPubkey: contact.cashuPubkey ?? []
});

export default {
    MAX_PROFILE_IMAGE_BYTES,
    sanitizeNostrProfile,
    transformContactData,
    findContactByLightningAddress,
    toCardContact
};
