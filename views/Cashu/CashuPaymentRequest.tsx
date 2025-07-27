import * as React from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    View,
    TouchableOpacity
} from 'react-native';
import { reaction } from 'mobx';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import Slider from '@react-native-community/slider';
import { ButtonGroup } from 'react-native-elements';

import Amount from '../../components/Amount';
import AmountInput from '../../components/AmountInput';
import Button from '../../components/Button';
import EcashMintPicker from '../../components/EcashMintPicker';
import SwipeButton from '../../components/SwipeButton';
import Conversion from '../../components/Conversion';
import Header from '../../components/Header';
import KeyValue from '../../components/KeyValue';
import LoadingIndicator from '../../components/LoadingIndicator';
import Screen from '../../components/Screen';
import { WarningMessage } from '../../components/SuccessErrorMessage';
import Switch from '../../components/Switch';

import BalanceStore from '../../stores/BalanceStore';
import CashuStore from '../../stores/CashuStore';
import TransactionsStore, {
    SendPaymentReq
} from '../../stores/TransactionsStore';
import UnitsStore from '../../stores/UnitsStore';
import LnurlPayStore from '../../stores/LnurlPayStore';
import SettingsStore from '../../stores/SettingsStore';

import { localeString } from '../../utils/LocaleUtils';
import BackendUtils from '../../utils/BackendUtils';
import LinkingUtils from '../../utils/LinkingUtils';
import { themeColor } from '../../utils/ThemeUtils';
import { numberWithCommas } from '../../utils/UnitsUtils';
import {
    calculateDonationAmount,
    findDonationPercentageIndex
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
    navigation: StackNavigationProp<any, any>;
    BalanceStore: BalanceStore;
    CashuStore: CashuStore;
    TransactionsStore: TransactionsStore;
    UnitsStore: UnitsStore;
    LnurlPayStore: LnurlPayStore;
    SettingsStore: SettingsStore;
}

interface CashuPaymentRequestState {
    customAmount: string;
    satAmount: string | number;
    zaplockerToggle: boolean;
    slideToPayThreshold: number;
    donationsToggle: boolean;
    donationPercentage: any;
    donationAmount: any;
    selectedIndex: number | null;
    swipeButtonKey: number;
}

@inject(
    'BalanceStore',
    'CashuStore',
    'TransactionsStore',
    'UnitsStore',
    'LnurlPayStore',
    'SettingsStore'
)
@observer
export default class CashuPaymentRequest extends React.Component<
    CashuPaymentRequestProps,
    CashuPaymentRequestState
> {
    listener: any;
    isComponentMounted: boolean = false;
    focusListener: any = null;
    payReqDisposer: any;
    state = {
        customAmount: '',
        satAmount: '',
        zaplockerToggle: false,
        slideToPayThreshold: 10000,
        donationsToggle: false,
        donationPercentage: 0,
        donationAmount: 0,
        selectedIndex: null,
        swipeButtonKey: 0
    };

    async componentDidMount() {
        this.isComponentMounted = true;
        const { SettingsStore, CashuStore } = this.props;
        const settings = await SettingsStore.getSettings();
        const { defaultDonationPercentage } = settings.payments;

        this.payReqDisposer = reaction(
            () => CashuStore.payReq,
            (payReq) => {
                if (payReq?.getRequestAmount) {
                    const requestAmount = payReq.getRequestAmount;
                    const donationAmount = calculateDonationAmount(
                        requestAmount,
                        Number(defaultDonationPercentage) || 0
                    );
                    const index = findDonationPercentageIndex(
                        Number(defaultDonationPercentage) || 0,
                        [5, 10, 20]
                    );

                    this.setState({
                        donationAmount,
                        selectedIndex: index,
                        donationPercentage:
                            Number(defaultDonationPercentage) || 0
                    });
                }
            }
        );

        const { paymentRequest, getPayReq } = CashuStore;

        this.setState({
            slideToPayThreshold: settings?.payments?.slideToPayThreshold
        });

        // Reset slide to pay slider position when screen comes into focus
        this.focusListener = this.props.navigation.addListener('focus', () => {
            getPayReq(paymentRequest!!);
            this.setState({
                swipeButtonKey: this.state.swipeButtonKey + 1
            });
        });
    }

    componentWillUnmount(): void {
        this.isComponentMounted = false;

        if (this.payReqDisposer) {
            this.payReqDisposer();
        }

        if (this.focusListener) {
            this.focusListener();
        }
    }

    sendPayment = ({
        amount // used only for no-amount invoices
    }: SendPaymentReq) => {
        const { CashuStore, SettingsStore, navigation } = this.props;
        const { settings } = SettingsStore;

        const enableDonations = settings?.payments?.enableDonations;
        const { donationAmount } = this.state;

        CashuStore.payLnInvoiceFromEcash({
            amount: amount ? amount : undefined
        });

        navigation.navigate('CashuSendingLightning', {
            enableDonations,
            ...(enableDonations &&
                donationAmount > 0 && {
                    donationAmount: donationAmount.toString()
                })
        });
    };

    triggerPayment = () => {
        const { LnurlPayStore } = this.props;
        const { satAmount } = this.state;

        // Zaplocker
        const { isZaplocker } = LnurlPayStore;

        // Broadcast attestation if Zaplocker is enabled
        if (isZaplocker) LnurlPayStore.broadcastAttestation();

        // Call sendPayment with the freshest values
        this.sendPayment({
            amount: satAmount ? satAmount.toString() : undefined
        });
    };

    render() {
        const { CashuStore, LnurlPayStore, SettingsStore, navigation } =
            this.props;
        const {
            customAmount,
            zaplockerToggle,
            slideToPayThreshold,
            donationsToggle,
            donationAmount,
            donationPercentage
        } = this.state;
        const {
            payReq,
            paymentRequest,
            getPayReqError,
            loading,
            loadingFeeEstimate,
            feeEstimate,
            clearPayReq,
            totalBalanceSats
        } = CashuStore;

        // Zaplocker
        const {
            isZaplocker,
            isPmtHashSigValid,
            isRelaysSigValid,
            zaplockerNpub
        } = LnurlPayStore;

        const isZaplockerValid = isPmtHashSigValid && isRelaysSigValid;

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

        const isNoAmountInvoice: boolean =
            !requestAmount || requestAmount === 0;

        const noBalance = totalBalanceSats === 0;

        const enableDonations = settings?.payments?.enableDonations;

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
                    onBack={() => clearPayReq()}
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
                        {!!getPayReqError && (
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

                        {!loading && !loadingFeeEstimate && !!payReq && (
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
                                                        'views.Cashu.CashuPaymentRequest.noBalance'
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
                    !loading &&
                    !loadingFeeEstimate &&
                    BackendUtils.supportsLightningSends() && (
                        <View style={{ bottom: 10, top: 6 }}>
                            <View
                                style={{
                                    alignSelf: 'center',
                                    width: '85%',
                                    marginBottom: 30,
                                    marginTop: 10,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                }}
                            >
                                <Text
                                    style={{
                                        ...styles.label,
                                        color: themeColor('secondaryText'),
                                        fontSize: 16
                                    }}
                                >
                                    {localeString(
                                        'views.Cashu.CashuPaymentRequest.sendingFrom'
                                    )}
                                </Text>
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center'
                                    }}
                                >
                                    <Text
                                        style={{
                                            marginLeft: 6,
                                            color: themeColor('secondaryText'),
                                            fontFamily: 'PPNeueMontreal-Book',
                                            fontSize: 15
                                        }}
                                    >
                                        {localeString(
                                            'views.Cashu.CashuPaymentRequest.multiMint'
                                        )}
                                    </Text>
                                    <Switch
                                        value={CashuStore.multiMint}
                                        onValueChange={
                                            this.handleToggleMultiMint
                                        }
                                        trackEnabledColor={themeColor(
                                            'highlight'
                                        )}
                                    />
                                </View>
                            </View>

                            <View
                                style={{
                                    alignSelf: 'center',
                                    width: '85%',
                                    marginBottom: CashuStore.multiMint
                                        ? CashuStore.selectedMintUrls.length > 2
                                            ? 115
                                            : CashuStore.selectedMintUrls
                                                  .length <= 1
                                            ? 30
                                            : 72
                                        : 30
                                }}
                            >
                                <EcashMintPicker
                                    showMore={true}
                                    navigation={navigation}
                                />
                            </View>

                            {requestAmount &&
                            requestAmount >= slideToPayThreshold ? (
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
