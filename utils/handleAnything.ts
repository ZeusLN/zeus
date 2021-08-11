import stores from '../stores/Stores';
import AddressUtils from './../utils/AddressUtils';
import LndConnectUtils from './../utils/LndConnectUtils';
import { getParams as getlnurlParams, findlnurl } from 'js-lnurl';

const { nodeInfoStore, invoicesStore } = stores;

export default async function(data: string): Promise<any> {
    const { nodeInfo } = nodeInfoStore;
    const { isTestNet, isRegTest } = nodeInfo;
    const { value, amount }: any = AddressUtils.processSendAddress(data);

    if (AddressUtils.isValidBitcoinAddress(value, isTestNet || isRegTest)) {
        return [
            'Send',
            {
                destination: value,
                amount,
                transactionType: 'On-chain'
            }
        ];
    } else if (AddressUtils.isValidLightningPubKey(value)) {
        return [
            'Send',
            {
                destination: value,
                transactionType: 'Keysend'
            }
        ];
    } else if (AddressUtils.isValidLightningPaymentRequest(value)) {
        invoicesStore.getPayReq(value);
        return ['PaymentRequest', {}];
    } else if (value.includes('lndconnect')) {
        const node = LndConnectUtils.processLndConnectUrl(value);
        return [
            'AddEditNode',
            {
                node,
                newEntry: true
            }
        ];
    } else if (AddressUtils.isValidLNDHubAddress(value)) {
        const { username, password, host } = AddressUtils.processLNDHubAddress(
            value
        );

        const existingAccount: boolean = !!username;

        let node;
        if (host) {
            node = {
                implementation: 'lndhub',
                username,
                password,
                lndhubUrl: host,
                certVerification: true,
                enableTor: host.includes('.onion'),
                existingAccount
            };
        } else {
            node = {
                implementation: 'lndhub',
                username,
                password,
                certVerification: true,
                existingAccount
            };
        }
        return [
            'AddEditNode',
            {
                node,
                newEntry: true
            }
        ];
    } else if (findlnurl(value) !== null) {
        const raw: string = findlnurl(value) || '';
        return getlnurlParams(raw).then((params: any) => {
            switch (params.tag) {
                case 'withdrawRequest':
                    return [
                        'Receive',
                        {
                            lnurlParams: params
                        }
                    ];
                    break;
                case 'payRequest':
                    params.lnurlText = raw;
                    return [
                        'LnurlPay',
                        {
                            lnurlParams: params
                        }
                    ];
                    break;
                case 'channelRequest':
                    return [
                        'LnurlChannel',
                        {
                            lnurlParams: params
                        }
                    ];
                    break;
                case 'login':
                    return [
                        'LnurlAuth',
                        {
                            lnurlParams: params
                        }
                    ];
                    break;
                default:
                    throw new Error(
                        params.status === 'ERROR'
                            ? `${params.domain} says: ${params.reason}`
                            : `Unsupported lnurl type: ${params.tag}`
                    );
            }
        });
    } else {
        throw new Error(
            'Scanned QR code was not a valid Bitcoin address or Lightning Invoice'
        );
    }
}
