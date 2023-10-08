import { action } from 'mobx';
import { LNURLPaySuccessAction } from 'js-lnurl';
import EncryptedStorage from 'react-native-encrypted-storage';
import { schnorr } from '@noble/curves/secp256k1';
import { hexToBytes } from '@noble/hashes/utils';
import hashjs from 'hash.js';
import { nip19 } from 'nostr-tools';

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
    // Zaplocker
    isZaplocker: boolean | null;
    isPmtHashSigValid: boolean | null;
    isRelaysSigValid: boolean | null;
    zaplockerNpub: string | null;

    constructor(settingsStore: SettingsStore, nodeInfoStore: NodeInfoStore) {
        this.settingsStore = settingsStore;
        this.nodeInfoStore = nodeInfoStore;
    }

    reset = () => {
        this.paymentHash = null;
        this.domain = null;
        this.successAction = null;
        this.isZaplocker = null;
        this.isPmtHashSigValid = null;
        this.isRelaysSigValid = null;
        this.zaplockerNpub = null;
    };

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
        successAction: LNURLPaySuccessAction,
        pmthash_sig?: string,
        user_pubkey?: string,
        relays?: Array<string>,
        relays_sig?: string
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

        // Zaplocker
        if (user_pubkey) {
            this.isZaplocker = true;
            try {
                this.zaplockerNpub = nip19.npubEncode(user_pubkey);
            } catch (e) {}

            if (pmthash_sig) {
                const pmtHashBytes = hexToBytes(pmthash_sig);
                this.isPmtHashSigValid = schnorr.verify(
                    pmtHashBytes,
                    paymentHash,
                    user_pubkey
                );
            }

            if (relays && relays_sig) {
                const relaysBytes = hexToBytes(relays_sig);
                this.isRelaysSigValid = schnorr.verify(
                    relaysBytes,
                    hashjs
                        .sha256()
                        .update(JSON.stringify(relays))
                        .digest('hex'),
                    user_pubkey
                );
            }
        }
    };
}
