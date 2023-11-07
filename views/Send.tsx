import * as React from 'react';
import {
    Platform,
    NativeModules,
    NativeEventEmitter,
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity
} from 'react-native';
import { Chip, Icon } from 'react-native-elements';

import Clipboard from '@react-native-clipboard/clipboard';
import { inject, observer } from 'mobx-react';

import NfcManager, {
    NfcEvents,
    TagEvent,
    Ndef
} from 'react-native-nfc-manager';

import handleAnything, { isClipboardValue } from '../utils/handleAnything';

import BalanceStore from '../stores/BalanceStore';
import InvoicesStore from '../stores/InvoicesStore';
import ModalStore from '../stores/ModalStore';
import NodeInfoStore from '../stores/NodeInfoStore';
import SettingsStore from '../stores/SettingsStore';
import TransactionsStore from '../stores/TransactionsStore';
import UTXOsStore from '../stores/UTXOsStore';

import Amount from '../components/Amount';
import AmountInput from '../components/AmountInput';
import Button from '../components/Button';
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
import NFCUtils from '../utils/NFCUtils';
import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import ContactIcon from '../assets/images/SVG/PeersContact.svg';
import Scan from '../assets/images/SVG/Scan.svg';
import Sweep from '../assets/images/SVG/Sweep.svg';

interface SendProps {
    exitSetup: any;
    navigation: any;
    BalanceStore: BalanceStore;
    InvoicesStore: InvoicesStore;
    ModalStore: ModalStore;
    NodeInfoStore: NodeInfoStore;
    TransactionsStore: TransactionsStore;
    SettingsStore: SettingsStore;
    UTXOsStore: UTXOsStore;
}

interface SendState {
    isValid: boolean;
    transactionType: string | null;
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
    message: string;
    enableAtomicMultiPathPayment: boolean;
    clipboard: string;
    loading: boolean;
    preventUnitReset: boolean;
    contactName: string;
}

@inject(
    'InvoicesStore',
    'ModalStore',
    'NodeInfoStore',
    'TransactionsStore',
    'BalanceStore',
    'SettingsStore',
    'UTXOsStore'
)
@observer
export default class Send extends React.Component<SendProps, SendState> {
    listener: any;
    constructor(props: SendProps) {
        super(props);
        const { navigation } = props;
        const destination = navigation.getParam('destination', null);
        const amount = navigation.getParam('amount', null);
        const transactionType = navigation.getParam('transactionType', null);
        const isValid = navigation.getParam('isValid', false);
        const preventUnitReset = navigation.getParam('preventUnitReset', false);
        const contactName = navigation.getParam('contactName', null);

        if (transactionType === 'Lightning') {
            this.props.InvoicesStore.getPayReq(destination);
        }

        this.state = {
            isValid: isValid || false,
            transactionType,
            destination: destination || '',
            amount: amount || '',
            satAmount: '',
            fee: '2',
            utxos: [],
            utxoBalance: 0,
            confirmationTarget: '60',
            error_msg: '',
            maxParts: '16',
            maxShardAmt: '',
            feeLimitSat: '',
            message: '',
            enableAtomicMultiPathPayment: false,
            clipboard: '',
            loading: false,
            preventUnitReset,
            contactName
        };
    }

    async UNSAFE_componentWillMount() {
        const { SettingsStore } = this.props;
        const { settings } = SettingsStore;

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
        const { navigation } = nextProps;
        const destination = navigation.getParam('destination', null);
        const amount = navigation.getParam('amount', null);
        const transactionType = navigation.getParam('transactionType', null);
        const contactName = navigation.getParam('contactName', null);

        if (transactionType === 'Lightning') {
            this.props.InvoicesStore.getPayReq(destination);
        }

        this.setState({
            transactionType,
            destination,
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
    }

    async componentDidUpdate(prevProps, prevState) {
        if (this.state.destination !== prevState.destination) {
            this.validateAddress(this.state.destination);
        }
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

    selectUTXOs = (utxos: Array<string>, utxoBalance: number) => {
        const { SettingsStore } = this.props;
        const { implementation } = SettingsStore;
        this.setState((prevState) => {
            ({
                utxos,
                utxoBalance,
                amount:
                    implementation === 'c-lightning-REST'
                        ? 'all'
                        : prevState.amount
            });
        });
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

    sendCoins = (satAmount: string | number) => {
        const { TransactionsStore, navigation } = this.props;
        const { destination, fee, utxos, confirmationTarget } = this.state;

        let request;
        if (utxos && utxos.length > 0) {
            request = {
                addr: destination,
                sat_per_vbyte: fee,
                amount: satAmount.toString(),
                target_conf: Number(confirmationTarget),
                utxos,
                spend_unconfirmed: true
            };
        } else {
            request = {
                addr: destination,
                sat_per_vbyte: fee,
                amount: satAmount.toString(),
                target_conf: Number(confirmationTarget),
                spend_unconfirmed: true
            };
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
            feeLimitSat,
            message,
            enableAtomicMultiPathPayment
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
                message
            });
        }

        if (implementation === 'lightning-node-connect') {
            this.subscribePayment(streamingCall);
        }

        navigation.navigate('SendingLightning');
    };

    handleOnNavigateBack = (fee: string) => {
        this.setState({
            fee
        });
    };

    render() {
        const { SettingsStore, BalanceStore, UTXOsStore, navigation } =
            this.props;
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
            feeLimitSat,
            message,
            enableAtomicMultiPathPayment,
            clipboard,
            loading,
            preventUnitReset,
            contactName
        } = this.state;
        const {
            confirmedBlockchainBalance,
            unconfirmedBlockchainBalance,
            lightningBalance
        } = BalanceStore;
        const { implementation } = SettingsStore;

        const paymentOptions = [localeString('views.Send.lnPayment')];

        if (BackendUtils.supportsOnchainSends()) {
            paymentOptions.push(localeString('views.Send.btcAddress'));
        }
        if (BackendUtils.supportsKeysend()) {
            paymentOptions.push(localeString('views.Send.keysendAddress'));
        }
        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Send.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'Lato-Regular'
                        }
                    }}
                    rightComponent={
                        <View style={{ flex: 1, flexDirection: 'row' }}>
                            {loading && (
                                <View style={{ paddingRight: 15 }}>
                                    <LoadingIndicator size={30} />
                                </View>
                            )}
                            {BackendUtils.supportsSweep() &&
                                isValid &&
                                transactionType === 'On-chain' && (
                                    <View
                                        style={{
                                            marginTop: 3,
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
                            <View style={{ marginTop: 3 }}>
                                <TouchableOpacity
                                    onPress={() =>
                                        navigation.navigate(
                                            'HandleAnythingQRScanner'
                                        )
                                    }
                                >
                                    <Scan
                                        fill={themeColor('text')}
                                        width={35}
                                        height={35}
                                    />
                                </TouchableOpacity>
                            </View>
                        </View>
                    }
                    navigation={navigation}
                />
                <ScrollView
                    style={styles.content}
                    keyboardShouldPersistTaps="handled"
                >
                    {!!destination &&
                        transactionType === 'On-chain' &&
                        BackendUtils.supportsOnchainSends() &&
                        confirmedBlockchainBalance === 0 &&
                        unconfirmedBlockchainBalance === 0 && (
                            <View style={{ paddingTop: 10, paddingBottom: 10 }}>
                                <WarningMessage
                                    message={localeString(
                                        'views.Send.noOnchainBalance'
                                    )}
                                />
                            </View>
                        )}
                    {!!destination &&
                        (transactionType === 'Lightning' ||
                            transactionType === 'Keysend') &&
                        lightningBalance === 0 && (
                            <View style={{ paddingTop: 10, paddingBottom: 10 }}>
                                <WarningMessage
                                    message={localeString(
                                        'views.Send.noLightningBalance'
                                    )}
                                />
                            </View>
                        )}
                    <Text
                        style={{
                            ...styles.text,
                            color: themeColor('secondaryText')
                        }}
                    >
                        {paymentOptions.join(', ')}
                    </Text>
                    <View
                        style={{ flexDirection: 'row', alignItems: 'center' }}
                    >
                        <TextInput
                            placeholder={'lnbc1...'}
                            value={!contactName && destination}
                            onChangeText={(text: string) => {
                                this.setState({
                                    destination: text
                                });
                                this.validateAddress(text);
                            }}
                            style={{
                                flex: 1,
                                paddingVertical: 10,
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
                                        backgroundColor: themeColor('chain')
                                    }}
                                    type="inline"
                                    containerStyle={{
                                        backgroundColor: themeColor('chain'),
                                        borderRadius: 8,
                                        paddingRight: 24
                                    }}
                                />
                                <TouchableOpacity
                                    onPress={() => {
                                        this.setState({
                                            contactName: '',
                                            destination: ''
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

                    {!!error_msg && !!destination && (
                        <View style={{ paddingTop: 10, paddingBottom: 10 }}>
                            <ErrorMessage message={error_msg} />
                        </View>
                    )}
                    {!isValid && !!destination && (
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
                                    hideConversion={amount === 'all'}
                                />

                                <View style={{ paddingBottom: 15 }}>
                                    {amount === 'all' && (
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

                                <Text
                                    style={{
                                        ...styles.text,
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {localeString('views.Send.feeSatsVbyte')}:
                                </Text>

                                <OnchainFeeInput
                                    fee={fee}
                                    onChangeFee={(text: string) =>
                                        this.setState({ fee: text })
                                    }
                                />
                                {BackendUtils.supportsCoinControl() &&
                                    !BackendUtils.isLNDBased && (
                                        <UTXOPicker
                                            onValueChange={this.selectUTXOs}
                                            UTXOsStore={UTXOsStore}
                                        />
                                    )}
                                <View style={styles.button}>
                                    <Button
                                        title={localeString(
                                            'views.Send.sendCoins'
                                        )}
                                        icon={{
                                            name: 'send',
                                            size: 25
                                        }}
                                        onPress={() =>
                                            this.sendCoins(satAmount)
                                        }
                                    />
                                </View>
                            </React.Fragment>
                        )}
                    {transactionType === 'Keysend' &&
                        BackendUtils.supportsKeysend() && (
                            <React.Fragment>
                                <AmountInput
                                    amount={amount}
                                    preventUnitReset={preventUnitReset}
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

                                {BackendUtils.supportsAMP() && (
                                    <React.Fragment>
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
                                            :
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
                                                :
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
                                                    'views.PaymentRequest.feeLimit'
                                                )} (${localeString(
                                                    'general.sats'
                                                )}) (${localeString(
                                                    'general.optional'
                                                )})`}
                                                :
                                            </Text>
                                            <TextInput
                                                keyboardType="numeric"
                                                placeholder="100"
                                                value={feeLimitSat}
                                                onChangeText={(text: string) =>
                                                    this.setState({
                                                        feeLimitSat: text
                                                    })
                                                }
                                            />
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
                                                :
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
                                            size: 25
                                        }}
                                        onPress={() =>
                                            this.sendKeySendPayment(satAmount)
                                        }
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
                                    size: 25
                                }}
                                onPress={() =>
                                    navigation.navigate('PaymentRequest')
                                }
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

                    <View style={styles.button}>
                        <Button
                            title={localeString('general.enableNfc')}
                            icon={{
                                name: 'nfc',
                                size: 25
                            }}
                            onPress={() => this.enableNfc()}
                            secondary
                        />
                    </View>

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
        fontFamily: 'Lato-Regular'
    },
    secondaryText: {
        fontFamily: 'Lato-Regular'
    },
    content: {
        padding: 20
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
        fontFamily: 'Lato-Regular',
        paddingTop: 5
    }
});
