import * as React from 'react';
import { Route } from '@react-navigation/native';
import { Text, View } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LNURLWithdrawParams } from 'js-lnurl';
import { inject, observer } from 'mobx-react';

import Button from '../components/Button';
import Header from '../components/Header';
import PaymentMethodList from '../components/LayerBalances/PaymentMethodList';
import Screen from '../components/Screen';
import Amount from '../components/Amount';

import BalanceStore from '../stores/BalanceStore';
import CashuStore from '../stores/CashuStore';
import UTXOsStore from '../stores/UTXOsStore';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';
import BackendUtils from '../utils/BackendUtils';

import Invoice from '../models/Invoice';

interface ChoosePaymentMethodProps {
    navigation: StackNavigationProp<any, any>;
    route: Route<
        'ChoosePaymentMethod',
        {
            value: string;
            satAmount: string;
            lightning: string;
            lightningAddress: string;
            offer: string;
            lnurlParams: LNURLWithdrawParams | undefined;
        }
    >;
    BalanceStore?: BalanceStore;
    CashuStore?: CashuStore;
    UTXOsStore?: UTXOsStore;
}

interface ChoosePaymentMethodState {
    value: string;
    satAmount: string;
    lightning: string;
    lightningAddress: string;
    offer: string;
    lnurlParams: LNURLWithdrawParams | undefined;
}

@inject('BalanceStore', 'CashuStore', 'UTXOsStore')
@observer
export default class ChoosePaymentMethod extends React.Component<
    ChoosePaymentMethodProps,
    ChoosePaymentMethodState
> {
    state = {
        value: '',
        satAmount: '',
        lightning: '',
        lightningAddress: '',
        offer: '',
        lnurlParams: undefined
    };

    async componentDidMount() {
        const { route } = this.props;
        const {
            value,
            satAmount,
            lightning,
            lightningAddress,
            offer,
            lnurlParams
        } = route.params ?? {};

        if (value) {
            this.setState({ value });
        }

        // If satAmount is provided, use it directly
        if (satAmount) {
            this.setState({ satAmount });
        } else if (lightning) {
            try {
                const decodedInvoice = await BackendUtils.decodePaymentRequest([
                    lightning
                ]);
                const invoice = new Invoice(decodedInvoice);
                if (invoice && invoice.getRequestAmount) {
                    this.setState({
                        satAmount: invoice.getRequestAmount.toString()
                    });
                }
            } catch (error) {
                console.log('Error decoding invoice for amount:', error);
            }
        }

        if (lightning) {
            this.setState({ lightning });
        }

        if (lightningAddress) {
            this.setState({ lightningAddress });
        }

        if (offer) {
            this.setState({ offer });
        }

        if (lnurlParams) {
            this.setState({ lnurlParams });
        }
    }

    render() {
        const { navigation, BalanceStore, CashuStore, UTXOsStore } = this.props;
        const {
            value,
            satAmount,
            lightning,
            lightningAddress,
            offer,
            lnurlParams
        } = this.state;

        const { accounts } = UTXOsStore!;
        const { totalBlockchainBalance, lightningBalance } = BalanceStore!;
        const { totalBalanceSats } = CashuStore!;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Accounts.select'),
                        style: { color: themeColor('text') }
                    }}
                    navigation={navigation}
                />
                {!!satAmount && (
                    <View style={{ paddingVertical: 15, alignItems: 'center' }}>
                        <Text
                            style={{
                                fontSize: 12,
                                fontFamily: 'PPNeueMontreal-Medium',
                                color: themeColor('secondaryText'),
                                textTransform: 'uppercase',
                                letterSpacing: 1,
                                marginBottom: 8
                            }}
                        >
                            {localeString('views.Payment.paymentAmount')}
                        </Text>
                        <Amount
                            sats={satAmount}
                            sensitive
                            jumboText
                            toggleable
                        />
                    </View>
                )}
                <PaymentMethodList
                    navigation={navigation}
                    // for payment method selection
                    value={value}
                    satAmount={Number(satAmount)}
                    lightning={lightning}
                    lightningAddress={lightningAddress}
                    offer={offer}
                    lnurlParams={lnurlParams}
                    // balance data
                    lightningBalance={lightningBalance}
                    onchainBalance={totalBlockchainBalance}
                    ecashBalance={totalBalanceSats}
                    accounts={accounts}
                />
                {!!value && !!lightning && (
                    <Button
                        title={localeString('views.Accounts.fetchTxFees')}
                        containerStyle={{
                            margin: 20
                        }}
                        onPress={() =>
                            navigation.navigate('EditFee', {
                                displayOnly: true
                            })
                        }
                    />
                )}
            </Screen>
        );
    }
}
