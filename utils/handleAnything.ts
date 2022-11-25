import { Alert } from 'react-native';
import { getParams as getlnurlParams, findlnurl } from 'js-lnurl';
import ReactNativeBlobUtil from 'react-native-blob-util';
import stores from '../stores/Stores';
import AddressUtils from './../utils/AddressUtils';
import ConnectionFormatUtils from './../utils/ConnectionFormatUtils';
import NodeUriUtils from './../utils/NodeUriUtils';
import { localeString } from './../utils/LocaleUtils';
import RESTUtils from './../utils/RESTUtils';

const { nodeInfoStore, invoicesStore } = stores;

const isClipboardValue = (data: string) => {
    const { nodeInfo } = nodeInfoStore;
    const { isTestNet, isRegTest } = nodeInfo;
    const { value, lightning }: any = AddressUtils.processSendAddress(data);
    const hasAt: boolean = value.includes('@');

    if (
        !hasAt &&
        AddressUtils.isValidBitcoinAddress(value, isTestNet || isRegTest) &&
        lightning
    ) {
        return true;
    } else if (
        !hasAt &&
        AddressUtils.isValidBitcoinAddress(value, isTestNet || isRegTest)
    ) {
        return true;
    } else if (!hasAt && AddressUtils.isValidLightningPubKey(value)) {
        return true;
    } else if (!hasAt && AddressUtils.isValidLightningPaymentRequest(value)) {
        return true;
    } else if (value.includes('lndconnect')) {
        return true;
    } else if (AddressUtils.isValidLNDHubAddress(value)) {
        return true;
    } else if (hasAt && NodeUriUtils.isValidNodeUri(value)) {
        return true;
    } else if (hasAt && AddressUtils.isValidLightningAddress(value)) {
        return true;
    } else if (findlnurl(value) !== null) {
        return true;
    } else {
        return false;
    }
};

export { isClipboardValue };

export default async function (data: string): Promise<any> {
    const { nodeInfo } = nodeInfoStore;
    const { isTestNet, isRegTest } = nodeInfo;
    const { value, amount, lightning }: any =
        AddressUtils.processSendAddress(data);
    const hasAt: boolean = value.includes('@');

    if (
        !hasAt &&
        AddressUtils.isValidBitcoinAddress(value, isTestNet || isRegTest) &&
        lightning
    ) {
        return [
            'Accounts',
            {
                value,
                amount,
                lightning
            }
        ];
    } else if (
        !hasAt &&
        AddressUtils.isValidBitcoinAddress(value, isTestNet || isRegTest)
    ) {
        return [
            'Send',
            {
                destination: value,
                amount,
                transactionType: 'On-chain'
            }
        ];
    } else if (!hasAt && AddressUtils.isValidLightningPubKey(value)) {
        return [
            'Send',
            {
                destination: value,
                transactionType: 'Keysend'
            }
        ];
    } else if (!hasAt && AddressUtils.isValidLightningPaymentRequest(value)) {
        invoicesStore.getPayReq(value);
        return ['PaymentRequest', {}];
    } else if (value.includes('lndconnect')) {
        const node = ConnectionFormatUtils.processLndConnectUrl(value);
        return [
            'AddEditNode',
            {
                node,
                enableTor: node.host && node.host.includes('.onion'),
                newEntry: true
            }
        ];
    } else if (AddressUtils.isValidLNDHubAddress(value)) {
        const { username, password, host } =
            AddressUtils.processLNDHubAddress(value);

        const existingAccount = !!username;

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
    } else if (hasAt && NodeUriUtils.isValidNodeUri(value)) {
        const { pubkey, host } = NodeUriUtils.processNodeUri(value);
        return [
            'OpenChannel',
            {
                node_pubkey_string: pubkey,
                host
            }
        ];
    } else if (hasAt && AddressUtils.isValidLightningAddress(value)) {
        const [username, domain] = value.split('@');
        const url = `https://${domain}/.well-known/lnurlp/${username}`;
        const error = localeString(
            'utils.handleAnything.lightningAddressError'
        );
        return ReactNativeBlobUtil.fetch('get', url)
            .then((response: any) => {
                const status = response.info().status;
                if (status == 200) {
                    const data = response.json();
                    return [
                        'LnurlPay',
                        {
                            lnurlParams: data
                        }
                    ];
                } else {
                    throw new Error(error);
                }
            })
            .catch(() => {
                throw new Error(error);
            });
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
                    if (RESTUtils.supportsMessageSigning()) {
                        return [
                            'LnurlAuth',
                            {
                                lnurlParams: params
                            }
                        ];
                    } else {
                        Alert.alert(
                            localeString('general.error'),
                            localeString(
                                'utils.handleAnything.lnurlAuthNotSupported'
                            ),
                            [
                                {
                                    text: localeString('general.ok'),
                                    onPress: () => void 0
                                }
                            ],
                            { cancelable: false }
                        );
                    }
                    break;
                default:
                    Alert.alert(
                        localeString('general.error'),
                        params.status === 'ERROR'
                            ? `${params.domain} says: ${params.reason}`
                            : `${localeString(
                                  'utils.handleAnything.unsupportedLnurlType'
                              )}: ${params.tag}`,
                        [
                            {
                                text: localeString('general.ok'),
                                onPress: () => void 0
                            }
                        ],
                        { cancelable: false }
                    );
            }
        });
    } else {
        throw new Error(localeString('utils.handleAnything.notValid'));
    }
}
