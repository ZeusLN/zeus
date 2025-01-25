import * as React from 'react';
import {
    BackHandler,
    Dimensions,
    NativeEventSubscription,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import LnurlPaySuccess from './LnurlPay/Success';

import Button from '../components/Button';
import LightningLoadingPattern from '../components/LightningLoadingPattern';
import PaidIndicator from '../components/PaidIndicator';
import Screen from '../components/Screen';
import SuccessAnimation from '../components/SuccessAnimation';
import { Row } from '../components/layout/Row';

import TransactionsStore from '../stores/TransactionsStore';
import LnurlPayStore from '../stores/LnurlPayStore';
import PaymentsStore from '../stores/PaymentsStore';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import Storage from '../storage';

import Clock from '../assets/images/SVG/Clock.svg';
import ErrorIcon from '../assets/images/SVG/ErrorIcon.svg';
import Wordmark from '../assets/images/SVG/wordmark-black.svg';
import CopyBox from '../components/CopyBox';

interface SendingLightningProps {
    navigation: StackNavigationProp<any, any>;
    TransactionsStore: TransactionsStore;
    LnurlPayStore: LnurlPayStore;
    PaymentsStore: PaymentsStore;
}

interface SendingLightningState {
    storedNotes: string;
    wasSuccessful: boolean;
    currentPayment: any;
}

@inject('TransactionsStore', 'LnurlPayStore', 'PaymentsStore')
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
            wasSuccessful: false
        };
    }

    componentDidMount() {
        const { TransactionsStore, navigation } = this.props;

        navigation.addListener('focus', () => {
            const noteKey: string = TransactionsStore.noteKey;
            if (!noteKey) return;
            Storage.getItem(noteKey)
                .then((storedNotes) => {
                    this.setState({ storedNotes: storedNotes || '' });
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
        const { TransactionsStore } = this.props;
        const wasSuccessful = this.successfullySent(TransactionsStore);

        if (wasSuccessful && !this.state.wasSuccessful) {
            this.fetchPayments();
            this.setState({ wasSuccessful: true }); // Update success state
        } else if (!wasSuccessful && this.state.wasSuccessful) {
            this.setState({ wasSuccessful: false }); // Reset success state if needed
        }
    }

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
        const { TransactionsStore, LnurlPayStore, navigation } = this.props;
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
        const { storedNotes, currentPayment } = this.state;

        const enhancedPath = currentPayment?.enhancedPath;

        const paymentPathExists =
            enhancedPath?.length > 0 && enhancedPath[0][0];

        const success = this.successfullySent(TransactionsStore);
        const inTransit = this.inTransit(TransactionsStore);
        const windowSize = Dimensions.get('window');

        return (
            <Screen>
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
                                marginLeft: paymentPathExists ? 10 : 0,
                                marginRight: paymentPathExists ? 10 : 0,
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
                                        margin: 10
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
                                        margin: 10
                                    }}
                                />
                            )}

                            {(!!error ||
                                !!payment_error ||
                                !!success ||
                                !!inTransit) && (
                                <Button
                                    title={localeString(
                                        'views.SendingLightning.goToWallet'
                                    )}
                                    icon={{
                                        name: 'list',
                                        size: 25,
                                        color: themeColor('background')
                                    }}
                                    onPress={() =>
                                        navigation.popTo('Wallet', {
                                            refresh: true
                                        })
                                    }
                                    buttonStyle={{ height: 40 }}
                                    titleStyle={{
                                        color: themeColor('background')
                                    }}
                                    containerStyle={{ width: '100%' }}
                                />
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
