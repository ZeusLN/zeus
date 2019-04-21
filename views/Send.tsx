import * as React from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Button, Header, Icon } from 'react-native-elements';
import AddressUtils from './../utils/AddressUtils';
import FeeTable from './../components/FeeTable';

import InvoicesStore from './../stores/InvoicesStore';
import NodeInfoStore from './../stores/NodeInfoStore';
import TransactionsStore from './../stores/TransactionsStore';
import SettingsStore from './../stores/SettingsStore';
import FeeStore from './../stores/FeeStore';

interface SendProps {
    exitSetup: any;
    navigation: any;
    InvoicesStore: InvoicesStore;
    NodeInfoStore: NodeInfoStore;
    TransactionsStore: TransactionsStore;
    SettingsStore: SettingsStore;
    FeeStore: FeeStore;
}

interface SendState {
    isValid: boolean;
    transactionType: string | null;
    destination: string;
    amount: string;
    fee: string;
}

@inject('InvoicesStore', 'NodeInfoStore', 'TransactionsStore', 'SettingsStore', 'FeeStore')
@observer
export default class Send extends React.Component<SendProps, SendState> {
    constructor(props: any) {
        super(props);
        const { navigation } = props;
        const destination = navigation.getParam('destination', null);
        const transactionType = navigation.getParam('transactionType', null);

        this.state = {
            isValid: false,
            transactionType: transactionType,
            destination: destination || '',
            amount: '',
            fee: ''
        }
    }

    componentWillReceiveProps(nextProps: any) {
        const { navigation } = nextProps;
        const destination = navigation.getParam('destination', null);
        const transactionType = navigation.getParam('transactionType', null);

        if (transactionType === 'Lightning') {
            this.props.InvoicesStore.getPayReq(destination);
        }

        this.setState({
            transactionType,
            destination,
            isValid: true
        });
    }

    validateAddress = (text: string) => {
          const { NodeInfoStore, InvoicesStore } = this.props;
          const { testnet } = NodeInfoStore;

          if (AddressUtils.isValidBitcoinAddress(text, testnet)) {
              this.setState({
                  transactionType: 'On-chain',
                  isValid: true,
                  destination: text
              });
          } else if (AddressUtils.isValidLightningPaymentRequest(text)) {
              this.setState({
                  transactionType: 'Lightning',
                  isValid: true,
                  destination: text
              });

              InvoicesStore.getPayReq(text);
          } else {
              this.setState({
                  transactionType: null,
                  isValid: false,
                  destination: text
              });
          }
    }

    sendCoins = () => {
        const { TransactionsStore, navigation } = this.props;
        const { destination, amount, fee } = this.state;
        TransactionsStore.sendCoins({ addr: destination, sat_per_byte: fee, amount: amount });
        navigation.navigate('SendingOnChain');
    }

    setFee = (value: string) => {
        this.setState({
            fee: value
        });
    }

    render() {
        const { FeeStore, SettingsStore, navigation } = this.props;
        const { isValid, transactionType, destination, amount, fee } = this.state;
        const { settings } = SettingsStore;
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
            <ScrollView style={theme === 'dark' ? styles.darkThemeStyle : styles.lightThemeStyle}>
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{ text: 'Send', style: { color: '#fff' } }}
                    backgroundColor='grey'
                />
                <View style={styles.content}>
                    <Text style={{ color: theme === 'dark' ? 'white' : 'black' }}>Bitcoin address or Lightning payment request</Text>
                    <TextInput
                        placeholder={'lnbc1...'}
                        value={destination}
                        onChangeText={(text: string) => this.validateAddress(text)}
                        style={theme === 'dark' ? styles.textInputDark : styles.textInput}
                        placeholderTextColor='gray'
                    />
                    {(!isValid && !!destination) && <Text style={{ color: theme === 'dark' ? 'white' : 'black' }}>Must be a valid Bitcoin address or Lightning payment request</Text>}
                    {transactionType && <Text style={{ paddingTop: 10 }}>{`${transactionType} Transaction`}</Text>}
                    {transactionType === 'On-chain' && <React.Fragment>
                        <Text style={{ color: theme === 'dark' ? 'white' : 'black' }}>Amount (in satoshis)</Text>
                        <TextInput
                            value={amount}
                            onChangeText={(text: string) => this.setState({ amount: text })}
                            style={theme === 'dark' ? styles.textInputDark : styles.textInput}
                            placeholderTextColor='gray'
                        />
                    </React.Fragment>}
                    {transactionType === 'On-chain' && <React.Fragment>
                        <Text style={{ color: theme === 'dark' ? 'white' : 'black' }}>Fee (satoshis per byte)</Text>
                        <TextInput
                            placeholder="2"
                            value={fee}
                            onChangeText={(text: string) => this.setFee(text)}
                            style={theme === 'dark' ? styles.textInputDark : styles.textInput}
                            placeholderTextColor='gray'
                        />
                    </React.Fragment>}
                </View>
                <View style={styles.buttons}>
                    {transactionType === 'Lightning' && <View style={styles.button}>
                        <Button
                            title="Look Up Payment Request"
                            icon={{
                                name: "send",
                                size: 25,
                                color: "white"
                            }}
                            onPress={() => navigation.navigate('PaymentRequest')}
                            style={styles.button}
                            buttonStyle={{
                                backgroundColor: "orange",
                                borderRadius: 30
                            }}
                        />
                    </View>}
                    {transactionType === 'On-chain' && <View style={styles.button}>
                        <Button
                            title="Send Coins"
                            icon={{
                                name: "send",
                                size: 25,
                                color: "white"
                            }}
                            onPress={() => this.sendCoins()}
                            style={styles.button}
                            buttonStyle={{
                                backgroundColor: "orange",
                                borderRadius: 30,
                                width: 200
                            }}
                        />
                    </View>}
                    {transactionType === 'On-chain' && <View style={styles.button}>
                        <FeeTable
                            feeStore={FeeStore}
                            loading={FeeStore.loading}
                            dataFrame={FeeStore.dataFrame}
                            setFee={this.setFee}
                        />
                    </View>}
                    <View style={styles.button}>
                        <Button
                            title="Scan"
                            icon={{
                                name: "crop-free",
                                size: 25,
                                color: "white"
                            }}
                            onPress={() => navigation.navigate('AddressQRCodeScanner')}
                            buttonStyle={{
                                backgroundColor: theme === "dark" ? "#261339" : "rgba(92, 99,216, 1)",
                                borderRadius: 30
                            }}
                        />
                    </View>
                </View>
            </ScrollView>
        );
    }
}

const styles = StyleSheet.create({
    lightThemeStyle: {
        flex: 1,
        color: 'black'
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
        paddingTop: 10,
        paddingBottom: 10
    },
    buttons: {
        alignItems: 'center',
        paddingTop: 20,
        paddingBottom: 20
    }
});