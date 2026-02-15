import * as React from 'react';
import { Route } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LNURLWithdrawParams } from 'js-lnurl';
import { inject, observer } from 'mobx-react';
import bolt11 from 'bolt11';

import Header from '../components/Header';
import PaymentMethodList from '../components/LayerBalances/PaymentMethodList';
import Screen from '../components/Screen';
import Amount from '../components/Amount';
import { ErrorMessage } from '../components/SuccessErrorMessage';
import SyncingStatus from '../components/SyncingStatus';
import RecoveryStatus from '../components/RecoveryStatus';
import RescanStatus from '../components/RescanStatus';
import FeeEstimate from '../components/FeeEstimate';

import BalanceStore from '../stores/BalanceStore';
import CashuStore from '../stores/CashuStore';
import UTXOsStore from '../stores/UTXOsStore';
import InvoicesStore from '../stores/InvoicesStore';
import { feeStore, settingsStore } from '../stores/Stores';

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
    InvoicesStore?: InvoicesStore;
}

interface ChoosePaymentMethodState {
    value: string;
    satAmount: string;
    lightning: string;
    lightningAddress: string;
    offer: string;
    lnurlParams: LNURLWithdrawParams | undefined;
    feeRate: string;
}

@inject('BalanceStore', 'CashuStore', 'UTXOsStore', 'InvoicesStore')
@observer
export default class ChoosePaymentMethod extends React.Component<
    ChoosePaymentMethodProps,
    ChoosePaymentMethodState
> {
    private focusUnsubscribe?: () => void;

    state = {
        value: '',
        satAmount: '',
        lightning: '',
        lightningAddress: '',
        offer: '',
        lnurlParams: undefined,
        feeRate: '10'
    };

    async componentDidMount() {
        const { route, navigation } = this.props;
        const params = route.params ?? {};
        const {
            value,
            satAmount,
            lightning,
            lightningAddress,
            offer,
            lnurlParams
        } = params;

        let resolvedSatAmount = satAmount;
        if (!satAmount && lightning) {
            try {
                const decoded = bolt11.decode(lightning);
                const invoice = new Invoice(decoded);
                resolvedSatAmount =
                    invoice?.getRequestAmount?.toString() ?? undefined;
            } catch (error) {
                console.log('Error decoding invoice for amount:', error);
            }
        }

        const stateUpdate: Partial<ChoosePaymentMethodState> = {};
        if (value) stateUpdate.value = value;
        if (resolvedSatAmount) stateUpdate.satAmount = resolvedSatAmount;
        if (lightning) stateUpdate.lightning = lightning;
        if (lightningAddress) stateUpdate.lightningAddress = lightningAddress;
        if (offer) stateUpdate.offer = offer;
        if (lnurlParams) stateUpdate.lnurlParams = lnurlParams;

        if (Object.keys(stateUpdate).length > 0) {
            this.setState((prev) => ({ ...prev, ...stateUpdate }));
        }

        this.fetchFeeEstimates({ lightning, lnurlParams });

        if (
            value &&
            BackendUtils.supportsOnchainReceiving() &&
            settingsStore?.settings?.privacy?.enableMempoolRates
        ) {
            const preferredRate =
                settingsStore.settings?.payments?.preferredMempoolRate ||
                'fastestFee';
            feeStore.getOnchainFeesviaMempool().then((fees) => {
                const rate = fees?.[preferredRate];
                if (rate != null) {
                    this.setState({ feeRate: String(rate) });
                }
            });
        }

        this.focusUnsubscribe = navigation.addListener('focus', () => {
            this.fetchFeeEstimates();
        });
    }

    componentWillUnmount() {
        if (this.focusUnsubscribe) {
            this.focusUnsubscribe();
        }
    }

    fetchFeeEstimates = async (override?: {
        lightning?: string;
        lnurlParams?: LNURLWithdrawParams;
    }) => {
        const lightning = override?.lightning ?? this.state.lightning;
        const { InvoicesStore, CashuStore } = this.props;

        if (lightning && InvoicesStore) {
            try {
                await InvoicesStore.getPayReq(lightning);
                // InvoicesStore automatically calls getRoutes via reaction when pay_req is set
            } catch (error) {
                console.log('Error fetching Lightning payment request:', error);
            }
        }
        if (lightning && BackendUtils.supportsCashuWallet() && CashuStore) {
            try {
                await CashuStore.getPayReq(lightning);
            } catch (error) {
                console.log('Error fetching eCash payment request:', error);
            }
        }
    };

    hasInsufficientFunds = () => {
        const { BalanceStore, CashuStore } = this.props;
        const { totalBlockchainBalance, lightningBalance } = BalanceStore!;
        const { totalBalanceSats: ecashBalance } = CashuStore!;
        const { value, lightning, lightningAddress, offer, lnurlParams } =
            this.state;
        const satAmount = Number(this.state.satAmount);

        const totalBalance =
            Number(totalBlockchainBalance) +
            Number(lightningBalance) +
            Number(ecashBalance);

        if (totalBalance === 0) return true;
        if (isNaN(satAmount) || satAmount <= 0) return false;

        const hasOnchain = Number(totalBlockchainBalance) >= satAmount;
        const hasLightning = Number(lightningBalance) >= satAmount;
        const hasEcash = Number(ecashBalance) >= satAmount;

        const isLightningOnly =
            !value &&
            (!!lightning || !!lnurlParams || !!lightningAddress || !!offer);
        const isOnchainOnly =
            !!value &&
            !lightning &&
            !lnurlParams &&
            !lightningAddress &&
            !offer &&
            BackendUtils.supportsOnchainReceiving();
        const supportsAllThree =
            !!value &&
            (!!lightning || !!lnurlParams || !!lightningAddress || !!offer) &&
            BackendUtils.supportsOnchainReceiving() &&
            BackendUtils.supportsCashuWallet();

        if (isLightningOnly) {
            return !hasLightning && !hasEcash;
        }

        if (isOnchainOnly) {
            return !hasOnchain;
        }

        if (supportsAllThree) {
            return !hasOnchain && !hasLightning && !hasEcash;
        }

        return totalBalance < satAmount;
    };

    render() {
        const {
            navigation,
            BalanceStore,
            CashuStore,
            UTXOsStore,
            InvoicesStore
        } = this.props;
        const {
            value,
            satAmount,
            lightning,
            lightningAddress,
            offer,
            lnurlParams,
            feeRate
        } = this.state;

        const { accounts } = UTXOsStore!;
        const { totalBlockchainBalance, lightningBalance } = BalanceStore!;
        const { totalBalanceSats } = CashuStore!;
        const { feeEstimate: lightningEstimateFee } = InvoicesStore!;
        const { feeEstimate: ecashEstimateFee } = CashuStore!;
        const hasInsufficientFunds = this.hasInsufficientFunds();

        const isLightningPayment =
            lightning || lnurlParams || lightningAddress || offer;
        const isOnchainPayment =
            !!value && BackendUtils.supportsOnchainReceiving();
        const showFees =
            !!satAmount && (isLightningPayment || isOnchainPayment);

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

                <RecoveryStatus navigation={navigation} />
                <RescanStatus navigation={navigation} />
                <SyncingStatus navigation={navigation} />

                {!!satAmount && (
                    <View style={styles.amountSection}>
                        <Text
                            style={[
                                styles.amountLabel,
                                {
                                    color: themeColor('secondaryText')
                                }
                            ]}
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
                {hasInsufficientFunds && (
                    <View style={styles.errorSection}>
                        <ErrorMessage
                            message={localeString(
                                'stores.CashuStore.notEnoughFunds'
                            )}
                        />
                    </View>
                )}

                <PaymentMethodList
                    navigation={navigation}
                    // for payment method selection
                    value={value}
                    satAmount={
                        satAmount && !isNaN(Number(satAmount))
                            ? Number(satAmount)
                            : undefined
                    }
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

                <FeeEstimate
                    satAmount={satAmount}
                    lightning={lightning}
                    lnurlParams={lnurlParams}
                    lightningEstimateFee={lightningEstimateFee ?? 0}
                    ecashEstimateFee={ecashEstimateFee ?? 0}
                    visible={showFees && !hasInsufficientFunds}
                    showOnchainFeeInput={
                        !!value &&
                        BackendUtils.supportsOnchainReceiving() &&
                        !hasInsufficientFunds &&
                        showFees
                    }
                    feeRate={feeRate}
                    onChangeFee={(text: string) =>
                        this.setState({ feeRate: text })
                    }
                    navigation={navigation}
                />
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    amountSection: {
        paddingVertical: 15,
        alignItems: 'center'
    },
    amountLabel: {
        fontSize: 12,
        fontFamily: 'PPNeueMontreal-Medium',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 8
    },
    errorSection: {
        alignItems: 'center',
        paddingHorizontal: 20
    }
});
