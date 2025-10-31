import * as React from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity } from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import { Route } from '@react-navigation/native';
import BigNumber from 'bignumber.js';

import { AdditionalOutput } from '../models/TransactionRequest';

import Screen from '../components/Screen';
import Header from '../components/Header';
import KeyValue from '../components/KeyValue';
import Amount from '../components/Amount';
import SwipeButton from '../components/SwipeButton';
import Button from '../components/Button';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';
import { SATS_PER_BTC } from '../utils/UnitsUtils';

import TransactionsStore from '../stores/TransactionsStore';
import SettingsStore from '../stores/SettingsStore';
import UnitsStore from '../stores/UnitsStore';
import FiatStore from '../stores/FiatStore';

interface VerifyOnChainParams {
    destination: string;
    fee: string;
    satAmount: string | number;
    amount: string;
    utxos: string[];
    account: string;
    additionalOutputs: AdditionalOutput[];
    fundMax: boolean;
}
interface VerifyOnChainProps {
    navigation: StackNavigationProp<any, any>;
    route: Route<'VerifyOnChain', VerifyOnChainParams>;
    TransactionsStore: TransactionsStore;
    SettingsStore: SettingsStore;
    UnitsStore: UnitsStore;
    FiatStore: FiatStore;
}

interface VerifyOnChainState {
    bitcoinUnits: 'sats' | 'BTC';
    slideToPayThreshold: number;
}
@inject('TransactionsStore', 'SettingsStore', 'UnitsStore', 'FiatStore')
@observer
export default class VerifyOnChain extends React.Component<VerifyOnChainProps> {
    state: VerifyOnChainState = {
        bitcoinUnits: 'sats' as 'sats' | 'BTC',
        slideToPayThreshold: 10000
    };

    async componentDidMount() {
        const { SettingsStore } = this.props;
        const settings = await SettingsStore.getSettings();
        this.setState({
            slideToPayThreshold: settings?.payments?.slideToPayThreshold
        });
    }
    toggleBitcoinUnits = () => {
        const { UnitsStore } = this.props;
        if (UnitsStore.units === 'fiat') {
            UnitsStore.changeUnits();
            return;
        }
        this.setState((prevState: VerifyOnChainState) => ({
            bitcoinUnits: prevState.bitcoinUnits === 'sats' ? 'BTC' : 'sats'
        }));
    };
    renderTotal = () => {
        const { route } = this.props;
        const { satAmount, amount, additionalOutputs } = route.params;

        const primary = satAmount || amount || '0';
        let total = Number(primary || 0);
        if (Array.isArray(additionalOutputs)) {
            additionalOutputs.forEach((o) => {
                total += Number(o?.satAmount || o?.amount || 0);
            });
        }
        const { SettingsStore, FiatStore } = this.props;
        const fiatEnabled = SettingsStore.settings?.fiatEnabled;
        const fiat = SettingsStore.settings?.fiat;
        const rates = FiatStore.fiatRates;
        let numericRate = 0;
        if (fiat && rates) {
            const entry = rates.find((entry) => entry.code === fiat);
            numericRate = entry?.rate ? Number(entry.rate) : 0;
        }
        let totalFiatDisplay = '';
        if (!numericRate || isNaN(numericRate)) {
            totalFiatDisplay = localeString('general.notAvailable');
        } else {
            const totalFiat = new BigNumber(total)
                .multipliedBy(numericRate)
                .dividedBy(SATS_PER_BTC)
                .toFixed(2);
            totalFiatDisplay = FiatStore.formatAmountForDisplay(totalFiat);
        }

        return (
            <View>
                <TouchableOpacity onPress={this.toggleBitcoinUnits}>
                    <KeyValue
                        keyValue={localeString('pos.views.Order.totalBitcoin')}
                        value={
                            this.state.bitcoinUnits === 'sats' ? (
                                <Amount
                                    fixedUnits="sats"
                                    sats={total.toString()}
                                />
                            ) : (
                                <Amount
                                    fixedUnits="BTC"
                                    sats={total.toString()}
                                />
                            )
                        }
                        disableCopy
                    />
                </TouchableOpacity>
                {fiatEnabled && (
                    <KeyValue
                        keyValue={localeString('pos.views.Order.totalFiat')}
                        value={totalFiatDisplay}
                    />
                )}
            </View>
        );
    };
    onConfirm = () => {
        const { navigation, TransactionsStore, SettingsStore, route } =
            this.props;
        const {
            destination,
            fee,
            satAmount,
            amount,
            utxos,
            account,
            additionalOutputs,
            fundMax
        } = route.params;

        const request: any = {
            addr: destination,
            sat_per_vbyte: fee,
            amount: (satAmount || amount)?.toString(),
            spend_unconfirmed: true,
            additional_outputs: additionalOutputs,
            account
        };
        if (utxos && utxos.length > 0) request.utxos = utxos;

        if (fundMax) {
            if (SettingsStore.implementation === 'cln-rest') {
                request.amount = 'all';
            } else {
                if (request.amount) delete request.amount;
                request.send_all = true;
            }
        }

        TransactionsStore.sendCoins(request);
        navigation.navigate('SendingOnChain');
    };

    renderOutputs = (destination: string, primaryAmount: string | number) => {
        const { route } = this.props;
        const { bitcoinUnits } = this.state;
        const { additionalOutputs } = route.params;
        const hasAdditional =
            Array.isArray(additionalOutputs) && additionalOutputs.length > 0;
        return (
            <View style={{ marginTop: 10 }}>
                <View style={{ marginTop: 10 }}>
                    <KeyValue
                        keyValue={
                            hasAdditional
                                ? `${localeString('general.destination')} #1`
                                : localeString('general.destination')
                        }
                        value={destination}
                        disableCopy={false}
                    />
                    {hasAdditional && (
                        <TouchableOpacity onPress={this.toggleBitcoinUnits}>
                            <KeyValue
                                keyValue={localeString('views.Send.amount')}
                                value={
                                    bitcoinUnits === 'sats' ? (
                                        <Amount
                                            fixedUnits="sats"
                                            sats={primaryAmount}
                                        />
                                    ) : (
                                        <Amount
                                            fixedUnits="BTC"
                                            sats={primaryAmount}
                                        />
                                    )
                                }
                                disableCopy
                            />
                        </TouchableOpacity>
                    )}
                </View>
                {Array.isArray(additionalOutputs) &&
                    additionalOutputs.map((o: any, idx: number) => (
                        <View key={`output-${idx}`} style={{ marginTop: 10 }}>
                            <KeyValue
                                keyValue={`${localeString(
                                    'general.destination'
                                )} #${idx + 2}`}
                                value={o?.address}
                                disableCopy={false}
                            />
                            <TouchableOpacity onPress={this.toggleBitcoinUnits}>
                                <KeyValue
                                    keyValue={localeString('views.Send.amount')}
                                    value={
                                        bitcoinUnits === 'sats' ? (
                                            <Amount
                                                fixedUnits="sats"
                                                sats={
                                                    o?.satAmount ||
                                                    o?.amount ||
                                                    '0'
                                                }
                                            />
                                        ) : (
                                            <Amount
                                                fixedUnits="BTC"
                                                sats={
                                                    o?.satAmount ||
                                                    o?.amount ||
                                                    '0'
                                                }
                                            />
                                        )
                                    }
                                    disableCopy
                                />
                            </TouchableOpacity>
                        </View>
                    ))}
            </View>
        );
    };

    renderInputs = () => {
        const { route } = this.props;
        const { utxos } = route.params;
        if (!Array.isArray(utxos) || utxos.length === 0) return null;
        return (
            <View style={{ marginTop: 10 }}>
                <KeyValue
                    keyValue={localeString('general.utxos')}
                    value={utxos.length}
                />
                {utxos.map((u: string, idx: number) => (
                    <KeyValue
                        key={`utxo-${idx}`}
                        keyValue={`${localeString('views.PSBT.input')} #${
                            idx + 1
                        }`}
                        value={u}
                        disableCopy={false}
                    />
                ))}
            </View>
        );
    };

    render() {
        const { navigation, route } = this.props;
        const {
            destination,
            fee,
            satAmount,
            amount,
            account,
            fundMax,
            additionalOutputs
        } = route?.params || {};
        const { slideToPayThreshold } = this.state;

        const primary = satAmount || amount;
        let totalAmount = Number(primary);
        if (additionalOutputs && Array.isArray(additionalOutputs)) {
            additionalOutputs.forEach((o) => {
                totalAmount += Number(o?.satAmount || o?.amount || 0);
            });
        }
        const shouldUseSwipeButton = totalAmount >= slideToPayThreshold;
        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.VerifyOnChain.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                <ScrollView contentContainerStyle={styles.content}>
                    {this.renderOutputs(
                        destination,
                        fundMax ? '0' : satAmount || amount || '0'
                    )}

                    {this.renderTotal()}

                    <KeyValue
                        keyValue={localeString('views.Send.feeSatsVbyte')}
                        value={fee}
                    />

                    {this.renderInputs()}

                    {account && account !== 'default' && (
                        <KeyValue
                            keyValue={localeString('general.account')}
                            value={account}
                        />
                    )}
                </ScrollView>
                <View style={{ bottom: 10 }}>
                    {shouldUseSwipeButton ? (
                        <SwipeButton
                            onSwipeSuccess={this.onConfirm}
                            instructionText={localeString(
                                'views.PaymentRequest.slideToPay'
                            )}
                            containerStyle={{
                                backgroundColor: themeColor('secondaryText')
                            }}
                            swipeButtonStyle={{
                                backgroundColor: themeColor('text')
                            }}
                        />
                    ) : (
                        <View style={styles.button}>
                            <Button
                                title={localeString('views.Send.sendCoins')}
                                icon={{
                                    name: 'send',
                                    size: 25
                                }}
                                onPress={this.onConfirm}
                            />
                        </View>
                    )}
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    content: {
        padding: 15
    },
    button: {
        paddingHorizontal: 20
    }
});
