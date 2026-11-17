import * as React from 'react';
import {
    Platform,
    ScrollView,
    StyleSheet,
    View,
    TouchableOpacity
} from 'react-native';
import { inject, observer } from 'mobx-react';
import Slider from '@react-native-community/slider';
import { Route } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ButtonGroup } from '@rneui/themed';

import Amount from '../components/Amount';
import AmountInput from '../components/AmountInput';
import Button from '../components/Button';
import PaymentInFlightNotice from '../components/PaymentInFlightNotice';
import SwipeButton from '../components/SwipeButton';
import Conversion from '../components/Conversion';
import FeeLimit from '../components/FeeLimit';
import Accordion from '../components/Accordion';
import Header from '../components/Header';
import HopPicker from '../components/HopPicker';
import KeyValue from '../components/KeyValue';
import LoadingIndicator from '../components/LoadingIndicator';
import Screen from '../components/Screen';
import Switch from '../components/Switch';
import Text from '../components/Text';
import TextInput from '../components/TextInput';
import { Row } from '../components/layout/Row';
import {
    ErrorMessage,
    WarningMessage
} from '../components/SuccessErrorMessage';

import Invoice from '../models/Invoice';

import BalanceStore from '../stores/BalanceStore';
import ChannelsStore from '../stores/ChannelsStore';
import InvoicesStore from '../stores/InvoicesStore';
import TransactionsStore, { SendPaymentReq } from '../stores/TransactionsStore';
import UnitsStore from '../stores/UnitsStore';
import NodeInfoStore from '../stores/NodeInfoStore';
import SettingsStore from '../stores/SettingsStore';

import { errorToUserFriendly } from '../utils/ErrorUtils';
import FeeUtils from '../utils/FeeUtils';
import { localeString } from '../utils/LocaleUtils';
import BackendUtils from '../utils/BackendUtils';
import { sleep } from '../utils/SleepUtils';
import { themeColor } from '../utils/ThemeUtils';
import { numberWithCommas } from '../utils/UnitsUtils';
import {
    calculateDonationAmount,
    findDonationPercentageIndex
} from '../utils/DonationUtils';
import { clearPendingPaymentData } from '../utils/GraphSyncUtils';

import CaretDown from '../assets/images/SVG/Caret Down.svg';
import CaretRight from '../assets/images/SVG/Caret Right.svg';
import QR from '../assets/images/SVG/QR.svg';

interface PaymentRequestRouteParams {
    // the payment request this screen decodes, shows and pays
    paymentRequest: string;
    fromGraphSync?: boolean;
}

interface InvoiceProps {
    exitSetup: any;
    navigation: NativeStackNavigationProp<any, any>;
    route: Route<'PaymentRequest', PaymentRequestRouteParams>;
    BalanceStore: BalanceStore;
    InvoicesStore: InvoicesStore;
    TransactionsStore: TransactionsStore;
    UnitsStore: UnitsStore;
    ChannelsStore: ChannelsStore;
    NodeInfoStore: NodeInfoStore;
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
    lightningReadyToSend: boolean;
    slideToPayThreshold: number;
    donationsToggle: boolean;
    donationPercentage: any;
    donationAmount: any;
    selectedIndex: number | null;
    swipeButtonKey: number;
    // the decode of this screen's payment request and what goes with it.
    // Held here, not in InvoicesStore, so nothing outside this screen can
    // change the invoice under review
    pay_req: Invoice | null;
    loading: boolean;
    getPayReqError: string | null;
    feeEstimate: number | null;
    successProbability: number | null;
}

@inject(
    'BalanceStore',
    'InvoicesStore',
    'TransactionsStore',
    'UnitsStore',
    'ChannelsStore',
    'NodeInfoStore',
    'SettingsStore'
)
@observer
export class PaymentRequestView extends React.Component<
    InvoiceProps,
    InvoiceState
> {
    focusListener: any;
    isComponentMounted: boolean = false;
    private scrollViewRef = React.createRef<ScrollView>();
    // The request this instance reviews, read once: what is decoded, shown
    // and paid can't differ, whatever happens to the route params or to any
    // store afterwards. A new request gets a new instance, see PaymentRequest
    // below
    private readonly paymentRequest: string | undefined =
        this.props.route?.params?.paymentRequest;
    state: InvoiceState = {
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
        lightningReadyToSend: false,
        slideToPayThreshold: 10000,
        donationsToggle: false,
        donationPercentage: 0,
        donationAmount: 0,
        selectedIndex: null,
        swipeButtonKey: 0,
        pay_req: null,
        loading: !!this.paymentRequest,
        getPayReqError: null,
        feeEstimate: null,
        successProbability: null
    };

    async componentDidMount() {
        this.isComponentMounted = true;
        const { SettingsStore, BalanceStore, route } = this.props;
        const { getSettings, implementation } = SettingsStore;
        // balance is not refreshed elsewhere after channel changes, so
        // the no-balance warning could otherwise be stale
        BalanceStore.getLightningBalance(true);
        // the decode doesn't need the settings, so don't make it wait
        const settingsLoading = getSettings();
        this.loadPayReq(settingsLoading);
        const settings = await settingsLoading;

        if (route?.params?.fromGraphSync) {
            clearPendingPaymentData().catch((error) => {
                console.error(
                    'Failed to clear pending payment data on PaymentRequest:',
                    error
                );
            });
        }

        this.setState({
            feeLimitSat: settings?.payments?.defaultFeeFixed || '100',
            maxFeePercent: settings?.payments?.defaultFeePercentage || '5.0',
            timeoutSeconds: settings?.payments?.timeoutSeconds || '60',
            slideToPayThreshold: settings?.payments?.slideToPayThreshold
        });

        if (implementation === 'embedded-lnd') {
            this.checkIfLndReady();
        } else {
            this.setState({
                lightningReadyToSend: true
            });
        }

        // Reset slide to pay slider position when screen comes into focus
        const { navigation } = this.props;
        this.focusListener = navigation.addListener('focus', () => {
            this.setState({
                swipeButtonKey: this.state.swipeButtonKey + 1
            });
        });
    }

    componentWillUnmount(): void {
        this.isComponentMounted = false;
        if (this.focusListener) {
            this.focusListener();
        }
    }

    // Decodes this screen's payment request and shows it. Nothing is shown
    // until the decode, the route estimate and the settings are all in, so
    // the donation and fee mode on screen always belong to the invoice next
    // to them. No route query is started once the screen is gone
    loadPayReq = async (settingsLoading: Promise<any>) => {
        const { InvoicesStore } = this.props;
        if (!this.paymentRequest) return;

        let pay_req: Invoice;
        try {
            pay_req = await InvoicesStore.getPayReq(this.paymentRequest);
        } catch (error: any) {
            this.setState({
                loading: false,
                getPayReqError: errorToUserFriendly(error)
            });
            return;
        }
        // the user left during the decode
        if (!this.isComponentMounted) return;

        const [settings, { feeEstimate, successProbability }] =
            await Promise.all([
                settingsLoading,
                InvoicesStore.getRouteEstimate(pay_req)
            ]);

        const defaultPct =
            Number(settings?.payments?.defaultDonationPercentage) || 0;
        const requestAmount = pay_req.getRequestAmount ?? 0;

        this.setState({
            pay_req,
            loading: false,
            feeEstimate,
            successProbability,
            feeOption:
                requestAmount && requestAmount > 1000 ? 'percent' : 'fixed',
            donationAmount: calculateDonationAmount(requestAmount, defaultPct),
            selectedIndex: findDonationPercentageIndex(defaultPct, [5, 10, 20]),
            donationPercentage: defaultPct
        });
    };

    checkIfLndReady = async () => {
        const { BalanceStore, NodeInfoStore } = this.props;
        const { isLightningReadyToSend } = NodeInfoStore;
        // re-read the balance each pass: the refresh started on mount may
        // land after this loop begins, so it idles (no RPCs) while it is 0
        while (!this.state.lightningReadyToSend && this.isComponentMounted) {
            if (BalanceStore.lightningBalance !== 0) {
                try {
                    const isReady = await isLightningReadyToSend();
                    if (isReady) {
                        this.setState({
                            lightningReadyToSend: true
                        });
                    }
                } catch (e) {
                    // RPC can fail while LND is still starting; keep polling
                    console.log('Embedded LND readiness check failed', e);
                }
            }
            await sleep(3000);
        }
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
        const { TransactionsStore, SettingsStore, navigation } = this.props;

        const { settings } = SettingsStore;

        const enableDonations =
            Platform.OS !== 'ios' && settings?.payments?.enableDonations;
        const { donationAmount } = this.state;
        let feeLimitSat = fee_limit_sat;

        if (!fee_limit_sat) {
            const { pay_req } = this.state;
            const requestAmount = pay_req && pay_req.getRequestAmount;
            const invoiceAmount = amount || requestAmount;
            feeLimitSat = FeeUtils.calculateDefaultRoutingFee(
                Number(invoiceAmount)
            );
        }

        const paymentSequence = TransactionsStore.sendPayment({
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

        navigation.navigate('SendingLightning', {
            paymentSequence,
            enableDonations,
            ...(enableDonations &&
                donationAmount > 0 && {
                    donationAmount: donationAmount.toString()
                })
        });
    };

    // true when the invoice carries no amount and none has been entered
    isMissingAmount = () => {
        const requestAmount = this.state.pay_req?.getRequestAmount;
        return !requestAmount && !(Number(this.state.satAmount) > 0);
    };

    triggerPayment = () => {
        const { SettingsStore, TransactionsStore } = this.props;

        // A slide to pay can still complete after its screen was replaced
        // by the review of another request. This one is no longer on
        // screen, so don't pay it
        if (!this.isComponentMounted) return;

        // Guard against double-submission: bail if a payment is already in
        // flight so a rapid double-tap or re-fired swipe can't dispatch twice.
        if (TransactionsStore.paymentInFlight) return;

        // Pay only what was decoded and shown. Both belong to this screen:
        // the request it was opened with and its own decode of it
        const paymentRequest = this.paymentRequest;
        const { pay_req } = this.state;
        if (!paymentRequest || !pay_req) return;

        // a no-amount invoice can't be paid without an amount: the node
        // would only reject it after the send guard was taken
        if (this.isMissingAmount()) return;

        const {
            enableMultiPathPayment,
            maxParts,
            maxShardAmt,
            feeLimitSat,
            feeOption,
            outgoingChanId,
            lastHopPubkey,
            satAmount,
            timeoutSeconds,
            maxFeePercent,
            enableAtomicMultiPathPayment
        } = this.state;

        const { implementation } = SettingsStore;

        // Fail closed if the invoice has expired since it was reviewed:
        // the invoice can lapse while this screen is open, and expiry is
        // otherwise only enforced by the recipient
        if (pay_req.isExpiredNow()) {
            // re-render so the expired notice appears and the pay
            // controls are removed
            this.forceUpdate();
            return;
        }

        const isCLightning: boolean = implementation === 'cln-rest';

        // handle fee percents that use commas
        const maxFeePercentFormatted = maxFeePercent.replace(/,/g, '.');

        let lockAtomicMultiPathPayment = false;
        if (
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
            amount:
                !pay_req.getRequestAmount && satAmount
                    ? satAmount.toString()
                    : undefined,
            max_parts: enableMultiPathPayment ? maxParts : '16',
            max_shard_amt: enableMultiPathPayment ? maxShardAmt : '',
            fee_limit_sat: feeLimitSat,
            // CLN takes either a percent cap or the fixed fee_limit_sat cap,
            // so only send the percent when that mode is selected
            max_fee_percent:
                isCLightning && feeOption === 'percent'
                    ? maxFeePercentFormatted
                    : undefined,
            outgoing_chan_id: outgoingChanId ?? '',
            last_hop_pubkey: lastHopPubkey ?? '',
            amp: enableAmp,
            timeout_seconds: timeoutSeconds
        });
    };

    render() {
        const {
            UnitsStore,
            ChannelsStore,
            SettingsStore,
            NodeInfoStore,
            TransactionsStore,
            navigation
        } = this.props;
        const {
            enableMultiPathPayment,
            enableAtomicMultiPathPayment,
            maxParts,
            maxShardAmt,
            feeOption,
            customAmount,
            timeoutSeconds,
            lightningReadyToSend,
            slideToPayThreshold,
            donationsToggle,
            donationAmount,
            donationPercentage,
            pay_req,
            getPayReqError,
            loading,
            successProbability,
            feeEstimate
        } = this.state;
        const paymentRequest = this.paymentRequest;

        const locale = SettingsStore.settings.locale;
        if (pay_req) pay_req.determineFormattedOriginalTimeUntilExpiry(locale);

        const isPayReqExpired = !!pay_req && pay_req.isExpiredNow();

        // pay_req is null until the decode is in, and when it failed
        const requestAmount =
            pay_req && pay_req.getRequestAmount
                ? pay_req.getRequestAmount
                : undefined;
        const expiry = pay_req && pay_req.formattedOriginalTimeUntilExpiry;
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

        const enableDonations =
            Platform.OS !== 'ios' && settings?.payments?.enableDonations;

        const isLdkNode: boolean = implementation === 'ldk-node';

        const isNoAmountInvoice: boolean = !requestAmount;

        const noBalance = this.props.BalanceStore.lightningBalance === 0;
        const missingAmount = this.isMissingAmount();

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

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.PaymentRequest.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={
                        paymentRequest ? (
                            <Row>
                                <QRButton />
                            </Row>
                        ) : undefined
                    }
                    navigation={navigation}
                />

                {loading && (
                    <View style={{ marginTop: 40 }}>
                        <LoadingIndicator />
                    </View>
                )}

                <View style={{ flex: 1 }}>
                    <ScrollView
                        ref={this.scrollViewRef}
                        keyboardShouldPersistTaps="handled"
                    >
                        {!paymentRequest && (
                            <View style={styles.content}>
                                <ErrorMessage
                                    message={localeString(
                                        'views.PaymentRequest.noPayReq'
                                    )}
                                />
                            </View>
                        )}

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

                        {!loading && !!pay_req && (
                            <View style={styles.content}>
                                <>
                                    {isPayReqExpired && (
                                        <View
                                            style={{
                                                paddingTop: 10,
                                                paddingBottom: 10
                                            }}
                                        >
                                            <ErrorMessage
                                                message={localeString(
                                                    'views.PaymentRequest.invoiceExpired'
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
                                            {/* show the exact invoice amount
                                            even with msat display off */}
                                            <Amount
                                                sats={requestAmount}
                                                jumboText
                                                toggleable
                                                forceMsats
                                            />
                                            <View style={{ top: 10 }}>
                                                <Conversion
                                                    sats={requestAmount}
                                                />
                                            </View>
                                        </View>
                                    )}
                                </>

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
                                        value={`${cltv_expiry} ${localeString(
                                            'general.blocks'
                                        )}`}
                                    />
                                )}

                                {!!destination && (
                                    <KeyValue
                                        keyValue={localeString(
                                            'general.destination'
                                        )}
                                        value={destination}
                                        showCopyIcon
                                    />
                                )}

                                {!!payment_hash && (
                                    <KeyValue
                                        keyValue={localeString(
                                            'views.PaymentRequest.paymentHash'
                                        )}
                                        value={payment_hash}
                                        showCopyIcon
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

                                {BackendUtils.supportsCustomFeeLimit() && (
                                    <Accordion
                                        headerLayout="form"
                                        id="payment-request-fee-settings"
                                        scrollRef={this.scrollViewRef}
                                        title={localeString(
                                            'views.Settings.title'
                                        )}
                                        headerStyle={{
                                            marginTop: 10,
                                            marginBottom: 10
                                        }}
                                    >
                                        <FeeLimit
                                            satAmount={
                                                isNoAmountInvoice
                                                    ? this.state.satAmount
                                                    : requestAmount || 0
                                            }
                                            onFeeLimitSatChange={(
                                                value: string
                                            ) =>
                                                this.setState({
                                                    feeLimitSat: value
                                                })
                                            }
                                            onMaxFeePercentChange={(
                                                value: string
                                            ) =>
                                                this.setState({
                                                    maxFeePercent: value
                                                })
                                            }
                                            onFeeOptionChange={(
                                                value: string
                                            ) =>
                                                this.setState({
                                                    feeOption: value
                                                })
                                            }
                                            feeOption={feeOption}
                                            SettingsStore={SettingsStore}
                                            feeEstimate={feeEstimate}
                                            displayFeeRecommendation
                                            hide={false}
                                        />
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

                                        {ampOrMppEnabled && !isLdkNode && (
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

                                        {(BackendUtils.supportsCustomFeeLimit() ||
                                            isLdkNode) && (
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
                                    </Accordion>
                                )}
                                {!BackendUtils.supportsCustomFeeLimit() && (
                                    <FeeLimit
                                        satAmount={
                                            isNoAmountInvoice
                                                ? this.state.satAmount
                                                : requestAmount || 0
                                        }
                                        onFeeLimitSatChange={(value: string) =>
                                            this.setState({
                                                feeLimitSat: value
                                            })
                                        }
                                        onMaxFeePercentChange={(
                                            value: string
                                        ) =>
                                            this.setState({
                                                maxFeePercent: value
                                            })
                                        }
                                        feeOption={feeOption}
                                        SettingsStore={SettingsStore}
                                        feeEstimate={feeEstimate}
                                        displayFeeRecommendation
                                        hide
                                    />
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
                    !isPayReqExpired &&
                    !loading &&
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
                            <PaymentInFlightNotice
                                TransactionsStore={TransactionsStore}
                            />
                            {requestAmount &&
                            requestAmount >= slideToPayThreshold ? (
                                <SwipeButton
                                    key={this.state.swipeButtonKey}
                                    onSwipeSuccess={this.triggerPayment}
                                    disabled={
                                        !lightningReadyToSend ||
                                        TransactionsStore.paymentInFlight ||
                                        noBalance
                                    }
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
                                    {missingAmount && !noBalance && (
                                        <Text
                                            style={{
                                                ...styles.label,
                                                color: themeColor(
                                                    'secondaryText'
                                                ),
                                                alignSelf: 'center',
                                                marginBottom: 10
                                            }}
                                        >
                                            {localeString(
                                                'views.PaymentRequest.enterAmount'
                                            )}
                                        </Text>
                                    )}
                                    <Button
                                        title={localeString(
                                            'views.PaymentRequest.payInvoice'
                                        )}
                                        icon={{
                                            name: 'send',
                                            size: 25
                                        }}
                                        onPress={this.triggerPayment}
                                        disabled={
                                            !lightningReadyToSend ||
                                            TransactionsStore.paymentInFlight ||
                                            noBalance ||
                                            missingAmount
                                        }
                                    />
                                </View>
                            )}
                        </View>
                    )}
            </Screen>
        );
    }
}

// navigate() and popTo() to an open PaymentRequest only swap its route
// params. Keying the screen by its payment request turns that into a new
// instance: the review of the old request is unmounted, with its typed
// amount, fee and donation choices and any slide to pay still in progress,
// and the new request is decoded and shown from scratch.
export default function PaymentRequest(
    props: Pick<InvoiceProps, 'navigation' | 'route'>
) {
    return (
        <PaymentRequestView
            key={props.route?.params?.paymentRequest}
            {...(props as InvoiceProps)}
        />
    );
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
