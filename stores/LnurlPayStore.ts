import { action, runInAction } from 'mobx';
import { LNURLPaySuccessAction } from 'js-lnurl';
import { schnorr } from '@noble/curves/secp256k1.js';
import { hexToBytes } from '@noble/hashes/utils';
import hashjs from 'hash.js';
import {
    nip19,
    finalizeEvent,
    generateSecretKey,
    getPublicKey,
    SimplePool
} from 'nostr-tools';

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
    // Zaplocker
    isZaplocker: boolean | undefined;
    isPmtHashSigValid: boolean | undefined;
    isRelaysSigValid: boolean | undefined;
    zaplockerNpub: string | undefined;
    relays: Array<string> | undefined;
    paymentRequest: string | undefined;
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
        this.isZaplocker = undefined;
        this.isPmtHashSigValid = undefined;
        this.isRelaysSigValid = undefined;
        this.zaplockerNpub = undefined;
        this.relays = undefined;
        this.paymentRequest = undefined;
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
        pmthash_sig?: string,
        user_pubkey?: string,
        relays?: Array<string>,
        relays_sig?: string,
        pr?: string,
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

            if (pr) this.paymentRequest = pr;
            if (lightningAddress) this.lightningAddress = lightningAddress;

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
                        hexToBytes(paymentHash),
                        hexToBytes(user_pubkey)
                    );
                }

                if (relays && relays_sig) {
                    this.relays = relays;
                    const relaysBytes = hexToBytes(relays_sig);
                    this.isRelaysSigValid = schnorr.verify(
                        relaysBytes,
                        hexToBytes(
                            hashjs
                                .sha256()
                                .update(JSON.stringify(relays))
                                .digest('hex')
                        ),
                        hexToBytes(user_pubkey)
                    );
                }
            }
        });
    };

    public broadcastAttestation = async () => {
        const hash = this.paymentHash;
        const invoice = this.paymentRequest;
        const relays = this.relays;

        if (!hash || !invoice || !relays) return;

        // create ephemeral key
        const sk = generateSecretKey();

        const hashpk = getPublicKey(hexToBytes(hash));

        const event = {
            kind: 55869,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['p', hashpk]],
            content: invoice
        };

        // this calculates the event id and signs the event in a single step
        const signedEvent = finalizeEvent(event, sk);
        console.log('signedEvent', signedEvent);

        const pool = new SimplePool();
        try {
            await Promise.all(
                pool
                    .publish(relays, signedEvent)
                    .map((publishPromise: Promise<string>) =>
                        publishPromise.catch((e: any) =>
                            console.log('failed to publish to relay', e)
                        )
                    )
            );

            console.log('event.id', signedEvent.id);
            const eventReceived = await pool.get(relays, {
                ids: [signedEvent.id]
            });
            console.log('eventReceived', eventReceived);
        } finally {
            pool.close(relays);
        }

        console.log('broadcast complete');
        return;
    };
}
