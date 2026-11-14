jest.mock('react-native-fs', () => ({
    DocumentDirectoryPath: '/mocked/document/directory'
}));

import Contact from './Contact';

describe('Contact', () => {
    it('keeps the fields of a well-formed contact', () => {
        const contact = new Contact({
            contactId: 'a1b2',
            name: 'Alice',
            description: 'friend',
            lnAddress: ['alice@example.com'],
            onchainAddress: ['bc1qexample'],
            pubkey: [],
            photo: 'rnfs://photo.png',
            isFavourite: true
        });

        expect(contact.contactId).toBe('a1b2');
        expect(contact.name).toBe('Alice');
        expect(contact.description).toBe('friend');
        expect(contact.lnAddress).toEqual(['alice@example.com']);
        expect(contact.onchainAddress).toEqual(['bc1qexample']);
        expect(contact.photo).toBe('rnfs://photo.png');
        expect(contact.isFavourite).toBe(true);
        expect(contact.hasMultiplePayableAddresses).toBe(true);
    });

    it('fills in the address lists and description a shared card leaves out', () => {
        const contact = new Contact({
            contactId: '1',
            name: 'Bob',
            lnAddress: ['bob@example.com'],
            isFavourite: true
        });

        expect(contact.description).toBe('');
        expect(contact.onchainAddress).toEqual([]);
        expect(contact.pubkey).toEqual([]);
        expect(contact.cashuPubkey).toEqual([]);
        expect(contact.hasMultiplePayableAddresses).toBe(false);
        expect(contact.isSingleLnAddress).toBe(true);
    });

    it('handles a card with no address lists at all', () => {
        const contact = new Contact({ contactId: '1', name: 'Alice' });

        expect(contact.hasMultiplePayableAddresses).toBe(false);
        expect(contact.hasLnAddress).toBe(false);
    });

    it('drops values of the wrong type', () => {
        const contact = new Contact({
            contactId: 5,
            name: [['Mallory']],
            description: 5,
            lnAddress: [['mallory@example.com'], 'm@example.com', 7],
            onchainAddress: null,
            pubkey: 'not a list',
            nip05: {},
            photo: ['https://example.com/me.png'],
            banner: 7,
            isFavourite: 'yes'
        });

        expect(contact.contactId).toBe('');
        expect(contact.name).toBe('');
        expect(contact.description).toBe('');
        expect(contact.lnAddress).toEqual(['m@example.com']);
        expect(contact.onchainAddress).toEqual([]);
        expect(contact.pubkey).toEqual([]);
        expect(contact.nip05).toEqual([]);
        expect(contact.photo).toBeNull();
        expect(contact.banner).toBeNull();
        expect(contact.isFavourite).toBe(false);
        expect(contact.hasMultiplePayableAddresses).toBe(false);
        expect(contact.getAvatarInitials).toBeDefined();
    });

    it('ignores keys that are not contact fields', () => {
        const contact = new Contact({
            contactId: '1',
            name: 'Alice',
            getPhoto: 'https://example.com/me.png',
            hasMultiplePayableAddresses: true
        });

        expect(contact.getPhoto).toBe('');
        expect(contact.hasMultiplePayableAddresses).toBe(false);
    });

    it('keeps the deprecated id of a migrated contact', () => {
        const contact = new Contact({ id: 'legacy', name: 'Carol' });

        expect(contact.getContactId).toBe('legacy');
    });
});
