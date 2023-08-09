import * as React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { inject, observer } from 'mobx-react';
import BigNumber from 'bignumber.js';

import Button from '../../components/Button';
import WalletHeader from '../../components/WalletHeader';
import Amount from '../../components/Amount';
import Conversion from '../../components/Conversion';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';

import BalanceStore from './../../stores/BalanceStore';
import NodeInfoStore from './../../stores/NodeInfoStore';
import SettingsStore from './../../stores/SettingsStore';

import { version, playStore } from './../../package.json';

interface BalancePaneProps {
    navigation: any;
    BalanceStore: BalanceStore;
    NodeInfoStore: NodeInfoStore;
    SettingsStore: SettingsStore;
}

@inject('BalanceStore', 'NodeInfoStore', 'SettingsStore')
@observer
export default class BalancePane extends React.PureComponent<
    BalancePaneProps,
    {}
> {
    render() {
        const { NodeInfoStore, BalanceStore, SettingsStore, navigation } =
            this.props;
        const {
            totalBlockchainBalance,
            unconfirmedBlockchainBalance,
            lightningBalance,
            pendingOpenBalance
        } = BalanceStore;
        const { implementation } = SettingsStore;

        const pendingUnconfirmedBalance = new BigNumber(pendingOpenBalance)
            .plus(unconfirmedBlockchainBalance)
            .toNumber()
            .toFixed(3);
        const combinedBalanceValue = new BigNumber(totalBlockchainBalance)
            .plus(lightningBalance)
            .toNumber()
            .toFixed(3);

        const LightningBalance = () => (
            <View style={styles.balance}>
                <Amount
                    sats={lightningBalance}
                    sensitive
                    jumboText
                    toggleable
                />
                {!(pendingOpenBalance > 0) && (
                    <View style={styles.conversion}>
                        <Conversion sats={lightningBalance} sensitive />
                    </View>
                )}
                {pendingOpenBalance > 0 ? (
                    <>
                        <Amount
                            sats={pendingOpenBalance}
                            sensitive
                            jumboText
                            toggleable
                            pending
                        />
                        <View style={styles.conversion}>
                            <Conversion
                                sats={lightningBalance}
                                satsPending={pendingOpenBalance}
                                sensitive
                            />
                        </View>
                    </>
                ) : null}
            </View>
        );
        const BalanceViewCombined = () => (
            <View style={styles.balance}>
                <Amount
                    sats={combinedBalanceValue}
                    sensitive
                    jumboText
                    toggleable
                />
                {!(unconfirmedBlockchainBalance || pendingOpenBalance) && (
                    <View style={styles.conversion}>
                        <Conversion sats={combinedBalanceValue} sensitive />
                    </View>
                )}
                {unconfirmedBlockchainBalance || pendingOpenBalance ? (
                    <>
                        <Amount
                            sats={pendingUnconfirmedBalance}
                            sensitive
                            jumboText
                            toggleable
                            pending
                        />
                        <View style={styles.conversionSecondary}>
                            <Conversion
                                sats={combinedBalanceValue}
                                satsPending={pendingUnconfirmedBalance}
                                sensitive
                            />
                        </View>
                    </>
                ) : null}
            </View>
        );

        let balancePane;
        const error = NodeInfoStore.error || SettingsStore.error;

        if (!error) {
            balancePane = (
                <View
                    style={{
                        alignItems: 'center',
                        minHeight: 200
                    }}
                >
                    <WalletHeader
                        navigation={navigation}
                        SettingsStore={SettingsStore}
                    />
                    <View
                        style={{
                            marginTop: 40,
                            marginBottom: 20
                        }}
                    >
                        {implementation === 'lndhub' ? (
                            <LightningBalance />
                        ) : (
                            <BalanceViewCombined />
                        )}
                    </View>
                </View>
            );
        } else {
            balancePane = (
                <View
                    style={{
                        backgroundColor: themeColor('error'),
                        paddingTop: 20,
                        paddingLeft: 10,
                        flex: 1
                    }}
                >
                    <Text
                        style={{
                            fontFamily: 'Lato-Regular',
                            color: '#fff',
                            fontSize: 20,
                            marginTop: 20,
                            marginBottom: 25
                        }}
                    >
                        {SettingsStore.errorMsg
                            ? SettingsStore.errorMsg
                            : NodeInfoStore.errorMsg
                            ? NodeInfoStore.errorMsg
                            : localeString('views.Wallet.MainPane.error')}
                    </Text>
                    <Button
                        icon={{
                            name: 'settings',
                            size: 25,
                            color: '#fff'
                        }}
                        title={localeString(
                            'views.Wallet.MainPane.goToSettings'
                        )}
                        buttonStyle={{
                            backgroundColor: 'gray',
                            borderRadius: 30
                        }}
                        containerStyle={{
                            alignItems: 'center'
                        }}
                        onPress={() => navigation.navigate('Settings')}
                        adaptiveWidth
                    />
                    <Text
                        style={{
                            fontFamily: 'Lato-Regular',
                            color: '#fff',
                            fontSize: 12,
                            marginTop: 20,
                            marginBottom: -40
                        }}
                    >
                        {playStore ? `v${version}-play` : `v${version}`}
                    </Text>
                </View>
            );
        }

        return <React.Fragment>{balancePane}</React.Fragment>;
    }
}

const styles = StyleSheet.create({
    balance: {
        alignItems: 'center'
    },
    conversion: {
        top: 10,
        alignItems: 'center'
    },
    conversionSecondary: {
        top: 3,
        alignItems: 'center'
    }
});
