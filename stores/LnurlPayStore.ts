import { action, observable } from 'mobx';
import { Alert } from 'react-native';
import axios from 'axios';
import Realm from 'realm';
import sha256 from 'hash.js/lib/hash/sha/256';
import { LNURLPaySuccessAction } from 'js-lnurl';
import NodeInfoStore from './../stores/NodeInfoStore';

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
    successAction: LNURLPaySuccessAction | null;
    realm: any;
    nodeInfoStore: NodeInfoStore;

    constructor(nodeInfoStore: NodeInfoStore) {
        this.nodeInfoStore = nodeInfoStore;
        this.realm = new Realm({
            path: `lnurl-${nodeInfoStore.nodeInfo.identity_pubkey}.realm`,
            schema: [LnurlPayTransactionSchema, LnurlPaySuccessActionSchema]
        });
    }

    @action
    public keep = (
        paymentHash: string,
        domain: string,
        lnurl: string,
        metadata: string,
        successAction: LNURLPaySuccessAction
    ) => {
        console.log(
            'KEEPING',
            paymentHash,
            domain,
            lnurl,
            metadata,
            successAction
        );
        const { nodeInfo } = this.nodeInfoStore;

        this.realm.write(() => {
            this.realm.create('LnurlPayTransaction', {
                paymentHash,
                domain,
                lnurl,
                metadata,
                successAction
            });
        });

        this.paymentHash = paymentHash;
        this.successAction = successAction;
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
            let lnurlpaytx = this.realm.objectForPrimaryKey(paymentHash);
            this.realm.delete(lnurlpaytx);
        });
    };
}
