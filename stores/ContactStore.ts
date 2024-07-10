import { action, observable } from 'mobx';
import { v4 as uuidv4 } from 'uuid';
import Contact from '../models/Contact';
import EncryptedStorage from 'react-native-encrypted-storage';

export default class ContactStore {
    @observable public loading: boolean = true;
    @observable public contacts: any = [];
    @observable public prefillContact: any = {};

    @action
    public loadContacts = async () => {
        try {
            this.loading = true;
            const contactsString = await EncryptedStorage.getItem(
                'zeus-contacts'
            );
            if (contactsString) {
                const allContacts: Contact[] = JSON.parse(contactsString);
                this.contacts = allContacts;
                this.loading = false;
            } else {
                this.loading = false;
            }
        } catch (error) {
            console.log('Error loading contacts:', error);
            this.loading = false;
        }
    };

    @action
    public saveContact = async (
        contactDetails: any,
        isEdit: boolean,
        isNostrContact: boolean,
        navigation: any
    ) => {
        try {
            const contactsString = await EncryptedStorage.getItem(
                'zeus-contacts'
            );
            const existingContacts: Contact[] = contactsString
                ? JSON.parse(contactsString)
                : [];

            if (isEdit && this.prefillContact && !isNostrContact) {
                console.log('heree', this.prefillContact);
                const updatedContacts = existingContacts.map((contact) =>
                    contact.contactId === this.prefillContact.contactId
                        ? { ...contact, ...contactDetails }
                        : contact
                );

                // Sort the updated contacts alphabetically
                updatedContacts.sort((a, b) => a.name.localeCompare(b.name));

                // Save the updated contacts to encrypted storage
                await EncryptedStorage.setItem(
                    'zeus-contacts',
                    JSON.stringify(updatedContacts)
                );

                console.log('Contact updated successfully!', updatedContacts);
                navigation.popTo('Contacts');
            } else {
                // Creating a new contact
                const contactId = uuidv4();

                const newContact: Contact = { contactId, ...contactDetails };

                const updatedContacts = [...existingContacts, newContact].sort(
                    (a, b) => a.name.localeCompare(b.name)
                );

                // Save the updated contacts to encrypted storage
                await EncryptedStorage.setItem(
                    'zeus-contacts',
                    JSON.stringify(updatedContacts)
                );

                console.log('Contact saved successfully!');
                navigation.popTo('Contacts');
            }
            // Clear the prefillContact after saving
            this.clearPrefillContact();
        } catch (error) {
            console.log('Error saving contacts:', error);
        }
    };

    @action
    public deleteContact = async (navigation: any) => {
        if (this.prefillContact) {
            try {
                const contactsString = await EncryptedStorage.getItem(
                    'zeus-contacts'
                );
                const existingContacts: Contact[] = contactsString
                    ? JSON.parse(contactsString)
                    : [];

                const updatedContacts = existingContacts.filter(
                    (contact) =>
                        contact.contactId !== this.prefillContact.contactId
                );

                await EncryptedStorage.setItem(
                    'zeus-contacts',
                    JSON.stringify(updatedContacts)
                );

                console.log('Contact deleted successfully!');
                navigation.popTo('Contacts');
            } catch (error) {
                console.log('Error deleting contact:', error);
            }
        }
    };

    @action
    public setPrefillContact = (prefillContact: Contact | null) => {
        if (prefillContact) {
            this.prefillContact = {
                lnAddress: prefillContact.lnAddress,
                bolt12Address: prefillContact.bolt12Address,
                onchainAddress: prefillContact.onchainAddress,
                nip05: prefillContact.nip05,
                nostrNpub: prefillContact.nostrNpub,
                pubkey: prefillContact.pubkey,
                name: prefillContact.name,
                description: prefillContact.description,
                photo: prefillContact.photo,
                isFavourite: prefillContact.isFavourite,
                contactId: prefillContact?.contactId
            };
        } else {
            this.prefillContact = null;
        }
    };

    @action
    public clearPrefillContact = () => {
        this.prefillContact = null;
    };
}
