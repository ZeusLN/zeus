import * as React from 'react';
import {
    BackHandler,
    Dimensions,
    NativeEventSubscription,
    StyleSheet,
    Text,
    View,
    Modal,
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

import BalanceStore from '../stores/BalanceStore';
import LnurlPayStore from '../stores/LnurlPayStore';
import PaymentsStore from '../stores/PaymentsStore';
import SettingsStore from '../stores/SettingsStore';
import TransactionsStore from '../stores/TransactionsStore';

import Base64Utils from '../utils/Base64Utils';
import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import Storage from '../storage';

import Clock from '../assets/images/SVG/Clock.svg';
import ErrorIcon from '../assets/images/SVG/ErrorIcon.svg';
import Wordmark from '../assets/images/SVG/wordmark-black.svg';
import Gift from '../assets/images/SVG/gift.svg';
import CopyBox from '../components/CopyBox';
import LoadingIndicator from '../components/LoadingIndicator';

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
}

@inject(
    'BalanceStore',
    'LnurlPayStore',
    'PaymentsStore',
    'SettingsStore',
    'TransactionsStore'
)
@observer
export default class SendingLightning extends React.Component<
    SendingLightningProps,
    SendingLightningState
> {
    private backPressSubscription: NativeEventSubscription;

    constructor(props: SendingLightningProps) {
        super(props);
        this.state = {
            storedNotes: '',
            currentPayment: null,
            wasSuccessful: false,
            payingDonation: false,
            showDonationInfo: false,
            donationHandled: true,
            donationPreimage: '',
            amountDonated: null,
            paymentType: 'main'
        };
    }

    componentDidMount() {
        const { TransactionsStore, navigation } = this.props;

        navigation.addListener('focus', () => {
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
        const { TransactionsStore, BalanceStore, route } = this.props;
        const wasSuccessful = this.successfullySent(TransactionsStore);
        const { donationAmount, enableDonations } = route.params;

        if (wasSuccessful && !this.state.wasSuccessful) {
            this.fetchPayments();
            this.setState({ wasSuccessful: true }); // Update success state
            BalanceStore.getCombinedBalance();
        } else if (!wasSuccessful && this.state.wasSuccessful) {
            this.setState({ wasSuccessful: false }); // Reset success state if needed
        }

        if (wasSuccessful && !this.state.wasSuccessful && enableDonations) {
            this.setState(
                {
                    payingDonation: true,
                    paymentType: 'donation'
                },
                () => {
                    this.loadLnurl()
                        .then(async (payment_request) => {
                            if (payment_request) {
                                try {
                                    const result =
                                        await TransactionsStore.sendPaymentSilently(
                                            {
                                                payment_request,
                                                amount: donationAmount ?? ''
                                            }
                                        );
                                    console.log('Donation successful:', result);

                                    let payment_preimage;

                                    const preimage = result?.payment_preimage;
                                    const amountDonated = result?.num_satoshis;

                                    if (preimage) {
                                        if (
                                            typeof preimage !== 'string' &&
                                            preimage.data
                                        ) {
                                            payment_preimage =
                                                Base64Utils.bytesToHex(
                                                    preimage.data
                                                );
                                        } else if (
                                            typeof preimage === 'string'
                                        ) {
                                            payment_preimage = preimage;
                                        }
                                    }

                                    this.setState({
                                        payingDonation: false,
                                        donationHandled: true,
                                        donationPreimage:
                                            payment_preimage || '',
                                        amountDonated
                                    });
                                } catch (err) {
                                    this.setState({
                                        payingDonation: false
                                    });
                                    console.log('Payment failed:', err);
                                }
                            } else {
                                console.log('Payment request not available');
                            }
                        })
                        .catch((err) => {
                            console.error('Unexpected error:', err);
                        });
                }
            );
        }
    }

    loadLnurl = async () => {
        const donationAddress = 'tips@pay.zeusln.app';
        const { route } = this.props;
        const { donationAmount } = route.params;

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
            amountDonated
        } = this.state;

        const amountLabel = `${amountDonated} ${
            amountDonated === 1 ? 'sat' : 'sats'
        }`;

        return (
            <Modal
                animationType="slide"
                transparent
                visible={showDonationInfo}
                onRequestClose={() =>
                    this.setState({ showDonationInfo: false })
                }
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
                                        fontSize: 18,
                                        marginBottom: 20,
                                        textAlign: 'center'
                                    }}
                                >
                                    {localeString(
                                        'views.PaymentRequest.thankYouForDonation'
                                    )}
                                </Text>
                                <View
                                    style={{ width: '100%', marginBottom: 10 }}
                                >
                                    <KeyValue
                                        keyValue={localeString(
                                            'views.PaymentRequest.amountDonated'
                                        )}
                                        value={
                                            <Amount
                                                sats={amountDonated?.toString()}
                                                fixedUnits="sats"
                                            />
                                        }
                                    />
                                </View>

                                {donationPreimage && (
                                    <View
                                        style={{
                                            width: '100%',
                                            marginBottom: 20
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
                                Your attempt to donate to ZEUS with{' '}
                                {amountLabel} has failed.
                            </Text>
                        )}
                        <Button
                            title={localeString('general.close')}
                            onPress={() =>
                                this.setState({ showDonationInfo: false })
                            }
                            secondary
                        />
                    </View>
                </View>
            </Modal>
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
            noteKey
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
                {loading && (
                    <View
                        style={{
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%'
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
                            right: 10
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
                                            name: 'return-up-back',
                                            type: 'ionicon',
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
                                                name: 'help-buoy-outline',
                                                type: 'ionicon',
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
