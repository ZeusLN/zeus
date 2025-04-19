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

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import Storage from '../../storage';

import Clock from '../../assets/images/SVG/Clock.svg';
import ErrorIcon from '../../assets/images/SVG/ErrorIcon.svg';
import Wordmark from '../../assets/images/SVG/wordmark-black.svg';
import CopyBox from '../../components/CopyBox';

interface CashuSendingLightningProps {
    navigation: StackNavigationProp<any, any>;
    CashuStore: CashuStore;
    LnurlPayStore: LnurlPayStore;
    PaymentsStore: PaymentsStore;
    SettingsStore: SettingsStore;
}

interface CashuSendingLightningState {
    storedNotes: string;
}

@inject('CashuStore', 'LnurlPayStore', 'PaymentsStore')
@observer
export default class CashuSendingLightning extends React.Component<
    CashuSendingLightningProps,
    CashuSendingLightningState
> {
    private backPressSubscription: NativeEventSubscription;

    constructor(props: CashuSendingLightningProps) {
        super(props);
        this.state = {
            storedNotes: ''
        };
    }

    componentDidMount() {
        const { CashuStore, navigation } = this.props;

        navigation.addListener('focus', () => {
            const noteKey: string = CashuStore.noteKey!!;
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
            noteKey
        } = CashuStore;
        const payment_hash = payReq && payReq.payment_hash;
        const { storedNotes } = this.state;

        const success = this.successfullySent(CashuStore);
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
                                containerStyle={{ width: '100%' }}
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
