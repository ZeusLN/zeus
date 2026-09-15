import * as React from 'react';
import {
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    View,
    TouchableOpacity
} from 'react-native';
import { reaction } from 'mobx';
import { inject, observer } from 'mobx-react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Slider from '@react-native-community/slider';
import { ButtonGroup } from '@rneui/themed';

import Amount from '../../components/Amount';
import Button from '../../components/Button';
import EcashMintPicker from '../../components/EcashMintPicker';
import SwipeButton from '../../components/SwipeButton';
import Conversion from '../../components/Conversion';
import Header from '../../components/Header';
import KeyValue from '../../components/KeyValue';
import LoadingIndicator from '../../components/LoadingIndicator';
import Screen from '../../components/Screen';
import Switch from '../../components/Switch';
import {
    ErrorMessage,
    WarningMessage
} from '../../components/SuccessErrorMessage';

import BalanceStore from '../../stores/BalanceStore';
import CashuStore from '../../stores/CashuStore';
import TransactionsStore, {
    SendPaymentReq
} from '../../stores/TransactionsStore';
import UnitsStore from '../../stores/UnitsStore';
import LnurlPayStore from '../../stores/LnurlPayStore';
import SettingsStore from '../../stores/SettingsStore';
import NodeInfoStore from '../../stores/NodeInfoStore';

import { localeString } from '../../utils/LocaleUtils';
import BackendUtils from '../../utils/BackendUtils';
import LinkingUtils from '../../utils/LinkingUtils';
import { themeColor } from '../../utils/ThemeUtils';
import { numberWithCommas } from '../../utils/UnitsUtils';
import {
    calculateDonationAmount,
    calculateTotalWithDonation,
    findDonationPercentageIndex,
    getDonationToSend
} from '../../utils/DonationUtils';

import { Row } from '../../components/layout/Row';

import CaretDown from '../../assets/images/SVG/Caret Down.svg';
import CaretRight from '../../assets/images/SVG/Caret Right.svg';
import QR from '../../assets/images/SVG/QR.svg';

const zaplockerDestinations = [
    // OLYMPUS
    '031b301307574bbe9b9ac7b79cbe1700e31e544513eae0b5d7497483083f99e581'
    // TODO add Zaplocker.com
];

interface CashuPaymentRequestProps {
    exitSetup: any;
    navigation: NativeStackNavigationProp<any, any>;
    BalanceStore: BalanceStore;
    CashuStore: CashuStore;
    TransactionsStore: TransactionsStore;
    UnitsStore: UnitsStore;
    LnurlPayStore: LnurlPayStore;
    SettingsStore: SettingsStore;
    NodeInfoStore: NodeInfoStore;
}

interface CashuPaymentRequestState {
    zaplockerToggle: boolean;
    slideToPayThreshold: number;
    donationsToggle: boolean;
    donationPercentage: any;
    donationAmount: any;
    selectedIndex: number | null;
    swipeButtonKey: number;
    multiMintEnabled: boolean;
    reviewedPaymentRequest: string;
}

@inject(
    'BalanceStore',
    'CashuStore',
    'TransactionsStore',
    'UnitsStore',
    'LnurlPayStore',
    'SettingsStore',
    'NodeInfoStore'
)
@observer
export default class CashuPaymentRequest extends React.Component<
    CashuPaymentRequestProps,
    CashuPaymentRequestState
> {
    listener: any;
    isComponentMounted: boolean = false;
    focusListener: any = null;
    donationDisposer: any;
    swipeResetDisposer: any;
    donationLockRequest?: string;
    state = {
        zaplockerToggle: false,
        slideToPayThreshold: 10000,
        donationsToggle: false,
        donationPercentage: 0,
        donationAmount: 0,
        selectedIndex: null,
        swipeButtonKey: 0,
        multiMintEnabled: false,
        reviewedPaymentRequest: ''
    };

    async componentDidMount() {
        this.isComponentMounted = true;
        const { SettingsStore, CashuStore } = this.props;
        const settings = await SettingsStore.getSettings();
        const { defaultDonationPercentage } = settings.payments;

        this.donationDisposer = reaction(
            () => CashuStore.payReq,
            (payReq) => {
                if (payReq?.getRequestAmount) {
                    const currentRequest = CashuStore.paymentRequest;

                    if (
                        currentRequest &&
                        this.donationLockRequest === currentRequest
                    ) {
                        return;
                    }

                    const defaultPct = Number(defaultDonationPercentage) || 0;

                    const requestAmount = payReq.getRequestAmount;
                    const donationAmount = calculateDonationAmount(
                        requestAmount,
                        defaultPct
                    );
                    const index = findDonationPercentageIndex(
                        defaultPct,
                        [5, 10, 20]
                    );

                    this.setState({
                        donationAmount,
                        selectedIndex: index,
                        donationPercentage: defaultPct
                    });

                    this.donationLockRequest = currentRequest;
                }
            },
            { fireImmediately: true }
        );

        const { paymentRequest, getPayReq } = CashuStore;
        const enabledBySetting = !!settings?.ecash?.enableMultiMint;
        const hasMultipleSelectedMints =
            Array.isArray(CashuStore.multiMintSelectedUrls) &&
            CashuStore.multiMintSelectedUrls.length > 1;

        this.setState({
            slideToPayThreshold: settings?.payments?.slideToPayThreshold,
            multiMintEnabled: enabledBySetting && hasMultipleSelectedMints,
            // Pin the invoice the user is reviewing. The view otherwise reads
            // the invoice straight off the shared CashuStore singleton, so if
            // a second payment string is injected while this screen is open
            // the store's paymentRequest / payReq get swapped out from under
            // the review. triggerPayment refuses to proceed when the store no
            // longer matches the pin ("review A, pay B").
            reviewedPaymentRequest: CashuStore.paymentRequest || ''
        });

        // If the invoice under review changes while this screen is mounted,
        // invalidate any in-progress slide-to-pay gesture so it cannot
        // complete against the swapped-in invoice. The render path notices
        // the mismatch and replaces the pay controls with a warning; the pin
        // is only advanced when the user explicitly accepts the new request.
        this.swipeResetDisposer = reaction(
            () => CashuStore.paymentRequest,
            () => {
                if (!this.isComponentMounted) return;
                this.setState({
                    swipeButtonKey: this.state.swipeButtonKey + 1
                });
            }
        );

        // Reset state when screen comes into focus (e.g., after navigating
        // back). Re-decode the reviewed (pinned) invoice, not whatever is in
        // the store: a focus event also fires when returning from a screen
        // pushed on top of this one (e.g. the QR view), so an invoice
        // injected while the user was away must not get silently adopted.
        this.focusListener = this.props.navigation.addListener('focus', () => {
            getPayReq(this.state.reviewedPaymentRequest || paymentRequest!!);
            this.setState((prevState) => ({
                swipeButtonKey: prevState.swipeButtonKey + 1,
                multiMintEnabled:
                    !!SettingsStore.settings?.ecash?.enableMultiMint &&
                    Array.isArray(CashuStore.multiMintSelectedUrls) &&
                    CashuStore.multiMintSelectedUrls.length > 1
            }));
        });
    }

    componentWillUnmount(): void {
        this.isComponentMounted = false;

        if (this.donationDisposer) {
            this.donationDisposer();
        }

        if (this.swipeResetDisposer) {
            this.swipeResetDisposer();
        }

        if (this.focusListener) {
            this.focusListener();
        }
    }

    // The donation that will actually be sent with this payment. Resolved in
    // one place so the coverage check below and the amount handed to the
    // sending views cannot disagree: those views take this as decided rather
    // than re-reading the store, which is what stops a donation the check
    // never counted from going out once nodeInfo arrives mid-payment.
    resolveDonationToSend = () => {
        const { CashuStore, SettingsStore, NodeInfoStore } = this.props;
        const { donationAmount } = this.state;

        const donationsAllowed =
            Platform.OS !== 'ios' &&
            !!CashuStore.payReq?.getRequestAmount &&
            SettingsStore.settings?.payments?.enableDonations;

        return getDonationToSend(
            NodeInfoStore?.nodeInfo?.isMainNet,
            donationsAllowed,
            donationAmount
        );
    };

    sendPayment = ({ amount }: SendPaymentReq) => {
        const { navigation } = this.props;
        const donationToSend = this.resolveDonationToSend();

        navigation.navigate('CashuSendingLightning', {
            ...(donationToSend > 0 && {
                donationAmount: donationToSend.toString()
            }),
            paymentAmount: amount ? amount : undefined
        });
    };

    triggerPayment = () => {
        const { CashuStore, LnurlPayStore, navigation } = this.props;
        const { multiMintEnabled } = this.state;

        // Fail closed: if the invoice in the store no longer matches the one
        // the user reviewed, it was swapped out from under the review screen.
        // Both payment paths below (multimint and single mint) read the
        // invoice off CashuStore at their own mount, so refuse to proceed
        // rather than paying a different invoice than the one that was on
        // screen when this confirmation began. Reset the swipe knob so the
        // gesture doesn't stick; the render path shows the
        // payment-request-changed warning in place of the pay controls.
        if (
            this.state.reviewedPaymentRequest !== '' &&
            CashuStore.paymentRequest !== this.state.reviewedPaymentRequest
        ) {
            this.setState({
                swipeButtonKey: this.state.swipeButtonKey + 1
            });
            return;
        }

        // Fail closed if the invoice has expired since it was reviewed:
        // the invoice can lapse while this screen is open, and expiry is
        // otherwise only enforced by the mint and recipient
        if (CashuStore.payReq?.isExpiredNow()) {
            // re-render so the expired notice appears and the pay
            // controls are removed
            this.forceUpdate();
            return;
        }

        const requestAmount = CashuStore.payReq?.getRequestAmount;
        const paymentAmount = requestAmount
            ? requestAmount.toString()
            : undefined;

        const isMultiMint =
            multiMintEnabled &&
            Array.isArray(CashuStore?.multiMintSelectedUrls) &&
            CashuStore!.multiMintSelectedUrls.length > 1;

        if (isMultiMint) {
            const donationToSend = this.resolveDonationToSend();
            navigation.navigate('MultimintPayment', {
                paymentAmount,
                ...(donationToSend > 0 && {
                    donationAmount: donationToSend.toString()
                })
            });
            return;
        }

        // Zaplocker
        const { isZaplocker } = LnurlPayStore;

        // Broadcast attestation if Zaplocker is enabled
        if (isZaplocker) LnurlPayStore.broadcastAttestation();

        // Call sendPayment with the freshest values
        this.sendPayment({
            amount: paymentAmount
        });
    };

    handleMultiMintToggle = async (enabled: boolean) => {
        const { CashuStore } = this.props;
        const supportsMultiMint = (mintUrl: string) => {
            const normalized = mintUrl.endsWith('/')
                ? mintUrl.slice(0, -1)
                : mintUrl;
            const mintInfo =
                CashuStore.mintInfos[mintUrl] ||
                CashuStore.mintInfos[normalized];

            const nut15 = mintInfo?.nuts?.[15] || mintInfo?.nuts?.['15'];
            const methods = Array.isArray(nut15) ? nut15 : nut15?.methods || [];

            return methods.some(
                (method: any) =>
                    method?.method?.toLowerCase() === 'bolt11' &&
                    method?.unit?.toLowerCase() === 'sat'
            );
        };

        this.setState({ multiMintEnabled: enabled });

        if (enabled) {
            const selected = CashuStore.selectedMintUrls || [];
            const source =
                selected.length > 1 ? selected : CashuStore.mintUrls || [];
            const nextSelection = Array.from(
                new Set(source.filter(supportsMultiMint))
            );

            if (nextSelection.length > 1) {
                await CashuStore.setMultiMintSelectedUrls(nextSelection);
            }
        } else {
            const selectedMintUrl = CashuStore.selectedMintUrl;
            await CashuStore.setMultiMintSelectedUrls(
                selectedMintUrl ? [selectedMintUrl] : []
            );
        }

        if (CashuStore.paymentRequest) {
            await CashuStore.getPayReq(CashuStore.paymentRequest);
        }
    };

    render() {
        const { CashuStore, LnurlPayStore, SettingsStore, navigation } =
            this.props;
        const {
            zaplockerToggle,
            slideToPayThreshold,
            donationsToggle,
            donationAmount,
            donationPercentage,
            multiMintEnabled
        } = this.state;
        const {
            payReq,
            paymentRequest,
            getPayReqError,
            loading,
            loadingFeeEstimate,
            feeEstimate,
            clearPayReq,
            totalBalanceSats,
            payReqMintBalance,
            payReqAmount
        } = CashuStore;

        // Zaplocker
        const {
            isZaplocker,
            isPmtHashSigValid,
            isRelaysSigValid,
            zaplockerNpub
        } = LnurlPayStore;

        const isZaplockerValid = isPmtHashSigValid && isRelaysSigValid;

        const isPayReqExpired = !!payReq && payReq.isExpiredNow();

        const requestAmount =
            payReq && payReq.getRequestAmount
                ? payReq.getRequestAmount
                : undefined;
        const expiry = payReq && payReq.expiry;
        const cltv_expiry = payReq && payReq.cltv_expiry;
        const destination = payReq && payReq.destination;
        const description = payReq && payReq.description;
        const payment_hash = payReq && payReq.payment_hash;
        const timestamp = payReq && payReq.timestamp;

        const date = new Date(Number(timestamp) * 1000).toString();

        const { implementation, settings } = SettingsStore;

        const isNoAmountInvoice: boolean = !requestAmount;
        const showMultiMintToggle = !!settings?.ecash?.enableMultiMint;

        const noBalance = totalBalanceSats === 0;

        // The screen renders whatever invoice is in the shared CashuStore, so
        // when the store no longer matches the pinned invoice the user has a
        // different payment request in front of them than the one they were
        // reviewing. Surface that instead of paying (or silently refusing):
        // the pay controls are replaced below with a warning and an explicit
        // button to review the new request, which re-pins it.
        const payReqChanged =
            this.state.reviewedPaymentRequest !== '' &&
            !!paymentRequest &&
            paymentRequest !== this.state.reviewedPaymentRequest;

        const enableDonations =
            Platform.OS !== 'ios' &&
            !isNoAmountInvoice &&
            settings?.payments?.enableDonations;

        // The donation is a second payment drawn from the same mint right
        // after this one, so the balance has to cover both. This is the same
        // value the sending views are handed, so what is checked here and
        // what is sent are the same number.
        const donationToCover = this.resolveDonationToSend();
        // payReqMintBalance is 0 when the single-mint check did not run, and
        // getPayReqError already covers the invoice falling short on its own.
        const donationLeavesTooLittle =
            !getPayReqError &&
            donationToCover > 0 &&
            payReqMintBalance > 0 &&
            payReqMintBalance <
                calculateTotalWithDonation(
                    payReqAmount,
                    feeEstimate || 0,
                    donationToCover
                );
        const payReqWarning = getPayReqError
            ? getPayReqError
            : donationLeavesTooLittle
            ? localeString('stores.CashuStore.notEnoughFunds')
            : undefined;
        const hasPayReqError = !!payReqWarning;

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
                <QR fill={themeColor('text')} style={{ alignSelf: 'center' }} />
            </TouchableOpacity>
        );

        const donationPercentageOptions = [5, 10, 20];

        const handleButtonPress = (index: number) => {
            const percentage = donationPercentageOptions[index];
            const donationAmount = calculateDonationAmount(
                requestAmount ?? 0,
                percentage
            );
            this.donationLockRequest = paymentRequest;
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
            this.donationLockRequest = paymentRequest;
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

                <View style={{ flex: 1 }}>
                    <ScrollView keyboardShouldPersistTaps="handled">
                        {!loading &&
                            !loadingFeeEstimate &&
                            !payReq &&
                            !!getPayReqError && (
                                <View style={styles.content}>
                                    <Text
                                        style={{
                                            ...styles.label,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {localeString(
                                            'views.PaymentRequest.error'
                                        )}
                                        : {getPayReqError}
                                    </Text>
                                </View>
                            )}

                        {!loading && !loadingFeeEstimate && !!payReq && (
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
                                                        'views.Cashu.CashuPaymentRequest.noBalance'
                                                    )}
                                                />
                                            </View>
                                        )}
                                    {!!payReqWarning && (
                                        <View
                                            style={{
                                                paddingTop: 10,
                                                paddingBottom: 10
                                            }}
                                        >
                                            <WarningMessage
                                                message={payReqWarning}
                                            />
                                        </View>
                                    )}
                                    {!isNoAmountInvoice && (
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
                                                <View style={{ flex: 1 }}>
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
                                            showCopyIcon
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
                                {enableDonations && (
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
                                                            alignItems: 'center'
                                                        }}
                                                    >
                                                        {donationAmount > 0 && (
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

                {!!payReq &&
                    !isPayReqExpired &&
                    !loading &&
                    !loadingFeeEstimate &&
                    payReqChanged &&
                    BackendUtils.supportsLightningSends() && (
                        <View style={{ bottom: 10, top: 6 }}>
                            <View style={styles.content}>
                                <WarningMessage
                                    message={localeString(
                                        'views.PaymentRequest.payReqChanged'
                                    )}
                                />
                            </View>
                            <View style={styles.button}>
                                <Button
                                    title={localeString(
                                        'views.PaymentRequest.reviewNewPayReq'
                                    )}
                                    onPress={() =>
                                        this.setState({
                                            reviewedPaymentRequest:
                                                CashuStore.paymentRequest || '',
                                            swipeButtonKey:
                                                this.state.swipeButtonKey + 1
                                        })
                                    }
                                />
                            </View>
                        </View>
                    )}

                {!!payReq &&
                    !isPayReqExpired &&
                    !loading &&
                    !loadingFeeEstimate &&
                    !payReqChanged &&
                    !isNoAmountInvoice &&
                    BackendUtils.supportsLightningSends() && (
                        <View style={{ bottom: 10, top: 6 }}>
                            <View
                                style={{
                                    alignSelf: 'center',
                                    width: '85%',
                                    marginBottom: 30
                                }}
                            >
                                <Row
                                    justify="space-between"
                                    style={{ alignItems: 'center' }}
                                >
                                    <Text
                                        style={{
                                            ...styles.label,
                                            color: themeColor('secondaryText')
                                        }}
                                    >
                                        {localeString(
                                            'views.Cashu.CashuPaymentRequest.sendingFrom'
                                        )}
                                    </Text>
                                    {showMultiMintToggle && (
                                        <Row style={{ alignItems: 'center' }}>
                                            <Text
                                                style={{
                                                    color: themeColor(
                                                        'secondaryText'
                                                    ),
                                                    fontSize: 15,
                                                    fontFamily:
                                                        'PPNeueMontreal-Book',
                                                    marginRight: 8
                                                }}
                                            >
                                                {localeString(
                                                    'views.Cashu.CashuPaymentRequest.multiMint'
                                                )}
                                            </Text>
                                            <Switch
                                                value={multiMintEnabled}
                                                onValueChange={
                                                    this.handleMultiMintToggle
                                                }
                                            />
                                        </Row>
                                    )}
                                </Row>
                                <View
                                    style={{
                                        marginTop: 10
                                    }}
                                >
                                    <EcashMintPicker
                                        disableRandom
                                        isMultiMintView={multiMintEnabled}
                                        navigation={navigation}
                                    />
                                </View>
                            </View>
                            {requestAmount &&
                            requestAmount >= slideToPayThreshold &&
                            !SettingsStore.settingsUpdateInProgress &&
                            !hasPayReqError &&
                            !noBalance ? (
                                <SwipeButton
                                    key={this.state.swipeButtonKey}
                                    onSwipeSuccess={this.triggerPayment}
                                    instructionText={localeString(
                                        'views.PaymentRequest.slideToPay'
                                    )}
                                    containerStyle={{
                                        backgroundColor:
                                            themeColor('secondaryText'),
                                        marginBottom: 10
                                    }}
                                    swipeButtonStyle={{
                                        backgroundColor: themeColor('text')
                                    }}
                                />
                            ) : requestAmount &&
                              requestAmount >= slideToPayThreshold ? (
                                <View style={styles.button}>
                                    <Button
                                        title={localeString(
                                            'views.PaymentRequest.slideToPay'
                                        )}
                                        disabled
                                    />
                                </View>
                            ) : (
                                <View style={styles.button}>
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
                                            SettingsStore.settingsUpdateInProgress ||
                                            hasPayReqError ||
                                            noBalance
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
