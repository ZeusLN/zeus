import React, { Component } from 'react';
import { Alert, View, I18nManager, TouchableOpacity } from 'react-native';
import { SharedValue } from 'react-native-reanimated';
import { LNURLWithdrawParams } from 'js-lnurl';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { inject, observer } from 'mobx-react';

import BackendUtils from '../../utils/BackendUtils';
import { getLnurlParams as getlnurlParams } from '../../utils/LnurlUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import { cashuStore } from '../../stores/Stores';
import SyncStore from '../../stores/SyncStore';

import SwipeableRowAction from './SwipeableRowAction';
import SwipeableRowContainer from './SwipeableRowContainer';

import MintToken from '../../assets/images/SVG/MintToken.svg';
import Mint from '../../assets/images/SVG/Mint.svg';
import Receive from '../../assets/images/SVG/Receive.svg';
import Send from '../../assets/images/SVG/Send.svg';

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
    private renderActions = (
        progress: SharedValue<number>,
        close: () => void
    ) => {
        const { account, navigation } = this.props;
        const wideWidth = BackendUtils.supportsCoinControl() ? 210 : 140;
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
                    width: 280,
                    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row'
                }}
            >
                <SwipeableRowAction
                    text={localeString('general.receive')}
                    x={wideWidth}
                    progress={progress}
                    icon={<Receive {...iconProps} />}
                    onPress={closeThen(() =>
                        navigation.navigate('ReceiveEcash')
                    )}
                />
                <SwipeableRowAction
                    text={localeString('cashu.mints')}
                    x={200}
                    progress={progress}
                    icon={<Mint {...iconProps} />}
                    onPress={closeThen(() =>
                        navigation.navigate('Mints', { account })
                    )}
                />
                <SwipeableRowAction
                    text={localeString('cashu.sendEcash')}
                    x={200}
                    progress={progress}
                    icon={<MintToken {...iconProps} />}
                    onPress={closeThen(() => navigation.navigate('SendEcash'))}
                />
                <SwipeableRowAction
                    text={localeString('general.send')}
                    x={wideWidth}
                    progress={progress}
                    icon={<Send {...iconProps} />}
                    onPress={closeThen(() => navigation.navigate('Send'))}
                />
            </View>
        );
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
                onPress={(open) =>
                    needsConfig
                        ? navigation.navigate('Mints')
                        : value
                        ? this.fetchLnInvoice()
                        : open()
                }
                containerStyle={{ width: '100%' }}
                touchableStyle={{ opacity: needsConfig ? 0.4 : 1 }}
            >
                {children}
            </SwipeableRowContainer>
        );
    }
}
