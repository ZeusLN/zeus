import * as React from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    View,
    ScrollView
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { when } from 'mobx';
import { Button } from 'react-native-elements';
import LnurlPaySuccess from './LnurlPay/Success';

import TransactionsStore from './../stores/TransactionsStore';
import LnurlPayStore from './../stores/LnurlPayStore';

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
    componentDidMount = () => {
        const { TransactionsStore, LnurlPayStore } = this.props;
        const {
            payment_route,
            payment_hash,
            payment_error
        } = TransactionsStore;
        const { acknowledge, clear } = LnurlPayStore;

        when(() => payment_route).then(() => {
            acknowledge(payment_hash);
        });
        when(() => payment_error).then(() => {
            clear(payment_hash);
        });
    };

    getBackgroundColor() {
        const { TransactionsStore } = this.props;
        const {
            payment_route,
            payment_error,
            status,
            error
        } = TransactionsStore;

        if (error) {
            return 'darkred';
        } else if (payment_route || status === 'complete') {
            return 'green';
        } else if (payment_error) {
            return 'lightcoral';
        }

        return 'white';
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
        const success = payment_route || status === 'complete';

        return (
            <View
                style={{
                    ...styles.container,
                    backgroundColor
                }}
            >
                <ScrollView
                    contentContainerStyle={{
                        ...styles.content,
                        height: '100%'
                    }}
                >
                    {loading && (
                        <ActivityIndicator size="large" color="#0000ff" />
                    )}
                    {loading && <Text>Sending Transaction</Text>}
                    {(error || payment_error) && (
                        <Text
                            style={{
                                color: 'white',
                                padding: 20,
                                fontSize: 40
                            }}
                        >
                            Error: {payment_error || error_msg}
                        </Text>
                    )}
                    {(payment_route || status === 'complete') && (
                        <Text
                            style={{
                                color: 'white',
                                padding: 20,
                                fontSize: 40
                            }}
                        >
                            Transaction successfully sent
                        </Text>
                    )}
                    {payment_preimage &&
                        payment_hash === LnurlPayStore.paymentHash &&
                        LnurlPayStore.successAction && (
                            <LnurlPaySuccess
                                color="white"
                                domain={LnurlPayStore.domain}
                                successAction={LnurlPayStore.successAction}
                                preimage={payment_preimage}
                            />
                        )}
                    {payment_hash && (
                        <Text
                            style={{
                                color: 'white',
                                padding: 20,
                                fontSize: 15
                            }}
                        >{`Payment Hash: ${payment_hash}`}</Text>
                    )}
                    {success && (
                        <Button
                            title=""
                            icon={{
                                name: 'check',
                                size: 125,
                                color: 'white'
                            }}
                            style={{ padding: 20 }}
                            onPress={() => void 0}
                            buttonStyle={{
                                backgroundColor: 'transparent'
                            }}
                        />
                    )}
                    {error && (
                        <Button
                            title=""
                            icon={{
                                name: 'error',
                                size: 125,
                                color: 'white'
                            }}
                            style={{ padding: 20 }}
                            onPress={() => void 0}
                            buttonStyle={{
                                backgroundColor: 'transparent'
                            }}
                        />
                    )}

                    {(error || payment_error || success) && (
                        <Button
                            title="Go to Wallet"
                            icon={{
                                name: 'list',
                                size: 25,
                                color: backgroundColor
                            }}
                            onPress={() =>
                                navigation.navigate('Wallet', { refresh: true })
                            }
                            style={styles.button}
                            buttonStyle={{
                                backgroundColor: '#fff',
                                borderRadius: 30
                            }}
                            titleStyle={{
                                color: backgroundColor
                            }}
                        />
                    )}
                </ScrollView>
            </View>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1
    },
    content: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 40
    },
    button: {
        paddingTop: 10,
        paddingBottom: 10
    }
});
