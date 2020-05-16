import * as React from 'react';
import RNFetchBlob from 'rn-fetch-blob';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Button, Header, Icon } from 'react-native-elements';
import { getDomain } from 'js-lnurl';
import querystring from 'querystring-es3';
import url from 'url';
import InvoicesStore from './../../stores/InvoicesStore';
import LnurlPayStore from './../../stores/LnurlPayStore';
import SettingsStore from './../../stores/SettingsStore';
import LnurlPayMetadata from './Metadata';

interface LnurlPayProps {
    navigation: any;
    InvoicesStore: InvoicesStore;
    SettingsStore: SettingsStore;
    LnurlPayStore: LnurlPayStore;
}

interface LnurlPayState {
    amount: string;
    domain: string;
}

@inject('InvoicesStore', 'SettingsStore', 'LnurlPayStore')
@observer
export default class LnurlPay extends React.Component<
    LnurlPayProps,
    LnurlPayState
> {
    constructor(props: LnurlPayProps) {
        super(props);

        try {
            this.state = this.stateFromProps(props);
        } catch (err) {
            this.state = {
                amount: '',
                domain: ''
            };

            Alert.alert(
                `Invalid lnurl params!`,
                err.message,
                [{ text: 'OK', onPress: () => void 0 }],
                { cancelable: false }
            );
        }
    }

    stateFromProps(props: LnurlPayProps) {
        const { navigation } = props;
        const lnurl = navigation.getParam('lnurlParams');
        const domain = getDomain(lnurl.callback);

        return {
            amount: Math.floor(lnurl.minSendable / 1000).toString(),
            domain
        };
    }

    sendValues() {
        const {
            navigation,
            InvoicesStore,
            LnurlPayStore,
            SettingsStore
        } = this.props;
        const { sslVerification } = SettingsStore;
        const { domain, amount } = this.state;
        const lnurl = navigation.getParam('lnurlParams');
        const u = url.parse(lnurl.callback);
        const qs = querystring.parse(u.query);
        qs.amount = parseInt(parseFloat(amount) * 1000);
        u.search = querystring.stringify(u);
        u.query = querystring.stringify(u);

        RNFetchBlob.config({
            trusty: !sslVerification || true
        })
            .fetch('get', url.format(u), null)
            .then((response: any) => {
                if (response.info().status <= 300) {
                    return { status: 'ERROR', error: response.text() };
                }
                return response.json();
            })
            .catch((err: any) => ({
                status: 'ERROR',
                error: err.message
            }))
            .then((data: any) => {
                if (data.status === 'ERROR') {
                    Alert.alert(
                        `${domain} says:`.data.reason,
                        [{ text: 'OK', onPress: () => void 0 }],
                        { cancelable: false }
                    );
                    return;
                }

                const pr = data.pr;
                const successAction = data.successAction || {
                    tag: 'noop'
                };

                InvoicesStore.getPayReq(pr, lnurl.metadata).then(() => {
                    if (!!InvoicesStore.getPayReqError) {
                        Alert.alert(
                            `Got an invalid invoice!`,
                            InvoicesStore.getPayReqError,
                            [{ text: 'OK', onPress: () => void 0 }],
                            { cancelable: false }
                        );
                        return;
                    }

                    const payment_hash: string =
                        (InvoicesStore.pay_req &&
                            InvoicesStore.pay_req.payment_hash) ||
                        '';
                    const description_hash: string =
                        (InvoicesStore.pay_req &&
                            InvoicesStore.pay_req.description_hash) ||
                        '';

                    LnurlPayStore.keep(
                        payment_hash,
                        domain,
                        lnurl.lnurlText,
                        lnurl.metadata,
                        description_hash,
                        successAction
                    );
                    navigation.navigate('PaymentRequest');
                });
            });
    }

    render() {
        const { SettingsStore, navigation } = this.props;
        const { amount, domain } = this.state;
        const { settings } = SettingsStore;
        const { theme } = settings;
        const lnurl = navigation.getParam('lnurlParams');

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.navigate('Wallet')}
                color="#fff"
                underlayColor="transparent"
            />
        );

        return (
            <View
                style={
                    theme === 'dark'
                        ? styles.darkThemeStyle
                        : styles.lightThemeStyle
                }
            >
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{ text: 'Send', style: { color: '#fff' } }}
                    backgroundColor="grey"
                />
                <View style={styles.content}>
                    <Text
                        style={{
                            padding: 20,
                            fontWeight: 'bold',
                            fontSize: 22,
                            color: theme === 'dark' ? 'white' : 'black'
                        }}
                    >
                        {domain}
                    </Text>
                </View>
                <View style={styles.content}>
                    <Text
                        style={{
                            color: theme === 'dark' ? 'white' : 'black'
                        }}
                    >
                        Amount to pay (in Satoshis)
                        {lnurl && lnurl.minSendable !== lnurl.maxSendable
                            ? ` (${Math.ceil(
                                  lnurl.minSendable / 1000
                              )}--${Math.floor(lnurl.maxSendable / 1000)})`
                            : ''}
                    </Text>
                    <TextInput
                        value={amount}
                        onChangeText={(text: string) => {
                            this.setState({ amount: text });
                        }}
                        numberOfLines={1}
                        editable={
                            lnurl && lnurl.minSendable === lnurl.maxSendable
                                ? false
                                : true
                        }
                        style={
                            theme === 'dark'
                                ? styles.textInputDark
                                : styles.textInput
                        }
                        placeholderTextColor="gray"
                    />
                    <View style={styles.button}>
                        <Button
                            title="Confirm"
                            icon={{
                                name: 'send',
                                size: 25,
                                color: 'white'
                            }}
                            onPress={() => {
                                this.sendValues();
                            }}
                            style={styles.button}
                            buttonStyle={{
                                backgroundColor: 'orange',
                                borderRadius: 30
                            }}
                        />
                    </View>
                </View>
                <View style={styles.content}>
                    <LnurlPayMetadata
                        metadata={lnurl.metadata}
                        SettingsStore={SettingsStore}
                    />
                </View>
            </View>
        );
    }
}

const styles = StyleSheet.create({
    lightThemeStyle: {
        flex: 1,
        backgroundColor: 'white'
    },
    darkThemeStyle: {
        flex: 1,
        backgroundColor: 'black',
        color: 'white'
    },
    textInput: {
        fontSize: 20,
        color: 'black',
        paddingTop: 10,
        paddingBottom: 10
    },
    textInputDark: {
        fontSize: 20,
        color: 'white',
        paddingTop: 10,
        paddingBottom: 10
    },
    content: {
        paddingLeft: 20,
        paddingRight: 20
    },
    button: {
        paddingTop: 15,
        paddingBottom: 15
    }
});
