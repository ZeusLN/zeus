import * as React from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import BalanceStore from '../../stores/BalanceStore';
import InvoicesStore from '../../stores/InvoicesStore';
import ModalStore from '../../stores/ModalStore';
import SettingsStore from '../../stores/SettingsStore';
import TransactionsStore from '../../stores/TransactionsStore';

import Amount from '../../components/Amount';
import Button from '../../components/Button';
import OnchainSendInFlightNotice from '../../components/OnchainSendInFlightNotice';
import { WarningMessage } from '../../components/SuccessErrorMessage';
import Header from '../../components/Header';
import OnchainFeeInput from '../../components/OnchainFeeInput';
import Screen from '../../components/Screen';
import TextInput from '../../components/TextInput';

import AddressUtils from '../../utils/AddressUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import TransactionRequest from '../../models/TransactionRequest';

interface SweepProps {
    exitSetup: any;
    navigation: NativeStackNavigationProp<any, any>;
    BalanceStore: BalanceStore;
    InvoicesStore: InvoicesStore;
    ModalStore: ModalStore;
    TransactionsStore: TransactionsStore;
    SettingsStore: SettingsStore;
    route: Route<'Sweep', { destination: string }>;
}

interface SweepState {
    destination: string;
    isValid: boolean;
    fee: string;
}

@inject(
    'InvoicesStore',
    'ModalStore',
    'TransactionsStore',
    'BalanceStore',
    'SettingsStore'
)
@observer
export default class Sweep extends React.Component<SweepProps, SweepState> {
    // set by the first confirmation on each visit to this screen. The
    // store's guard ends when the sweep answers, which a local node can do
    // before SendingOnChain covers this screen, so a second tap would start
    // a second sweep. Try Again comes back here, and the focus event
    // re-arms the button.
    private confirmed = false;
    private focusListener: (() => void) | undefined;

    constructor(props: SweepProps) {
        super(props);
        const { route } = props;
        const destination = route.params?.destination;

        this.state = {
            destination: destination || '',
            isValid: true,
            fee: '2'
        };
    }

    componentDidMount() {
        this.focusListener = this.props.navigation.addListener('focus', () => {
            this.confirmed = false;
        });
    }

    componentWillUnmount() {
        if (this.focusListener) {
            this.focusListener();
        }
    }

    componentDidUpdate(prevProps: SweepProps) {
        if (
            this.props.route.params?.destination !==
            prevProps.route.params?.destination
        ) {
            this.setState({
                destination: this.props.route.params?.destination
            });
        }
    }

    sendCoins = () => {
        const { SettingsStore, TransactionsStore, navigation } = this.props;

        // an earlier send still holds the store's guard, so sendCoins would
        // refuse this one and SendingOnChain would show the earlier send's
        // outcome as this one's
        if (this.confirmed || TransactionsStore.onchainSendInFlight) return;
        this.confirmed = true;

        const { destination, fee } = this.state;
        const { implementation } = SettingsStore;

        let request: TransactionRequest;
        request =
            implementation === 'cln-rest'
                ? {
                      addr: destination,
                      sat_per_vbyte: fee,
                      amount: 'all',
                      spend_unconfirmed: true
                  }
                : {
                      addr: destination,
                      sat_per_vbyte: fee,
                      send_all: true,
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

    validateAddress = (destination: string) => {
        const isValid = AddressUtils.isValidBitcoinAddressForNode(destination);
        this.setState({
            isValid,
            destination
        });
    };

    render() {
        const { BalanceStore, TransactionsStore, navigation } = this.props;
        const { destination, isValid, fee } = this.state;
        const { confirmedBlockchainBalance, unconfirmedBlockchainBalance } =
            BalanceStore;

        const noOnchainBalance =
            confirmedBlockchainBalance === 0 &&
            unconfirmedBlockchainBalance === 0;

        const disabled = !destination || !isValid || noOnchainBalance;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Sweep.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'Roboto-Regular'
                        }
                    }}
                    navigation={navigation}
                />
                <ScrollView
                    style={styles.content}
                    keyboardShouldPersistTaps="handled"
                >
                    {!!destination && noOnchainBalance && (
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
                    <TextInput
                        placeholder={'bc1...'}
                        value={destination}
                        error={!isValid}
                        onChangeText={(text: string) => {
                            this.validateAddress(text);
                        }}
                    />

                    <React.Fragment>
                        <View style={{ paddingBottom: 15 }}>
                            <>
                                <Text
                                    style={{
                                        fontFamily: 'Roboto-Regular',
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {localeString(
                                        'views.Sweep.confirmedBalance'
                                    )}
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
                                        fontFamily: 'Roboto-Regular',
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {localeString(
                                        'views.Sweep.unconfirmedBalance'
                                    )}
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
                            navigation={navigation}
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
                            <OnchainSendInFlightNotice
                                TransactionsStore={TransactionsStore}
                            />
                            <Button
                                title={localeString('views.Send.sendCoins')}
                                icon={
                                    !disabled && {
                                        name: 'send',
                                        size: 25
                                    }
                                }
                                onPress={() => this.sendCoins()}
                                disabled={
                                    disabled ||
                                    TransactionsStore.onchainSendInFlight
                                }
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
        fontFamily: 'Roboto-Regular'
    },
    secondaryText: {
        fontFamily: 'Roboto-Regular'
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
        fontFamily: 'Roboto-Regular',
        paddingTop: 5
    }
});
