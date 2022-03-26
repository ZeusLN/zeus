import * as React from 'react';
import { Image, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Badge } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import Button from '../../components/Button';
import { WalletHeader } from '../../components/WalletHeader';
import { Amount } from '../../components/Amount';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';

import NodeInfoStore from './../../stores/NodeInfoStore';
import BalanceStore from './../../stores/BalanceStore';
import SettingsStore from './../../stores/SettingsStore';

import { version, playStore } from './../../package.json';

const TorIcon = require('./../../assets/images/tor.png');

interface MainPaneProps {
    navigation: any;
    NodeInfoStore: NodeInfoStore;
    BalanceStore: BalanceStore;
    SettingsStore: SettingsStore;
}

@inject('BalanceStore', 'SettingsStore')
@observer
export default class MainPane extends React.PureComponent<MainPaneProps, {}> {
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
        const nodeAddress = SettingsStore.host || SettingsStore.url;

        const pendingUnconfirmedBalance =
            Number(pendingOpenBalance) + Number(unconfirmedBlockchainBalance);
        const combinedBalanceValue =
            Number(totalBlockchainBalance) + Number(lightningBalance);

        const LightningBalance = () => (
            <>
                <Amount
                    sats={lightningBalance}
                    sensitive
                    jumboText
                    toggleable
                />
                {pendingOpenBalance > 0 ? (
                    <Amount
                        sats={pendingOpenBalance}
                        sensitive
                        jumboText
                        toggleable
                        pending
                    />
                ) : null}
            </>
        );
        const BalanceViewCombined = () => (
            <>
                <Amount
                    sats={combinedBalanceValue}
                    sensitive
                    jumboText
                    toggleable
                />
                {unconfirmedBlockchainBalance || pendingOpenBalance ? (
                    <Amount
                        sats={pendingUnconfirmedBalance}
                        sensitive
                        jumboText
                        toggleable
                        pending
                    />
                ) : null}
            </>
        );

        let infoValue = 'ⓘ';
        if (NodeInfoStore.nodeInfo.isTestNet) {
            infoValue = localeString('views.Wallet.MainPane.testnet');
        } else if (NodeInfoStore.nodeInfo.isRegTest) {
            infoValue = localeString('views.Wallet.MainPane.regnet');
        }

        const NetworkBadge = () => (
            <View style={styles.nodeInfo}>
                {nodeAddress && nodeAddress.includes('.onion') ? (
                    <TouchableOpacity
                        onPress={() => navigation.navigate('NodeInfo')}
                    >
                        <Image
                            style={{ width: 25, height: 25 }}
                            source={TorIcon}
                        />
                    </TouchableOpacity>
                ) : null}
                {nodeAddress && !nodeAddress.includes('.onion') ? (
                    <Badge
                        onPress={() => navigation.navigate('NodeInfo')}
                        value={infoValue}
                        badgeStyle={{
                            backgroundColor: 'gray',
                            borderWidth: 0,
                            marginLeft: 5
                        }}
                    />
                ) : null}
            </View>
        );

        let mainPane;

        if (!NodeInfoStore.error) {
            mainPane = (
                <View
                    style={{
                        alignItems: 'center',
                        height: 240,
                        backgroundColor: themeColor('background')
                    }}
                >
                    <WalletHeader
                        navigation={navigation}
                        SettingsStore={SettingsStore}
                    />
                    <View style={{ marginTop: 40 }}>
                        {implementation === 'lndhub' ? (
                            <LightningBalance />
                        ) : (
                            <BalanceViewCombined />
                        )}
                        {infoValue !== 'ⓘ' && (
                            <View
                                style={{
                                    marginTop: 5,
                                    alignItems: 'center'
                                }}
                            >
                                <NetworkBadge />
                            </View>
                        )}
                    </View>
                </View>
            );
        } else {
            mainPane = (
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
                        {NodeInfoStore.errorMsg
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

        return <React.Fragment>{mainPane}</React.Fragment>;
    }
}

const styles = StyleSheet.create({
    loadingContainer: {
        height: 220,
        paddingLeft: 10
    },
    nodeInfo: {
        alignItems: 'flex-start',
        marginLeft: -15
    }
});
