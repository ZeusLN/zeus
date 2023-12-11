import * as React from 'react';
import {
    NativeModules,
    NativeEventEmitter,
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity
} from 'react-native';

import { inject, observer } from 'mobx-react';

import BalanceStore from '../stores/BalanceStore';
import InvoicesStore from '../stores/InvoicesStore';
import ModalStore from '../stores/ModalStore';
import NodeInfoStore from '../stores/NodeInfoStore';
import SettingsStore from '../stores/SettingsStore';
import TransactionsStore from '../stores/TransactionsStore';

import Amount from '../components/Amount';
import Button from '../components/Button';
import {
    WarningMessage,
    ErrorMessage
} from '../components/SuccessErrorMessage';
import Header from '../components/Header';
import OnchainFeeInput from '../components/OnchainFeeInput';
import Screen from '../components/Screen';

import BackendUtils from '../utils/BackendUtils';
import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import Scan from '../assets/images/SVG/Scan.svg';

interface SweepProps {
    exitSetup: any;
    navigation: any;
    BalanceStore: BalanceStore;
    InvoicesStore: InvoicesStore;
    ModalStore: ModalStore;
    NodeInfoStore: NodeInfoStore;
    TransactionsStore: TransactionsStore;
    SettingsStore: SettingsStore;
}

interface SweepState {
    destination: string;
    fee: string;
    error_msg: string;
    confirmationTarget: string;
}

@inject(
    'InvoicesStore',
    'ModalStore',
    'NodeInfoStore',
    'TransactionsStore',
    'BalanceStore',
    'SettingsStore'
)
@observer
export default class Sweep extends React.Component<SweepProps, SweepState> {
    listener: any;
    constructor(props: SweepProps) {
        super(props);
        const { navigation } = props;
        const destination = navigation.getParam('destination', null);

        this.state = {
            destination: destination || '',
            fee: '2',
            confirmationTarget: '60',
            error_msg: ''
        };
    }

    async UNSAFE_componentWillMount() {
        if (this.listener && this.listener.stop) this.listener.stop();
    }

    UNSAFE_componentWillReceiveProps(nextProps: any) {
        const { navigation } = nextProps;
        const destination = navigation.getParam('destination', null);
        const amount = navigation.getParam('amount', null);

        this.setState({
            destination
        });

        if (amount) {
            this.setState({
                amount
            });
        }
    }

    subscribePayment = (streamingCall: string) => {
        const { handlePayment, handlePaymentError } =
            this.props.TransactionsStore;
        const { LncModule } = NativeModules;
        const eventEmitter = new NativeEventEmitter(LncModule);
        this.listener = eventEmitter.addListener(
            streamingCall,
            (event: any) => {
                if (event.result && event.result !== 'EOF') {
                    try {
                        const result = JSON.parse(event.result);
                        if (result && result.status !== 'IN_FLIGHT') {
                            handlePayment(result);
                            this.listener = null;
                        }
                    } catch (error: any) {
                        handlePaymentError(event.result);
                        this.listener = null;
                    }
                }
            }
        );
    };

    sendCoins = () => {
        const { SettingsStore, TransactionsStore, navigation } = this.props;
        const { destination, fee, confirmationTarget } = this.state;
        const { implementation } = SettingsStore;

        let request;
        request =
            implementation === 'c-lightning-REST'
                ? {
                      addr: destination,
                      sat_per_vbyte: fee,
                      amount: 'all',
                      target_conf: Number(confirmationTarget),
                      spend_unconfirmed: true
                  }
                : {
                      addr: destination,
                      sat_per_vbyte: fee,
                      send_all: true,
                      target_conf: Number(confirmationTarget),
                      spend_unconfirmed: true
                  };
        TransactionsStore.sendCoins(request);
        navigation.navigate('SendingOnChain');
    };

    handleOnNavigateBack = (fee: string) => {
        this.setState({
            fee
        });
    };

    render() {
        const { BalanceStore, navigation } = this.props;
        const { destination, fee, error_msg } = this.state;
        const { confirmedBlockchainBalance, unconfirmedBlockchainBalance } =
            BalanceStore;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Sweep.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={
                        <View style={{ flex: 1, flexDirection: 'row' }}>
                            <View style={{ marginTop: 3 }}>
                                <TouchableOpacity
                                    onPress={() =>
                                        navigation.navigate(
                                            'HandleAnythingQRScanner'
                                        )
                                    }
                                >
                                    <Scan
                                        fill={themeColor('text')}
                                        width={30}
                                        height={30}
                                    />
                                </TouchableOpacity>
                            </View>
                        </View>
                    }
                    navigation={navigation}
                />
                <ScrollView
                    style={styles.content}
                    keyboardShouldPersistTaps="handled"
                >
                    {!!destination &&
                        BackendUtils.supportsOnchainSends() &&
                        confirmedBlockchainBalance === 0 &&
                        unconfirmedBlockchainBalance === 0 && (
                            <View style={{ paddingTop: 10, paddingBottom: 10 }}>
                                <WarningMessage
                                    message={localeString(
                                        'views.Send.noOnchainBalance'
                                    )}
                                />
                            </View>
                        )}
                    <Text
                        style={{
                            ...styles.text,
                            color: themeColor('secondaryText')
                        }}
                    >
                        {localeString('views.Transaction.destAddress')}
                    </Text>
                    <Text
                        style={{
                            color: themeColor('text'),
                            paddingVertical: 10,
                            paddingHorizontal: 15,
                            marginBottom: 10
                        }}
                    >
                        {destination}
                    </Text>

                    {!!error_msg && !!destination && (
                        <View style={{ paddingTop: 10, paddingBottom: 10 }}>
                            <ErrorMessage message={error_msg} />
                        </View>
                    )}

                    <React.Fragment>
                        <View style={{ paddingBottom: 15 }}>
                            <>
                                <Text
                                    style={{
                                        fontFamily: 'PPNeueMontreal-Book',
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {`${localeString(
                                        'general.confirmed'
                                    )} ${localeString(
                                        'views.Settings.Display.DefaultView.balance'
                                    )}`}
                                </Text>
                                <Amount
                                    sats={confirmedBlockchainBalance}
                                    toggleable
                                />
                            </>
                        </View>

                        <View style={{ paddingBottom: 15 }}>
                            <>
                                <Text
                                    style={{
                                        fontFamily: 'PPNeueMontreal-Book',
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {`${localeString(
                                        'general.unconfirmed'
                                    )} ${localeString(
                                        'views.Settings.Display.DefaultView.balance'
                                    )}`}
                                </Text>
                                <Amount
                                    sats={unconfirmedBlockchainBalance}
                                    toggleable
                                />
                            </>
                        </View>

                        <Text
                            style={{
                                ...styles.text,
                                color: themeColor('secondaryText')
                            }}
                        >
                            {localeString('views.Send.feeSatsVbyte')}:
                        </Text>

                        <OnchainFeeInput
                            fee={fee}
                            onChangeFee={(text: string) =>
                                this.setState({ fee: text })
                            }
                        />

                        <Text
                            style={{
                                ...styles.text,
                                color: themeColor('secondaryText')
                            }}
                        >
                            {localeString('views.Sweep.explainer')}
                        </Text>

                        <View style={styles.button}>
                            <Button
                                title={localeString('views.Send.sendCoins')}
                                icon={{
                                    name: 'send',
                                    size: 25
                                }}
                                onPress={() => this.sendCoins()}
                            />
                        </View>
                    </React.Fragment>
                </ScrollView>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    text: {
        fontFamily: 'PPNeueMontreal-Book'
    },
    secondaryText: {
        fontFamily: 'PPNeueMontreal-Book'
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
    },
    label: {
        fontFamily: 'PPNeueMontreal-Book',
        paddingTop: 5
    }
});
