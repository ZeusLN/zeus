import { action } from 'mobx';
import { LNURLPaySuccessAction } from 'js-lnurl';
import AsyncStorage from '@react-native-community/async-storage';
import SettingsStore from './SettingsStore';
import NodeInfoStore from './NodeInfoStore';

export interface LnurlPayTransaction {
    paymentHash: string;
    domain: string;
    lnurl: string;
    metadata_hash: string;
    successAction: LnurlPaySuccessAction;
    time: number;
    metadata: string | Metadata; // only after an independent load from AsyncStorage.
}

interface Metadata {
    metadata: string;
}

interface LnurlPaySuccessAction {
    tag: string;
    description: string;
    url: string;
    message: string;
    iv: string;
    ciphertext: string;
}

interface LnurlPayMetadataEntry {
    metadata: string;
    last_stored: number;
}

export default class LnurlPayStore {
    paymentHash: string | null;
    domain: string | null;
    successAction: LNURLPaySuccessAction | null;
    settingsStore: SettingsStore;
    nodeInfoStore: NodeInfoStore;

    constructor(settingsStore: SettingsStore, nodeInfoStore: NodeInfoStore) {
        this.settingsStore = settingsStore;
        this.nodeInfoStore = nodeInfoStore;

        if (Math.random() < 0.1) {
            setTimeout(() => {
                this.deleteOld();
            }, 100000);
        }
    }

    deleteOld = async () => {
        // delete all lnurlpay keys older than 30 days
        const daysago30 = new Date().getTime() - 1000 * 60 * 60 * 24 * 30;
        const allKeys = await AsyncStorage.getAllKeys();
        const toRemove = [];
        for (let i = 0; i < allKeys.length; i++) {
            let key = allKeys[i];
            if (key.slice(0, 9) === 'lnurlpay:') {
                const itemString = await AsyncStorage.getItem(key);
                let item = JSON.parse(itemString || '');
                if (
                    (item.last_stored && item.last_stored < daysago30) ||
                    (item.time && item.time < daysago30)
                ) {
                    toRemove.push(key);
                }
            }
        }

        AsyncStorage.multiRemove(toRemove);
    };

    @action
    public load = async (paymentHash: string): Promise<LnurlPayTransaction> => {
        let lnurlpaytx: any = await AsyncStorage.getItem(
            'lnurlpay:' + paymentHash
        );
        if (lnurlpaytx) {
            lnurlpaytx = JSON.parse(lnurlpaytx);
            let metadata: any = await AsyncStorage.getItem(
                'lnurlpay:' + lnurlpaytx.metadata_hash
            );
            if (metadata) {
                lnurlpaytx.metadata = JSON.parse(metadata);
            }
        }

        return lnurlpaytx;
    };

    @action
    public keep = (
        paymentHash: string,
        domain: string,
        lnurl: string,
        metadata: string,
        descriptionHash: string,
        successAction: LNURLPaySuccessAction
    ) => {
        const now = new Date().getTime();

        const transactionData: LnurlPayTransaction = {
            paymentHash,
            domain,
            lnurl,
            successAction,
            time: now,
            metadata_hash: descriptionHash
        };

        const metadataEntry: LnurlPayMetadataEntry = {
            metadata,
            last_stored: now
        };

        AsyncStorage.multiSet([
            ['lnurlpay:' + paymentHash, JSON.stringify(transactionData)],
            ['lnurlpay:' + descriptionHash, JSON.stringify(metadataEntry)]
        ]);

        this.paymentHash = paymentHash;
        this.successAction = successAction;
        this.domain = domain;
    };
}
