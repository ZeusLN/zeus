import { action } from 'mobx';
import { LNURLPaySuccessAction } from 'js-lnurl';
import AsyncStorage from '@react-native-community/async-storage';

export interface LnurlPayTransaction {
    paymentHash: string;
    domain: string;
    lnurl: string;
    metadata_hash: string;
    successAction: LnurlPaySuccessAction;
    time: number;

    metadata: string; // only after an independent load from AsyncStorage.
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

    constructor() {
        if (Math.random() < 0.1) {
            setTimeout(() => {
                this.deleteOld();
            }, 100000);
        }
    }

    deleteOld = () => {
        // delete all lnurlpay keys older than 30 days
        const daysago30 = new Date().getTime() + 1000 * 60 * 60 * 24 * 30;
        const allKeys = await AsyncStorage.getAllKeys();
        var toRemove = [];
        for (let i = 0; i < allKeys.length; i++) {
            let key = allKeys[i];
            if (key.slice(0, 9) === 'lnurlpay:') {
                let item = JSON.parse(await AsyncStorage.getItem(key));
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
    public load = (paymentHash: string): LnurlPayTransaction => {
        let lnurlpaytx = await AsyncStorage.getItem('lnurlpay:' + paymentHash);
        if (lnurlpaytx) {
            lnurlpaytx = JSON.parse(lnurlpaytx);
            let metadata = await AsyncStorage.getItem(lnurlpaytx.metadata_hash);
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

        AsyncStorage.multiSet([
            [
                'lnurlpay:' + paymentHash,
                JSON.stringify({
                    paymentHash,
                    domain,
                    lnurl,
                    successAction,
                    time: now
                })
            ],
            [
                'lnurlpay:' + descriptionHash,
                JSON.stringify({ metadata, last_stored: now })
            ]
        ]);

        this.paymentHash = paymentHash;
        this.successAction = successAction;
        this.domain = domain;
    };
}
