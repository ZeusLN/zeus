import * as React from 'react';
import { StyleSheet, TouchableOpacity, View, ScrollView } from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import BigNumber from 'bignumber.js';

import Amount from '../../components/Amount';
import Button from '../../components/Button';
import Header from '../../components/Header';
import KeyValue from '../../components/KeyValue';
import { Row } from '../../components/layout/Row';
import Screen from '../../components/Screen';
import Text from '../../components/Text';
import TextInput from '../../components/TextInput';
import AmountInput from '../../components/AmountInput';
import LoadingIndicator from '../../components/LoadingIndicator';
import {
    ErrorMessage,
    SuccessMessage
} from '../../components/SuccessErrorMessage';
import OnchainFeeInput from '../../components/OnchainFeeInput';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import { SATS_PER_BTC, numberWithCommas } from '../../utils/UnitsUtils';
import AddressUtils from '../../utils/AddressUtils';
import BackendUtils from '../../utils/BackendUtils';

import SwapStore from '../../stores/SwapStore';
import UnitsStore from '../../stores/UnitsStore';
import InvoicesStore from '../../stores/InvoicesStore';
import FiatStore from '../../stores/FiatStore';
import SettingsStore from '../../stores/SettingsStore';
import FeeStore from '../../stores/FeeStore';

import ArrowDown from '../../assets/images/SVG/Arrow_down.svg';
import CaretDown from '../../assets/images/SVG/Caret Down.svg';
import CaretRight from '../../assets/images/SVG/Caret Right.svg';
import ExchangeBitcoinSVG from '../../assets/images/SVG/ExchangeBitcoin.svg';
import ExchangeFiatSVG from '../../assets/images/SVG/ExchangeFiat.svg';
import OnChainSvg from '../../assets/images/SVG/DynamicSVG/OnChainSvg';
import LightningSvg from '../../assets/images/SVG/DynamicSVG/LightningSvg';
import OrderList from '../../assets/images/SVG/order-list.svg';
import { Icon } from 'react-native-elements';

interface SwapPaneProps {
    navigation: StackNavigationProp<any, any>;
    SwapStore: SwapStore;
    UnitsStore: UnitsStore;
    InvoicesStore: InvoicesStore;
    FiatStore: FiatStore;
    SettingsStore: SettingsStore;
    FeeStore: FeeStore;
}

interface SwapPaneState {
    reverse: boolean;
    serviceFeeSats: number | BigNumber;
    inputSats: number | BigNumber;
    outputSats: number | BigNumber;
    inputFiat: string;
    outputFiat: string;
    invoice: string;
    isValid: boolean;
    error: string;
    apiUpdates: any;
    response: any;
    fetchingInvoice: boolean;
    fee: string;
    feeSettingToggle: boolean;
}

@inject(
    'SwapStore',
    'UnitsStore',
    'InvoicesStore',
    'FiatStore',
    'SettingsStore',
    'FeeStore'
)
@observer
export default class SwapPane extends React.PureComponent<
    SwapPaneProps,
    SwapPaneState
> {
    state = {
        reverse: false,
        serviceFeeSats: 0,
        inputSats: 0,
        outputSats: 0,
        inputFiat: '',
        outputFiat: '',
        invoice: '',
        isValid: false,
        apiUpdates: '',
        error: '',
        response: null,
        fetchingInvoice: false,
        fee: '',
        feeSettingToggle: false
    };

    private _unsubscribe?: () => void;

    async UNSAFE_componentWillMount() {
        this.props.SwapStore.getSwapFees();
    }

    componentDidMount() {
        this._unsubscribe = this.props.navigation.addListener(
            'blur',
            this.resetFields
        );
    }

    async componentDidUpdate(
        _prevProps: Readonly<SwapPaneProps>,
        prevState: Readonly<SwapPaneState>
    ): Promise<void> {
        const { FeeStore, SettingsStore } = this.props;
        const { settings } = SettingsStore;

        if (!prevState.reverse && this.state.reverse) {
            try {
                const fees: {
                    economyFee: number;
                    fastestFee: number;
                    halfHourFee: number;
                    hourFee: number;
                    minimumFee: number;
                } = await FeeStore.getOnchainFeesviaMempool();

                const preferredMempoolRate =
                    settings?.payments?.preferredMempoolRate || 'fastestFee';

                const feeRate =
                    fees[preferredMempoolRate as keyof typeof fees] ??
                    fees.fastestFee;
                this.setState({ fee: feeRate.toString() });
            } catch (error) {
                console.error('Failed to fetch mempool fees:', error);
            }
        }
    }

    componentWillUnmount() {
        this._unsubscribe?.();
    }

    resetFields = () => {
        this.setState({
            inputSats: 0,
            outputSats: 0,
            isValid: false,
            inputFiat: '',
            outputFiat: '',
            invoice: '',
            error: ''
        });
    };

    render() {
        const {
            SwapStore,
            UnitsStore,
            navigation,
            InvoicesStore,
            FiatStore,
            SettingsStore
        } = this.props;
        const {
            reverse,
            serviceFeeSats,
            inputSats,
            outputSats,
            inputFiat,
            outputFiat,
            error,
            apiUpdates,
            invoice,
            isValid,
            fetchingInvoice,
            fee,
            feeSettingToggle
        } = this.state;
        const { subInfo, reverseInfo, loading, apiError, clearError } =
            SwapStore;
        const info: any = reverse ? reverseInfo : subInfo;
        const { units } = UnitsStore;

        const { fiatRates } = FiatStore;
        const { settings } = SettingsStore;
        const { fiat } = settings;

        const fiatEntry =
            fiat && fiatRates
                ? fiatRates.filter((entry: any) => entry.code === fiat)[0]
                : null;

        const rate = fiat && fiatRates && fiatEntry ? fiatEntry.rate : 0;

        const serviceFeePct = info?.fees?.percentage || 0;
        const networkFee = reverse
            ? new BigNumber(info?.fees?.minerFees?.claim || 0).plus(
                  info?.fees?.minerFees?.lockup || 0
              )
            : info?.fees?.minerFees || 0;

        const bigCeil = (big: BigNumber): BigNumber => {
            return big.integerValue(BigNumber.ROUND_CEIL);
        };

        const bigFloor = (big: BigNumber): BigNumber => {
            return big.integerValue(BigNumber.ROUND_FLOOR);
        };

        const SwapsPaneBtn = () => (
            <TouchableOpacity
                style={{ marginTop: -10 }}
                onPress={() => {
                    navigation.navigate('SwapsPane');
                }}
                accessibilityLabel={localeString('general.add')}
            >
                <OrderList
                    fill={themeColor('text')}
                    width="40"
                    height="40"
                    style={{ alignSelf: 'center' }}
                />
            </TouchableOpacity>
        );

        const SettingsBtn = () => (
            <TouchableOpacity style={{ marginTop: -10, marginRight: 6 }}>
                <Icon
                    name="settings"
                    onPress={() => {
                        this.props.navigation.navigate('SwapSettings');
                    }}
                    color={themeColor('text')}
                    underlayColor="transparent"
                    size={33}
                />
            </TouchableOpacity>
        );

        const calculateReceiveAmount = (
            sendAmount: BigNumber,
            serviceFee: number,
            minerFee: number
        ): BigNumber => {
            const receiveAmount = reverse
                ? sendAmount
                      .minus(bigCeil(sendAmount.times(serviceFee).div(100)))
                      .minus(minerFee)
                : sendAmount
                      .minus(minerFee)
                      .div(
                          new BigNumber(1).plus(
                              new BigNumber(serviceFee).div(100)
                          )
                      );
            return BigNumber.maximum(bigFloor(receiveAmount), 0);
        };

        const calculateServiceFeeOnSend = (
            sendAmount: BigNumber,
            serviceFee: number,
            minerFee: number
        ): BigNumber => {
            if (sendAmount.isNaN()) {
                return new BigNumber(0);
            }

            let fee: BigNumber;

            if (reverse) {
                fee = bigCeil(sendAmount.times(serviceFee).div(100));
            } else {
                fee = sendAmount
                    .minus(
                        calculateReceiveAmount(sendAmount, serviceFee, minerFee)
                    )
                    .minus(minerFee);

                if (sendAmount.toNumber() < minerFee) {
                    fee = new BigNumber(0);
                }
            }

            return bigCeil(fee);
        };

        const calculateSendAmount = (
            receiveAmount: BigNumber,
            serviceFee: number,
            minerFee: number
        ): BigNumber => {
            return reverse
                ? bigCeil(
                      receiveAmount
                          .plus(minerFee)
                          .div(
                              new BigNumber(1).minus(
                                  new BigNumber(serviceFee).div(100)
                              )
                          )
                  )
                : bigFloor(
                      receiveAmount
                          .plus(
                              bigCeil(
                                  receiveAmount.times(
                                      new BigNumber(serviceFee).div(100)
                                  )
                              )
                          )
                          .plus(minerFee)
                  );
        };

        const calculateLimit = (limit: number): number => {
            return !reverse
                ? calculateSendAmount(
                      new BigNumber(limit),
                      serviceFeePct,
                      networkFee
                  ).toNumber()
                : limit;
        };

        const min = calculateLimit(info?.limits?.minimal || 0);
        const max = calculateLimit(info?.limits?.maximal || 0);

        const errorInput =
            (inputSats !== 0 && inputSats < min) || inputSats > max;
        const errorOutput = outputSats < 0;
        const errorMsg = errorInput || errorOutput;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Swaps.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={
                        <Row>
                            <SettingsBtn />
                            <SwapsPaneBtn />
                        </Row>
                    }
                    onBack={() => {
                        clearError();
                    }}
                    navigation={navigation}
                />
                <ScrollView
                    contentContainerStyle={{ flexGrow: 1 }}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={{ flex: 1, margin: 10 }}>
                        {loading && <LoadingIndicator />}
                        {!loading && (
                            <>
                                {(error || apiError) && (
                                    <ErrorMessage
                                        message={error || apiError}
                                        dismissable
                                    />
                                )}

                                {apiUpdates && (
                                    <SuccessMessage
                                        message={apiUpdates}
                                        dismissable
                                    />
                                )}

                                <View style={{ alignItems: 'center' }}>
                                    <Text
                                        style={{
                                            fontFamily: 'PPNeueMontreal-Book',
                                            fontSize: 20,
                                            marginBottom: 20
                                        }}
                                    >
                                        {localeString('views.Swaps.create')}
                                    </Text>
                                </View>

                                <View
                                    style={{
                                        flex: 1
                                    }}
                                >
                                    <Row>
                                        <View
                                            style={{
                                                flexDirection: 'column',
                                                width: '89%'
                                            }}
                                        >
                                            <Row
                                                style={{
                                                    zIndex: 1,
                                                    marginBottom: 10,
                                                    marginRight: 5
                                                }}
                                            >
                                                <AmountInput
                                                    prefix={
                                                        <TouchableOpacity
                                                            onPress={() => {
                                                                this.setState({
                                                                    reverse:
                                                                        !reverse,
                                                                    inputSats: 0,
                                                                    outputSats: 0,
                                                                    inputFiat:
                                                                        '',
                                                                    outputFiat:
                                                                        '',
                                                                    serviceFeeSats: 0,
                                                                    invoice: ''
                                                                });
                                                            }}
                                                            style={{
                                                                marginLeft: -10
                                                            }}
                                                        >
                                                            {reverse ? (
                                                                <LightningSvg
                                                                    width={60}
                                                                    circle={
                                                                        false
                                                                    }
                                                                />
                                                            ) : (
                                                                <OnChainSvg
                                                                    width={60}
                                                                    circle={
                                                                        false
                                                                    }
                                                                />
                                                            )}
                                                        </TouchableOpacity>
                                                    }
                                                    onAmountChange={(
                                                        amount,
                                                        satAmount:
                                                            | string
                                                            | number
                                                    ) => {
                                                        this.setState({
                                                            error: ''
                                                        });

                                                        // remove commas
                                                        const sanitizedSatAmount =
                                                            units !== 'BTC'
                                                                ? String(
                                                                      satAmount
                                                                  )
                                                                      .replace(
                                                                          /,/g,
                                                                          ''
                                                                      )
                                                                      .trim()
                                                                : satAmount;
                                                        if (
                                                            !sanitizedSatAmount ||
                                                            sanitizedSatAmount ===
                                                                '0'
                                                        ) {
                                                            this.setState({
                                                                serviceFeeSats: 0,
                                                                outputSats: 0
                                                            });
                                                        }

                                                        const satAmountNew =
                                                            new BigNumber(
                                                                sanitizedSatAmount ||
                                                                    0
                                                            );

                                                        const outputSats =
                                                            calculateReceiveAmount(
                                                                satAmountNew,
                                                                serviceFeePct,
                                                                networkFee
                                                            );

                                                        const outputFiat =
                                                            outputSats.isGreaterThan(
                                                                0
                                                            )
                                                                ? outputSats
                                                                      .div(
                                                                          SATS_PER_BTC
                                                                      )
                                                                      .times(
                                                                          rate
                                                                      )
                                                                      .toFixed(
                                                                          2
                                                                      )
                                                                : '';

                                                        this.setState({
                                                            serviceFeeSats:
                                                                calculateServiceFeeOnSend(
                                                                    satAmountNew,
                                                                    serviceFeePct,
                                                                    networkFee
                                                                ),
                                                            inputSats:
                                                                Number(
                                                                    sanitizedSatAmount
                                                                ),
                                                            outputSats,
                                                            inputFiat:
                                                                amount &&
                                                                amount.toString(),
                                                            outputFiat
                                                        });
                                                    }}
                                                    {...(units === 'fiat'
                                                        ? { amount: inputFiat }
                                                        : {})}
                                                    sats={
                                                        units === 'fiat'
                                                            ? ''
                                                            : inputSats
                                                            ? units !== 'BTC'
                                                                ? numberWithCommas(
                                                                      inputSats.toString()
                                                                  )
                                                                : inputSats.toString()
                                                            : ''
                                                    }
                                                    hideConversion
                                                    hideUnitChangeButton
                                                    error={errorInput}
                                                />
                                            </Row>
                                            <TouchableOpacity
                                                style={{
                                                    alignSelf: 'center',
                                                    position: 'absolute',
                                                    zIndex: 100,
                                                    top: 50
                                                }}
                                                onPress={() => {
                                                    this.setState({
                                                        reverse: !reverse,
                                                        inputSats: 0,
                                                        outputSats: 0,
                                                        inputFiat: '',
                                                        outputFiat: '',
                                                        serviceFeeSats: 0,
                                                        invoice: ''
                                                    });
                                                }}
                                            >
                                                <View
                                                    style={{
                                                        backgroundColor:
                                                            themeColor(
                                                                'background'
                                                            ),
                                                        borderRadius: 30,
                                                        padding: 10,
                                                        position: 'absolute'
                                                    }}
                                                >
                                                    <ArrowDown
                                                        fill={themeColor(
                                                            'text'
                                                        )}
                                                        height="30"
                                                        width="30"
                                                    />
                                                </View>
                                            </TouchableOpacity>
                                            <View style={{ zIndex: 2 }}>
                                                <Row
                                                    style={{
                                                        zIndex: 1,
                                                        top: -20,
                                                        marginRight: 5
                                                    }}
                                                >
                                                    <AmountInput
                                                        prefix={
                                                            <TouchableOpacity
                                                                onPress={() => {
                                                                    this.setState(
                                                                        {
                                                                            reverse:
                                                                                !reverse,
                                                                            inputSats: 0,
                                                                            outputSats: 0,
                                                                            inputFiat:
                                                                                '',
                                                                            outputFiat:
                                                                                '',
                                                                            serviceFeeSats: 0,
                                                                            invoice:
                                                                                ''
                                                                        }
                                                                    );
                                                                }}
                                                                style={{
                                                                    marginLeft:
                                                                        -10
                                                                }}
                                                            >
                                                                {reverse ? (
                                                                    <OnChainSvg
                                                                        width={
                                                                            60
                                                                        }
                                                                        circle={
                                                                            false
                                                                        }
                                                                    />
                                                                ) : (
                                                                    <LightningSvg
                                                                        width={
                                                                            60
                                                                        }
                                                                        circle={
                                                                            false
                                                                        }
                                                                    />
                                                                )}
                                                            </TouchableOpacity>
                                                        }
                                                        onAmountChange={(
                                                            amount,
                                                            satAmount:
                                                                | string
                                                                | number
                                                        ) => {
                                                            this.setState({
                                                                error: ''
                                                            });

                                                            // remove commas
                                                            const sanitizedSatAmount =
                                                                units !== 'BTC'
                                                                    ? String(
                                                                          satAmount
                                                                      )
                                                                          .replace(
                                                                              /,/g,
                                                                              ''
                                                                          )
                                                                          .trim()
                                                                    : satAmount;
                                                            if (
                                                                !sanitizedSatAmount ||
                                                                sanitizedSatAmount ===
                                                                    '0'
                                                            ) {
                                                                this.setState({
                                                                    serviceFeeSats: 0,
                                                                    inputSats: 0
                                                                });
                                                            }

                                                            const satAmountNew =
                                                                new BigNumber(
                                                                    sanitizedSatAmount ||
                                                                        0
                                                                );

                                                            let input: any;
                                                            if (
                                                                satAmountNew.isEqualTo(
                                                                    0
                                                                )
                                                            ) {
                                                                input = 0;
                                                            } else
                                                                input =
                                                                    calculateSendAmount(
                                                                        satAmountNew,
                                                                        serviceFeePct,
                                                                        networkFee
                                                                    );

                                                            const inputFiat =
                                                                new BigNumber(
                                                                    input
                                                                ).isGreaterThan(
                                                                    0
                                                                )
                                                                    ? new BigNumber(
                                                                          input
                                                                      )
                                                                          .div(
                                                                              SATS_PER_BTC
                                                                          )
                                                                          .times(
                                                                              rate
                                                                          )
                                                                          .toFixed(
                                                                              2
                                                                          )
                                                                    : '';

                                                            const serviceFeeSats =
                                                                reverse && input
                                                                    ? input
                                                                          .times(
                                                                              serviceFeePct
                                                                          )
                                                                          .div(
                                                                              100
                                                                          )
                                                                    : satAmountNew
                                                                          .times(
                                                                              serviceFeePct
                                                                          )
                                                                          .div(
                                                                              100
                                                                          );

                                                            this.setState({
                                                                serviceFeeSats:
                                                                    bigCeil(
                                                                        serviceFeeSats
                                                                    ),
                                                                inputSats:
                                                                    input,
                                                                outputSats:
                                                                    Number(
                                                                        sanitizedSatAmount
                                                                    ),
                                                                inputFiat,
                                                                outputFiat:
                                                                    amount &&
                                                                    amount.toString()
                                                            });
                                                        }}
                                                        {...(units === 'fiat'
                                                            ? {
                                                                  amount: outputFiat
                                                              }
                                                            : {})}
                                                        sats={
                                                            units === 'fiat'
                                                                ? ''
                                                                : outputSats
                                                                ? units !==
                                                                  'BTC'
                                                                    ? numberWithCommas(
                                                                          outputSats.toString()
                                                                      )
                                                                    : outputSats.toString()
                                                                : ''
                                                        }
                                                        hideConversion
                                                        hideUnitChangeButton
                                                        error={errorOutput}
                                                    />
                                                </Row>
                                            </View>
                                        </View>
                                        <View
                                            style={{
                                                flexDirection: 'column',
                                                width: '11%'
                                            }}
                                        >
                                            <TouchableOpacity
                                                onPress={() => {
                                                    UnitsStore.changeUnits();
                                                    this.setState({
                                                        inputSats: 0,
                                                        outputSats: 0,
                                                        serviceFeeSats: 0,
                                                        inputFiat: '',
                                                        outputFiat: ''
                                                    });
                                                }}
                                                style={{
                                                    marginLeft: 10,
                                                    top: -10
                                                }}
                                            >
                                                {UnitsStore!.getNextUnit() ===
                                                'fiat' ? (
                                                    <ExchangeFiatSVG
                                                        fill={themeColor(
                                                            'text'
                                                        )}
                                                        width="35"
                                                        height="35"
                                                    />
                                                ) : (
                                                    <ExchangeBitcoinSVG
                                                        fill={themeColor(
                                                            'text'
                                                        )}
                                                        width="35"
                                                        height="35"
                                                    />
                                                )}
                                            </TouchableOpacity>
                                        </View>
                                    </Row>

                                    <Row justify="space-between">
                                        <View>
                                            <Row>
                                                <Text
                                                    style={{
                                                        fontFamily:
                                                            'PPNeueMontreal-Book'
                                                    }}
                                                >
                                                    {`${localeString(
                                                        'views.Swaps.networkFee'
                                                    )}: `}
                                                </Text>
                                                <Amount sats={networkFee} />
                                            </Row>
                                            <Row>
                                                <Text
                                                    style={{
                                                        fontFamily:
                                                            'PPNeueMontreal-Book'
                                                    }}
                                                >
                                                    {`${localeString(
                                                        'views.Swaps.serviceFee'
                                                    )}: `}
                                                </Text>
                                                <Amount sats={serviceFeeSats} />
                                                <Text
                                                    style={{
                                                        fontFamily:
                                                            'PPNeueMontreal-Book'
                                                    }}
                                                >
                                                    {` (${serviceFeePct}%)`}
                                                </Text>
                                            </Row>
                                        </View>
                                        <View>
                                            <TouchableOpacity
                                                onPress={() => {
                                                    this.setState({
                                                        error: ''
                                                    });

                                                    const satAmount = min;

                                                    const inputFiat =
                                                        new BigNumber(
                                                            min
                                                        ).isGreaterThan(0)
                                                            ? new BigNumber(min)
                                                                  .div(
                                                                      SATS_PER_BTC
                                                                  )
                                                                  .times(rate)
                                                                  .toFixed(2)
                                                            : '';

                                                    // remove commas
                                                    const sanitizedSatAmount =
                                                        units !== 'BTC'
                                                            ? String(satAmount)
                                                                  .replace(
                                                                      /,/g,
                                                                      ''
                                                                  )
                                                                  .trim()
                                                            : satAmount;
                                                    if (
                                                        !sanitizedSatAmount ||
                                                        sanitizedSatAmount ===
                                                            '0'
                                                    ) {
                                                        this.setState({
                                                            serviceFeeSats: 0,
                                                            outputSats: 0
                                                        });
                                                    }

                                                    const satAmountNew =
                                                        new BigNumber(
                                                            sanitizedSatAmount ||
                                                                0
                                                        );

                                                    const outputSats =
                                                        calculateReceiveAmount(
                                                            satAmountNew,
                                                            serviceFeePct,
                                                            networkFee
                                                        );

                                                    const outputFiat =
                                                        outputSats.isGreaterThan(
                                                            0
                                                        )
                                                            ? outputSats
                                                                  .div(
                                                                      SATS_PER_BTC
                                                                  )
                                                                  .times(rate)
                                                                  .toFixed(2)
                                                            : '';

                                                    this.setState({
                                                        serviceFeeSats:
                                                            calculateServiceFeeOnSend(
                                                                satAmountNew,
                                                                serviceFeePct,
                                                                networkFee
                                                            ),
                                                        inputSats:
                                                            Number(
                                                                sanitizedSatAmount
                                                            ),
                                                        outputSats,
                                                        inputFiat,
                                                        outputFiat
                                                    });
                                                }}
                                            >
                                                <Row>
                                                    <Text
                                                        style={{
                                                            fontFamily:
                                                                'PPNeueMontreal-Book'
                                                        }}
                                                    >
                                                        {`${localeString(
                                                            'general.min'
                                                        )}: `}
                                                    </Text>
                                                    <Amount sats={min} />
                                                </Row>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => {
                                                    this.setState({
                                                        error: ''
                                                    });

                                                    const satAmount = max;

                                                    const inputFiat =
                                                        new BigNumber(
                                                            max
                                                        ).isGreaterThan(0)
                                                            ? new BigNumber(max)
                                                                  .div(
                                                                      SATS_PER_BTC
                                                                  )
                                                                  .times(rate)
                                                                  .toFixed(2)
                                                            : '';

                                                    // remove commas
                                                    const sanitizedSatAmount =
                                                        units !== 'BTC'
                                                            ? String(satAmount)
                                                                  .replace(
                                                                      /,/g,
                                                                      ''
                                                                  )
                                                                  .trim()
                                                            : satAmount;
                                                    if (
                                                        !sanitizedSatAmount ||
                                                        sanitizedSatAmount ===
                                                            '0'
                                                    ) {
                                                        this.setState({
                                                            serviceFeeSats: 0,
                                                            outputSats: 0
                                                        });
                                                    }

                                                    const satAmountNew =
                                                        new BigNumber(
                                                            sanitizedSatAmount ||
                                                                0
                                                        );

                                                    const outputSats =
                                                        calculateReceiveAmount(
                                                            satAmountNew,
                                                            serviceFeePct,
                                                            networkFee
                                                        );

                                                    const outputFiat =
                                                        outputSats.isGreaterThan(
                                                            0
                                                        )
                                                            ? outputSats
                                                                  .div(
                                                                      SATS_PER_BTC
                                                                  )
                                                                  .times(rate)
                                                                  .toFixed(2)
                                                            : '';
                                                    this.setState({
                                                        serviceFeeSats:
                                                            calculateServiceFeeOnSend(
                                                                satAmountNew,
                                                                serviceFeePct,
                                                                networkFee
                                                            ),
                                                        inputSats:
                                                            Number(
                                                                sanitizedSatAmount
                                                            ),
                                                        outputSats,
                                                        inputFiat,
                                                        outputFiat
                                                    });
                                                }}
                                            >
                                                <Row>
                                                    <Text
                                                        style={{
                                                            fontFamily:
                                                                'PPNeueMontreal-Book'
                                                        }}
                                                    >
                                                        {`${localeString(
                                                            'general.max'
                                                        )}: `}
                                                    </Text>
                                                    <Amount sats={max} />
                                                </Row>
                                            </TouchableOpacity>
                                        </View>
                                    </Row>
                                </View>
                                <View>
                                    <TextInput
                                        onChangeText={(text: string) => {
                                            let isValid;
                                            if (reverse) {
                                                isValid = text
                                                    ? AddressUtils.isValidBitcoinAddress(
                                                          text,
                                                          true
                                                      )
                                                    : false;
                                            } else {
                                                isValid = text
                                                    ? AddressUtils.isValidLightningPaymentRequest(
                                                          text
                                                      )
                                                    : false;
                                            }
                                            this.setState({
                                                invoice: text,
                                                error: '',
                                                apiUpdates: '',
                                                isValid
                                            });
                                        }}
                                        placeholder={
                                            fetchingInvoice
                                                ? ''
                                                : reverse
                                                ? localeString(
                                                      'views.Settings.AddContact.onchainAddress'
                                                  )
                                                : localeString(
                                                      'views.PaymentRequest.title'
                                                  )
                                        }
                                        style={{
                                            marginHorizontal: 20
                                        }}
                                        value={invoice}
                                    />
                                    {fetchingInvoice && (
                                        <View style={styles.loadingOverlay}>
                                            <LoadingIndicator />
                                        </View>
                                    )}
                                </View>

                                <View
                                    style={{
                                        marginVertical: 5
                                    }}
                                >
                                    {!(
                                        reverse &&
                                        !BackendUtils.supportsOnchainSends()
                                    ) && (
                                        <Button
                                            onPress={async () => {
                                                this.setState({
                                                    invoice: '',
                                                    fetchingInvoice: true
                                                });
                                                try {
                                                    const amount =
                                                        units === 'sats' ||
                                                        units === 'fiat'
                                                            ? outputSats
                                                            : units === 'BTC'
                                                            ? new BigNumber(
                                                                  outputSats
                                                              )
                                                                  .div(
                                                                      SATS_PER_BTC
                                                                  )
                                                                  .toFixed(8)
                                                            : '';

                                                    if (!amount) {
                                                        this.setState({
                                                            error: localeString(
                                                                'views.Swaps.missingAmount'
                                                            ),
                                                            fetchingInvoice:
                                                                false
                                                        });
                                                        return;
                                                    }

                                                    await InvoicesStore.createUnifiedInvoice(
                                                        {
                                                            memo: '',
                                                            value:
                                                                amount.toString() ||
                                                                '0',
                                                            expiry: '3600'
                                                        }
                                                    );

                                                    if (reverse) {
                                                        if (
                                                            InvoicesStore.onChainAddress
                                                        ) {
                                                            this.setState({
                                                                invoice:
                                                                    InvoicesStore.onChainAddress,
                                                                error: '',
                                                                isValid: true
                                                            });
                                                        } else {
                                                            this.setState({
                                                                error: localeString(
                                                                    'views.Swaps.generateOnchainAddressFailed'
                                                                ),
                                                                fetchingInvoice:
                                                                    false
                                                            });
                                                        }
                                                    } else {
                                                        if (
                                                            InvoicesStore.payment_request
                                                        ) {
                                                            this.setState({
                                                                invoice:
                                                                    InvoicesStore.payment_request,
                                                                isValid: true,
                                                                error: ''
                                                            });
                                                        } else {
                                                            this.setState({
                                                                error: localeString(
                                                                    'views.Swaps.generateInvoiceFailed'
                                                                ),
                                                                fetchingInvoice:
                                                                    false
                                                            });
                                                        }
                                                    }
                                                    this.setState({
                                                        fetchingInvoice: false
                                                    });
                                                } catch (e: any) {
                                                    console.error(
                                                        'Error generating invoice:',
                                                        e
                                                    );
                                                    this.setState({
                                                        error: localeString(
                                                            'views.Swaps.generateInvoiceFailed'
                                                        ),
                                                        fetchingInvoice: false
                                                    });
                                                }
                                            }}
                                            title={
                                                !reverse
                                                    ? localeString(
                                                          'views.Swaps.generateInvoice'
                                                      )
                                                    : localeString(
                                                          'views.Swaps.generateOnchainAddress'
                                                      )
                                            }
                                            secondary
                                            disabled={
                                                errorMsg ||
                                                !!invoice ||
                                                loading ||
                                                inputSats === 0 ||
                                                outputSats === 0
                                            }
                                        />
                                    )}
                                </View>
                                {reverse && (
                                    <View style={{ paddingHorizontal: 20 }}>
                                        <TouchableOpacity
                                            onPress={() => {
                                                this.setState({
                                                    feeSettingToggle:
                                                        !feeSettingToggle
                                                });
                                            }}
                                        >
                                            <View
                                                style={{
                                                    marginTop:
                                                        reverse &&
                                                        !BackendUtils.supportsOnchainSends()
                                                            ? 0
                                                            : 10,
                                                    marginBottom: 20
                                                }}
                                            >
                                                <Row justify="space-between">
                                                    <View
                                                        style={{ width: '95%' }}
                                                    >
                                                        <KeyValue
                                                            keyValue={localeString(
                                                                'views.Swaps.setFeeRate'
                                                            )}
                                                        />
                                                    </View>
                                                    {feeSettingToggle ? (
                                                        <CaretDown
                                                            fill={themeColor(
                                                                'text'
                                                            )}
                                                            width="20"
                                                            height="20"
                                                        />
                                                    ) : (
                                                        <CaretRight
                                                            fill={themeColor(
                                                                'text'
                                                            )}
                                                            width="20"
                                                            height="20"
                                                        />
                                                    )}
                                                </Row>
                                            </View>
                                        </TouchableOpacity>
                                        {feeSettingToggle && (
                                            <>
                                                <Text
                                                    style={{
                                                        color: themeColor(
                                                            'secondaryText'
                                                        )
                                                    }}
                                                >
                                                    {localeString(
                                                        'views.Send.feeSatsVbyte'
                                                    )}
                                                </Text>
                                                <OnchainFeeInput
                                                    fee={fee}
                                                    onChangeFee={(
                                                        text: string
                                                    ) =>
                                                        this.setState({
                                                            fee: text
                                                        })
                                                    }
                                                    navigation={navigation}
                                                />
                                            </>
                                        )}
                                    </View>
                                )}

                                <View>
                                    <Button
                                        title={localeString(
                                            'views.Swaps.initiate'
                                        )}
                                        onPress={() => {
                                            reverse
                                                ? SwapStore?.createReverseSwap(
                                                      invoice,
                                                      Number(
                                                          this.state.inputSats
                                                      ),
                                                      this.state.fee,
                                                      navigation
                                                  )
                                                : SwapStore?.createSubmarineSwap(
                                                      invoice,
                                                      navigation
                                                  );
                                        }}
                                        {...(!reverse
                                            ? {
                                                  containerStyle: {
                                                      marginTop: 10
                                                  }
                                              }
                                            : {})}
                                        disabled={!isValid}
                                    />
                                </View>
                            </>
                        )}
                    </View>
                </ScrollView>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center'
    }
});
