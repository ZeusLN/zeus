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
import { StackNavigationProp } from '@react-navigation/stack';
import { inject, observer } from 'mobx-react';

import ReactNativeBlobUtil from 'react-native-blob-util';
import { RectButton, Swipeable } from 'react-native-gesture-handler';

import { doTorRequest, RequestMethod } from '../../utils/TorUtils';
import BackendUtils from './../../utils/BackendUtils';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';

import {
    modalStore,
    invoicesStore,
    nodeInfoStore,
    settingsStore
} from './../../stores/Stores';
import SyncStore from '../../stores/SyncStore';

import Receive from './../../assets/images/SVG/Receive.svg';
import Routing from './../../assets/images/SVG/Routing.svg';
import Send from './../../assets/images/SVG/Send.svg';

interface LightningSwipeableRowProps {
    navigation: StackNavigationProp<any, any>;
    lightning?: string;
    lnurlParams?: LNURLWithdrawParams | undefined;
    lightningAddress?: string;
    offer?: string;
    locked?: boolean;
    children: React.ReactNode;
    disabled?: boolean;
    SyncStore?: SyncStore;
}

@inject('SyncStore')
@observer
export default class LightningSwipeableRow extends Component<
    LightningSwipeableRowProps,
    {}
> {
    private renderAction = (
        text: string,
        x: number,
        progress: Animated.AnimatedInterpolation<number>
    ) => {
        const { navigation } = this.props;
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
                navigation.navigate('Receive', { forceLn: true });
            } else if (text === localeString('general.paycodes')) {
                navigation.navigate('PayCodes');
            } else if (text === localeString('general.routing')) {
                navigation.navigate('Routing');
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
                        {text === localeString('general.routing') && (
                            <Routing
                                fill={
                                    themeColor('action') ||
                                    themeColor('highlight')
                                }
                                width={30}
                                height={30}
                            />
                        )}
                        {text === localeString('general.paycodes') && (
                            <Receive
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
    ) => {
        const width =
            BackendUtils.supportsRouting() &&
            BackendUtils.supportsLightningSends() &&
            nodeInfoStore.supportsOffers
                ? 280
                : BackendUtils.supportsRouting() &&
                  BackendUtils.supportsLightningSends()
                ? 210
                : BackendUtils.supportsRouting() ||
                  BackendUtils.supportsLightningSends()
                ? 140
                : 70;
        return (
            <View
                style={{
                    marginLeft: 15,
                    width,
                    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row'
                }}
            >
                {this.renderAction(
                    localeString('general.receive'),
                    width,
                    progress
                )}
                {nodeInfoStore.supportsOffers &&
                    this.renderAction(
                        localeString('general.paycodes'),
                        width,
                        progress
                    )}
                {BackendUtils.supportsRouting() &&
                    this.renderAction(
                        localeString('general.routing'),
                        width,
                        progress
                    )}
                {BackendUtils.supportsLightningSends() &&
                    this.renderAction(
                        localeString('general.send'),
                        width,
                        progress
                    )}
            </View>
        );
    };

    private swipeableRow?: Swipeable;

    private updateRef = (ref: Swipeable) => {
        this.swipeableRow = ref;
    };

    private close = () => {
        if (this.swipeableRow) {
            this.swipeableRow.close();
        }
    };

    private open = () => {
        if (this.swipeableRow) {
            this.swipeableRow.openLeft();
        }
    };

    private handleLnurlRequest = async (
        lightning?: string,
        lnurlParams?: any,
        navigation?: any,
        settings?: any
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
                    ecash:
                        BackendUtils.supportsCashuWallet() &&
                        settings?.ecash?.enableCashu
                });
                break;
            case 'withdrawRequest':
                navigation.navigate('Receive', {
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
    private handleLightningAddress = async (
        lightningAddress: string,
        navigation: any,
        settings: any
    ): Promise<void> => {
        const [username, bolt11Domain] = lightningAddress.split('@');
        const url = bolt11Domain.includes('.onion')
            ? `http://${bolt11Domain}/.well-known/lnurlp/${username.toLowerCase()}`
            : `https://${bolt11Domain}/.well-known/lnurlp/${username.toLowerCase()}`;

        const error = localeString(
            'utils.handleAnything.lightningAddressError'
        );

        if (settingsStore.enableTor && bolt11Domain.includes('.onion')) {
            await doTorRequest(url, RequestMethod.GET)
                .then((response: any) => {
                    if (!response.callback) {
                        throw new Error(error);
                    }
                    navigation.navigate('LnurlPay', {
                        lnurlParams: response,
                        ecash:
                            BackendUtils.supportsCashuWallet() &&
                            settings?.ecash?.enableCashu,
                        lightningAddress
                    });
                })
                .catch((error: any) => {
                    throw new Error(error);
                });
        } else {
            await ReactNativeBlobUtil.fetch('get', url).then(
                (response: any) => {
                    const status = response.info().status;
                    if (status === 200) {
                        const data = response.json();
                        if (!data.callback) {
                            throw new Error(error);
                        }
                        navigation.navigate('LnurlPay', {
                            lnurlParams: data,
                            ecash:
                                BackendUtils.supportsCashuWallet() &&
                                settings?.ecash?.enableCashu,
                            lightningAddress
                        });
                    } else {
                        throw new Error(error);
                    }
                }
            );
        }
    };

    private fetchLnInvoice = async () => {
        const { lightning, lightningAddress, offer, navigation, lnurlParams } =
            this.props;
        const { settings } = settingsStore;
        if (offer) {
            this.props.navigation.navigate('Send', {
                destination: offer,
                bolt12: offer,
                transactionType: 'BOLT 12',
                isValid: true
            });
        } else if (lightningAddress) {
            this.handleLightningAddress(lightningAddress, navigation, settings);
        } else if (
            lightning?.toLowerCase().startsWith('lnurl') ||
            lnurlParams
        ) {
            this.handleLnurlRequest(
                lightning,
                lnurlParams,
                navigation,
                settings
            );
        } else {
            invoicesStore.getPayReq(lightning ?? '');
            navigation.navigate('PaymentRequest', {});
        }
    };

    render() {
        const {
            children,
            lightning,
            lightningAddress,
            offer,
            locked,
            disabled,
            lnurlParams,
            SyncStore
        } = this.props;
        const { isSyncing } = SyncStore!;
        if (isSyncing) {
            return (
                <TouchableOpacity
                    onPress={() =>
                        modalStore.toggleInfoModal({
                            text: localeString('views.Wallet.waitForSync')
                        })
                    }
                >
                    <View style={{ opacity: 0.25 }}>{children}</View>
                </TouchableOpacity>
            );
        }
        if (locked && (lightning || lightningAddress || offer || lnurlParams)) {
            return (
                <TouchableOpacity
                    onPress={() => (disabled ? null : this.fetchLnInvoice())}
                    activeOpacity={1}
                >
                    {children}
                </TouchableOpacity>
            );
        }
        if (locked) return children;
        return (
            <Swipeable
                ref={this.updateRef}
                friction={2}
                enableTrackpadTwoFingerGesture
                leftThreshold={30}
                rightThreshold={40}
                renderLeftActions={this.renderActions}
            >
                <TouchableOpacity
                    onPress={() =>
                        lightning || offer || lnurlParams
                            ? this.fetchLnInvoice()
                            : this.open()
                    }
                    activeOpacity={1}
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
