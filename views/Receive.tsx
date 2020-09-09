import * as React from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TextInput,
    View,
    ScrollView,
    TouchableOpacity
} from 'react-native';
import { LNURLWithdrawParams } from 'js-lnurl';
import { Button, ButtonGroup, Header, Icon } from 'react-native-elements';
import CollapsedQR from './../components/CollapsedQR';
import { inject, observer } from 'mobx-react';
import { localeString } from './../utils/LocaleUtils';

import InvoicesStore from './../stores/InvoicesStore';
import SettingsStore from './../stores/SettingsStore';
import UnitsStore, { satoshisPerBTC } from './../stores/UnitsStore';
import FiatStore from './../stores/FiatStore';

interface ReceiveProps {
    exitSetup: any;
    navigation: any;
    InvoicesStore: InvoicesStore;
    SettingsStore: SettingsStore;
    UnitsStore: UnitsStore;
    FiatStore: FiatStore;
}

interface ReceiveState {
    selectedIndex: number;
    memo: string;
    value: string;
    expiry: string;
}

@inject('InvoicesStore', 'SettingsStore', 'UnitsStore', 'FiatStore')
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
        const {
            InvoicesStore,
            SettingsStore,
            UnitsStore,
            FiatStore,
            navigation
        } = this.props;
        const { selectedIndex, memo, value, expiry } = this.state;
        const { units, changeUnits } = UnitsStore;
        const { fiatRates }: any = FiatStore;

        const {
            createInvoice,
            payment_request,
            creatingInvoice,
            creatingInvoiceError,
            error_msg
        } = InvoicesStore;
        const {
            settings,
            loading,
            chainAddress,
            implementation
        } = SettingsStore;
        const { theme, fiat } = settings;
        const address = chainAddress;

        const rate = fiat && fiatRates ? fiatRates[fiat]['15m'] : 0;
        const symbol = fiatRates && fiatRates[fiat] && fiatRates[fiat].symbol;

        let satAmount: string | number;
        switch (units) {
            case 'sats':
                satAmount = value;
                break;
            case 'btc':
                satAmount = Number(value) * satoshisPerBTC;
                break;
            case 'fiat':
                satAmount = Number(Number(value) * rate).toFixed(0);
                break;
        }

        const lnurl: LNURLWithdrawParams | undefined = navigation.getParam(
            'lnurlParams'
        );

        const lightningButton = () => (
            <React.Fragment>
                <Text>{localeString('general.lightning')}</Text>
            </React.Fragment>
        );

        const onChainButton = () => (
            <React.Fragment>
                <Text>{localeString('general.onchain')}</Text>
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
                        text: localeString('views.Receive.title'),
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
                                    {localeString(
                                        'views.Receive.successCreate'
                                    )}
                                    {!!lnurl &&
                                        ` ${localeString(
                                            'views.Receive.andSentTo'
                                        )} ${lnurl.domain}`}
                                </Text>
                            )}
                            {creatingInvoiceError && (
                                <Text style={{ color: 'red', padding: 20 }}>
                                    {localeString('views.Receive.errorCreate')}
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
                                    copyText={localeString(
                                        'views.Receive.copyInvoice'
                                    )}
                                    theme={theme}
                                />
                            )}
                            <Text
                                style={{
                                    color: theme === 'dark' ? 'white' : 'black'
                                }}
                            >
                                {localeString('views.Receive.memo')}:
                            </Text>
                            <TextInput
                                placeholder={localeString(
                                    'views.Receive.memoPlaceholder'
                                )}
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

                            <TouchableOpacity onPress={() => changeUnits()}>
                                <Text
                                    style={{
                                        color:
                                            theme === 'dark' ? 'white' : 'black'
                                    }}
                                >
                                    {localeString('views.Receive.amount')} (
                                    {units === 'fiat' ? fiat : units})
                                    {lnurl &&
                                    lnurl.minWithdrawable !==
                                        lnurl.maxWithdrawable
                                        ? ` (${Math.ceil(
                                              lnurl.minWithdrawable / 1000
                                          )}--${Math.floor(
                                              lnurl.maxWithdrawable / 1000
                                          )})`
                                        : ''}
                                </Text>
                            </TouchableOpacity>
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
                            {units !== 'sats' && (
                                <TouchableOpacity onPress={() => changeUnits()}>
                                    <Text
                                        style={{
                                            color:
                                                theme === 'dark'
                                                    ? 'white'
                                                    : 'black'
                                        }}
                                    >
                                        {satAmount}{' '}
                                        {localeString('views.Receive.satoshis')}
                                    </Text>
                                </TouchableOpacity>
                            )}

                            {implementation !== 'lndhub' && (
                                <>
                                    <Text
                                        style={{
                                            color:
                                                theme === 'dark'
                                                    ? 'white'
                                                    : 'black'
                                        }}
                                    >
                                        {localeString(
                                            'views.Receive.expiration'
                                        )}
                                        :
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
                                </>
                            )}

                            <View style={styles.button}>
                                <Button
                                    title={
                                        localeString(
                                            'views.Receive.createInvoice'
                                        ) +
                                        (!!lnurl
                                            ? ` ${localeString(
                                                  'views.Receive.andSubmitTo'
                                              )} ${lnurl.domain}`
                                            : '')
                                    }
                                    icon={{
                                        name: 'create',
                                        size: 25,
                                        color: 'white'
                                    }}
                                    onPress={() =>
                                        createInvoice(
                                            memo,
                                            satAmount.toString(),
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
                                    {localeString('views.Receive.noOnChain')}
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
                                    copyText={localeString(
                                        'views.Receive.copyAddress'
                                    )}
                                    theme={theme}
                                />
                            )}
                            {!(implementation === 'lndhub' && address) && (
                                <View style={styles.button}>
                                    <Button
                                        title={
                                            implementation === 'lndhub'
                                                ? localeString(
                                                      'views.Receive.getAddress'
                                                  )
                                                : localeString(
                                                      'views.Receive.getNewAddress'
                                                  )
                                        }
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
                            )}
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
