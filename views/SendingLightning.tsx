import * as React from 'react';
import EncryptedStorage from 'react-native-encrypted-storage';

import {
    BackHandler,
    Dimensions,
    Image,
    NativeEventSubscription,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { inject, observer } from 'mobx-react';
import LnurlPaySuccess from './LnurlPay/Success';

import Button from '../components/Button';
import LightningLoadingPattern from '../components/LightningLoadingPattern';
import PaidIndicator from '../components/PaidIndicator';
import Screen from '../components/Screen';

import TransactionsStore from '../stores/TransactionsStore';
import LnurlPayStore from '../stores/LnurlPayStore';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import Clock from '../assets/images/SVG/Clock.svg';
import Error from '../assets/images/SVG/Error.svg';
import Success from '../assets/images/GIF/Success.gif';
import Wordmark from '../assets/images/SVG/wordmark-black.svg';
import CopyBox from '../components/CopyBox';

interface SendingLightningProps {
    navigation: any;
    TransactionsStore: TransactionsStore;
    LnurlPayStore: LnurlPayStore;
}

@inject('TransactionsStore', 'LnurlPayStore')
@observer
export default class SendingLightning extends React.Component<
    SendingLightningProps,
    {}
> {
    private backPressSubscription: NativeEventSubscription;

    state = {
        storedNotes: ''
    };
    componentDidMount() {
        const { TransactionsStore, navigation } = this.props;

        navigation.addListener('didFocus', () => {
            const noteKey =
                typeof TransactionsStore.payment_hash === 'string'
                    ? TransactionsStore.payment_hash
                    : typeof TransactionsStore.payment_preimage === 'string'
                    ? TransactionsStore.payment_preimage
                    : null;
            EncryptedStorage.getItem('note-' + noteKey)
                .then((storedNotes) => {
                    this.setState({ storedNotes });
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
        const { TransactionsStore, navigation } = this.props;
        if (
            !TransactionsStore.error &&
            (this.successfullySent(TransactionsStore) ||
                this.inTransit(TransactionsStore))
        ) {
            navigation.navigate('Wallet');
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
            payment_error
        } = TransactionsStore;
        const { storedNotes } = this.state;

        const success = this.successfullySent(TransactionsStore);
        const inTransit = this.inTransit(TransactionsStore);
        const windowSize = Dimensions.get('window');

        const noteKey =
            typeof payment_hash === 'string'
                ? payment_hash
                : typeof payment_preimage === 'string'
                ? payment_preimage
                : null;

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
                                    <Image
                                        source={Success}
                                        style={{
                                            width: windowSize.width * 0.3,
                                            height: windowSize.width * 0.3
                                        }}
                                        resizeMode="cover"
                                    />
                                    <Text
                                        style={{
                                            color: themeColor('text'),
                                            paddingTop:
                                                windowSize.height * 0.03,
                                            fontFamily: 'PPNeueMontreal-Book',
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
                        {LnurlPayStore.isZaplocker && (!success || !!error) && (
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
                                        'views.SendingLightning.isZaplocker'
                                    )}
                                </Text>
                            </View>
                        )}
                        {(!!error || !!payment_error) &&
                            !LnurlPayStore.isZaplocker && (
                                <View style={{ alignItems: 'center' }}>
                                    <Error
                                        width={windowSize.height * 0.13}
                                        height={windowSize.height * 0.13}
                                    />
                                    <Text
                                        style={{
                                            color: '#FF9090',
                                            fontFamily: 'PPNeueMontreal-Book',
                                            fontSize: 32,
                                            marginTop: windowSize.height * 0.07
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
                                                    windowSize.height * 0.025
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
                        {!!payment_hash && !error && !payment_error && (
                            <View style={{ width: '90%' }}>
                                <CopyBox
                                    heading={localeString(
                                        'views.SendingLightning.paymentHash'
                                    )}
                                    headingCopied={`${localeString(
                                        'views.SendingLightning.paymentHash'
                                    )} ${localeString(
                                        'components.ExternalLinkModal.copied'
                                    )}`}
                                    theme="dark"
                                    URL={payment_hash}
                                />
                            </View>
                        )}
                        {
                            <View
                                style={[
                                    styles.buttons,
                                    !noteKey && { marginTop: 14 }
                                ]}
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
                                                payment_hash: noteKey
                                            })
                                        }
                                        secondary
                                        buttonStyle={{ height: 40 }}
                                    />
                                )}
                                {(payment_error == 'FAILURE_REASON_NO_ROUTE' ||
                                    payment_error ==
                                        localeString(
                                            'error.failureReasonNoRoute'
                                        )) && (
                                    <>
                                        <Text
                                            style={{
                                                textAlign: 'center',
                                                color: 'white',
                                                fontFamily:
                                                    'PPNeueMontreal-Book',
                                                padding: 20,
                                                fontSize: 14
                                            }}
                                        >
                                            {localeString(
                                                'views.SendingLightning.lowFeeLimitMessage'
                                            )}
                                        </Text>
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
                                    </>
                                )}
                                {(payment_error == 'FAILURE_REASON_TIMEOUT' ||
                                    payment_error ==
                                        localeString(
                                            'error.failureReasonTimeout'
                                        )) && (
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
                                            navigation.navigate('Wallet', {
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
                        }
                    </View>
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
        alignItems: 'center',
        justifyContent: 'space-evenly',
        height: '100%'
    },
    buttons: {
        width: '100%',
        justifyContent: 'space-between',
        gap: 15
    }
});
