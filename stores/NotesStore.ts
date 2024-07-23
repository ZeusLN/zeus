import { action, observable } from 'mobx';
import EncryptedStorage from 'react-native-encrypted-storage';

const NOTES_KEY = 'note-Keys';

export default class NotesStore {
    @observable public noteKeys: string[] = [];
    @observable public notes: { [key: string]: string } = {};

    constructor() {
        this.loadNoteKeys();
    }

    @action
    public storeNoteKeys = async (key: string, notes: string) => {
        this.notes[key] = notes;

        if (!this.noteKeys.includes(key)) {
            if (notes) {
                this.noteKeys.push(key);
            }
            await this.writeNoteKeysToLocalStorage();
        }
    };

    @action
    public removeNoteKeys = async (key: string) => {
        const index = this.noteKeys.indexOf(key);
        if (index !== -1) {
            this.noteKeys.splice(index, 1);
            delete this.notes[key];
            await this.writeNoteKeysToLocalStorage();
        }
    };

    @action
    public async loadNoteKeys() {
        console.log('Loading notes...');
        try {
            const storedKeys = await EncryptedStorage.getItem(NOTES_KEY);
            if (storedKeys) {
                this.noteKeys = JSON.parse(storedKeys);
                // Load all notes
                await Promise.all(
                    this.noteKeys.map(async (key) => {
                        const note = await EncryptedStorage.getItem(key);
                        if (note) {
                            this.notes[key] = note;
                        }
                    })
                );
            }
        } catch (error) {
            console.error(
                'Error loading note keys from encrypted storage',
                error
            );
        }
    }

    writeNoteKeysToLocalStorage = async () => {
        try {
            await EncryptedStorage.setItem(
                NOTES_KEY,
                JSON.stringify(this.noteKeys)
            );
        } catch (error) {
            console.error('Error saving to encrypted storage');
        }
    };
}
