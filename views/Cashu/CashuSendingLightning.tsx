import * as React from 'react';
import {
    BackHandler,
    Dimensions,
    InteractionManager,
    NativeEventSubscription,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import { Route } from '@react-navigation/native';
import { loadDonationLnurl } from '../../utils/LnurlUtils';

import LnurlPaySuccess from '../LnurlPay/Success';

import Button from '../../components/Button';
import Screen from '../../components/Screen';
import { Row } from '../../components/layout/Row';
import PaymentSuccessView from '../../components/PaymentSuccessView';
import PaymentErrorView from '../../components/PaymentErrorView';
import DonationInfoModal from '../../components/DonationInfoModal';
import SendingLoadingView from '../../components/SendingLoadingView';
import DonationGiftIcon from '../../components/DonationGiftIcon';
import LightningLoadingPattern from '../../components/LightningLoadingPattern';
import { sendingStyles } from '../../components/sendingStyles';

import CashuStore from '../../stores/CashuStore';
import ContactStore from '../../stores/ContactStore';
import LnurlPayStore from '../../stores/LnurlPayStore';
import SettingsStore from '../../stores/SettingsStore';
import NodeInfoStore from '../../stores/NodeInfoStore';

import ContactUtils from '../../utils/ContactUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import UrlUtils from '../../utils/UrlUtils';

import Storage from '../../storage';

import Clock from '../../assets/images/SVG/Clock.svg';
import Wordmark from '../../assets/images/SVG/wordmark-black.svg';

import ModalBox from '../../components/ModalBox';
import Header from '../../components/Header';
import PaymentDetailsSheet from '../../components/PaymentDetailsSheet';

interface CashuSendingLightningProps {
    navigation: StackNavigationProp<any, any>;
    CashuStore: CashuStore;
    ContactStore: ContactStore;
    LnurlPayStore: LnurlPayStore;
    SettingsStore: SettingsStore;
    NodeInfoStore: NodeInfoStore;
    route: Route<
        'CashuSendingLightning',
        {
            donationAmount?: string;
            enableDonations: boolean;
            paymentAmount?: string;
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
    donationIsPaid: boolean;
    showZaplockerWarning: boolean;
    showPaymentDetails: boolean;
}

@inject('CashuStore', 'ContactStore', 'LnurlPayStore', 'NodeInfoStore')
@observer
export default class CashuSendingLightning extends React.Component<
    CashuSendingLightningProps,
    CashuSendingLightningState
> {
    private backPressSubscription: NativeEventSubscription;

    private focusListener: (() => void) | undefined;

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
            donationIsPaid: false,
            showZaplockerWarning: false,
            showPaymentDetails: false
        };
    }

    componentDidMount() {
        const { CashuStore, navigation, route } = this.props;
        const { paymentAmount } = route.params || {};

        // Reset payment state and start payment after navigation completes
        CashuStore.resetPaymentState();
        InteractionManager.runAfterInteractions(() => {
            CashuStore.payLnInvoiceFromEcash({
                amount: paymentAmount
            });
        });

        this.focusListener = navigation.addListener('focus', () => {
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
        const { CashuStore, NodeInfoStore, route } = this.props;
        const { donationIsPaid } = this.state;
        const { donationAmount, enableDonations } = route.params;

        const wasSuccessful = this.successfullySent(CashuStore);

        if (wasSuccessful && !this.state.wasSuccessful) {
            this.setState({ wasSuccessful: true });
        } else if (!wasSuccessful && this.state.wasSuccessful) {
            this.setState({ wasSuccessful: false });
        }

        if (
            NodeInfoStore!.nodeInfo.isMainNet &&
            wasSuccessful &&
            !this.state.wasSuccessful &&
            enableDonations &&
            donationAmount &&
            !donationIsPaid
        ) {
            this.handleDonationPayment(donationAmount);
        }
    }

    handleDonationPayment = async (donationAmount: string) => {
        const { CashuStore } = this.props;
        this.setState({ payingDonation: true, paymentType: 'donation' });

        try {
            const paymentRequest = await loadDonationLnurl(donationAmount);
            if (!paymentRequest) {
                this.setState({ payingDonation: false });
                return;
            }

            if (__DEV__) {
                console.log(
                    'Initiating donation payment with amount:',
                    donationAmount
                );
            }
            const isDonationPayment = true;
            await CashuStore.getPayReq(paymentRequest, isDonationPayment);

            const donationPayment = await CashuStore.payLnInvoiceFromEcash({
                amount: donationAmount.toString(),
                isDonationPayment
            });

            if (
                !donationPayment ||
                donationPayment?.meltResponse?.quote?.state !== 'PAID'
            ) {
                console.log('Donation payment failed.');
                this.setState({ donationHandled: false });
                return;
            }

            const amountDonated = donationPayment?.amount;
            const paymentPreimage = donationPayment?.payment_preimage;

            this.setState({
                donationHandled: true,
                donationIsPaid: true,
                amountDonated: parseFloat(amountDonated?.toString() || '0'),
                donationPreimage: paymentPreimage || ''
            });
        } catch (error) {
            console.error('Failed to pay donation invoice:', error);
            this.setState({ donationHandled: false });
        } finally {
            this.setState({ payingDonation: false });
        }
    };

    renderZaplockerWarningModal = () => {
        const { showZaplockerWarning } = this.state;

        return (
            <ModalBox
                isOpen={showZaplockerWarning}
                style={{
                    backgroundColor: 'transparent'
                }}
                onClosed={() => {
                    this.setState({
                        showZaplockerWarning: false
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
                        <Text
                            style={{
                                fontFamily: 'PPNeueMontreal-Book',
                                color: themeColor('text'),
                                fontSize: 18,
                                marginBottom: 20,
                                textAlign: 'center'
                            }}
                        >
                            {localeString('views.SendingLightning.isZaplocker')}
                        </Text>

                        <Button
                            title={localeString('general.close')}
                            onPress={() =>
                                this.setState({ showZaplockerWarning: false })
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
        if (this.focusListener) {
            this.focusListener();
        }
        this.backPressSubscription?.remove();
    }

    private successfullySent(cashuStore: CashuStore): boolean {
        return !!cashuStore.paymentSuccess;
    }

    render() {
        const { CashuStore, ContactStore, LnurlPayStore, navigation } =
            this.props;
        const {
            loading,
            paymentError,
            paymentSuccess,
            error_msg,
            payReq,
            paymentPreimage,
            paymentErrorMsg,
            noteKey,
            paymentDuration,
            paymentFee
        } = CashuStore;
        const payment_hash = payReq && payReq.payment_hash;
        const paymentAmount = payReq?.getRequestAmount;
        const {
            storedNotes,
            donationHandled,
            paymentType,
            payingDonation,
            showPaymentDetails
        } = this.state;

        const lightningAddress = LnurlPayStore.lightningAddress;
        const matchedContact = ContactUtils.findContactByLightningAddress(
            lightningAddress,
            ContactStore?.contacts
        );

        const success = this.successfullySent(CashuStore);
        const windowSize = Dimensions.get('window');

        // Show loading animation until we have a result (success or error)
        const showLoading = !paymentSuccess && !paymentError;

        if (showLoading) {
            return (
                <Screen>
                    <View
                        style={{
                            flex: 1,
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <LightningLoadingPattern />
                        <Text
                            style={{
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book',
                                paddingBottom: windowSize.height / 10,
                                fontSize:
                                    windowSize.width * windowSize.scale * 0.014
                            }}
                        >
                            {localeString('views.SendingLightning.sending')}
                        </Text>
                    </View>
                </Screen>
            );
        }

        return (
            <Screen>
                {!loading && (
                    <Header
                        rightComponent={
                            LnurlPayStore.isZaplocker &&
                            (!success || !!paymentError) ? (
                                <TouchableOpacity
                                    onPress={() =>
                                        this.setState({
                                            showZaplockerWarning: true
                                        })
                                    }
                                >
                                    <Clock color={themeColor('bitcoin')} />
                                </TouchableOpacity>
                            ) : (
                                <></>
                            )
                        }
                    />
                )}
                {this.renderZaplockerWarningModal()}
                <DonationInfoModal
                    isOpen={this.state.showDonationInfo}
                    onClose={() => this.setState({ showDonationInfo: false })}
                    donationHandled={donationHandled}
                    amountDonated={this.state.amountDonated}
                    donationPreimage={this.state.donationPreimage}
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
                            {!paymentError && (
                                <Wordmark
                                    height={windowSize.width * 0.25}
                                    width={windowSize.width}
                                    fill={themeColor('highlight')}
                                />
                            )}
                            {!paymentError && (
                                <PaymentSuccessView
                                    paymentAmount={paymentAmount}
                                    feeAmount={paymentFee}
                                    paymentDuration={paymentDuration}
                                />
                            )}
                            {(!!paymentError || !!paymentErrorMsg) &&
                                !LnurlPayStore.isZaplocker && (
                                    <PaymentErrorView
                                        errorMessage={
                                            paymentErrorMsg || error_msg
                                        }
                                    />
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
                        </View>

                        {!!success && !paymentError && !paymentErrorMsg && (
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
                                feeAmount={paymentFee}
                                paymentDuration={paymentDuration}
                                memo={payReq?.getMemo}
                                contact={matchedContact}
                                lightningAddress={lightningAddress}
                                paymentHash={payment_hash}
                                paymentPreimage={paymentPreimage}
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
                                    <Button
                                        title={localeString(
                                            'views.Settings.Ecash.cashuTroubleshooting'
                                        )}
                                        icon={{
                                            name: 'life-buoy',
                                            type: 'feather',
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
