import { action, runInAction } from 'mobx';
import { LNURLPaySuccessAction } from 'js-lnurl';

import Storage from '../storage';

import SettingsStore from './SettingsStore';
import NodeInfoStore from './NodeInfoStore';

export interface LnurlPayTransaction {
    paymentHash: string;
    domain: string;
    lnurl: string;
    metadata_hash: string;
    successAction: LNURLPaySuccessAction;
    time: number;
    metadata?: Metadata; // only after an independent load from Storage.
}

interface Metadata {
    metadata: string;
}

interface LnurlPayMetadataEntry {
    metadata: string;
    last_stored: number;
}

export default class LnurlPayStore {
    paymentHash: string | undefined;
    domain: string | undefined;
    successAction: LNURLPaySuccessAction | undefined;
    settingsStore: SettingsStore;
    nodeInfoStore: NodeInfoStore;
    lightningAddress: string | undefined;

    constructor(settingsStore: SettingsStore, nodeInfoStore: NodeInfoStore) {
        this.settingsStore = settingsStore;
        this.nodeInfoStore = nodeInfoStore;
    }

    @action
    public reset = () => {
        this.paymentHash = undefined;
        this.domain = undefined;
        this.successAction = undefined;
        this.lightningAddress = undefined;
    };

    public load = async (paymentHash: string): Promise<LnurlPayTransaction> => {
        let lnurlpaytx: any = await Storage.getItem('lnurlpay:' + paymentHash);
        if (lnurlpaytx) {
            lnurlpaytx = JSON.parse(lnurlpaytx);
            const metadata: any = await Storage.getItem(
                'lnurlpay:' + lnurlpaytx.metadata_hash
            );
            if (metadata) {
                lnurlpaytx.metadata = JSON.parse(metadata);
            }
        }

        return lnurlpaytx;
    };

    public keep = async (
        paymentHash: string,
        domain: string,
        lnurl: string,
        metadata: string,
        descriptionHash: string,
        successAction: LNURLPaySuccessAction,
        lightningAddress?: string
    ) => {
        this.reset();
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

        await Storage.setItem('lnurlpay:' + paymentHash, transactionData);
        await Storage.setItem('lnurlpay:' + descriptionHash, metadataEntry);

        runInAction(() => {
            this.paymentHash = paymentHash;
            this.successAction = successAction;
            this.domain = domain;

            if (lightningAddress) this.lightningAddress = lightningAddress;
        });
    };
}
