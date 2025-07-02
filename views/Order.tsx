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

import BackendUtils from '../utils/BackendUtils';
import { calculateTotalSats } from '../utils/TipUtils';
import FiatStore from '../stores/FiatStore';
import SettingsStore, { PosEnabled } from '../stores/SettingsStore';
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
}

@inject('FiatStore', 'SettingsStore', 'UnitsStore', 'PosStore')
@observer
export default class OrderView extends React.Component<OrderProps, OrderState> {
    constructor(props: OrderProps) {
        super(props);
        const { SettingsStore, route } = props;
        const { order, orderId, print } = route.params ?? {};

        const { settings } = SettingsStore;
        const disableTips: boolean =
            (settings && settings.pos && settings.pos.disableTips) || false;

        this.state = {
            order,
            selectedIndex: disableTips ? 3 : 0,
            customPercentage: disableTips ? '0' : '',
            customAmount: '',
            customType: 'percentage',
            bitcoinUnits: 'sats'
        };

        const { PosStore } = this.props;
        if (orderId && print) {
            PosStore.getOrderPaymentById(orderId).then(
                (payment: any | undefined) => {
                    if (payment) {
                        order.payment = payment;

                        this.setState({
                            order
                        });

                        if (print) {
                            this.printReceipt();
                        }
                    }
                }
            );
        }
    }

    componentDidUpdate(prevProps: OrderProps) {
        // print and order id are passed from the paid screen
        // we update the order so it includes payment details
        // which will enable the receipt printing

        if (this.props.route.params?.print !== prevProps.route.params?.print) {
            const { order, orderId, print } = this.props.route.params ?? {};

            const { PosStore } = this.props;
            if (orderId) {
                PosStore.getOrderPaymentById(orderId).then(
                    (payment: any | undefined) => {
                        if (payment) {
                            order.payment = payment;

                            this.setState({
                                order
                            });

                            if (print) {
                                this.printReceipt();
                            }
                        }
                    }
                );
            }
        }
    }

    public printReceipt = () => {
        const { FiatStore, SettingsStore, UnitsStore } = this.props;
        const {
            order,
            selectedIndex,
            customPercentage,
            customAmount,
            customType,
            bitcoinUnits
        } = this.state;

        const { fiatRates, getRate }: any = FiatStore;
        const { settings } = SettingsStore;
        const { fiatEnabled } = settings;
        const { units } = UnitsStore;
        const fiat = settings.fiat;
        const disableTips: boolean = settings?.pos?.disableTips || false;
        const merchantName = settings?.pos?.merchantName;
        const taxPercentage = settings?.pos?.taxPercentage;

        const fiatEntry =
            fiat && fiatRates
                ? fiatRates.filter((entry: any) => entry.code === fiat)[0]
                : null;

        const isPaid: boolean = !!order?.payment;

        const rate = isPaid
            ? order.payment.rate
            : fiat && fiatRates && fiatEntry
            ? fiatEntry.rate.toFixed(2)
            : 0;

        const exchangeRate = isPaid ? order?.payment.exchangeRate : getRate();

        const lineItems = order?.line_items;

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

        // Calculate tax using individual product rates when available (for receipt)
        const calculateTaxSatsForReceipt = () => {
            const hasIndividualTaxRatesForReceipt = lineItems?.some(
                (item: any) => item.taxPercentage
            );

            if (fiatEnabled && !hasIndividualTaxRatesForReceipt) {
                return new BigNumber(order.total_tax_money.amount)
                    .div(100)
                    .div(rate)
                    .multipliedBy(SATS_PER_BTC)
                    .toFixed(0);
            }

            // Check if any line items have individual tax rates
            const hasIndividualTaxRates = lineItems?.some(
                (item: any) => item.taxPercentage
            );

            if (hasIndividualTaxRates) {
                let totalTaxSats = new BigNumber(0);
                lineItems?.forEach((item: any) => {
                    // Use individual tax rate if set and not empty, otherwise use global rate
                    const itemTaxRate =
                        item.taxPercentage || taxPercentage || '0';

                    const validTaxRate = itemTaxRate || '0';

                    const fiatPriced = item.base_price_money.amount > 0;
                    let itemSubtotalSats: string;

                    if (fiatPriced) {
                        let fiatAmount = new BigNumber(
                            item.base_price_money.amount
                        ).multipliedBy(item.quantity);
                        if (settings.pos.posEnabled === PosEnabled.Square) {
                            fiatAmount = fiatAmount.div(100);
                        }
                        itemSubtotalSats = fiatAmount
                            .div(rate)
                            .multipliedBy(SATS_PER_BTC)
                            .integerValue(BigNumber.ROUND_HALF_UP)
                            .toFixed(0);
                    } else {
                        itemSubtotalSats = new BigNumber(
                            item.base_price_money.sats || 0
                        )
                            .multipliedBy(item.quantity)
                            .toFixed(0);
                    }

                    const itemTaxSats = new BigNumber(itemSubtotalSats)
                        .multipliedBy(new BigNumber(validTaxRate))
                        .dividedBy(100)
                        .integerValue(BigNumber.ROUND_HALF_UP)
                        .toFixed(0);

                    totalTaxSats = totalTaxSats.plus(itemTaxSats);
                });

                return totalTaxSats.toFixed(0);
            } else {
                // Use global tax rate for all items
                return new BigNumber(subTotalSats)
                    .multipliedBy(new BigNumber(taxPercentage || '0'))
                    .dividedBy(100)
                    .toFixed(0);
            }
        };

        const taxSats = calculateTaxSatsForReceipt();

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
                        totalSats = calculateTotalSats(
                            subTotalSats,
                            effectivePercentage,
                            taxSats
                        );
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

        // Original printReceipt function body starts here
        if (!RNPrint) {
            return;
        }

        const receiptFormatAmount = (unitsArg: string, amount: number) => {
            return this.props.UnitsStore.getFormattedAmount(amount, unitsArg);
        };

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
                displayValue = this.props.UnitsStore.getFormattedAmount(
                    unitPrice,
                    'fiat'
                );
            } else {
                displayValue = this.props.UnitsStore.getFormattedAmount(
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
            this.props.FiatStore.formatAmountForDisplay(subTotalFiat)
        );
        templateHtml += receiptHtmlRow(
            localeString('pos.views.Order.subtotalBitcoin'),
            receiptFormatAmount(bitcoinUnits, Number(subTotalSats))
        );

        templateHtml += receiptDivider();

        if (!disableTips) {
            templateHtml += receiptHtmlRow(
                localeString('pos.views.Order.tipFiat'),
                this.props.FiatStore.formatAmountForDisplay(tipFiat)
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

        // Determine tax display label for receipt
        const getReceiptTaxLabel = () => {
            if (!lineItems || lineItems.length === 0) {
                return localeString('pos.views.Order.tax');
            }

            // Get all unique tax rates used in the order
            const taxRates = new Set<string>();
            lineItems.forEach((item: any) => {
                // Use individual tax rate if set and not empty, otherwise use global rate
                const itemTaxRate = item.taxPercentage || taxPercentage || '0';

                // Ensure valid rate for display
                const displayTaxRate = itemTaxRate || '0';
                taxRates.add(displayTaxRate);
            });

            const uniqueRates = Array.from(taxRates);

            if (uniqueRates.length === 1) {
                // All items have the same tax rate
                const rate = uniqueRates[0];
                if (rate === '0') {
                    return localeString('pos.views.Order.tax');
                }
                return `${localeString('pos.views.Order.tax')} (${rate}%)`;
            } else {
                // Multiple different tax rates - show breakdown
                const rateList = uniqueRates
                    .filter((rate) => rate !== '0')
                    .map((rate) => `${rate}%`)
                    .join(', ');

                if (rateList === '') {
                    return localeString('pos.views.Order.tax');
                }

                return `${localeString('pos.views.Order.tax')} (${rateList})`;
            }
        };

        templateHtml += receiptHtmlRow(
            getReceiptTaxLabel(),
            this.props.FiatStore.formatAmountForDisplay(
                new BigNumber(taxSats)
                    .multipliedBy(rate)
                    .dividedBy(SATS_PER_BTC)
                    .toFixed(2)
            )
        );

        templateHtml += receiptHtmlRow(
            localeString('pos.views.Order.totalFiat'),
            this.props.FiatStore.formatAmountForDisplay(totalFiat)
        );

        templateHtml += receiptHtmlRow(
            localeString('pos.views.Order.totalBitcoin'),
            receiptFormatAmount(bitcoinUnits, Number(totalSats))
        );

        const poweredByHtml = `
        <tr><td colspan="2" style="text-align:center; padding-top:20px;">
            <p style="font-family:Garamond;font-size:10px;margin-bottom:5px;color:black;">Powered by ZEUS</p>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 258.12 100" width="100" height="38.74" style="display:block; margin-left:auto; margin-right:auto;">
              <g>
                <path fill="black" d="m13.83,27.6L0,0h46.47C29.48,4.39,19.86,16.16,13.83,27.6Zm12.86,72.4h46.47l-13.83-27.6c-6.03,11.43-15.65,23.21-32.64,27.6ZM50.12,0L0,100h23.05L73.17,0h-23.05Zm59.33,27.59L123.28,0h-46.47c16.99,4.39,26.62,16.16,32.64,27.6Zm-32.64,72.4h46.47l-13.83-27.6c-6.03,11.43-15.65,23.21-32.64,27.6Zm-3.14-89.97l-11.52,22.98,8.51,16.99-8.51,16.98,11.52,22.98,20.03-39.96-20.03-39.97ZM179.43.01h-23.05s25.06,49.99,25.06,49.99l-25.06,50h23.04l25.06-50L179.43.01Zm-75.68,49.99l25.06,50h23.04s-25.06-50-25.06-50L151.85,0h-23.04s-25.06,50-25.06,50Zm140.53-22.4L258.12,0h-46.47c16.99,4.39,26.62,16.16,32.64,27.6Zm-45.5,44.81l-13.83,27.6h46.47c-16.99-4.39-26.62-16.16-32.64-27.6ZM184.95,0l50.12,100h23.05S208.01.01,208.01.01h-23.06Z"/>
              </g>
            </svg>
        </td></tr>`;
        templateHtml += poweredByHtml;

        templateHtml += `</table></body></html>`;

        RNPrint.print({
            html: templateHtml
        });

        // Helper functions, now part of the class method's scope
        function receiptHtmlRow(key: string, value: any) {
            return `
        <tr>
            <td style="text-align:left;font-family:Garamond;font-size:8px;font-weight:bold;padding-bottom:5px">${key}</td>
            <td style="text-align:right;font-family:Garamond;font-size:8px;font-weight:bold;padding-bottom:5px;word-break: break-word">${value}</td>
        </tr>
        `;
        }

        function receiptHtmlRows(key: string, value: any) {
            return `
        <tr>
            <td style="text-align:left;font-family:Garamond;font-size:8px;font-weight:bold;padding-bottom:5px" colspan="2">${key}</td>
        </tr>
        <tr>
            <td style="text-align:right;font-family:Garamond;font-size:8px;font-weight:bold;padding-bottom:20px;word-break: break-word" colspan="2">${value}</td>
        </tr>
        `;
        }

        function receiptDivider() {
            return `
        <tr>
            <td colspan="2"><hr></td>
        </tr>
        `;
        }
    };

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

        const isPaid: boolean = !!order?.payment;

        const rate = isPaid
            ? order?.payment?.rate
            : fiat && fiatRates && fiatEntry
            ? fiatEntry.rate.toFixed(2)
            : 0;

        const exchangeRate = isPaid ? order.payment.exchangeRate : getRate();

        const lineItems = order?.line_items;

        const memo = merchantName
            ? `${merchantName} POS powered by ZEUS - Order ${order?.id}`
            : `ZEUS POS - Order ${order?.id}`;

        let subTotalSats: string;
        if (settings.pos.posEnabled === PosEnabled.Square) {
            subTotalSats = new BigNumber(order?.total_money.amount)
                .minus(order?.total_tax_money.amount)
                .div(100)
                .div(rate)
                .multipliedBy(SATS_PER_BTC)
                .integerValue(BigNumber.ROUND_HALF_UP)
                .toFixed(0);
        } else {
            subTotalSats =
                order?.total_money?.sats > 0
                    ? order.total_money.sats
                    : new BigNumber(order?.total_money.amount)
                          .div(100)
                          .div(rate)
                          .multipliedBy(SATS_PER_BTC)
                          .integerValue(BigNumber.ROUND_HALF_UP)
                          .toFixed(0);
        }

        const subTotalFiat: string = new BigNumber(subTotalSats)
            .multipliedBy(rate)
            .dividedBy(SATS_PER_BTC)
            .toFixed(2);

        const calculateTaxSats = () => {
            const hasIndividualTaxRates = lineItems?.some(
                (item: any) => item.taxPercentage
            );

            if (hasIndividualTaxRates) {
                let totalTaxSats = new BigNumber(0);
                lineItems?.forEach((item: any) => {
                    const itemTaxRate =
                        item.taxPercentage || taxPercentage || '0';

                    const validTaxRate = itemTaxRate || '0';

                    const fiatPriced = item.base_price_money.amount > 0;
                    let itemSubtotalSats: string;

                    if (fiatPriced) {
                        let fiatAmount = new BigNumber(
                            item.base_price_money.amount
                        ).multipliedBy(item.quantity);
                        // Only divide by 100 if using Square (amount is in cents)
                        if (settings.pos.posEnabled === PosEnabled.Square) {
                            fiatAmount = fiatAmount.div(100);
                        }
                        itemSubtotalSats = fiatAmount
                            .div(rate)
                            .multipliedBy(SATS_PER_BTC)
                            .integerValue(BigNumber.ROUND_HALF_UP)
                            .toFixed(0);
                    } else {
                        itemSubtotalSats = new BigNumber(
                            item.base_price_money.sats || 0
                        )
                            .multipliedBy(item.quantity)
                            .toFixed(0);
                    }

                    const itemTaxSats = new BigNumber(itemSubtotalSats)
                        .multipliedBy(new BigNumber(validTaxRate))
                        .dividedBy(100)
                        .integerValue(BigNumber.ROUND_HALF_UP)
                        .toFixed(0);

                    totalTaxSats = totalTaxSats.plus(itemTaxSats);
                });

                return totalTaxSats.toFixed(0);
            } else {
                return new BigNumber(subTotalSats)
                    .multipliedBy(new BigNumber(taxPercentage || '0'))
                    .dividedBy(100)
                    .integerValue(BigNumber.ROUND_HALF_UP)
                    .toFixed(0);
            }
        };

        const taxSats = calculateTaxSats();

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
                        totalSats = calculateTotalSats(
                            subTotalSats,
                            effectivePercentage,
                            taxSats
                        );
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
                    {lineItems?.map((item: any, index: number) => {
                        const fiatPriced = item.base_price_money.amount > 0;

                        const unitPrice = fiatPriced
                            ? // amounts from Square are in cents
                              settings.pos.posEnabled === PosEnabled.Square
                                ? new BigNumber(item.base_price_money.amount)
                                      .div(100)
                                      .toNumber()
                                : item.base_price_money.amount
                            : item.base_price_money.sats;

                        const itemTaxRate = item.taxPercentage
                            ? ` + ${item.taxPercentage}% ${localeString(
                                  'pos.views.Order.tax'
                              )}`
                            : taxPercentage
                            ? ` + ${taxPercentage}% ${localeString(
                                  'pos.views.Order.tax'
                              )}`
                            : '';

                        let unitDisplayValue, totalDisplayValue;
                        if (fiatPriced) {
                            unitDisplayValue = FiatStore.formatAmountForDisplay(
                                new BigNumber(unitPrice).toFixed(2)
                            );
                            totalDisplayValue =
                                FiatStore.formatAmountForDisplay(
                                    new BigNumber(unitPrice)
                                        .multipliedBy(item.quantity)
                                        .toFixed(2)
                                ) + itemTaxRate;
                        } else {
                            unitDisplayValue = UnitsStore.getFormattedAmount(
                                unitPrice,
                                'sats'
                            );
                            const baseDisplayValue =
                                bitcoinUnits === 'sats' ? (
                                    <Amount
                                        fixedUnits="sats"
                                        sats={new BigNumber(unitPrice)
                                            .multipliedBy(item.quantity)
                                            .toString()}
                                    />
                                ) : (
                                    <Amount
                                        fixedUnits="BTC"
                                        sats={new BigNumber(unitPrice)
                                            .multipliedBy(item.quantity)
                                            .toString()}
                                    />
                                );
                            totalDisplayValue = (
                                <View
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'row'
                                    }}
                                >
                                    <Text
                                        style={{
                                            color: themeColor('text'),
                                            fontFamily: 'PPNeueMontreal-Book'
                                        }}
                                    >
                                        {baseDisplayValue}
                                    </Text>
                                    <Text
                                        style={{
                                            color: themeColor('text'),
                                            fontFamily: 'PPNeueMontreal-Book'
                                        }}
                                    >
                                        {itemTaxRate}
                                    </Text>
                                </View>
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

                    {fiatEnabled && (
                        <KeyValue
                            keyValue={localeString('pos.views.Order.taxFiat')}
                            value={FiatStore.formatAmountForDisplay(
                                new BigNumber(taxSats)
                                    .multipliedBy(rate)
                                    .dividedBy(SATS_PER_BTC)
                                    .toFixed(2)
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
                            keyValue={
                                lineItems?.some(
                                    (item: any) => item.taxPercentage
                                )
                                    ? localeString('pos.views.Order.taxBitcoin')
                                    : `${localeString(
                                          'pos.views.Order.tax'
                                      )} (${taxPercentage || '0'}%)`
                            }
                            value={
                                bitcoinUnits === 'sats' ? (
                                    <Amount fixedUnits="sats" sats={taxSats} />
                                ) : (
                                    <Amount fixedUnits="BTC" sats={taxSats} />
                                )
                            }
                        />
                    </TouchableOpacity>

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
                                    settings?.ecash?.enableCashu &&
                                        BackendUtils.supportsCashuWallet()
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
                                        order,
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
                            onPress={() => this.printReceipt()}
                            secondary
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
