import React, { Component } from 'react';
import {
    Alert,
    Animated,
    StyleSheet,
    Text,
    View,
    I18nManager,
    TouchableOpacity
} from 'react-native';
import { getParams as getlnurlParams, LNURLWithdrawParams } from 'js-lnurl';
import { RectButton, Swipeable } from 'react-native-gesture-handler';
import { StackNavigationProp } from '@react-navigation/stack';
import { inject, observer } from 'mobx-react';

import BackendUtils from '../../utils/BackendUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import AutoPayUtils from '../../utils/AutoPayUtils';

import { cashuStore, settingsStore } from '../../stores/Stores';
import SyncStore from '../../stores/SyncStore';

import MintToken from '../../assets/images/SVG/MintToken.svg';
import Mint from '../../assets/images/SVG/Mint.svg';
import Receive from '../../assets/images/SVG/Receive.svg';
import Send from '../../assets/images/SVG/Send.svg';

interface EcashSwipeableRowProps {
    navigation: StackNavigationProp<any, any>;
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
        progress: Animated.AnimatedInterpolation<number>
    ) => {
        const { account, navigation } = this.props;
        const transTranslateX = progress.interpolate({
            inputRange: [0.25, 1],
            outputRange: [x, 0]
        });
        const transOpacity = progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 1]
        });
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
            <Animated.View
                style={{
                    flex: 1,
                    transform: [{ translateX: transTranslateX }],
                    opacity: transOpacity
                }}
            >
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
            </Animated.View>
        );
    };

    private renderActions = (
        progress: Animated.AnimatedInterpolation<number>
    ) => (
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

    private swipeableRow?: Swipeable;

    private updateRef = (ref: Swipeable) => {
        this.swipeableRow = ref;
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

    private fetchLnInvoice = async () => {
        const { lightning, lnurlParams, navigation } = this.props;
        if (lightning?.toLowerCase().startsWith('lnurl') || lnurlParams) {
            this.handleLnurlRequest(lightning, lnurlParams, navigation);
            return;
        } else if (lightning) {
            if (AutoPayUtils.shouldTryAutoPay(lightning)) {
                try {
                    await cashuStore.getPayReq(lightning);

                    const autoPayProcessed =
                        await AutoPayUtils.checkCashuAutoPayAndProcess(
                            lightning,
                            navigation,
                            settingsStore,
                            cashuStore
                        );

                    if (autoPayProcessed) {
                        return;
                    }

                    navigation.navigate('CashuPaymentRequest', {});
                    return;
                } catch (error) {
                    console.error(
                        'Cashu auto-pay failed, falling back to manual ecash flow:',
                        error
                    );
                }
            }

            cashuStore.getPayReq(lightning);
            navigation.navigate('CashuPaymentRequest', {});
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
            <Swipeable
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
            </Swipeable>
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
