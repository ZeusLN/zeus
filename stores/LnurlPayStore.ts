import { action, observable } from 'mobx';
import { Alert } from 'react-native';
import axios from 'axios';
import Realm from 'realm';
import sha256 from 'hash.js/lib/hash/sha/256';
import { when } from 'mobx';
import { LNURLPaySuccessAction } from 'js-lnurl';
import NodeInfoStore from './../stores/NodeInfoStore';
import SettingsStore from './../stores/SettingsStore';
import Payment from './../models/Payment';

const LnurlPayTransactionSchema = {
    name: 'LnurlPayTransaction',
    primaryKey: 'paymentHash',
    properties: {
        paymentHash: 'string',
        pending: { type: 'bool', default: true },
        domain: { type: 'string', indexed: true },
        lnurl: 'string',
        metadata: 'string',
        successAction: 'LnurlPaySuccessAction'
    }
};

const LnurlPaySuccessActionSchema = {
    name: 'LnurlPaySuccessAction',
    properties: {
        tag: { type: 'string', default: 'noop' },
        description: 'string?',
        url: 'string?',
        message: 'string?'
    }
};

export default class LnurlPayStore {
    paymentHash: string | null;
    domain: string | null;
    successAction: LNURLPaySuccessAction | null;
    realm: any;
    settingsStore: SettingsStore;
    nodeInfoStore: NodeInfoStore;

    constructor(settingsStore: SettingsStore, nodeInfoStore: NodeInfoStore) {
        this.settingsStore = settingsStore;
        this.nodeInfoStore = nodeInfoStore;
        this.realm = new Realm({
            path: `lnurl-${nodeInfoStore.nodeInfo.identity_pubkey}.realm`,
            schema: [LnurlPayTransactionSchema, LnurlPaySuccessActionSchema]
        });

        when(
            () =>
                this.settingsStore.host &&
                this.settingsStore.port &&
                this.settingsStore.macaroonHex,
            () => this.checkPending()
        );
    }

    checkPending = () => {
        const { host, port, macaroonHex } = this.settingsStore;

        // remove all pending stored lnurl-pay transactions if we can't find them on lnd
        // and remove their pending status if we find them as completed
        let pending = this.realm
            .objects('LnurlPayTransaction')
            .filtered('pending == true');

        if (pending.length === 0) {
            // only if there's a pending tx on realm we'll do this expensive query
            return;
        }

        axios
            .request({
                method: 'get',
                url: `https://${host}${
                    port ? ':' + port : ''
                }/v1/payments?include_incomplete=true`,
                headers: {
                    'Grpc-Metadata-macaroon': macaroonHex
                }
            })
            .then((response: any) => {
                let { payments } = response.data;
                for (let i = 0; i < pending.length; i++) {
                    this.resolvePendingHash(payments, pending[i].paymentHash);
                }
            })
            .catch(err => {
                console.log(
                    `error checking pending lnurl-pay transactions: ${err.message}`
                );
            });
    };

    resolvePendingHash = (payments: Payment[], pendingHash: string) => {
        for (let j = 0; j < payments.length; j++) {
            let payment: Payment = payments[j];
            if (payment.payment_hash === pendingHash) {
                // a match!
                switch (payment.status) {
                    case 'SUCCEEDED':
                        this.acknowledge(pendingHash);
                        return;
                    case 'FAILED':
                        this.clear(pendingHash);
                        return;
                    default:
                        // leave it as is
                        return;
                }
            }
        }

        // if we got here it's because there is no match / the payment is not on lnd
        this.clear(pendingHash);
    };

    @action
    public keep = (
        paymentHash: string,
        domain: string,
        lnurl: string,
        metadata: string,
        successAction: LNURLPaySuccessAction
    ) => {
        this.realm.write(() => {
            this.realm.create(
                'LnurlPayTransaction',
                {
                    paymentHash,
                    domain,
                    lnurl,
                    metadata,
                    successAction
                },
                true
            );
        });

        this.paymentHash = paymentHash;
        this.successAction = successAction;
        this.domain = domain;
    };

    @action
    public acknowledge = (paymentHash: string) => {
        this.realm.write(() => {
            this.realm.create(
                'LnurlPayTransaction',
                {
                    paymentHash,
                    pending: false
                },
                true
            );
        });
    };

    @action
    public clear = (paymentHash: string) => {
        this.realm.write(() => {
            this.realm.delete(
                this.realm.objectForPrimaryKey(
                    'LnurlPayTransaction',
                    paymentHash
                )
            );
        });
    };
}
