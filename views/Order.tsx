import * as React from 'react';
import {
    StyleSheet,
    ScrollView,
    Text,
    View,
    TouchableOpacity
} from 'react-native';
import { ButtonGroup } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import BigNumber from 'bignumber.js';

import Amount from '../components/Amount';
import Button from '../components/Button';
import Header from '../components/Header';
import KeyValue from '../components/KeyValue';
import Screen from '../components/Screen';
import { Spacer } from '../components/layout/Spacer';
import TextInput from '../components/TextInput';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import SettingsStore from '../stores/SettingsStore';
import FiatStore from '../stores/FiatStore';
import UnitsStore, { SATS_PER_BTC } from '../stores/UnitsStore';

interface OrderProps {
    navigation: any;
    SettingsStore: SettingsStore;
    FiatStore: FiatStore;
    UnitsStore: UnitsStore;
}

interface OrderState {
    order: any;
    selectedIndex: number;
    customPercentage: string;
    customAmount: string;
    customType: string;
    bitcoinUnits: string;
}

@inject('FiatStore', 'SettingsStore', 'UnitsStore')
@observer
export default class OrderView extends React.Component<OrderProps, OrderState> {
    constructor(props: any) {
        super(props);
        const { SettingsStore, navigation } = props;
        const order = navigation.getParam('order', null);
        const { settings } = SettingsStore;
        const disableTips: boolean =
            settings && settings.pos && settings.pos.disableTips;

        this.state = {
            order,
            selectedIndex: disableTips ? 3 : 0,
            customPercentage: disableTips ? '0' : '21',
            customAmount: '',
            customType: 'percentage',
            bitcoinUnits: 'sats'
        };
    }

    render() {
        const { navigation, FiatStore, SettingsStore, UnitsStore } = this.props;
        const {
            order,
            selectedIndex,
            customPercentage,
            customAmount,
            customType,
            bitcoinUnits
        } = this.state;
        const { fiatRates, getRate, getSymbol }: any = FiatStore;
        const { settings } = SettingsStore;
        const { changeUnits, units } = UnitsStore;
        const fiat = settings.fiat;
        const disableTips: boolean =
            (settings && settings.pos && settings.pos.disableTips) || false;
        const merchantName =
            settings && settings.pos && settings.pos.merchantName;

        const fiatEntry =
            fiat && fiatRates
                ? fiatRates.filter((entry: any) => entry.code === fiat)[0]
                : null;

        const isPaid: boolean = order.payment;

        const rate = isPaid
            ? order.payment.rate
            : fiat && fiatRates && fiatEntry
            ? fiatEntry.rate.toFixed(2)
            : 0;

        const exchangeRate = isPaid ? order.payment.exchangeRate : getRate();

        const lineItems = order.line_items;

        const memo = merchantName
            ? `${merchantName} POS powered by ZEUS - Order ${order.id}`
            : `ZEUS POS - Order ${order.id}`;

        // round to nearest sat
        const subTotalSats = new BigNumber(order.total_money.amount)
            .minus(order.total_tax_money.amount)
            .div(100)
            .div(rate)
            .multipliedBy(SATS_PER_BTC)
            .toFixed(0);

        const subTotalFiat: string = new BigNumber(subTotalSats)
            .multipliedBy(rate)
            .dividedBy(SATS_PER_BTC)
            .toFixed(2);

        const taxSats = new BigNumber(order.total_tax_money.amount)
            .div(100)
            .div(rate)
            .multipliedBy(SATS_PER_BTC)
            .toFixed(0);

        const twentyPercentButton = () => (
            <Text
                style={{
                    fontFamily: 'PPNeueMontreal-Book',
                    color:
                        selectedIndex === 0
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                20%
            </Text>
        );
        const twentyFivePercentButton = () => (
            <Text
                style={{
                    fontFamily: 'PPNeueMontreal-Book',
                    color:
                        selectedIndex === 1
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                25%
            </Text>
        );
        const thirtyPercentButton = () => (
            <Text
                style={{
                    fontFamily: 'PPNeueMontreal-Book',
                    color:
                        selectedIndex === 2
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                30%
            </Text>
        );
        const customButton = () => (
            <Text
                style={{
                    fontFamily: 'PPNeueMontreal-Book',
                    color:
                        selectedIndex === 3
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                Custom
            </Text>
        );

        const Divider = () => (
            <View
                style={{
                    margin: 10,
                    height: 2,
                    borderRadius: 6,
                    backgroundColor: themeColor('secondary')
                }}
            >
                <Spacer />
            </View>
        );

        const buttons = [
            { element: twentyPercentButton },
            { element: twentyFivePercentButton },
            { element: thirtyPercentButton },
            { element: customButton }
        ];

        // sats
        // total amount is subtotal + tip + tax
        let totalSats = '0';
        let tipSats = '0';
        if (!isPaid) {
            switch (selectedIndex) {
                case 0:
                    totalSats = new BigNumber(subTotalSats)
                        .multipliedBy(1.2)
                        .plus(taxSats)
                        .toFixed(0);
                    tipSats = new BigNumber(subTotalSats)
                        .multipliedBy(0.2)
                        .toFixed(0);
                    break;
                case 1:
                    totalSats = new BigNumber(subTotalSats)
                        .multipliedBy(1.25)
                        .plus(taxSats)
                        .toFixed(0);
                    tipSats = new BigNumber(subTotalSats)
                        .multipliedBy(0.25)
                        .toFixed(0);
                    break;
                case 2:
                    totalSats = new BigNumber(subTotalSats)
                        .multipliedBy(1.3)
                        .plus(taxSats)
                        .toFixed(0);
                    tipSats = new BigNumber(subTotalSats)
                        .multipliedBy(0.3)
                        .toFixed(0);
                    break;
                default:
                    if (customType === 'percentage') {
                        totalSats = new BigNumber(subTotalSats)
                            .multipliedBy(`1.${customPercentage || 0}`)
                            .plus(taxSats)
                            .toFixed(0);
                        tipSats = new BigNumber(subTotalSats)
                            .multipliedBy(
                                new BigNumber(customPercentage || 0).dividedBy(
                                    100
                                )
                            )
                            .toFixed(0);
                    } else if (customType === 'amount') {
                        if (units === 'fiat') {
                            const customSats = new BigNumber(customAmount)
                                .div(rate)
                                .multipliedBy(SATS_PER_BTC)
                                .toFixed(0);

                            totalSats =
                                !!customAmount && !isNaN(Number(customAmount))
                                    ? `${new BigNumber(subTotalSats)
                                          .plus(customSats)
                                          .plus(taxSats)
                                          .toFixed(0)}`
                                    : new BigNumber(subTotalSats)
                                          .plus(taxSats)
                                          .toFixed(0);
                            tipSats =
                                !!customAmount && !isNaN(Number(customAmount))
                                    ? new BigNumber(customSats).toFixed(0)
                                    : '0';
                        } else {
                            const customSats =
                                units === 'sats'
                                    ? new BigNumber(customAmount)
                                    : new BigNumber(customAmount).multipliedBy(
                                          SATS_PER_BTC
                                      );

                            totalSats =
                                !!customAmount && !isNaN(Number(customAmount))
                                    ? new BigNumber(subTotalSats)
                                          .plus(customSats)
                                          .plus(taxSats)
                                          .toFixed(0)
                                    : new BigNumber(subTotalSats)
                                          .plus(taxSats)
                                          .toFixed(0);

                            tipSats =
                                !!customAmount && !isNaN(Number(customAmount))
                                    ? Number(customSats).toFixed(0)
                                    : '0';
                        }
                    }
            }
        } else {
            tipSats = order.payment.orderTip;
            totalSats = order.payment.orderTotal;
        }

        const totalFiat: string = new BigNumber(totalSats)
            .multipliedBy(rate)
            .dividedBy(SATS_PER_BTC)
            .toFixed(2);

        const tipFiat: string = new BigNumber(tipSats)
            .multipliedBy(rate)
            .dividedBy(SATS_PER_BTC)
            .toFixed(2);

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('general.order'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />

                <ScrollView
                    style={styles.content}
                    keyboardShouldPersistTaps="handled"
                >
                    {lineItems.map((item: any, index: number) => {
                        const keyValue =
                            item.quantity > 1
                                ? `${item.name} (x${item.quantity})`
                                : item.name;

                        const unitPrice =
                            item.base_price_money.amount > 0
                                ? item.base_price_money.amount / 100
                                : new BigNumber(item.base_price_money.sats)
                                      .multipliedBy(rate)
                                      .dividedBy(SATS_PER_BTC)
                                      .toFixed(2);
                        return (
                            <KeyValue
                                key={index}
                                keyValue={keyValue}
                                value={`$${Number(unitPrice).toFixed(2)}`}
                            />
                        );
                    })}

                    <Divider />

                    <KeyValue
                        keyValue={localeString('general.conversionRate')}
                        value={exchangeRate}
                    />

                    <KeyValue
                        keyValue={localeString('pos.views.Order.subtotalFiat')}
                        value={`${getSymbol().symbol}${subTotalFiat}`}
                    />

                    <TouchableOpacity
                        onPress={() => {
                            this.setState({
                                bitcoinUnits:
                                    this.state.bitcoinUnits === 'sats'
                                        ? 'BTC'
                                        : 'sats'
                            });
                        }}
                    >
                        <KeyValue
                            keyValue={localeString(
                                'pos.views.Order.subtotalBitcoin'
                            )}
                            value={
                                bitcoinUnits === 'sats' ? (
                                    <Amount
                                        fixedUnits="sats"
                                        sats={subTotalSats}
                                    />
                                ) : (
                                    <Amount
                                        fixedUnits="BTC"
                                        sats={subTotalSats}
                                    />
                                )
                            }
                        />
                    </TouchableOpacity>

                    <Divider />

                    {!isPaid && !disableTips && (
                        <>
                            <Text
                                style={{
                                    color: themeColor('text'),
                                    alignSelf: 'center',
                                    margin: 10
                                }}
                            >
                                {localeString('pos.views.Order.addTip')}
                            </Text>

                            <ButtonGroup
                                onPress={(selectedIndex: number) => {
                                    this.setState({ selectedIndex });
                                }}
                                selectedIndex={selectedIndex}
                                buttons={buttons}
                                selectedButtonStyle={{
                                    backgroundColor: themeColor('highlight'),
                                    borderRadius: 12
                                }}
                                containerStyle={{
                                    backgroundColor: themeColor('secondary'),
                                    borderRadius: 12,
                                    borderColor: themeColor('secondary')
                                }}
                                innerBorderStyle={{
                                    color: themeColor('secondary')
                                }}
                            />

                            {selectedIndex === 3 && (
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        width: '95%',
                                        alignSelf: 'center'
                                    }}
                                >
                                    <TextInput
                                        suffix="%"
                                        keyboardType="numeric"
                                        right={25}
                                        value={customPercentage}
                                        onChangeText={(text: string) => {
                                            if (
                                                text.includes('-') ||
                                                text.includes('.') ||
                                                text.includes(',')
                                            )
                                                return;
                                            this.setState({
                                                customPercentage: text
                                            });
                                        }}
                                        onPressIn={() =>
                                            this.setState({
                                                customType: 'percentage'
                                            })
                                        }
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        style={{
                                            width: '50%',
                                            marginRight: 10,
                                            opacity:
                                                customType == 'percentage'
                                                    ? 1
                                                    : 0.25
                                        }}
                                    />
                                    <TextInput
                                        keyboardType="numeric"
                                        value={customAmount}
                                        onChangeText={(text: string) => {
                                            if (text.includes('-')) return;
                                            if (
                                                units === 'sats' &&
                                                (text.includes(',') ||
                                                    text.includes('.'))
                                            )
                                                return;
                                            if (
                                                units === 'BTC' &&
                                                text.split('.')[1] &&
                                                text.split('.')[1].length === 9
                                            )
                                                return;
                                            if (
                                                units === 'fiat' &&
                                                text.split('.')[1] &&
                                                text.split('.')[1].length === 3
                                            )
                                                return;
                                            this.setState({
                                                customAmount: text
                                            });
                                        }}
                                        onPressIn={() =>
                                            this.setState({
                                                customType: 'amount'
                                            })
                                        }
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        style={{
                                            width: '50%',
                                            opacity:
                                                customType == 'amount'
                                                    ? 1
                                                    : 0.25
                                        }}
                                        prefix={
                                            units !== 'sats' &&
                                            (units === 'BTC'
                                                ? '₿'
                                                : !getSymbol().rtl
                                                ? getSymbol().symbol
                                                : null)
                                        }
                                        suffix={
                                            units === 'sats'
                                                ? units
                                                : getSymbol().rtl &&
                                                  units === 'fiat' &&
                                                  getSymbol().symbol
                                        }
                                        toggleUnits={() => {
                                            this.setState({
                                                customAmount: ''
                                            });
                                            changeUnits();
                                        }}
                                    />
                                </View>
                            )}

                            <KeyValue
                                keyValue={localeString(
                                    'pos.views.Order.tipFiat'
                                )}
                                value={`${getSymbol().symbol}${tipFiat}`}
                            />

                            <TouchableOpacity
                                onPress={() => {
                                    this.setState({
                                        bitcoinUnits:
                                            this.state.bitcoinUnits === 'sats'
                                                ? 'BTC'
                                                : 'sats'
                                    });
                                }}
                            >
                                <KeyValue
                                    keyValue={localeString(
                                        'pos.views.Order.tipBitcoin'
                                    )}
                                    value={
                                        bitcoinUnits === 'sats' ? (
                                            <Amount
                                                fixedUnits="sats"
                                                sats={tipSats}
                                            />
                                        ) : (
                                            <Amount
                                                fixedUnits="BTC"
                                                sats={tipSats}
                                            />
                                        )
                                    }
                                />
                            </TouchableOpacity>

                            <Divider />
                        </>
                    )}

                    {isPaid && (
                        <>
                            <KeyValue
                                keyValue={localeString(
                                    'pos.views.Order.tipFiat'
                                )}
                                value={`${getSymbol().symbol}${tipFiat}`}
                            />

                            <TouchableOpacity
                                onPress={() => {
                                    this.setState({
                                        bitcoinUnits:
                                            this.state.bitcoinUnits === 'sats'
                                                ? 'BTC'
                                                : 'sats'
                                    });
                                }}
                            >
                                <KeyValue
                                    keyValue={localeString(
                                        'pos.views.Order.tipBitcoin'
                                    )}
                                    value={
                                        bitcoinUnits === 'sats' ? (
                                            <Amount
                                                fixedUnits="sats"
                                                sats={tipSats}
                                            />
                                        ) : (
                                            <Amount
                                                fixedUnits="BTC"
                                                sats={tipSats}
                                            />
                                        )
                                    }
                                />
                            </TouchableOpacity>

                            <KeyValue
                                keyValue={localeString(
                                    'pos.views.Order.paymentType'
                                )}
                                value={
                                    order.payment.type === 'ln'
                                        ? localeString('general.lightning')
                                        : localeString('general.onchain')
                                }
                            />
                            <KeyValue
                                keyValue={
                                    order.payment.type === 'ln'
                                        ? localeString('views.Send.lnPayment')
                                        : localeString(
                                              'views.SendingOnChain.txid'
                                          )
                                }
                                value={order.payment.tx}
                            />
                        </>
                    )}

                    <KeyValue
                        keyValue={localeString('pos.views.Order.tax')}
                        value={order.getTaxMoneyDisplay}
                    />

                    <KeyValue
                        keyValue={localeString('pos.views.Order.totalFiat')}
                        value={`${getSymbol().symbol}${totalFiat}`}
                    />

                    <TouchableOpacity
                        onPress={() => {
                            this.setState({
                                bitcoinUnits:
                                    this.state.bitcoinUnits === 'sats'
                                        ? 'BTC'
                                        : 'sats'
                            });
                        }}
                    >
                        <KeyValue
                            keyValue={localeString(
                                'pos.views.Order.totalBitcoin'
                            )}
                            value={
                                bitcoinUnits === 'sats' ? (
                                    <Amount
                                        fixedUnits="sats"
                                        sats={totalSats}
                                    />
                                ) : (
                                    <Amount fixedUnits="BTC" sats={totalSats} />
                                )
                            }
                        />
                    </TouchableOpacity>

                    {!isPaid && (
                        <Button
                            title={localeString('general.pay')}
                            containerStyle={{ marginTop: 40 }}
                            onPress={() =>
                                navigation.navigate('Receive', {
                                    amount:
                                        units === 'sats'
                                            ? totalSats
                                            : units === 'BTC'
                                            ? new BigNumber(totalSats)
                                                  .div(SATS_PER_BTC)
                                                  .toFixed(8)
                                            : totalFiat,
                                    autoGenerate: true,
                                    memo,
                                    // For displaying paid orders
                                    orderId: order.id,
                                    // sats
                                    orderTip: tipSats,
                                    orderTotal: totalSats,
                                    // formatted string rate
                                    exchangeRate,
                                    // numerical rate
                                    rate
                                })
                            }
                            disabled={isNaN(Number(totalSats))}
                        />
                    )}
                </ScrollView>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    content: {
        paddingLeft: 20,
        paddingRight: 20
    },
    center: {
        alignItems: 'center',
        paddingTop: 15,
        paddingBottom: 15
    }
});
