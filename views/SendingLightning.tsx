import * as React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import LnurlPaySuccess from './LnurlPay/Success';

import Button from '../components/Button';
import LightningIndicator from '../components/LightningIndicator';
import PaidIndicator from '../components/PaidIndicator';
import Screen from '../components/Screen';

import TransactionsStore from '../stores/TransactionsStore';
import LnurlPayStore from '../stores/LnurlPayStore';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import Clock from '../assets/images/SVG/Clock.svg';
import Error from '../assets/images/SVG/Error.svg';
import Success from '../assets/images/GIF/Success.gif';
import WordLogo from '../assets/images/SVG/Word Logo.svg';
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
    render() {
        const { TransactionsStore, LnurlPayStore, navigation } = this.props;
        const {
            loading,
            error,
            error_msg,
            payment_hash,
            payment_route,
            payment_preimage,
            payment_error,
            status
        } = TransactionsStore;
        const success =
            payment_route || status === 'complete' || status === 'SUCCEEDED';

        const inTransit = status === 'IN_FLIGHT';

        return (
            <Screen>
                <ScrollView>
                    <View
                        style={{
                            ...styles.content
                        }}
                    >
                        {loading && <LightningIndicator />}
                        {loading && (
                            <Text
                                style={{
                                    color: themeColor('text'),
                                    fontFamily: 'Lato-Regular'
                                }}
                            >
                                {localeString('views.SendingLightning.sending')}
                            </Text>
                        )}
                        {(!!success || !!inTransit) && !error && (
                            <WordLogo
                                height={150}
                                style={{
                                    alignSelf: 'center'
                                }}
                            />
                        )}
                        {!!success && !error && (
                            <>
                                <Image
                                    source={Success}
                                    style={{
                                        width: 290,
                                        height: 290,
                                        marginTop: -50,
                                        marginBottom: -50
                                    }}
                                />
                                <PaidIndicator />
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
                                    width={180}
                                    height={180}
                                />
                                <Text
                                    style={{
                                        color: themeColor('text'),
                                        fontFamily: 'Lato-Regular',
                                        fontSize: 22,
                                        marginTop: 25
                                    }}
                                >
                                    {localeString(
                                        'views.SendingLightning.inTransit'
                                    )}
                                </Text>
                            </View>
                        )}
                        {(!!error || !!payment_error) && (
                            <>
                                <Error width="27%" />
                                <Text
                                    style={{
                                        color: '#FF9090',
                                        fontFamily: 'Lato-Regular',
                                        fontSize: 32
                                    }}
                                >
                                    {localeString('general.error')}
                                </Text>
                                <Text
                                    style={{
                                        color: themeColor('text'),
                                        fontFamily: 'Lato-Regular',
                                        padding: 20,
                                        marginBottom: 60,
                                        fontSize:
                                            (payment_error || error_msg || '')
                                                .length > 100
                                                ? 20
                                                : 24
                                    }}
                                >
                                    {payment_error || error_msg}
                                </Text>
                            </>
                        )}
                        {!!success && !error && (
                            <Text
                                style={{
                                    color: themeColor('text'),
                                    fontFamily: 'Lato-Regular',
                                    padding: 20,
                                    fontSize: 22
                                }}
                            >
                                {localeString('views.SendingLightning.success')}
                            </Text>
                        )}
                        {!!payment_preimage &&
                            payment_hash === LnurlPayStore.paymentHash &&
                            LnurlPayStore.successAction && (
                                <LnurlPaySuccess
                                    color="white"
                                    domain={LnurlPayStore.domain}
                                    successAction={LnurlPayStore.successAction}
                                    preimage={payment_preimage}
                                />
                            )}
                        {!!payment_hash && !(!!error || !!payment_error) && (
                            <View
                                style={{
                                    paddingTop: 20,
                                    paddingLeft: 50,
                                    paddingRight: 50
                                }}
                            >
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

                        <View style={styles.buttons}>
                            {payment_hash && !(!!error || !!payment_error) && (
                                <View
                                    style={{
                                        marginTop: 10,
                                        marginBottom: 10,
                                        width: '100%'
                                    }}
                                ></View>
                            )}

                            {payment_error == `FAILURE_REASON_NO_ROUTE` && (
                                <>
                                    <Text
                                        style={{
                                            textAlign: 'center',
                                            color: 'white',
                                            fontFamily: 'Lato-Regular',
                                            marginTop: 50,
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
                                            backgroundColor: 'white'
                                        }}
                                        containerStyle={{
                                            width: '100%',
                                            margin: 10
                                        }}
                                    />
                                </>
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
                                    titleStyle={{
                                        color: themeColor('background')
                                    }}
                                    containerStyle={{ width: '100%' }}
                                />
                            )}
                        </View>
                    </View>
                </ScrollView>
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
        justifyContent: 'center',
        paddingTop: 125
    },
    buttons: {
        flex: 1,
        justifyContent: 'flex-end',
        marginBottom: 35,
        width: '100%'
    }
});
