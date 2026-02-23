import { Alert } from 'react-native';
import { getParams as getlnurlParams, findlnurl, decodelnurl } from 'js-lnurl';
import ReactNativeBlobUtil from 'react-native-blob-util';

import { nodeInfoStore, invoicesStore, settingsStore } from '../stores/Stores';

import AddressUtils, { ZEUS_ECASH_GIFT_URL } from './AddressUtils';
import BackendUtils from './BackendUtils';
import CashuUtils from './CashuUtils';
import ConnectionFormatUtils from './ConnectionFormatUtils';
import ContactUtils from './ContactUtils';
import { localeString } from './LocaleUtils';
import NodeUriUtils from './NodeUriUtils';
import { doTorRequest, RequestMethod } from './TorUtils';

import CashuToken from '../models/CashuToken';

// Nostr
import { DEFAULT_NOSTR_RELAYS } from '../stores/SettingsStore';
// @ts-ignore:next-line
import { relayInit, nip05, nip19 } from 'nostr-tools';
import wifUtils from './WIFUtils';

const isClipboardValue = (data: string) =>
    handleAnything(data, undefined, true);

const attemptNip05Lookup = async (data: string) => {
    try {
        const lookup: any = await nip05.queryProfile(data);
        const pubkey = lookup.pubkey;
        return await nostrProfileLookup(pubkey);
    } catch (e) {
        throw new Error(localeString('utils.handleAnything.addressError'));
    }
};

const nostrProfileLookup = async (data: string) => {
    let profile: any;

    const pubkey = data;
    const profilesEventsPromises = DEFAULT_NOSTR_RELAYS.map(
        async (relayItem) => {
            try {
                const relay = relayInit(relayItem);
                relay.on('connect', () => {
                    console.log(`connected to ${relay.url}`);
                });
                relay.on('error', (): any => {
                    console.log(`failed to connect to ${relay.url}`);
                });

                await relay.connect();
                return relay.list([
                    {
                        authors: [pubkey],
                        kinds: [0]
                    }
                ]);
            } catch (e) {}
        }
    );

    await Promise.all(profilesEventsPromises).then((profilesEventsArrays) => {
        const profileEvents = profilesEventsArrays
            .flat()
            .filter((event) => event !== undefined);

        profileEvents.forEach((item: any) => {
            try {
                const content = JSON.parse(item.content);
                if (!profile || item.created_at > profile.timestamp) {
                    profile = {
                        content,
                        timestamp: item.created_at
                    };
                }
            } catch (error: any) {
                throw new Error(
                    `Error parsing JSON for item with ID ${item.id}: ${error.message}`
                );
            }
        });
    });

    return [
        'ContactDetails',
        {
            nostrContact: await ContactUtils.transformContactData(
                profile.content
            ),
            isNostrContact: true
        }
    ];
};

const merchantConfigs = [
    {
        identifierRegex: /(?<identifier>.*za\.co\.electrum\.picknpay.*)/iu,
        domains: {
            mainnet: 'cryptoqr.net',
            signet: 'staging.cryptoqr.net',
            regtest: 'staging.cryptoqr.net'
        }
    },
    {
        identifierRegex: /(?<identifier>.*za\.co\.ecentric.*)/iu,
        domains: {
            mainnet: 'cryptoqr.net',
            signet: 'staging.cryptoqr.net',
            regtest: 'staging.cryptoqr.net'
        }
    },
    {
        identifierRegex:
            /(?<identifier>^((.*zapper\.com.*)|(.*\.wigroup\..*)|(.{2}\/.{4}\/.{20})|(.*payat\.io.*)|(.*(paynow\.netcash|paynow\.sagepay)\.co\.za.*)|(SK-\d{1,}-\d{23})|(\d{20})|(.*\d+\.zap\.pe(.*\n?)*)|(.*transactionjunction\.co\.za.*)|(CRSTPC-\d+-\d+-\d+-\d+-\d+))$)/iu,
        domains: {
            mainnet: 'cryptoqr.net',
            signet: 'staging.cryptoqr.net',
            regtest: 'staging.cryptoqr.net'
        }
    },
    {
        identifierRegex: /(?<identifier>.*yoyogroup\.co.*)/iu,
        domains: {
            mainnet: 'cryptoqr.net',
            signet: 'staging.cryptoqr.net',
            regtest: 'staging.cryptoqr.net'
        }
    },
    {
        identifierRegex: /(?<identifier>.*snapscan.*)/iu,
        domains: {
            mainnet: 'cryptoqr.net',
            signet: 'staging.cryptoqr.net',
            regtest: 'staging.cryptoqr.net'
        }
    },
    {
        identifierRegex: /(?<identifier>.*cryptoqr\.net.*)/iu,
        domains: {
            mainnet: 'cryptoqr.net',
            signet: 'staging.cryptoqr.net',
            regtest: 'staging.cryptoqr.net'
        }
    },
    {
        identifierRegex: /(?<identifier>.*za\.co\.electrum(?!\.picknpay).*)/iu,
        domains: {
            mainnet: 'cryptoqr.net',
            signet: 'staging.cryptoqr.net',
            regtest: 'staging.cryptoqr.net'
        }
    },
    {
        identifierRegex:
            /(?<identifier>.*(?:scantopay\.io|\d{10}|payat\.io|UMPQR|\.oltio\.co\.za|easypay).*)/iu,
        domains: {
            mainnet: 'cryptoqr.net',
            signet: 'staging.cryptoqr.net',
            regtest: 'staging.cryptoqr.net'
        }
    }
];

function getNetworkString(): 'mainnet' | 'signet' | 'regtest' {
    const { nodeInfo } = nodeInfoStore;
    if (!nodeInfo) return 'mainnet';
    if (nodeInfo.isTestNet || nodeInfo.isSigNet) return 'signet';
    if (nodeInfo.isRegTest) return 'regtest';
    return 'mainnet';
}

export function strictUriEncode(
    uriComponent: string | number | boolean
): string {
    return encodeURIComponent(uriComponent).replace(
        /[!'()*]/g,
        (value) => `%${value.charCodeAt(0).toString(16).toUpperCase()}`
    );
}

/**
 * Checks if the input matches a known merchant QR code pattern.
 */
function isMerchantQR(input: string): boolean {
    if (!input) return false;
    return merchantConfigs.some((merchant) =>
        merchant.identifierRegex.test(input)
    );
}

function convertMerchantQRToLightningAddress(
    qrContent: string,
    network: 'mainnet' | 'signet' | 'regtest'
): string | null {
    if (!qrContent) return null;

    for (const merchant of merchantConfigs) {
        const match = qrContent.match(merchant.identifierRegex);
        if (match?.groups?.identifier) {
            const domain =
                merchant.domains[network] || merchant.domains['mainnet'];
            return `${strictUriEncode(match.groups.identifier)}@${domain}`;
        }
    }
    return null;
}

const handleAnything = async (
    data: string,
    setAmount?: string,
    isClipboardValue?: boolean
): Promise<any> => {
    data = data.trim();
    const network = getNetworkString();
    const { nodeInfo } = nodeInfoStore;
    const { isTestNet, isRegTest, isSigNet } = nodeInfo;
    let { value, satAmount, lightning, offer }: any =
        AddressUtils.processBIP21Uri(data);
    const hasAt: boolean = value.includes('@');
    const hasMultiple: boolean =
        (value && lightning) || (value && offer) || (lightning && offer);

    // ecash mode
    const ecash =
        BackendUtils.supportsCashuWallet() &&
        settingsStore?.settings?.ecash?.enableCashu;

    // Handle nested URI schemes: LIGHTNING:lnurlp://...
    // Convert lnurlp:// to https:// (or http:// for .onion) for processing
    if (value) {
        const urlMatch = value.match(/^lnurl(p|w|c|auth):\/\/(.+)$/i);
        if (urlMatch) {
            const urlPath = urlMatch[2];
            const protocol = urlPath.toLowerCase().includes('.onion')
                ? 'http'
                : 'https';
            value = `${protocol}://${urlPath}`;
        }
    }

    let lnurl;
    // if the value is from clipboard and looks like a url we don't want to decode it
    if (!isClipboardValue || !data.match(/^https?:\/\//i)) {
        try {
            lnurl = decodelnurl(data);
        } catch (e) {}
    }

    if (!hasAt && hasMultiple) {
        if (isClipboardValue) return true;
        return [
            'ChoosePaymentMethod',
            {
                value,
                satAmount,
                lightning,
                offer
            }
        ];
    } else if (offer) {
        if (isClipboardValue) return true;
        return [
            'Send',
            {
                destination: offer,
                bolt12: offer,
                transactionType: 'BOLT 12',
                isValid: true
            }
        ];
    } else if (
        !hasAt &&
        AddressUtils.isValidBitcoinAddress(value, isTestNet || isRegTest) &&
        lightning
    ) {
        if (isClipboardValue) return true;
        if (!BackendUtils.supportsOnchainSends()) {
            if (lightning?.toLowerCase().startsWith('lnurl')) {
                try {
                    const params = await getlnurlParams(lightning);
                    if ('tag' in params && params.tag === 'payRequest') {
                        return [
                            'LnurlPay',
                            {
                                lnurlParams: params,
                                ecash
                            }
                        ];
                    } else {
                        throw new Error(
                            localeString(
                                'utils.handleAnything.invalidLnurlParams'
                            )
                        );
                    }
                } catch {
                    throw new Error(
                        localeString('utils.handleAnything.invalidLnurlParams')
                    );
                }
            } else {
                if (ecash) {
                    return [
                        'ChoosePaymentMethod',
                        {
                            lightning,
                            locked: true
                        }
                    ];
                } else {
                    await invoicesStore.getPayReq(lightning);
                    return ['PaymentRequest', {}];
                }
            }
        }
        return [
            'Accounts',
            {
                value,
                satAmount,
                lightning,
                locked: true
            }
        ];
    } else if (
        !hasAt &&
        AddressUtils.isValidBitcoinAddress(
            value,
            isTestNet || isRegTest || isSigNet
        )
    ) {
        if (isClipboardValue) return true;
        return [
            'Send',
            {
                destination: value,
                satAmount,
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
    } else if (
        !hasAt &&
        AddressUtils.isValidLightningPaymentRequest(value || lightning)
    ) {
        if (isClipboardValue) return true;
        if (ecash) {
            return [
                'ChoosePaymentMethod',
                {
                    lightning: value || lightning,
                    locked: true
                }
            ];
        } else {
            await invoicesStore.getPayReq(value || lightning);
            return ['PaymentRequest', {}];
        }
    } else if (
        !hasAt &&
        AddressUtils.isValidLightningOffer(value || lightning)
    ) {
        if (isClipboardValue) return true;
        return [
            'Send',
            {
                destination: value || lightning,
                bolt12: value || lightning,
                transactionType: 'BOLT 12',
                isValid: true
            }
        ];
    } else if (value.includes('clnrest://') || value.includes('clnrest+')) {
        if (isClipboardValue) return true;
        const { host, port, rune, implementation, enableTor } =
            ConnectionFormatUtils.processCLNRestConnectUrl(value);

        if (host && port && rune) {
            return [
                'WalletConfiguration',
                {
                    node: {
                        host,
                        port,
                        rune,
                        implementation,
                        enableTor
                    },
                    newEntry: true,
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
    } else if (value.startsWith('nostr+walletconnect://')) {
        if (isClipboardValue) return true;
        return [
            'WalletConfiguration',
            {
                node: {
                    nostrWalletConnectUrl: value,
                    implementation: 'nostr-wallet-connect'
                },
                newEntry: true,
                isValid: true
            }
        ];
    } else if (
        value.includes('https://terminal.lightning.engineering#/connect/pair/')
    ) {
        if (isClipboardValue) return true;
        const { pairingPhrase, mailboxServer, customMailboxServer } =
            ConnectionFormatUtils.processLncUrl(value);

        if (pairingPhrase && mailboxServer) {
            return [
                'WalletConfiguration',
                {
                    node: {
                        pairingPhrase,
                        mailboxServer,
                        customMailboxServer,
                        implementation: 'lightning-node-connect'
                    },
                    newEntry: true,
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
            'WalletConfiguration',
            {
                node,
                enableTor: node.host && node.host.includes('.onion'),
                newEntry: true,
                isValid: true
            }
        ];
    } else if (AddressUtils.isValidLNDHubAddress(value)) {
        if (isClipboardValue) return true;
        try {
            const { username, password, host } =
                AddressUtils.processLNDHubAddress(value);

            const existingAccount = !!username;

            const node = {
                implementation: 'lndhub',
                username,
                password,
                certVerification: true,
                existingAccount,
                ...(host && {
                    lndhubUrl: host,
                    enableTor: host.includes('.onion')
                })
            };
            return [
                'WalletConfiguration',
                {
                    node,
                    newEntry: true,
                    isValid: true
                }
            ];
        } catch (error) {
            throw new Error(localeString('utils.handleAnything.notValid'));
        }
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

        // try BOLT 12 address first, if supported
        const [localPart, domain] = value.split('@');
        const dnsUrl = 'https://cloudflare-dns.com/dns-query';

        const name = `${localPart}.user._bitcoin-payment.${domain}`;
        let url = `${dnsUrl}?name=${name}&type=TXT`;
        let bolt12: string | undefined;
        let b12Value: string | undefined,
            b12SatAmount: string | undefined,
            b12Lightning: string | undefined,
            b12Offer: string | undefined;

        try {
            const res = await fetch(url, {
                headers: {
                    accept: 'application/dns-json'
                }
            });
            const json = await res.json();
            if (json.Answer && json.Answer[0]) {
                bolt12 = json.Answer[0].data;
                bolt12 = bolt12!.replace(/("|\\|\s+)/g, '');
                bolt12 = bolt12!.replace(/bitcoin:b12=/, '');

                const {
                    value: _v,
                    satAmount: _s,
                    lightning: _l,
                    offer: _o
                }: any = AddressUtils.processBIP21Uri(bolt12);
                b12Value = _v;
                b12SatAmount = _s;
                b12Lightning = _l;
                b12Offer = _o;
            }
        } catch (e: any) {}

        // try BOLT 11 address
        const [username, bolt11Domain] = value.split('@');
        // LUD-16: domain MUST be lowercased
        const normalizedDomain = bolt11Domain.toLowerCase();
        // Skip lowercasing for cryptoqr.net addresses as they contain URL-encoded
        // data where hex digit casing matters for server-side lookup
        const isCryptoQR = normalizedDomain.endsWith('cryptoqr.net');
        const normalizedUsername = isCryptoQR
            ? username
            : username.toLowerCase();
        if (normalizedDomain.includes('.onion')) {
            url = `http://${normalizedDomain}/.well-known/lnurlp/${normalizedUsername}`;
        } else {
            url = `https://${normalizedDomain}/.well-known/lnurlp/${normalizedUsername}`;
        }
        const error = localeString(
            'utils.handleAnything.lightningAddressError'
        );

        // handle Tor LN addresses
        if (settingsStore.enableTor && bolt11Domain.includes('.onion')) {
            return doTorRequest(url, RequestMethod.GET)
                .then((response: any) => {
                    if (!response.callback) {
                        throw new Error(error);
                    }

                    if (b12Offer) {
                        return [
                            'ChoosePaymentMethod',
                            {
                                value: b12Value,
                                satAmount: b12SatAmount,
                                lightning: b12Lightning,
                                offer: b12Offer,
                                lightningAddress: value,
                                locked: true
                            }
                        ];
                    }

                    return [
                        'LnurlPay',
                        {
                            lnurlParams: response,
                            satAmount: setAmount,
                            ecash,
                            lightningAddress: value
                        }
                    ];
                })
                .catch((e: any) => {
                    const hasMultipleB12 = b12Value || b12Lightning;

                    if (b12Offer) {
                        if (hasMultipleB12) {
                            return [
                                'ChoosePaymentMethod',
                                {
                                    value: b12Value,
                                    satAmount: b12SatAmount,
                                    lightning: b12Lightning,
                                    offer: b12Offer,
                                    locked: true
                                }
                            ];
                        }
                        return [
                            'Send',
                            {
                                destination: b12Offer,
                                bolt12,
                                transactionType: 'BOLT 12',
                                isValid: true
                            }
                        ];
                    }
                    throw e; // re-throw original error from doTorRequest
                });
        } else {
            return ReactNativeBlobUtil.fetch('get', url)
                .then((response: any) => {
                    const status = response.info().status;
                    if (status == 200) {
                        const lnurlpData = response.json();
                        if (!lnurlpData.callback) {
                            throw new Error(error);
                        }

                        if (b12Offer) {
                            return [
                                'ChoosePaymentMethod',
                                {
                                    value: b12Value,
                                    satAmount: b12SatAmount,
                                    lightning: b12Lightning,
                                    offer: b12Offer,
                                    lightningAddress: value,
                                    locked: true
                                }
                            ];
                        }

                        return [
                            'LnurlPay',
                            {
                                lnurlParams: lnurlpData,
                                satAmount: setAmount,
                                ecash,
                                lightningAddress: value
                            }
                        ];
                    } else {
                        throw new Error(error);
                    }
                })
                .catch(async () => {
                    const hasMultipleB12 = b12Value || b12Lightning;

                    if (b12Offer) {
                        if (hasMultipleB12) {
                            return [
                                'ChoosePaymentMethod',
                                {
                                    value: b12Value,
                                    satAmount: b12SatAmount,
                                    lightning: b12Lightning,
                                    offer: b12Offer,
                                    locked: true
                                }
                            ];
                        }
                        return [
                            'Send',
                            {
                                destination: b12Offer,
                                bolt12,
                                transactionType: 'BOLT 12',
                                isValid: true
                            }
                        ];
                    }
                    return await attemptNip05Lookup(data);
                });
        }
    } else if (value.includes('config=') && value.includes('lnd.config')) {
        // BTCPay pairing QR
        if (isClipboardValue) return true;
        return settingsStore
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
                    'WalletConfiguration',
                    {
                        node,
                        enableTor: node.host && node.host.includes('.onion'),
                        newEntry: true,
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
    } else if (value.startsWith(ZEUS_ECASH_GIFT_URL)) {
        // Handle zeusln.com ecash gift URLs - check before lnurl to avoid false matches
        const cashuToken = value.replace(ZEUS_ECASH_GIFT_URL, '');
        if (CashuUtils.isValidCashuToken(cashuToken)) {
            if (isClipboardValue) return true;
            const cdkToken = await CashuUtils.decodeCashuTokenAsync(cashuToken);
            const decoded = new CashuToken({
                memo: cdkToken.memo || '',
                mint: cdkToken.mint_url,
                unit: cdkToken.unit || 'sat',
                value: cdkToken.value,
                encodedToken: cdkToken.encoded,
                proofs: cdkToken.proofs || []
            });
            return [
                'CashuToken',
                {
                    token: cashuToken,
                    decoded
                }
            ];
        }
        if (isClipboardValue) return false;
        throw new Error(localeString('utils.handleAnything.notValid'));
    } else if (
        !!findlnurl(value) ||
        !!lnurl ||
        (value && /\/lnurl|lnurlp|lnurlw|lnurlc|lnurlauth/i.test(value))
    ) {
        const raw: string = findlnurl(value) || lnurl || value || '';
        return getlnurlParams(raw)
            .then((params: any) => {
                if (
                    params.status === 'ERROR' &&
                    params.domain.endsWith('.onion')
                ) {
                    // TODO handle fetching of params with internal Tor
                    throw new Error(`${params.domain} says: ${params.reason}`);
                }

                switch (params.tag) {
                    case 'withdrawRequest':
                        if (isClipboardValue) return true;
                        if (ecash) {
                            return [
                                'ChoosePaymentMethod',
                                {
                                    lnurlParams: params,
                                    lightning: raw
                                }
                            ];
                        }
                        return [
                            'Receive',
                            {
                                lnurlParams: params
                            }
                        ];
                    case 'payRequest':
                        if (isClipboardValue) return true;
                        params.lnurlText = raw;
                        return [
                            'LnurlPay',
                            {
                                lnurlParams: params,
                                satAmount: setAmount,
                                ecash
                            }
                        ];
                    case 'channelRequest':
                        if (isClipboardValue) return true;
                        return [
                            'LnurlChannel',
                            {
                                lnurlParams: params
                            }
                        ];
                    case 'login':
                        if (BackendUtils.supportsLnurlAuth()) {
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
            })
            .catch(() => {
                throw new Error(
                    localeString('utils.handleAnything.invalidLnurlParams')
                );
            });
    } else if (AddressUtils.isValidNpub(data)) {
        try {
            const decoded = nip19.decode(data);
            const pubkey = decoded.data.toString();
            return await nostrProfileLookup(pubkey);
        } catch (e) {
            throw new Error(
                localeString('utils.handleAnything.nostrProfileError')
            );
        }
    } else if (data.startsWith('zeuscontact:')) {
        const zeusContactData = data.replace('zeuscontact:', '');
        const contact = JSON.parse(zeusContactData);

        if (contact?.contactId) {
            return [
                'ContactDetails',
                {
                    nostrContact: contact,
                    isNostrContact: true
                }
            ];
        }
    } else if (AddressUtils.isPsbt(value)) {
        return ['PSBT', { psbt: value }];
    } else if (AddressUtils.isValidTxHex(value)) {
        return ['TxHex', { txHex: value }];
    } else if (
        BackendUtils.supportsAccounts() &&
        AddressUtils.isKeystoreWalletExport(value)
    ) {
        const { MasterFingerprint, ExtPubKey, Label } =
            AddressUtils.processKeystoreWalletExport(value);
        return [
            'ImportAccount',
            {
                name: Label,
                extended_public_key: ExtPubKey,
                master_key_fingerprint: MasterFingerprint
            }
        ];
    } else if (
        BackendUtils.supportsAccounts() &&
        AddressUtils.isJsonWalletExport(value)
    ) {
        const { MasterFingerprint, ExtPubKey } = JSON.parse(value);
        return [
            'ImportAccount',
            {
                extended_public_key: ExtPubKey,
                master_key_fingerprint: MasterFingerprint
            }
        ];
    } else if (
        BackendUtils.supportsAccounts() &&
        AddressUtils.isStringWalletExport(value)
    ) {
        const { MasterFingerprint, ExtPubKey } =
            AddressUtils.processStringWalletExport(value);
        return [
            'ImportAccount',
            {
                extended_public_key: ExtPubKey,
                master_key_fingerprint: MasterFingerprint
            }
        ];
    } else if (
        BackendUtils.supportsAccounts() &&
        AddressUtils.isWpkhDescriptor(value)
    ) {
        const { MasterFingerprint, ExtPubKey, AddressType } =
            AddressUtils.processWpkhDescriptor(value);
        return [
            'ImportAccount',
            {
                extended_public_key: ExtPubKey,
                master_key_fingerprint: MasterFingerprint,
                address_type: AddressType
            }
        ];
    } else if (
        BackendUtils.supportsAccounts() &&
        AddressUtils.isNestedWpkhDescriptor(value)
    ) {
        const { MasterFingerprint, ExtPubKey, AddressType } =
            AddressUtils.processNestedWpkhDescriptor(value);
        return [
            'ImportAccount',
            {
                extended_public_key: ExtPubKey,
                master_key_fingerprint: MasterFingerprint,
                address_type: AddressType
            }
        ];
    } else if (
        BackendUtils.supportsAccounts() &&
        AddressUtils.isValidXpub(value)
    ) {
        return [
            'ImportAccount',
            {
                extended_public_key: value
            }
        ];
    } else if (await CashuUtils.isValidCashuTokenAsync(value)) {
        const cdkToken = await CashuUtils.decodeCashuTokenAsync(value);
        const decoded = new CashuToken({
            memo: cdkToken.memo || '',
            mint: cdkToken.mint_url,
            unit: cdkToken.unit || 'sat',
            value: cdkToken.value,
            encodedToken: cdkToken.encoded,
            proofs: cdkToken.proofs || []
        });
        return [
            'CashuToken',
            {
                token: value,
                decoded
            }
        ];
    } else if (
        BackendUtils.supportsWithdrawalRequests() &&
        AddressUtils.isValidWithdrawalRequest(value)
    ) {
        return [
            'WithdrawalRequestInfo',
            {
                bolt12: value
            }
        ];
    } else if (isMerchantQR(data)) {
        // Handle merchant QR codes by converting to lightning address
        // and recursively processing through handleAnything to reuse
        // all lightning address logic (Tor, BOLT 12, etc.)
        const merchantLnAddr = convertMerchantQRToLightningAddress(
            data,
            network
        );
        if (merchantLnAddr) {
            return handleAnything(merchantLnAddr, setAmount, isClipboardValue);
        }
        // If conversion failed, fall through to error
        if (isClipboardValue) return false;
        throw new Error(localeString('utils.handleAnything.notValid'));
    } else {
        try {
            const { isValid, error } = wifUtils.validateWIF(value);
            if (isValid) {
                return [
                    'WIFSweeper',
                    {
                        wif: value
                    }
                ];
            } else {
                throw new Error(error || localeString('views.Wif.invalidWif'));
            }
        } catch (err) {
            if (isClipboardValue) return false;
            throw new Error(localeString('utils.handleAnything.notValid'));
        }
    }
};

export { isClipboardValue, convertMerchantQRToLightningAddress, isMerchantQR };
export default handleAnything;
