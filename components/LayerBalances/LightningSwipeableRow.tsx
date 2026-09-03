import React, { Component } from 'react';
import { Alert, View, I18nManager, TouchableOpacity } from 'react-native';
import { SharedValue } from 'react-native-reanimated';
import { LNURLWithdrawParams } from 'js-lnurl';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { inject, observer } from 'mobx-react';

import ReactNativeBlobUtil from 'react-native-blob-util';

import { doTorRequest, RequestMethod } from '../../utils/TorUtils';
import BackendUtils from './../../utils/BackendUtils';
import { getLnurlParams as getlnurlParams } from './../../utils/LnurlUtils';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';

import {
    modalStore,
    invoicesStore,
    nodeInfoStore,
    settingsStore
} from './../../stores/Stores';
import SyncStore from '../../stores/SyncStore';

import SwipeableRowAction from './SwipeableRowAction';
import SwipeableRowContainer from './SwipeableRowContainer';

import Receive from './../../assets/images/SVG/Receive.svg';
import Routing from './../../assets/images/SVG/Routing.svg';
import Send from './../../assets/images/SVG/Send.svg';

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
    private renderActions = (
        progress: SharedValue<number>,
        close: () => void
    ) => {
        const { navigation } = this.props;
        const supportsOffers = nodeInfoStore.supportsOffers;
        const supportsRouting = BackendUtils.supportsRouting();
        const supportsSends = BackendUtils.supportsLightningSends();
        // Receive is always shown
        const actionCount =
            1 +
            (supportsOffers ? 1 : 0) +
            (supportsRouting ? 1 : 0) +
            (supportsSends ? 1 : 0);
        const width = actionCount * 70;
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
                        navigation.navigate('Receive', { forceLn: true })
                    )}
                />
                {supportsOffers && (
                    <SwipeableRowAction
                        text={localeString('general.paycodes')}
                        x={width}
                        progress={progress}
                        icon={<Receive {...iconProps} />}
                        onPress={closeThen(() =>
                            navigation.navigate(
                                nodeInfoStore.supportsListingOffers
                                    ? 'PayCodes'
                                    : 'CreatePayCode'
                            )
                        )}
                    />
                )}
                {supportsRouting && (
                    <SwipeableRowAction
                        text={localeString('general.routing')}
                        x={width}
                        progress={progress}
                        icon={<Routing {...iconProps} />}
                        onPress={closeThen(() =>
                            navigation.navigate('Routing')
                        )}
                    />
                )}
                {supportsSends && (
                    <SwipeableRowAction
                        text={localeString('general.send')}
                        x={width}
                        progress={progress}
                        icon={<Send {...iconProps} />}
                        onPress={closeThen(() => navigation.navigate('Send'))}
                    />
                )}
            </View>
        );
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
                    accessibilityRole="button"
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
                    accessibilityRole="button"
                    accessibilityState={{ disabled }}
                >
                    {children}
                </TouchableOpacity>
            );
        }
        if (locked) return children;
        return (
            <SwipeableRowContainer
                renderLeftActions={this.renderActions}
                onPress={(open) =>
                    lightning || offer || clinkNoffer || lnurlParams
                        ? this.fetchLnInvoice()
                        : open()
                }
            >
                {children}
            </SwipeableRowContainer>
        );
    }
}
