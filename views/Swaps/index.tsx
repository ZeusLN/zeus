import * as React from 'react';
import { StyleSheet, TouchableOpacity, View, ScrollView } from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import BigNumber from 'bignumber.js';
import { initEccLib } from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
import ecc from '@bitcoinerlab/secp256k1';

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
import ModalBox from '../../components/ModalBox';
import Switch from '../../components/Switch';

import { font } from '../../utils/FontUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import { SATS_PER_BTC, numberWithCommas } from '../../utils/UnitsUtils';
import AddressUtils from '../../utils/AddressUtils';
import BackendUtils from '../../utils/BackendUtils';
import {
    bigCeil,
    calculateReceiveAmount,
    calculateServiceFeeOnSend,
    calculateSendAmount,
    calculateLimit
} from '../../utils/SwapUtils';

import SwapStore, { SWAPS_RESCUE_KEY } from '../../stores/SwapStore';
import UnitsStore from '../../stores/UnitsStore';
import InvoicesStore from '../../stores/InvoicesStore';
import FiatStore from '../../stores/FiatStore';
import SettingsStore from '../../stores/SettingsStore';
import FeeStore from '../../stores/FeeStore';
import NodeInfoStore from '../../stores/NodeInfoStore';
import LSPStore from '../../stores/LSPStore';

import ArrowDown from '../../assets/images/SVG/Arrow_down.svg';
import CaretDown from '../../assets/images/SVG/Caret Down.svg';
import CaretRight from '../../assets/images/SVG/Caret Right.svg';
import ExchangeBitcoinSVG from '../../assets/images/SVG/ExchangeBitcoin.svg';
import ExchangeFiatSVG from '../../assets/images/SVG/ExchangeFiat.svg';
import OnChainSvg from '../../assets/images/SVG/DynamicSVG/OnChainSvg';
import LightningSvg from '../../assets/images/SVG/DynamicSVG/LightningSvg';
import History from '../../assets/images/SVG/History.svg';
import { Icon } from 'react-native-elements';
import KeyIcon from '../../assets/images/SVG/Key.svg';

import Storage from '../../storage';

interface SwapProps {
    navigation: StackNavigationProp<any, 'Swaps'>;
    route: RouteProp<any, 'Swaps'>;
    SwapStore: SwapStore;
    UnitsStore: UnitsStore;
    InvoicesStore: InvoicesStore;
    FiatStore: FiatStore;
    SettingsStore: SettingsStore;
    FeeStore: FeeStore;
    NodeInfoStore: NodeInfoStore;
    LSPStore: LSPStore;
}

interface SwapState {
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
    paramsProcessed?: boolean;
    lastUsedKey?: number;
    seedPhrase?: string[];
    isModalVisible: boolean;
    showRescueKeyBtn: boolean;
    enableLSP: boolean;
    flowLspNotConfigured: boolean;
}

@inject(
    'SwapStore',
    'UnitsStore',
    'InvoicesStore',
    'FiatStore',
    'SettingsStore',
    'FeeStore',
    'NodeInfoStore',
    'LSPStore'
)
@observer
export default class Swap extends React.PureComponent<SwapProps, SwapState> {
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
        feeSettingToggle: false,
        paramsProcessed: false,
        lastUsedKey: 0,
        seedPhrase: [],
        isModalVisible: false,
        showRescueKeyBtn: false,
        enableLSP: true,
        flowLspNotConfigured: true
    };

    private isNavigatingToLSPFees = false;
    private _unsubscribe?: () => void;

    checkIsValid = () => {
        const { reverse, invoice, inputSats, outputSats } = this.state;
        const { SwapStore } = this.props;

        if (SwapStore.loading || !SwapStore.subInfo || !SwapStore.reverseInfo) {
            if (this.state.isValid) {
                this.setState({ isValid: false });
            }
            return;
        }

        const { subInfo, reverseInfo } = SwapStore;
        const info: any = reverse ? reverseInfo : subInfo;

        const serviceFeePct = info?.fees?.percentage || 0;
        const networkFeeBigNum = this.state.reverse
            ? new BigNumber(info?.fees?.minerFees?.claim || 0).plus(
                  info?.fees?.minerFees?.lockup || 0
              )
            : new BigNumber(info?.fees?.minerFees || 0);
        const networkFee = networkFeeBigNum.toNumber();

        const minThreshold = info?.limits?.minimal || 0;
        const maxThreshold = info?.limits?.maximal || 0;

        const minSendAmount = calculateLimit(
            minThreshold,
            serviceFeePct,
            networkFee,
            reverse
        );
        const maxSendAmount = calculateLimit(
            maxThreshold,
            serviceFeePct,
            networkFee,
            reverse
        );

        const currentInputSatsBN = new BigNumber(inputSats || 0);
        const currentOutputSatsBN = new BigNumber(outputSats || 0);

        let invoiceAddressValid = false;
        if (invoice && invoice.trim() !== '') {
            const { NodeInfoStore } = this.props;
            const { nodeInfo } = NodeInfoStore;
            const { isTestNet } = nodeInfo;
            if (reverse) {
                invoiceAddressValid = AddressUtils.isValidBitcoinAddress(
                    invoice,
                    isTestNet
                );
            } else {
                invoiceAddressValid =
                    AddressUtils.isValidLightningPaymentRequest(invoice);
            }
        }

        const inputGreaterThanZero = currentInputSatsBN.isGreaterThan(0);
        const outputGreaterThanZero = currentOutputSatsBN.isGreaterThan(0);

        const inputAmountValidAndWithinLimits =
            inputGreaterThanZero &&
            currentInputSatsBN.isGreaterThanOrEqualTo(minSendAmount) &&
            (maxSendAmount === 0
                ? true
                : currentInputSatsBN.isLessThanOrEqualTo(maxSendAmount));

        const newIsValid =
            invoiceAddressValid &&
            inputAmountValidAndWithinLimits &&
            outputGreaterThanZero;

        if (this.state.isValid !== newIsValid) {
            this.setState({ isValid: newIsValid });
        }
    };

    async UNSAFE_componentWillMount() {
        const { SettingsStore, NodeInfoStore } = this.props;
        const { getSettings } = SettingsStore;
        const settings = await getSettings();

        const { flowLspNotConfigured } = NodeInfoStore.flowLspNotConfigured();

        this.props.SwapStore.getSwapFees();
        this.setState({
            enableLSP: settings?.enableLSP,
            flowLspNotConfigured
        });
    }

    async componentDidMount() {
        const { SwapStore } = this.props;

        const checkAndShowModal = async () => {
            if (!SwapStore.loading) {
                const mnemonic = await Storage.getItem(SWAPS_RESCUE_KEY);
                if (mnemonic) {
                    this.setState({
                        showRescueKeyBtn: true,
                        seedPhrase: mnemonic.split(' ')
                    });
                } else {
                    this.setState({ isModalVisible: true });
                }
            } else {
                setTimeout(checkAndShowModal, 100);
            }
        };

        checkAndShowModal();

        initEccLib(ecc);
        SwapStore.ECPair = ECPairFactory(ecc);

        const unsubBlur = this.props.navigation.addListener('blur', () => {
            if (this.isNavigatingToLSPFees) {
                this.isNavigatingToLSPFees = false;
                return;
            }
            this.resetFields();
        });
        const unsubFocus = this.props.navigation.addListener(
            'focus',
            async () => {
                const mnemonic = await Storage.getItem(SWAPS_RESCUE_KEY);
                if (mnemonic) {
                    this.setState({
                        isModalVisible: false,
                        showRescueKeyBtn: true,
                        seedPhrase: mnemonic.split(' ')
                    });
                } else {
                    this.setState({
                        isModalVisible: true,
                        showRescueKeyBtn: false
                    });
                }
            }
        );

        this._unsubscribe = () => {
            unsubBlur();
            unsubFocus();
        };
    }

    async componentDidUpdate(
        _: Readonly<SwapProps>,
        prevState: Readonly<SwapState>
    ): Promise<void> {
        const {
            FeeStore,
            SettingsStore,
            SwapStore,
            route,
            UnitsStore,
            FiatStore
        } = this.props;
        const { settings } = SettingsStore;

        // Existing fee fetching logic
        if (!prevState.reverse && this.state.reverse) {
            try {
                const feesObj: {
                    economyFee: number;
                    fastestFee: number;
                    halfHourFee: number;
                    hourFee: number;
                    minimumFee: number;
                } = await FeeStore.getOnchainFeesviaMempool();

                const preferredMempoolRate =
                    settings?.payments?.preferredMempoolRate || 'fastestFee';

                const feeRate =
                    feesObj[preferredMempoolRate as keyof typeof feesObj] ??
                    feesObj.fastestFee;
                this.setState({ fee: feeRate.toString() });
            } catch (error) {
                console.error('Failed to fetch mempool fees:', error);
            }
        }

        // Logic for handling route params
        if (!SwapStore.loading && !this.state.paramsProcessed && route.params) {
            const { initialInvoice, initialAmountSats, initialReverse } =
                route.params;

            if (
                initialInvoice !== undefined &&
                initialAmountSats !== undefined &&
                initialReverse !== undefined
            ) {
                this.setState({ paramsProcessed: true }, async () => {
                    // Use callback to ensure paramsProcessed is set before further calcs
                    const { units } = UnitsStore;
                    const { fiatRates } = FiatStore;
                    const { fiat } = settings;
                    const fiatEntry =
                        fiat && fiatRates
                            ? fiatRates.filter(
                                  (entry: any) => entry.code === fiat
                              )[0]
                            : null;
                    const rate =
                        fiat && fiatRates && fiatEntry ? fiatEntry.rate : 0;

                    const info: any = initialReverse
                        ? SwapStore.reverseInfo
                        : SwapStore.subInfo;
                    const serviceFeePct = info?.fees?.percentage || 0;
                    const networkFeeBigNum = initialReverse
                        ? new BigNumber(info?.fees?.minerFees?.claim || 0).plus(
                              info?.fees?.minerFees?.lockup || 0
                          )
                        : new BigNumber(info?.fees?.minerFees || 0);
                    const networkFee = networkFeeBigNum.toNumber();

                    const newOutputSats = new BigNumber(initialAmountSats || 0);
                    let newOutputFiat = '';
                    if (
                        units === 'fiat' &&
                        rate > 0 &&
                        newOutputSats.isGreaterThan(0)
                    ) {
                        newOutputFiat = newOutputSats
                            .div(SATS_PER_BTC)
                            .times(rate)
                            .toFixed(2);
                    }

                    const newInputSats = calculateSendAmount(
                        newOutputSats,
                        serviceFeePct,
                        networkFee,
                        this.state.reverse
                    );
                    let newInputFiat = '';
                    if (
                        units === 'fiat' &&
                        rate > 0 &&
                        newInputSats.isGreaterThan(0)
                    ) {
                        newInputFiat = newInputSats
                            .div(SATS_PER_BTC)
                            .times(rate)
                            .toFixed(2);
                    }

                    const newServiceFeeSats = calculateServiceFeeOnSend(
                        newInputSats,
                        serviceFeePct,
                        networkFee,
                        this.state.reverse
                    );

                    this.setState(
                        {
                            invoice: initialInvoice,
                            reverse: initialReverse,
                            outputSats: newOutputSats,
                            outputFiat:
                                units === 'fiat'
                                    ? newOutputFiat
                                    : this.state.outputFiat,
                            inputSats: newInputSats,
                            inputFiat:
                                units === 'fiat'
                                    ? newInputFiat
                                    : this.state.inputFiat,
                            serviceFeeSats: newServiceFeeSats
                        },
                        () => this.checkIsValid()
                    );
                });
            }
        }
        // Call checkIsValid whenever relevant state that it depends on might have changed.
        // This ensures `isValid` is kept up-to-date.
        if (
            prevState.inputSats !== this.state.inputSats ||
            prevState.outputSats !== this.state.outputSats ||
            prevState.invoice !== this.state.invoice ||
            prevState.reverse !== this.state.reverse
        ) {
            this.checkIsValid();
        }

        if (
            (prevState.outputSats !== this.state.outputSats ||
                prevState.enableLSP !== this.state.enableLSP) &&
            this.state.enableLSP &&
            !this.state.reverse &&
            !this.state.flowLspNotConfigured
        ) {
            const { LSPStore } = this.props;
            const outputSats = new BigNumber(this.state.outputSats);
            if (outputSats.isGreaterThan(0)) {
                LSPStore.getZeroConfFee(outputSats.toNumber() * 1000);
            } else {
                LSPStore.resetFee();
            }
        } else if (prevState.enableLSP && !this.state.enableLSP) {
            this.props.LSPStore.resetFee();
        }
    }

    componentWillUnmount() {
        this._unsubscribe?.();
    }

    resetFields = () => {
        this.setState(
            {
                inputSats: 0,
                outputSats: 0,
                isValid: false,
                inputFiat: '',
                outputFiat: '',
                invoice: '',
                error: '',
                paramsProcessed: false
            },
            () => this.checkIsValid()
        );
    };

    renderRescueKeyModal = () => {
        const { isModalVisible } = this.state;

        const { SwapStore, navigation } = this.props;

        const { generateRescueKey } = SwapStore;

        return (
            <ModalBox
                isOpen={isModalVisible}
                style={{
                    backgroundColor: 'transparent'
                }}
                onClosed={() => {
                    this.setState({
                        isModalVisible: false
                    });
                }}
                position="center"
            >
                <View
                    style={{
                        flex: 1,
                        justifyContent: 'center',
                        alignItems: 'center'
                    }}
                >
                    <View
                        style={{
                            backgroundColor: themeColor('background'),
                            borderRadius: 24,
                            padding: 20,
                            alignItems: 'center',
                            width: '90%'
                        }}
                    >
                        <>
                            <Text
                                style={{
                                    fontFamily: font('marlideBold'),
                                    marginBottom: 12,
                                    fontSize: 32,
                                    textAlign: 'center'
                                }}
                            >
                                {localeString('views.Swaps.rescueKey')}
                            </Text>
                            <Text
                                style={{
                                    fontFamily: 'PPNeueMontreal-Book',
                                    color: themeColor('text'),
                                    marginBottom: 12,
                                    fontSize: 18,
                                    textAlign: 'left'
                                }}
                            >
                                {`${localeString(
                                    'views.Swaps.rescueKey.modal.text1'
                                )}\n\n${localeString(
                                    'views.Swaps.rescueKey.modal.text2'
                                )}\n\n${localeString(
                                    'views.Swaps.rescueKey.modal.text3'
                                )}`}
                            </Text>
                        </>

                        <Button
                            title={localeString('views.Swaps.rescueKey.create')}
                            onPress={async () => {
                                const mnemonic = await generateRescueKey();
                                if (!mnemonic) return;

                                this.setState({
                                    seedPhrase: mnemonic.split(' '),
                                    isModalVisible: false,
                                    showRescueKeyBtn: true
                                });

                                navigation.navigate('Seed', {
                                    seedPhrase: mnemonic.split(' ')
                                });
                            }}
                            containerStyle={{ marginTop: 16, marginBottom: 16 }}
                            tertiary
                        />

                        <Button
                            title={localeString(
                                'views.Swaps.rescueKey.restore'
                            )}
                            onPress={() => {
                                navigation.navigate('SeedRecovery', {
                                    restoreRescueKey: true
                                });
                            }}
                            secondary
                        />
                    </View>
                </View>
            </ModalBox>
        );
    };

    render() {
        const {
            SwapStore,
            UnitsStore,
            navigation,
            InvoicesStore,
            FiatStore,
            SettingsStore,
            LSPStore
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
            feeSettingToggle,
            showRescueKeyBtn,
            enableLSP,
            flowLspNotConfigured
        } = this.state;
        const { subInfo, reverseInfo, loading, apiError, clearError } =
            SwapStore;
        const info: any = reverse ? reverseInfo : subInfo;
        const { units } = UnitsStore;
        const { zeroConfFee } = LSPStore;

        const { fiatRates } = FiatStore;
        const { settings, updateSettings } = SettingsStore;
        const { fiat } = settings;

        const fiatEntry =
            fiat && fiatRates
                ? fiatRates.filter((entry: any) => entry.code === fiat)[0]
                : null;

        const rate = fiat && fiatRates && fiatEntry ? fiatEntry.rate : 0;

        const serviceFeePct = info?.fees?.percentage || 0;
        const networkFeeBigNum = reverse
            ? new BigNumber(info?.fees?.minerFees?.claim || 0).plus(
                  info?.fees?.minerFees?.lockup || 0
              )
            : new BigNumber(info?.fees?.minerFees || 0);
        const networkFee = networkFeeBigNum.toNumber();

        const SwapsPaneBtn = () => (
            <TouchableOpacity
                style={{ marginTop: -10 }}
                onPress={() => {
                    // Reset paramsProcessed when navigating to clear previous prefill
                    this.setState({ paramsProcessed: false });
                    navigation.navigate('SwapsPane');
                }}
                accessibilityLabel={localeString('general.add')}
            >
                <History
                    fill={themeColor('text')}
                    width="40"
                    height="40"
                    style={{ alignSelf: 'center' }}
                />
            </TouchableOpacity>
        );

        const SettingsBtn = () => (
            <TouchableOpacity
                style={{ marginTop: -10, marginRight: 6 }}
                onPress={() => {
                    this.props.navigation.navigate('SwapSettings');
                }}
            >
                <Icon name="settings" color={themeColor('text')} size={33} />
            </TouchableOpacity>
        );

        const RescueKeyPhrase = () => {
            return (
                <TouchableOpacity style={{ marginTop: -10, marginRight: 6 }}>
                    <KeyIcon
                        onPress={() => {
                            navigation.navigate('Seed', {
                                seedPhrase: this.state.seedPhrase
                            });
                        }}
                        underlayColor="transparent"
                        fill={themeColor('text')}
                        width={36}
                        height={36}
                    />
                </TouchableOpacity>
            );
        };

        const min = calculateLimit(
            info?.limits?.minimal || 0,
            serviceFeePct,
            networkFee,
            reverse
        );
        const max = calculateLimit(
            info?.limits?.maximal || 0,
            serviceFeePct,
            networkFee,
            reverse
        );

        const currentInputSats = new BigNumber(inputSats || 0);
        const errorInput =
            (currentInputSats.isGreaterThan(0) &&
                currentInputSats.isLessThan(min)) ||
            currentInputSats.isGreaterThan(max);
        const errorOutput = new BigNumber(outputSats || 0).isLessThan(0);
        const errorMsg = errorInput || errorOutput;

        return (
            <Screen>
                {this.renderRescueKeyModal()}
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
                            {!loading && (
                                <>
                                    {showRescueKeyBtn ? (
                                        <RescueKeyPhrase />
                                    ) : (
                                        <></>
                                    )}
                                    <SettingsBtn />
                                    <SwapsPaneBtn />
                                </>
                            )}
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
                                                                    },
                                                                    () =>
                                                                        this.checkIsValid()
                                                                );
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
                                                        this.setState(
                                                            (prevState) => ({
                                                                error: '',
                                                                invoice:
                                                                    prevState.reverse
                                                                        ? prevState.invoice
                                                                        : ''
                                                            })
                                                        );

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
                                                                networkFee,
                                                                reverse
                                                            );

                                                        let newOutputDisplayString =
                                                            '';
                                                        if (
                                                            outputSats.isGreaterThan(
                                                                0
                                                            )
                                                        ) {
                                                            if (
                                                                units === 'fiat'
                                                            ) {
                                                                newOutputDisplayString =
                                                                    outputSats
                                                                        .div(
                                                                            SATS_PER_BTC
                                                                        )
                                                                        .times(
                                                                            rate
                                                                        )
                                                                        .toFixed(
                                                                            2
                                                                        );
                                                            } else if (
                                                                units === 'BTC'
                                                            ) {
                                                                newOutputDisplayString =
                                                                    outputSats
                                                                        .div(
                                                                            SATS_PER_BTC
                                                                        )
                                                                        .toFixed(
                                                                            8
                                                                        );
                                                            }
                                                        }

                                                        this.setState(
                                                            {
                                                                serviceFeeSats:
                                                                    calculateServiceFeeOnSend(
                                                                        satAmountNew,
                                                                        serviceFeePct,
                                                                        networkFee,
                                                                        reverse
                                                                    ),
                                                                inputSats:
                                                                    Number(
                                                                        sanitizedSatAmount
                                                                    ),
                                                                outputSats,
                                                                inputFiat:
                                                                    amount &&
                                                                    amount.toString(),
                                                                outputFiat:
                                                                    newOutputDisplayString
                                                            },
                                                            () =>
                                                                this.checkIsValid()
                                                        );
                                                    }}
                                                    {...(units !== 'sats'
                                                        ? { amount: inputFiat }
                                                        : {})}
                                                    sats={
                                                        units === 'sats'
                                                            ? inputSats
                                                                ? numberWithCommas(
                                                                      inputSats.toString()
                                                                  )
                                                                : ''
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
                                                                        },
                                                                        () =>
                                                                            this.checkIsValid()
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
                                                            this.setState(
                                                                (
                                                                    prevState
                                                                ) => ({
                                                                    error: '',
                                                                    invoice:
                                                                        prevState.reverse
                                                                            ? prevState.invoice
                                                                            : ''
                                                                })
                                                            );

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
                                                                        networkFee,
                                                                        reverse
                                                                    );

                                                            const newInputSatsBN =
                                                                new BigNumber(
                                                                    input || 0
                                                                );
                                                            let newInputDisplayString =
                                                                '';
                                                            if (
                                                                newInputSatsBN.isGreaterThan(
                                                                    0
                                                                )
                                                            ) {
                                                                if (
                                                                    units ===
                                                                    'fiat'
                                                                ) {
                                                                    newInputDisplayString =
                                                                        newInputSatsBN
                                                                            .div(
                                                                                SATS_PER_BTC
                                                                            )
                                                                            .times(
                                                                                rate
                                                                            )
                                                                            .toFixed(
                                                                                2
                                                                            );
                                                                } else if (
                                                                    units ===
                                                                    'BTC'
                                                                ) {
                                                                    newInputDisplayString =
                                                                        newInputSatsBN
                                                                            .div(
                                                                                SATS_PER_BTC
                                                                            )
                                                                            .toFixed(
                                                                                8
                                                                            );
                                                                }
                                                            }

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

                                                            this.setState(
                                                                {
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
                                                                    inputFiat:
                                                                        newInputDisplayString,
                                                                    outputFiat:
                                                                        amount &&
                                                                        amount.toString()
                                                                },
                                                                () =>
                                                                    this.checkIsValid()
                                                            );
                                                        }}
                                                        {...(units !== 'sats'
                                                            ? {
                                                                  amount: outputFiat
                                                              }
                                                            : {})}
                                                        sats={
                                                            units === 'sats'
                                                                ? outputSats
                                                                    ? numberWithCommas(
                                                                          outputSats.toString()
                                                                      )
                                                                    : ''
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
                                                    const {
                                                        FiatStore,
                                                        SettingsStore
                                                    } = this.props;
                                                    const { fiatRates } =
                                                        FiatStore;
                                                    const { settings } =
                                                        SettingsStore;
                                                    const { fiat } = settings;

                                                    const fiatEntry =
                                                        fiat && fiatRates
                                                            ? fiatRates.filter(
                                                                  (entry) =>
                                                                      entry.code ===
                                                                      fiat
                                                              )[0]
                                                            : null;
                                                    const rate =
                                                        fiat &&
                                                        fiatRates &&
                                                        fiatEntry
                                                            ? fiatEntry.rate
                                                            : 0;

                                                    UnitsStore.changeUnits();
                                                    const newUnit =
                                                        UnitsStore.units;

                                                    this.setState(
                                                        (prevState) => {
                                                            const currentInputSats =
                                                                new BigNumber(
                                                                    prevState.inputSats ||
                                                                        0
                                                                );
                                                            const currentOutputSats =
                                                                new BigNumber(
                                                                    prevState.outputSats ||
                                                                        0
                                                                );
                                                            let newInputDisplayAmount =
                                                                '';
                                                            let newOutputDisplayAmount =
                                                                '';

                                                            if (
                                                                newUnit ===
                                                                    'fiat' &&
                                                                rate > 0
                                                            ) {
                                                                if (
                                                                    currentInputSats.isGreaterThan(
                                                                        0
                                                                    )
                                                                ) {
                                                                    newInputDisplayAmount =
                                                                        currentInputSats
                                                                            .div(
                                                                                SATS_PER_BTC
                                                                            )
                                                                            .times(
                                                                                rate
                                                                            )
                                                                            .toFixed(
                                                                                2
                                                                            );
                                                                }
                                                                if (
                                                                    currentOutputSats.isGreaterThan(
                                                                        0
                                                                    )
                                                                ) {
                                                                    newOutputDisplayAmount =
                                                                        currentOutputSats
                                                                            .div(
                                                                                SATS_PER_BTC
                                                                            )
                                                                            .times(
                                                                                rate
                                                                            )
                                                                            .toFixed(
                                                                                2
                                                                            );
                                                                }
                                                            } else if (
                                                                newUnit ===
                                                                'BTC'
                                                            ) {
                                                                if (
                                                                    currentInputSats.isGreaterThan(
                                                                        0
                                                                    )
                                                                ) {
                                                                    newInputDisplayAmount =
                                                                        currentInputSats
                                                                            .div(
                                                                                SATS_PER_BTC
                                                                            )
                                                                            .toFixed(
                                                                                8
                                                                            );
                                                                }
                                                                if (
                                                                    currentOutputSats.isGreaterThan(
                                                                        0
                                                                    )
                                                                ) {
                                                                    newOutputDisplayAmount =
                                                                        currentOutputSats
                                                                            .div(
                                                                                SATS_PER_BTC
                                                                            )
                                                                            .toFixed(
                                                                                8
                                                                            );
                                                                }
                                                            }

                                                            return {
                                                                inputFiat:
                                                                    newInputDisplayAmount,
                                                                outputFiat:
                                                                    newOutputDisplayAmount
                                                            };
                                                        }
                                                    );
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
                                                            networkFee,
                                                            reverse
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
                                                                networkFee,
                                                                reverse
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
                                                            networkFee,
                                                            reverse
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
                                                                networkFee,
                                                                reverse
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
                                {BackendUtils.supportsFlowLSP() &&
                                    !flowLspNotConfigured &&
                                    !reverse && (
                                        <View
                                            style={{
                                                paddingHorizontal: 20,
                                                flexDirection: 'column',
                                                marginBottom: 15
                                            }}
                                        >
                                            <View
                                                style={{
                                                    flex: 1,
                                                    flexDirection: 'row',
                                                    justifyContent:
                                                        'space-between',
                                                    alignItems: 'center',
                                                    marginBottom:
                                                        zeroConfFee !==
                                                            undefined &&
                                                        invoice &&
                                                        enableLSP
                                                            ? 8
                                                            : 0
                                                }}
                                            >
                                                <Text
                                                    style={{
                                                        fontFamily:
                                                            'PPNeueMontreal-Book',
                                                        color: themeColor(
                                                            'secondaryText'
                                                        ),
                                                        fontSize: 16
                                                    }}
                                                    infoModalText={[
                                                        localeString(
                                                            'views.Receive.lspSwitchExplainer1'
                                                        ),
                                                        localeString(
                                                            'views.Receive.lspSwitchExplainer2'
                                                        )
                                                    ]}
                                                    infoModalAdditionalButtons={[
                                                        {
                                                            title: localeString(
                                                                'general.learnMore'
                                                            ),
                                                            callback: () =>
                                                                navigation.navigate(
                                                                    'LspExplanationOverview'
                                                                )
                                                        }
                                                    ]}
                                                >
                                                    {localeString(
                                                        'views.Settings.LSP.enableLSP'
                                                    )}
                                                </Text>

                                                <Switch
                                                    value={enableLSP}
                                                    onValueChange={async () => {
                                                        this.setState({
                                                            enableLSP:
                                                                !enableLSP,
                                                            invoice: '',
                                                            error: ''
                                                        });
                                                        SwapStore.apiError = '';
                                                        await updateSettings({
                                                            enableLSP:
                                                                !enableLSP
                                                        });
                                                    }}
                                                />
                                            </View>
                                            {zeroConfFee !== undefined &&
                                                enableLSP &&
                                                invoice && (
                                                    <TouchableOpacity
                                                        onPress={() => {
                                                            this.isNavigatingToLSPFees =
                                                                true;
                                                            navigation.navigate(
                                                                new BigNumber(
                                                                    zeroConfFee
                                                                ).gt(1000)
                                                                    ? 'LspExplanationFees'
                                                                    : 'LspExplanationRouting'
                                                            );
                                                        }}
                                                    >
                                                        <View
                                                            style={{
                                                                backgroundColor:
                                                                    themeColor(
                                                                        'secondary'
                                                                    ),
                                                                borderRadius: 10,
                                                                top: 10,
                                                                padding: 15,
                                                                borderWidth: 0.5
                                                            }}
                                                        >
                                                            <Text
                                                                style={{
                                                                    fontFamily:
                                                                        'PPNeueMontreal-Medium',
                                                                    color: themeColor(
                                                                        'text'
                                                                    ),
                                                                    marginBottom: 5
                                                                }}
                                                            >
                                                                {localeString(
                                                                    new BigNumber(
                                                                        zeroConfFee
                                                                    ).gt(1000)
                                                                        ? 'views.Receive.lspExplainer'
                                                                        : 'views.Receive.lspExplainerRouting'
                                                                )}
                                                            </Text>
                                                            <Amount
                                                                sats={
                                                                    zeroConfFee
                                                                }
                                                                fixedUnits="sats"
                                                            />
                                                            <Text
                                                                style={{
                                                                    fontFamily:
                                                                        'PPNeueMontreal-Medium',
                                                                    color: themeColor(
                                                                        'secondaryText'
                                                                    ),
                                                                    fontSize: 15,
                                                                    top: 5,
                                                                    textAlign:
                                                                        'right'
                                                                }}
                                                            >
                                                                {localeString(
                                                                    'general.tapToLearnMore'
                                                                )}
                                                            </Text>
                                                        </View>
                                                    </TouchableOpacity>
                                                )}
                                        </View>
                                    )}

                                <View>
                                    <TextInput
                                        onChangeText={(text: string) => {
                                            this.setState(
                                                {
                                                    invoice: text,
                                                    error: '',
                                                    apiUpdates: ''
                                                },
                                                () => this.checkIsValid()
                                            );
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
                                                    if (!outputSats) {
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
                                                                outputSats.toString() ||
                                                                '0',
                                                            expirySeconds:
                                                                '3600'
                                                        }
                                                    );

                                                    if (reverse) {
                                                        if (
                                                            InvoicesStore.onChainAddress
                                                        ) {
                                                            this.setState(
                                                                {
                                                                    invoice:
                                                                        InvoicesStore.onChainAddress,
                                                                    error: ''
                                                                },
                                                                () =>
                                                                    this.checkIsValid()
                                                            );
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
                                                            this.setState(
                                                                {
                                                                    invoice:
                                                                        InvoicesStore.payment_request,
                                                                    error: ''
                                                                },
                                                                () =>
                                                                    this.checkIsValid()
                                                            );
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
                                                outputSats === 0 ||
                                                fetchingInvoice
                                            }
                                        />
                                    )}
                                </View>
                                <View>
                                    <Button
                                        title={localeString('general.scan')}
                                        onPress={() =>
                                            navigation.navigate(
                                                'HandleAnythingQRScanner',
                                                { fromSwaps: true }
                                            )
                                        }
                                        buttonStyle={{ marginTop: 4 }}
                                        icon={{
                                            name: 'qrcode',
                                            type: 'font-awesome',
                                            size: 25
                                        }}
                                        secondary
                                    />
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
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center'
    }
});
