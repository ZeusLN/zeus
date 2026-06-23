import React, { Component } from 'react';
import {
    Alert,
    StyleSheet,
    Text,
    View,
    I18nManager,
    TouchableOpacity
} from 'react-native';
import Animated, {
    interpolate,
    SharedValue,
    useAnimatedStyle
} from 'react-native-reanimated';
import { getParams as getlnurlParams, LNURLWithdrawParams } from 'js-lnurl';
import { RectButton } from 'react-native-gesture-handler';
import ReanimatedSwipeable, {
    SwipeableMethods
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { inject, observer } from 'mobx-react';

import BackendUtils from '../../utils/BackendUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import { cashuStore } from '../../stores/Stores';
import SyncStore from '../../stores/SyncStore';

import MintToken from '../../assets/images/SVG/MintToken.svg';
import Mint from '../../assets/images/SVG/Mint.svg';
import Receive from '../../assets/images/SVG/Receive.svg';
import Send from '../../assets/images/SVG/Send.svg';

const ActionContainer = ({
    x,
    progress,
    children
}: {
    x: number;
    progress: SharedValue<number>;
    children: React.ReactNode;
}) => {
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: interpolate(progress.value, [0.25, 1], [x, 0]) }
        ],
        opacity: interpolate(progress.value, [0, 1], [0, 1])
    }));
    return (
        <Animated.View style={[{ flex: 1 }, animatedStyle]}>
            {children}
        </Animated.View>
    );
};

interface EcashSwipeableRowProps {
    navigation: NativeStackNavigationProp<any, any>;
    lightning?: string;
    lnurlParams?: LNURLWithdrawParams | undefined;
    value?: string;
    locked?: boolean;
    account?: string;
    hidden?: boolean;
    children?: React.ReactNode;
    disabled?: boolean;
    needsConfig?: boolean;
    SyncStore?: SyncStore;
}

@inject('SyncStore')
@observer
export default class EcashSwipeableRow extends Component<
    EcashSwipeableRowProps,
    {}
> {
    private renderAction = (
        text: string,
        x: number,
        progress: SharedValue<number>
    ) => {
        const { account, navigation } = this.props;
        const pressHandler = () => {
            this.close();

            if (text === localeString('general.receive')) {
                navigation.navigate('ReceiveEcash');
            } else if (text === localeString('cashu.mints')) {
                navigation.navigate('Mints', { account });
            } else if (text === localeString('cashu.sendEcash')) {
                navigation.navigate('SendEcash');
            } else if (text === localeString('general.send')) {
                navigation.navigate('Send');
            }
        };

        return (
            <ActionContainer x={x} progress={progress}>
                <RectButton style={[styles.action]} onPress={pressHandler}>
                    <View
                        style={[styles.view]}
                        accessible
                        accessibilityRole="button"
                    >
                        {text === localeString('cashu.mints') && (
                            <Mint
                                fill={
                                    themeColor('action') ||
                                    themeColor('highlight')
                                }
                                width={30}
                                height={30}
                            />
                        )}
                        {text === localeString('cashu.sendEcash') && (
                            <MintToken
                                fill={
                                    themeColor('action') ||
                                    themeColor('highlight')
                                }
                                width={30}
                                height={30}
                            />
                        )}
                        {text === localeString('general.receive') && (
                            <Receive
                                fill={
                                    themeColor('action') ||
                                    themeColor('highlight')
                                }
                                width={30}
                                height={30}
                            />
                        )}
                        {text === localeString('general.send') && (
                            <Send
                                fill={
                                    themeColor('action') ||
                                    themeColor('highlight')
                                }
                                width={30}
                                height={30}
                            />
                        )}
                        <Text
                            style={{
                                ...styles.actionText,
                                color: themeColor('text')
                            }}
                        >
                            {text}
                        </Text>
                    </View>
                </RectButton>
            </ActionContainer>
        );
    };

    private renderActions = (progress: SharedValue<number>) => (
        <View
            style={{
                marginLeft: 15,
                width: 280,
                flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row'
            }}
        >
            {this.renderAction(
                localeString('general.receive'),
                BackendUtils.supportsCoinControl() ? 210 : 140,
                progress
            )}
            {this.renderAction(localeString('cashu.mints'), 200, progress)}
            {this.renderAction(localeString('cashu.sendEcash'), 200, progress)}
            {this.renderAction(
                localeString('general.send'),
                BackendUtils.supportsCoinControl() ? 210 : 140,
                progress
            )}
        </View>
    );

    private swipeableRow?: SwipeableMethods;

    private updateRef = (ref: SwipeableMethods | null) => {
        this.swipeableRow = ref ?? undefined;
    };

    private close = () => {
        if (this.swipeableRow) this.swipeableRow.close();
    };

    private open = () => {
        if (this.swipeableRow) this.swipeableRow.openLeft();
    };

    private handleLnurlRequest = async (
        lightning?: string,
        lnurlParams?: any,
        navigation?: any
    ): Promise<void> => {
        const params = lnurlParams || (await getlnurlParams(lightning ?? ''));
        if (
            params &&
            params.status === 'ERROR' &&
            params.domain?.endsWith('.onion')
        ) {
            // TODO handle fetching of params with internal Tor
            throw new Error(`${params.domain} says: ${params.reason}`);
        }

        switch (params.tag) {
            case 'payRequest':
                params.lnurlText = lightning;
                navigation.navigate('LnurlPay', {
                    lnurlParams: params,
                    ecash: true
                });
                break;
            case 'withdrawRequest':
                navigation.navigate('ReceiveEcash', {
                    lnurlParams: params
                });
                break;
            default:
                Alert.alert(
                    localeString('general.error'),
                    params.status === 'ERROR'
                        ? `${params.domain} says: ${params.reason}`
                        : `${localeString(
                              'utils.handleAnything.unsupportedLnurlType'
                          )}: ${params.tag}`,
                    [
                        {
                            text: localeString('general.ok'),
                            onPress: () => void 0
                        }
                    ],
                    { cancelable: false }
                );
        }
    };

    private fetchLnInvoice = () => {
        const { lightning, lnurlParams, navigation } = this.props;
        if (lightning?.toLowerCase().startsWith('lnurl') || lnurlParams) {
            this.handleLnurlRequest(lightning, lnurlParams, navigation);
            return;
        } else {
            cashuStore.getPayReq(lightning ?? '');
            this.props.navigation.navigate('CashuPaymentRequest', {});
        }
    };

    render() {
        const {
            children,
            lightning,
            value,
            locked,
            disabled,
            hidden,
            needsConfig,
            navigation
        } = this.props;

        if (locked && lightning) {
            return (
                <TouchableOpacity
                    onPress={() => (disabled ? null : this.fetchLnInvoice())}
                    activeOpacity={1}
                    style={{ width: '100%' }}
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
            <ReanimatedSwipeable
                ref={this.updateRef}
                friction={2}
                enableTrackpadTwoFingerGesture
                leftThreshold={30}
                rightThreshold={40}
                renderLeftActions={this.renderActions}
                containerStyle={{ width: '100%' }}
            >
                <TouchableOpacity
                    onPress={() =>
                        needsConfig
                            ? navigation.navigate('Mints')
                            : value
                            ? this.fetchLnInvoice()
                            : this.open()
                    }
                    activeOpacity={1}
                    style={{ opacity: needsConfig ? 0.4 : 1 }}
                >
                    {children}
                </TouchableOpacity>
            </ReanimatedSwipeable>
        );
    }
}

const styles = StyleSheet.create({
    actionText: {
        fontSize: 12,
        backgroundColor: 'transparent',
        paddingTop: 10,
        paddingHorizontal: 4,
        fontFamily: 'PPNeueMontreal-Book'
    },
    action: {
        flex: 1,
        justifyContent: 'center'
    },
    view: {
        alignItems: 'center'
    }
});
