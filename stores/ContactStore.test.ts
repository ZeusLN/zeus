jest.mock('../storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn()
    }
}));

import Storage from '../storage';
import ContactStore, { CONTACTS_KEY } from './ContactStore';

const getItemMock = Storage.getItem as jest.Mock;
const setItemMock = Storage.setItem as jest.Mock;

const savedContacts = () => setItemMock.mock.calls[0][1];

describe('ContactStore', () => {
    let store: ContactStore;
    let navigation: { popTo: jest.Mock };

    beforeEach(() => {
        jest.clearAllMocks();
        store = new ContactStore();
        navigation = { popTo: jest.fn() };
    });

    describe('loadContacts', () => {
        it('keeps well-formed contacts as they are', async () => {
            const alice = {
                contactId: 'a1b2',
                lnAddress: ['alice@example.com'],
                bolt12Address: [],
                bolt12Offer: [],
                noffer: [],
                onchainAddress: [],
                pubkey: [],
                cashuPubkey: [],
                nip05: [],
                nostrNpub: [],
                name: 'Alice',
                description: 'friend',
                photo: null,
                banner: null,
                isFavourite: false
            };
            getItemMock.mockResolvedValue(JSON.stringify([alice]));

            await store.loadContacts();

            expect(store.contacts).toEqual([alice]);
            expect(store.loading).toBe(false);
        });

        it('fills in missing fields and drops values of the wrong type', async () => {
            getItemMock.mockResolvedValue(
                JSON.stringify([
                    {
                        contactId: '1',
                        name: 'Bob',
                        lnAddress: ['bob@example.com'],
                        isFavourite: true
                    },
                    {
                        contactId: '2',
                        name: [['Mallory']],
                        description: 5,
                        lnAddress: [['mallory@example.com']],
                        pubkey: 'not a list'
                    },
                    { id: 'legacy', name: 'Carol' }
                ])
            );

            await store.loadContacts();

            const [bob, mallory, carol] = store.contacts;
            expect(bob).toMatchObject({
                contactId: '1',
                name: 'Bob',
                description: '',
                lnAddress: ['bob@example.com'],
                onchainAddress: [],
                pubkey: [],
                isFavourite: true
            });
            expect(mallory).toMatchObject({
                contactId: '2',
                name: '',
                description: '',
                lnAddress: [],
                pubkey: []
            });
            expect(carol).toMatchObject({ id: 'legacy', name: 'Carol' });
            expect(
                store.contacts.find((contact: any) =>
                    contact.pubkey.includes('02abc')
                )
            ).toBeUndefined();
        });
    });

    describe('saveContact (new contact)', () => {
        it('assigns a fresh contactId even if contactDetails carries a stale one', async () => {
            // Regression for #4387: a stale prefillContact leaking its
            // contactId into a new contact created two contacts sharing
            // one ID, so deleting or editing one affected both
            const existing = [{ contactId: 'stale-id', name: 'Alice' }];
            getItemMock.mockResolvedValue(JSON.stringify(existing));

            await store.saveContact(
                { name: 'Bob', contactId: 'stale-id' },
                false,
                false,
                navigation
            );

            expect(setItemMock).toHaveBeenCalledWith(
                CONTACTS_KEY,
                expect.any(Array)
            );
            const contacts = savedContacts();
            expect(contacts).toHaveLength(2);
            const bob = contacts.find((c: any) => c.name === 'Bob');
            expect(bob.contactId).toBeDefined();
            expect(bob.contactId).not.toBe('stale-id');
            expect(navigation.popTo).toHaveBeenCalledWith('Contacts');
        });

        it('clears prefillContact after saving', async () => {
            getItemMock.mockResolvedValue(null);
            store.setPrefillContact({
                contactId: 'old-id',
                name: 'Alice'
            } as any);

            await store.saveContact({ name: 'Bob' }, false, false, navigation);

            expect(store.prefillContact).toBeNull();
        });
    });

    describe('saveContact (edit)', () => {
        it('updates only the contact matching prefillContact.contactId and preserves its ID', async () => {
            const existing = [
                { contactId: 'id-a', name: 'Alice', description: '' },
                { contactId: 'id-b', name: 'Bob', description: '' }
            ];
            getItemMock.mockResolvedValue(JSON.stringify(existing));
            store.setPrefillContact({
                contactId: 'id-a',
                name: 'Alice'
            } as any);

            await store.saveContact(
                { name: 'Alicia', description: 'renamed' },
                true,
                false,
                navigation
            );

            const contacts = savedContacts();
            expect(contacts).toHaveLength(2);
            const alicia = contacts.find((c: any) => c.contactId === 'id-a');
            expect(alicia.name).toBe('Alicia');
            expect(alicia.description).toBe('renamed');
            const bob = contacts.find((c: any) => c.contactId === 'id-b');
            expect(bob.name).toBe('Bob');
            expect(store.prefillContact).toBeNull();
        });
    });

    describe('deleteContact', () => {
        it('removes only the contact matching prefillContact.contactId', async () => {
            const existing = [
                { contactId: 'id-a', name: 'Alice' },
                { contactId: 'id-b', name: 'Bob' }
            ];
            getItemMock.mockResolvedValue(JSON.stringify(existing));
            store.setPrefillContact({
                contactId: 'id-a',
                name: 'Alice'
            } as any);

            await store.deleteContact(navigation);

            const contacts = savedContacts();
            expect(contacts).toHaveLength(1);
            expect(contacts[0].contactId).toBe('id-b');
            expect(store.prefillContact).toBeNull();
        });
    });

    describe('clearPrefillContact', () => {
        it('nulls out prefillContact', () => {
            store.setPrefillContact({
                contactId: 'id-a',
                name: 'Alice'
            } as any);
            expect(store.prefillContact).not.toBeNull();

            store.clearPrefillContact();

            expect(store.prefillContact).toBeNull();
        });
    });
});
