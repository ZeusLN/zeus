import { action, observable } from 'mobx';
import { v4 as uuidv4 } from 'uuid';
import Contact from '../models/Contact';
import Storage from '../storage';

export const LEGACY_CONTACTS_KEY = 'zeus-contacts';
export const CONTACTS_KEY = 'zeus-contacts-v2';

// Contacts saved before 01656c594 only have `id` (see Contact.getContactId).
const storedContactId = (contact: any): string | undefined =>
    contact?.contactId || contact?.id || undefined;

const isSameContact = (a: any, b: any): boolean => {
    const id = storedContactId(a);
    return id !== undefined && id === storedContactId(b);
};

export default class ContactStore {
    @observable public loading: boolean = true;
    @observable public contacts: any = [];
    @observable public prefillContact: any = {};

    @action
    public loadContacts = async () => {
        try {
            this.loading = true;
            console.log('LOADING CONTACTS.....');
            const contactsString: any = await Storage.getItem(CONTACTS_KEY);
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
            const compactedContactDetails =
                this.compactContactArrays(contactDetails);
            const contactsString: any = await Storage.getItem(CONTACTS_KEY);
            const existingContacts: Contact[] = contactsString
                ? JSON.parse(contactsString)
                : [];

            if (isEdit && this.prefillContact && !isNostrContact) {
                const updatedContacts = existingContacts.map((contact) =>
                    isSameContact(contact, this.prefillContact)
                        ? { ...contact, ...compactedContactDetails }
                        : contact
                );

                // Sort the updated contacts alphabetically
                updatedContacts.sort((a, b) => a.name.localeCompare(b.name));

                // Save the updated contacts to encrypted storage
                await Storage.setItem(CONTACTS_KEY, updatedContacts);

                this.loadContacts();
                navigation.popTo('Contacts');
            } else {
                // Creating a new contact
                const contactId = uuidv4();

                // contactId spread last so a leaked ID in contactDetails
                // can never override the fresh one; duplicate IDs make
                // delete/edit act on multiple contacts at once
                const newContact: Contact = {
                    ...compactedContactDetails,
                    contactId
                };

                const updatedContacts = [...existingContacts, newContact].sort(
                    (a, b) => a.name.localeCompare(b.name)
                );

                // Save the updated contacts to encrypted storage
                await Storage.setItem(CONTACTS_KEY, updatedContacts);

                console.log('Contact saved successfully!');

                this.loadContacts();
                navigation.popTo('Contacts');
            }
            // Clear the prefillContact after saving
            this.clearPrefillContact();
        } catch (error) {
            console.log('Error saving contacts:', error);
        }
    };

    private compactContactArrays = (contactDetails: any) => {
        const updatedDetails = { ...contactDetails };
        Object.keys(contactDetails).forEach((key) => {
            if (Array.isArray(contactDetails[key])) {
                updatedDetails[key] = contactDetails[key].filter(Boolean);
            }
        });
        return updatedDetails;
    };

    @action
    public deleteContact = async (navigation: any) => {
        if (this.prefillContact) {
            try {
                const contactsString: any = await Storage.getItem(CONTACTS_KEY);
                const existingContacts: Contact[] = contactsString
                    ? JSON.parse(contactsString)
                    : [];

                const updatedContacts = existingContacts.filter(
                    (contact) => !isSameContact(contact, this.prefillContact)
                );

                await Storage.setItem(CONTACTS_KEY, updatedContacts);

                console.log('Contact deleted successfully!');

                this.loadContacts();
                this.clearPrefillContact();
                navigation.popTo('Contacts');
            } catch (error) {
                console.log('Error deleting contact:', error);
            }
        }
    };

    @action
    public updateContact = async (updatedContact: any) => {
        try {
            const contactsString: any = await Storage.getItem(CONTACTS_KEY);
            if (!contactsString) return;

            const existingContacts: Contact[] = JSON.parse(contactsString);
            const contactIndex = existingContacts.findIndex((contact) =>
                isSameContact(contact, updatedContact)
            );
            if (contactIndex === -1) return;

            existingContacts[contactIndex] = updatedContact;
            await Storage.setItem(CONTACTS_KEY, existingContacts);

            console.log('Contact updated successfully!');
            this.loadContacts();
        } catch (error) {
            console.log('Error updating contact:', error);
        }
    };

    @action
    public setPrefillContact = (prefillContact: Contact | null) => {
        if (prefillContact) {
            this.prefillContact = {
                lnAddress: prefillContact.lnAddress || [],
                bolt12Address: prefillContact.bolt12Address || [],
                bolt12Offer: prefillContact.bolt12Offer || [],
                noffer: prefillContact.noffer || [],
                pubkey: prefillContact.pubkey || [],
                cashuPubkey: prefillContact.cashuPubkey || [],
                onchainAddress: prefillContact.onchainAddress || [],
                nip05: prefillContact.nip05 || [],
                nostrNpub: prefillContact.nostrNpub || [],
                name: prefillContact.name,
                description: prefillContact.description,
                photo: prefillContact.photo,
                isFavourite: prefillContact.isFavourite,
                contactId: storedContactId(prefillContact)
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
