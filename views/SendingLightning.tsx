import * as React from 'react';
import {
    BackHandler,
    Dimensions,
    NativeEventSubscription,
    StyleSheet,
    Text,
    View,
    TouchableOpacity
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import { Route } from '@react-navigation/native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { getRouteStack } from '../NavigationService';

import LnurlPaySuccess from './LnurlPay/Success';

import Button from '../components/Button';
import LightningLoadingPattern from '../components/LightningLoadingPattern';
import PaidIndicator from '../components/PaidIndicator';
import Screen from '../components/Screen';
import SuccessAnimation from '../components/SuccessAnimation';
import { Row } from '../components/layout/Row';
import KeyValue from '../components/KeyValue';
import Amount from '../components/Amount';
import ModalBox from '../components/ModalBox';
import RatingModal from '../components/Modals/RatingModal';

import BalanceStore from '../stores/BalanceStore';
import LnurlPayStore from '../stores/LnurlPayStore';
import PaymentsStore from '../stores/PaymentsStore';
import SettingsStore from '../stores/SettingsStore';
import TransactionsStore from '../stores/TransactionsStore';
import NodeInfoStore from '../stores/NodeInfoStore';

import Base64Utils from '../utils/Base64Utils';
import BackendUtils from '../utils/BackendUtils';
import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import Storage from '../storage';

import Clock from '../assets/images/SVG/Clock.svg';
import ErrorIcon from '../assets/images/SVG/ErrorIcon.svg';
import Wordmark from '../assets/images/SVG/wordmark-black.svg';
import Gift from '../assets/images/SVG/gift.svg';
import CopyBox from '../components/CopyBox';
import LoadingIndicator from '../components/LoadingIndicator';
import BigNumber from 'bignumber.js';

interface SendingLightningProps {
    navigation: StackNavigationProp<any, any>;
    BalanceStore: BalanceStore;
    LnurlPayStore: LnurlPayStore;
    PaymentsStore: PaymentsStore;
    SettingsStore: SettingsStore;
    route: Route<
        'SendingLightning',
        {
            donationAmount?: string;
            enableDonations: boolean;
        }
    >;
    TransactionsStore: TransactionsStore;
    NodeInfoStore: NodeInfoStore;
}

interface SendingLightningState {
    storedNotes: string;
    wasSuccessful: boolean;
    currentPayment: any;
    paymentType: string;
    payingDonation: boolean;
    showDonationInfo: boolean;
    donationHandled: boolean;
    donationPreimage: string;
    amountDonated: number | null;
    donationEnhancedPath: any;
    donationPathExists: boolean;
    donationFee: string;
    donationFeePercentage: string;
}

@inject(
    'BalanceStore',
    'LnurlPayStore',
    'PaymentsStore',
    'SettingsStore',
    'TransactionsStore',
    'NodeInfoStore'
)
@observer
export default class SendingLightning extends React.Component<
    SendingLightningProps,
    SendingLightningState
> {
    private backPressSubscription: NativeEventSubscription;

    focusListener: any;

    constructor(props: SendingLightningProps) {
        super(props);
        this.state = {
            storedNotes: '',
            currentPayment: null,
            wasSuccessful: false,
            payingDonation: false,
            showDonationInfo: false,
            donationHandled: false,
            donationPreimage: '',
            amountDonated: null,
            paymentType: 'main',
            donationEnhancedPath: null,
            donationPathExists: false,
            donationFee: '',
            donationFeePercentage: ''
        };
    }

    componentDidMount() {
        const { TransactionsStore, navigation } = this.props;

        this.focusListener = navigation.addListener('focus', () => {
            this.setState({ showDonationInfo: false });
            const noteKey: string = TransactionsStore.noteKey;
            if (!noteKey) return;
            Storage.getItem(noteKey)
                .then((storedNotes) => {
                    if (storedNotes) {
                        this.setState({ storedNotes });
                    }
                })
                .catch((error) => {
                    console.error('Error retrieving notes:', error);
                });
        });

        this.backPressSubscription = BackHandler.addEventListener(
            'hardwareBackPress',
            this.handleBackPress.bind(this)
        );
    }

    componentDidUpdate(_prevProps: SendingLightningProps) {
        const { TransactionsStore, BalanceStore, NodeInfoStore, route } =
            this.props;

        const { donationIsPaid } = TransactionsStore;

        const wasSuccessful = this.successfullySent(TransactionsStore);
        const { donationAmount, enableDonations } = route.params || {};

        if (wasSuccessful && !this.state.wasSuccessful) {
            this.setState({ wasSuccessful: true }, () => {
                this.fetchPayments();
                BalanceStore.getCombinedBalance();
            });
        } else if (!wasSuccessful && this.state.wasSuccessful) {
            this.setState({ wasSuccessful: false });
        }

        if (
            NodeInfoStore!.nodeInfo.isMainNet &&
            wasSuccessful &&
            enableDonations &&
            donationAmount &&
            !donationIsPaid &&
            !this.state.payingDonation &&
            !this.state.donationHandled
        ) {
            this.handleDonationPayment(donationAmount);
        }
    }

    handleDonationPayment = async (donationAmount: string) => {
        const { TransactionsStore, PaymentsStore } = this.props;

        this.setState({ payingDonation: true, paymentType: 'donation' });

        try {
            const paymentRequest = await this.loadLnurl(donationAmount);
            if (!paymentRequest) {
                this.setState({
                    payingDonation: false,
                    amountDonated: parseFloat(donationAmount)
                });
                return;
            }

            const result = await TransactionsStore.sendPaymentSilently({
                payment_request: paymentRequest
            });
            const { payment_error, status } = result || {};

            if (
                (typeof status === 'string' && status === 'FAILED') ||
                (typeof payment_error === 'string' && payment_error !== '')
            ) {
                this.setState({
                    payingDonation: false,
                    amountDonated: parseFloat(donationAmount ?? '')
                });
                return;
            }

            TransactionsStore.donationIsPaid = true;

            const amountDonated =
                result?.num_satoshis ||
                result?.value_sat ||
                result.amount_msat / 1000;
            let donationFee = '';

            if (result?.amount_msat && result?.amount_sent_msat) {
                const msatSent = +result.amount_sent_msat
                    .toString()
                    .replace('msat', '');
                const msat = +result.amount_msat.toString().replace('msat', '');
                donationFee = ((msatSent - msat) / 1000).toString();
            }

            let payment_preimage = '';
            const preimage = result?.payment_preimage;
            if (preimage) {
                if (typeof preimage !== 'string' && preimage.data) {
                    payment_preimage = Base64Utils.bytesToHex(preimage.data);
                } else if (typeof preimage === 'string') {
                    payment_preimage = preimage;
                }
            }

            const payments = await PaymentsStore.getPayments({
                maxPayments: 1,
                reversed: true
            });
            const payment = payments?.[0];

            if (payment?.fee_msat) {
                donationFee = (Number(payment.fee_msat) / 1000).toString();
            }

            const donationFeePercentage =
                Number(
                    new BigNumber(donationFee)
                        .div(amountDonated)
                        .times(100)
                        .toFixed(3)
                )
                    .toString()
                    .replace(/-/g, '') + '%';

            let donationEnhancedPath = null;
            let donationPathExists = false;
            if (BackendUtils.isLNDBased() && payment?.enhancedPath) {
                donationEnhancedPath = payment.enhancedPath;
                donationPathExists =
                    donationEnhancedPath?.length > 0 &&
                    donationEnhancedPath[0][0];
            }

            this.setState({
                payingDonation: false,
                donationHandled: true,
                donationPreimage: payment_preimage || '',
                amountDonated,
                donationEnhancedPath,
                donationPathExists,
                donationFee,
                donationFeePercentage
            });
        } catch (err) {
            console.error('Donation payment failed:', err);
            this.setState({
                payingDonation: false,
                amountDonated: parseFloat(donationAmount)
            });
        }
    };

    loadLnurl = async (donationAmount: string) => {
        const donationAddress = 'tips@pay.zeusln.app';

        const [username, bolt11Domain] = donationAddress.split('@');
        const url = bolt11Domain.includes('.onion')
            ? `http://${bolt11Domain}/.well-known/lnurlp/${username.toLowerCase()}`
            : `https://${bolt11Domain}/.well-known/lnurlp/${username.toLowerCase()}`;

        try {
            const response = await ReactNativeBlobUtil.fetch('GET', url);
            const lnurlData = response.json();
            const amount = parseFloat(donationAmount ?? '') * 1000;
            const callbackUrl = `${lnurlData.callback}?amount=${amount}`;

            const invoiceResponse = await ReactNativeBlobUtil.fetch(
                'GET',
                callbackUrl
            );
            const invoiceData = invoiceResponse.json();

            return invoiceData.pr;
        } catch (err) {
            console.error('loadLnurl error:', err);
            return null;
        }
    };

    renderInfoModal = () => {
        const {
            showDonationInfo,
            donationPreimage,
            donationHandled,
            amountDonated,
            donationEnhancedPath,
            donationPathExists,
            donationFee,
            donationFeePercentage
        } = this.state;

        const { navigation } = this.props;

        return (
            <ModalBox
                isOpen={showDonationInfo}
                style={{
                    backgroundColor: 'transparent'
                }}
                onClosed={() => {
                    this.setState({
                        showDonationInfo: false
                    });
                }}
                position="center"
            >
                <View
                    style={{
                        flex: 1,
                        justifyContent: 'center',
                        alignItems: 'center'
                    }}
                >
                    <View
                        style={{
                            backgroundColor: themeColor('secondary'),
                            borderRadius: 24,
                            padding: 20,
                            alignItems: 'center',
                            width: '90%'
                        }}
                    >
                        {donationHandled ? (
                            <>
                                <Text
                                    style={{
                                        fontFamily: 'PPNeueMontreal-Book',
                                        color: themeColor('text'),
                                        marginBottom: 12,
                                        fontSize: 18,
                                        textAlign: 'center'
                                    }}
                                >
                                    {localeString(
                                        'views.PaymentRequest.thankYouForDonation'
                                    )}
                                </Text>
                                <View
                                    style={{
                                        width: '100%',
                                        marginBottom: -10
                                    }}
                                >
                                    <KeyValue
                                        keyValue={localeString(
                                            'views.PaymentRequest.amountDonated'
                                        )}
                                        value={
                                            <Amount
                                                sats={amountDonated?.toString()}
                                                sensitive
                                                toggleable
                                            />
                                        }
                                    />
                                </View>
                                {donationFee && donationFeePercentage && (
                                    <View
                                        style={{
                                            width: '100%'
                                        }}
                                    >
                                        <KeyValue
                                            keyValue={localeString(
                                                'views.Payment.fee'
                                            )}
                                            value={
                                                <Row>
                                                    <Amount
                                                        sats={donationFee}
                                                        debit
                                                        sensitive
                                                        toggleable
                                                    />
                                                    {donationFeePercentage && (
                                                        <Text
                                                            style={{
                                                                fontFamily:
                                                                    'PPNeueMontreal-Book',
                                                                color: themeColor(
                                                                    'text'
                                                                )
                                                            }}
                                                        >
                                                            {` (${donationFeePercentage})`}
                                                        </Text>
                                                    )}
                                                </Row>
                                            }
                                        />
                                    </View>
                                )}

                                {donationPreimage && (
                                    <View
                                        style={{
                                            width: '100%',
                                            marginTop: donationFee ? 12 : 16
                                        }}
                                    >
                                        <CopyBox
                                            heading={localeString(
                                                'views.Payment.paymentPreimage'
                                            )}
                                            headingCopied={`${localeString(
                                                'views.Payment.paymentPreimage'
                                            )} ${localeString(
                                                'components.ExternalLinkModal.copied'
                                            )}`}
                                            theme="dark"
                                            URL={donationPreimage}
                                        />
                                    </View>
                                )}
                                {donationPathExists && (
                                    <Button
                                        title={`${localeString(
                                            'views.Payment.title'
                                        )} ${
                                            donationEnhancedPath?.length > 1
                                                ? `${localeString(
                                                      'views.Payment.paths'
                                                  )} (${
                                                      donationEnhancedPath.length
                                                  })`
                                                : localeString(
                                                      'views.Payment.path'
                                                  )
                                        } `}
                                        onPress={() => {
                                            this.setState({
                                                showDonationInfo: false
                                            });
                                            navigation.navigate(
                                                'PaymentPaths',
                                                {
                                                    enhancedPath:
                                                        donationEnhancedPath
                                                }
                                            );
                                        }}
                                        buttonStyle={{
                                            height: 40,
                                            width: '100%'
                                        }}
                                        containerStyle={{ marginTop: 30 }}
                                    />
                                )}
                            </>
                        ) : (
                            <Text
                                style={{
                                    fontFamily: 'PPNeueMontreal-Book',
                                    color: themeColor('text'),
                                    fontSize: 18,
                                    marginBottom: 20,
                                    textAlign: 'center'
                                }}
                            >
                                {localeString(
                                    'views.SendingLightning.donationFailed'
                                )}
                            </Text>
                        )}
                        <Button
                            title={localeString('general.close')}
                            onPress={() =>
                                this.setState({ showDonationInfo: false })
                            }
                            containerStyle={{
                                marginTop: donationPathExists ? 14 : 18
                            }}
                            tertiary
                        />
                    </View>
                </View>
            </ModalBox>
        );
    };

    fetchPayments = async () => {
        const { PaymentsStore, TransactionsStore } = this.props;
        try {
            const payments = await PaymentsStore.getPayments({
                maxPayments: 5,
                reversed: true
            });
            const matchingPayment = payments.find(
                (payment: any) =>
                    payment.payment_preimage ===
                    TransactionsStore.payment_preimage
            );
            this.setState({ currentPayment: matchingPayment });
        } catch (error) {
            this.setState({ currentPayment: null });
            console.error('Failed to fetch payments', error);
        }
    };
    private handleBackPress(): boolean {
        const { TransactionsStore, navigation } = this.props;
        if (
            !TransactionsStore.error &&
            (this.successfullySent(TransactionsStore) ||
                this.inTransit(TransactionsStore))
        ) {
            navigation.popTo('Wallet');
            return true;
        }
        return false;
    }

    componentWillUnmount(): void {
        if (this.focusListener) {
            this.focusListener();
        }
        this.backPressSubscription?.remove();
    }

    private successfullySent(transactionStore: TransactionsStore): boolean {
        return (
            transactionStore.payment_route ||
            transactionStore.status === 'complete' ||
            transactionStore.status === 'SUCCEEDED' ||
            transactionStore.status === 2
        );
    }

    private inTransit(transactionStore: TransactionsStore): boolean {
        return (
            transactionStore.status === 'IN_FLIGHT' ||
            transactionStore.status === 1
        );
    }

    render() {
        const { TransactionsStore, SettingsStore, LnurlPayStore, navigation } =
            this.props;
        const {
            loading,
            error,
            error_msg,
            payment_hash,
            payment_preimage,
            payment_error,
            isIncomplete,
            noteKey,
            paymentDuration
        } = TransactionsStore;
        const { implementation } = SettingsStore;
        const {
            storedNotes,
            currentPayment,
            donationHandled,
            paymentType,
            payingDonation
        } = this.state;

        const enhancedPath = currentPayment?.enhancedPath;

        const paymentPathExists =
            enhancedPath?.length > 0 && enhancedPath[0][0];

        const success = this.successfullySent(TransactionsStore);
        const inTransit = this.inTransit(TransactionsStore);
        const windowSize = Dimensions.get('window');

        const stack = getRouteStack();
        const isSwap = stack.filter((route) => route.name === 'SwapDetails')[0];

        return (
            <Screen>
                {this.renderInfoModal()}
                {<RatingModal />}
                {loading && (
                    <View
                        style={{
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%',
                            marginTop: 25
                        }}
                    >
                        <LightningLoadingPattern />
                        <Text
                            style={{
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book',
                                // paddingBottom for centering
                                paddingBottom: windowSize.height / 10,
                                fontSize:
                                    windowSize.width * windowSize.scale * 0.014
                            }}
                        >
                            {localeString('views.SendingLightning.sending')}
                        </Text>
                    </View>
                )}
                {paymentType === 'donation' && (
                    <View
                        style={{
                            position: 'absolute',
                            top: 10,
                            right: 10,
                            zIndex: 1
                        }}
                    >
                        {payingDonation ? (
                            <LoadingIndicator />
                        ) : (
                            <TouchableOpacity
                                onPress={() =>
                                    this.setState({ showDonationInfo: true })
                                }
                            >
                                <Gift
                                    fill={
                                        donationHandled
                                            ? themeColor('highlight')
                                            : themeColor('error')
                                    }
                                    width={30}
                                    height={30}
                                />
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {!loading && (
                    <>
                        <View
                            style={{
                                ...styles.content,
                                paddingTop: windowSize.height * 0.05
                            }}
                        >
                            {(!!success || !!inTransit) && !error && (
                                <Wordmark
                                    height={windowSize.width * 0.25}
                                    width={windowSize.width}
                                    fill={themeColor('highlight')}
                                />
                            )}
                            {!!success && !error && (
                                <>
                                    <PaidIndicator />
                                    <View style={{ alignItems: 'center' }}>
                                        <SuccessAnimation />
                                        <Text
                                            style={{
                                                color: themeColor('text'),
                                                paddingTop:
                                                    windowSize.height * 0.03,
                                                fontFamily:
                                                    'PPNeueMontreal-Book',
                                                fontSize:
                                                    windowSize.width *
                                                    windowSize.scale *
                                                    0.017
                                            }}
                                        >
                                            {localeString(
                                                'views.SendingLightning.success'
                                            )}
                                        </Text>
                                        {paymentDuration !== null && (
                                            <Text
                                                style={{
                                                    color: themeColor(
                                                        'secondaryText'
                                                    ),
                                                    marginTop: 10,
                                                    fontFamily:
                                                        'PPNeueMontreal-Book'
                                                }}
                                            >
                                                {localeString(
                                                    'views.SendingLightning.paymentSettled',
                                                    {
                                                        seconds:
                                                            paymentDuration.toFixed(
                                                                2
                                                            )
                                                    }
                                                )}
                                            </Text>
                                        )}
                                    </View>
                                </>
                            )}
                            {!!inTransit && !error && (
                                <View
                                    style={{
                                        padding: 20,
                                        marginTop: 10,
                                        marginBottom: 10,
                                        alignItems: 'center'
                                    }}
                                >
                                    <Clock
                                        color={themeColor('bitcoin')}
                                        width={windowSize.height * 0.2}
                                        height={windowSize.height * 0.2}
                                    />
                                    <Text
                                        style={{
                                            color: themeColor('text'),
                                            fontFamily: 'PPNeueMontreal-Book',
                                            fontSize:
                                                windowSize.width *
                                                windowSize.scale *
                                                0.014,
                                            marginTop: windowSize.height * 0.03,
                                            textAlign: 'center'
                                        }}
                                    >
                                        {localeString(
                                            'views.SendingLightning.inTransit'
                                        )}
                                    </Text>
                                </View>
                            )}
                            {LnurlPayStore.isZaplocker &&
                                (!success || !!error) && (
                                    <View
                                        style={{
                                            padding: 20,
                                            marginTop: 10,
                                            marginBottom: 10,
                                            alignItems: 'center'
                                        }}
                                    >
                                        <Clock
                                            color={themeColor('bitcoin')}
                                            width={windowSize.height * 0.2}
                                            height={windowSize.height * 0.2}
                                        />
                                        <Text
                                            style={{
                                                color: themeColor('text'),
                                                fontFamily:
                                                    'PPNeueMontreal-Book',
                                                fontSize:
                                                    windowSize.width *
                                                    windowSize.scale *
                                                    0.014,
                                                marginTop:
                                                    windowSize.height * 0.03,
                                                textAlign: 'center'
                                            }}
                                        >
                                            {localeString(
                                                'views.SendingLightning.isZaplocker'
                                            )}
                                        </Text>
                                    </View>
                                )}
                            {(!!error || !!payment_error) &&
                                !LnurlPayStore.isZaplocker && (
                                    <View style={{ alignItems: 'center' }}>
                                        <ErrorIcon
                                            width={windowSize.height * 0.13}
                                            height={windowSize.height * 0.13}
                                        />
                                        <Text
                                            style={{
                                                color: themeColor('warning'),
                                                fontFamily:
                                                    'PPNeueMontreal-Book',
                                                fontSize: 32,
                                                marginTop:
                                                    windowSize.height * 0.07
                                            }}
                                        >
                                            {localeString('general.error')}
                                        </Text>
                                        {(payment_error || error_msg) && (
                                            <Text
                                                style={{
                                                    color: themeColor('text'),
                                                    fontFamily:
                                                        'PPNeueMontreal-Book',
                                                    fontSize:
                                                        windowSize.width *
                                                        windowSize.scale *
                                                        0.014,
                                                    textAlign: 'center',
                                                    marginTop:
                                                        windowSize.height *
                                                        0.025,
                                                    padding: 5
                                                }}
                                            >
                                                {payment_error || error_msg}
                                            </Text>
                                        )}
                                    </View>
                                )}
                            {!!success &&
                                !error &&
                                !!payment_preimage &&
                                payment_hash === LnurlPayStore.paymentHash &&
                                LnurlPayStore.successAction && (
                                    <View style={{ width: '90%' }}>
                                        <LnurlPaySuccess
                                            color="white"
                                            domain={LnurlPayStore.domain}
                                            successAction={
                                                LnurlPayStore.successAction
                                            }
                                            preimage={payment_preimage}
                                            scrollable={true}
                                            maxHeight={windowSize.height * 0.15}
                                        />
                                    </View>
                                )}
                            {!!payment_preimage &&
                                !isIncomplete &&
                                !error &&
                                !payment_error && (
                                    <View style={{ width: '90%' }}>
                                        <CopyBox
                                            heading={localeString(
                                                'views.Payment.paymentPreimage'
                                            )}
                                            headingCopied={`${localeString(
                                                'views.Payment.paymentPreimage'
                                            )} ${localeString(
                                                'components.ExternalLinkModal.copied'
                                            )}`}
                                            theme="dark"
                                            URL={payment_preimage}
                                        />
                                    </View>
                                )}
                        </View>

                        <Row
                            align="flex-end"
                            style={{
                                marginBottom: 5,
                                bottom: 25,
                                alignSelf: 'center'
                            }}
                        >
                            {paymentPathExists && (
                                <Button
                                    title={`${localeString(
                                        'views.Payment.title'
                                    )} ${
                                        enhancedPath?.length > 1
                                            ? `${localeString(
                                                  'views.Payment.paths'
                                              )} (${enhancedPath.length})`
                                            : localeString('views.Payment.path')
                                    } `}
                                    onPress={() =>
                                        navigation.navigate('PaymentPaths', {
                                            enhancedPath
                                        })
                                    }
                                    secondary
                                    buttonStyle={{ height: 40, width: '100%' }}
                                    containerStyle={{
                                        maxWidth: '45%',
                                        paddingRight: 5
                                    }}
                                />
                            )}
                            {noteKey && !error && !payment_error && (
                                <Button
                                    title={
                                        storedNotes
                                            ? localeString(
                                                  'views.SendingLightning.UpdateNote'
                                              )
                                            : localeString(
                                                  'views.SendingLightning.AddANote'
                                              )
                                    }
                                    onPress={() =>
                                        navigation.navigate('AddNotes', {
                                            noteKey
                                        })
                                    }
                                    secondary
                                    buttonStyle={{ height: 40, width: '100%' }}
                                    containerStyle={{
                                        maxWidth: paymentPathExists
                                            ? '45%'
                                            : '100%',
                                        paddingLeft: paymentPathExists ? 5 : 0
                                    }}
                                />
                            )}
                        </Row>

                        <View
                            style={[
                                styles.buttons,
                                !noteKey && { marginTop: 14 }
                            ]}
                        >
                            {(payment_error == 'FAILURE_REASON_NO_ROUTE' ||
                                payment_error ==
                                    localeString(
                                        'error.failureReasonNoRoute'
                                    )) && (
                                <Text
                                    style={{
                                        textAlign: 'center',
                                        color: 'white',
                                        fontFamily: 'PPNeueMontreal-Book',
                                        padding: 20,
                                        fontSize: 14
                                    }}
                                >
                                    {localeString(
                                        'views.SendingLightning.lowFeeLimitMessage'
                                    )}
                                </Text>
                            )}
                            {(!!payment_error || !!error) && (
                                <>
                                    <Button
                                        title={localeString(
                                            'views.SendingLightning.tryAgain'
                                        )}
                                        icon={{
                                            name: 'rotate-ccw',
                                            type: 'feather',
                                            size: 25
                                        }}
                                        onPress={() => navigation.goBack()}
                                        buttonStyle={{
                                            backgroundColor: 'white',
                                            height: 40
                                        }}
                                        containerStyle={{
                                            width: '100%',
                                            margin: 3
                                        }}
                                    />
                                    {implementation === 'embedded-lnd' && (
                                        <Button
                                            title={localeString(
                                                'views.Settings.EmbeddedNode.Troubleshooting.title'
                                            )}
                                            icon={{
                                                name: 'life-buoy',
                                                type: 'feather',
                                                size: 25
                                            }}
                                            onPress={() => {
                                                navigation.navigate(
                                                    'EmbeddedNodeTroubleshooting'
                                                );
                                            }}
                                            containerStyle={{
                                                width: '100%',
                                                margin: 3
                                            }}
                                            secondary
                                        />
                                    )}
                                </>
                            )}

                            {(!!error ||
                                !!payment_error ||
                                !!success ||
                                !!inTransit) && (
                                <Row
                                    align="flex-end"
                                    style={{
                                        alignSelf: 'center'
                                    }}
                                >
                                    <Button
                                        title={localeString(
                                            'views.SendingLightning.goToWallet'
                                        )}
                                        icon={
                                            isSwap
                                                ? undefined
                                                : {
                                                      name: 'list',
                                                      size: 25,
                                                      color: themeColor(
                                                          'background'
                                                      )
                                                  }
                                        }
                                        onPress={() => {
                                            navigation.popTo('Wallet');
                                        }}
                                        buttonStyle={{
                                            height: 40,
                                            width: '100%'
                                        }}
                                        titleStyle={{
                                            color: themeColor('background')
                                        }}
                                        containerStyle={{
                                            maxWidth: isSwap ? '45%' : '100%',
                                            paddingRight: isSwap ? 5 : 0,
                                            margin: 3
                                        }}
                                    />
                                    {isSwap && (
                                        <Button
                                            title={localeString(
                                                'views.Sending.goToSwap'
                                            )}
                                            titleStyle={{
                                                color: themeColor('background')
                                            }}
                                            containerStyle={{
                                                maxWidth: '45%',
                                                paddingLeft: isSwap ? 5 : 0
                                            }}
                                            onPress={() =>
                                                navigation.popTo(
                                                    'SwapDetails',
                                                    { ...isSwap.params }
                                                )
                                            }
                                            buttonStyle={{
                                                height: 40,
                                                width: '100%'
                                            }}
                                            tertiary
                                        />
                                    )}
                                </Row>
                            )}
                        </View>
                    </>
                )}
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'space-evenly',
        height: '100%'
    },
    buttons: {
        width: '100%',
        justifyContent: 'space-between',
        gap: 15,
        bottom: 15
    }
});
