import * as React from 'react';
import {
    Platform,
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    TouchableWithoutFeedback
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { inject, observer } from 'mobx-react';
import { Header, Icon } from 'react-native-elements';

import NfcManager, { NfcEvents } from 'react-native-nfc-manager';

import handleAnything from './../utils/handleAnything';

import InvoicesStore from './../stores/InvoicesStore';
import NodeInfoStore from './../stores/NodeInfoStore';
import TransactionsStore from './../stores/TransactionsStore';
import BalanceStore from './../stores/BalanceStore';
import UTXOsStore from './../stores/UTXOsStore';
import SettingsStore from './../stores/SettingsStore';
import UnitsStore, { satoshisPerBTC } from './../stores/UnitsStore';
import FiatStore from './../stores/FiatStore';

import { Amount } from './../components/Amount';
import Button from './../components/Button';
import { ErrorMessage } from './../components/SuccessErrorMessage';
import TextInput from './../components/TextInput';
import UTXOPicker from './../components/UTXOPicker';

import RESTUtils from './../utils/RESTUtils';
import NFCUtils from './../utils/NFCUtils';
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
    feeLimitSat: string;
    message: string;
}

@inject(
    'InvoicesStore',
    'NodeInfoStore',
    'TransactionsStore',
    'BalanceStore',
    'SettingsStore',
    'UnitsStore',
    'FiatStore',
    'UTXOsStore'
)
@observer
export default class Send extends React.Component<SendProps, SendState> {
    constructor(props: any) {
        super(props);
        const { navigation } = props;
        const destination = navigation.getParam('destination', null);
        const amount = navigation.getParam('amount', '');
        const transactionType = navigation.getParam('transactionType', null);
        const isValid = navigation.getParam('isValid', null);

        this.state = {
            isValid: isValid || false,
            transactionType,
            destination: destination || '',
            amount,
            fee: '2',
            utxos: [],
            utxoBalance: 0,
            confirmationTarget: '60',
            error_msg: '',
            maxParts: '16',
            maxShardAmt: '',
            feeLimitSat: '',
            message: ''
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

    async componentDidMount() {
        if (this.state.destination) {
            this.validateAddress(this.state.destination);
        }

        if (Platform.OS === 'android') {
            await this.enableNfc();
        }
    }

    disableNfc = () => {
        NfcManager.setEventListener(NfcEvents.DiscoverTag, null);
        NfcManager.setEventListener(NfcEvents.SessionClosed, null);
    };

    enableNfc = async () => {
        this.disableNfc();
        await NfcManager.start();

        return new Promise((resolve: any) => {
            let tagFound = null;

            NfcManager.setEventListener(NfcEvents.DiscoverTag, (tag: any) => {
                tagFound = tag;
                const bytes = new Uint8Array(tagFound.ndefMessage[0].payload);
                const str = NFCUtils.nfcUtf8ArrayToStr(bytes);
                resolve(this.validateAddress(str));
                NfcManager.unregisterTagEvent().catch(() => 0);
            });

            NfcManager.setEventListener(NfcEvents.SessionClosed, () => {
                if (!tagFound) {
                    resolve();
                }
            });

            NfcManager.registerTagEvent();
        });
    };

    selectUTXOs = (utxos: Array<string>, utxoBalance: number) => {
        const { SettingsStore } = this.props;
        const { implementation } = SettingsStore;
        const newState: any = {};
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
            .catch((err) => {
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

    sendKeySendPayment = (satAmount: string | number) => {
        const { TransactionsStore, navigation } = this.props;
        const { destination, maxParts, maxShardAmt, feeLimitSat, message } =
            this.state;

        if (RESTUtils.supportsAMP()) {
            TransactionsStore.sendPayment({
                amount: satAmount.toString(),
                pubkey: destination,
                message,
                max_parts: maxParts,
                max_shard_amt: maxShardAmt,
                fee_limit_sat: feeLimitSat,
                amp: true
            });
        } else {
            TransactionsStore.sendPayment({
                amount: satAmount.toString(),
                pubkey: destination,
                message
            });
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
            feeLimitSat,
            message
        } = this.state;
        const { confirmedBlockchainBalance } = BalanceStore;
        const { implementation, settings } = SettingsStore;
        const { fiat, privacy } = settings;
        const enableMempoolRates = privacy && privacy.enableMempoolRates;
        const { units, changeUnits } = UnitsStore;
        const { fiatRates }: any = FiatStore;

        const fiatEntry =
            fiat && fiatRates && fiatRates.filter
                ? fiatRates.filter((entry: any) => entry.code === fiat)[0]
                : null;

        const rate =
            fiat && fiat !== 'Disabled' && fiatRates && fiatEntry
                ? fiatEntry.rate
                : 0;

        let satAmount: string | number;
        switch (units) {
            case 'sats':
                satAmount = amount;
                break;
            case 'BTC':
                satAmount = Number(amount) * satoshisPerBTC;
                break;
            case 'fiat':
                satAmount = Number(
                    (Number(amount) / Number(rate)) * Number(satoshisPerBTC)
                ).toFixed(0);
                break;
        }

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.navigate('Wallet')}
                color={themeColor('text')}
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
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'Lato-Regular'
                        }
                    }}
                    backgroundColor={themeColor('background')}
                    containerStyle={{
                        borderBottomWidth: 0
                    }}
                />
                <View style={styles.content}>
                    <Text
                        style={{
                            ...styles.secondaryText,
                            color: themeColor('secondaryText')
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
                        style={styles.textInput}
                        autoCorrect={false}
                    />
                    {!!error_msg && !!destination && (
                        <View style={{ paddingTop: 10, paddingBottom: 10 }}>
                            <ErrorMessage message={error_msg} />
                        </View>
                    )}
                    {!isValid && !!destination && (
                        <Text
                            style={{
                                ...styles.text,
                                color: themeColor('text'),
                                paddingBottom: 5
                            }}
                        >
                            {localeString('views.Send.mustBeValid')}{' '}
                            {paymentOptions.join(', ')}
                        </Text>
                    )}
                    {transactionType && (
                        <Text
                            style={{
                                ...styles.text,
                                color: themeColor('text'),
                                paddingBottom: 10,
                                marginBottom: 10,
                                paddingBottom: 5
                            }}
                        >{`${transactionType} Transaction`}</Text>
                    )}
                    {transactionType === 'On-chain' &&
                        !RESTUtils.supportsOnchainSends() && (
                            <Text
                                style={{
                                    ...styles.secondaryText,
                                    color: themeColor('secondaryText')
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
                                            ...styles.secondaryText,
                                            color: themeColor('secondaryText')
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
                                    style={styles.textInput}
                                />
                                <View style={{ paddingBottom: 15 }}>
                                    {units !== 'sats' && amount !== 'all' && (
                                        <Amount
                                            sats={satAmount}
                                            fixedUnits="sats"
                                            toggleable
                                        />
                                    )}
                                    {units !== 'BTC' && amount !== 'all' && (
                                        <Amount
                                            sats={satAmount}
                                            fixedUnits="BTC"
                                            toggleable
                                        />
                                    )}
                                    {amount === 'all' && (
                                        <>
                                            <Amount
                                                sats={
                                                    utxoBalance > 0
                                                        ? utxoBalance
                                                        : confirmedBlockchainBalance
                                                }
                                                fixedUnits="BTC"
                                                toggleable
                                            />
                                            <Amount
                                                sats={
                                                    utxoBalance > 0
                                                        ? utxoBalance
                                                        : confirmedBlockchainBalance
                                                }
                                                fixedUnits="sats"
                                                toggleable
                                            />
                                        </>
                                    )}
                                    {units === 'fiat' && (
                                        <TouchableOpacity
                                            onPress={() => changeUnits()}
                                        >
                                            <Text
                                                style={{
                                                    ...styles.text,
                                                    color: themeColor('text')
                                                }}
                                            >
                                                {FiatStore.getRate()}
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </View>

                                <Text
                                    style={{
                                        ...styles.secondaryText,
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {localeString('views.Send.feeSats')}:
                                </Text>
                                {enableMempoolRates ? (
                                    <TouchableWithoutFeedback
                                        onPress={() =>
                                            navigation.navigate('EditFee', {
                                                onNavigateBack:
                                                    this.handleOnNavigateBack
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
                                                    color: themeColor('text'),
                                                    paddingBottom: 5,
                                                    fontSize: 18
                                                }}
                                            >
                                                {fee}
                                            </Text>
                                        </View>
                                    </TouchableWithoutFeedback>
                                ) : (
                                    <TextInput
                                        keyboardType="numeric"
                                        value={fee}
                                        onChangeText={(text: string) =>
                                            this.setState({ fee: text })
                                        }
                                        style={styles.textInput}
                                    />
                                )}

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
                                            size: 25
                                        }}
                                        onPress={() =>
                                            this.sendCoins(satAmount)
                                        }
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
                                            ...styles.secondaryText,
                                            color: themeColor('secondaryText')
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
                                    style={styles.textInput}
                                />
                                {units !== 'sats' && (
                                    <TouchableOpacity
                                        onPress={() => changeUnits()}
                                    >
                                        <Text
                                            style={{
                                                ...styles.secondaryText,
                                                color: themeColor(
                                                    'secondaryText'
                                                )
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
                                                ...styles.secondaryText,
                                                color: themeColor(
                                                    'secondaryText'
                                                )
                                            }}
                                        >
                                            {`${localeString(
                                                'views.Send.message'
                                            )} (${localeString(
                                                'general.optional'
                                            )})`}
                                            :
                                        </Text>
                                        <TextInput
                                            keyboardType="default"
                                            value={message}
                                            onChangeText={(text: string) =>
                                                this.setState({
                                                    message: text
                                                })
                                            }
                                            style={styles.textInput}
                                        />
                                        <Text
                                            style={{
                                                ...styles.secondaryText,
                                                color: themeColor(
                                                    'secondaryText'
                                                )
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
                                            style={styles.textInput}
                                        />
                                        <Text
                                            style={{
                                                ...styles.text,
                                                color: themeColor('text'),
                                                paddingBottom: 15
                                            }}
                                        >
                                            {localeString(
                                                'views.PaymentRequest.maxPartsDescription'
                                            )}
                                        </Text>
                                        <Text
                                            style={{
                                                ...styles.secondaryText,
                                                color: themeColor(
                                                    'secondaryText'
                                                )
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
                                            style={styles.textInput}
                                        />
                                        <Text
                                            style={{
                                                ...styles.secondaryText,
                                                color: themeColor(
                                                    'secondaryText'
                                                )
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
                                            style={styles.textInput}
                                        />
                                    </React.Fragment>
                                )}
                                <View style={styles.button}>
                                    <Button
                                        title={localeString('general.send')}
                                        icon={{
                                            name: 'send',
                                            size: 25
                                        }}
                                        onPress={() =>
                                            this.sendKeySendPayment(satAmount)
                                        }
                                    />
                                </View>
                            </React.Fragment>
                        )}
                    {transactionType === 'Keysend' &&
                        !RESTUtils.supportsKeysend() && (
                            <React.Fragment>
                                <Text
                                    style={{
                                        ...styles.secondaryText,
                                        color: themeColor('secondaryText')
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
                                    size: 25
                                }}
                                onPress={() =>
                                    navigation.navigate('PaymentRequest')
                                }
                            />
                        </View>
                    )}
                    <View style={styles.button}>
                        <Button
                            title={localeString('general.scan')}
                            icon={{
                                name: 'crop-free',
                                size: 25
                            }}
                            onPress={() =>
                                navigation.navigate('AddressQRCodeScanner')
                            }
                            secondary
                        />
                    </View>

                    {Platform.OS === 'ios' && (
                        <View style={styles.button}>
                            <Button
                                title={localeString('general.enableNfc')}
                                icon={{
                                    name: 'nfc',
                                    size: 25
                                }}
                                onPress={() => this.enableNfc()}
                                secondary
                            />
                        </View>
                    )}

                    {transactionType === 'On-chain' &&
                        implementation === 'eclair' && (
                            <View style={styles.feeTableButton}>
                                <TextInput
                                    keyboardType="numeric"
                                    value={confirmationTarget}
                                    onChangeText={(text: string) =>
                                        this.setState({
                                            confirmationTarget: text
                                        })
                                    }
                                    style={styles.textInput}
                                />
                            </View>
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
        borderWidth: 2,
        marginBottom: 20
    },
    text: {
        fontFamily: 'Lato-Regular'
    },
    secondaryText: {
        fontFamily: 'Lato-Regular'
    },
    textInput: {
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
