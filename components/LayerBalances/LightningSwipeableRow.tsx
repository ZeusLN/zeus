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
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { inject, observer } from 'mobx-react';

import ReactNativeBlobUtil from 'react-native-blob-util';
import { RectButton } from 'react-native-gesture-handler';
import ReanimatedSwipeable, {
    SwipeableMethods
} from 'react-native-gesture-handler/ReanimatedSwipeable';

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

interface LightningSwipeableRowProps {
    navigation: NativeStackNavigationProp<any, any>;
    lightning?: string;
    lnurlParams?: LNURLWithdrawParams | undefined;
    lightningAddress?: string;
    offer?: string;
    clinkNoffer?: string;
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
        progress: SharedValue<number>
    ) => {
        const { navigation } = this.props;
        const pressHandler = () => {
            this.close();

            if (text === localeString('general.receive')) {
                navigation.navigate('Receive', { forceLn: true });
            } else if (text === localeString('general.paycodes')) {
                navigation.navigate(
                    nodeInfoStore.supportsListingOffers
                        ? 'PayCodes'
                        : 'CreatePayCode'
                );
            } else if (text === localeString('general.routing')) {
                navigation.navigate('Routing');
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
            </ActionContainer>
        );
    };

    private renderActions = (progress: SharedValue<number>) => {
        let actionCount = 1; // Receive is always shown
        if (nodeInfoStore.supportsOffers) actionCount++;
        if (BackendUtils.supportsRouting()) actionCount++;
        if (BackendUtils.supportsLightningSends()) actionCount++;
        const width = actionCount * 70;
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

    private swipeableRow?: SwipeableMethods;

    private updateRef = (ref: SwipeableMethods | null) => {
        this.swipeableRow = ref ?? undefined;
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
        const {
            lightning,
            lightningAddress,
            offer,
            clinkNoffer,
            navigation,
            lnurlParams
        } = this.props;
        const { settings } = settingsStore;
        if (clinkNoffer) {
            this.props.navigation.navigate('ClinkPay', {
                noffer: clinkNoffer
            });
        } else if (offer) {
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
            clinkNoffer,
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
        if (
            locked &&
            (lightning ||
                lightningAddress ||
                offer ||
                clinkNoffer ||
                lnurlParams)
        ) {
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
            <ReanimatedSwipeable
                ref={this.updateRef}
                friction={2}
                enableTrackpadTwoFingerGesture
                leftThreshold={30}
                rightThreshold={40}
                renderLeftActions={this.renderActions}
            >
                <TouchableOpacity
                    onPress={() =>
                        lightning || offer || clinkNoffer || lnurlParams
                            ? this.fetchLnInvoice()
                            : this.open()
                    }
                    activeOpacity={1}
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
