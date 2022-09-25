import * as React from 'react';
import { Text, View } from 'react-native';

import { inject, observer } from 'mobx-react';

import Button from '../../components/Button';
import PinPad from '../../components/PinPad';
import UnitToggle from '../../components/UnitToggle';
import { WalletHeader } from '../../components/WalletHeader';

import FiatStore from '../../stores/FiatStore';
import SettingsStore from '../../stores/SettingsStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

interface DefaultPaneProps {
    navigation: any;
    FiatStore: FiatStore;
    SettingsStore: SettingsStore;
}

interface DefaultPaneState {
    amount: string;
}

const MAX_LENGTH = 10;

@inject('FiatStore', 'SettingsStore')
@observer
export default class DefaultPane extends React.PureComponent<
    DefaultPaneProps,
    DefaultPaneState
> {
    state = {
        amount: '0'
    };

    appendValue = (value: string) => {
        const { amount } = this.state;

        let newAmount;

        if (amount.length >= MAX_LENGTH) {
            newAmount = amount;
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

    render() {
        const { FiatStore, SettingsStore, navigation } = this.props;
        const { amount } = this.state;

        return (
            <View style={{ flex: 1 }}>
                <WalletHeader
                    navigation={navigation}
                    SettingsStore={SettingsStore}
                />

                <View
                    style={{
                        flex: 1,
                        flexDirection: 'column',
                        alignSelf: 'center',
                        textAlign: 'center',
                        justifyContent: 'center',
                        zIndex: 10,
                        bottom: 40
                    }}
                >
                    <Text
                        style={{
                            color:
                                amount === '0'
                                    ? themeColor('secondaryText')
                                    : themeColor('text'),
                            fontSize: this.amountSize(),
                            textAlign: 'center',
                            fontFamily: 'Lato-Bold'
                        }}
                    >
                        {FiatStore.numberWithCommas(amount)}
                    </Text>

                    <UnitToggle />
                </View>

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
