import * as React from 'react';
import {
    StyleSheet,
    Text,
    TextInput,
    View,
    ScrollView,
    Clipboard
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { Button, Header, Icon } from 'react-native-elements';
import handleAnything from './../utils/handleAnything';

import InvoicesStore from './../stores/InvoicesStore';
import NodeInfoStore from './../stores/NodeInfoStore';
import TransactionsStore from './../stores/TransactionsStore';
import SettingsStore from './../stores/SettingsStore';

import FeeTable from './../components/FeeTable';

import RESTUtils from './../utils/RESTUtils';

interface SendProps {
    exitSetup: any;
    navigation: any;
    InvoicesStore: InvoicesStore;
    NodeInfoStore: NodeInfoStore;
    TransactionsStore: TransactionsStore;
    SettingsStore: SettingsStore;
}

interface SendState {
    isValid: boolean;
    transactionType: string | null;
    destination: string;
    amount: string;
    fee: string;
    error_msg: string;
}

@inject('InvoicesStore', 'NodeInfoStore', 'TransactionsStore', 'SettingsStore')
@observer
export default class Send extends React.Component<SendProps, SendState> {
    constructor(props: any) {
        super(props);
        const { navigation } = props;
        const destination = navigation.getParam('destination', null);
        const amount = navigation.getParam('amount', null);
        const transactionType = navigation.getParam('transactionType', null);
        const isValid = navigation.getParam('isValid', null);

        this.state = {
            isValid: isValid || false,
            transactionType: transactionType,
            destination: destination || '',
            amount: amount || '',
            fee: '2'
        };
    }

    async UNSAFE_componentWillMount() {
        const clipboard = await Clipboard.getString();
        this.validateAddress(clipboard);
    }

    componentDidMount() {
        if (this.state.destination) {
            this.validateAddress(this.state.destination);
        }
    }

    UNSAFE_componentWillReceiveProps(nextProps: any) {
        const { navigation, SettingsStore } = nextProps;
        const { implementation } = SettingsStore;
        const destination = navigation.getParam('destination', null);
        const amount = navigation.getParam('amount', null);
        const transactionType = navigation.getParam('transactionType', null);

        if (transactionType === 'Lightning') {
            if (implementation === 'lndhub') {
                this.props.InvoicesStore.getPayReqLocal(destination);
            } else {
                this.props.InvoicesStore.getPayReq(destination);
            }
        }

        this.setState({
            transactionType,
            destination,
            amount,
            isValid: true
        });
    }

    validateAddress = (text: string) => {
        const { navigation } = this.props;
        handleAnything(text)
            .then(([route, props]) => {
                navigation.navigate(route, props);
            })
            .catch(err => {
                this.setState({
                    transactionType: null,
                    isValid: false,
                    destination: text,
                    error_msg: err.message
                });
            });
    };

    sendCoins = () => {
        const { TransactionsStore, navigation } = this.props;
        const { destination, amount, fee } = this.state;

        TransactionsStore.sendCoins({
            addr: destination,
            sat_per_byte: fee,
            amount
        });
        navigation.navigate('SendingOnChain');
    };

    sendKeySendPayment = () => {
        const { TransactionsStore, navigation } = this.props;
        const { destination, amount } = this.state;

        TransactionsStore.sendPayment(null, amount, destination);

        navigation.navigate('SendingLightning');
    };

    setFee = (text: string) => {
        this.setState({ fee: text });
    };

    render() {
        const { SettingsStore, navigation } = this.props;
        const {
            isValid,
            transactionType,
            destination,
            amount,
            fee,
            error_msg
        } = this.state;
        const { implementation, settings } = SettingsStore;
        const { theme } = settings;

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.navigate('Wallet')}
                color="#fff"
                underlayColor="transparent"
            />
        );

        const paymentOptions = ['Lightning payment request'];

        if (RESTUtils.supportsOnchainSends()) {
            paymentOptions.push('Bitcoin address');
        }
        if (RESTUtils.supportsKeysend()) {
            paymentOptions.push('keysend address (if enabled)');
        }

        return (
            <ScrollView
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
                        style={{ color: theme === 'dark' ? 'white' : 'black' }}
                    >
                        {paymentOptions.join(', ')}
                    </Text>
                    <TextInput
                        placeholder={'lnbc1...'}
                        value={destination}
                        onChangeText={(text: string) => {
                            this.validateAddress(text);
                        }}
                        style={
                            theme === 'dark'
                                ? styles.textInputDark
                                : styles.textInput
                        }
                        placeholderTextColor="gray"
                    />
                    {!isValid && !!destination && (
                        <Text
                            style={{
                                color: theme === 'dark' ? 'white' : 'black'
                            }}
                        >
                            Must be a valid {paymentOptions.join(', ')}
                        </Text>
                    )}
                    {transactionType && (
                        <Text
                            style={{
                                paddingTop: 10,
                                color: theme === 'dark' ? 'white' : 'black'
                            }}
                        >{`${transactionType} Transaction`}</Text>
                    )}
                    {transactionType === 'On-chain' &&
                        !RESTUtils.supportsOnchainSends() && (
                            <Text
                                style={{
                                    color: theme === 'dark' ? 'white' : 'black'
                                }}
                            >
                                On-chain sends are not supported on{' '}
                                {implementation}
                            </Text>
                        )}
                    {transactionType === 'On-chain' &&
                        RESTUtils.supportsOnchainSends() && (
                            <React.Fragment>
                                <Text
                                    style={{
                                        color:
                                            theme === 'dark' ? 'white' : 'black'
                                    }}
                                >
                                    Amount (in satoshis)
                                </Text>
                                <TextInput
                                    keyboardType="numeric"
                                    value={amount}
                                    onChangeText={(text: string) =>
                                        this.setState({ amount: text })
                                    }
                                    style={
                                        theme === 'dark'
                                            ? styles.textInputDark
                                            : styles.textInput
                                    }
                                    placeholderTextColor="gray"
                                />
                                <Text
                                    style={{
                                        color:
                                            theme === 'dark' ? 'white' : 'black'
                                    }}
                                >
                                    Fee (satoshis per byte)
                                </Text>
                                <TextInput
                                    keyboardType="numeric"
                                    placeholder="2"
                                    value={fee}
                                    onChangeText={(text: string) =>
                                        this.setState({ fee: text })
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
                                        title="Send Coins"
                                        icon={{
                                            name: 'send',
                                            size: 25,
                                            color: 'white'
                                        }}
                                        onPress={() => this.sendCoins()}
                                        style={styles.button}
                                        buttonStyle={{
                                            backgroundColor: 'orange',
                                            borderRadius: 30
                                        }}
                                    />
                                </View>
                            </React.Fragment>
                        )}
                    {transactionType === 'Keysend' && implementation === 'lnd' && (
                        <React.Fragment>
                            <Text
                                style={{
                                    color: theme === 'dark' ? 'white' : 'black'
                                }}
                            >
                                Amount (in satoshis)
                            </Text>
                            <TextInput
                                keyboardType="numeric"
                                value={amount}
                                onChangeText={(text: string) =>
                                    this.setState({ amount: text })
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
                                    title="Send"
                                    icon={{
                                        name: 'send',
                                        size: 25,
                                        color: 'white'
                                    }}
                                    onPress={() => this.sendKeySendPayment()}
                                    style={styles.button}
                                    buttonStyle={{
                                        backgroundColor: 'orange',
                                        borderRadius: 30
                                    }}
                                />
                            </View>
                        </React.Fragment>
                    )}
                    {transactionType === 'Keysend' &&
                        !RESTUtils.supportsKeysend() && (
                            <React.Fragment>
                                <Text
                                    style={{
                                        color:
                                            theme === 'dark' ? 'white' : 'black'
                                    }}
                                >
                                    Sorry, {implementation} does not support
                                    sending keysend payments at the moment.
                                </Text>
                            </React.Fragment>
                        )}
                    {transactionType === 'Lightning' && (
                        <View style={styles.button}>
                            <Button
                                title="Look Up Payment Request"
                                icon={{
                                    name: 'send',
                                    size: 25,
                                    color: 'white'
                                }}
                                onPress={() =>
                                    navigation.navigate('PaymentRequest')
                                }
                                style={styles.button}
                                buttonStyle={{
                                    backgroundColor: 'orange',
                                    borderRadius: 30
                                }}
                            />
                        </View>
                    )}
                    <View style={styles.button}>
                        <Button
                            title="Scan"
                            icon={{
                                name: 'crop-free',
                                size: 25,
                                color: 'white'
                            }}
                            onPress={() =>
                                navigation.navigate('AddressQRCodeScanner')
                            }
                            buttonStyle={{
                                backgroundColor:
                                    theme === 'dark'
                                        ? '#261339'
                                        : 'rgba(92, 99,216, 1)',
                                borderRadius: 30
                            }}
                        />
                    </View>

                    {transactionType === 'On-chain' && (
                        <View style={styles.feeTableButton}>
                            <FeeTable setFee={this.setFee} />
                        </View>
                    )}

                    {!!error_msg && (
                        <React.Fragment>
                            <Text
                                style={{
                                    color: theme === 'dark' ? 'white' : 'black'
                                }}
                            >
                                {error_msg}
                            </Text>
                        </React.Fragment>
                    )}
                </View>
            </ScrollView>
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
        padding: 20
    },
    button: {
        alignItems: 'center',
        paddingTop: 15
    },
    feeTableButton: {
        paddingTop: 15,
        alignItems: 'center',
        minHeight: 75
    }
});
