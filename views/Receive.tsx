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
}

@inject('InvoicesStore', 'SettingsStore')
@observer
export default class Receive extends React.Component<ReceiveProps, ReceiveState> {
    state = {
        selectedIndex: 0,
        memo: '',
        value: ''
    }

    getNewAddress = () => {
        const { SettingsStore } = this.props
        SettingsStore.getNewAddress().then(() => {
            SettingsStore.getSettings();
        });
    }

    updateIndex = (selectedIndex: number) => {
        this.setState({selectedIndex});
    }

    render() {
        const { InvoicesStore, SettingsStore, navigation } = this.props;
        const { selectedIndex, memo, value } = this.state;
        const { createInvoice, payment_request, creatingInvoice, creatingInvoiceError, error_msg } = InvoicesStore;
        const { settings, loading } = SettingsStore;
        const { onChainAndress } = settings;

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
            <View>
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
                        {(!onChainAndress && !loading) && <Text>No on-chain address available. Generate one by pressing the button below.</Text>}
                        {loading && <ActivityIndicator size="large" color="#0000ff" />}
                        {onChainAndress && <Text style={{ padding: 10 }}>{onChainAndress}</Text>}
                        {onChainAndress && <QRCode
                            value={onChainAndress}
                            size={200}
                            fgColor='white'
                        />}
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
                        {payment_request && <Text style={{ color: 'green', padding: 20 }}>Successfully created invoice</Text>}
                        {creatingInvoiceError && <Text style={{ color: 'red', padding: 20 }}>Error creating invoice</Text>}
                        {error_msg && <Text style={{ padding: 20 }}>{error_msg}</Text>}
                        {creatingInvoice && <ActivityIndicator size="large" color="#0000ff" />}
                        {payment_request && <Text style={{ padding: 20 }}>{payment_request}</Text>}
                        {payment_request && <View style={styles.button}>
                            <CopyButton
                                copyValue={payment_request}
                            />
                        </View>}
                        <Text>Memo</Text>
                        <TextInput
                            value={memo}
                            onChangeText={(text: string) => this.setState({ memo: text })}
                            numberOfLines={1}
                            style={{ fontSize: 20, padding: 20 }}
                            editable={true}
                        />

                        <Text>Amount (in Satoshis)</Text>
                        <TextInput
                            value={value}
                            onChangeText={(text: string) => this.setState({ value: text })}
                            numberOfLines={1}
                            style={{ fontSize: 20, padding: 20 }}
                            editable={true}
                        />

                        <View style={styles.button}>
                            <Button
                                title="Create Invoice"
                                icon={{
                                    name: "create",
                                    size: 25,
                                    color: "white"
                                }}
                                onPress={() => createInvoice(memo, value)}
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
    content: {
        paddingLeft: 20,
        paddingRight: 20,
        alignItems: 'center'
    },
    button: {
        paddingTop: 15,
        paddingBottom: 15
    }
});