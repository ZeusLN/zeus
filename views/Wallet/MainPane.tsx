import * as React from 'react';
import { Image, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Badge, Button } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';

import NodeInfoStore from './../../stores/NodeInfoStore';
import BalanceStore from './../../stores/BalanceStore';
import SettingsStore from './../../stores/SettingsStore';

const TorIcon = require('./../../images/tor.png');

import { version, playStore } from './../../package.json';
import { WalletHeader } from '../../components/WalletHeader';
import { Amount } from '../../components/Amount';

interface MainPaneProps {
    navigation: any;
    NodeInfoStore: NodeInfoStore;
    BalanceStore: BalanceStore;
    SettingsStore: SettingsStore;
}

@inject('SettingsStore')
@observer
export default class MainPane extends React.PureComponent<MainPaneProps, {}> {
    render() {
        const {
            NodeInfoStore,
            UnitsStore,
            BalanceStore,
            SettingsStore,
            navigation
        } = this.props;
        const {
            totalBlockchainBalance,
            unconfirmedBlockchainBalance,
            lightningBalance,
            pendingOpenBalance
        } = BalanceStore;
        const { implementation } = SettingsStore;
        const nodeAddress = SettingsStore.host || SettingsStore.url;
        const loading = NodeInfoStore.loading || BalanceStore.loading;

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

        const DefaultBalance = () => <BalanceViewCombined />;

        const LndHubBalance = () => <LightningBalance />;

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

        if (loading) {
            mainPane = (
                <View style={styles.loadingContainer}>
                    <WalletHeader navigation={navigation} loading={true} />
                    <Button
                        title=""
                        loading
                        buttonStyle={{
                            backgroundColor: 'transparent'
                        }}
                        onPress={() => void 0}
                    />
                </View>
            );
        } else if (!NodeInfoStore.error) {
            mainPane = (
                <View
                    style={{
                        height: 220,
                        alignItems: 'center',
                        backgroundColor: themeColor('secondary')
                    }}
                >
                    <WalletHeader navigation={navigation} />
                    {implementation === 'lndhub' ? (
                        <LndHubBalance />
                    ) : (
                        <DefaultBalance />
                    )}
                    {infoValue !== 'ⓘ' && <NetworkBadge />}
                </View>
            );
        } else {
            mainPane = (
                <View
                    style={{
                        backgroundColor: themeColor('error'),
                        paddingLeft: 10,
                        height: 160
                    }}
                >
                    <Text
                        style={{
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
                    />
                    <Text
                        style={{
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
