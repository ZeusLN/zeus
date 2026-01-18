import * as React from 'react';
import { Route } from '@react-navigation/native';
import { Text, View, TouchableOpacity } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LNURLWithdrawParams } from 'js-lnurl';
import { inject, observer } from 'mobx-react';
import bolt11 from 'bolt11';

import Header from '../components/Header';
import PaymentMethodList from '../components/LayerBalances/PaymentMethodList';
import Screen from '../components/Screen';
import Amount from '../components/Amount';
import { ErrorMessage } from '../components/SuccessErrorMessage';
import OnchainFeeInput from '../components/OnchainFeeInput';
import ModalBox from '../components/ModalBox';
import SyncingStatus from '../components/SyncingStatus';

import CaretDown from '../assets/images/SVG/Caret Down.svg';

import BalanceStore from '../stores/BalanceStore';
import CashuStore from '../stores/CashuStore';
import UTXOsStore from '../stores/UTXOsStore';
import InvoicesStore from '../stores/InvoicesStore';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';
import BackendUtils from '../utils/BackendUtils';
import Invoice from '../models/Invoice';

interface EstimateFeesDisplayProps {
    satAmount: string;
    lightning?: string;
    lnurlParams?: any;
    value?: string;
    lightningEstimateFee?: number;
    ecashEstimateFee?: number;
    feeRate?: string;
}

const EstimateFeesDisplay: React.FC<EstimateFeesDisplayProps> = observer(
    ({
        satAmount,
        lightning,
        lnurlParams,
        value,
        lightningEstimateFee,
        ecashEstimateFee,
        feeRate
    }) => {
        const calculateOnchainFee = (feeRateSatPerVbyte: number): number => {
            const estimatedVbytes = 140;
            return Math.ceil(feeRateSatPerVbyte * estimatedVbytes);
        };
        if (!satAmount) return null;
        const onchainFeeRate = feeRate ? Number(feeRate) : 10;
        const onchainFee = value ? calculateOnchainFee(onchainFeeRate) : 0;
        return (
            <View style={{ paddingTop: 15 }}>
                <View
                    style={{
                        flexDirection: 'row',
                        paddingHorizontal: 10,
                        paddingBottom: 8
                    }}
                >
                    <View style={{ flex: 1 }} />
                    <View style={{ flex: 1, alignItems: 'center' }}>
                        <Text
                            style={{
                                color: themeColor('secondaryText'),
                                fontFamily: 'PPNeueMontreal-Book',
                                fontSize: 12,
                                textTransform: 'uppercase'
                            }}
                        >
                            {localeString('views.PaymentRequest.feeEstimate')}
                        </Text>
                    </View>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                        <Text
                            style={{
                                color: themeColor('secondaryText'),
                                fontFamily: 'PPNeueMontreal-Book',
                                fontSize: 12,
                                textTransform: 'uppercase'
                            }}
                        >
                            {localeString(
                                'components.NWCPendingPayInvoiceModal.totalAmount'
                            )}
                        </Text>
                    </View>
                </View>
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 8,
                        paddingHorizontal: 10
                    }}
                >
                    <View style={{ flex: 1, alignItems: 'center' }}>
                        <Text
                            style={{
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book',
                                fontSize: 14
                            }}
                        >
                            {localeString('general.lightning')}
                        </Text>
                    </View>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                        {lightningEstimateFee !== undefined ? (
                            <Amount
                                sats={lightningEstimateFee}
                                sensitive={false}
                                colorOverride={themeColor('bitcoin')}
                            />
                        ) : (
                            <Text
                                style={{
                                    color: themeColor('secondaryText'),
                                    fontFamily: 'PPNeueMontreal-Book',
                                    fontSize: 12
                                }}
                            >
                                -
                            </Text>
                        )}
                    </View>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                        {lightningEstimateFee !== undefined ? (
                            <Amount
                                sats={
                                    Number(satAmount) +
                                    (Number(lightningEstimateFee) || 0)
                                }
                                sensitive={false}
                            />
                        ) : (
                            <Text
                                style={{
                                    color: themeColor('secondaryText'),
                                    fontFamily: 'PPNeueMontreal-Book',
                                    fontSize: 12
                                }}
                            >
                                -
                            </Text>
                        )}
                    </View>
                </View>
                {BackendUtils.supportsCashuWallet() &&
                    (lightning || lnurlParams) && (
                        <View
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingVertical: 8,
                                paddingHorizontal: 10
                            }}
                        >
                            <View style={{ flex: 1, alignItems: 'center' }}>
                                <Text
                                    style={{
                                        color: themeColor('text'),
                                        fontFamily: 'PPNeueMontreal-Book',
                                        fontSize: 14
                                    }}
                                >
                                    {localeString('general.ecash')}
                                </Text>
                            </View>
                            <View
                                style={{
                                    flex: 1,
                                    alignItems: 'center'
                                }}
                            >
                                {ecashEstimateFee !== undefined ? (
                                    <Amount
                                        sats={ecashEstimateFee}
                                        sensitive={false}
                                        colorOverride={themeColor('bitcoin')}
                                    />
                                ) : (
                                    <Text
                                        style={{
                                            color: themeColor('secondaryText'),
                                            fontFamily: 'PPNeueMontreal-Book',
                                            fontSize: 12
                                        }}
                                    >
                                        -
                                    </Text>
                                )}
                            </View>
                            <View
                                style={{
                                    flex: 1,
                                    alignItems: 'center'
                                }}
                            >
                                {ecashEstimateFee ? (
                                    <Amount
                                        sats={
                                            Number(satAmount) +
                                            (Number(ecashEstimateFee) || 0)
                                        }
                                        sensitive={false}
                                    />
                                ) : (
                                    <Text
                                        style={{
                                            color: themeColor('secondaryText'),
                                            fontFamily: 'PPNeueMontreal-Book',
                                            fontSize: 12
                                        }}
                                    >
                                        -
                                    </Text>
                                )}
                            </View>
                        </View>
                    )}
                {value && BackendUtils.supportsOnchainReceiving() && (
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingVertical: 8,
                            paddingHorizontal: 10
                        }}
                    >
                        <View style={{ flex: 1, alignItems: 'center' }}>
                            <Text
                                style={{
                                    color: themeColor('text'),
                                    fontFamily: 'PPNeueMontreal-Book',
                                    fontSize: 14
                                }}
                            >
                                {localeString('general.onchain')}
                            </Text>
                        </View>

                        <View style={{ flex: 1, alignItems: 'center' }}>
                            <Amount
                                sats={onchainFee}
                                sensitive={false}
                                colorOverride={themeColor('bitcoin')}
                            />
                        </View>
                        <View style={{ flex: 1, alignItems: 'center' }}>
                            <Amount
                                sats={Number(satAmount) + onchainFee}
                                sensitive={false}
                            />
                        </View>
                    </View>
                )}
            </View>
        );
    }
);

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
    feeLoadingError: boolean;
    showFeeModal: boolean;
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
        feeRate: '10',
        feeLoadingError: false,
        showFeeModal: false
    };

    async componentDidMount() {
        const { route, navigation } = this.props;
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
                const decodedInvoice = bolt11.decode(lightning);
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
        this.fetchFeeEstimates();

        this.focusUnsubscribe = navigation.addListener('focus', () => {
            this.fetchFeeEstimates();
        });
    }

    componentWillUnmount() {
        if (this.focusUnsubscribe) {
            this.focusUnsubscribe();
        }
    }

    fetchFeeEstimates = async () => {
        const { lightning, lnurlParams } = this.state;
        const { InvoicesStore, CashuStore } = this.props;

        if (lightning && InvoicesStore) {
            try {
                await InvoicesStore.getPayReq(lightning);
                // InvoicesStore automatically calls getRoutes via reaction when pay_req is set
            } catch (error) {
                console.log('Error fetching Lightning payment request:', error);
            }
        }
        if (
            (lightning || lnurlParams) &&
            BackendUtils.supportsCashuWallet() &&
            CashuStore
        ) {
            try {
                await CashuStore.getPayReq(lightning || '');
                // CashuStore.feeEstimate is set automatically
            } catch (error) {
                console.log('Error fetching eCash payment request:', error);
            }
        }
    };

    hasInsufficientFunds = () => {
        const { BalanceStore, CashuStore, UTXOsStore } = this.props;
        const { satAmount, lightning, lnurlParams, lightningAddress, offer } =
            this.state;

        if (!satAmount) return false;

        const amount = Number(satAmount);
        if (isNaN(amount) || amount <= 0) return false;

        const { accounts } = UTXOsStore!;
        const { totalBlockchainBalance, lightningBalance } = BalanceStore!;
        const { totalBalanceSats } = CashuStore!;

        // Check lightning balance if using lightning payment
        if (lightning || lnurlParams || lightningAddress || offer) {
            if (Number(lightningBalance) >= amount) return false;
            // Check ecash balance if available
            if (
                BackendUtils.supportsCashuWallet() &&
                Number(totalBalanceSats) >= amount
            ) {
                return false;
            }
        }

        // Check on-chain balance
        if (Number(totalBlockchainBalance) >= amount) return false;

        // Check individual accounts
        if (accounts && accounts.length > 0) {
            for (const account of accounts) {
                if (
                    !account.hidden &&
                    !account.watch_only &&
                    account.balance >= amount
                ) {
                    return false;
                }
            }
        }

        return true;
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
            feeRate,
            showFeeModal
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

                <SyncingStatus navigation={navigation} />

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
                        {hasInsufficientFunds && (
                            <View>
                                <ErrorMessage
                                    message={localeString(
                                        'stores.CashuStore.notEnoughFunds'
                                    )}
                                />
                            </View>
                        )}
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

                {showFees && !hasInsufficientFunds && (
                    <View
                        style={{
                            paddingHorizontal: 20,
                            paddingVertical: 15
                        }}
                    >
                        <TouchableOpacity
                            onPress={() =>
                                this.setState({
                                    showFeeModal: true
                                })
                            }
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: themeColor('secondary'),
                                borderRadius: 8,
                                paddingVertical: 14,
                                paddingHorizontal: 20
                            }}
                        >
                            <Text
                                style={{
                                    color: themeColor('text'),
                                    fontFamily: 'PPNeueMontreal-Medium',
                                    fontSize: 16,
                                    marginRight: 8
                                }}
                            >
                                {localeString(
                                    'views.PaymentRequest.feeEstimate'
                                )}
                            </Text>
                            <CaretDown
                                fill={themeColor('text')}
                                width="16"
                                height="16"
                            />
                        </TouchableOpacity>
                    </View>
                )}

                <ModalBox
                    style={{
                        borderTopLeftRadius: 20,
                        borderTopRightRadius: 20,
                        backgroundColor: themeColor('background'),
                        paddingHorizontal: 20,
                        paddingTop: 24,
                        paddingBottom: 40,
                        maxHeight:
                            !!value && BackendUtils.supportsOnchainReceiving()
                                ? '45%'
                                : '30%'
                    }}
                    swipeToClose={true}
                    backButtonClose={true}
                    backdropPressToClose={true}
                    backdrop={true}
                    position="bottom"
                    isOpen={showFeeModal}
                    onClosed={() => this.setState({ showFeeModal: false })}
                >
                    <View>
                        <Text
                            style={{
                                fontFamily: 'PPNeueMontreal-Medium',
                                color: themeColor('text'),
                                fontSize: 18,
                                marginBottom: 20,
                                textAlign: 'center'
                            }}
                        >
                            {localeString('views.PaymentRequest.feeEstimate')}
                        </Text>
                        <EstimateFeesDisplay
                            satAmount={satAmount}
                            lightning={lightning}
                            lnurlParams={lnurlParams}
                            value={value}
                            lightningEstimateFee={lightningEstimateFee ?? 0}
                            ecashEstimateFee={ecashEstimateFee ?? 0}
                            feeRate={feeRate}
                        />
                        {!!value &&
                            BackendUtils.supportsOnchainReceiving() &&
                            !hasInsufficientFunds &&
                            showFees && (
                                <View
                                    style={{
                                        paddingTop: 20
                                    }}
                                >
                                    <Text
                                        style={{
                                            color: themeColor('secondaryText'),
                                            fontFamily: 'PPNeueMontreal-Book',
                                            fontSize: 14,
                                            marginBottom: 5
                                        }}
                                    >
                                        {localeString(
                                            'views.Send.feeSatsVbyte'
                                        )}
                                    </Text>
                                    <OnchainFeeInput
                                        fee={feeRate}
                                        onChangeFee={(text: string) =>
                                            this.setState({
                                                feeRate: text,
                                                feeLoadingError: false
                                            })
                                        }
                                        onFeeError={(error: boolean) =>
                                            this.setState({
                                                feeLoadingError: error
                                            })
                                        }
                                        navigation={navigation}
                                    />
                                </View>
                            )}
                    </View>
                </ModalBox>
            </Screen>
        );
    }
}
