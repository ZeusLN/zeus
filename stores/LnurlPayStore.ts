import { action } from 'mobx';
import { LNURLPaySuccessAction } from 'js-lnurl';
import { schnorr } from '@noble/curves/secp256k1';
import { hexToBytes } from '@noble/hashes/utils';
import hashjs from 'hash.js';
import {
    nip19,
    // @ts-ignore:next-line
    finishEvent,
    // @ts-ignore:next-line
    generatePrivateKey,
    // @ts-ignore:next-line
    getPublicKey,
    // @ts-ignore:next-line
    relayInit
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

    constructor(settingsStore: SettingsStore, nodeInfoStore: NodeInfoStore) {
        this.settingsStore = settingsStore;
        this.nodeInfoStore = nodeInfoStore;
    }

    reset = () => {
        this.paymentHash = undefined;
        this.domain = undefined;
        this.successAction = undefined;
        this.isZaplocker = undefined;
        this.isPmtHashSigValid = undefined;
        this.isRelaysSigValid = undefined;
        this.zaplockerNpub = undefined;
        this.relays = undefined;
        this.paymentRequest = undefined;
    };

    @action
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
        relays_sig?: string,
        pr?: string
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

        this.paymentHash = paymentHash;
        this.successAction = successAction;
        this.domain = domain;

        if (pr) this.paymentRequest = pr;

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
                this.relays = relays;
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

    @action
    public broadcastAttestation = async () => {
        const hash = this.paymentHash;
        const invoice = this.paymentRequest;
        const relays = this.relays;

        if (!hash || !invoice || !relays) return;

        // create ephemeral key
        const sk = generatePrivateKey();
        const pk = getPublicKey(sk);

        const hashpk = getPublicKey(hash);

        const event = {
            kind: 55869,
            pubkey: pk,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['p', hashpk]],
            content: invoice
        };

        // this calculates the event id and signs the event in a single step
        const signedEvent = finishEvent(event, sk);
        console.log('signedEvent', signedEvent);

        await Promise.all(
            relays.map(async (relayItem: string) => {
                const relay = relayInit(relayItem);
                relay.on('connect', () => {
                    console.log(`connected to ${relay.url}`);
                });
                relay.on('error', () => {
                    console.log(`failed to connect to ${relay.url}`);
                });

                await relay.connect();

                await relay.publish(signedEvent);

                console.log('event.id', signedEvent.id);
                const eventReceived = await relay.get({
                    ids: [signedEvent.id]
                });
                console.log('eventReceived', eventReceived);
                return;
            })
        );

        console.log('broadcast complete');
        return;
    };
}
