import * as React from 'react';
import { Image, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Badge, Button, Header } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import PrivacyUtils from './../../utils/PrivacyUtils';
import { localeString } from './../../utils/LocaleUtils';

import NodeInfoStore from './../../stores/NodeInfoStore';
import UnitsStore from './../../stores/UnitsStore';
import BalanceStore from './../../stores/BalanceStore';
import SettingsStore from './../../stores/SettingsStore';

import NodeOn from './../../images/SVG/Node On.svg';

const TorIcon = require('./../../images/tor.png');

import { version, playStore } from './../../package.json';

interface MainPaneProps {
    navigation: any;
    NodeInfoStore: NodeInfoStore;
    UnitsStore: UnitsStore;
    BalanceStore: BalanceStore;
    SettingsStore: SettingsStore;
}

@inject('UnitsStore', 'SettingsStore')
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
        const { changeUnits, getAmount, units } = UnitsStore;
        const {
            totalBlockchainBalance,
            unconfirmedBlockchainBalance,
            lightningBalance,
            pendingOpenBalance
        } = BalanceStore;
        const { settings, implementation } = SettingsStore;
        const nodeAddress = SettingsStore.host || SettingsStore.url;
        const { theme } = settings;
        const loading = NodeInfoStore.loading || BalanceStore.loading;

        const pendingUnconfirmedBalance =
            Number(pendingOpenBalance) + Number(unconfirmedBlockchainBalance);
        const combinedBalanceValue =
            Number(totalBlockchainBalance) + Number(lightningBalance);

        const LightningBalance = () => (
            <>
                <Text style={styles.lightningBalance}>
                    {units &&
                        PrivacyUtils.sensitiveValue(
                            getAmount(lightningBalance),
                            8,
                            true
                        )}{' '}
                    ⚡
                </Text>
                {pendingOpenBalance > 0 ? (
                    <Text style={styles.pendingBalance}>
                        {units &&
                            PrivacyUtils.sensitiveValue(
                                getAmount(pendingOpenBalance),
                                8,
                                true
                            )}{' '}
                        pending open
                    </Text>
                ) : null}
            </>
        );

        const BalanceView = () => (
            <React.Fragment>
                <LightningBalance />
                <Text style={styles.blockchainBalance}>
                    {units &&
                        PrivacyUtils.sensitiveValue(
                            getAmount(totalBlockchainBalance),
                            8,
                            true
                        )}{' '}
                    ⛓️
                </Text>
                {unconfirmedBlockchainBalance ? (
                    <Text style={styles.pendingBalance}>
                        {units &&
                            PrivacyUtils.sensitiveValue(
                                getAmount(unconfirmedBlockchainBalance),
                                8,
                                true
                            )}{' '}
                        pending
                    </Text>
                ) : null}
            </React.Fragment>
        );

        const BalanceViewCombined = () => (
            <React.Fragment>
                <Text style={styles.lightningBalance}>
                    {units &&
                        PrivacyUtils.sensitiveValue(
                            getAmount(combinedBalanceValue),
                            null,
                            true
                        )}
                </Text>
                {unconfirmedBlockchainBalance || pendingOpenBalance ? (
                    <Text style={styles.pendingBalance}>
                        {units &&
                            PrivacyUtils.sensitiveValue(
                                getAmount(pendingUnconfirmedBalance),
                                null,
                                true
                            )}{' '}
                        pending
                    </Text>
                ) : null}
            </React.Fragment>
        );

        const SettingsButton = () => (
            <Button
                title=""
                icon={{
                    name: 'more-horiz',
                    size: 25,
                    color: '#fff'
                }}
                buttonStyle={{
                    backgroundColor: 'transparent',
                    marginRight: -10
                }}
                onPress={() => navigation.navigate('Settings')}
            />
        );

        let infoValue = 'ⓘ';
        if (NodeInfoStore.nodeInfo.isTestNet) {
            infoValue = localeString('views.Wallet.MainPane.testnet');
        } else if (NodeInfoStore.nodeInfo.isRegTest) {
            infoValue = localeString('views.Wallet.MainPane.regnet');
        }

        const DefaultBalance = () => (
            <>
                <TouchableOpacity onPress={() => changeUnits()}>
                    <BalanceViewCombined />
                </TouchableOpacity>
            </>
        );

        const LndHubBalance = () => (
            <>
                <TouchableOpacity onPress={() => changeUnits()}>
                    <LightningBalance />
                </TouchableOpacity>
            </>
        );

        const NodeInfoBadge = () => (
            <TouchableOpacity
                onPress={() => this.props.navigation.navigate('NodeInfo')}
            >
                <NodeOn />
            </TouchableOpacity>
        );

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
                    <Header
                        rightComponent={<SettingsButton />}
                        backgroundColor="transparent"
                        containerStyle={{
                            borderBottomWidth: 0
                        }}
                    />
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
                <View style={styles.container}>
                    <Header
                        leftComponent={<NodeInfoBadge />}
                        rightComponent={<SettingsButton />}
                        backgroundColor="transparent"
                        containerStyle={{
                            borderBottomWidth: 0
                        }}
                    />
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
                    style={
                        theme === 'dark'
                            ? styles.errorContainerDark
                            : styles.errorContainer
                    }
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
    container: {
        height: 150,
        alignItems: 'center',
        backgroundColor: '#1f2328'
    },
    loadingContainer: {
        height: 150,
        paddingLeft: 10
    },
    errorContainer: {
        backgroundColor: '#cc3300', // dark red
        paddingLeft: 10
    },
    errorContainerDark: {
        backgroundColor: '#992600', // dark dark red
        paddingLeft: 10
    },
    lightningBalance: {
        fontSize: 40,
        color: '#fff'
    },
    blockchainBalance: {
        fontSize: 30,
        color: '#fff'
    },
    pendingBalance: {
        fontSize: 20,
        color: '#fff'
    },
    settings: {},
    nodeInfo: {
        alignItems: 'flex-start',
        marginLeft: -15
    }
});
