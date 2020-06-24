import stores from '../stores/Stores';
import AddressUtils from './../utils/AddressUtils';
import LndConnectUtils from './../utils/LndConnectUtils';
import { getParams as getlnurlParams, findlnurl } from 'js-lnurl';

const { nodeInfoStore, invoicesStore, settingsStore } = stores;

export default async function(data: string): Promise<any> {
    const { testnet } = nodeInfoStore;
    const { implementation } = settingsStore;
    const { value, amount } = AddressUtils.processSendAddress(data);

    if (AddressUtils.isValidBitcoinAddress(value, testnet)) {
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
        if (implementation === 'lndhub') {
            invoicesStore.getPayReqLocal(value);
        } else {
            invoicesStore.getPayReq(value);
        }
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
        const { username, password } = AddressUtils.processLNDHubAddress(value);
        const node = {
            implementation: 'lndhub',
            username,
            password,
            sslVerification: true
        };
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
