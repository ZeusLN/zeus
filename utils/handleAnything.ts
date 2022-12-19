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

const isClipboardValue = (data: string) =>
    handleAnything(data, undefined, true);

const handleAnything = async (
    data: string,
    setAmount?: string,
    isClipboardValue?: boolean
): Promise<any> => {
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
        if (isClipboardValue) return true;
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
        if (isClipboardValue) return true;
        return [
            'Send',
            {
                destination: value,
                amount,
                transactionType: 'On-chain',
                isValid: true
            }
        ];
    } else if (!hasAt && AddressUtils.isValidLightningPubKey(value)) {
        if (isClipboardValue) return true;
        return [
            'Send',
            {
                destination: value,
                transactionType: 'Keysend',
                isValid: true
            }
        ];
    } else if (!hasAt && AddressUtils.isValidLightningPaymentRequest(value)) {
        if (isClipboardValue) return true;
        invoicesStore.getPayReq(value);
        return ['PaymentRequest', {}];
    } else if (value.includes('lndconnect')) {
        if (isClipboardValue) return true;
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
        if (isClipboardValue) return true;
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
        if (isClipboardValue) return true;
        const { pubkey, host } = NodeUriUtils.processNodeUri(value);
        return [
            'OpenChannel',
            {
                node_pubkey_string: pubkey,
                host
            }
        ];
    } else if (hasAt && AddressUtils.isValidLightningAddress(value)) {
        if (isClipboardValue) return true;
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
                            lnurlParams: data,
                            amount: setAmount
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
                    if (isClipboardValue) return true;
                    return [
                        'Receive',
                        {
                            lnurlParams: params
                        }
                    ];
                    break;
                case 'payRequest':
                    if (isClipboardValue) return true;
                    params.lnurlText = raw;
                    return [
                        'LnurlPay',
                        {
                            lnurlParams: params,
                            amount: setAmount
                        }
                    ];
                    break;
                case 'channelRequest':
                    if (isClipboardValue) return true;
                    return [
                        'LnurlChannel',
                        {
                            lnurlParams: params
                        }
                    ];
                    break;
                case 'login':
                    if (RESTUtils.supportsMessageSigning()) {
                        if (isClipboardValue) return true;
                        return [
                            'LnurlAuth',
                            {
                                lnurlParams: params
                            }
                        ];
                    } else {
                        if (isClipboardValue) return false;
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
                    if (isClipboardValue) return false;
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
        if (isClipboardValue) return false;
        throw new Error(localeString('utils.handleAnything.notValid'));
    }
};

export { isClipboardValue };
export default handleAnything;
