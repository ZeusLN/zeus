import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Button, FormLabel, FormInput, FormValidationMessage, Header, Icon } from 'react-native-elements';
import AddressUtils from './../utils/AddressUtils';

import InvoicesStore from './../stores/InvoicesStore';
import NodeInfoStore from './../stores/NodeInfoStore';
import TransactionsStore from './../stores/TransactionsStore';

interface SendProps {
    exitSetup: any;
    navigation: any;
    InvoicesStore: InvoicesStore;
    NodeInfoStore: NodeInfoStore;
    TransactionsStore: TransactionsStore;
}

interface SendState {
    isValid: boolean;
    transactionType: string | null;
    destination: string;
    amount: string;
    fee: string;
}

@inject('InvoicesStore', 'NodeInfoStore', 'TransactionsStore')
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

        this.setState({
            transactionType,
            destination,
            isValid: true
        });
    }

    validateAddress = (text: string) => {
          const { InvoicesStore, NodeInfoStore } = this.props;
          const { testnet } = NodeInfoStore;

          if (AddressUtils.isValidBitcoinAddress(text, testnet)) {
              this.setState({
                  transactionType: 'On-chain Transaction',
                  isValid: true,
                  destination: text
              });
          } else if (AddressUtils.isValidLightningInvoice(text)) {
              this.setState({
                  transactionType: 'Lightning Transaction',
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

    render() {
        const { navigation } = this.props;
        const { isValid, transactionType, destination, amount, fee } = this.state;

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.navigate('Wallet')}
                color="#fff"
                underlayColor="transparent"
            />
        );

        return (
            <View>
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{ text: 'Send', style: { color: '#fff' } }}
                    backgroundColor='grey'
                />
                <View style={styles.content}>
                    <FormLabel>Bitcoin address or Lightning invoice</FormLabel>
                    <FormInput
                        value={destination}
                        onChangeText={(text: string) => this.validateAddress(text)}
                    />
                    {(!isValid && !!destination) && <FormValidationMessage>Must be a valid Bitcoin address or Lightning invoice</FormValidationMessage>}
                    {transactionType && <Text style={{ paddingTop: 10 }}>{transactionType}</Text>}
                    {transactionType === 'On-chain Transaction' && <React.Fragment>
                        <FormLabel>Amount (in satoshis)</FormLabel>
                        <FormInput
                            value={amount}
                            onChangeText={(text: string) => this.setState({ amount: text })}
                        />
                    </React.Fragment>}
                    {transactionType === 'On-chain Transaction' && <React.Fragment>
                        <FormLabel>Fee (satoshis per byte)</FormLabel>
                        <FormInput
                            placeholder="2"
                            value={fee}
                            onChangeText={(text: string) => this.setState({ fee: text })}
                        />
                    </React.Fragment>}
                    {transactionType === 'Lightning Transaction' && <View style={styles.button}>
                        <Button
                            title="Look Up Invoice"
                            icon={{
                                name: "send",
                                size: 25,
                                color: "white"
                            }}
                            onPress={() => navigation.navigate('InvoiceLookup')}
                            backgroundColor="orange"
                            style={styles.button}
                            borderRadius={30}
                        />
                    </View>}
                    {transactionType === 'On-chain Transaction' && <View style={styles.button}>
                        <Button
                            title="Send Coins"
                            icon={{
                                name: "send",
                                size: 25,
                                color: "white"
                            }}
                            onPress={() => this.sendCoins()}
                            backgroundColor="orange"
                            style={styles.button}
                            borderRadius={30}
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
                            backgroundColor="rgba(92, 99,216, 1)"
                            borderRadius={30}
                        />
                    </View>
                </View>
            </View>
        );
    }
}

const styles = StyleSheet.create({
    content: {
        paddingLeft: 20,
        paddingRight: 20
    },
    button: {
        paddingTop: 15,
        paddingBottom: 15
    }
});