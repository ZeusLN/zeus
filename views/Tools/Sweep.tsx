import * as React from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { inject, observer } from 'mobx-react';
import BigNumber from 'bignumber.js';
import { Route } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import BalanceStore from '../../stores/BalanceStore';
import InvoicesStore from '../../stores/InvoicesStore';
import ModalStore from '../../stores/ModalStore';
import SettingsStore from '../../stores/SettingsStore';

import Amount from '../../components/Amount';
import Button from '../../components/Button';
import { WarningMessage } from '../../components/SuccessErrorMessage';
import Header from '../../components/Header';
import OnchainFeeInput from '../../components/OnchainFeeInput';
import Screen from '../../components/Screen';
import TextInput from '../../components/TextInput';

import AddressUtils from '../../utils/AddressUtils';
import { isPlausibleSatPerVbyte } from '../../utils/FeeUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

interface SweepProps {
    exitSetup: any;
    navigation: NativeStackNavigationProp<any, any>;
    BalanceStore: BalanceStore;
    InvoicesStore: InvoicesStore;
    ModalStore: ModalStore;
    SettingsStore: SettingsStore;
    route: Route<'Sweep', { destination: string }>;
}

interface SweepState {
    destination: string;
    isValid: boolean;
    fee: string;
}

@inject('InvoicesStore', 'ModalStore', 'BalanceStore', 'SettingsStore')
@observer
export default class Sweep extends React.Component<SweepProps, SweepState> {
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

    // What a sweep can spend. CLN's withdraw spends confirmed outputs only
    // (minconf defaults to 1, and CLNRest.sendCoins does not pass
    // spend_unconfirmed on)
    sweepableSats = (): BigNumber => {
        const { BalanceStore, SettingsStore } = this.props;
        return new BigNumber(BalanceStore.confirmedBlockchainBalance || 0).plus(
            SettingsStore.implementation === 'cln-rest'
                ? 0
                : BalanceStore.unconfirmedBlockchainBalance || 0
        );
    };

    // A sweep spends the whole balance at the fee rate in the input, which
    // starts at a default the user may not have changed. As with Send's
    // on-chain flow, VerifyOnChain shows amount, destination and rate, and
    // its send max request (send_all, or amount 'all' on CLNRest) is sent
    // only once the user confirms there. The amount shown is the balance
    // when Proceed is tapped: if the balance changes while VerifyOnChain is
    // open, the request still sweeps the balance at the time it is sent,
    // as with send max in Send
    proceed = () => {
        const { navigation } = this.props;
        const { destination, fee } = this.state;
        navigation.navigate('VerifyOnChain', {
            destination,
            fee,
            satAmount: this.sweepableSats().toString(),
            fundMax: true
        });
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
        const { BalanceStore, navigation } = this.props;
        const { destination, isValid, fee } = this.state;
        const { confirmedBlockchainBalance, unconfirmedBlockchainBalance } =
            BalanceStore;

        const noOnchainBalance =
            confirmedBlockchainBalance === 0 &&
            unconfirmedBlockchainBalance === 0;

        // On CLNRest a balance that is all unconfirmed cannot be swept yet
        const nothingToSweep = !this.sweepableSats().gt(0);

        // Proceed stays off while the fee field shows an error. With an
        // empty or 0 rate the node picks its own fee, so the rate the user
        // confirms would not be the one used. VerifyOnChain shows the rate
        // as typed, and LND takes whole sat/vB, so only digits
        const disabled =
            !destination ||
            !isValid ||
            nothingToSweep ||
            !/^\d+$/.test(fee) ||
            !isPlausibleSatPerVbyte(fee);

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
                            <Button
                                title={localeString('general.proceed')}
                                icon={
                                    !disabled && {
                                        name: 'send',
                                        size: 25
                                    }
                                }
                                onPress={this.proceed}
                                disabled={disabled}
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
