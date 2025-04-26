import * as React from 'react';
import {
    StyleSheet,
    ScrollView,
    Text,
    View,
    TouchableOpacity,
    Platform
} from 'react-native';
import { ButtonGroup } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import BigNumber from 'bignumber.js';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import Amount from '../components/Amount';
import Button from '../components/Button';
import Header from '../components/Header';
import KeyValue from '../components/KeyValue';
import Screen from '../components/Screen';
import { Spacer } from '../components/layout/Spacer';
import TextInput from '../components/TextInput';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';
import { SATS_PER_BTC } from '../utils/UnitsUtils';

import SettingsStore, { PosEnabled } from '../stores/SettingsStore';
import FiatStore from '../stores/FiatStore';
import UnitsStore from '../stores/UnitsStore';

import RNPrint from 'react-native-print';
import PosStore from '../stores/PosStore';

const DEFAULT_CUSTOM_TIP_PERCENTAGE = '21';

interface OrderProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
    FiatStore: FiatStore;
    UnitsStore: UnitsStore;
    PosStore: PosStore;
    route: Route<'Order', { orderId: string; order: any; print: boolean }>;
}

interface OrderState {
    order: any;
    selectedIndex: number;
    customPercentage: string;
    customAmount: string;
    customType: string;
    bitcoinUnits: string;
    print: boolean;
}

@inject('FiatStore', 'SettingsStore', 'UnitsStore', 'PosStore')
@observer
export default class OrderView extends React.Component<OrderProps, OrderState> {
    constructor(props: OrderProps) {
        super(props);
        const { SettingsStore, route } = props;
        const { order, print } = route.params ?? {};

        const { settings } = SettingsStore;
        const disableTips: boolean =
            (settings && settings.pos && settings.pos.disableTips) || false;

        this.state = {
            order,
            selectedIndex: disableTips ? 3 : 0,
            customPercentage: disableTips ? '0' : '',
            customAmount: '',
            customType: 'percentage',
            bitcoinUnits: 'sats',
            print
        };
    }

    componentDidUpdate(prevProps: OrderProps) {
        // print and order id are passed from the paid screen
        // we update the order so it includes payment details
        // which will enable the receipt printing
        if (this.props.route.params?.print !== prevProps.route.params?.print) {
            const { orderId, print } = this.props.route.params ?? {};

            const { PosStore } = this.props;
            if (orderId) {
                PosStore.getOrderPaymentById(orderId).then(
                    (payment: any | undefined) => {
                        if (payment) {
                            const order = this.state.order;
                            order.payment = payment;

                            this.setState({
                                order,
                                print
                            });
                        }
                    }
                );
            }
        }
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
        const { fiatEnabled } = settings;
        const { changeUnits, units } = UnitsStore;
        const fiat = settings.fiat;
        const disableTips: boolean = settings?.pos?.disableTips || false;
        const enablePrinter: boolean =
            (settings?.pos?.enablePrinter && !!RNPrint) || false;
        const merchantName = settings?.pos?.merchantName;
        const taxPercentage = settings?.pos?.taxPercentage;

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
        let subTotalSats: string;
        if (settings.pos.posEnabled === PosEnabled.Square) {
            subTotalSats = new BigNumber(order.total_money.amount)
                // subtract tax for subtotal if using Square
                .minus(order.total_tax_money.amount)
                .div(100)
                .div(rate)
                .multipliedBy(SATS_PER_BTC)
                .toFixed(0);
        } else {
            subTotalSats =
                order.total_money.sats > 0
                    ? order.total_money.sats
                    : new BigNumber(order.total_money.amount)
                          .div(100)
                          .div(rate)
                          .multipliedBy(SATS_PER_BTC)
                          .toFixed(0);
        }

        const subTotalFiat: string = new BigNumber(subTotalSats)
            .multipliedBy(rate)
            .dividedBy(SATS_PER_BTC)
            .toFixed(2);

        const taxSats = fiatEnabled
            ? new BigNumber(order.total_tax_money.amount)
                  .div(100)
                  .div(rate)
                  .multipliedBy(SATS_PER_BTC)
                  .toFixed(0)
            : new BigNumber(subTotalSats)
                  .multipliedBy(new BigNumber(taxPercentage || '0'))
                  .dividedBy(100)
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

        const buttons: any = [
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
                        const effectivePercentage =
                            customPercentage === ''
                                ? DEFAULT_CUSTOM_TIP_PERCENTAGE
                                : customPercentage;
                        totalSats = new BigNumber(subTotalSats)
                            .multipliedBy(`1.${effectivePercentage}`)
                            .plus(taxSats)
                            .toFixed(0);
                        tipSats = new BigNumber(subTotalSats)
                            .multipliedBy(
                                new BigNumber(effectivePercentage).dividedBy(
                                    100
                                )
                            )
                            .toFixed(0);
                    } else if (customType === 'amount') {
                        const effectiveAmount =
                            customAmount === ''
                                ? new BigNumber(subTotalSats)
                                      .multipliedBy(0.21)
                                      .integerValue(BigNumber.ROUND_HALF_UP)
                                      .toFixed(0)
                                : customAmount;
                        if (units === 'fiat') {
                            const customSats = new BigNumber(effectiveAmount)
                                .div(rate)
                                .multipliedBy(SATS_PER_BTC)
                                .toFixed(0);

                            totalSats = new BigNumber(subTotalSats)
                                .plus(customSats)
                                .plus(taxSats)
                                .toFixed(0);

                            tipSats = new BigNumber(customSats).toFixed(0);
                        } else {
                            const customSats =
                                units === 'sats'
                                    ? new BigNumber(effectiveAmount)
                                    : new BigNumber(
                                          effectiveAmount
                                      ).multipliedBy(SATS_PER_BTC);

                            totalSats = new BigNumber(subTotalSats)
                                .plus(customSats)
                                .plus(taxSats)
                                .toFixed(0);

                            tipSats = Number(customSats).toFixed(0);
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

        const receiptHtmlRow = (key: string, value: any) => {
            return `
            <tr>
                <td style="text-align:left;font-family:Garamond;font-size:12px;font-weight:bold;padding-bottom:5px">${key}</td>
                <td style="text-align:right;font-family:Garamond;font-size:12px;font-weight:bold;padding-bottom:5px;word-break: break-word">${value}</td>
            </tr>
            `;
        };

        const receiptHtmlRows = (key: string, value: any) => {
            return `
            <tr>
                <td style="text-align:left;font-family:Garamond;font-size:12px;font-weight:bold;padding-bottom:5px" colspan="2">${key}</td>
            </tr>
            <tr>
                <td style="text-align:right;font-family:Garamond;font-size:12px;font-weight:bold;padding-bottom:20px;word-break: break-word" colspan="2">${value}</td>
            </tr>
            `;
        };

        const receiptDivider = () => {
            return `
            <tr>
                <td colspan="2"><hr></td>
            </tr>
            `;
        };

        const receiptFormatAmount = (units: string, amount: number) => {
            return UnitsStore.getFormattedAmount(amount, units);
        };

        const printReceipt = () => {
            if (!RNPrint) {
                return;
            }

            const title =
                merchantName && merchantName.length
                    ? merchantName
                    : isPaid
                    ? localeString('pos.print.taxReceipt')
                    : localeString('pos.print.invoice');

            let templateHtml = `<html>
                <body style="margin-left:0px;margin-right:0px;padding-left:0px;padding-right:0px;">
                    <h4 style="text-align:center;font-family:Garamond">${title}</h4>
                    <table border="0" cellpadding="1" cellspacing="0" width="100%">`;

            lineItems.forEach((item: any) => {
                const keyValue =
                    item.quantity > 1
                        ? `${item.name} (x${item.quantity})`
                        : item.name;

                const fiatPriced = item.base_price_money.amount > 0;

                const unitPrice = fiatPriced
                    ? item.base_price_money.amount
                    : item.base_price_money.sats;

                let displayValue;
                if (fiatPriced) {
                    displayValue = UnitsStore.getFormattedAmount(
                        unitPrice,
                        'fiat'
                    );
                } else {
                    displayValue = UnitsStore.getFormattedAmount(
                        unitPrice,
                        'sats'
                    );
                }

                templateHtml += receiptHtmlRow(keyValue, displayValue);
            });

            templateHtml += receiptDivider();
            templateHtml += receiptHtmlRow(
                localeString('general.conversionRate'),
                exchangeRate
            );
            templateHtml += receiptHtmlRow(
                localeString('pos.views.Order.subtotalFiat'),
                FiatStore.formatAmountForDisplay(subTotalFiat)
            );
            templateHtml += receiptHtmlRow(
                localeString('pos.views.Order.subtotalBitcoin'),
                receiptFormatAmount(bitcoinUnits, Number(subTotalSats))
            );

            templateHtml += receiptDivider();

            if (!disableTips) {
                templateHtml += receiptHtmlRow(
                    localeString('pos.views.Order.tipFiat'),
                    FiatStore.formatAmountForDisplay(tipFiat)
                );
                templateHtml += receiptHtmlRow(
                    localeString('pos.views.Order.tipBitcoin'),
                    receiptFormatAmount(bitcoinUnits, Number(tipSats))
                );
            }

            if (isPaid) {
                templateHtml += receiptHtmlRow(
                    localeString('pos.views.Order.paymentType'),
                    order.payment.type === 'ln'
                        ? localeString('general.lightning')
                        : localeString('general.onchain')
                );

                templateHtml += receiptHtmlRows(
                    order.payment.type === 'ln'
                        ? localeString('views.Send.rPreimage')
                        : localeString('views.SendingOnChain.txid'),
                    order.payment.preimage ?? order.payment.tx
                );
            }

            templateHtml += receiptHtmlRow(
                `${localeString('pos.views.Order.tax')}${
                    taxPercentage && Number(taxPercentage) > 0
                        ? ` (${taxPercentage}%)`
                        : ''
                }`,
                order.getTaxMoneyDisplay
            );

            templateHtml += receiptHtmlRow(
                localeString('pos.views.Order.totalFiat'),
                FiatStore.formatAmountForDisplay(totalFiat)
            );

            templateHtml += receiptHtmlRow(
                localeString('pos.views.Order.totalBitcoin'),
                receiptFormatAmount(bitcoinUnits, Number(totalSats))
            );

            templateHtml += `</table></body></html>`;

            RNPrint.print({
                html: templateHtml
            });
        };

        if (this.state.print && isPaid && enablePrinter) {
            printReceipt();
        }

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
                        const fiatPriced = item.base_price_money.amount > 0;

                        const unitPrice = fiatPriced
                            ? item.base_price_money.amount
                            : item.base_price_money.sats;

                        let unitDisplayValue, totalDisplayValue;
                        if (fiatPriced) {
                            unitDisplayValue = UnitsStore.getFormattedAmount(
                                new BigNumber(unitPrice).toFixed(2),
                                'fiat'
                            );
                            totalDisplayValue = UnitsStore.getFormattedAmount(
                                new BigNumber(unitPrice)
                                    .multipliedBy(item.quantity)
                                    .toFixed(2),
                                'fiat'
                            );
                        } else {
                            unitDisplayValue = UnitsStore.getFormattedAmount(
                                unitPrice,
                                'sats'
                            );
                            totalDisplayValue = UnitsStore.getFormattedAmount(
                                new BigNumber(unitPrice)
                                    .multipliedBy(item.quantity)
                                    .toString(),
                                'sats'
                            );
                        }

                        const keyValue =
                            item.quantity > 1
                                ? `${item.name} (x${item.quantity} @ ${unitDisplayValue})`
                                : item.name;

                        return (
                            <KeyValue
                                key={index}
                                keyValue={keyValue}
                                value={totalDisplayValue}
                            />
                        );
                    })}

                    <Divider />
                    {fiatEnabled && (
                        <>
                            <KeyValue
                                keyValue={localeString(
                                    'general.conversionRate'
                                )}
                                value={exchangeRate}
                            />

                            <KeyValue
                                keyValue={localeString(
                                    'pos.views.Order.subtotalFiat'
                                )}
                                value={FiatStore.formatAmountForDisplay(
                                    subTotalFiat
                                )}
                            />
                        </>
                    )}

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

                    {fiatEnabled && <Divider />}

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
                                        placeholder={
                                            DEFAULT_CUSTOM_TIP_PERCENTAGE
                                        }
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
                                        placeholder={new BigNumber(subTotalSats)
                                            .multipliedBy(0.21)
                                            .integerValue(
                                                BigNumber.ROUND_HALF_UP
                                            )
                                            .toFixed(0)}
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

                            {fiatEnabled && (
                                <KeyValue
                                    keyValue={localeString(
                                        'pos.views.Order.tipFiat'
                                    )}
                                    value={FiatStore.formatAmountForDisplay(
                                        tipFiat
                                    )}
                                />
                            )}

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
                                value={FiatStore.formatAmountForDisplay(
                                    tipFiat
                                )}
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
                        keyValue={`${localeString('pos.views.Order.tax')}${
                            taxPercentage && Number(taxPercentage) > 0
                                ? ` (${taxPercentage}%)`
                                : ''
                        }`}
                        value={
                            fiatEnabled ? (
                                order.getTaxMoneyDisplay
                            ) : bitcoinUnits === 'sats' ? (
                                <Amount fixedUnits="sats" sats={taxSats} />
                            ) : (
                                <Amount fixedUnits="BTC" sats={taxSats} />
                            )
                        }
                    />

                    {fiatEnabled && (
                        <KeyValue
                            keyValue={localeString('pos.views.Order.totalFiat')}
                            value={FiatStore.formatAmountForDisplay(totalFiat)}
                        />
                    )}

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
                                navigation.navigate(
                                    settings?.ecash?.enableCashu
                                        ? 'ReceiveEcash'
                                        : 'Receive',
                                    {
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
                                    }
                                )
                            }
                            disabled={isNaN(Number(totalSats))}
                        />
                    )}

                    {Platform.OS === 'android' && enablePrinter && (
                        <Button
                            title={localeString(
                                isPaid
                                    ? 'pos.views.Order.printReceipt'
                                    : 'pos.views.Order.printInvoice'
                            )}
                            containerStyle={{ marginTop: 40, marginBottom: 40 }}
                            icon={{ name: 'print', size: 25 }}
                            onPress={() => printReceipt()}
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
