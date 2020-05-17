import { action } from 'mobx';
import RNFetchBlob from 'rn-fetch-blob';
import Realm from 'realm';
import { when } from 'mobx';
import { LNURLPaySuccessAction } from 'js-lnurl';
import NodeInfoStore from './../stores/NodeInfoStore';
import SettingsStore from './../stores/SettingsStore';
import Payment from './../models/Payment';

export interface LnurlPayTransaction {
    paymentHash: string;
    pending: boolean;
    domain: string;
    lnurl: string;
    metadata: LnurlPayMetadata;
    successAction: LnurlPaySuccessAction;
}

interface LnurlPayMetadata {
    descriptionHash: string;
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

const LnurlPayTransactionSchema = {
    name: 'LnurlPayTransaction',
    primaryKey: 'paymentHash',
    properties: {
        paymentHash: 'string',
        pending: { type: 'bool', default: true },
        domain: { type: 'string', indexed: true },
        lnurl: 'string',
        metadata: 'LnurlPayMetadata',
        successAction: 'LnurlPaySuccessAction'
    }
};

const LnurlPayMetadataSchema = {
    name: 'LnurlPayMetadata',
    primaryKey: 'descriptionHash',
    properties: {
        descriptionHash: 'string',
        metadata: 'string'
    }
};

const LnurlPaySuccessActionSchema = {
    name: 'LnurlPaySuccessAction',
    properties: {
        tag: { type: 'string', default: 'noop' },
        description: 'string?',
        url: 'string?',
        message: 'string?',
        iv: 'string?',
        ciphertext: 'string?'
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
            schema: [
                LnurlPayTransactionSchema,
                LnurlPaySuccessActionSchema,
                LnurlPayMetadataSchema
            ]
        });

        when(
            () =>
                !!this.settingsStore.host &&
                !!this.settingsStore.port &&
                !!this.settingsStore.macaroonHex,
            () => this.checkPending()
        );
    }

    checkPending = () => {
        const { host, port, macaroonHex, sslVerification } = this.settingsStore;

        // remove all pending stored lnurl-pay transactions if we can't find them on lnd
        // and remove their pending status if we find them as completed
        let pending = this.realm
            .objects('LnurlPayTransaction')
            .filtered('pending == true');

        if (pending.length === 0) {
            // only if there's a pending tx on realm we'll do this expensive query
            return;
        }

        const url = `https://${host}${
            port ? ':' + port : ''
        }/v1/payments?include_incomplete=true`;

        const headers = {
            'Grpc-Metadata-macaroon': macaroonHex
        };

        RNFetchBlob.config({
            trusty: !sslVerification || true
        })
            .fetch('get', url)
            .then((response: any) => {
                const status = response.info().status;
                if (status == 200) {
                    const data = response.json();
                    let { payments } = data;
                    for (let i = 0; i < pending.length; i++) {
                        this.resolvePendingHash(
                            payments,
                            pending[i].paymentHash
                        );
                    }
                } else {
                    const error = response.json();
                    const { message } = error;
                    console.log(
                        `error checking pending lnurl-pay transactions: ${err.message}`
                    );
                }
            })
            .catch(err => {
                console.log(
                    `error checking pending lnurl-pay transactions: ${err.toString()}`
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
    public load = (paymentHash: string): LnurlPayTransaction => {
        return this.realm.objectForPrimaryKey(
            'LnurlPayTransaction',
            paymentHash
        );
    };

    @action
    public keep = (
        paymentHash: string,
        domain: string,
        lnurl: string,
        metadata: any,
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
