import * as React from 'react';
import {
    BackHandler,
    Dimensions,
    NativeEventSubscription,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import { Route } from '@react-navigation/native';
import ReactNativeBlobUtil from 'react-native-blob-util';

import LnurlPaySuccess from '../LnurlPay/Success';

import Button from '../../components/Button';
import LightningLoadingPattern from '../../components/LightningLoadingPattern';
import PaidIndicator from '../../components/PaidIndicator';
import Screen from '../../components/Screen';
import SuccessAnimation from '../../components/SuccessAnimation';
import { Row } from '../../components/layout/Row';

import CashuStore from '../../stores/CashuStore';
import LnurlPayStore from '../../stores/LnurlPayStore';
import PaymentsStore from '../../stores/PaymentsStore';
import SettingsStore from '../../stores/SettingsStore';
import TransactionsStore from '../../stores/TransactionsStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import UrlUtils from '../../utils/UrlUtils';

import Storage from '../../storage';

import Clock from '../../assets/images/SVG/Clock.svg';
import ErrorIcon from '../../assets/images/SVG/ErrorIcon.svg';
import Wordmark from '../../assets/images/SVG/wordmark-black.svg';
import Gift from '../../assets/images/SVG/gift.svg';

import CopyBox from '../../components/CopyBox';
import KeyValue from '../../components/KeyValue';
import Amount from '../../components/Amount';
import ModalBox from '../../components/ModalBox';
import LoadingIndicator from '../../components/LoadingIndicator';

interface CashuSendingLightningProps {
    navigation: StackNavigationProp<any, any>;
    CashuStore: CashuStore;
    LnurlPayStore: LnurlPayStore;
    PaymentsStore: PaymentsStore;
    SettingsStore: SettingsStore;
    TransactionsStore: TransactionsStore;
    route: Route<
        'CashuSendingLightning',
        {
            donationAmount?: string;
            enableDonations: boolean;
        }
    >;
}

interface CashuSendingLightningState {
    storedNotes: string;
    wasSuccessful: boolean;
    paymentType: string;
    payingDonation: boolean;
    showDonationInfo: boolean;
    donationHandled: boolean;
    donationPreimage: string;
    amountDonated: number | null;
    donationFee: string;
    donationFeePercentage: string;
}

@inject('CashuStore', 'LnurlPayStore', 'PaymentsStore', 'TransactionsStore')
@observer
export default class CashuSendingLightning extends React.Component<
    CashuSendingLightningProps,
    CashuSendingLightningState
> {
    private backPressSubscription: NativeEventSubscription;

    constructor(props: CashuSendingLightningProps) {
        super(props);
        this.state = {
            storedNotes: '',
            payingDonation: false,
            showDonationInfo: false,
            donationHandled: false,
            donationPreimage: '',
            amountDonated: null,
            wasSuccessful: false,
            paymentType: 'main',
            donationFee: '',
            donationFeePercentage: ''
        };
    }

    componentDidMount() {
        const { CashuStore, navigation } = this.props;

        navigation.addListener('focus', () => {
            const noteKey: string = CashuStore.noteKey!!;
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

    componentDidUpdate() {
        const { CashuStore, TransactionsStore, route } = this.props;
        const { donationIsPaid } = TransactionsStore;
        const { donationAmount, enableDonations } = route.params;

        const wasSuccessful = this.successfullySent(CashuStore);

        if (wasSuccessful && !this.state.wasSuccessful) {
            this.setState({ wasSuccessful: true });
        } else if (!wasSuccessful && this.state.wasSuccessful) {
            this.setState({ wasSuccessful: false });
        }

        if (
            wasSuccessful &&
            !this.state.wasSuccessful &&
            enableDonations &&
            donationAmount &&
            !donationIsPaid &&
            !this.state.payingDonation
        ) {
            this.setState(
                {
                    payingDonation: true,
                    paymentType: 'donation'
                },
                () => {
                    this.loadLnurl()
                        .then(async (payment_request) => {
                            if (!payment_request) {
                                this.setState({ payingDonation: false });
                                return;
                            }

                            console.log(
                                'Initiating donation payment with amount:',
                                donationAmount
                            );
                            try {
                                const isDonationPayment = true;

                                await new Promise((resolve) =>
                                    setTimeout(resolve, 1000)
                                );

                                await CashuStore.getPayReq(
                                    payment_request,
                                    isDonationPayment
                                );

                                const donationPayment =
                                    await CashuStore.payLnInvoiceFromEcash({
                                        amount: donationAmount.toString(),
                                        isDonationPayment
                                    });

                                if (
                                    donationPayment &&
                                    'donationError' in donationPayment
                                ) {
                                    console.log(
                                        'Response from donation payment:',
                                        donationPayment.donationError
                                    );
                                    return;
                                }

                                console.log(
                                    'Donation payment successful:',
                                    donationPayment
                                );

                                TransactionsStore.donationIsPaid = true;
                            } catch (error) {
                                console.error(
                                    'Failed to pay donation invoice:',
                                    error
                                );
                            } finally {
                                this.setState({ payingDonation: false });
                            }
                        })
                        .catch((err) => {
                            console.error('Unexpected error:', err);
                            this.setState({ payingDonation: false });
                        });
                }
            );
        } else if (!enableDonations || donationIsPaid) {
        }
    }

    loadLnurl = async () => {
        const donationAddress = 'test2@testnet.demo.btcpayserver.org';
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
            amountDonated,
            donationFee,
            donationFeePercentage
        } = this.state;

        const amountLabel = `${amountDonated} ${
            amountDonated === 1 ? 'sat' : 'sats'
        }`;

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
                            containerStyle={{
                                marginTop: 18
                            }}
                            tertiary
                        />
                    </View>
                </View>
            </ModalBox>
        );
    };

    private handleBackPress(): boolean {
        const { CashuStore, navigation } = this.props;
        if (!CashuStore.error && this.successfullySent(CashuStore)) {
            navigation.popTo('Wallet');
            return true;
        }
        return false;
    }

    componentWillUnmount(): void {
        this.backPressSubscription?.remove();
    }

    private successfullySent(cashuStore: CashuStore): boolean {
        return !!cashuStore.paymentPreimage;
    }

    render() {
        const { CashuStore, LnurlPayStore, navigation } = this.props;
        const {
            loading,
            paymentError,
            error_msg,
            payReq,
            paymentPreimage,
            paymentErrorMsg,
            noteKey,
            paymentDuration
        } = CashuStore;
        const payment_hash = payReq && payReq.payment_hash;
        const { storedNotes, donationHandled, paymentType, payingDonation } =
            this.state;

        const success = this.successfullySent(CashuStore);
        const windowSize = Dimensions.get('window');

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
                            {!paymentError && (
                                <Wordmark
                                    height={windowSize.width * 0.25}
                                    width={windowSize.width}
                                    fill={themeColor('highlight')}
                                />
                            )}
                            {!paymentError && (
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
                                        {paymentDuration !== undefined && (
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
                                                {`${localeString(
                                                    'views.SendingLightning.paymentDuration'
                                                )} ${paymentDuration.toFixed(
                                                    2
                                                )} ${localeString(
                                                    'models.Invoice.seconds'
                                                )}`}
                                            </Text>
                                        )}
                                    </View>
                                </>
                            )}
                            {LnurlPayStore.isZaplocker &&
                                (!success || !!paymentError) && (
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
                            {(!!paymentError || !!paymentErrorMsg) &&
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
                                        {(paymentErrorMsg || error_msg) && (
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
                                                {paymentErrorMsg || error_msg}
                                            </Text>
                                        )}
                                    </View>
                                )}
                            {!paymentError &&
                                !!paymentPreimage &&
                                payment_hash === LnurlPayStore.paymentHash &&
                                LnurlPayStore.successAction && (
                                    <View style={{ width: '90%' }}>
                                        <LnurlPaySuccess
                                            color="white"
                                            domain={LnurlPayStore.domain}
                                            successAction={
                                                LnurlPayStore.successAction
                                            }
                                            preimage={paymentPreimage}
                                            scrollable={true}
                                            maxHeight={windowSize.height * 0.15}
                                        />
                                    </View>
                                )}
                            {!!paymentPreimage &&
                                !paymentError &&
                                !paymentErrorMsg && (
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
                                            URL={paymentPreimage}
                                        />
                                    </View>
                                )}
                        </View>

                        <Row
                            align="flex-end"
                            style={{
                                bottom: 25,
                                alignSelf: 'center'
                            }}
                        >
                            {noteKey && !paymentError && !paymentErrorMsg && (
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
                                        maxWidth: '100%',
                                        margin: 10
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
                            {(paymentErrorMsg == 'FAILURE_REASON_NO_ROUTE' ||
                                paymentErrorMsg ==
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
                            {(!!paymentErrorMsg || !!paymentError) && (
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
                                    <Button
                                        title={localeString(
                                            'views.Settings.Ecash.cashuTroubleshooting'
                                        )}
                                        icon={{
                                            name: 'help-buoy-outline',
                                            type: 'ionicon',
                                            size: 25
                                        }}
                                        onPress={() => {
                                            UrlUtils.goToUrl(
                                                'https://docs.zeusln.app/cashu#i-get-an-error-saying-outputs-have-already-been-signed-before-or-already-spent-what-should-i-do'
                                            );
                                        }}
                                        containerStyle={{
                                            width: '100%',
                                            margin: 3
                                        }}
                                        secondary
                                    />
                                </>
                            )}

                            <Button
                                title={localeString(
                                    'views.SendingLightning.goToWallet'
                                )}
                                icon={{
                                    name: 'list',
                                    size: 25,
                                    color: themeColor('background')
                                }}
                                onPress={() => {
                                    navigation.popTo('Wallet');
                                }}
                                buttonStyle={{ height: 40 }}
                                titleStyle={{
                                    color: themeColor('background')
                                }}
                                containerStyle={{ width: '100%', margin: 3 }}
                            />
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
