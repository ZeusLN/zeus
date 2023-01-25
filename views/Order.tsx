import * as React from 'react';
import {
    StyleSheet,
    ScrollView,
    Text,
    View,
    TouchableOpacity
} from 'react-native';
import { ButtonGroup, Header, Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import BigNumber from 'bignumber.js';

import Amount from './../components/Amount';
import Button from './../components/Button';
import KeyValue from './../components/KeyValue';
import { Spacer } from './../components/layout/Spacer';
import TextInput from './../components/TextInput';

import { localeString } from './../utils/LocaleUtils';
import { themeColor } from './../utils/ThemeUtils';

import SettingsStore from './../stores/SettingsStore';
import FiatStore from './../stores/FiatStore';
import UnitsStore, { SATS_PER_BTC } from './../stores/UnitsStore';

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
        const { navigation } = props;
        const order = navigation.getParam('order', null);

        this.state = {
            order,
            selectedIndex: 0,
            customPercentage: '21',
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

        const fiatEntry =
            fiat && fiatRates && fiatRates.filter
                ? fiatRates.filter((entry: any) => entry.code === fiat)[0]
                : null;

        const rate =
            fiat && fiatRates && fiatEntry ? fiatEntry.rate.toFixed(2) : 0;

        const isPaid: boolean = order.payment;
        const exchangeRate = isPaid ? order.payment.exchangeRate : getRate();

        const lineItems = order.line_items;

        // TODO add custom memo label in settings
        const memo = `ZEUS POS: ${order.id}`;

        // round to nearest sat
        const subTotalSats = new BigNumber(order.total_money.amount / 100)
            .div(rate)
            .multipliedBy(SATS_PER_BTC)
            .toFixed(0);

        const twentyPercentButton = () => (
            <Text
                style={{
                    fontFamily: 'Lato-Regular',
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
                    fontFamily: 'Lato-Regular',
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
                    fontFamily: 'Lato-Regular',
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
                    fontFamily: 'Lato-Regular',
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

        // fiat
        // total amount is subtotal + tip + tax
        let totalAmount = '0';
        let tipAmount = '0';
        if (!isPaid) {
            switch (selectedIndex) {
                case 0:
                    totalAmount = new BigNumber(order.getTotalMoney)
                        .multipliedBy(1.2)
                        .plus(order.getTaxMoney)
                        .toFixed(2)
                        .toString();
                    tipAmount = new BigNumber(order.getTotalMoney)
                        .multipliedBy(0.2)
                        .toFixed(2)
                        .toString();
                    break;
                case 1:
                    totalAmount = new BigNumber(order.getTotalMoney)
                        .multipliedBy(1.25)
                        .plus(order.getTaxMoney)
                        .toFixed(2)
                        .toString();
                    tipAmount = new BigNumber(order.getTotalMoney)
                        .multipliedBy(0.25)
                        .toFixed(2)
                        .toString();
                    break;
                case 2:
                    totalAmount = new BigNumber(order.getTotalMoney)
                        .multipliedBy(1.3)
                        .plus(order.getTaxMoney)
                        .toFixed(2)
                        .toString();
                    tipAmount = new BigNumber(order.getTotalMoney)
                        .multipliedBy(0.3)
                        .toFixed(2)
                        .toString();
                    break;
                default:
                    if (customType === 'percentage') {
                        totalAmount = new BigNumber(order.getTotalMoney)
                            .multipliedBy(`1.${customPercentage || 0}`)
                            .plus(order.getTaxMoney)
                            .toFixed(2);
                        tipAmount = new BigNumber(order.getTotalMoney)
                            .multipliedBy(
                                new BigNumber(customPercentage || 0).dividedBy(
                                    100
                                )
                            )
                            .toFixed(2);
                    } else if (customType === 'amount') {
                        if (units === 'fiat') {
                            totalAmount =
                                !!customAmount && !isNaN(Number(customAmount))
                                    ? `${new BigNumber(order.getTotalMoney)
                                          .plus(customAmount)
                                          .plus(order.getTaxMoney)
                                          .toFixed(2)}`
                                    : new BigNumber(order.getTotalMoney)
                                          .plus(order.getTaxMoney)
                                          .toFixed(2);
                            tipAmount =
                                !!customAmount && !isNaN(Number(customAmount))
                                    ? new BigNumber(customAmount).toFixed(2)
                                    : '0';
                        } else {
                            const fiatAmount =
                                units === 'sats'
                                    ? new BigNumber(customAmount)
                                          .dividedBy(SATS_PER_BTC)
                                          .multipliedBy(rate)
                                          .toFixed(2)
                                    : new BigNumber(customAmount)
                                          .multipliedBy(rate)
                                          .toFixed(2);

                            totalAmount = !isNaN(Number(fiatAmount))
                                ? `${new BigNumber(order.getTotalMoney)
                                      .plus(fiatAmount)
                                      .plus(order.getTaxMoney)
                                      .toFixed(2)}`
                                : order.getTotalMoney;
                            tipAmount = !isNaN(Number(fiatAmount))
                                ? Number(fiatAmount).toFixed(2)
                                : '0';
                        }
                    }
            }
        } else {
            tipAmount = new BigNumber(order.payment.orderTip || 0)
                .dividedBy(100)
                .toString();
            totalAmount = new BigNumber(order.getTotalMoney)
                .plus(new BigNumber(tipAmount))
                .plus(order.getTaxMoney)
                .toString();
        }

        const satAmountTotal: string = new BigNumber(
            totalAmount.replace(/,/g, '.')
        )
            .dividedBy(rate)
            .multipliedBy(SATS_PER_BTC)
            .toFixed(0);

        const satAmountTip: string = new BigNumber(tipAmount.replace(/,/g, '.'))
            .dividedBy(rate)
            .multipliedBy(SATS_PER_BTC)
            .toFixed(0);

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.goBack()}
                color={themeColor('text')}
                underlayColor="transparent"
            />
        );

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
                        text: localeString('general.order'),
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
                    {lineItems.map((item: any, index: number) => {
                        const keyValue =
                            item.quantity > 1
                                ? `${item.name} (x${item.quantity})`
                                : item.name;
                        return (
                            <KeyValue
                                key={index}
                                keyValue={keyValue}
                                value={`$${Number(
                                    item.total_money.amount / 100
                                ).toFixed(2)}`}
                            />
                        );
                    })}

                    <Divider />

                    <KeyValue
                        keyValue={localeString('general.conversionRate')}
                        value={exchangeRate}
                    />

                    <KeyValue
                        keyValue={'Subtotal (fiat)'}
                        value={order.getTotalMoneyDisplay}
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
                            keyValue={'Subtotal (Bitcoin)'}
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

                    {!isPaid && (
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
                                value={`${getSymbol().symbol}${tipAmount}`}
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
                                                sats={satAmountTip}
                                            />
                                        ) : (
                                            <Amount
                                                fixedUnits="BTC"
                                                sats={satAmountTip}
                                            />
                                        )
                                    }
                                />
                            </TouchableOpacity>

                            <KeyValue
                                keyValue={localeString('pos.views.Order.tax')}
                                value={order.getTaxMoneyDisplay}
                            />

                            <Divider />
                        </>
                    )}

                    {isPaid && (
                        <>
                            <KeyValue
                                keyValue={localeString(
                                    'pos.views.Order.tipFiat'
                                )}
                                value={`${getSymbol().symbol}${tipAmount}`}
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
                                                sats={satAmountTip}
                                            />
                                        ) : (
                                            <Amount
                                                fixedUnits="BTC"
                                                sats={satAmountTip}
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
                        keyValue={localeString('pos.views.Order.totalFiat')}
                        value={`${getSymbol().symbol}${totalAmount}`}
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
                                        sats={satAmountTotal}
                                    />
                                ) : (
                                    <Amount
                                        fixedUnits="BTC"
                                        sats={satAmountTotal}
                                    />
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
                                    amount: satAmountTotal,
                                    autoGenerate: true,
                                    memo,
                                    // TODO evaluate fields to save
                                    orderId: order.id,
                                    orderTip: Number(tipAmount) * 100,
                                    orderAmount:
                                        Number(order.getTotalMoney) * 100
                                })
                            }
                            disabled={isNaN(Number(satAmountTotal))}
                        />
                    )}
                </View>
            </ScrollView>
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
