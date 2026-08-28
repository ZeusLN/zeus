import React, { Component } from 'react';
import { Animated, View, I18nManager, TouchableOpacity } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { inject, observer } from 'mobx-react';

import BackendUtils from './../../utils/BackendUtils';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';

import { modalStore } from './../../stores/Stores';
import SyncStore from '../../stores/SyncStore';

import SwipeableRowAction from './SwipeableRowAction';
import SwipeableRowContainer from './SwipeableRowContainer';

import Coins from './../../assets/images/SVG/Coins.svg';
import Receive from './../../assets/images/SVG/Receive.svg';
import Send from './../../assets/images/SVG/Send.svg';

interface OnchainSwipeableRowProps {
    navigation: NativeStackNavigationProp<any, any>;
    value?: string;
    satAmount?: number;
    feeRate?: string;
    locked?: boolean;
    account?: string;
    hidden?: boolean;
    children?: React.ReactNode;
    disabled?: boolean;
    SyncStore?: SyncStore;
}

@inject('SyncStore')
@observer
export default class OnchainSwipeableRow extends Component<
    OnchainSwipeableRowProps,
    {}
> {
    private renderActions = (
        progress: Animated.AnimatedInterpolation<number>,
        close: () => void
    ) => {
        const { account, navigation } = this.props;
        const supportsCoinControl = BackendUtils.supportsCoinControl();
        const width = supportsCoinControl ? 210 : 140;
        const iconProps = {
            fill: themeColor('action') || themeColor('highlight'),
            width: 30,
            height: 30
        };
        const closeThen = (go: () => void) => () => {
            close();
            go();
        };

        return (
            <View
                style={{
                    marginLeft: 15,
                    width,
                    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row'
                }}
            >
                <SwipeableRowAction
                    text={localeString('general.receive')}
                    x={width}
                    progress={progress}
                    icon={<Receive {...iconProps} />}
                    onPress={closeThen(() =>
                        navigation.navigate('Receive', {
                            account:
                                account === 'On-chain' ? 'default' : account,
                            autoGenerateOnChain: true,
                            forceOnChain: true
                        })
                    )}
                />
                {supportsCoinControl && (
                    <SwipeableRowAction
                        text={localeString('general.coins')}
                        x={200}
                        progress={progress}
                        icon={<Coins {...iconProps} />}
                        onPress={closeThen(() =>
                            navigation.navigate('CoinControl', { account })
                        )}
                    />
                )}
                <SwipeableRowAction
                    text={localeString('general.send')}
                    x={width}
                    progress={progress}
                    icon={<Send {...iconProps} />}
                    onPress={closeThen(() => navigation.navigate('Send'))}
                />
            </View>
        );
    };

    private sendToAddress = () => {
        const { navigation, value, satAmount, feeRate } = this.props;
        navigation.navigate('Send', {
            destination: value,
            satAmount,
            fee: feeRate,
            transactionType: 'On-chain'
        });
    };

    render() {
        const { children, value, locked, hidden, disabled, SyncStore } =
            this.props;
        const { isSyncing } = SyncStore!;
        if (isSyncing) {
            return (
                <TouchableOpacity
                    onPress={() =>
                        modalStore.toggleInfoModal({
                            text: localeString('views.Wallet.waitForSync')
                        })
                    }
                    style={{ width: '100%' }}
                    accessibilityRole="button"
                >
                    <View style={{ opacity: 0.25 }}>{children}</View>
                </TouchableOpacity>
            );
        }
        if (locked && value) {
            return (
                <TouchableOpacity
                    onPress={() => (disabled ? null : this.sendToAddress())}
                    activeOpacity={1}
                    style={{ width: '100%' }}
                    accessibilityRole="button"
                    accessibilityState={{ disabled }}
                >
                    {children}
                </TouchableOpacity>
            );
        }
        if (locked)
            return (
                <View style={{ width: '100%', opacity: hidden ? 0.25 : 1 }}>
                    {children}
                </View>
            );
        return (
            <SwipeableRowContainer
                renderLeftActions={this.renderActions}
                onPress={(open) => (value ? this.sendToAddress() : open())}
                containerStyle={{ width: '100%' }}
            >
                {children}
            </SwipeableRowContainer>
        );
    }
}
