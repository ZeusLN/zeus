import * as React from 'react';
import { Animated, View } from 'react-native';

import { inject, observer } from 'mobx-react';

import Button from '../../components/Button';
import PinPad from '../../components/PinPad';
import UnitToggle from '../../components/UnitToggle';
import { WalletHeader } from '../../components/WalletHeader';

import FiatStore from '../../stores/FiatStore';
import UnitsStore from '../../stores/UnitsStore';
import SettingsStore from '../../stores/SettingsStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

interface DefaultPaneProps {
    navigation: any;
    FiatStore: FiatStore;
    UnitsStore: UnitsStore;
    SettingsStore: SettingsStore;
}

interface DefaultPaneState {
    amount: string;
}

const MAX_LENGTH = 10;

@inject('FiatStore', 'UnitsStore', 'SettingsStore')
@observer
export default class DefaultPane extends React.PureComponent<
    DefaultPaneProps,
    DefaultPaneState
> {
    shakeAnimation = new Animated.Value(0);
    textAnimation = new Animated.Value(0);
    state = {
        amount: '0'
    };

    appendValue = (value: string) => {
        const { amount } = this.state;
        const { units } = this.props.UnitsStore;

        let newAmount;

        // limit decimal places depending on units
        if (units === 'fiat') {
            if (amount.split('.')[1] && amount.split('.')[1].length == 2)
                return this.startShake();
        }
        if (units === 'sats') {
            if (amount.split('.')[1] && amount.split('.')[1].length == 3)
                return this.startShake();
        }

        if (amount.length >= MAX_LENGTH) {
            newAmount = amount;
            return this.startShake();
        } else if (amount === '0') {
            newAmount = value;
        } else {
            newAmount = `${amount}${value}`;
        }

        this.setState({
            amount: newAmount
        });
    };

    clearValue = () => {
        this.setState({
            amount: '0'
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

        this.setState({
            amount: newAmount
        });
    };

    amountSize = () => {
        switch (this.state.amount.length) {
            case 1:
            case 2:
                return 80;
                break;
            case 3:
            case 4:
                return 65;
                break;
            case 5:
            case 6:
                return 55;
                break;
            case 7:
                return 50;
                break;
            case 8:
                return 45;
                break;
            default:
                return 35;
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
            ]).start(),
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
            ]).start()
        ]);
    };

    render() {
        const { FiatStore, SettingsStore, navigation } = this.props;
        const { amount } = this.state;

        const color = this.textAnimation.interpolate({
            inputRange: [0, 1],
            outputRange: [themeColor('text'), 'red']
        });

        return (
            <View style={{ flex: 1 }}>
                <WalletHeader
                    navigation={navigation}
                    SettingsStore={SettingsStore}
                />

                <Animated.View
                    style={{
                        flex: 1,
                        flexDirection: 'column',
                        alignSelf: 'center',
                        textAlign: 'center',
                        justifyContent: 'center',
                        zIndex: 10,
                        bottom: 40,
                        transform: [{ translateX: this.shakeAnimation }]
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
                            fontFamily: 'Lato-Bold'
                        }}
                    >
                        {FiatStore.numberWithCommas(amount)}
                    </Animated.Text>

                    <UnitToggle onToggle={this.clearValue} />
                </Animated.View>

                <View>
                    <View style={{ bottom: '10%' }}>
                        <PinPad
                            appendValue={this.appendValue}
                            clearValue={this.clearValue}
                            deleteValue={this.deleteValue}
                            numberHighlight
                            amount
                        />
                    </View>
                    <View
                        style={{
                            flex: 1,
                            flexDirection: 'row',
                            position: 'absolute',
                            bottom: 10
                        }}
                    >
                        <View style={{ width: '50%' }}>
                            <Button
                                title={localeString('general.request')}
                                quinary
                                noUppercase
                                onPress={() => {
                                    navigation.navigate('Receive', {
                                        amount
                                    });
                                }}
                            />
                        </View>
                        <View style={{ width: '50%' }}>
                            <Button
                                title={localeString('general.send')}
                                quinary
                                noUppercase
                                disabled={amount === '0'}
                                onPress={() => {
                                    navigation.navigate('Send', {
                                        amount
                                    });
                                }}
                            />
                        </View>
                    </View>
                </View>
            </View>
        );
    }
}
