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
import SettingsStore from '../../stores/SettingsStore';
import NodeInfoStore from '../../stores/NodeInfoStore';

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
import RatingModal from '../../components/Modals/RatingModal';
import LoadingIndicator from '../../components/LoadingIndicator';
import Header from '../../components/Header';

interface CashuSendingLightningProps {
    navigation: StackNavigationProp<any, any>;
    CashuStore: CashuStore;
    LnurlPayStore: LnurlPayStore;
    SettingsStore: SettingsStore;
    NodeInfoStore: NodeInfoStore;
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
    donationIsPaid: boolean;
    showZaplockerWarning: boolean;
}

@inject('CashuStore', 'LnurlPayStore', 'NodeInfoStore')
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
            donationIsPaid: false,
            showZaplockerWarning: false
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
            const paymentRequest = await this.loadLnurl(donationAmount);
            if (!paymentRequest) {
                this.setState({ payingDonation: false });
                return;
            }

            console.log(
                'Initiating donation payment with amount:',
                donationAmount
            );
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

    loadLnurl = async (donationAmount: string) => {
        const donationAddress = 'tips@pay.zeusln.app';
        const [username, bolt11Domain] = donationAddress.split('@');
        const url = bolt11Domain.includes('.onion')
            ? `http://${bolt11Domain}/.well-known/lnurlp/${username.toLowerCase()}`
            : `https://${bolt11Domain}/.well-known/lnurlp/${username.toLowerCase()}`;

        try {
            const response = await ReactNativeBlobUtil.fetch('GET', url);
            const lnurlData = response.json();
            const amount = parseFloat(donationAmount) * 1000;
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
            donationHandled,
            amountDonated,
            donationPreimage
        } = this.state;

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
                                {donationPreimage && (
                                    <View
                                        style={{
                                            width: '100%',
                                            marginTop: 16
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
                                marginTop: 18
                            }}
                            tertiary
                        />
                    </View>
                </View>
            </ModalBox>
        );
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
