import * as React from 'react';
import {
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    View,
    TouchableOpacity
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
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
import CashuStore, { CashuPaymentPlan } from '../../stores/CashuStore';
import TransactionsStore from '../../stores/TransactionsStore';
import UnitsStore from '../../stores/UnitsStore';
import SettingsStore from '../../stores/SettingsStore';
import NodeInfoStore from '../../stores/NodeInfoStore';

import { localeString } from '../../utils/LocaleUtils';
import BackendUtils from '../../utils/BackendUtils';
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

interface CashuPaymentRequestProps {
    exitSetup: any;
    navigation: NativeStackNavigationProp<any, any>;
    // paymentRequest: the invoice this screen quotes, shows and pays
    route: Route<'CashuPaymentRequest', { paymentRequest: string }>;
    BalanceStore: BalanceStore;
    CashuStore: CashuStore;
    TransactionsStore: TransactionsStore;
    UnitsStore: UnitsStore;
    SettingsStore: SettingsStore;
    NodeInfoStore: NodeInfoStore;
}

interface CashuPaymentRequestState {
    slideToPayThreshold: number;
    donationsToggle: boolean;
    donationPercentage: any;
    donationAmount: any;
    selectedIndex: number | null;
    swipeButtonKey: number;
    multiMintEnabled: boolean;
    // What CashuStore.getPayReq prepared for this screen's invoice: its
    // decode and melt quotes. Held here, not in CashuStore, so nothing
    // outside this screen can change the invoice or quotes under review
    plan: CashuPaymentPlan | null;
    loading: boolean;
}

@inject(
    'BalanceStore',
    'CashuStore',
    'TransactionsStore',
    'UnitsStore',
    'SettingsStore',
    'NodeInfoStore'
)
@observer
export class CashuPaymentRequestView extends React.Component<
    CashuPaymentRequestProps,
    CashuPaymentRequestState
> {
    listener: any;
    isComponentMounted: boolean = false;
    focusListener: any = null;
    // The invoice this instance reviews, read once: what is quoted, shown
    // and paid can't differ, whatever happens to the route params or to
    // any store afterwards. A new invoice gets a new instance, see
    // CashuPaymentRequest below
    private readonly paymentRequest: string | undefined =
        this.props.route?.params?.paymentRequest;
    // bumped by every loadPlan, so an answer can tell whether a newer
    // quote was started
    private planRequestId = 0;
    private settingsLoading?: Promise<any>;
    // the donation is derived from the invoice once; later quotes of the
    // same invoice keep what the user chose
    private donationDerived = false;
    state: CashuPaymentRequestState = {
        slideToPayThreshold: 10000,
        donationsToggle: false,
        donationPercentage: 0,
        donationAmount: 0,
        selectedIndex: null,
        swipeButtonKey: 0,
        multiMintEnabled: false,
        plan: null,
        loading: !!this.paymentRequest
    };

    async componentDidMount() {
        this.isComponentMounted = true;
        const { SettingsStore, CashuStore } = this.props;
        // the quote doesn't need the settings, so don't make it wait
        this.settingsLoading = SettingsStore.getSettings();
        this.loadPlan();
        const settings = await this.settingsLoading;

        const enabledBySetting = !!settings?.ecash?.enableMultiMint;
        const hasMultipleSelectedMints =
            Array.isArray(CashuStore.multiMintSelectedUrls) &&
            CashuStore.multiMintSelectedUrls.length > 1;

        this.setState({
            slideToPayThreshold: settings?.payments?.slideToPayThreshold,
            multiMintEnabled: enabledBySetting && hasMultipleSelectedMints
        });

        // Quote the invoice again when the screen comes back into focus
        // (e.g. after the mint picker or a failed payment), and reset the
        // slide to pay slider
        this.focusListener = this.props.navigation.addListener('focus', () => {
            this.loadPlan();
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

        if (this.focusListener) {
            this.focusListener();
        }
    }

    // Decodes and quotes this screen's invoice. The pay controls are hidden
    // while a quote is loading, and the plan on screen is replaced only by
    // the latest one asked for
    loadPlan = async () => {
        const { CashuStore } = this.props;
        if (!this.paymentRequest) return;
        const requestId = ++this.planRequestId;
        this.setState({ loading: true });

        const [plan, settings] = await Promise.all([
            CashuStore.getPayReq(this.paymentRequest),
            this.settingsLoading
        ]);
        if (requestId !== this.planRequestId) return;

        const requestAmount = plan.payReq?.getRequestAmount;
        if (requestAmount && !this.donationDerived) {
            this.donationDerived = true;
            const defaultPct =
                Number(settings?.payments?.defaultDonationPercentage) || 0;
            this.setState({
                donationAmount: calculateDonationAmount(
                    requestAmount,
                    defaultPct
                ),
                selectedIndex: findDonationPercentageIndex(
                    defaultPct,
                    [5, 10, 20]
                ),
                donationPercentage: defaultPct
            });
        }
        this.setState({ plan, loading: false });
    };

    // The donation that will actually be sent with this payment. Resolved in
    // one place so the coverage check below and the amount handed to the
    // sending views cannot disagree: those views take this as decided rather
    // than re-reading the store, which is what stops a donation the check
    // never counted from going out once nodeInfo arrives mid-payment.
    resolveDonationToSend = () => {
        const { SettingsStore, NodeInfoStore } = this.props;
        const { donationAmount, plan } = this.state;

        const donationsAllowed =
            Platform.OS !== 'ios' &&
            !!plan?.payReq?.getRequestAmount &&
            SettingsStore.settings?.payments?.enableDonations;

        return getDonationToSend(
            NodeInfoStore?.nodeInfo?.isMainNet,
            donationsAllowed,
            donationAmount
        );
    };

    triggerPayment = () => {
        const { CashuStore, navigation } = this.props;
        const { multiMintEnabled, plan, loading } = this.state;

        // A slide to pay can still complete after its screen was replaced
        // by the review of another invoice. This one is no longer on
        // screen, so don't pay it
        if (!this.isComponentMounted) return;

        // Pay only a plan that is on screen. While a new quote is loading
        // the pay controls are hidden and the plan is about to be replaced
        if (!plan || loading) return;

        // Fail closed if the invoice has expired since it was reviewed:
        // the invoice can lapse while this screen is open, and expiry is
        // otherwise only enforced by the mint and recipient
        if (plan.payReq?.isExpiredNow()) {
            // re-render so the expired notice appears and the pay
            // controls are removed
            this.forceUpdate();
            return;
        }

        const requestAmount = plan.payReq?.getRequestAmount;
        const paymentAmount = requestAmount
            ? requestAmount.toString()
            : undefined;
        const donationToSend = this.resolveDonationToSend();

        const isMultiMint =
            multiMintEnabled &&
            Array.isArray(CashuStore?.multiMintSelectedUrls) &&
            CashuStore!.multiMintSelectedUrls.length > 1;

        // The sending screens are handed the plan that was reviewed: its
        // invoice is paid with its quotes
        navigation.navigate(
            isMultiMint ? 'MultimintPayment' : 'CashuSendingLightning',
            {
                paymentAmount,
                paymentPlan: plan,
                ...(donationToSend > 0 && {
                    donationAmount: donationToSend.toString()
                })
            }
        );
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

        // the mints changed, so the quotes on screen no longer apply
        await this.loadPlan();
    };

    render() {
        const { CashuStore, NodeInfoStore, SettingsStore, navigation } =
            this.props;
        const {
            slideToPayThreshold,
            donationsToggle,
            donationAmount,
            donationPercentage,
            multiMintEnabled,
            plan,
            loading
        } = this.state;
        const { totalBalanceSats } = CashuStore;
        const paymentRequest = this.paymentRequest;
        const payReq = plan?.payReq;
        const getPayReqError = plan?.error;
        const feeEstimate = plan?.feeEstimate;
        const payReqMintBalance = plan?.mintBalance ?? 0;
        const payReqAmount = plan?.amount ?? 0;

        const isPayReqExpired = !!payReq && payReq.isExpiredNow();

        const locale = SettingsStore.settings.locale;
        if (payReq) payReq.determineFormattedOriginalTimeUntilExpiry(locale);

        const requestAmount =
            payReq && payReq.getRequestAmount
                ? payReq.getRequestAmount
                : undefined;
        const expiry = payReq && payReq.formattedOriginalTimeUntilExpiry;
        const cltv_expiry = payReq && payReq.cltv_expiry;
        const destination = payReq && payReq.destination;
        const description = payReq && payReq.description;
        const payment_hash = payReq && payReq.payment_hash;
        const timestamp = payReq && payReq.timestamp;

        const date = new Date(Number(timestamp) * 1000).toString();

        const { settings } = SettingsStore;

        const isNoAmountInvoice: boolean = !requestAmount;
        const showMultiMintToggle = !!settings?.ecash?.enableMultiMint;

        const noBalance = totalBalanceSats === 0;

        const enableDonations =
            Platform.OS !== 'ios' &&
            !isNoAmountInvoice &&
            settings?.payments?.enableDonations &&
            NodeInfoStore?.nodeInfo?.isMainNet;

        // The donation is a second payment drawn from the same mint right
        // after this one, so the balance has to cover both. This is the same
        // value the sending views are handed, so what is checked here and
        // what is sent are the same number.
        const donationToCover = this.resolveDonationToSend();
        // payReqMintBalance is 0 when getPayReq did not quote the invoice, and
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
                    rightComponent={paymentRequest ? <QRButton /> : undefined}
                    navigation={navigation}
                />

                {loading && (
                    <View style={{ marginTop: 40 }}>
                        <LoadingIndicator />
                    </View>
                )}

                <View style={{ flex: 1 }}>
                    <ScrollView keyboardShouldPersistTaps="handled">
                        {!paymentRequest && (
                            <View style={styles.content}>
                                <ErrorMessage
                                    message={localeString(
                                        'views.PaymentRequest.noPayReq'
                                    )}
                                />
                            </View>
                        )}

                        {!loading && !payReq && !!getPayReqError && (
                            <View style={styles.content}>
                                <Text
                                    style={{
                                        ...styles.label,
                                        color: themeColor('text')
                                    }}
                                >
                                    {localeString('views.PaymentRequest.error')}
                                    : {getPayReqError}
                                </Text>
                            </View>
                        )}

                        {!loading && !!payReq && (
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

// navigate() and popTo() to an open CashuPaymentRequest only swap its route
// params. Keying the screen by its invoice turns that into a new instance:
// the review of the old invoice is unmounted, with its donation choice and
// any slide to pay still in progress, and the new invoice is quoted and
// shown from scratch.
export default function CashuPaymentRequest(
    props: Pick<CashuPaymentRequestProps, 'navigation' | 'route'>
) {
    return (
        <CashuPaymentRequestView
            key={props.route?.params?.paymentRequest}
            {...(props as CashuPaymentRequestProps)}
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
