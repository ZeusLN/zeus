import { action, observable } from 'mobx';
import EncryptedStorage from 'react-native-encrypted-storage';

export default class NotesStore {
    @observable public noteKeys: string[] = [];

    @action
    public storeNoteKeys = async (key: string, notes: string) => {
        if (!this.noteKeys.includes(key)) {
            if (notes) {
                this.noteKeys.push(key);
            }
            try {
                await EncryptedStorage.setItem(
                    'note-Keys',
                    JSON.stringify(this.noteKeys)
                );
            } catch (error) {
                console.error('Error saving to encrypted storage');
            }
        }
    };

    @action
    public removeNoteKeys = (key: string) => {
        const index = this.noteKeys.indexOf(key);
        if (index !== -1) {
            this.noteKeys.splice(index, 1);
        }
    };
}
