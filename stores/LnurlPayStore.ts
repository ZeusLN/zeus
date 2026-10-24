import { action, runInAction } from 'mobx';
import { LNURLPaySuccessAction } from 'js-lnurl';

import Storage from '../storage';
import { getDatabase } from '../storage/Database';
import type { DB } from '@op-engineering/op-sqlite';
import {
    copyLnurlPayIfAbsent,
    getLnurlPayMetadata,
    getLnurlPayTx,
    putLnurlPay
} from '../storage/LnurlPayTable';
import { getLnurlMetadataHash } from '../utils/LnurlPayUtils';

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

    // Records written before the database existed are still in the keychain
    // as 'lnurlpay:<paymentHash>' and 'lnurlpay:<metadataHash>'. They are
    // read from there when the database has no row, and copied into it.
    // Nothing here deletes them; that is left to a later release (#4471).
    private loadFromKeychain = async (paymentHash: string) => {
        let lnurlpaytx: any = await Storage.getItem('lnurlpay:' + paymentHash);
        if (lnurlpaytx) {
            lnurlpaytx = JSON.parse(lnurlpaytx);
        }
        if (lnurlpaytx?.metadata_hash) {
            const metadata: any = await Storage.getItem(
                'lnurlpay:' + lnurlpaytx.metadata_hash
            );
            if (metadata) {
                lnurlpaytx.metadata = JSON.parse(metadata);
            }
        }
        return lnurlpaytx;
    };

    public load = async (paymentHash: string): Promise<LnurlPayTransaction> => {
        const db = paymentHash ? await getDatabase() : null;
        if (db) {
            try {
                const tx: any = await getLnurlPayTx(db, paymentHash);
                if (tx) {
                    if (tx.metadata_hash) {
                        const metadata = await getLnurlPayMetadata(
                            db,
                            tx.metadata_hash
                        );
                        if (metadata) tx.metadata = metadata;
                    }
                    return tx;
                }
            } catch (e) {
                console.warn('[LnurlPayStore] Database read failed', e);
            }
        }

        const lnurlpaytx = await this.loadFromKeychain(paymentHash);
        if (db && lnurlpaytx) {
            await this.copyToDatabase(db, lnurlpaytx);
        }
        return lnurlpaytx;
    };

    // Copy a keychain record into the database and read it back. The
    // keychain copy stays either way, so a failed copy only means the next
    // load reads the keychain again.
    private copyToDatabase = async (db: DB, lnurlpaytx: any) => {
        try {
            const { metadata, ...tx } = lnurlpaytx;
            await copyLnurlPayIfAbsent(db, tx, tx.metadata_hash, metadata);
            const copied = await getLnurlPayTx(db, tx.paymentHash);
            if (!copied) {
                console.warn('[LnurlPayStore] Copy did not read back');
            }
        } catch (e) {
            console.warn('[LnurlPayStore] Copy to database failed', e);
        }
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
        // invoices without a description hash are keyed by the hash of
        // their own metadata, so they do not share one entry
        const metadataHash =
            descriptionHash || getLnurlMetadataHash(metadata) || '';

        const transactionData: LnurlPayTransaction = {
            paymentHash,
            domain,
            lnurl,
            successAction,
            time: now,
            metadata_hash: metadataHash
        };

        const metadataEntry: LnurlPayMetadataEntry = {
            metadata,
            last_stored: now
        };

        let stored = false;
        const db = paymentHash ? await getDatabase() : null;
        if (db) {
            try {
                await putLnurlPay(
                    db,
                    transactionData,
                    metadataHash,
                    metadataEntry
                );
                stored = true;
            } catch (e) {
                console.warn('[LnurlPayStore] Database write failed', e);
            }
        }
        // Without the database, keep the record where it lived before
        if (!stored) {
            await Storage.setItem('lnurlpay:' + paymentHash, transactionData);
            if (metadataHash) {
                await Storage.setItem(
                    'lnurlpay:' + metadataHash,
                    metadataEntry
                );
            }
        }

        runInAction(() => {
            this.paymentHash = paymentHash;
            this.successAction = successAction;
            this.domain = domain;

            if (lightningAddress) this.lightningAddress = lightningAddress;
        });
    };
}
