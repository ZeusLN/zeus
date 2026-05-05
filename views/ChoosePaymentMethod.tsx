import * as React from 'react';
import { Route } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LNURLWithdrawParams } from 'js-lnurl';
import { inject, observer } from 'mobx-react';
import Bolt11Utils from '../utils/Bolt11Utils';

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

interface RouteParams {
    value: string;
    satAmount: string;
    lightning: string;
    lightningAddress: string;
    offer: string;
    lnurlParams: LNURLWithdrawParams | undefined;
}

interface ChoosePaymentMethodProps {
    navigation: NativeStackNavigationProp<any, any>;
    route: Route<'ChoosePaymentMethod', RouteParams>;
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
    private blurUnsubscribe?: () => void;
    private hasNavigatedAway = false;

    state = {
        value: '',
        satAmount: '',
        lightning: '',
        lightningAddress: '',
        offer: '',
        lnurlParams: undefined,
        feeRate: ''
    };

    componentDidMount() {
        const { route, navigation } = this.props;
        const params = route.params ?? {};
        this.initFromParams(params);
        this.blurUnsubscribe = navigation.addListener('blur', () => {
            this.hasNavigatedAway = true;
        });
        this.focusUnsubscribe = navigation.addListener('focus', () => {
            if (!this.hasNavigatedAway) return;
            this.hasNavigatedAway = false;
            const { lightning, lnurlParams, value } = this.state;
            this.fetchFeeEstimates({
                lightning,
                lnurlParams
            });
            this.fetchOnchainFees(value);
        });
    }

    componentWillUnmount() {
        this.focusUnsubscribe?.();
        this.blurUnsubscribe?.();
    }

    private decodeSatAmount(lightning: string): string | undefined {
        try {
            const decoded = Bolt11Utils.decode(lightning);
            const invoice = new Invoice(decoded);
            return invoice?.getRequestAmount?.toString() ?? undefined;
        } catch {
            return undefined;
        }
    }

    private initFromParams(params: Partial<RouteParams>) {
        const {
            value,
            satAmount,
            lightning,
            lightningAddress,
            offer,
            lnurlParams
        } = params ?? {};

        const resolvedSatAmount =
            !satAmount && lightning
                ? this.decodeSatAmount(lightning)
                : satAmount;

        const stateUpdate: Partial<ChoosePaymentMethodState> = {
            ...(value && { value }),
            ...(resolvedSatAmount &&
                resolvedSatAmount !== '0' && { satAmount: resolvedSatAmount }),
            ...(lightning && { lightning }),
            ...(lightningAddress && { lightningAddress }),
            ...(offer && { offer }),
            ...(lnurlParams && { lnurlParams })
        };
        if (Object.keys(stateUpdate).length > 0) {
            this.setState((prev) => ({ ...prev, ...stateUpdate }));
        }

        this.fetchFeeEstimates({ lightning, lnurlParams });
        this.fetchOnchainFees(value);
    }
    fetchOnchainFees = (value?: string) => {
        if (
            !value ||
            !BackendUtils.supportsOnchainReceiving() ||
            !settingsStore?.settings?.privacy?.enableMempoolRates
        ) {
            return;
        }
        feeStore.getOnchainFeesviaMempool();
    };

    private fetchFeeEstimates = async (override?: {
        lightning?: string;
        lnurlParams?: LNURLWithdrawParams;
    }) => {
        const lightning = override?.lightning ?? this.state.lightning;
        const { InvoicesStore, CashuStore } = this.props;
        if (!lightning) return;
        const tasks: Promise<void>[] = [];
        if (InvoicesStore) {
            tasks.push(InvoicesStore.getPayReq(lightning).catch(() => {}));
        }
        if (BackendUtils.supportsCashuWallet() && CashuStore) {
            tasks.push(CashuStore.getPayReq(lightning).catch(() => {}));
        }
        await Promise.all(tasks);
    };

    hasInsufficientFunds = () => {
        const { BalanceStore, CashuStore } = this.props;
        const { totalBlockchainBalance, lightningBalance } = BalanceStore!;
        const { totalBalanceSats: ecashBalance } = CashuStore!;
        const { value, lightning, lightningAddress, offer, lnurlParams } =
            this.state;
        const satAmount = Number(this.state.satAmount);

        const onchain = Number(totalBlockchainBalance);
        const lightning_ = Number(lightningBalance);
        const ecash = Number(ecashBalance);
        const total = onchain + lightning_ + ecash;

        if (total === 0) return true;
        if (isNaN(satAmount) || satAmount <= 0) return false;

        const hasOnchain = onchain >= satAmount;
        const hasLightning = lightning_ >= satAmount;
        const hasEcash = ecash >= satAmount;

        const hasLightningPayment = !!(
            lightning ||
            lnurlParams ||
            lightningAddress ||
            offer
        );
        const hasOnchainPayment =
            !!value && BackendUtils.supportsOnchainReceiving();

        if (!value && hasLightningPayment) return !hasLightning && !hasEcash;
        if (hasOnchainPayment && !hasLightningPayment) return !hasOnchain;

        if (
            hasOnchainPayment &&
            hasLightningPayment &&
            BackendUtils.supportsCashuWallet()
        ) {
            return !hasOnchain && !hasLightning && !hasEcash;
        }

        return total < satAmount;
    };

    render() {
        const { navigation, BalanceStore, CashuStore, UTXOsStore } = this.props;
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

        const hasInsufficientFunds = this.hasInsufficientFunds();
        const hasLightningPayment = !!(
            lightning ||
            lnurlParams ||
            lightningAddress ||
            offer
        );
        const hasOnchainPayment =
            !!value && BackendUtils.supportsOnchainReceiving();
        const showFees =
            !!satAmount && (hasLightningPayment || hasOnchainPayment);
        const showOnchainFeeInput =
            hasOnchainPayment &&
            !hasInsufficientFunds &&
            showFees &&
            !!settingsStore?.settings?.privacy?.enableMempoolRates;

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
                    satAmount={satAmount}
                    feeRate={this.state.feeRate}
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
                    visible={showFees && !hasInsufficientFunds}
                    showOnchainFeeInput={showOnchainFeeInput}
                    feeRate={feeRate}
                    onFeeChange={(fee) => this.setState({ feeRate: fee })}
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
