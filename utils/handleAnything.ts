import stores from '../stores/Stores';
import AddressUtils from './../utils/AddressUtils';
import { getParams as getlnurlParams, findlnurl } from 'js-lnurl';

const { nodeInfoStore, invoicesStore } = stores;

export default async function(data: string): Promise<[string, any]> {
    const { testnet } = nodeInfoStore;
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
    } else if (AddressUtils.isValidLightningPaymentRequest(value)) {
        invoicesStore.getPayReq(value);
        return ['PaymentRequest', {}];
    } else if (findlnurl(value) !== null) {
        const raw = findlnurl(value);
        return getlnurlParams(raw).then(params => {
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
                        params.reason || `Unsupported lnurl type: ${params.tag}`
                    );
            }
        });
    } else {
        throw new Error(
            'Scanned QR code was not a valid Bitcoin address or Lightning Invoice'
        );
    }
}
