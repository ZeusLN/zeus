import { Alert } from 'react-native';
import { getParams as getlnurlParams, findlnurl, decodelnurl } from 'js-lnurl';
import ReactNativeBlobUtil from 'react-native-blob-util';
import stores from '../stores/Stores';
import AddressUtils from './../utils/AddressUtils';
import ConnectionFormatUtils from './../utils/ConnectionFormatUtils';
import NodeUriUtils from './../utils/NodeUriUtils';
import { localeString } from './../utils/LocaleUtils';
import BackendUtils from './../utils/BackendUtils';

const { nodeInfoStore, invoicesStore, settingsStore } = stores;

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
    let lnurl;
    try {
        lnurl = decodelnurl(data);
    } catch (e) {}

    if (
        !hasAt &&
        AddressUtils.isValidBitcoinAddress(value, isTestNet || isRegTest) &&
        lightning
    ) {
        if (isClipboardValue) return true;
        if (!BackendUtils.supportsOnchainSends()) {
            invoicesStore.getPayReq(lightning);
            return ['PaymentRequest', {}];
        }
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
    } else if (value.includes('config=')) {
        if (isClipboardValue) return true;
        // BTCPay pairing QR
        settingsStore
            .fetchBTCPayConfig(value)
            .then((node: any) => {
                if (settingsStore.btcPayError) {
                    Alert.alert(
                        localeString('general.error'),
                        settingsStore.btcPayError,
                        [
                            {
                                text: localeString('general.ok'),
                                onPress: () => void 0
                            }
                        ],
                        { cancelable: false }
                    );
                }
                return [
                    'NodeConfiguration',
                    {
                        node,
                        enableTor: node.host && node.host.includes('.onion'),
                        isValid: true
                    }
                ];
            })
            .catch(() => {
                Alert.alert(
                    localeString('general.error'),
                    localeString('views.BTCPayConfigQRScanner.error'),
                    [
                        {
                            text: localeString('general.ok'),
                            onPress: () => void 0
                        }
                    ],
                    { cancelable: false }
                );
            });
    } else if (value.includes('c-lightning-rest')) {
        if (isClipboardValue) return true;
        const { host, port, macaroonHex, implementation, enableTor } =
            ConnectionFormatUtils.processCLightningRestConnectUrl(value);

        if (host && port && macaroonHex) {
            return [
                'NodeConfiguration',
                {
                    node: {
                        host,
                        port,
                        macaroonHex,
                        implementation,
                        enableTor
                    },
                    isValid: true
                }
            ];
        } else {
            Alert.alert(
                localeString('general.error'),
                localeString('views.LNDConnectConfigQRScanner.error'),
                [{ text: localeString('general.ok'), onPress: () => void 0 }],
                { cancelable: false }
            );
        }
    } else if (
        value.includes('https://terminal.lightning.engineering#/connect/pair/')
    ) {
        if (isClipboardValue) return true;
        const { pairingPhrase, mailboxServer, customMailboxServer } =
            ConnectionFormatUtils.processLncUrl(value);

        if (pairingPhrase && mailboxServer) {
            return [
                'NodeConfiguration',
                {
                    node: {
                        pairingPhrase,
                        mailboxServer,
                        customMailboxServer,
                        implementation: 'lightning-node-connect'
                    },
                    isValid: true
                }
            ];
        } else {
            Alert.alert(
                localeString('general.error'),
                localeString('views.LncQRScanner.error'),
                [{ text: localeString('general.ok'), onPress: () => void 0 }],
                { cancelable: false }
            );
        }
    } else if (value.includes('lndconnect')) {
        if (isClipboardValue) return true;
        const node = ConnectionFormatUtils.processLndConnectUrl(value);
        return [
            'NodeConfiguration',
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
            'NodeConfiguration',
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
    } else if (findlnurl(value) !== null || lnurl !== null) {
        const raw: string = findlnurl(value) || lnurl || '';
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
                    if (BackendUtils.supportsMessageSigning()) {
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
