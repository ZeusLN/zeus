import * as React from 'react';
import { Image, StyleSheet, Text, View, ScrollView } from 'react-native';
import { inject, observer } from 'mobx-react';
import LnurlPaySuccess from './LnurlPay/Success';

import Button from './../components/Button';
import CopyButton from './../components/CopyButton';
import LoadingIndicator from './../components/LoadingIndicator';

import TransactionsStore from './../stores/TransactionsStore';
import LnurlPayStore from './../stores/LnurlPayStore';

import { localeString } from './../utils/LocaleUtils';
import { themeColor } from './../utils/ThemeUtils';

import Success from './../images/GIF/Success.gif';
import WordLogo from './../images/SVG/Word Logo.svg';

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
    getBackgroundColor() {
        const { TransactionsStore } = this.props;
        const { payment_route, payment_error, status, error } =
            TransactionsStore;

        if (error) {
            return 'darkred';
        } else if (
            payment_route ||
            status === 'complete' ||
            status === 'SUCCEEDED'
        ) {
            return themeColor('background');
        } else if (payment_error && payment_error != '') {
            return 'lightcoral';
        }

        return themeColor('background');
    }

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
        const backgroundColor = this.getBackgroundColor();
        const success =
            payment_route || status === 'complete' || status === 'SUCCEEDED';

        return (
            <View
                style={{
                    ...styles.container,
                    backgroundColor
                }}
            >
                <View
                    style={{
                        ...styles.content
                    }}
                >
                    {loading && <LoadingIndicator />}
                    {loading && (
                        <Text
                            style={{
                                color: themeColor('text')
                            }}
                        >
                            {localeString('views.SendingLightning.sending')}
                        </Text>
                    )}
                    {!!success && !error && (
                        <>
                            <WordLogo
                                height={150}
                                style={{
                                    alignSelf: 'center'
                                }}
                            />
                            <Image
                                source={Success}
                                style={{
                                    width: 290,
                                    height: 290,
                                    marginTop: -50,
                                    marginBottom: -50
                                }}
                            />
                        </>
                    )}
                    {(!!error || !!payment_error) && (
                        <Text
                            style={{
                                color: 'white',
                                marginTop: 70,
                                padding: 20,
                                fontSize:
                                    (payment_error || error_msg || '').length >
                                    100
                                        ? 20
                                        : 28
                            }}
                        >
                            {localeString('general.error')}:{' '}
                            {payment_error || error_msg}
                        </Text>
                    )}
                    {!!error && (
                        <Button
                            title=""
                            icon={{
                                name: 'error',
                                size: 125,
                                color: 'white'
                            }}
                            onPress={() => void 0}
                            iconOnly
                        />
                    )}
                    {!!success && !error && (
                        <Text
                            style={{
                                color: 'white',
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
                    {!!payment_hash && (
                        <Text
                            style={{
                                color: 'white',
                                paddingTop: 20,
                                paddingLeft: 50,
                                paddingRight: 50,
                                fontSize: 15
                            }}
                        >{`${localeString(
                            'views.SendingLightning.paymentHash'
                        )}: ${payment_hash}`}</Text>
                    )}

                    <View style={styles.buttons}>
                        {payment_hash && (
                            <View style={{ marginBottom: 10, width: '100%' }}>
                                <CopyButton
                                    title={localeString(
                                        'views.SendingLightning.copyPaymentHash'
                                    )}
                                    copyValue={payment_hash}
                                />
                            </View>
                        )}

                        {(!!error || !!payment_error || !!success) && (
                            <Button
                                title={localeString(
                                    'views.SendingLightning.goToWallet'
                                )}
                                icon={{
                                    name: 'list',
                                    size: 25,
                                    color: backgroundColor
                                }}
                                onPress={() =>
                                    navigation.navigate('Wallet', {
                                        refresh: true
                                    })
                                }
                                titleStyle={{
                                    color: backgroundColor
                                }}
                                containerStyle={{ width: '100%' }}
                            />
                        )}
                    </View>
                </View>
            </View>
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
        marginBottom: 35
    }
});
