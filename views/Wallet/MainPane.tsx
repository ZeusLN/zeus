import * as React from 'react';
import { Image, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Badge, Button, Header } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import LinearGradient from 'react-native-linear-gradient';
import PrivacyUtils from './../../utils/PrivacyUtils';

import NodeInfoStore from './../../stores/NodeInfoStore';
import UnitsStore from './../../stores/UnitsStore';
import BalanceStore from './../../stores/BalanceStore';
import SettingsStore from './../../stores/SettingsStore';

const TorIcon = require('./../../images/tor.png');

import { version } from './../../package.json';

interface MainPaneProps {
    navigation: any;
    NodeInfoStore: NodeInfoStore;
    UnitsStore: UnitsStore;
    BalanceStore: BalanceStore;
    SettingsStore: SettingsStore;
}

interface MainPaneState {
    combinedBalance: boolean;
}

@inject('UnitsStore', 'SettingsStore')
@observer
export default class MainPane extends React.Component<
    MainPaneProps,
    MainPaneState
> {
    state = {
        combinedBalance: false
    };

    render() {
        const {
            NodeInfoStore,
            UnitsStore,
            BalanceStore,
            SettingsStore,
            navigation
        } = this.props;
        const { combinedBalance } = this.state;
        const { changeUnits, getAmount, units } = UnitsStore;
        const {
            totalBlockchainBalance,
            unconfirmedBlockchainBalance,
            lightningBalance,
            pendingOpenBalance
        } = BalanceStore;
        const { host, settings } = SettingsStore;
        const { theme, lurkerMode } = settings;
        const loading = NodeInfoStore.loading || BalanceStore.loading;

        const pendingUnconfirmedBalance =
            Number(pendingOpenBalance) + Number(unconfirmedBlockchainBalance);
        const combinedBalanceValue =
            Number(totalBlockchainBalance) + Number(lightningBalance);

        const BalanceView = () => (
            <React.Fragment>
                <Text style={styles.lightningBalance}>
                    {units &&
                        (lurkerMode
                            ? PrivacyUtils.hideValue(
                                  getAmount(lightningBalance),
                                  null,
                                  true
                              )
                            : getAmount(lightningBalance))}{' '}
                    ⚡
                </Text>
                {pendingOpenBalance > 0 ? (
                    <Text style={styles.pendingBalance}>
                        {units &&
                            (lurkerMode
                                ? PrivacyUtils.hideValue(
                                      getAmount(pendingOpenBalance),
                                      null,
                                      true
                                  )
                                : getAmount(pendingOpenBalance))}{' '}
                        pending open
                    </Text>
                ) : null}
                <Text style={styles.blockchainBalance}>
                    {units &&
                        (lurkerMode
                            ? PrivacyUtils.hideValue(
                                  getAmount(totalBlockchainBalance),
                                  null,
                                  true
                              )
                            : getAmount(totalBlockchainBalance))}{' '}
                    ⛓️
                </Text>
                {unconfirmedBlockchainBalance ? (
                    <Text style={styles.pendingBalance}>
                        {units &&
                            (lurkerMode
                                ? PrivacyUtils.hideValue(
                                      getAmount(unconfirmedBlockchainBalance),
                                      null,
                                      true
                                  )
                                : getAmount(unconfirmedBlockchainBalance))}{' '}
                        pending
                    </Text>
                ) : null}
            </React.Fragment>
        );

        const BalanceViewCombined = () => (
            <React.Fragment>
                <Text style={styles.lightningBalance}>
                    {units &&
                        (lurkerMode
                            ? PrivacyUtils.hideValue(
                                  getAmount(combinedBalanceValue),
                                  null,
                                  true
                              )
                            : getAmount(combinedBalanceValue))}
                </Text>
                {unconfirmedBlockchainBalance || pendingOpenBalance ? (
                    <Text style={styles.pendingBalance}>
                        {units &&
                            (lurkerMode
                                ? PrivacyUtils.hideValue(
                                      getAmount(pendingUnconfirmedBalance),
                                      null,
                                      true
                                  )
                                : getAmount(pendingUnconfirmedBalance))}{' '}
                        pending
                    </Text>
                ) : null}
            </React.Fragment>
        );

        const SettingsButton = () => (
            <Button
                title=""
                icon={{
                    name: 'settings',
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
        if (NodeInfoStore.testnet) {
            infoValue = 'Testnet';
        } else if (NodeInfoStore.regtest) {
            infoValue = 'Regtest';
        }

        const NodeInfoBadge = () => (
            <View style={styles.nodeInfo}>
                {host && host.includes('.onion') && (
                    <TouchableOpacity
                        onPress={() => navigation.navigate('NodeInfo')}
                    >
                        <Image
                            style={{ width: 25, height: 25 }}
                            source={TorIcon}
                        />
                    </TouchableOpacity>
                )}
                {host && !host.includes('.onion') && (
                    <Badge
                        onPress={() => navigation.navigate('NodeInfo')}
                        value={infoValue}
                        badgeStyle={{
                            backgroundColor: 'gray',
                            borderWidth: 0,
                            marginLeft: 5
                        }}
                    />
                )}
            </View>
        );

        let mainPane;

        if (loading) {
            mainPane = (
                <View
                    style={
                        theme === 'dark'
                            ? styles.loadingContainerDark
                            : styles.loadingContainer
                    }
                >
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
                <View>
                    <LinearGradient
                        colors={
                            theme === 'dark'
                                ? darkThemeGradient
                                : lightThemeGradient
                        }
                        style={styles.container}
                    >
                        <Header
                            leftComponent={<NodeInfoBadge />}
                            rightComponent={<SettingsButton />}
                            backgroundColor="transparent"
                            containerStyle={{
                                borderBottomWidth: 0
                            }}
                        />
                        <TouchableOpacity
                            onPress={() => changeUnits()}
                            onLongPress={() =>
                                this.setState({
                                    combinedBalance: !combinedBalance
                                })
                            }
                        >
                            {combinedBalance ? (
                                <BalanceViewCombined />
                            ) : (
                                <BalanceView />
                            )}
                        </TouchableOpacity>
                        <View style={styles.buttons}>
                            <Button
                                title="Send"
                                icon={{
                                    name: 'arrow-upward',
                                    size: 25,
                                    color: 'red'
                                }}
                                buttonStyle={{
                                    backgroundColor:
                                        theme === 'dark' ? 'black' : 'white',
                                    borderRadius: 30
                                }}
                                containerStyle={{
                                    marginRight: 10
                                }}
                                titleStyle={{
                                    color: theme === 'dark' ? 'white' : 'black'
                                }}
                                onPress={() => navigation.navigate('Send')}
                                raised={theme !== 'dark'}
                            />
                            <Button
                                title="Receive"
                                icon={{
                                    name: 'arrow-downward',
                                    size: 25,
                                    color: 'green'
                                }}
                                buttonStyle={{
                                    backgroundColor:
                                        theme === 'dark' ? 'black' : 'white',
                                    borderRadius: 30
                                }}
                                containerStyle={{
                                    marginLeft: 10,
                                    marginRight: 10
                                }}
                                titleStyle={{
                                    color: theme === 'dark' ? 'white' : 'black'
                                }}
                                onPress={() => navigation.navigate('Receive')}
                                raised={theme !== 'dark'}
                            />
                            <Button
                                title="Scan"
                                icon={{
                                    name: 'crop-free',
                                    size: 25,
                                    color: '#f1a58c'
                                }}
                                buttonStyle={{
                                    backgroundColor:
                                        theme === 'dark' ? 'black' : 'white',
                                    borderRadius: 20
                                }}
                                containerStyle={{
                                    marginLeft: 10
                                }}
                                titleStyle={{
                                    color: theme === 'dark' ? 'white' : 'black'
                                }}
                                onPress={() =>
                                    navigation.navigate('AddressQRCodeScanner')
                                }
                                raised={theme !== 'dark'}
                            />
                        </View>
                    </LinearGradient>
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
                            : 'Error connecting to your node. Please check your settings and try again.'}
                    </Text>
                    <Button
                        icon={{
                            name: 'settings',
                            size: 25,
                            color: '#fff'
                        }}
                        title="Go to Settings"
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
                        {`v${version}`}
                    </Text>
                </View>
            );
        }

        return <React.Fragment>{mainPane}</React.Fragment>;
    }
}

const lightThemeGradient = ['#FAB57F', 'orange', '#ee7600'];
const darkThemeGradient = ['#33194d', '#261339', 'black'];

const styles = StyleSheet.create({
    container: {
        paddingBottom: 50,
        paddingLeft: 10
    },
    loadingContainer: {
        backgroundColor: 'rgba(253, 164, 40, 0.5)',
        paddingTop: 10,
        paddingBottom: 50,
        paddingLeft: 10
    },
    loadingContainerDark: {
        backgroundColor: '#261339',
        paddingTop: 10,
        paddingBottom: 50,
        paddingLeft: 10
    },
    errorContainer: {
        backgroundColor: '#cc3300', // dark red
        paddingTop: 25,
        paddingBottom: 50,
        paddingLeft: 10
    },
    errorContainerDark: {
        backgroundColor: '#992600', // dark dark red
        paddingTop: 25,
        paddingBottom: 50,
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
    },
    buttons: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 20,
        marginBottom: -30
    }
});
