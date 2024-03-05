import * as React from 'react';
import {
    NativeModules,
    NativeEventEmitter,
    ScrollView,
    StyleSheet,
    Text,
    View,
    TouchableOpacity
} from 'react-native';
import { inject, observer } from 'mobx-react';

import Amount from '../components/Amount';
import AmountInput from '../components/AmountInput';
import Button from '../components/Button';
import Conversion from '../components/Conversion';
import FeeLimit from '../components/FeeLimit';
import Header from '../components/Header';
import HopPicker from '../components/HopPicker';
import KeyValue from '../components/KeyValue';
import LoadingIndicator from '../components/LoadingIndicator';
import Screen from '../components/Screen';
import Switch from '../components/Switch';
import TextInput from '../components/TextInput';
import { WarningMessage } from '../components/SuccessErrorMessage';

import BalanceStore from '../stores/BalanceStore';
import ChannelsStore from '../stores/ChannelsStore';
import InvoicesStore from '../stores/InvoicesStore';
import TransactionsStore, { SendPaymentReq } from '../stores/TransactionsStore';
import UnitsStore from '../stores/UnitsStore';
import NodeInfoStore from '../stores/NodeInfoStore';
import LnurlPayStore from '../stores/LnurlPayStore';
import SettingsStore from '../stores/SettingsStore';

import FeeUtils from '../utils/FeeUtils';
import { localeString } from '../utils/LocaleUtils';
import BackendUtils from '../utils/BackendUtils';
import LinkingUtils from '../utils/LinkingUtils';
import { sleep } from '../utils/SleepUtils';
import { themeColor } from '../utils/ThemeUtils';

import { Row } from '../components/layout/Row';

import CaretDown from '../assets/images/SVG/Caret Down.svg';
import CaretRight from '../assets/images/SVG/Caret Right.svg';
import QR from '../assets/images/SVG/QR.svg';

const zaplockerDestinations = [
    // OLYMPUS
    '031b301307574bbe9b9ac7b79cbe1700e31e544513eae0b5d7497483083f99e581'
    // TODO add Zaplocker.com
];

interface InvoiceProps {
    exitSetup: any;
    navigation: any;
    BalanceStore: BalanceStore;
    InvoicesStore: InvoicesStore;
    TransactionsStore: TransactionsStore;
    UnitsStore: UnitsStore;
    ChannelsStore: ChannelsStore;
    NodeInfoStore: NodeInfoStore;
    LnurlPayStore: LnurlPayStore;
    SettingsStore: SettingsStore;
}

interface InvoiceState {
    customAmount: string;
    satAmount: string | number;
    enableMultiPathPayment: boolean;
    enableAtomicMultiPathPayment: boolean;
    maxParts: string;
    maxShardAmt: string;
    feeLimitSat: string;
    feeOption: string;
    maxFeePercent: string;
    timeoutSeconds: string;
    outgoingChanId: string | null;
    lastHopPubkey: string | null;
    settingsToggle: boolean;
    zaplockerToggle: boolean;
    lightningReadyToSend: boolean;
}

@inject(
    'BalanceStore',
    'InvoicesStore',
    'TransactionsStore',
    'UnitsStore',
    'ChannelsStore',
    'NodeInfoStore',
    'LnurlPayStore',
    'SettingsStore'
)
@observer
export default class PaymentRequest extends React.Component<
    InvoiceProps,
    InvoiceState
> {
    listener: any;
    isComponentMounted: boolean = false;
    state = {
        customAmount: '',
        satAmount: '',
        enableMultiPathPayment: true,
        enableAtomicMultiPathPayment: false,
        maxParts: '16',
        maxShardAmt: '',
        feeLimitSat: '1000',
        feeOption: 'fixed',
        maxFeePercent: '5.0',
        timeoutSeconds: '60',
        outgoingChanId: null,
        lastHopPubkey: null,
        settingsToggle: false,
        zaplockerToggle: false,
        lightningReadyToSend: false
    };

    async UNSAFE_componentWillMount() {
        this.isComponentMounted = true;
        const { SettingsStore, InvoicesStore } = this.props;
        const { getSettings, implementation } = SettingsStore;
        const settings = await getSettings();

        let feeOption = 'fixed';
        const { pay_req } = InvoicesStore;
        const requestAmount = pay_req && pay_req.getRequestAmount;

        if (requestAmount && requestAmount != 0) {
            if (requestAmount > 1000) {
                feeOption = 'percent';
            }
        }

        this.setState({
            feeOption,
            feeLimitSat: settings?.payments?.defaultFeeFixed || '100',
            maxFeePercent: settings?.payments?.defaultFeePercentage || '5.0',
            timeoutSeconds: settings?.payments?.timeoutSeconds || '60'
        });

        if (implementation === 'embedded-lnd') {
            this.checkIfLndReady();
        } else {
            this.setState({
                lightningReadyToSend: true
            });
        }
    }

    componentWillUnmount(): void {
        this.isComponentMounted = false;
    }

    checkIfLndReady = async () => {
        const { BalanceStore, NodeInfoStore } = this.props;
        const noBalance = BalanceStore.lightningBalance === 0;
        const { isLightningReadyToSend } = NodeInfoStore;
        while (
            !this.state.lightningReadyToSend &&
            this.isComponentMounted &&
            !noBalance
        ) {
            const isReady = await isLightningReadyToSend();
            if (isReady) {
                this.setState({
                    lightningReadyToSend: true
                });
            }
            await sleep(3000);
        }
    };

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

    displayFeeRecommendation = () => {
        const { feeLimitSat } = this.state;
        const { InvoicesStore } = this.props;
        const { feeEstimate } = InvoicesStore;

        if (
            feeEstimate &&
            feeLimitSat &&
            Number(feeEstimate) > Number(feeLimitSat)
        ) {
            return (
                <Text
                    style={{
                        color: themeColor('error')
                    }}
                >
                    {localeString(
                        'views.PaymentRequest.feeEstimateExceedsLimit'
                    )}
                </Text>
            );
        }
        return null;
    };

    sendPayment = ({
        payment_request,
        amount, // used only for no-amount invoices
        max_parts,
        max_shard_amt,
        fee_limit_sat,
        max_fee_percent,
        outgoing_chan_id,
        last_hop_pubkey,
        amp,
        timeout_seconds
    }: SendPaymentReq) => {
        const { InvoicesStore, TransactionsStore, SettingsStore, navigation } =
            this.props;
        let feeLimitSat = fee_limit_sat;

        if (!fee_limit_sat) {
            const { pay_req } = InvoicesStore;
            const requestAmount = pay_req && pay_req.getRequestAmount;
            const invoiceAmount = amount || requestAmount;
            feeLimitSat = FeeUtils.calculateDefaultRoutingFee(
                Number(invoiceAmount)
            );
        }

        const streamingCall = TransactionsStore.sendPayment({
            payment_request,
            amount,
            max_parts,
            max_shard_amt,
            fee_limit_sat: feeLimitSat,
            max_fee_percent,
            outgoing_chan_id,
            last_hop_pubkey,
            amp,
            timeout_seconds
        });

        if (SettingsStore.implementation === 'lightning-node-connect') {
            this.subscribePayment(streamingCall);
        }

        navigation.navigate('SendingLightning');
    };

    render() {
        const {
            InvoicesStore,
            UnitsStore,
            ChannelsStore,
            LnurlPayStore,
            SettingsStore,
            navigation
        } = this.props;
        const {
            enableMultiPathPayment,
            enableAtomicMultiPathPayment,
            maxParts,
            maxShardAmt,
            feeLimitSat,
            feeOption,
            maxFeePercent,
            outgoingChanId,
            lastHopPubkey,
            customAmount,
            satAmount,
            zaplockerToggle,
            settingsToggle,
            timeoutSeconds,
            lightningReadyToSend
        } = this.state;
        const {
            pay_req,
            paymentRequest,
            getPayReqError,
            loading,
            loadingFeeEstimate,
            successProbability,
            feeEstimate,
            clearPayReq
        } = InvoicesStore;

        // Zaplocker
        const {
            isZaplocker,
            isPmtHashSigValid,
            isRelaysSigValid,
            zaplockerNpub
        } = LnurlPayStore;

        const isZaplockerValid = isPmtHashSigValid && isRelaysSigValid;

        const requestAmount = pay_req && pay_req.getRequestAmount;
        const expiry = pay_req && pay_req.expiry;
        const cltv_expiry = pay_req && pay_req.cltv_expiry;
        const destination = pay_req && pay_req.destination;
        const description = pay_req && pay_req.description;
        const payment_hash = pay_req && pay_req.payment_hash;
        const timestamp = pay_req && pay_req.timestamp;

        // handle fee percents that use commas
        const maxFeePercentFormatted = maxFeePercent.replace(/,/g, '.');

        let lockAtomicMultiPathPayment = false;
        if (
            pay_req &&
            pay_req.features &&
            pay_req.features['30'] &&
            pay_req.features['30'].is_required
        ) {
            lockAtomicMultiPathPayment = true;
        }

        const enableAmp: boolean =
            enableAtomicMultiPathPayment || lockAtomicMultiPathPayment;
        const ampOrMppEnabled: boolean =
            (BackendUtils.supportsMPP() || BackendUtils.supportsAMP()) &&
            (enableMultiPathPayment || enableAmp);

        const date = new Date(Number(timestamp) * 1000).toString();

        const { enableTor, implementation } = SettingsStore;

        const isLnd: boolean = BackendUtils.isLNDBased();
        const isCLightning: boolean = implementation === 'c-lightning-REST';

        const isNoAmountInvoice: boolean =
            !requestAmount || requestAmount === 0;

        const noBalance = this.props.BalanceStore.lightningBalance === 0;

        const showZaplockerWarning =
            isZaplocker ||
            (destination &&
                zaplockerDestinations.includes(destination) &&
                cltv_expiry &&
                Number(cltv_expiry) > 200);

        const QRButton = () => (
            <TouchableOpacity
                onPress={() =>
                    navigation.navigate('QR', {
                        value: `lightning:${paymentRequest}`
                    })
                }
            >
                <QR fill={themeColor('text')} style={{ alignSelf: 'center' }} />
            </TouchableOpacity>
        );

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    onBack={() => {
                        clearPayReq();
                    }}
                    centerComponent={{
                        text: localeString('views.PaymentRequest.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={<QRButton />}
                    navigation={navigation}
                />

                {(loading || loadingFeeEstimate) && (
                    <View style={{ marginTop: 40 }}>
                        <LoadingIndicator />
                    </View>
                )}

                <ScrollView keyboardShouldPersistTaps="handled">
                    {!!getPayReqError && (
                        <View style={styles.content}>
                            <Text
                                style={{
                                    ...styles.label,
                                    color: themeColor('text')
                                }}
                            >
                                {localeString('views.PaymentRequest.error')}:{' '}
                                {getPayReqError}
                            </Text>
                        </View>
                    )}

                    {!loading && !loadingFeeEstimate && !!pay_req && (
                        <View style={styles.content}>
                            <>
                                {showZaplockerWarning &&
                                    implementation === 'embedded-lnd' && (
                                        <View
                                            style={{
                                                paddingTop: 10,
                                                paddingBottom: 10
                                            }}
                                        >
                                            <WarningMessage
                                                message={localeString(
                                                    'views.Send.zaplockerWarning'
                                                )}
                                            />
                                        </View>
                                    )}
                                {!BackendUtils.supportsLightningSends() && (
                                    <View
                                        style={{
                                            paddingTop: 10,
                                            paddingBottom: 10
                                        }}
                                    >
                                        <WarningMessage
                                            message={localeString(
                                                'views.PaymentRequest.notAllowedToSend'
                                            )}
                                        />
                                    </View>
                                )}
                                {noBalance &&
                                    BackendUtils.supportsLightningSends() && (
                                        <View
                                            style={{
                                                paddingTop: 10,
                                                paddingBottom: 10
                                            }}
                                        >
                                            <WarningMessage
                                                message={localeString(
                                                    'views.Send.noLightningBalance'
                                                )}
                                            />
                                        </View>
                                    )}
                                {isNoAmountInvoice ? (
                                    <AmountInput
                                        amount={customAmount}
                                        title={localeString(
                                            'views.PaymentRequest.customAmt'
                                        )}
                                        onAmountChange={(
                                            amount: string,
                                            satAmount: string | number
                                        ) => {
                                            this.setState({
                                                customAmount: amount,
                                                satAmount
                                            });
                                        }}
                                    />
                                ) : (
                                    <View style={styles.center}>
                                        <Amount
                                            sats={requestAmount}
                                            jumboText
                                            toggleable
                                        />
                                        <View style={{ top: 10 }}>
                                            <Conversion sats={requestAmount} />
                                        </View>
                                    </View>
                                )}
                            </>

                            {isZaplocker && (
                                <TouchableOpacity
                                    onPress={() => {
                                        this.setState({
                                            zaplockerToggle: !zaplockerToggle
                                        });
                                    }}
                                >
                                    <View
                                        style={{
                                            marginTop: 10,
                                            marginBottom: 10
                                        }}
                                    >
                                        <Row justify="space-between">
                                            <View style={{ width: '95%' }}>
                                                <KeyValue
                                                    keyValue={localeString(
                                                        'views.Settings.LightningAddress.zaplockerVerification'
                                                    )}
                                                    color={
                                                        isZaplockerValid
                                                            ? themeColor(
                                                                  'success'
                                                              )
                                                            : themeColor(
                                                                  'error'
                                                              )
                                                    }
                                                />
                                            </View>
                                            {zaplockerToggle ? (
                                                <CaretDown
                                                    fill={
                                                        isZaplockerValid
                                                            ? themeColor(
                                                                  'success'
                                                              )
                                                            : themeColor(
                                                                  'error'
                                                              )
                                                    }
                                                    width="20"
                                                    height="20"
                                                />
                                            ) : (
                                                <CaretRight
                                                    fill={
                                                        isZaplockerValid
                                                            ? themeColor(
                                                                  'success'
                                                              )
                                                            : themeColor(
                                                                  'error'
                                                              )
                                                    }
                                                    width="20"
                                                    height="20"
                                                />
                                            )}
                                        </Row>
                                    </View>
                                </TouchableOpacity>
                            )}

                            {zaplockerToggle && (
                                <>
                                    <KeyValue
                                        keyValue={localeString(
                                            'views.PaymentRequest.isPmtHashSigValid'
                                        )}
                                        value={
                                            isPmtHashSigValid
                                                ? localeString('general.valid')
                                                : localeString(
                                                      'general.invalid'
                                                  )
                                        }
                                        color={
                                            isPmtHashSigValid
                                                ? themeColor('success')
                                                : themeColor('error')
                                        }
                                    />

                                    <KeyValue
                                        keyValue={localeString(
                                            'views.PaymentRequest.isRelaysSigValid'
                                        )}
                                        value={
                                            isRelaysSigValid
                                                ? localeString('general.valid')
                                                : localeString(
                                                      'general.invalid'
                                                  )
                                        }
                                        color={
                                            isRelaysSigValid
                                                ? themeColor('success')
                                                : themeColor('error')
                                        }
                                    />

                                    <KeyValue
                                        keyValue={localeString('nostr.npub')}
                                        value={zaplockerNpub}
                                        sensitive
                                    />

                                    <View style={styles.button}>
                                        <Button
                                            title={localeString(
                                                'nostr.loadProfileExternal'
                                            )}
                                            onPress={() =>
                                                LinkingUtils.handleDeepLink(
                                                    `nostr:${zaplockerNpub}`,
                                                    this.props.navigation
                                                )
                                            }
                                        />
                                    </View>
                                </>
                            )}

                            {!!description && (
                                <KeyValue
                                    keyValue={localeString(
                                        'views.PaymentRequest.description'
                                    )}
                                    value={description}
                                />
                            )}

                            {!!timestamp && (
                                <KeyValue
                                    keyValue={localeString(
                                        'views.PaymentRequest.timestamp'
                                    )}
                                    value={date}
                                />
                            )}

                            {!!expiry && (
                                <KeyValue
                                    keyValue={localeString(
                                        'views.PaymentRequest.expiry'
                                    )}
                                    value={expiry}
                                />
                            )}

                            {!!cltv_expiry && (
                                <KeyValue
                                    keyValue={localeString(
                                        'views.PaymentRequest.cltvExpiry'
                                    )}
                                    value={cltv_expiry}
                                />
                            )}

                            {!!destination && (
                                <KeyValue
                                    keyValue={localeString(
                                        'general.destination'
                                    )}
                                    value={destination}
                                />
                            )}

                            {!!payment_hash && (
                                <KeyValue
                                    keyValue={localeString(
                                        'views.PaymentRequest.paymentHash'
                                    )}
                                    value={payment_hash}
                                />
                            )}

                            {!!successProbability && (
                                <KeyValue
                                    keyValue={localeString(
                                        'views.PaymentRequest.successProbability'
                                    )}
                                    value={`${successProbability}%`}
                                />
                            )}

                            {(!!feeEstimate || feeEstimate === 0) && (
                                <KeyValue
                                    keyValue={localeString(
                                        'views.PaymentRequest.feeEstimate'
                                    )}
                                    value={
                                        <Amount
                                            sats={feeEstimate || 0}
                                            toggleable
                                        />
                                    }
                                />
                            )}

                            {(isLnd || isCLightning) && (
                                <TouchableOpacity
                                    onPress={() => {
                                        this.setState({
                                            settingsToggle: !settingsToggle
                                        });
                                    }}
                                >
                                    <View
                                        style={{
                                            marginTop: 10,
                                            marginBottom: 10
                                        }}
                                    >
                                        <Row justify="space-between">
                                            <View style={{ width: '95%' }}>
                                                <KeyValue
                                                    keyValue={localeString(
                                                        'views.Settings.title'
                                                    )}
                                                />
                                            </View>
                                            {settingsToggle ? (
                                                <CaretDown
                                                    fill={themeColor('text')}
                                                    width="20"
                                                    height="20"
                                                />
                                            ) : (
                                                <CaretRight
                                                    fill={themeColor('text')}
                                                    width="20"
                                                    height="20"
                                                />
                                            )}
                                        </Row>
                                    </View>
                                </TouchableOpacity>
                            )}

                            <FeeLimit
                                satAmount={
                                    isNoAmountInvoice
                                        ? customAmount
                                        : requestAmount || 0
                                }
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
                                feeOption={feeOption}
                                SettingsStore={SettingsStore}
                                InvoicesStore={InvoicesStore}
                                displayFeeRecommendation
                                hide={!settingsToggle}
                            />

                            {settingsToggle && (
                                <>
                                    {!!pay_req &&
                                        BackendUtils.supportsHopPicking() && (
                                            <>
                                                {
                                                    <HopPicker
                                                        onValueChange={(
                                                            item: any
                                                        ) =>
                                                            this.setState({
                                                                outgoingChanId:
                                                                    item
                                                                        ? item.channelId
                                                                        : null
                                                            })
                                                        }
                                                        title={localeString(
                                                            'views.PaymentRequest.firstHop'
                                                        )}
                                                        ChannelsStore={
                                                            ChannelsStore
                                                        }
                                                        UnitsStore={UnitsStore}
                                                    />
                                                }
                                                {
                                                    <HopPicker
                                                        onValueChange={(
                                                            item: any
                                                        ) =>
                                                            this.setState({
                                                                lastHopPubkey:
                                                                    item
                                                                        ? item.remote_pubkey
                                                                        : null
                                                            })
                                                        }
                                                        title={localeString(
                                                            'views.PaymentRequest.lastHop'
                                                        )}
                                                        ChannelsStore={
                                                            ChannelsStore
                                                        }
                                                        UnitsStore={UnitsStore}
                                                    />
                                                }
                                            </>
                                        )}

                                    {!!pay_req &&
                                        BackendUtils.supportsMPP() &&
                                        !enableTor && (
                                            <React.Fragment>
                                                <Text
                                                    style={{
                                                        ...styles.label,
                                                        color: themeColor(
                                                            'text'
                                                        ),
                                                        top: 25
                                                    }}
                                                >
                                                    {localeString(
                                                        'views.PaymentRequest.mpp'
                                                    )}
                                                </Text>
                                                <View
                                                    style={{
                                                        flex: 1,
                                                        flexDirection: 'row',
                                                        justifyContent:
                                                            'flex-end'
                                                    }}
                                                >
                                                    <Switch
                                                        value={
                                                            enableMultiPathPayment
                                                        }
                                                        onValueChange={() => {
                                                            const enable =
                                                                !enableMultiPathPayment;
                                                            this.setState({
                                                                enableMultiPathPayment:
                                                                    enable,
                                                                enableAtomicMultiPathPayment:
                                                                    enableMultiPathPayment
                                                                        ? false
                                                                        : true
                                                            });
                                                        }}
                                                    />
                                                </View>
                                            </React.Fragment>
                                        )}

                                    {!!pay_req && BackendUtils.supportsAMP() && (
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
                                                <Switch
                                                    value={enableAmp}
                                                    onValueChange={() => {
                                                        const enable =
                                                            !enableAtomicMultiPathPayment;
                                                        this.setState({
                                                            enableAtomicMultiPathPayment:
                                                                enable,
                                                            enableMultiPathPayment:
                                                                enable ||
                                                                enableMultiPathPayment
                                                        });
                                                    }}
                                                    disabled={
                                                        lockAtomicMultiPathPayment
                                                    }
                                                />
                                            </View>
                                        </React.Fragment>
                                    )}

                                    {ampOrMppEnabled && (
                                        <React.Fragment>
                                            <Text
                                                style={{
                                                    ...styles.label,
                                                    color: themeColor('text')
                                                }}
                                            >
                                                {localeString(
                                                    'views.PaymentRequest.maxParts'
                                                )}
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
                                                    ...styles.labelSecondary,
                                                    color: themeColor(
                                                        'secondaryText'
                                                    )
                                                }}
                                            >
                                                {localeString(
                                                    'views.PaymentRequest.maxPartsDescription'
                                                )}
                                            </Text>
                                        </React.Fragment>
                                    )}

                                    {ampOrMppEnabled && (
                                        <React.Fragment>
                                            <Text
                                                style={{
                                                    ...styles.label,
                                                    color: themeColor('text')
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

                                    {isLnd && (
                                        <>
                                            <Text
                                                style={{
                                                    ...styles.label,
                                                    color: themeColor('text')
                                                }}
                                            >
                                                {localeString(
                                                    'views.Settings.Payments.timeoutSeconds'
                                                )}
                                            </Text>
                                            <TextInput
                                                keyboardType="numeric"
                                                value={timeoutSeconds}
                                                onChangeText={(text: string) =>
                                                    this.setState({
                                                        timeoutSeconds: text
                                                    })
                                                }
                                            />
                                        </>
                                    )}
                                </>
                            )}

                            {!!pay_req && !lightningReadyToSend && !noBalance && (
                                <>
                                    <Text
                                        style={{
                                            fontFamily: 'PPNeueMontreal-Medium',
                                            color: themeColor('highlight'),
                                            margin: 5,
                                            alignSelf: 'center',
                                            marginTop: 10,
                                            marginBottom: 10
                                        }}
                                    >
                                        {localeString(
                                            'views.PaymentRequest.lndGettingReady'
                                        )}
                                    </Text>
                                    <LoadingIndicator size={30} />
                                </>
                            )}

                            {!!pay_req &&
                                BackendUtils.supportsLightningSends() && (
                                    <View style={styles.button}>
                                        <Button
                                            title={localeString(
                                                'views.PaymentRequest.payInvoice'
                                            )}
                                            icon={
                                                lightningReadyToSend
                                                    ? {
                                                          name: 'send',
                                                          size: 25
                                                      }
                                                    : undefined
                                            }
                                            onPress={() => {
                                                if (isZaplocker)
                                                    LnurlPayStore.broadcastAttestation();
                                                this.sendPayment({
                                                    payment_request:
                                                        paymentRequest,
                                                    amount: satAmount
                                                        ? satAmount.toString()
                                                        : undefined,
                                                    max_parts:
                                                        enableMultiPathPayment
                                                            ? maxParts
                                                            : null,
                                                    max_shard_amt:
                                                        enableMultiPathPayment
                                                            ? maxShardAmt
                                                            : null,
                                                    fee_limit_sat: isLnd
                                                        ? feeLimitSat
                                                        : null,
                                                    max_fee_percent:
                                                        isCLightning
                                                            ? maxFeePercentFormatted
                                                            : null,
                                                    outgoing_chan_id:
                                                        outgoingChanId,
                                                    last_hop_pubkey:
                                                        lastHopPubkey,
                                                    amp: enableAmp,
                                                    timeout_seconds:
                                                        timeoutSeconds
                                                });
                                            }}
                                            disabled={!lightningReadyToSend}
                                        />
                                    </View>
                                )}
                        </View>
                    )}
                </ScrollView>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    content: {
        paddingLeft: 20,
        paddingRight: 20
    },
    label: {
        fontFamily: 'PPNeueMontreal-Book',
        paddingTop: 5
    },
    labelSecondary: {
        fontFamily: 'PPNeueMontreal-Book',
        paddingTop: 5
    },
    button: {
        paddingTop: 30,
        paddingBottom: 15,
        paddingLeft: 10,
        paddingRight: 10
    },
    center: {
        alignItems: 'center',
        marginTop: 25,
        marginBottom: 25
    }
});
