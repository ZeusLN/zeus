import * as React from 'react';
import {
    NativeModules,
    NativeEventEmitter,
    ScrollView,
    StyleSheet,
    View,
    TouchableOpacity
} from 'react-native';
import { inject, observer } from 'mobx-react';
import Slider from '@react-native-community/slider';
import { StackNavigationProp } from '@react-navigation/stack';
import { ButtonGroup } from 'react-native-elements';

import Amount from '../components/Amount';
import AmountInput from '../components/AmountInput';
import Button from '../components/Button';
import SwipeButton from '../components/SwipeButton';
import Conversion from '../components/Conversion';
import FeeLimit from '../components/FeeLimit';
import Header from '../components/Header';
import HopPicker from '../components/HopPicker';
import KeyValue from '../components/KeyValue';
import LoadingIndicator from '../components/LoadingIndicator';
import Screen from '../components/Screen';
import Switch from '../components/Switch';
import Text from '../components/Text';
import TextInput from '../components/TextInput';
import { Row } from '../components/layout/Row';
import { WarningMessage } from '../components/SuccessErrorMessage';

import BalanceStore from '../stores/BalanceStore';
import ChannelsStore from '../stores/ChannelsStore';
import InvoicesStore from '../stores/InvoicesStore';
import SwapStore from '../stores/SwapStore';
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
import { numberWithCommas } from '../utils/UnitsUtils';
import {
    calculateDonationAmount,
    findDonationPercentageIndex
} from '../utils/DonationUtils';

import CaretDown from '../assets/images/SVG/Caret Down.svg';
import CaretRight from '../assets/images/SVG/Caret Right.svg';
import QR from '../assets/images/SVG/QR.svg';
import SwapIcon from '../assets/images/SVG/Swap.svg';
import BigNumber from 'bignumber.js';

const zaplockerDestinations = [
    // OLYMPUS
    '031b301307574bbe9b9ac7b79cbe1700e31e544513eae0b5d7497483083f99e581'
    // TODO add Zaplocker.com
];

interface InvoiceProps {
    exitSetup: any;
    navigation: StackNavigationProp<any, any>;
    BalanceStore: BalanceStore;
    InvoicesStore: InvoicesStore;
    SwapStore: SwapStore;
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
    outgoingChanId: string | any;
    lastHopPubkey: string | any;
    settingsToggle: boolean;
    zaplockerToggle: boolean;
    lightningReadyToSend: boolean;
    slideToPayThreshold: number;
    validAmountToSwap: boolean;
    donationsToggle: boolean;
    donationPercentage: any;
    donationAmount: any;
    selectedIndex: number | null;
}

@inject(
    'BalanceStore',
    'InvoicesStore',
    'TransactionsStore',
    'UnitsStore',
    'ChannelsStore',
    'NodeInfoStore',
    'LnurlPayStore',
    'SettingsStore',
    'SwapStore'
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
        lightningReadyToSend: false,
        slideToPayThreshold: 10000,
        validAmountToSwap: false,
        donationsToggle: false,
        donationPercentage: 0,
        donationAmount: 0,
        selectedIndex: null
    };

    async componentDidMount() {
        this.isComponentMounted = true;
        const { SettingsStore, InvoicesStore } = this.props;
        const { getSettings, implementation } = SettingsStore;
        const settings = await getSettings();

        const { defaultDonationPercentage } = settings.payments;

        let feeOption = 'fixed';
        const { pay_req } = InvoicesStore;
        const requestAmount = pay_req && pay_req.getRequestAmount;

        if (requestAmount && requestAmount != 0) {
            if (requestAmount > 1000) {
                feeOption = 'percent';
            }
        }

        const validAmountToSwap = this.isAmountValidToSwap();
        const donationPercentageOptions = [5, 10, 20];

        const donationAmount = calculateDonationAmount(
            requestAmount ?? 0,
            Number(defaultDonationPercentage) || 0
        );
        const index = findDonationPercentageIndex(
            Number(defaultDonationPercentage) || 0,
            donationPercentageOptions
        );

        this.setState({
            feeOption,
            feeLimitSat: settings?.payments?.defaultFeeFixed || '100',
            maxFeePercent: settings?.payments?.defaultFeePercentage || '5.0',
            timeoutSeconds: settings?.payments?.timeoutSeconds || '60',
            slideToPayThreshold: settings?.payments?.slideToPayThreshold,
            validAmountToSwap,
            donationPercentage:
                settings?.payments?.defaultDonationPercentage || 0,
            donationAmount,
            selectedIndex: index
        });

        if (implementation === 'embedded-lnd') {
            this.checkIfLndReady();
        } else {
            this.setState({
                lightningReadyToSend: true
            });
        }
    }

    isAmountValidToSwap(): boolean {
        const { SwapStore, InvoicesStore } = this.props;

        const subInfo: any = SwapStore.subInfo;
        const { pay_req } = InvoicesStore;
        const requestAmount = pay_req && pay_req.getRequestAmount;

        if (!subInfo) {
            return false;
        }

        const min = this.calculateLimit(
            subInfo?.limits?.minimal || 0
        ).toNumber();
        const max = this.calculateLimit(
            subInfo?.limits?.maximal || 0
        ).toNumber();
        const minBN = new BigNumber(min);
        const maxBN = new BigNumber(max);

        const input = this.calculateLimit(requestAmount || 0);

        return input.gte(minBN) && input.lte(maxBN);
    }

    bigCeil = (big: BigNumber): BigNumber => {
        return big.integerValue(BigNumber.ROUND_CEIL);
    };

    calculateSendAmount = (
        receiveAmount: BigNumber,
        serviceFee: number,
        minerFee: number
    ): BigNumber => {
        if (receiveAmount.isNaN() || receiveAmount.isLessThanOrEqualTo(0)) {
            return new BigNumber(0);
        }
        return this.bigCeil(
            receiveAmount
                .plus(
                    this.bigCeil(
                        receiveAmount.times(new BigNumber(serviceFee).div(100))
                    )
                )
                .plus(minerFee)
        );
    };

    calculateLimit = (limit: number): any => {
        const { subInfo } = this.props.SwapStore;
        const info: any = subInfo;
        const serviceFeePct = info?.fees?.percentage || 0;
        const networkFeeBigNum = new BigNumber(info?.fees?.minerFees || 0);
        const networkFee = networkFeeBigNum.toNumber();

        return this.calculateSendAmount(
            new BigNumber(limit),
            serviceFeePct,
            networkFee
        );
    };

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

        TransactionsStore.donationIsPaid = false;

        const { settings } = SettingsStore;

        const enableDonations = settings?.payments?.enableDonations;
        const { donationAmount } = this.state;
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

        navigation.navigate('SendingLightning', {
            enableDonations,
            ...(enableDonations &&
                donationAmount > 0 && {
                    donationAmount: donationAmount.toString()
                })
        });
    };

    triggerPayment = () => {
        const { InvoicesStore, LnurlPayStore, SettingsStore } = this.props;
        const {
            enableMultiPathPayment,
            maxParts,
            maxShardAmt,
            feeLimitSat,
            outgoingChanId,
            lastHopPubkey,
            satAmount,
            timeoutSeconds,
            maxFeePercent,
            enableAtomicMultiPathPayment
        } = this.state;

        const { paymentRequest, pay_req } = InvoicesStore;
        const { implementation } = SettingsStore;

        const isLnd: boolean = BackendUtils.isLNDBased();
        const isCLightning: boolean = implementation === 'cln-rest';

        // Zaplocker
        const { isZaplocker } = LnurlPayStore;

        // Broadcast attestation if Zaplocker is enabled
        if (isZaplocker) LnurlPayStore.broadcastAttestation();

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

        // Call sendPayment with the freshest values
        this.sendPayment({
            payment_request: paymentRequest,
            amount: satAmount ? satAmount.toString() : undefined,
            max_parts: enableMultiPathPayment ? maxParts : '16',
            max_shard_amt: enableMultiPathPayment ? maxShardAmt : '',
            fee_limit_sat: isLnd ? feeLimitSat : '1000',
            max_fee_percent: isCLightning ? maxFeePercentFormatted : '5.0',
            outgoing_chan_id: outgoingChanId ?? '',
            last_hop_pubkey: lastHopPubkey ?? '',
            amp: enableAmp,
            timeout_seconds: timeoutSeconds
        });
    };

    render() {
        const {
            InvoicesStore,
            UnitsStore,
            ChannelsStore,
            LnurlPayStore,
            SettingsStore,
            NodeInfoStore,
            navigation
        } = this.props;
        const {
            enableMultiPathPayment,
            enableAtomicMultiPathPayment,
            maxParts,
            maxShardAmt,
            feeOption,
            customAmount,
            zaplockerToggle,
            settingsToggle,
            timeoutSeconds,
            lightningReadyToSend,
            slideToPayThreshold,
            donationsToggle,
            donationAmount,
            donationPercentage
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

        // variables cannot be destructured traditionally here
        // due to how we clear the pay_req from the store upon
        // navigating back
        const requestAmount =
            pay_req && pay_req.getRequestAmount
                ? pay_req.getRequestAmount
                : undefined;
        const expiry = pay_req && pay_req.expiry;
        const cltv_expiry = pay_req && pay_req.cltv_expiry;
        const destination = pay_req && pay_req.destination;
        const payment_hash = pay_req && pay_req.payment_hash;
        const timestamp = pay_req && pay_req.timestamp;
        const getMemo = pay_req && pay_req.getMemo;
        const getNameDescReceiver = pay_req && pay_req.getNameDescReceiver;

        const donationPercentageOptions = [5, 10, 20];

        const handleButtonPress = (index: number) => {
            const percentage = donationPercentageOptions[index];
            const donationAmount = calculateDonationAmount(
                requestAmount ?? 0,
                percentage
            );
            this.setState({
                donationPercentage: percentage,
                donationAmount,
                selectedIndex: index
            });
        };

        const handleSliderChange = (value: number) => {
            const donationAmount = calculateDonationAmount(
                requestAmount ?? 0,
                value
            );
            const index = findDonationPercentageIndex(
                value,
                donationPercentageOptions
            );

            this.setState({
                donationPercentage: value,
                donationAmount,
                selectedIndex: index
            });
        };

        const renderButton = (label: string, index: number) => () =>
            (
                <Text
                    style={{
                        fontFamily: 'PPNeueMontreal-Book',
                        color:
                            this.state.selectedIndex === index
                                ? themeColor('background')
                                : themeColor('text')
                    }}
                >
                    {label}
                </Text>
            );

        const buttons: any = donationPercentageOptions.map(
            (percent, index) => ({
                element: renderButton(`${percent}%`, index)
            })
        );

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

        const { enableTor, implementation, settings } = SettingsStore;

        const enableDonations = settings?.payments?.enableDonations;

        const isLnd: boolean = BackendUtils.isLNDBased();
        const isCLightning: boolean = implementation === 'cln-rest';

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
                        value: `lightning:${paymentRequest}`,
                        satAmount: requestAmount
                    })
                }
            >
                <QR fill={themeColor('text')} />
            </TouchableOpacity>
        );

        const SwapButton = () => {
            const { validAmountToSwap } = this.state;

            if (!validAmountToSwap) return null;

            return (
                <TouchableOpacity
                    onPress={() => {
                        const amountToSwap = isNoAmountInvoice
                            ? this.state.satAmount
                            : requestAmount;
                        if (paymentRequest && amountToSwap) {
                            navigation.navigate('Swaps', {
                                initialInvoice: paymentRequest,
                                initialAmountSats: amountToSwap.toString(),
                                initialReverse: false // OnChain -> LN for paying a LN invoice
                            });
                        }
                    }}
                    disabled={
                        !paymentRequest ||
                        (!isNoAmountInvoice && !requestAmount)
                    }
                >
                    <SwapIcon
                        fill={themeColor('text')}
                        width="36"
                        height="26"
                        style={{ marginRight: 10 }}
                    />
                </TouchableOpacity>
            );
        };

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
                    rightComponent={
                        <Row>
                            <SwapButton />
                            <QRButton />
                        </Row>
                    }
                    navigation={navigation}
                />

                {(loading || loadingFeeEstimate) && (
                    <View style={{ marginTop: 40 }}>
                        <LoadingIndicator />
                    </View>
                )}

                <View style={{ flex: 1 }}>
                    <ScrollView keyboardShouldPersistTaps="handled">
                        {!!getPayReqError && (
                            <View style={styles.content}>
                                <Text
                                    style={{
                                        ...styles.label,
                                        color: themeColor('text')
                                    }}
                                >
                                    {`${localeString(
                                        'views.PaymentRequest.error'
                                    )}: ${getPayReqError}`}
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
                                                <Conversion
                                                    sats={requestAmount}
                                                />
                                            </View>
                                        </View>
                                    )}
                                </>

                                {isZaplocker && (
                                    <TouchableOpacity
                                        onPress={() => {
                                            this.setState({
                                                zaplockerToggle:
                                                    !zaplockerToggle
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
                                                    ? localeString(
                                                          'general.valid'
                                                      )
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
                                                    ? localeString(
                                                          'general.valid'
                                                      )
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
                                            keyValue={localeString(
                                                'nostr.npub'
                                            )}
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

                                {getNameDescReceiver && (
                                    <KeyValue
                                        keyValue={localeString(
                                            'views.Invoice.payingTo'
                                        )}
                                        value={getNameDescReceiver}
                                    />
                                )}

                                {getMemo && (
                                    <KeyValue
                                        keyValue={localeString(
                                            'views.Invoice.memo'
                                        )}
                                        value={getMemo}
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
                                                        fill={themeColor(
                                                            'text'
                                                        )}
                                                        width="20"
                                                        height="20"
                                                    />
                                                ) : (
                                                    <CaretRight
                                                        fill={themeColor(
                                                            'text'
                                                        )}
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
                                                                channels
                                                            ) =>
                                                                this.setState({
                                                                    outgoingChanId:
                                                                        channels[0]
                                                                            ?.channelId
                                                                })
                                                            }
                                                            title={localeString(
                                                                'views.PaymentRequest.firstHop'
                                                            )}
                                                            ChannelsStore={
                                                                ChannelsStore
                                                            }
                                                            UnitsStore={
                                                                UnitsStore
                                                            }
                                                        />
                                                    }
                                                    {
                                                        <HopPicker
                                                            onValueChange={(
                                                                channels
                                                            ) =>
                                                                this.setState({
                                                                    lastHopPubkey:
                                                                        channels[0]
                                                                            ?.remotePubkey
                                                                })
                                                            }
                                                            title={localeString(
                                                                'views.PaymentRequest.lastHop'
                                                            )}
                                                            ChannelsStore={
                                                                ChannelsStore
                                                            }
                                                            UnitsStore={
                                                                UnitsStore
                                                            }
                                                        />
                                                    }
                                                </>
                                            )}

                                        {!!pay_req &&
                                            BackendUtils.supportsMPP() &&
                                            !enableTor && (
                                                <View
                                                    style={{
                                                        flex: 1,
                                                        flexDirection: 'row',
                                                        marginTop: 25
                                                    }}
                                                >
                                                    <Text
                                                        style={{
                                                            ...styles.label,
                                                            color: themeColor(
                                                                'text'
                                                            )
                                                        }}
                                                        infoModalText={[
                                                            localeString(
                                                                'views.PaymentRequest.mpp.explainer1'
                                                            ),
                                                            localeString(
                                                                'views.PaymentRequest.mpp.explainer2'
                                                            )
                                                        ]}
                                                    >
                                                        {localeString(
                                                            'views.PaymentRequest.mpp'
                                                        )}
                                                    </Text>
                                                    <View
                                                        style={{
                                                            flex: 1,
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
                                                </View>
                                            )}

                                        {!!pay_req &&
                                            BackendUtils.supportsAMP() && (
                                                <View
                                                    style={{
                                                        flex: 1,
                                                        flexDirection: 'row',
                                                        marginTop: 25,
                                                        marginBottom: 15
                                                    }}
                                                >
                                                    <Text
                                                        style={{
                                                            ...styles.label,
                                                            color: themeColor(
                                                                'text'
                                                            )
                                                        }}
                                                        infoModalText={[
                                                            localeString(
                                                                'views.PaymentRequest.amp.explainer1'
                                                            ),
                                                            localeString(
                                                                'views.PaymentRequest.amp.explainer2'
                                                            )
                                                        ]}
                                                        infoModalLink="https://docs.lightning.engineering/lightning-network-tools/lnd/amp"
                                                    >
                                                        {localeString(
                                                            'views.PaymentRequest.amp'
                                                        )}
                                                    </Text>
                                                    <View
                                                        style={{
                                                            flex: 1,
                                                            justifyContent:
                                                                'flex-end'
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
                                                </View>
                                            )}

                                        {ampOrMppEnabled && (
                                            <React.Fragment>
                                                <Text
                                                    style={{
                                                        ...styles.label,
                                                        color: themeColor(
                                                            'text'
                                                        )
                                                    }}
                                                >
                                                    {localeString(
                                                        'views.PaymentRequest.maxParts'
                                                    )}
                                                </Text>
                                                <TextInput
                                                    keyboardType="numeric"
                                                    value={maxParts}
                                                    onChangeText={(
                                                        text: string
                                                    ) =>
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
                                                        color: themeColor(
                                                            'text'
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
                                                    onChangeText={(
                                                        text: string
                                                    ) =>
                                                        this.setState({
                                                            maxShardAmt: text
                                                        })
                                                    }
                                                />
                                            </React.Fragment>
                                        )}

                                        {(isLnd ||
                                            implementation === 'cln-rest') && (
                                            <>
                                                <Text
                                                    style={{
                                                        ...styles.label,
                                                        color: themeColor(
                                                            'text'
                                                        )
                                                    }}
                                                >
                                                    {localeString(
                                                        'views.Settings.Payments.timeoutSeconds'
                                                    )}
                                                </Text>
                                                <TextInput
                                                    keyboardType="numeric"
                                                    value={timeoutSeconds}
                                                    onChangeText={(
                                                        text: string
                                                    ) =>
                                                        this.setState({
                                                            timeoutSeconds: text
                                                        })
                                                    }
                                                />
                                            </>
                                        )}
                                    </>
                                )}
                                {enableDonations &&
                                    NodeInfoStore!.nodeInfo.isMainNet && (
                                        <TouchableOpacity
                                            onPress={() => {
                                                this.setState({
                                                    donationsToggle:
                                                        !donationsToggle
                                                });
                                            }}
                                        >
                                            <View
                                                style={{
                                                    marginTop: 10,
                                                    marginBottom: 10
                                                }}
                                            >
                                                <Row justify="space-around">
                                                    <View
                                                        style={{
                                                            flex: 1,
                                                            marginRight: 10
                                                        }}
                                                    >
                                                        <KeyValue
                                                            keyValue={localeString(
                                                                'views.PaymentRequest.donateToZEUS'
                                                            )}
                                                        />
                                                    </View>
                                                    {donationsToggle ? (
                                                        <CaretDown
                                                            fill={themeColor(
                                                                'text'
                                                            )}
                                                            width="20"
                                                            height="20"
                                                        />
                                                    ) : (
                                                        <View
                                                            style={{
                                                                flexDirection:
                                                                    'row',
                                                                alignItems:
                                                                    'center'
                                                            }}
                                                        >
                                                            {donationAmount >
                                                                0 && (
                                                                <Row
                                                                    style={{
                                                                        marginRight: 6
                                                                    }}
                                                                >
                                                                    <Text
                                                                        style={{
                                                                            color: themeColor(
                                                                                'highlight'
                                                                            )
                                                                        }}
                                                                    >
                                                                        {`${numberWithCommas(
                                                                            donationAmount
                                                                        )} ${localeString(
                                                                            'general.sats'
                                                                        )}`}
                                                                    </Text>
                                                                    <Text
                                                                        style={{
                                                                            color: themeColor(
                                                                                'secondaryText'
                                                                            )
                                                                        }}
                                                                    >
                                                                        {` (${donationPercentage}%)`}
                                                                    </Text>
                                                                </Row>
                                                            )}
                                                            <CaretRight
                                                                fill={themeColor(
                                                                    'text'
                                                                )}
                                                                width="20"
                                                                height="20"
                                                            />
                                                        </View>
                                                    )}
                                                </Row>
                                            </View>
                                        </TouchableOpacity>
                                    )}
                                {donationsToggle && enableDonations && (
                                    <>
                                        <Row justify="center">
                                            <Text
                                                style={{
                                                    ...styles.label,
                                                    color: themeColor('text')
                                                }}
                                            >
                                                {localeString(
                                                    'views.PaymentRequest.supportZeus'
                                                )}
                                            </Text>
                                        </Row>
                                        <ButtonGroup
                                            selectedIndex={
                                                this.state.selectedIndex
                                            }
                                            onPress={handleButtonPress}
                                            buttons={buttons}
                                            selectedButtonStyle={{
                                                backgroundColor:
                                                    themeColor('highlight'),
                                                borderRadius: 12
                                            }}
                                            containerStyle={{
                                                marginTop: 20,
                                                backgroundColor:
                                                    themeColor('secondary'),
                                                borderRadius: 12,
                                                borderColor:
                                                    themeColor('secondary')
                                            }}
                                            innerBorderStyle={{
                                                color: themeColor('secondary')
                                            }}
                                        />

                                        <Slider
                                            style={{
                                                width: '100%',
                                                height: 40
                                            }}
                                            minimumValue={0}
                                            maximumValue={100}
                                            step={1}
                                            value={donationPercentage}
                                            onValueChange={handleSliderChange}
                                            minimumTrackTintColor={themeColor(
                                                'highlight'
                                            )}
                                            maximumTrackTintColor={themeColor(
                                                'secondaryText'
                                            )}
                                        />
                                        <Row justify="flex-end">
                                            <Text
                                                style={{
                                                    color: themeColor(
                                                        'secondaryText'
                                                    )
                                                }}
                                            >
                                                {`${donationPercentage}% `}
                                            </Text>
                                        </Row>
                                        <Row justify="flex-end">
                                            <Text
                                                style={{
                                                    color: themeColor(
                                                        'highlight'
                                                    )
                                                }}
                                            >
                                                {numberWithCommas(
                                                    donationAmount
                                                ) +
                                                    ` ${localeString(
                                                        'general.sats'
                                                    )}`}
                                            </Text>
                                        </Row>
                                        <Row justify="center">
                                            <Text
                                                style={{
                                                    ...styles.labelSecondary,
                                                    color: themeColor('text')
                                                }}
                                            >
                                                {`${numberWithCommas(
                                                    requestAmount || 0
                                                )} + ${numberWithCommas(
                                                    donationAmount
                                                )} = ${numberWithCommas(
                                                    (requestAmount || 0) +
                                                        donationAmount
                                                )} ${localeString(
                                                    'general.sats'
                                                )}`}
                                            </Text>
                                        </Row>
                                    </>
                                )}
                            </View>
                        )}
                    </ScrollView>
                </View>

                {!!pay_req &&
                    !loading &&
                    !loadingFeeEstimate &&
                    BackendUtils.supportsLightningSends() && (
                        <View style={{ bottom: 10 }}>
                            {!!pay_req && !lightningReadyToSend && !noBalance && (
                                <>
                                    <Text
                                        style={{
                                            fontFamily: 'PPNeueMontreal-Medium',
                                            color: themeColor('highlight'),
                                            margin: 5,
                                            alignSelf: 'center',
                                            marginTop: 20,
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
                            {requestAmount &&
                            requestAmount >= slideToPayThreshold ? (
                                <SwipeButton
                                    onSwipeSuccess={this.triggerPayment}
                                    instructionText={localeString(
                                        'views.PaymentRequest.slideToPay'
                                    )}
                                    containerStyle={{
                                        backgroundColor:
                                            themeColor('secondaryText')
                                    }}
                                    swipeButtonStyle={{
                                        backgroundColor: themeColor('text')
                                    }}
                                />
                            ) : (
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
                                        onPress={this.triggerPayment}
                                        disabled={!lightningReadyToSend}
                                    />
                                </View>
                            )}
                        </View>
                    )}
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
