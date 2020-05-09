import * as React from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TextInput,
    View,
    ScrollView
} from 'react-native';
import { LNURLWithdrawParams } from 'js-lnurl';
import { Button, ButtonGroup, Header, Icon } from 'react-native-elements';
import CollapsedQR from './../components/CollapsedQR';
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
export default class Receive extends React.Component<
    ReceiveProps,
    ReceiveState
> {
    state = {
        selectedIndex: 0,
        memo: '',
        value: '100',
        expiry: '3600'
    };

    componentDidMount() {
        const { navigation } = this.props;
        const lnurl: LNURLWithdrawParams | undefined = navigation.getParam(
            'lnurlParams'
        );

        if (lnurl) {
            this.setState({
                selectedIndex: 0,
                memo: lnurl.defaultDescription,
                value: Math.floor(lnurl.maxWithdrawable / 1000).toString()
            });
        }
    }

    getNewAddress = () => {
        const { SettingsStore } = this.props;
        SettingsStore.getNewAddress();
    };

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
    };

    render() {
        const { InvoicesStore, SettingsStore, navigation } = this.props;
        const { selectedIndex, memo, value, expiry } = this.state;
        const {
            createInvoice,
            payment_request,
            creatingInvoice,
            creatingInvoiceError,
            error_msg
        } = InvoicesStore;
        const { settings, loading, chainAddress } = SettingsStore;
        const { theme } = settings;
        const address = chainAddress;

        const lnurl: LNURLWithdrawParams | undefined = navigation.getParam(
            'lnurlParams'
        );

        const lightningButton = () => (
            <React.Fragment>
                <Text>Lightning</Text>
            </React.Fragment>
        );

        const onChainButton = () => (
            <React.Fragment>
                <Text>On-chain</Text>
            </React.Fragment>
        );

        const buttons = [
            { element: lightningButton },
            { element: onChainButton }
        ];

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
                    centerComponent={{
                        text: 'Receive',
                        style: { color: '#fff' }
                    }}
                    backgroundColor="grey"
                />

                <ButtonGroup
                    onPress={this.updateIndex}
                    selectedIndex={selectedIndex}
                    buttons={buttons}
                    selectedButtonStyle={{
                        backgroundColor: 'white'
                    }}
                    containerStyle={{
                        backgroundColor: '#f2f2f2'
                    }}
                />

                <ScrollView style={styles.content}>
                    {selectedIndex === 0 && (
                        <View>
                            {!!payment_request && (
                                <Text style={{ color: 'green', padding: 20 }}>
                                    Successfully created invoice
                                </Text>
                            )}
                            {creatingInvoiceError && (
                                <Text style={{ color: 'red', padding: 20 }}>
                                    Error creating invoice
                                </Text>
                            )}
                            {error_msg && (
                                <Text
                                    style={{
                                        color:
                                            theme === 'dark'
                                                ? 'white'
                                                : 'black',
                                        padding: 20
                                    }}
                                >
                                    {error_msg}
                                </Text>
                            )}
                            {creatingInvoice && (
                                <ActivityIndicator
                                    size="large"
                                    color="#0000ff"
                                />
                            )}
                            {!!payment_request && (
                                <CollapsedQR
                                    value={payment_request.toUpperCase()}
                                    copyText="Copy Invoice"
                                    theme={theme}
                                />
                            )}
                            <Text
                                style={{
                                    color: theme === 'dark' ? 'white' : 'black'
                                }}
                            >
                                Memo
                            </Text>
                            <TextInput
                                placeholder="Sent a few satoshis"
                                value={memo}
                                onChangeText={(text: string) =>
                                    this.setState({ memo: text })
                                }
                                numberOfLines={1}
                                editable={true}
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
                                Amount (in Satoshis)
                                {lnurl &&
                                lnurl.minWithdrawable !== lnurl.maxWithdrawable
                                    ? ` (${Math.ceil(
                                          lnurl.minWithdrawable / 1000
                                      )}--${Math.floor(
                                          lnurl.maxWithdrawable / 1000
                                      )})`
                                    : ''}
                            </Text>
                            <TextInput
                                keyboardType="numeric"
                                placeholder={'100'}
                                value={value}
                                onChangeText={(text: string) => {
                                    this.setState({ value: text });
                                }}
                                numberOfLines={1}
                                editable={
                                    lnurl &&
                                    lnurl.minWithdrawable ===
                                        lnurl.maxWithdrawable
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

                            <Text
                                style={{
                                    color: theme === 'dark' ? 'white' : 'black'
                                }}
                            >
                                Expiration (in seconds)
                            </Text>
                            <TextInput
                                keyboardType="numeric"
                                placeholder={'3600 (one hour)'}
                                value={expiry}
                                onChangeText={(text: string) =>
                                    this.setState({ expiry: text })
                                }
                                numberOfLines={1}
                                editable={true}
                                style={
                                    theme === 'dark'
                                        ? styles.textInputDark
                                        : styles.textInput
                                }
                                placeholderTextColor="gray"
                            />

                            <View style={styles.button}>
                                <Button
                                    title={`Create${
                                        lnurl ? ' and submit ' : ' '
                                    }invoice`}
                                    icon={{
                                        name: 'create',
                                        size: 25,
                                        color: 'white'
                                    }}
                                    onPress={() =>
                                        createInvoice(
                                            memo,
                                            value,
                                            expiry,
                                            lnurl
                                        )
                                    }
                                    buttonStyle={{
                                        backgroundColor: 'orange',
                                        borderRadius: 30
                                    }}
                                />
                            </View>
                        </View>
                    )}
                    {selectedIndex === 1 && (
                        <React.Fragment>
                            {!address && !loading && (
                                <Text
                                    style={{
                                        color:
                                            theme === 'dark' ? 'white' : 'black'
                                    }}
                                >
                                    No on-chain address available. Generate one
                                    by pressing the button below.
                                </Text>
                            )}
                            {loading && (
                                <ActivityIndicator
                                    size="large"
                                    color="#0000ff"
                                />
                            )}
                            {address && (
                                <CollapsedQR
                                    value={address}
                                    copyText="Copy Address"
                                    theme={theme}
                                />
                            )}
                            <View style={styles.button}>
                                <Button
                                    title="Get New Address"
                                    icon={{
                                        name: 'fiber-new',
                                        size: 25,
                                        color: 'white'
                                    }}
                                    onPress={() => this.getNewAddress()}
                                    buttonStyle={{
                                        backgroundColor: 'orange',
                                        borderRadius: 30
                                    }}
                                />
                            </View>
                        </React.Fragment>
                    )}
                </ScrollView>
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
    content: {
        paddingLeft: 20,
        paddingRight: 20
    },
    button: {
        paddingTop: 15,
        paddingBottom: 15
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
    }
});
