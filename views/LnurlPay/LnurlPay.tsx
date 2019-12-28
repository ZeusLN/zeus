import * as React from 'react';
import axios from 'axios';
import {
    Alert,
    StyleSheet,
    Text,
    TextInput,
    View,
    ScrollView
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { Button, Header, Icon } from 'react-native-elements';
import { getDomain, LNURLPayResult, LNURLPaySuccessAction } from 'js-lnurl';
import AddressUtils from './../../utils/AddressUtils';
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
    constructor(props: any) {
        super(props);

        try {
            this.state = this.stateFromProps(props);
        } catch (err) {
            this.state = {};

            Alert.alert(`Invalid lnurl params!`, err.message, [], {
                onDismiss: () => {
                    props.navigation.navigate('Wallet');
                }
            });
        }
    }

    stateFromProps(props) {
        const { navigation } = props;
        const lnurl = navigation.getParam('lnurlParams');
        const domain = getDomain(lnurl.callback);

        return {
            amount: Math.floor(lnurl.minSendable / 1000).toString(),
            domain
        };
    }

    sendValues() {
        const { navigation, InvoicesStore, LnurlPayStore } = this.props;
        const { domain, amount } = this.state;
        const lnurl = navigation.getParam('lnurlParams');

        axios
            .get(lnurl.callback, {
                params: { amount: parseFloat(amount) * 1000 }
            })
            .catch((err: any) => ({
                status: 'ERROR',
                reason: err.response_data
            }))
            .then(async (response: any) => {
                if (response.data.status === 'ERROR') {
                    Alert.alert(response.data.reason);
                    return;
                }

                const pr = response.data.pr;
                const successAction = response.data.successAction || {
                    tag: 'noop'
                };

                await InvoicesStore.getPayReq(pr, lnurl.metadata);

                if (!!InvoicesStore.getPayReqError) {
                    Alert.alert(
                        `Got an invalid invoice!`,
                        InvoicesStore.getPayReqError,
                        [],
                        {
                            onDismiss: () => {
                                navigation.navigate('Wallet');
                            }
                        }
                    );
                    return;
                }

                LnurlPayStore.keep(
                    InvoicesStore.pay_req.payment_hash,
                    domain,
                    lnurl.lnurlText,
                    {
                        metadata: lnurl.metadata,
                        descriptionHash: InvoicesStore.pay_req.description_hash
                    },
                    successAction
                );
                navigation.navigate('PaymentRequest');
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
                            fontSize: 22
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
                    <LnurlPayMetadata metadata={lnurl.metadata} />
                </View>
            </View>
        );
    }
}

const styles = StyleSheet.create({
    lightThemeStyle: {
        flex: 1
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
