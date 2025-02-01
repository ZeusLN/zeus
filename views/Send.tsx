import * as React from 'react';
import {
    FlatList,
    Image,
    Platform,
    NativeModules,
    NativeEventEmitter,
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    BackHandler,
    NativeEventSubscription
} from 'react-native';
import { Chip, Icon } from 'react-native-elements';
import Clipboard from '@react-native-clipboard/clipboard';
import { inject, observer } from 'mobx-react';
import NfcManager, {
    NfcEvents,
    TagEvent,
    Ndef
} from 'react-native-nfc-manager';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import handleAnything, { isClipboardValue } from '../utils/handleAnything';

import BalanceStore from '../stores/BalanceStore';
import InvoicesStore from '../stores/InvoicesStore';
import ModalStore from '../stores/ModalStore';
import NodeInfoStore from '../stores/NodeInfoStore';
import SettingsStore from '../stores/SettingsStore';
import TransactionsStore from '../stores/TransactionsStore';
import UTXOsStore from '../stores/UTXOsStore';
import ContactStore from '../stores/ContactStore';

import Amount from '../components/Amount';
import AmountInput from '../components/AmountInput';
import Button from '../components/Button';
import FeeLimit from '../components/FeeLimit';
import LoadingIndicator from '../components/LoadingIndicator';
import {
    WarningMessage,
    ErrorMessage
} from '../components/SuccessErrorMessage';
import Header from '../components/Header';
import OnchainFeeInput from '../components/OnchainFeeInput';
import Screen from '../components/Screen';
import Switch from '../components/Switch';
import TextInput from '../components/TextInput';
import UTXOPicker from '../components/UTXOPicker';

import BackendUtils from '../utils/BackendUtils';
import { errorToUserFriendly } from '../utils/ErrorUtils';
import NFCUtils from '../utils/NFCUtils';
import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import NFC from '../assets/images/SVG/NFC-alt.svg';
import ContactIcon from '../assets/images/SVG/PeersContact.svg';
import Scan from '../assets/images/SVG/Scan.svg';
import Sweep from '../assets/images/SVG/Sweep.svg';

import Contact from '../models/Contact';
import TransactionRequest, {
    AdditionalOutput
} from '../models/TransactionRequest';

interface SendProps {
    exitSetup: any;
    navigation: StackNavigationProp<any, any>;
    BalanceStore: BalanceStore;
    InvoicesStore: InvoicesStore;
    ModalStore: ModalStore;
    NodeInfoStore: NodeInfoStore;
    TransactionsStore: TransactionsStore;
    SettingsStore: SettingsStore;
    UTXOsStore: UTXOsStore;
    ContactStore: ContactStore;
    route: Route<
        'Send',
        {
            destination: string;
            amount: string;
            transactionType: string | null;
            bolt12: string | null;
            isValid: boolean;
            contactName: string;
            clearOnBackPress: boolean;
        }
    >;
}

interface SendState {
    isValid: boolean;
    transactionType: string | null;
    bolt12: string | null;
    destination: string;
    amount: string;
    satAmount: string | number;
    fee: string;
    error_msg: string;
    utxos: Array<string>;
    utxoBalance: number;
    confirmationTarget: string;
    maxParts: string;
    maxShardAmt: string;
    feeLimitSat: string;
    maxFeePercent: string;
    message: string;
    enableAtomicMultiPathPayment: boolean;
    clipboard: string;
    loading: boolean;
    contactName: string;
    clearOnBackPress: boolean;
    account: string;
    additionalOutputs: Array<AdditionalOutput>;
    fundMax: boolean;
}

@inject(
    'InvoicesStore',
    'ModalStore',
    'NodeInfoStore',
    'TransactionsStore',
    'BalanceStore',
    'SettingsStore',
    'UTXOsStore',
    'ContactStore'
)
@observer
export default class Send extends React.Component<SendProps, SendState> {
    listener: any;
    private backPressSubscription: NativeEventSubscription;

    constructor(props: SendProps) {
        super(props);
        const { route } = props;
        const {
            destination,
            amount,
            transactionType,
            isValid,
            contactName,
            bolt12
        } = route.params ?? {};
        const clearOnBackPress = route.params?.clearOnBackPress ?? !destination;

        if (transactionType === 'Lightning') {
            this.props.InvoicesStore.getPayReq(destination);
        }

        this.state = {
            isValid: isValid || false,
            transactionType,
            bolt12,
            destination: destination || '',
            amount: amount || '',
            satAmount: '',
            fee: '',
            utxos: [],
            utxoBalance: 0,
            confirmationTarget: '60',
            error_msg: '',
            maxParts: '16',
            maxShardAmt: '',
            feeLimitSat: '100',
            maxFeePercent: '5.0',
            message: '',
            enableAtomicMultiPathPayment: false,
            clipboard: '',
            loading: false,
            contactName,
            clearOnBackPress,
            account: 'default',
            additionalOutputs: [],
            fundMax: false
        };
    }

    async UNSAFE_componentWillMount() {
        const { SettingsStore } = this.props;
        const { getSettings } = SettingsStore;
        const settings = await getSettings();

        if (settings.privacy && settings.privacy.clipboard) {
            const clipboard = await Clipboard.getString();
            if (await isClipboardValue(clipboard)) {
                this.setState({
                    clipboard
                });
            }
        }

        if (this.listener && this.listener.stop) this.listener.stop();
    }

    UNSAFE_componentWillReceiveProps(nextProps: any) {
        const { route } = nextProps;
        const { destination, bolt12, amount, transactionType, contactName } =
            route.params ?? {};

        if (transactionType === 'Lightning') {
            this.props.InvoicesStore.getPayReq(destination);
        }

        this.setState({
            transactionType,
            destination,
            bolt12,
            isValid: true,
            contactName
        });

        if (amount) {
            this.setState({
                amount
            });
        }
    }

    async componentDidMount() {
        if (this.state.destination) {
            this.validateAddress(this.state.destination);
        }

        this.backPressSubscription = BackHandler.addEventListener(
            'hardwareBackPress',
            this.backPressed.bind(this)
        );
    }

    componentWillUnmount(): void {
        this.backPressSubscription?.remove();
    }

    subscribePayment = (streamingCall: string) => {
        const { handlePayment, handlePaymentError } =
            this.props.TransactionsStore;
        const { LncModule } = NativeModules;
        const eventEmitter = new NativeEventEmitter(LncModule);
        this.listener = eventEmitter.addListener(
            streamingCall,
            (event: any) => {
                if (event.result && event.result !== 'EOF') {
                    try {
                        const result = JSON.parse(event.result);
                        if (result && result.status !== 'IN_FLIGHT') {
                            handlePayment(result);
                            this.listener = null;
                        }
                    } catch (error: any) {
                        handlePaymentError(event.result);
                        this.listener = null;
                    }
                }
            }
        );
    };

    disableNfc = () => {
        NfcManager.setEventListener(NfcEvents.DiscoverTag, null);
        NfcManager.setEventListener(NfcEvents.SessionClosed, null);
    };

    enableNfc = async () => {
        const { ModalStore } = this.props;
        this.disableNfc();
        await NfcManager.start().catch((e) => console.warn(e.message));

        return new Promise((resolve: any) => {
            let tagFound: TagEvent | null = null;

            // enable NFC
            if (Platform.OS === 'android')
                ModalStore.toggleAndroidNfcModal(true);

            NfcManager.setEventListener(
                NfcEvents.DiscoverTag,
                (tag: TagEvent) => {
                    tagFound = tag;
                    const bytes = new Uint8Array(
                        tagFound.ndefMessage[0].payload
                    );

                    let str;
                    const decoded = Ndef.text.decodePayload(bytes);
                    if (decoded.match(/^(https?|lnurl)/)) {
                        str = decoded;
                    } else {
                        str = NFCUtils.nfcUtf8ArrayToStr(bytes) || '';
                    }

                    // close NFC
                    if (Platform.OS === 'android')
                        ModalStore.toggleAndroidNfcModal(false);

                    resolve(this.validateAddress(str));
                    NfcManager.unregisterTagEvent().catch(() => 0);
                }
            );

            NfcManager.setEventListener(NfcEvents.SessionClosed, () => {
                // close NFC
                if (Platform.OS === 'android')
                    ModalStore.toggleAndroidNfcModal(false);

                if (!tagFound) {
                    resolve();
                }
            });

            NfcManager.registerTagEvent();
        });
    };

    selectUTXOs = (
        utxos: Array<string>,
        utxoBalance: number,
        account: string
    ) => {
        this.setState((prevState) => ({
            utxos,
            utxoBalance,
            account,
            fundMax: account === 'default' ? prevState.fundMax : false
        }));
    };

    validateAddress = (text: string) => {
        const { navigation } = this.props;
        this.setState({
            loading: true,
            isValid: true,
            error_msg: ''
        });
        handleAnything(text, this.state.amount)
            .then((response) => {
                try {
                    this.setState({
                        loading: false
                    });
                    if (response) {
                        const [route, props] = response;
                        navigation.navigate(route, props);
                    }
                } catch {
                    this.setState({
                        loading: false,
                        transactionType: null,
                        isValid: false
                    });
                }
            })
            .catch((err) => {
                this.setState({
                    loading: false,
                    transactionType: null,
                    isValid: false,
                    error_msg: err.message
                });
            });
    };

    payBolt12 = async () => {
        const { satAmount, bolt12 } = this.state;
        if (!bolt12) {
            this.setState({
                loading: false,
                error_msg: localeString(
                    'views.Send.payBolt12.offerFetchFailure'
                )
            });
            return;
        }
        if (!satAmount || satAmount === '0') {
            this.setState({
                loading: false,
                error_msg: localeString('views.Send.payBolt12.specifyAmount')
            });
            return;
        }
        try {
            const split = bolt12.split('=');
            this.setState({
                loading: true,
                error_msg: ''
            });
            const res = await BackendUtils.fetchInvoiceFromOffer(
                // grok out overstring from Bitcoin URI
                // eg. bitcoin:?lno=lno1qgsyxjtl6luzd9t3pr62xr7eemp6awnejusgf6gw45q75vcfqqqqqqq2zapy7nz5yqcnygzsv9uk6etwwssyzerywfjhxuckyypvm779pgy7grg2m0j55f67e2du7359h4nad964309j93kqa0xshcs
                split[1] || bolt12,
                satAmount
            );
            if (!res.invoice) {
                this.setState({
                    loading: false,
                    error_msg: localeString(
                        'views.Send.payBolt12.invoiceFetchFailure'
                    )
                });
                return;
            }
            this.props.InvoicesStore.getPayReq(res.invoice);
            this.props.navigation.navigate('PaymentRequest');
            this.setState({
                loading: false,
                error_msg: ''
            });
        } catch (e: any) {
            this.setState({
                loading: false,
                error_msg: errorToUserFriendly(e)
            });
            return;
        }
    };

    sendCoins = (satAmount: string | number) => {
        const { TransactionsStore, SettingsStore, navigation } = this.props;
        const { implementation } = SettingsStore;
        const {
            destination,
            fee,
            utxos,
            confirmationTarget,
            account,
            additionalOutputs,
            fundMax
        } = this.state;

        let request: TransactionRequest;
        if (utxos && utxos.length > 0) {
            request = {
                addr: destination,
                sat_per_vbyte: fee,
                amount: satAmount.toString(),
                target_conf: Number(confirmationTarget),
                utxos,
                spend_unconfirmed: true,
                additional_outputs: additionalOutputs,
                account
            };
        } else {
            request = {
                addr: destination,
                sat_per_vbyte: fee,
                amount: satAmount.toString(),
                target_conf: Number(confirmationTarget),
                spend_unconfirmed: true,
                additional_outputs: additionalOutputs,
                account
            };
        }

        if (fundMax) {
            if (
                implementation === 'c-lightning-REST' ||
                implementation === 'cln-rest'
            ) {
                request.amount = 'all';
            } else {
                if (request.amount) delete request.amount;
                request.send_all = true;
            }
        }
        TransactionsStore.sendCoins(request);
        navigation.navigate('SendingOnChain');
    };

    sendKeySendPayment = (satAmount: string | number) => {
        const { TransactionsStore, SettingsStore, navigation } = this.props;
        const { implementation } = SettingsStore;
        const {
            destination,
            maxParts,
            maxShardAmt,
            message,
            enableAtomicMultiPathPayment,
            feeLimitSat,
            maxFeePercent
        } = this.state;

        let streamingCall;
        if (enableAtomicMultiPathPayment) {
            streamingCall = TransactionsStore.sendPayment({
                amount: satAmount.toString(),
                pubkey: destination,
                message,
                max_parts: maxParts,
                max_shard_amt: maxShardAmt,
                fee_limit_sat: feeLimitSat,
                amp: true
            });
        } else {
            streamingCall = TransactionsStore.sendPayment({
                amount: satAmount.toString(),
                pubkey: destination,
                fee_limit_sat: feeLimitSat,
                max_fee_percent: maxFeePercent,
                message
            });
        }

        if (implementation === 'lightning-node-connect') {
            this.subscribePayment(streamingCall);
        }

        navigation.navigate('SendingLightning');
    };

    displayAddress = (item: any) => {
        const contact = new Contact(item);
        const {
            hasLnAddress,
            hasBolt12Address,
            hasBolt12Offer,
            hasOnchainAddress,
            hasPubkey,
            hasMultiplePayableAddresses
        } = contact;

        if (hasMultiplePayableAddresses) {
            return localeString('views.Settings.Contacts.multipleAddresses');
        }

        if (hasLnAddress) {
            return item.lnAddress[0].length > 23
                ? `${item.lnAddress[0].slice(
                      0,
                      10
                  )}...${item.lnAddress[0].slice(-10)}`
                : item.lnAddress[0];
        }

        if (hasBolt12Address) {
            return item.bolt12Address[0].length > 23
                ? `${item.bolt12Address[0].slice(
                      0,
                      10
                  )}...${item.bolt12Address[0].slice(-10)}`
                : item.bolt12Address[0];
        }

        if (hasBolt12Offer) {
            return item.bolt12Offer[0].length > 23
                ? `${item.bolt12Offer[0].slice(
                      0,
                      10
                  )}...${item.bolt12Offer[0].slice(-10)}`
                : item.bolt12Offer[0];
        }

        if (hasOnchainAddress) {
            return item.onchainAddress[0].length > 23
                ? `${item.onchainAddress[0].slice(
                      0,
                      12
                  )}...${item.onchainAddress[0].slice(-8)}`
                : item.onchainAddress[0];
        }

        if (hasPubkey) {
            return item.pubkey[0].length > 23
                ? `${item.pubkey[0].slice(0, 12)}...${item.pubkey[0].slice(-8)}`
                : item.pubkey[0];
        }

        return localeString('views.Settings.Contacts.noAddress');
    };

    renderContactItem = ({ item }: { item: Contact }) => {
        const { navigation } = this.props;
        const contact = new Contact(item);
        return (
            <TouchableOpacity
                onPress={() => {
                    if (contact.isSingleLnAddress) {
                        this.validateAddress(item.lnAddress[0]);
                    } else if (contact.isSingleBolt12Address) {
                        this.validateAddress(item.bolt12Address[0]);
                    } else if (contact.isSingleBolt12Offer) {
                        this.validateAddress(item.bolt12Offer[0]);
                    } else if (contact.isSingleOnchainAddress) {
                        this.validateAddress(item.onchainAddress[0]);
                    } else if (contact.isSinglePubkey) {
                        this.validateAddress(item.pubkey[0]);
                    } else {
                        navigation.navigate('ContactDetails', {
                            contactId: contact.getContactId,
                            isNostrContact: false
                        });
                    }
                }}
            >
                <View
                    style={{
                        marginHorizontal: 28,
                        paddingBottom: 20,
                        flexDirection: 'row',
                        alignItems: 'center'
                    }}
                >
                    {contact.photo && (
                        <Image
                            source={{ uri: contact.getPhoto }}
                            style={{
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                marginRight: 10
                            }}
                        />
                    )}
                    <View>
                        <Text
                            style={{ fontSize: 16, color: themeColor('text') }}
                        >
                            {item.name}
                        </Text>
                        <Text
                            style={{
                                fontSize: 16,
                                color: themeColor('secondaryText')
                            }}
                        >
                            {this.displayAddress(item)}
                        </Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    backPressed = () => {
        if (this.state.clearOnBackPress && this.state.transactionType) {
            this.setState({
                contactName: '',
                destination: '',
                transactionType: ''
            });
            this.props.navigation.setParams({
                contactName: '',
                destination: '',
                transactionType: ''
            });
        } else {
            this.props.navigation.pop();
        }
        return true;
    };

    render() {
        const {
            SettingsStore,
            BalanceStore,
            UTXOsStore,
            ContactStore,
            navigation
        } = this.props;
        const {
            isValid,
            transactionType,
            destination,
            amount,
            satAmount,
            fee,
            confirmationTarget,
            utxoBalance,
            error_msg,
            maxParts,
            maxShardAmt,
            message,
            enableAtomicMultiPathPayment,
            clipboard,
            loading,
            contactName,
            additionalOutputs,
            fundMax,
            account
        } = this.state;
        const {
            confirmedBlockchainBalance,
            totalBlockchainBalanceAccounts,
            lightningBalance
        } = BalanceStore;
        const { implementation } = SettingsStore;
        const { contacts } = ContactStore;

        const paymentOptions = [localeString('views.Send.lnPayment')];

        if (BackendUtils.supportsOffers()) {
            paymentOptions.push(
                localeString('views.Settings.Bolt12Address'),
                localeString('views.Settings.Bolt12Offer')
            );
        }

        if (BackendUtils.supportsOnchainSends()) {
            paymentOptions.push(localeString('views.Send.btcAddress'));
        }
        if (BackendUtils.supportsKeysend()) {
            paymentOptions.push(localeString('views.Send.keysendAddress'));
        }

        const favoriteContacts = contacts.filter(
            (contact: Contact) => contact.isFavourite
        );

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    onBack={this.backPressed.bind(this)}
                    navigateBackOnBackPress={false}
                    centerComponent={{
                        text: localeString('views.Send.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={
                        <View
                            style={{
                                flex: 1,
                                flexDirection: 'row',
                                marginTop: 3
                            }}
                        >
                            {loading && (
                                <View style={{ paddingRight: 15 }}>
                                    <LoadingIndicator size={30} />
                                </View>
                            )}
                            {BackendUtils.supportsSweep() &&
                                isValid &&
                                transactionType === 'On-chain' &&
                                additionalOutputs.length === 0 && (
                                    <View
                                        style={{
                                            marginRight: 20
                                        }}
                                    >
                                        <TouchableOpacity
                                            onPress={() =>
                                                navigation.navigate('Sweep', {
                                                    destination,
                                                    isValid
                                                })
                                            }
                                        >
                                            <Sweep
                                                fill={themeColor('text')}
                                                width={30}
                                                height={30}
                                            />
                                        </TouchableOpacity>
                                    </View>
                                )}
                            <View style={{ marginRight: 15 }}>
                                <TouchableOpacity
                                    onPress={() => this.enableNfc()}
                                >
                                    <NFC
                                        fill={themeColor('text')}
                                        width={30}
                                        height={30}
                                    />
                                </TouchableOpacity>
                            </View>
                            <View>
                                <TouchableOpacity
                                    onPress={() =>
                                        navigation.navigate(
                                            'HandleAnythingQRScanner'
                                        )
                                    }
                                >
                                    <Scan
                                        fill={themeColor('text')}
                                        width={30}
                                        height={30}
                                    />
                                </TouchableOpacity>
                            </View>
                        </View>
                    }
                    navigation={navigation}
                />
                <ScrollView
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                >
                    {!!error_msg && !!destination && (
                        <View style={{ marginVertical: 10 }}>
                            <ErrorMessage
                                message={error_msg}
                                mainStyle={{ marginVertical: 10 }}
                            />
                        </View>
                    )}

                    {!!destination &&
                        transactionType === 'On-chain' &&
                        BackendUtils.supportsOnchainSends() &&
                        totalBlockchainBalanceAccounts === 0 && (
                            <View style={{ marginBottom: 10 }}>
                                <WarningMessage
                                    message={localeString(
                                        'views.Send.noOnchainBalance'
                                    )}
                                />
                            </View>
                        )}
                    {!!destination &&
                        (transactionType === 'Lightning' ||
                            transactionType === 'Keysend' ||
                            transactionType === 'BOLT 12') &&
                        lightningBalance === 0 && (
                            <View style={{ marginBottom: 10 }}>
                                <WarningMessage
                                    message={localeString(
                                        'views.Send.noLightningBalance'
                                    )}
                                />
                            </View>
                        )}
                    {transactionType ? (
                        <>
                            <Text
                                style={{
                                    ...styles.text,
                                    color: themeColor('secondaryText')
                                }}
                            >
                                {localeString('general.destination')}
                            </Text>
                            <TextInput
                                value={destination}
                                locked={true}
                                multiline={true}
                                textInputStyle={{
                                    fontSize: 100,
                                    marginTop: 10,
                                    marginBottom: 10
                                }}
                            />
                        </>
                    ) : (
                        <>
                            <Text
                                style={{
                                    ...styles.text,
                                    color: themeColor('secondaryText')
                                }}
                            >
                                {paymentOptions.join(', ')}
                            </Text>
                            <View
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center'
                                }}
                            >
                                <TextInput
                                    placeholder={'lnbc1...'}
                                    value={contactName ? '' : destination}
                                    onChangeText={(text: string) => {
                                        this.setState({
                                            destination: text.replace(/\s/, ''),
                                            error_msg: ''
                                        });
                                    }}
                                    style={{
                                        flex: 1,
                                        paddingHorizontal: 15,
                                        paddingRight: 40
                                    }}
                                    autoCorrect={false}
                                    autoCapitalize="none"
                                />
                                {contactName && (
                                    <View
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            position: 'absolute',
                                            left: 10,
                                            top: 22
                                        }}
                                    >
                                        <Chip
                                            title={contactName}
                                            titleStyle={{
                                                ...styles.text,
                                                color: themeColor('background'),
                                                backgroundColor:
                                                    themeColor('chain')
                                            }}
                                            // @ts-ignore:next-line
                                            type="inline"
                                            containerStyle={{
                                                backgroundColor:
                                                    themeColor('chain'),
                                                borderRadius: 8,
                                                paddingRight: 24
                                            }}
                                        />
                                        <TouchableOpacity
                                            onPress={() => {
                                                this.setState({
                                                    contactName: '',
                                                    destination: '',
                                                    transactionType: ''
                                                });
                                                navigation.setParams({
                                                    contactName: '',
                                                    destination: '',
                                                    transactionType: ''
                                                });
                                            }}
                                            style={{
                                                position: 'absolute',
                                                right: 8,
                                                top: 8
                                            }}
                                        >
                                            <Icon
                                                name="close-circle"
                                                type="material-community"
                                                size={18}
                                                color={themeColor('background')}
                                            />
                                        </TouchableOpacity>
                                    </View>
                                )}
                                <TouchableOpacity
                                    onPress={() =>
                                        navigation.navigate('Contacts', {
                                            SendScreen: true
                                        })
                                    }
                                    style={{ position: 'absolute', right: 10 }}
                                >
                                    <ContactIcon stroke={themeColor('text')} />
                                </TouchableOpacity>
                            </View>
                        </>
                    )}

                    {!isValid && !!destination && error_msg && (
                        <Text
                            style={{
                                ...styles.text,
                                color: themeColor('text'),
                                paddingBottom: 5
                            }}
                        >
                            {localeString('views.Send.mustBeValid')}{' '}
                            {paymentOptions.join(', ')}
                        </Text>
                    )}
                    {transactionType && (
                        <Text
                            style={{
                                ...styles.text,
                                color: themeColor('text'),
                                marginBottom: 10,
                                paddingBottom: 5
                            }}
                        >{`${transactionType} Transaction`}</Text>
                    )}
                    {transactionType === 'On-chain' &&
                        !BackendUtils.supportsOnchainSends() && (
                            <Text
                                style={{
                                    ...styles.text,
                                    color: themeColor('secondaryText')
                                }}
                            >
                                {localeString('views.Send.onChainNotSupported')}{' '}
                                {implementation}
                            </Text>
                        )}
                    {transactionType === 'On-chain' &&
                        BackendUtils.supportsOnchainSends() && (
                            <React.Fragment>
                                {!fundMax && (
                                    <AmountInput
                                        amount={amount}
                                        title={localeString(
                                            'views.Send.amount'
                                        )}
                                        onAmountChange={(
                                            amount: string,
                                            satAmount: string | number
                                        ) => {
                                            this.setState({
                                                amount,
                                                satAmount
                                            });
                                        }}
                                        hideConversion={amount === 'all'}
                                    />
                                )}

                                <View style={{ paddingBottom: 15 }}>
                                    {fundMax && (
                                        <>
                                            <Amount
                                                sats={
                                                    utxoBalance > 0
                                                        ? utxoBalance
                                                        : confirmedBlockchainBalance
                                                }
                                                fixedUnits="BTC"
                                            />
                                            <Amount
                                                sats={
                                                    utxoBalance > 0
                                                        ? utxoBalance
                                                        : confirmedBlockchainBalance
                                                }
                                                fixedUnits="sats"
                                            />
                                        </>
                                    )}
                                </View>

                                {BackendUtils.supportsOnchainSendMax() &&
                                    additionalOutputs.length === 0 &&
                                    account === 'default' && (
                                        <View style={{ marginBottom: 18 }}>
                                            <Text
                                                style={{
                                                    marginTop: -20,
                                                    top: 20,
                                                    color: themeColor(
                                                        'secondaryText'
                                                    )
                                                }}
                                            >
                                                {localeString(
                                                    'views.OpenChannel.fundMax'
                                                )}
                                            </Text>
                                            <Switch
                                                value={fundMax}
                                                onValueChange={() => {
                                                    const newValue: boolean =
                                                        !fundMax;
                                                    this.setState({
                                                        fundMax: newValue,
                                                        amount:
                                                            newValue &&
                                                            (implementation ===
                                                                'c-lightning-REST' ||
                                                                implementation ===
                                                                    'cln-rest')
                                                                ? 'all'
                                                                : ''
                                                    });
                                                }}
                                            />
                                        </View>
                                    )}

                                {additionalOutputs.map((output, index) => {
                                    return (
                                        <View key={`additionalOutput-${index}`}>
                                            <Text
                                                style={{
                                                    ...styles.text,
                                                    color: themeColor(
                                                        'secondaryText'
                                                    )
                                                }}
                                            >
                                                {localeString(
                                                    'general.destination'
                                                )}
                                            </Text>
                                            <TextInput
                                                value={output?.address}
                                                multiline={true}
                                                textInputStyle={{
                                                    fontSize: 100,
                                                    marginTop: 10,
                                                    marginBottom: 10
                                                }}
                                                onChangeText={(
                                                    text: string
                                                ) => {
                                                    let newOutputs =
                                                        additionalOutputs;

                                                    newOutputs[index].address =
                                                        text;

                                                    this.setState({
                                                        additionalOutputs:
                                                            newOutputs
                                                    });
                                                }}
                                            />
                                            <AmountInput
                                                amount={output?.amount.toString()}
                                                title={localeString(
                                                    'views.Send.amount'
                                                )}
                                                onAmountChange={(
                                                    amount: string,
                                                    satAmount: string | number
                                                ) => {
                                                    let newOutputs =
                                                        additionalOutputs;

                                                    newOutputs[index].amount =
                                                        amount;
                                                    newOutputs[
                                                        index
                                                    ].satAmount = satAmount;

                                                    this.setState({
                                                        additionalOutputs:
                                                            newOutputs
                                                    });
                                                }}
                                            />
                                            <View
                                                style={{
                                                    marginTop: 10,
                                                    marginBottom: 20
                                                }}
                                            >
                                                <Button
                                                    title={localeString(
                                                        'views.Send.removeOutput'
                                                    )}
                                                    icon={{
                                                        name: 'remove',
                                                        size: 25,
                                                        color: themeColor(
                                                            'background'
                                                        )
                                                    }}
                                                    onPress={() => {
                                                        let newOutputs =
                                                            additionalOutputs;

                                                        newOutputs =
                                                            newOutputs.filter(
                                                                (item) =>
                                                                    item !==
                                                                    output
                                                            );

                                                        this.setState({
                                                            additionalOutputs:
                                                                newOutputs
                                                        });
                                                    }}
                                                    tertiary
                                                />
                                            </View>
                                        </View>
                                    );
                                })}

                                {transactionType === 'On-chain' &&
                                    BackendUtils.supportsOnchainBatching() &&
                                    !fundMax && (
                                        <View
                                            style={{
                                                marginTop: 0,
                                                marginBottom: 20
                                            }}
                                        >
                                            <Button
                                                title={localeString(
                                                    'views.Send.addOutput'
                                                )}
                                                icon={{
                                                    name: 'add',
                                                    size: 25,
                                                    color: themeColor(
                                                        'background'
                                                    )
                                                }}
                                                onPress={() => {
                                                    const additionalOutputs =
                                                        this.state
                                                            .additionalOutputs;

                                                    additionalOutputs.push({
                                                        address: '',
                                                        amount: '',
                                                        satAmount: ''
                                                    });

                                                    this.setState({
                                                        additionalOutputs
                                                    });
                                                }}
                                            />
                                        </View>
                                    )}

                                {BackendUtils.supportsCoinControl() && (
                                    <View style={{ marginBottom: 20 }}>
                                        <UTXOPicker
                                            onValueChange={this.selectUTXOs}
                                            UTXOsStore={UTXOsStore}
                                        />
                                    </View>
                                )}

                                <Text
                                    style={{
                                        ...styles.text,
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {localeString('views.Send.feeSatsVbyte')}
                                </Text>

                                <OnchainFeeInput
                                    fee={fee}
                                    onChangeFee={(text: string) =>
                                        this.setState({ fee: text })
                                    }
                                    navigation={navigation}
                                />

                                <View
                                    style={{
                                        ...styles.button,
                                        paddingBottom: 130
                                    }}
                                >
                                    <Button
                                        title={localeString(
                                            'views.Send.sendCoins'
                                        )}
                                        icon={{
                                            name: 'send',
                                            size: 25,
                                            color:
                                                totalBlockchainBalanceAccounts ===
                                                    0 ||
                                                fee === '0' ||
                                                !fee
                                                    ? themeColor(
                                                          'secondaryText'
                                                      )
                                                    : themeColor('background')
                                        }}
                                        onPress={() =>
                                            this.sendCoins(satAmount)
                                        }
                                        disabled={
                                            totalBlockchainBalanceAccounts ===
                                                0 ||
                                            fee === '0' ||
                                            !fee
                                        }
                                    />
                                </View>
                            </React.Fragment>
                        )}
                    {transactionType === 'BOLT 12' &&
                        BackendUtils.supportsOffers() && (
                            <React.Fragment>
                                <AmountInput
                                    amount={amount}
                                    title={localeString('views.Send.amount')}
                                    onAmountChange={(
                                        amount: string,
                                        satAmount: string | number
                                    ) => {
                                        this.setState({
                                            amount,
                                            satAmount
                                        });
                                    }}
                                />
                            </React.Fragment>
                        )}
                    {transactionType === 'BOLT 12' &&
                        !BackendUtils.supportsOffers() && (
                            <Text
                                style={{
                                    ...styles.text,
                                    marginTop: 10,
                                    color: themeColor('error')
                                }}
                            >
                                {localeString(
                                    'views.Send.payBolt12.offersNotSupported'
                                )}
                            </Text>
                        )}
                    {transactionType === 'Keysend' &&
                        BackendUtils.supportsKeysend() && (
                            <React.Fragment>
                                <AmountInput
                                    amount={amount}
                                    title={localeString('views.Send.amount')}
                                    onAmountChange={(
                                        amount: string,
                                        satAmount: string | number
                                    ) => {
                                        this.setState({
                                            amount,
                                            satAmount
                                        });
                                    }}
                                />

                                {implementation !== 'c-lightning-REST' &&
                                    implementation !== 'cln-rest' && (
                                        <>
                                            <Text
                                                style={{
                                                    ...styles.text,
                                                    marginTop: 10,
                                                    color: themeColor(
                                                        'secondaryText'
                                                    )
                                                }}
                                            >
                                                {`${localeString(
                                                    'views.Send.message'
                                                )} (${localeString(
                                                    'general.optional'
                                                )})`}
                                            </Text>
                                            <TextInput
                                                keyboardType="default"
                                                value={message}
                                                onChangeText={(text: string) =>
                                                    this.setState({
                                                        message: text
                                                    })
                                                }
                                            />
                                        </>
                                    )}

                                <FeeLimit
                                    satAmount={satAmount}
                                    onFeeLimitSatChange={(value: string) =>
                                        this.setState({
                                            feeLimitSat: value
                                        })
                                    }
                                    onMaxFeePercentChange={(value: string) =>
                                        this.setState({
                                            maxFeePercent: value
                                        })
                                    }
                                    SettingsStore={SettingsStore}
                                />

                                {BackendUtils.supportsAMP() && (
                                    <React.Fragment>
                                        <Text
                                            style={{
                                                ...styles.label,
                                                color: themeColor('text'),
                                                top: 25
                                            }}
                                        >
                                            {localeString(
                                                'views.PaymentRequest.amp'
                                            )}
                                        </Text>
                                        <View
                                            style={{
                                                flex: 1,
                                                flexDirection: 'row',
                                                justifyContent: 'flex-end'
                                            }}
                                        >
                                            <View
                                                style={{
                                                    flex: 1,
                                                    flexDirection: 'row',
                                                    justifyContent: 'flex-end'
                                                }}
                                            >
                                                <Switch
                                                    value={
                                                        enableAtomicMultiPathPayment
                                                    }
                                                    onValueChange={() =>
                                                        this.setState({
                                                            enableAtomicMultiPathPayment:
                                                                !enableAtomicMultiPathPayment
                                                        })
                                                    }
                                                />
                                            </View>
                                        </View>
                                    </React.Fragment>
                                )}
                                {BackendUtils.supportsAMP() &&
                                    enableAtomicMultiPathPayment && (
                                        <React.Fragment>
                                            <Text
                                                style={{
                                                    ...styles.text,
                                                    color: themeColor(
                                                        'secondaryText'
                                                    )
                                                }}
                                            >
                                                {`${localeString(
                                                    'views.PaymentRequest.maxParts'
                                                )} (${localeString(
                                                    'general.optional'
                                                )})`}
                                            </Text>
                                            <TextInput
                                                keyboardType="numeric"
                                                value={maxParts}
                                                onChangeText={(text: string) =>
                                                    this.setState({
                                                        maxParts: text
                                                    })
                                                }
                                            />
                                            <Text
                                                style={{
                                                    ...styles.text,
                                                    color: themeColor('text'),
                                                    paddingBottom: 15
                                                }}
                                            >
                                                {localeString(
                                                    'views.PaymentRequest.maxPartsDescription'
                                                )}
                                            </Text>
                                            <Text
                                                style={{
                                                    ...styles.text,
                                                    color: themeColor(
                                                        'secondaryText'
                                                    )
                                                }}
                                            >
                                                {`${localeString(
                                                    'views.PaymentRequest.maxShardAmt'
                                                )} (${localeString(
                                                    'general.sats'
                                                )}) (${localeString(
                                                    'general.optional'
                                                )})`}
                                            </Text>
                                            <TextInput
                                                keyboardType="numeric"
                                                value={maxShardAmt}
                                                onChangeText={(text: string) =>
                                                    this.setState({
                                                        maxShardAmt: text
                                                    })
                                                }
                                            />
                                        </React.Fragment>
                                    )}
                                <View style={styles.button}>
                                    <Button
                                        title={localeString('general.send')}
                                        icon={{
                                            name: 'send',
                                            size: 25,
                                            color:
                                                lightningBalance === 0
                                                    ? themeColor(
                                                          'secondaryText'
                                                      )
                                                    : themeColor('background')
                                        }}
                                        onPress={() =>
                                            this.sendKeySendPayment(satAmount)
                                        }
                                        disabled={lightningBalance === 0}
                                    />
                                </View>
                            </React.Fragment>
                        )}
                    {transactionType === 'Keysend' &&
                        !BackendUtils.supportsKeysend() && (
                            <React.Fragment>
                                <Text
                                    style={{
                                        ...styles.text,
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {localeString('views.Send.sorry')},{' '}
                                    {implementation}{' '}
                                    {localeString(
                                        'views.Send.keysendNotSupported'
                                    )}
                                </Text>
                            </React.Fragment>
                        )}
                    {transactionType === 'Lightning' && (
                        <View style={styles.button}>
                            <Button
                                title={localeString('views.Send.lookup')}
                                icon={{
                                    name: 'send',
                                    size: 25,
                                    color:
                                        lightningBalance === 0
                                            ? themeColor('secondaryText')
                                            : themeColor('background')
                                }}
                                onPress={() =>
                                    navigation.navigate('PaymentRequest')
                                }
                                disabled={lightningBalance === 0}
                            />
                        </View>
                    )}
                    {destination && transactionType === 'BOLT 12' && (
                        <View style={styles.button}>
                            <Button
                                title={localeString('general.proceed')}
                                onPress={async () => await this.payBolt12()}
                                disabled={!BackendUtils.supportsOffers()}
                            />
                        </View>
                    )}

                    {!!clipboard && !destination && (
                        <View style={styles.button}>
                            <Button
                                title={localeString('general.paste')}
                                onPress={() => this.validateAddress(clipboard)}
                                secondary
                            />
                        </View>
                    )}

                    {destination && !transactionType && (
                        <View style={styles.button}>
                            <Button
                                title={localeString('general.proceed')}
                                onPress={() =>
                                    this.validateAddress(destination)
                                }
                            />
                        </View>
                    )}

                    {!transactionType && favoriteContacts.length > 0 && (
                        <>
                            <View style={{ marginTop: 18 }}>
                                <Text
                                    style={{
                                        fontSize: 16,
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {`${localeString(
                                        'views.Settings.Contacts.favorites'
                                    ).toUpperCase()} (${
                                        favoriteContacts.length
                                    })`}
                                </Text>
                            </View>
                            <View style={{ marginTop: 20, marginLeft: -24 }}>
                                <FlatList
                                    data={favoriteContacts}
                                    renderItem={this.renderContactItem}
                                    keyExtractor={(_, index) =>
                                        index.toString()
                                    }
                                    scrollEnabled={false}
                                />
                            </View>
                        </>
                    )}

                    {transactionType === 'On-chain' &&
                        implementation === 'eclair' && (
                            <View style={styles.feeTableButton}>
                                <TextInput
                                    keyboardType="numeric"
                                    value={confirmationTarget}
                                    onChangeText={(text: string) =>
                                        this.setState({
                                            confirmationTarget: text
                                        })
                                    }
                                />
                            </View>
                        )}
                </ScrollView>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    text: {
        fontFamily: 'PPNeueMontreal-Book'
    },
    secondaryText: {
        fontFamily: 'PPNeueMontreal-Book'
    },
    content: {
        padding: 20,
        paddingTop: 10
    },
    button: {
        alignItems: 'center',
        paddingTop: 30
    },
    feeTableButton: {
        paddingTop: 15,
        alignItems: 'center',
        minHeight: 75
    },
    editFeeButton: {
        paddingTop: 15,
        alignItems: 'center'
    },
    label: {
        fontFamily: 'PPNeueMontreal-Book',
        paddingTop: 5
    }
});
