import stores from './Stores';

export const fiatStore = stores.fiatStore;
export const notesStore = stores.notesStore;
export const settingsStore = stores.settingsStore;
export const nodeInfoStore = stores.nodeInfoStore;
export const peersStore = stores.peersStore;

export default {
    fiatStore,
    notesStore,
    settingsStore,
    nodeInfoStore,
    peersStore
};
