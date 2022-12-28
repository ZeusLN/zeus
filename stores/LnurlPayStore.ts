import { action } from 'mobx';
import { LNURLPaySuccessAction } from 'js-lnurl';
import EncryptedStorage from 'react-native-encrypted-storage';
import SettingsStore from './SettingsStore';
import NodeInfoStore from './NodeInfoStore';

export interface LnurlPayTransaction {
    paymentHash: string;
    domain: string;
    lnurl: string;
    metadata_hash: string;
    successAction: LNURLPaySuccessAction;
    time: number;
    metadata?: Metadata; // only after an independent load from EncryptedStorage.
}

interface Metadata {
    metadata: string;
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
    }

    @action
    public load = async (paymentHash: string): Promise<LnurlPayTransaction> => {
        let lnurlpaytx: any = await EncryptedStorage.getItem(
            'lnurlpay:' + paymentHash
        );
        if (lnurlpaytx) {
            lnurlpaytx = JSON.parse(lnurlpaytx);
            const metadata: any = await EncryptedStorage.getItem(
                'lnurlpay:' + lnurlpaytx.metadata_hash
            );
            if (metadata) {
                lnurlpaytx.metadata = JSON.parse(metadata);
            }
        }

        return lnurlpaytx;
    };

    @action
    public keep = async (
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

        await EncryptedStorage.setItem(
            'lnurlpay:' + paymentHash,
            JSON.stringify(transactionData)
        );
        await EncryptedStorage.setItem(
            'lnurlpay:' + descriptionHash,
            JSON.stringify(metadataEntry)
        );

        this.paymentHash = paymentHash;
        this.successAction = successAction;
        this.domain = domain;
    };
}
