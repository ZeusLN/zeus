import * as React from 'react';
import {
    StyleSheet,
    Text,
    TextInput,
    View,
    ScrollView,
    Clipboard,
    TouchableOpacity
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { Button, Header, Icon } from 'react-native-elements';
import handleAnything from './../utils/handleAnything';

import InvoicesStore from './../stores/InvoicesStore';
import NodeInfoStore from './../stores/NodeInfoStore';
import TransactionsStore from './../stores/TransactionsStore';
import FeeStore from './../stores/FeeStore';
import BalanceStore from './../stores/BalanceStore';
import UTXOsStore from './../stores/UTXOsStore';
import SettingsStore from './../stores/SettingsStore';
import UnitsStore, { satoshisPerBTC } from './../stores/UnitsStore';
import FiatStore from './../stores/FiatStore';

import UTXOPicker from './../components/UTXOPicker';
import FeeTable from './../components/FeeTable';

import RESTUtils from './../utils/RESTUtils';
import { localeString } from './../utils/LocaleUtils';

interface SendProps {
    exitSetup: any;
    navigation: any;
    BalanceStore: BalanceStore;
    InvoicesStore: InvoicesStore;
    NodeInfoStore: NodeInfoStore;
    TransactionsStore: TransactionsStore;
    SettingsStore: SettingsStore;
    FiatStore: FiatStore;
    FeeStore: FeeStore;
    UnitsStore: UnitsStore;
    UTXOsStore: UTXOsStore;
}

interface SendState {
    isValid: boolean;
    transactionType: string | null;
    destination: string;
    amount: string;
    fee: string;
    error_msg: string;
    utxos: Array<string>;
    utxoBalance: number;
    confirmationTarget: string;
}

@inject(
    'InvoicesStore',
    'NodeInfoStore',
    'TransactionsStore',
    'BalanceStore',
    'SettingsStore',
    'UnitsStore',
    'FeeStore',
    'FiatStore',
    'UTXOsStore'
)
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
            fee: '2',
            utxos: [],
            utxoBalance: 0,
            confirmationTarget: '60',
            error_msg: ''
        };
    }

    async UNSAFE_componentWillMount() {
        const clipboard = await Clipboard.getString();
        if (!this.state.destination) {
            this.validateAddress(clipboard);
        }
    }

    componentDidMount() {
        if (this.state.destination) {
            this.validateAddress(this.state.destination);
        }
    }

    selectUTXOs = (utxos: Array<string>, utxoBalance: number) =>
        this.setState({ utxos, amount: 'all', utxoBalance });

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

    sendCoins = (satAmount: string | number) => {
        const { TransactionsStore, navigation } = this.props;
        const { destination, fee, utxos, confirmationTarget } = this.state;

        let request;
        if (utxos && utxos.length > 0) {
            request = {
                addr: destination,
                sat_per_byte: fee,
                amount: satAmount.toString(),
                target_conf: Number(confirmationTarget),
                utxos
            };
        } else {
            request = {
                addr: destination,
                sat_per_byte: fee,
                amount: satAmount.toString(),
                target_conf: Number(confirmationTarget)
            };
        }
        TransactionsStore.sendCoins(request);
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
        const {
            SettingsStore,
            UnitsStore,
            FeeStore,
            FiatStore,
            BalanceStore,
            UTXOsStore,
            navigation
        } = this.props;
        const {
            isValid,
            transactionType,
            destination,
            amount,
            fee,
            confirmationTarget,
            utxoBalance,
            error_msg
        } = this.state;
        const { confirmedBlockchainBalance } = BalanceStore;
        const { implementation, settings } = SettingsStore;
        const { theme, fiat } = settings;
        const { units, changeUnits } = UnitsStore;
        const { fiatRates }: any = FiatStore;

        const rate =
            fiat && fiat !== 'Disabled' && fiatRates
                ? fiatRates[fiat]['15m']
                : 0;

        let satAmount: string | number;
        switch (units) {
            case 'sats':
                satAmount = amount;
                break;
            case 'btc':
                satAmount = Number(amount) * satoshisPerBTC;
                break;
            case 'fiat':
                satAmount = Number(Number(amount) * rate).toFixed(0);
                break;
        }

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.navigate('Wallet')}
                color="#fff"
                underlayColor="transparent"
            />
        );

        const paymentOptions = [localeString('views.Send.lnPayment')];

        if (RESTUtils.supportsOnchainSends()) {
            paymentOptions.push(localeString('views.Send.btcAddress'));
        }
        if (RESTUtils.supportsKeysend()) {
            paymentOptions.push(localeString('views.Send.keysendAddress'));
        }

        const OnChain = () => (
            <React.Fragment>
                <TouchableOpacity onPress={() => changeUnits()}>
                    <Text
                        style={{
                            textDecorationLine: 'underline',
                            color:
                                theme === 'dark'
                                    ? 'white'
                                    : 'black'
                        }}
                    >
                        {localeString('views.Send.amount')} (
                        {units === 'fiat' ? fiat : units})
                    </Text>
                </TouchableOpacity>
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
                {units !== 'sats' && amount !== 'all' && (
                    <TouchableOpacity
                        onPress={() => changeUnits()}
                    >
                        <Text
                            style={{
                                textDecorationLine: 'underline',
                                color:
                                    theme === 'dark'
                                        ? 'white'
                                        : 'black'
                            }}
                        >
                            {satAmount}{' '}
                            {localeString(
                                'views.Send.satoshis'
                            )}
                        </Text>
                    </TouchableOpacity>
                )}
                {amount === 'all' && (
                    <Text
                        style={{
                            color:
                                theme === 'dark'
                                    ? 'white'
                                    : 'black'
                        }}
                    >
                        {`${
                            utxoBalance > 0
                                ? utxoBalance
                                : confirmedBlockchainBalance
                        } ${localeString(
                            'views.Receive.satoshis'
                        )}`}
                    </Text>
                )}
                <Text
                    style={{
                        textDecorationLine: 'underline',
                        color:
                            theme === 'dark' ? 'white' : 'black'
                    }}
                >
                    {localeString('views.Send.feeSats')}:
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
                {RESTUtils.supportsCoinControl() && (
                    <UTXOPicker
                        onValueChange={this.selectUTXOs}
                        UTXOsStore={UTXOsStore}
                    />
                )}
                <View style={styles.button}>
                    <Button
                        title={localeString(
                            'views.Send.sendCoins'
                        )}
                        icon={{
                            name: 'send',
                            size: 25,
                            color: 'white'
                        }}
                        onPress={() =>
                            this.sendCoins(satAmount)
                        }
                        style={styles.button}
                        buttonStyle={{
                            backgroundColor: 'orange',
                            borderRadius: 30
                        }}
                    />
                </View>
            </React.Fragment>
        );

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
                    centerComponent={{
                        text: localeString('views.Send.title'),
                        style: { color: '#fff' }
                    }}
                    backgroundColor="grey"
                />
                <View style={styles.content}>
                    <Text
                        style={{
                            textDecorationLine: 'underline',
                            color: theme === 'dark' ? 'white' : 'black'
                        }}
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
                            {localeString('views.Send.mustBeValid')}{' '}
                            {paymentOptions.join(', ')}
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
                                    textDecorationLine: 'underline',
                                    color: theme === 'dark' ? 'white' : 'black'
                                }}
                            >
                                {localeString('views.Send.onChainNotSupported')}{' '}
                                {implementation}
                            </Text>
                        )}
                    {transactionType === 'On-chain' &&
                        RESTUtils.supportsOnchainSends() && (
                            <OnChain />
                        )}
                    {transactionType === 'Keysend' && implementation === 'lnd' && (
                        <React.Fragment>
                            <TouchableOpacity onPress={() => changeUnits()}>
                                <Text
                                    style={{
                                        textDecorationLine: 'underline',
                                        color:
                                            theme === 'dark' ? 'white' : 'black'
                                    }}
                                >
                                    {localeString('views.Send.amount')} (
                                    {units === 'fiat' ? fiat : units})
                                </Text>
                            </TouchableOpacity>
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
                            {units !== 'sats' && (
                                <TouchableOpacity onPress={() => changeUnits()}>
                                    <Text
                                        style={{
                                            textDecorationLine: 'underline',
                                            color:
                                                theme === 'dark'
                                                    ? 'white'
                                                    : 'black'
                                        }}
                                    >
                                        {satAmount}{' '}
                                        {localeString('views.Send.satoshis')}
                                    </Text>
                                </TouchableOpacity>
                            )}
                            <View style={styles.button}>
                                <Button
                                    title={localeString('general.send')}
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
                                        textDecorationLine: 'underline',
                                        color:
                                            theme === 'dark' ? 'white' : 'black'
                                    }}
                                >
                                    {localeString('views.Send.sorry')},{' '}
                                    {implementation}{' '}
                                    {localeString(
                                        'views.Send.keysendNotSupported'
                                    )}
                                </Text>
                            </React.Fragment>
                        )}
                    {transactionType === 'Lightning' && (
                        <View style={styles.button}>
                            <Button
                                title={localeString('views.Send.lookup')}
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
                            title={localeString('general.scan')}
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

                    {transactionType === 'On-chain' &&
                        (implementation === 'eclair' ? (
                            <View style={styles.feeTableButton}>
                                <TextInput
                                    keyboardType="numeric"
                                    value={confirmationTarget}
                                    onChangeText={(text: string) =>
                                        this.setState({
                                            confirmationTarget: text
                                        })
                                    }
                                    style={
                                        theme === 'dark'
                                            ? styles.textInputDark
                                            : styles.textInput
                                    }
                                    placeholderTextColor="gray"
                                />
                            </View>
                        ) : (
                            <View style={styles.feeTableButton}>
                                <FeeTable
                                    setFee={this.setFee}
                                    SettingsStore={SettingsStore}
                                    FeeStore={FeeStore}
                                />
                            </View>
                        ))}

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
