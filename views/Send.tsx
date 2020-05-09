import * as React from 'react';
import { StyleSheet, Text, TextInput, View, Clipboard } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Button, Header, Icon } from 'react-native-elements';
import handleAnything from './../utils/handleAnything';

import InvoicesStore from './../stores/InvoicesStore';
import NodeInfoStore from './../stores/NodeInfoStore';
import TransactionsStore from './../stores/TransactionsStore';
import SettingsStore from './../stores/SettingsStore';

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

        this.state = {
            isValid: false,
            transactionType: transactionType,
            destination: destination || '',
            amount: amount || '',
            fee: '2'
        };
    }

    async UNSAFE_componentWillMount() {
        const clipboard = await Clipboard.getString();

        Clipboard.setString('');
        this.validateAddress(clipboard, false);
    }

    UNSAFE_componentWillReceiveProps(nextProps: any) {
        const { navigation } = nextProps;
        const destination = navigation.getParam('destination', null);
        const amount = navigation.getParam('amount', null);
        const transactionType = navigation.getParam('transactionType', null);

        if (transactionType === 'Lightning') {
            this.props.InvoicesStore.getPayReq(destination);
        }

        this.setState({
            transactionType,
            destination,
            amount,
            isValid: true
        });
    }

    validateAddress = (text: string, apply: boolean = true) => {
        const { navigation } = this.props;
        handleAnything(text)
            .then(([route, props]) => {
                navigation.navigate(route, props);
            })
            .catch(() => {
                this.setState({
                    transactionType: null,
                    isValid: false,
                    destination: apply ? text : this.state.destination
                });
            });
    };

    sendCoins = () => {
        const { TransactionsStore, navigation, SettingsStore } = this.props;
        const { destination, amount, fee } = this.state;
        const { implementation } = SettingsStore;

        if (implementation === 'c-lightning-REST') {
            TransactionsStore.sendCoins({
                address: destination,
                feeRate: `${Number(fee) * 1000}perkb`, // satoshis per kilobyte
                satoshis: amount
            });
        } else {
            TransactionsStore.sendCoins({
                addr: destination,
                sat_per_byte: fee,
                amount
            });
        }
        navigation.navigate('SendingOnChain');
    };

    sendKeySendPayment = () => {
        const { TransactionsStore, navigation, SettingsStore } = this.props;
        const { destination, amount } = this.state;

        TransactionsStore.sendPayment(null, amount, destination);

        navigation.navigate('SendingLightning');
    };

    render() {
        const { SettingsStore, navigation } = this.props;
        const {
            isValid,
            transactionType,
            destination,
            amount,
            fee
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
                        style={{ color: theme === 'dark' ? 'white' : 'black' }}
                    >
                        Bitcoin address, Lightning payment request, or keysend
                        address (if enabled)
                    </Text>
                    <TextInput
                        placeholder={'lnbc1...'}
                        value={destination}
                        onChangeText={(text: string) =>
                            this.validateAddress(text)
                        }
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
                            Must be a valid Bitcoin address, Lightning payment
                            request, or keysend address
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
                    {transactionType === 'On-chain' && (
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
                            <Text
                                style={{
                                    color: theme === 'dark' ? 'white' : 'black'
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
                        implementation === 'c-lightning-REST' && (
                            <React.Fragment>
                                <Text
                                    style={{
                                        color:
                                            theme === 'dark' ? 'white' : 'black'
                                    }}
                                >
                                    Sorry, c-lightning does not support sending
                                    keysend payments yet. You can still receive
                                    keysend payments if it's enabled on your
                                    node.
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
