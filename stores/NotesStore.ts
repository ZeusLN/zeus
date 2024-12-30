import { action, observable } from 'mobx';
import * as Keychain from 'react-native-keychain';

export const LEGACY_NOTES_KEY = 'note-Keys';
export const MODERN_NOTES_KEY = 'zeus-notes-v2';

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
            const storedKeys: any = await Keychain.getInternetCredentials(
                MODERN_NOTES_KEY
            );
            if (storedKeys.password) {
                this.noteKeys = JSON.parse(storedKeys.password);
                // Load all notes
                await Promise.all(
                    this.noteKeys.map(async (key) => {
                        const note: any = await Keychain.getInternetCredentials(
                            key
                        );
                        if (note.password) {
                            this.notes[key] = note.password;
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
            await Keychain.setInternetCredentials(
                MODERN_NOTES_KEY,
                MODERN_NOTES_KEY,
                JSON.stringify(this.noteKeys)
            );
        } catch (error) {
            console.error('Error saving to encrypted storage');
        }
    };
}
