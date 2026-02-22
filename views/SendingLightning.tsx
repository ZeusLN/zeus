import * as React from 'react';
import {
    BackHandler,
    Dimensions,
    NativeEventSubscription,
    Text,
    View
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import { Route } from '@react-navigation/native';
import { getRouteStack } from '../NavigationService';

import { loadDonationLnurl } from '../utils/LnurlUtils';

import LnurlPaySuccess from './LnurlPay/Success';

import Button from '../components/Button';
import Screen from '../components/Screen';
import { Row } from '../components/layout/Row';
import PaymentSuccessView from '../components/PaymentSuccessView';
import PaymentErrorView from '../components/PaymentErrorView';
import DonationInfoModal from '../components/DonationInfoModal';
import SendingLoadingView from '../components/SendingLoadingView';
import DonationGiftIcon from '../components/DonationGiftIcon';
import { sendingStyles } from '../components/sendingStyles';

import BalanceStore from '../stores/BalanceStore';
import ContactStore from '../stores/ContactStore';
import LnurlPayStore from '../stores/LnurlPayStore';
import PaymentsStore from '../stores/PaymentsStore';
import SettingsStore from '../stores/SettingsStore';
import TransactionsStore from '../stores/TransactionsStore';
import NodeInfoStore from '../stores/NodeInfoStore';

import Base64Utils from '../utils/Base64Utils';
import BackendUtils from '../utils/BackendUtils';
import ContactUtils from '../utils/ContactUtils';
import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import Storage from '../storage';

import Clock from '../assets/images/SVG/Clock.svg';
import Wordmark from '../assets/images/SVG/wordmark-black.svg';
import PaymentDetailsSheet from '../components/PaymentDetailsSheet';

import { getFeePercentage } from '../utils/AmountUtils';

interface SendingLightningProps {
    navigation: StackNavigationProp<any, any>;
    BalanceStore: BalanceStore;
    ContactStore: ContactStore;
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
    showPaymentDetails: boolean;
}

@inject(
    'BalanceStore',
    'ContactStore',
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

    private focusListener: (() => void) | undefined;

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
            donationFeePercentage: '',
            showPaymentDetails: false
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
            const paymentRequest = await loadDonationLnurl(donationAmount);
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

            const donationFeePercentage = getFeePercentage(
                donationFee,
                amountDonated
            );

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
        const {
            TransactionsStore,
            ContactStore,
            SettingsStore,
            LnurlPayStore,
            navigation
        } = this.props;
        const {
            loading,
            error,
            error_msg,
            payment_hash,
            payment_preimage,
            payment_fee,
            payment_error,
            noteKey,
            paymentDuration
        } = TransactionsStore;
        const { implementation } = SettingsStore;
        const {
            storedNotes,
            currentPayment,
            donationHandled,
            paymentType,
            payingDonation,
            showPaymentDetails
        } = this.state;

        const enhancedPath = currentPayment?.enhancedPath;
        const paymentAmount = currentPayment?.getAmount;
        const feeAmount = payment_fee || currentPayment?.getFee;

        const lightningAddress = LnurlPayStore.lightningAddress;
        const matchedContact = ContactUtils.findContactByLightningAddress(
            lightningAddress,
            ContactStore?.contacts
        );

        const success = this.successfullySent(TransactionsStore);
        const inTransit = this.inTransit(TransactionsStore);
        const windowSize = Dimensions.get('window');

        const stack = getRouteStack();
        const isSwap = stack.filter((route) => route.name === 'SwapDetails')[0];

        return (
            <Screen>
                <DonationInfoModal
                    isOpen={this.state.showDonationInfo}
                    onClose={() => this.setState({ showDonationInfo: false })}
                    donationHandled={donationHandled}
                    amountDonated={this.state.amountDonated}
                    donationPreimage={this.state.donationPreimage}
                    donationFee={this.state.donationFee}
                    donationFeePercentage={this.state.donationFeePercentage}
                    donationEnhancedPath={this.state.donationEnhancedPath}
                    donationPathExists={this.state.donationPathExists}
                    navigation={navigation}
                />
                {loading && <SendingLoadingView />}
                {paymentType === 'donation' && (
                    <DonationGiftIcon
                        payingDonation={payingDonation}
                        donationHandled={donationHandled}
                        onPress={() =>
                            this.setState({ showDonationInfo: true })
                        }
                    />
                )}

                {!loading && (
                    <>
                        <View
                            style={{
                                ...sendingStyles.content,
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
                                <PaymentSuccessView
                                    paymentAmount={paymentAmount}
                                    feeAmount={feeAmount}
                                    paymentDuration={paymentDuration}
                                />
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
                                    <PaymentErrorView
                                        errorMessage={
                                            payment_error || error_msg
                                        }
                                    />
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
                        </View>

                        {!!success && !error && !payment_error && (
                            <PaymentDetailsSheet
                                isOpen={showPaymentDetails}
                                onOpen={() =>
                                    this.setState({
                                        showPaymentDetails: true
                                    })
                                }
                                onClose={() =>
                                    this.setState({
                                        showPaymentDetails: false
                                    })
                                }
                                paymentAmount={paymentAmount}
                                feeAmount={feeAmount}
                                paymentDuration={paymentDuration}
                                memo={currentPayment?.getMemo}
                                contact={matchedContact}
                                lightningAddress={lightningAddress}
                                paymentHash={payment_hash}
                                paymentPreimage={payment_preimage || undefined}
                                enhancedPath={enhancedPath}
                                navigation={navigation}
                            />
                        )}

                        <Row
                            align="flex-end"
                            style={{
                                marginTop: 10,
                                marginBottom: 15,
                                alignSelf: 'center'
                            }}
                        >
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
                                        maxWidth: '100%'
                                    }}
                                />
                            )}
                        </Row>

                        <View
                            style={[
                                sendingStyles.buttons,
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
