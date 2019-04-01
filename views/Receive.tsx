import * as React from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, ButtonGroup, Header, Icon } from 'react-native-elements';
import QRCode from 'react-native-qrcode';
import CopyButton from './../components/CopyButton';
import { inject, observer } from 'mobx-react';

import InvoicesStore from './../stores/InvoicesStore';
import SettingsStore from './../stores/SettingsStore';

interface ReceiveProps {
    exitSetup: any;
    navigation: any;
    InvoicesStore: InvoicesStore;
    SettingsStore: SettingsStore;
}

interface ReceiveState {
    selectedIndex: number;
    memo: string;
    value: string;
    expiry: string;
}

@inject('InvoicesStore', 'SettingsStore')
@observer
export default class Receive extends React.Component<ReceiveProps, ReceiveState> {
    state = {
        selectedIndex: 0,
        memo: '',
        value: '',
        expiry: '3600'
    }

    getNewAddress = () => {
        const { SettingsStore } = this.props
        SettingsStore.getNewAddress().then(() => {
            SettingsStore.getSettings();
        });
    }

    updateIndex = (selectedIndex: number) => {
        const { InvoicesStore } = this.props;

        this.setState({
            selectedIndex,
            // reset LN invoice values so old invoices don't linger
            memo: '',
            value: '',
            expiry: '3600'
        });

        if (InvoicesStore.payment_request) {
            InvoicesStore.resetPaymentReq();
        }
    }

    render() {
        const { InvoicesStore, SettingsStore, navigation } = this.props;
        const { selectedIndex, memo, value, expiry } = this.state;
        const { createInvoice, payment_request, creatingInvoice, creatingInvoiceError, error_msg } = InvoicesStore;
        const { settings, loading } = SettingsStore;
        const { onChainAndress, theme } = settings;

        const onChainButton = () => (
            <React.Fragment>
                <Text>On-chain</Text>
            </React.Fragment>
        );

        const lightningButton = () => (
            <React.Fragment>
                <Text>Lightning</Text>
            </React.Fragment>
        );

        const buttons = [{ element: onChainButton }, { element: lightningButton }];

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.navigate('Wallet')}
                color="#fff"
                underlayColor="transparent"
            />
        );

        return (
            <View style={theme === 'dark' ? styles.darkThemeStyle : styles.lightThemeStyle}>
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{ text: 'Receive', style: { color: '#fff' } }}
                    backgroundColor='grey'
                />

                <ButtonGroup
                    onPress={this.updateIndex}
                    selectedIndex={selectedIndex}
                    buttons={buttons}
                    containerStyle={{ height: 50 }}
                />

                <View style={styles.content}>
                    {selectedIndex === 0 && <React.Fragment>
                        {(!onChainAndress && !loading) && <Text style={{ color: theme === 'dark' ? 'white' : 'black' }}>No on-chain address available. Generate one by pressing the button below.</Text>}
                        {loading && <ActivityIndicator size="large" color="#0000ff" />}
                        {onChainAndress && <Text style={{ color: theme === 'dark' ? 'white' : 'black', padding: 10 }}>{onChainAndress}</Text>}
                        {onChainAndress && <View style={{ width: 250, height: 250, backgroundColor: 'white', alignItems: 'center', paddingTop: 25 }}>
                            <QRCode
                              value={onChainAndress}
                              size={200}
                              fgColor='white'
                            />
                        </View>}
                        {onChainAndress && <View style={styles.button}>
                            <CopyButton
                                copyValue={onChainAndress}
                            />
                        </View>}
                        <View style={styles.button}>
                            <Button
                                title="Get New Address"
                                icon={{
                                    name: "fiber-new",
                                    size: 25,
                                    color: "white"
                                }}
                                onPress={() => this.getNewAddress()}
                                backgroundColor="orange"
                                borderRadius={30}
                            />
                        </View>
                    </React.Fragment>}
                    {selectedIndex === 1 && <View>
                        {!!payment_request && <Text style={{ color: 'green', padding: 20 }}>Successfully created invoice</Text>}
                        {creatingInvoiceError && <Text style={{ color: 'red', padding: 20 }}>Error creating invoice</Text>}
                        {error_msg && <Text style={{ color: theme === 'dark' ? 'white' : 'black', padding: 20 }}>{error_msg}</Text>}
                        {creatingInvoice && <ActivityIndicator size="large" color="#0000ff" />}
                        {!!payment_request && <Text style={{ color: theme === 'dark' ? 'white' : 'black', padding: 20 }}>{payment_request}</Text>}
                        {!!payment_request && <View style={styles.button}>
                            <CopyButton
                                copyValue={payment_request}
                            />
                        </View>}
                        <Text style={{ color: theme === 'dark' ? 'white' : 'black' }}>Memo</Text>
                        <TextInput
                            placeholder="Sent a few satoshis"
                            value={memo}
                            onChangeText={(text: string) => this.setState({ memo: text })}
                            numberOfLines={1}
                            editable={true}
                            style={theme === 'dark' ? styles.textInputDark : styles.textInput}
                            placeholderTextColor='gray'
                        />

                        <Text style={{ color: theme === 'dark' ? 'white' : 'black' }}>Amount (in Satoshis)</Text>
                        <TextInput
                            placeholder={"100"}
                            value={value}
                            onChangeText={(text: string) => this.setState({ value: text })}
                            numberOfLines={1}
                            editable={true}
                            style={theme === 'dark' ? styles.textInputDark : styles.textInput}
                            placeholderTextColor='gray'
                        />

                        <Text style={{ color: theme === 'dark' ? 'white' : 'black' }}>Expiration (in seconds)</Text>
                        <TextInput
                            placeholder={"3600 (one hour)"}
                            value={expiry}
                            onChangeText={(text: string) => this.setState({ expiry: text })}
                            numberOfLines={1}
                            editable={true}
                            style={theme === 'dark' ? styles.textInputDark : styles.textInput}
                            placeholderTextColor='gray'
                        />

                        <View style={styles.button}>
                            <Button
                                title="Create Invoice"
                                icon={{
                                    name: "create",
                                    size: 25,
                                    color: "white"
                                }}
                                onPress={() => createInvoice(memo, value, expiry)}
                                backgroundColor="orange"
                                borderRadius={30}
                            />
                        </View>
                    </View>}
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
    content: {
        paddingLeft: 20,
        paddingRight: 20,
        alignItems: 'center'
    },
    button: {
        paddingTop: 15,
        paddingBottom: 15
    },
    textInput: {
        fontSize: 20,
        color: 'black'
    },
    textInputDark: {
        fontSize: 20,
        color: 'white'
    }
});