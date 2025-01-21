import * as React from 'react';
import { Animated, View, Text, TouchableOpacity } from 'react-native';
import { inject, observer } from 'mobx-react';
import BigNumber from 'bignumber.js';
import { StackNavigationProp } from '@react-navigation/stack';

import Button from '../../components/Button';
import Conversion from '../../components/Conversion';
import PinPad from '../../components/PinPad';
import UnitToggle from '../../components/UnitToggle';
import WalletHeader from '../../components/WalletHeader';
import { getSatAmount } from '../../components/AmountInput';

import ChannelsStore from '../../stores/ChannelsStore';
import NodeInfoStore from '../../stores/NodeInfoStore';
import SettingsStore from '../../stores/SettingsStore';
import UnitsStore from '../../stores/UnitsStore';

import BackendUtils from '../../utils/BackendUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import {
    getDecimalPlaceholder,
    formatBitcoinWithSpaces,
    numberWithCommas
} from '../../utils/UnitsUtils';

interface KeypadPaneProps {
    navigation: StackNavigationProp<any, any>;
    ChannelsStore?: ChannelsStore;
    NodeInfoStore?: NodeInfoStore;
    SettingsStore?: SettingsStore;
    UnitsStore?: UnitsStore;
}

interface KeypadPaneState {
    amount: string;
    needInbound: boolean;
    belowMinAmount: boolean;
    overrideBelowMinAmount: boolean;
    flowLspNotConfigured: boolean;
}

@inject('ChannelsStore', 'NodeInfoStore', 'SettingsStore', 'UnitsStore')
@observer
export default class KeypadPane extends React.PureComponent<
    KeypadPaneProps,
    KeypadPaneState
> {
    shakeAnimation = new Animated.Value(0);
    textAnimation = new Animated.Value(0);
    state = {
        amount: '0',
        needInbound: false,
        belowMinAmount: false,
        overrideBelowMinAmount: false,
        flowLspNotConfigured: true
    };

    async UNSAFE_componentWillMount() {
        this.handleLsp();

        this.props.navigation.addListener('focus', async () => {
            this.handleLsp();
        });
    }

    async handleLsp() {
        const { flowLspNotConfigured } =
            this.props.NodeInfoStore!.flowLspNotConfigured();

        this.setState({
            flowLspNotConfigured
        });
    }

    appendValue = (value: string) => {
        const { amount } = this.state;
        const { units } = this.props.UnitsStore!;

        let newAmount;

        // only allow one decimal
        if (amount.includes('.') && value === '.') return this.startShake();

        // limit decimal places depending on units
        if (units === 'fiat') {
            if (amount.split('.')[1] && amount.split('.')[1].length == 2)
                return this.startShake();
        }
        if (units === 'sats') {
            if (amount.split('.')[1] && amount.split('.')[1].length == 3)
                return this.startShake();
        }
        if (units === 'BTC') {
            const [integerPart, decimalPart] = amount.split('.');
            // deny if trying to add more than 8 figures of Bitcoin
            if (
                !decimalPart &&
                integerPart &&
                integerPart.length == 8 &&
                !amount.includes('.') &&
                value !== '.'
            )
                return this.startShake();
            // deny if trying to add more than 8 decimal places of satoshis
            if (decimalPart && decimalPart.length == 8)
                return this.startShake();
        }

        const proposedNewAmountStr = `${amount}${value}`;
        const proposedNewAmount = new BigNumber(proposedNewAmountStr);

        // deny if exceeding BTC 21 million capacity
        if (units === 'BTC' && proposedNewAmount.gt(21000000))
            return this.startShake();
        if (units === 'sats' && proposedNewAmount.gt(2100000000000000.0))
            return this.startShake();

        if (amount === '0') {
            newAmount = value;
        } else {
            newAmount = proposedNewAmountStr;
        }

        let needInbound = false;
        let belowMinAmount = false;
        if (
            BackendUtils.supportsFlowLSP() &&
            this.props.SettingsStore!.settings?.enableLSP &&
            !this.state.flowLspNotConfigured &&
            newAmount !== '0' &&
            new BigNumber(getSatAmount(newAmount)).gt(
                this.props.ChannelsStore!.totalInbound
            )
        ) {
            needInbound = true;
            if (new BigNumber(getSatAmount(newAmount)).lt(50000)) {
                belowMinAmount = true;
            }
        }

        this.setState({
            amount: newAmount,
            needInbound,
            belowMinAmount
        });
    };

    clearValue = () => {
        this.setState({
            amount: '0',
            needInbound: false,
            belowMinAmount: false,
            overrideBelowMinAmount: false
        });
    };

    deleteValue = () => {
        const { amount } = this.state;

        let newAmount;

        if (amount.length === 1) {
            newAmount = '0';
        } else {
            newAmount = amount.substr(0, amount.length - 1);
        }

        let needInbound = false;
        let belowMinAmount = false;
        if (
            BackendUtils.supportsFlowLSP() &&
            this.props.SettingsStore!.settings?.enableLSP &&
            !this.state.flowLspNotConfigured &&
            newAmount !== '0' &&
            new BigNumber(getSatAmount(newAmount)).gt(
                this.props.ChannelsStore!.totalInbound
            )
        ) {
            needInbound = true;
            if (new BigNumber(getSatAmount(newAmount)).lt(50000)) {
                belowMinAmount = true;
            }
        }

        this.setState({
            amount: newAmount,
            needInbound,
            belowMinAmount
        });
    };

    amountSize = () => {
        const { amount, needInbound } = this.state;
        const { units } = this.props.UnitsStore!;
        switch (amount.length + getDecimalPlaceholder(amount, units).count) {
            case 1:
            case 2:
                return needInbound ? 70 : 80;
            case 3:
            case 4:
                return needInbound ? 55 : 65;
            case 5:
            case 6:
                return needInbound ? 45 : 55;
            case 7:
                return needInbound ? 40 : 50;
            case 8:
                return needInbound ? 35 : 45;
            case 9:
                return needInbound ? 25 : 35;
            default:
                return needInbound ? 20 : 30;
        }
    };

    startShake = () => {
        Animated.parallel([
            Animated.sequence([
                Animated.timing(this.textAnimation, {
                    toValue: 1,
                    duration: 100,
                    useNativeDriver: false
                }),
                Animated.timing(this.textAnimation, {
                    toValue: 0,
                    duration: 1000,
                    useNativeDriver: false
                })
            ]),
            Animated.sequence([
                Animated.timing(this.shakeAnimation, {
                    toValue: 10,
                    duration: 100,
                    useNativeDriver: true
                }),
                Animated.timing(this.shakeAnimation, {
                    toValue: -10,
                    duration: 100,
                    useNativeDriver: true
                }),
                Animated.timing(this.shakeAnimation, {
                    toValue: 10,
                    duration: 100,
                    useNativeDriver: true
                }),
                Animated.timing(this.shakeAnimation, {
                    toValue: 0,
                    duration: 100,
                    useNativeDriver: true
                })
            ])
        ]).start();
    };

    render() {
        const { UnitsStore, navigation } = this.props;
        const { amount, needInbound, belowMinAmount, overrideBelowMinAmount } =
            this.state;
        const { units } = UnitsStore!;

        const color = this.textAnimation.interpolate({
            inputRange: [0, 1],
            outputRange: [themeColor('text'), 'red']
        });

        return (
            <View style={{ flex: 1 }}>
                <WalletHeader navigation={navigation} />

                {needInbound && (
                    <TouchableOpacity
                        onPress={() =>
                            navigation.navigate('LspExplanationFees')
                        }
                    >
                        <View
                            style={{
                                backgroundColor: themeColor('secondary'),
                                borderRadius: 10,
                                marginLeft: 10,
                                marginRight: 10,
                                padding: 15,
                                borderWidth: 0.5,
                                top: 5,
                                bottom: 5
                            }}
                        >
                            <Text
                                style={{
                                    fontFamily: 'PPNeueMontreal-Medium',
                                    color: themeColor('text'),
                                    fontSize: 15
                                }}
                            >
                                {this.props.ChannelsStore?.channels.length === 0
                                    ? localeString(
                                          'views.Wallet.KeypadPane.lspExplainerFirstChannel'
                                      )
                                    : localeString(
                                          'views.Wallet.KeypadPane.lspExplainer'
                                      )}
                            </Text>
                            <Text
                                style={{
                                    fontFamily: 'PPNeueMontreal-Medium',
                                    color: themeColor('secondaryText'),
                                    fontSize: 15,
                                    top: 5,
                                    textAlign: 'right'
                                }}
                            >
                                {localeString('general.tapToLearnMore')}
                            </Text>
                        </View>
                    </TouchableOpacity>
                )}

                <Animated.View
                    style={{
                        flex: 1,
                        flexDirection: 'column',
                        alignSelf: 'center',
                        justifyContent: 'center',
                        zIndex: 10,
                        transform: [{ translateX: this.shakeAnimation }],
                        bottom: 15
                    }}
                >
                    <Animated.Text
                        style={{
                            color:
                                amount === '0'
                                    ? themeColor('secondaryText')
                                    : color,
                            fontSize: this.amountSize(),
                            textAlign: 'center',
                            fontFamily: 'PPNeueMontreal-Medium'
                        }}
                    >
                        {units === 'BTC'
                            ? formatBitcoinWithSpaces(amount)
                            : numberWithCommas(amount)}
                        <Text style={{ color: themeColor('secondaryText') }}>
                            {getDecimalPlaceholder(amount, units).string}
                        </Text>
                    </Animated.Text>

                    <UnitToggle onToggle={this.clearValue} />

                    {amount !== '0' && (
                        <View style={{ top: 10, alignItems: 'center' }}>
                            <Conversion amount={amount} />
                        </View>
                    )}
                </Animated.View>

                <View>
                    <View style={{ marginTop: 30, bottom: '10%' }}>
                        <PinPad
                            appendValue={this.appendValue}
                            clearValue={this.clearValue}
                            deleteValue={this.deleteValue}
                            numberHighlight
                            amount
                        />
                    </View>
                    {belowMinAmount && !overrideBelowMinAmount ? (
                        <View style={{ alignItems: 'center' }}>
                            <View
                                style={{
                                    flex: 1,
                                    flexDirection: 'row',
                                    position: 'absolute',
                                    bottom: 10
                                }}
                            >
                                <View style={{ width: '25%' }}>
                                    <Button
                                        title={'50k'}
                                        quaternary
                                        noUppercase
                                        onPress={() => {
                                            UnitsStore?.resetUnits();
                                            this.setState({
                                                amount: '50000',
                                                belowMinAmount: false
                                            });
                                        }}
                                        buttonStyle={{ height: 40 }}
                                    />
                                </View>
                                <View style={{ width: '25%' }}>
                                    <Button
                                        title={'100k'}
                                        quaternary
                                        noUppercase
                                        onPress={() => {
                                            UnitsStore?.resetUnits();
                                            this.setState({
                                                amount: '100000',
                                                belowMinAmount: false
                                            });
                                        }}
                                        buttonStyle={{ height: 40 }}
                                    />
                                </View>
                                <View style={{ width: '25%' }}>
                                    <Button
                                        title={'1m'}
                                        quaternary
                                        noUppercase
                                        onPress={() => {
                                            UnitsStore?.resetUnits();
                                            this.setState({
                                                amount: '1000000',
                                                belowMinAmount: false
                                            });
                                        }}
                                        buttonStyle={{ height: 40 }}
                                    />
                                </View>
                                <View style={{ width: '25%' }}>
                                    <Button
                                        title={localeString('general.other')}
                                        quaternary
                                        noUppercase
                                        onPress={() => {
                                            UnitsStore?.resetUnits();
                                            this.setState({
                                                belowMinAmount: false,
                                                overrideBelowMinAmount: true
                                            });
                                        }}
                                        buttonStyle={{ height: 40 }}
                                    />
                                </View>
                            </View>
                        </View>
                    ) : (
                        <View
                            style={{
                                flex: 1,
                                flexDirection: 'row',
                                position: 'absolute',
                                bottom: 10
                            }}
                        >
                            <View style={{ width: '40%' }}>
                                <Button
                                    title={localeString('general.request')}
                                    quaternary
                                    noUppercase
                                    onPress={() => {
                                        navigation.navigate('Receive', {
                                            amount,
                                            autoGenerate: true
                                        });
                                    }}
                                    buttonStyle={{ height: 40 }}
                                />
                            </View>
                            <View style={{ width: '20%' }}>
                                <Button
                                    icon={{
                                        name: 'pencil',
                                        type: 'font-awesome',
                                        size: 20,
                                        color:
                                            themeColor('buttonText') ||
                                            themeColor('text')
                                    }}
                                    quaternary
                                    noUppercase
                                    onPress={() => {
                                        navigation.navigate('Receive', {
                                            amount
                                        });
                                    }}
                                    buttonStyle={{ height: 40 }}
                                />
                            </View>
                            <View style={{ width: '40%' }}>
                                <Button
                                    title={localeString('general.send')}
                                    quaternary
                                    noUppercase
                                    onPress={() => {
                                        navigation.navigate('Send', {
                                            amount
                                        });
                                    }}
                                    buttonStyle={{ height: 40 }}
                                    disabled={
                                        !BackendUtils.supportsLightningSends()
                                    }
                                />
                            </View>
                        </View>
                    )}
                </View>
            </View>
        );
    }
}
