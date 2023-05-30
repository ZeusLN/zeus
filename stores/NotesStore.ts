import { action, observable } from 'mobx';
import EncryptedStorage from 'react-native-encrypted-storage';

const NOTES_KEY = 'note-Keys';

export default class NotesStore {
    @observable public noteKeys: string[] = [];

    @action
    public storeNoteKeys = async (key: string, notes: string) => {
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
            // write updated keys to storage
            await this.writeNoteKeysToLocalStorage();
        }
    };

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
