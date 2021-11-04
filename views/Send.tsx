import * as React from 'react';
import {
    StyleSheet,
    Text,
    TextInput,
    View,
    ScrollView,
    TouchableOpacity,
    TouchableWithoutFeedback
} from 'react-native';
import Clipboard from '@react-native-community/clipboard';
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
import { themeColor } from './../utils/ThemeUtils';

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
    maxParts: string;
    maxShardAmt: string;
    timeoutSeconds: string;
    feeLimitSat: string;
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
            error_msg: '',
            maxParts: '16',
            maxShardAmt: '',
            timeoutSeconds: '20',
            feeLimitSat: ''
        };
    }

    async UNSAFE_componentWillMount() {
        const { SettingsStore } = this.props;
        const { settings } = SettingsStore;

        if (settings.privacy && settings.privacy.clipboard) {
            const clipboard = await Clipboard.getString();
            if (!this.state.destination) {
                this.validateAddress(clipboard);
            }
        }
    }

    componentDidMount() {
        if (this.state.destination) {
            this.validateAddress(this.state.destination);
        }
    }

    selectUTXOs = (utxos: Array<string>, utxoBalance: number) => {
        const { SettingsStore } = this.props;
        const { implementation } = SettingsStore;
        let newState: any = {};
        newState.utxos = utxos;
        newState.utxoBalance = utxoBalance;
        if (implementation === 'c-lightning-REST') {
            newState.amount = 'all';
        }
        this.setState(newState);
    };

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
        const {
            destination,
            amount,
            maxParts,
            maxShardAmt,
            timeoutSeconds,
            feeLimitSat
        } = this.state;

        if (RESTUtils.supportsAMP()) {
            TransactionsStore.sendPayment({
                amount,
                pubkey: destination,
                max_parts: maxParts,
                max_shard_amt: maxShardAmt,
                timeout_seconds: timeoutSeconds,
                fee_limit_sat: feeLimitSat,
                amp: true
            });
        } else {
            TransactionsStore.sendPayment({ amount, pubkey: destination });
        }

        navigation.navigate('SendingLightning');
    };

    setFee = (text: string) => {
        this.setState({ fee: text });
    };

    handleOnNavigateBack = (fee: string) => {
        this.setState({
            fee
        });
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
            error_msg,
            maxParts,
            maxShardAmt,
            timeoutSeconds,
            feeLimitSat
        } = this.state;
        const { confirmedBlockchainBalance } = BalanceStore;
        const { implementation, settings } = SettingsStore;
        const { fiat } = settings;
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
                satAmount = Number(Number(amount) / rate).toFixed(0);
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

        return (
            <ScrollView
                style={{
                    flex: 1,
                    backgroundColor: themeColor('background')
                }}
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
                        style={{ ...styles.label, color: themeColor('text') }}
                    >
                        {paymentOptions.join(', ')}
                    </Text>
                    <TextInput
                        placeholder={'lnbc1...'}
                        value={destination}
                        onChangeText={(text: string) => {
                            this.validateAddress(text);
                        }}
                        style={{
                            ...styles.textInput,
                            color: themeColor('text')
                        }}
                        placeholderTextColor="gray"
                    />
                    {!isValid && !!destination && (
                        <Text
                            style={{
                                ...styles.text,
                                color: themeColor('text')
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
                                ...styles.text
                            }}
                        >{`${transactionType} Transaction`}</Text>
                    )}
                    {transactionType === 'On-chain' &&
                        !RESTUtils.supportsOnchainSends() && (
                            <Text
                                style={{
                                    ...styles.label,
                                    color: themeColor('text')
                                }}
                            >
                                {localeString('views.Send.onChainNotSupported')}{' '}
                                {implementation}
                            </Text>
                        )}
                    {transactionType === 'On-chain' &&
                        RESTUtils.supportsOnchainSends() && (
                            <React.Fragment>
                                <TouchableOpacity onPress={() => changeUnits()}>
                                    <Text
                                        style={{
                                            ...styles.label,
                                            color: themeColor('text')
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
                                    style={{
                                        ...styles.textInput,
                                        color: themeColor('text')
                                    }}
                                    placeholderTextColor="gray"
                                />
                                {units !== 'sats' && amount !== 'all' && (
                                    <TouchableOpacity
                                        onPress={() => changeUnits()}
                                    >
                                        <Text
                                            style={{
                                                ...styles.label,
                                                color: themeColor('text')
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
                                            ...styles.text,
                                            color: themeColor('text')
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
                                        ...styles.label,
                                        color: themeColor('text')
                                    }}
                                >
                                    {localeString('views.Send.feeSats')}:
                                </Text>
                                <TouchableWithoutFeedback
                                    onPress={() =>
                                        navigation.navigate('EditFee', {
                                            onNavigateBack: this
                                                .handleOnNavigateBack
                                        })
                                    }
                                >
                                    <View
                                        style={{
                                            ...styles.editFeeBox,

                                            borderColor:
                                                'rgba(255, 217, 63, .6)',
                                            borderWidth: 3
                                        }}
                                    >
                                        <Text
                                            style={{
                                                ...styles.text,
                                                fontSize: 18
                                            }}
                                        >
                                            {fee}
                                        </Text>
                                    </View>
                                </TouchableWithoutFeedback>

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
                        )}
                    {transactionType === 'Keysend' &&
                        RESTUtils.supportsKeysend() && (
                            <React.Fragment>
                                <TouchableOpacity onPress={() => changeUnits()}>
                                    <Text
                                        style={{
                                            ...styles.label,
                                            color: themeColor('text')
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
                                    style={{
                                        ...styles.textInput,
                                        color: themeColor('text')
                                    }}
                                    placeholderTextColor="gray"
                                />
                                {units !== 'sats' && (
                                    <TouchableOpacity
                                        onPress={() => changeUnits()}
                                    >
                                        <Text
                                            style={{
                                                ...styles.label,
                                                color: themeColor('text')
                                            }}
                                        >
                                            {satAmount}{' '}
                                            {localeString(
                                                'views.Send.satoshis'
                                            )}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                                {RESTUtils.supportsAMP() && (
                                    <React.Fragment>
                                        <Text
                                            style={{
                                                ...styles.label,
                                                color: themeColor('text')
                                            }}
                                        >
                                            {localeString(
                                                'views.PaymentRequest.timeout'
                                            )}
                                            :
                                        </Text>
                                        <TextInput
                                            keyboardType="numeric"
                                            placeholder="20"
                                            value={timeoutSeconds}
                                            onChangeText={(text: string) =>
                                                this.setState({
                                                    timeoutSeconds: text
                                                })
                                            }
                                            numberOfLines={1}
                                            style={{
                                                ...styles.textInput,
                                                color: themeColor('text')
                                            }}
                                            placeholderTextColor="gray"
                                        />
                                        <Text
                                            style={{
                                                ...styles.label,
                                                color: themeColor('text')
                                            }}
                                        >
                                            {`${localeString(
                                                'views.PaymentRequest.maxParts'
                                            )} (${localeString(
                                                'general.optional'
                                            )})`}
                                            :
                                        </Text>
                                        <TextInput
                                            keyboardType="numeric"
                                            value={maxParts}
                                            onChangeText={(text: string) =>
                                                this.setState({
                                                    maxParts: text
                                                })
                                            }
                                            numberOfLines={1}
                                            style={{
                                                ...styles.textInput,
                                                color: themeColor('text')
                                            }}
                                            placeholderTextColor="gray"
                                        />
                                        <Text
                                            style={{
                                                ...styles.text,
                                                color: themeColor('text')
                                            }}
                                        >
                                            {localeString(
                                                'views.PaymentRequest.maxPartsDescription'
                                            )}
                                        </Text>
                                        <Text
                                            style={{
                                                ...styles.label,
                                                color: themeColor('text')
                                            }}
                                        >
                                            {`${localeString(
                                                'views.PaymentRequest.feeLimit'
                                            )} (${localeString(
                                                'general.sats'
                                            )}) (${localeString(
                                                'general.optional'
                                            )})`}
                                            :
                                        </Text>
                                        <TextInput
                                            keyboardType="numeric"
                                            placeholder="100"
                                            value={feeLimitSat}
                                            onChangeText={(text: string) =>
                                                this.setState({
                                                    feeLimitSat: text
                                                })
                                            }
                                            numberOfLines={1}
                                            style={{
                                                ...styles.textInput,
                                                color: themeColor('text')
                                            }}
                                            placeholderTextColor="gray"
                                        />
                                        <Text
                                            style={{
                                                ...styles.label,
                                                color: themeColor('text')
                                            }}
                                        >
                                            {`${localeString(
                                                'views.PaymentRequest.maxShardAmt'
                                            )} (${localeString(
                                                'general.sats'
                                            )}) (${localeString(
                                                'general.optional'
                                            )})`}
                                            :
                                        </Text>
                                        <TextInput
                                            keyboardType="numeric"
                                            value={maxShardAmt}
                                            onChangeText={(text: string) =>
                                                this.setState({
                                                    maxShardAmt: text
                                                })
                                            }
                                            numberOfLines={1}
                                            style={{
                                                ...styles.textInput,
                                                color: themeColor('text')
                                            }}
                                            placeholderTextColor="gray"
                                        />
                                    </React.Fragment>
                                )}
                                <View style={styles.button}>
                                    <Button
                                        title={localeString('general.send')}
                                        icon={{
                                            name: 'send',
                                            size: 25,
                                            color: 'white'
                                        }}
                                        onPress={() =>
                                            this.sendKeySendPayment()
                                        }
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
                                        ...styles.label,
                                        color: themeColor('text')
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
                                backgroundColor: '#261339',
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
                                    style={{
                                        ...styles.textInput,
                                        color: themeColor('text')
                                    }}
                                    placeholderTextColor="gray"
                                />
                            </View>
                        ) : (
                            <View style={styles.feeTableButton}>
                                <FeeTable
                                    setFee={this.setFee}
                                    FeeStore={FeeStore}
                                />
                            </View>
                        ))}

                    {!!error_msg && (
                        <React.Fragment>
                            <Text
                                style={{
                                    ...styles.text,
                                    color: themeColor('text')
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
    editFeeBox: {
        height: 65,
        padding: 15,
        marginTop: 15,
        borderRadius: 4,
        borderColor: '#FFD93F',
        borderWidth: 2
    },
    label: {
        textDecorationLine: 'underline'
    },
    text: {
        paddingBottom: 5
    },
    textInput: {
        fontSize: 20,
        paddingTop: 10,
        paddingBottom: 10
    },
    content: {
        padding: 20
    },
    button: {
        alignItems: 'center',
        paddingTop: 30
    },
    feeTableButton: {
        paddingTop: 15,
        alignItems: 'center',
        minHeight: 75
    },
    editFeeButton: {
        paddingTop: 15,
        alignItems: 'center'
    }
});
